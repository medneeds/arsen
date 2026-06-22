// backup-restore — Restaura backups v3 (chunked) gerados por backup-create.
// Restrito a super_admin. Chunked: cliente invoca repetidamente; cada chamada
// processa UMA part (~500 linhas via UPSERT). Mantém system_maintenance_mode
// ATIVO durante toda execução e sempre desativa em finalize.
//
// Actions:
//   "plan"     { backup_id, mode:"full"|"partial", tables?, dry_run, reason, password }
//              -> { restore_id, plan: { table, parts:[{path}], rows_expected }[] }
//   "step"     { restore_id, table, part_path }
//              -> { rows_processed, errors, error_samples }
//   "finalize" { restore_id, success, error? }
//              -> { ok }

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "db-backups";
const BATCH = 500;

// Tabelas-catálogo com chave natural conhecida. Só é aplicada se existir UNIQUE real no destino.
const CATALOG_NATURAL_KEYS: Record<string, string[][]> = {
  hospital_units: [["name"]],
  states: [["name"], ["code"]],
  cid10_codes: [["code"]],
  medical_codes: [["code"]],
  medication_catalog: [["name"]],
  medication_presentations: [["medication_id", "presentation"]],
  medication_aliases: [["alias"]],
  data_retention_policies: [["data_type"]],
};

// Tradução de FKs por nome de coluna → tabela-catálogo alvo (id_map[table][backup_id]=local_id)
const FK_TRANSLATIONS: Record<string, string> = {
  hospital_unit_id: "hospital_units",
  state_id: "states",
  cid10_code_id: "cid10_codes",
  cid_id: "cid10_codes",
  medication_id: "medication_catalog",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const token = authHeader.replace("Bearer ", "");
  const { data: udata, error: uerr } = await userClient.auth.getUser(token);
  if (uerr || !udata?.user?.id) return json({ error: "Não autorizado" }, 401);
  const userId = udata.user.id;
  const userEmail = udata.user.email ?? null;

  // Apenas super_admin
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const isSuper = (roles ?? []).some((r: { role: string }) => r.role === "super_admin");
  if (!isSuper) return json({ error: "Acesso restrito a super administradores" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const action = String(body.action ?? "");

  try {
    if (action === "plan")     return await handlePlan(admin, body, userId, userEmail);
    if (action === "step")     return await handleStep(admin, body, userId, userEmail);
    if (action === "finalize") return await handleFinalize(admin, body, userId, userEmail);
    return json({ error: `action inválida: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[backup-restore]", action, msg);
    // best-effort: desativa manutenção em erro fatal
    try { await admin.from("system_maintenance_mode").update({ is_active: false }).eq("id", 1); } catch { /* */ }
    return json({ error: msg }, 500);
  }
});

async function handlePlan(admin: any, body: any, userId: string, userEmail: string | null) {
  const backupId = String(body.backup_id ?? "");
  const mode = body.mode === "partial" ? "partial" : "full";
  const dryRun = !!body.dry_run;
  const reason = String(body.reason ?? "").trim();
  const password = String(body.password ?? "");
  const requested: string[] = Array.isArray(body.tables) ? body.tables : [];

  if (!backupId) return json({ error: "backup_id obrigatório" }, 400);
  if (!reason || reason.length < 10) return json({ error: "Motivo obrigatório (≥10 caracteres)" }, 400);
  if (!password) return json({ error: "Senha obrigatória" }, 400);
  if (!userEmail) return json({ error: "Email do usuário ausente" }, 400);

  // Reverificação de senha
  const verify = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: pwErr } = await verify.auth.signInWithPassword({ email: userEmail, password });
  if (pwErr) return json({ error: "Senha incorreta" }, 401);

  // Manutenção já ativa? bloqueia
  const { data: mm } = await admin.from("system_maintenance_mode").select("is_active").eq("id", 1).maybeSingle();
  if (mm?.is_active) return json({ error: "Já existe uma operação de manutenção em andamento" }, 409);

  // Carrega job e manifest
  const { data: job, error: jErr } = await admin.from("backup_jobs").select("*").eq("id", backupId).maybeSingle();
  if (jErr || !job) return json({ error: "Backup não encontrado" }, 404);
  if (job.status !== "completed") return json({ error: `Backup status=${job.status} (apenas backups concluídos)` }, 400);

  const { data: manifestFile, error: mErr } = await admin.storage.from(BUCKET).download(`${backupId}/manifest.json`);
  if (mErr || !manifestFile) return json({ error: `manifest indisponível: ${mErr?.message}` }, 500);
  const manifest = JSON.parse(await manifestFile.text());
  const allParts: { path: string; bytes: number }[] = manifest.parts ?? [];

  // Mapeia parts por tabela: data/<table>.part-XXXX.jsonl e special/<table>.part-XXXX.jsonl
  const partsByTable = new Map<string, string[]>();
  // Parts de auth/users (json único ou jsonl em parts)
  const authUserParts: string[] = [];
  for (const p of allParts) {
    const mData = p.path.match(/^(data|special)\/([^/]+)\.part-\d{4}\.jsonl$/);
    if (mData) {
      const table = mData[2];
      if (!partsByTable.has(table)) partsByTable.set(table, []);
      partsByTable.get(table)!.push(p.path);
      continue;
    }
    if (/^auth\/users(\.part-\d{4})?\.(jsonl|json)$/.test(p.path)) {
      authUserParts.push(p.path);
    }
  }
  for (const arr of partsByTable.values()) arr.sort();
  authUserParts.sort();

  let targetTables = Array.from(partsByTable.keys());
  if (mode === "partial") {
    const reqSet = new Set(requested);
    targetTables = targetTables.filter((t) => reqSet.has(t));
    if (targetTables.length === 0) return json({ error: "Nenhuma tabela selecionada" }, 400);
  }

  // Ordem topológica (pais primeiro)
  const ordered = await topoOrder(targetTables);
  const pkMap = await fetchPks(ordered);

  // Schema do destino (colunas + uniques) — uma única descoberta
  const cols_by_table: Record<string, { allowed: string[]; generated: string[]; identity: string[] }> = {};
  const unique_by_table: Record<string, Array<{ name: string; columns: string[] }>> = {};
  try {
    const { data: colsRows } = await admin.rpc("get_public_table_columns", { tables: ordered });
    for (const r of (colsRows ?? []) as Array<{ table_name: string; column_name: string; is_generated: boolean; is_identity: boolean }>) {
      const e = cols_by_table[r.table_name] ?? (cols_by_table[r.table_name] = { allowed: [], generated: [], identity: [] });
      e.allowed.push(r.column_name);
      if (r.is_generated) e.generated.push(r.column_name);
      if (r.is_identity) e.identity.push(r.column_name);
    }
    const { data: uqRows } = await admin.rpc("get_public_unique_constraints", { tables: ordered });
    for (const r of (uqRows ?? []) as Array<{ table_name: string; constraint_name: string; columns: string[] }>) {
      (unique_by_table[r.table_name] ??= []).push({ name: r.constraint_name, columns: r.columns });
    }
  } catch (e) {
    console.warn("[backup-restore] schema discovery failed (fallback to legacy):", e);
  }

  // Marca catalog_strategy por tabela: chave natural válida se existir UNIQUE no destino
  const catalogStrategyByTable: Record<string, { natural: string[] } | null> = {};
  for (const t of ordered) {
    const candidates = CATALOG_NATURAL_KEYS[t];
    if (!candidates) { catalogStrategyByTable[t] = null; continue; }
    const uniques = unique_by_table[t] ?? [];
    const allowed = new Set(cols_by_table[t]?.allowed ?? []);
    let chosen: string[] | null = null;
    for (const cand of candidates) {
      const matches = uniques.some(u => sameCols(u.columns, cand));
      const allColsExist = cand.every(c => allowed.has(c));
      if (matches && allColsExist) { chosen = cand; break; }
    }
    catalogStrategyByTable[t] = chosen ? { natural: chosen } : null;
  }

  const plan: any[] = [];

  // Injeta etapa virtual de auth.users no início, se houver
  if (authUserParts.length > 0) {
    plan.push({
      table: "__auth_users__",
      pk: ["id"],
      parts: authUserParts.map((path) => ({ path })),
      rows_expected: manifest.table_counts?.["auth.users"] ?? null,
    });
  }

  for (const t of ordered) {
    plan.push({
      table: t,
      pk: pkMap[t] ?? ["id"],
      parts: (partsByTable.get(t) ?? []).map((path) => ({ path })),
      rows_expected: manifest.table_counts?.[t] ?? 0,
      catalog_natural_key: catalogStrategyByTable[t]?.natural ?? null,
      is_catalog: !!catalogStrategyByTable[t],
    });
  }

  // Cria restore_job
  const { data: rj, error: rjErr } = await admin.from("restore_jobs").insert({
    created_by: userId,
    created_by_email: userEmail,
    backup_job_id: backupId,
    uploaded_file_path: `${backupId}/manifest.json`,
    dry_run: dryRun,
    conflict_strategy: "replace",
    status: "running",
    started_at: new Date().toISOString(),
    target_instance: SUPABASE_URL,
    reason,
    progress: {
      step: "iniciando", percent: 0, plan,
      current_table: null, current_part: null,
      processed: 0, errors: 0,
      schema: { cols_by_table, unique_by_table },
      id_maps: {},
      dropped_columns_by_table: {},
      catalog_conflicts_by_table: {},
    },
  }).select().single();
  if (rjErr) return json({ error: `restore_job: ${rjErr.message}` }, 500);

  // Ativa manutenção (apenas se NÃO dry-run)
  if (!dryRun) {
    const { error: mmErr } = await admin.from("system_maintenance_mode").update({
      is_active: true,
      started_at: new Date().toISOString(),
      started_by: userId,
      reason: `Restore ${rj.id}: ${reason}`,
      expected_end_at: null,
    }).eq("id", 1);
    if (mmErr) return json({ error: `manutenção: ${mmErr.message}` }, 500);
  }

  await audit(admin, userId, userEmail, "BACKUP_RESTORE_START", {
    restore_job_id: rj.id, backup_job_id: backupId,
    payload: { mode, dry_run: dryRun, tables: ordered, reason, has_auth_users: authUserParts.length > 0 },
  });

  return json({ restore_id: rj.id, dry_run: dryRun, plan });
}

async function handleStep(admin: any, body: any, _userId: string, _userEmail: string | null) {
  const restoreId = String(body.restore_id ?? "");
  const table = String(body.table ?? "");
  const partPath = String(body.part_path ?? "");
  if (!restoreId || !table || !partPath) return json({ error: "restore_id+table+part_path obrigatórios" }, 400);

  const { data: rj, error: rjErr } = await admin.from("restore_jobs").select("*").eq("id", restoreId).maybeSingle();
  if (rjErr || !rj) return json({ error: "restore não encontrado" }, 404);
  if (rj.status !== "running") return json({ error: `restore status=${rj.status}` }, 400);

  const plan = rj.progress?.plan ?? [];
  const tEntry = plan.find((x: any) => x.table === table);
  if (!tEntry) return json({ error: "tabela fora do plano" }, 400);
  if (!tEntry.parts.some((p: any) => p.path === partPath)) return json({ error: "part fora do plano" }, 400);

  // Download
  const fullPath = partPath.startsWith(`${rj.backup_job_id}/`) ? partPath : `${rj.backup_job_id}/${partPath}`;
  const { data: file, error: dErr } = await admin.storage.from(BUCKET).download(fullPath);
  if (dErr || !file) return json({ error: `download (${fullPath}): ${dErr?.message}` }, 500);
  const text = await file.text();

  // auth/users pode vir como JSON array único OU jsonl
  let rows: any[];
  if (table === "__auth_users__" && partPath.endsWith(".json") && !partPath.endsWith(".jsonl")) {
    try {
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.users) ? parsed.users : []);
    } catch { rows = []; }
  } else {
    rows = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  }

  // Acumuladores
  let processed = 0, errors = 0;
  const errorSamples: string[] = [];
  const droppedCols: Record<string, number> = {};
  const idMapDelta: Record<string, Record<string, string>> = {};
  let catalogStats = { matched_existing: 0, inserted: 0, overwritten: 0 };
  let bedNumberReassigned = 0;

  const schema = rj.progress?.schema ?? { cols_by_table: {}, unique_by_table: {} };
  const idMaps: Record<string, Record<string, string>> = rj.progress?.id_maps ?? {};

  // ── Branch 1: recriar auth.users ──
  if (table === "__auth_users__") {
    if (!rj.dry_run) {
      for (const u of rows) {
        if (!u || !u.email) { errors++; if (errorSamples.length < 5) errorSamples.push(`auth.users sem email: id=${u?.id ?? "?"}`); continue; }
        try {
          const { data: created, error: cErr } = await admin.auth.admin.createUser({
            id: u.id,
            email: u.email,
            email_confirm: true,
            user_metadata: u.user_metadata ?? u.raw_user_meta_data ?? {},
            app_metadata: u.app_metadata ?? u.raw_app_meta_data ?? {},
          });
          if (cErr) {
            const msg = String(cErr.message ?? cErr);
            const exists = /already|exist|registered/i.test(msg);
            if (exists && u.id) {
              const { error: uErr } = await admin.auth.admin.updateUserById(u.id, {
                user_metadata: u.user_metadata ?? u.raw_user_meta_data ?? undefined,
                app_metadata: u.app_metadata ?? u.raw_app_meta_data ?? undefined,
              });
              if (uErr) { errors++; if (errorSamples.length < 5) errorSamples.push(`auth.update ${u.email}: ${uErr.message}`); }
              else processed++;
            } else {
              errors++; if (errorSamples.length < 5) errorSamples.push(`auth.create ${u.email}: ${msg}`);
            }
          } else {
            processed++;
            void created;
          }
        } catch (e) {
          errors++;
          if (errorSamples.length < 5) errorSamples.push(`auth.exception ${u.email}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } else {
      processed = rows.length;
    }
  } else {
    // ── Branch 2: tabelas públicas ──
    const meta = schema.cols_by_table?.[table];
    const allowed = new Set<string>(meta?.allowed ?? []);
    const generated = new Set<string>([...(meta?.generated ?? []), ...(meta?.identity ?? [])]);

    // Higieniza linhas: remove generated/identity sempre; remove desconhecidas se temos a lista
    const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (generated.has(k)) { droppedCols[k] = (droppedCols[k] ?? 0) + 1; continue; }
        if (allowed.size && !allowed.has(k)) { droppedCols[k] = (droppedCols[k] ?? 0) + 1; continue; }
        out[k] = v;
      }
      return out;
    };

    // Traduz FKs via id_maps
    const translateRow = (row: Record<string, unknown>) => {
      for (const [col, targetTable] of Object.entries(FK_TRANSLATIONS)) {
        const v = row[col];
        if (v == null) continue;
        const m = idMaps[targetTable];
        if (!m) continue;
        const local = m[String(v)];
        if (local && local !== v) row[col] = local;
      }
      return row;
    };

    if (rows.length > 0 && !rj.dry_run) {
      const pk = tEntry.pk ?? ["id"];
      const isCatalog = !!tEntry.is_catalog && Array.isArray(tEntry.catalog_natural_key) && tEntry.catalog_natural_key.length > 0;

      if (isCatalog) {
        // Catálogo: resolve por chave natural, popula id_map, NÃO sobrescreve linha existente
        const naturalKey: string[] = tEntry.catalog_natural_key;
        const pkCol = pk[0] ?? "id";
        for (const raw of rows) {
          const cleaned = cleanRow(raw as Record<string, unknown>);
          const backupId = (raw as any)[pkCol];
          // monta lookup
          let q = admin.from(table).select(`${pkCol}`).limit(1);
          let lookupOk = true;
          for (const k of naturalKey) {
            const v = (cleaned as any)[k];
            if (v == null) { lookupOk = false; break; }
            q = q.eq(k, v);
          }
          if (!lookupOk) {
            errors++;
            if (errorSamples.length < 5) errorSamples.push(`${table}: chave natural ausente (${naturalKey.join(",")})`);
            continue;
          }
          const { data: existing, error: selErr } = await q.maybeSingle();
          if (selErr) {
            errors++;
            if (errorSamples.length < 5) errorSamples.push(`${table} lookup: ${selErr.message}`);
            continue;
          }
          if (existing && (existing as any)[pkCol] != null) {
            const localId = (existing as any)[pkCol];
            if (backupId != null && String(backupId) !== String(localId)) {
              (idMapDelta[table] ??= {})[String(backupId)] = String(localId);
            }
            // Backup vence: UPDATE da linha local com os campos do backup (sem mexer no PK)
            const updatePayload: Record<string, unknown> = { ...cleaned };
            delete updatePayload[pkCol];
            if (Object.keys(updatePayload).length > 0) {
              const { error: updErr } = await admin.from(table).update(updatePayload).eq(pkCol, localId);
              if (updErr) {
                errors++;
                if (errorSamples.length < 5) errorSamples.push(`${table} update: ${updErr.message}`);
              } else {
                catalogStats.matched_existing++;
                catalogStats.overwritten++;
                processed++;
              }
            } else {
              catalogStats.matched_existing++;
              processed++;
            }
          } else {
            const { error: insErr } = await admin.from(table).insert(cleaned);
            if (insErr) {
              errors++;
              if (errorSamples.length < 5) errorSamples.push(`${table} insert: ${insErr.message}`);
            } else {
              catalogStats.inserted++;
              processed++;
            }
          }
        }
      } else if (table === "user_roles") {
        // UNIQUE (user_id, role) — backup vence; ignora coluna id para não colidir em PK
        for (let i = 0; i < rows.length; i += BATCH) {
          const slice = rows.slice(i, i + BATCH).map((r) => {
            const c = translateRow(cleanRow(r as Record<string, unknown>));
            delete (c as any).id;
            return c;
          });
          const { error } = await admin.from("user_roles").upsert(slice, { onConflict: "user_id,role" });
          if (error) {
            errors += slice.length;
            if (errorSamples.length < 3) errorSamples.push(error.message);
          } else {
            processed += slice.length;
          }
        }
      } else {
        // Não-catálogo: filtro + tradução de FK + upsert por PK em batch
        const onConflict = pk.join(",");
        for (let i = 0; i < rows.length; i += BATCH) {
          const slice = rows.slice(i, i + BATCH).map((r) => translateRow(cleanRow(r as Record<string, unknown>)));

          // patients: libera bed_number ocupado no destino por outros ids (backup vence em UNIQUE bed_number)
          if (table === "patients") {
            const pkCol = pk[0] ?? "id";
            const beds = Array.from(new Set(
              slice.map((r) => (r as any).bed_number).filter((v) => v != null && v !== "")
            ));
            const ids = slice.map((r) => (r as any)[pkCol]).filter((v) => v != null);
            if (beds.length > 0) {
              const { data: conflicting, error: selErr } = await admin
                .from("patients")
                .select(`${pkCol}, bed_number`)
                .in("bed_number", beds);
              if (!selErr && Array.isArray(conflicting) && conflicting.length > 0) {
                const idSet = new Set(ids.map((v) => String(v)));
                const toFree = conflicting
                  .filter((r: any) => !idSet.has(String(r[pkCol])))
                  .map((r: any) => r[pkCol]);
                if (toFree.length > 0) {
                  const { error: updErr } = await admin
                    .from("patients")
                    .update({ bed_number: null })
                    .in(pkCol, toFree);
                  if (updErr) {
                    if (errorSamples.length < 3) errorSamples.push(`patients bed_number release: ${updErr.message}`);
                  } else {
                    bedNumberReassigned += toFree.length;
                  }
                }
              }
            }
          }

          const { error } = await admin.from(table).upsert(slice, { onConflict });
          if (error) {
            errors += slice.length;
            if (errorSamples.length < 3) errorSamples.push(error.message);
          } else {
            processed += slice.length;
          }
        }
      }
    } else if (rj.dry_run) {
      processed = rows.length;
    }
  }

  // ── Atualiza progress ──
  const totalParts = plan.reduce((a: number, x: any) => a + (x.parts?.length ?? 0), 0) || 1;
  const doneParts = (rj.progress?.done_parts ?? 0) + 1;
  const percent = Math.min(99, Math.floor((doneParts / totalParts) * 100));

  const prevSamples: Array<{ table: string; part: string; message: string; at: string }> =
    Array.isArray(rj.progress?.error_samples) ? rj.progress.error_samples : [];
  const nowIso = new Date().toISOString();
  const newSamples = errorSamples.map((m) => ({ table, part: partPath, message: m, at: nowIso }));
  const mergedSamples = [...prevSamples, ...newSamples].slice(-50);

  const prevByTable: Record<string, { processed: number; errors: number }> =
    (rj.progress?.errors_by_table && typeof rj.progress.errors_by_table === "object")
      ? { ...rj.progress.errors_by_table } : {};
  const tStats = prevByTable[table] ?? { processed: 0, errors: 0 };
  prevByTable[table] = { processed: tStats.processed + processed, errors: tStats.errors + errors };

  // Merge dropped_columns_by_table
  const prevDropped: Record<string, Record<string, number>> = rj.progress?.dropped_columns_by_table ?? {};
  if (Object.keys(droppedCols).length > 0) {
    const tDrop = { ...(prevDropped[table] ?? {}) };
    for (const [c, n] of Object.entries(droppedCols)) tDrop[c] = (tDrop[c] ?? 0) + n;
    prevDropped[table] = tDrop;
  }

  // Merge catalog_conflicts_by_table
  const prevCatalog: Record<string, { matched_existing: number; inserted: number; overwritten: number }> =
    rj.progress?.catalog_conflicts_by_table ?? {};
  if (catalogStats.matched_existing || catalogStats.inserted || catalogStats.overwritten) {
    const c = prevCatalog[table] ?? { matched_existing: 0, inserted: 0, overwritten: 0 };
    prevCatalog[table] = {
      matched_existing: c.matched_existing + catalogStats.matched_existing,
      inserted: c.inserted + catalogStats.inserted,
      overwritten: (c.overwritten ?? 0) + catalogStats.overwritten,
    };
  }

  // Merge id_maps
  const mergedIdMaps = { ...idMaps };
  for (const [t, m] of Object.entries(idMapDelta)) {
    mergedIdMaps[t] = { ...(mergedIdMaps[t] ?? {}), ...m };
  }

  // Merge bed_number_reassigned (acumulado entre steps de patients)
  const prevBedReassigned: number = Number(rj.progress?.bed_number_reassigned ?? 0);

  const newProgress = {
    ...(rj.progress ?? {}),
    step: `${table} (${doneParts}/${totalParts})`,
    percent,
    current_table: table,
    current_part: partPath,
    processed: (rj.progress?.processed ?? 0) + processed,
    errors: (rj.progress?.errors ?? 0) + errors,
    done_parts: doneParts,
    total_parts: totalParts,
    error_samples: mergedSamples,
    errors_by_table: prevByTable,
    dropped_columns_by_table: prevDropped,
    catalog_conflicts_by_table: prevCatalog,
    id_maps: mergedIdMaps,
    bed_number_reassigned: prevBedReassigned + bedNumberReassigned,
  };
  await admin.from("restore_jobs").update({ progress: newProgress }).eq("id", restoreId);

  return json({
    rows_processed: processed, errors, error_samples: errorSamples,
    percent, done_parts: doneParts, total_parts: totalParts,
    dropped_columns: droppedCols, catalog_stats: catalogStats,
  });
}

async function handleFinalize(admin: any, body: any, userId: string, userEmail: string | null) {
  const restoreId = String(body.restore_id ?? "");
  const success = !!body.success;
  const errStr = body.error ? String(body.error) : null;
  if (!restoreId) return json({ error: "restore_id obrigatório" }, 400);

  const { data: rj } = await admin.from("restore_jobs").select("*").eq("id", restoreId).maybeSingle();

  // Conta id_maps
  const idMapCounts: Record<string, number> = {};
  for (const [t, m] of Object.entries(rj?.progress?.id_maps ?? {})) {
    idMapCounts[t] = Object.keys(m as Record<string, string>).length;
  }

  const finishedAt = new Date();
  const startedAtMs = rj?.started_at ? new Date(rj.started_at).getTime() : finishedAt.getTime();
  await admin.from("restore_jobs").update({
    status: success ? "completed" : "failed",
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAtMs,
    error: errStr,
    report: {
      processed: rj?.progress?.processed ?? 0,
      errors: rj?.progress?.errors ?? 0,
      dry_run: rj?.dry_run ?? false,
      error_samples: Array.isArray(rj?.progress?.error_samples) ? rj.progress.error_samples : [],
      errors_by_table: rj?.progress?.errors_by_table ?? {},
      dropped_columns_by_table: rj?.progress?.dropped_columns_by_table ?? {},
      catalog_conflicts_by_table: rj?.progress?.catalog_conflicts_by_table ?? {},
      id_map_counts: idMapCounts,
      bed_number_reassigned: Number(rj?.progress?.bed_number_reassigned ?? 0),
    },
    progress: { ...(rj?.progress ?? {}), step: success ? "concluído" : "falhou", percent: 100 },
  }).eq("id", restoreId);

  // Sempre desativa manutenção
  await admin.from("system_maintenance_mode").update({
    is_active: false,
    started_at: null,
    started_by: null,
    reason: null,
    expected_end_at: null,
  }).eq("id", 1);

  await audit(admin, userId, userEmail, success ? "BACKUP_RESTORE_DONE" : "BACKUP_RESTORE_FAIL", {
    restore_job_id: restoreId, result: success ? "success" : "fail", error: errStr,
    payload: { processed: rj?.progress?.processed ?? 0, errors: rj?.progress?.errors ?? 0, dry_run: rj?.dry_run ?? false },
  });

  return json({ ok: true });
}

// ───────── helpers ─────────
function sameCols(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort(), sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

async function topoOrder(tables: string[]): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_fk_pairs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`get_public_fk_pairs: ${res.status}`);
  const pairs: { child: string; parent: string }[] = await res.json();

  const setT = new Set(tables);
  const adj = new Map<string, Set<string>>();
  const indeg = new Map<string, number>();
  for (const t of tables) { adj.set(t, new Set()); indeg.set(t, 0); }
  for (const { child, parent } of pairs) {
    if (!setT.has(child) || !setT.has(parent) || child === parent) continue;
    if (!adj.get(parent)!.has(child)) {
      adj.get(parent)!.add(child);
      indeg.set(child, (indeg.get(child) ?? 0) + 1);
    }
  }
  const out: string[] = [];
  const q: string[] = [];
  for (const [t, d] of indeg) if (d === 0) q.push(t);
  q.sort();
  while (q.length) {
    const t = q.shift()!;
    out.push(t);
    for (const c of adj.get(t) ?? []) {
      indeg.set(c, (indeg.get(c) ?? 0) - 1);
      if (indeg.get(c) === 0) q.push(c);
    }
    q.sort();
  }
  for (const t of tables) if (!out.includes(t)) out.push(t);
  return out;
}

async function fetchPks(tables: string[]): Promise<Record<string, string[]>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_tables_with_pk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`get_public_tables_with_pk: ${res.status}`);
  const list: { name: string; pk: string[] }[] = await res.json();
  const setT = new Set(tables);
  const out: Record<string, string[]> = {};
  for (const t of list) if (setT.has(t.name)) out[t.name] = t.pk;
  return out;
}

async function audit(admin: any, userId: string, email: string | null, action: string, extra: Record<string, unknown>) {
  try {
    await admin.from("backup_audit").insert({
      actor_id: userId, actor_email: email, action,
      restore_job_id: (extra as any).restore_job_id ?? null,
      backup_job_id: (extra as any).backup_job_id ?? null,
      result: (extra as any).result ?? null,
      error: (extra as any).error ?? null,
      duration_ms: (extra as any).duration_ms ?? null,
      source_instance: SUPABASE_URL,
      payload: (extra as any).payload ?? null,
    });
  } catch (e) { console.warn("[backup-restore] audit fail", e); }
}
