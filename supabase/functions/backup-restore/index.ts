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

// FKs cujo id é PRESERVADO entre backup e destino (não-catálogo).
// Antes do upsert filtramos linhas órfãs (pai inexistente no destino) para
// não estourar o slice inteiro por FK violation. Auto-FKs (parent_id em
// prescriptions) ficam de fora — tratadas via two-pass.
const FK_PARENTS: Record<string, string> = {
  patient_id: "patients",
  source_patient_id: "patients",            // internal_transfer_requests (NOT NULL, ON DELETE CASCADE)
  completed_target_patient_id: "patients",  // internal_transfer_requests (NULLABLE, ON DELETE SET NULL)
  registry_id: "patient_registry",
  patient_registry_id: "patient_registry",
  encounter_id: "patient_encounters",
  medical_record_id: "medical_records",
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
  const restoreIdInBody = String(body.restore_id ?? "");

  try {
    if (action === "plan")         return await handlePlan(admin, body, userId, userEmail);
    if (action === "step")         return await handleStep(admin, body, userId, userEmail);
    if (action === "finalize")     return await handleFinalize(admin, body, userId, userEmail);
    if (action === "force_unlock") return await handleForceUnlock(admin, body, userId, userEmail);
    return json({ error: `action inválida: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[backup-restore]", action, msg);
    return json({ error: msg }, 500);
  } finally {
    // Garantia final: se o restore já está em estado terminal (ou força),
    // garante que o modo manutenção esteja desligado. NUNCA derruba manutenção
    // durante um restore ainda em execução (status='running').
    try {
      let shouldUnlock = action === "force_unlock" || action === "finalize";
      if (!shouldUnlock && restoreIdInBody) {
        const { data: rj } = await admin.from("restore_jobs").select("status").eq("id", restoreIdInBody).maybeSingle();
        if (rj && (rj.status === "completed" || rj.status === "failed")) shouldUnlock = true;
      }
      if (shouldUnlock) await forceDeactivateMaintenance(admin);
    } catch (e) {
      console.warn("[backup-restore] finally cleanup failed", e);
    }
  }
});

async function handleForceUnlock(admin: any, body: any, userId: string, userEmail: string | null) {
  const reason = String(body?.reason ?? "").trim() || "force_unlock por admin";
  const { data: running } = await admin
    .from("restore_jobs")
    .select("id")
    .in("status", ["running", "pending"]);
  const ids = (running ?? []).map((r: any) => r.id);
  if (ids.length > 0) {
    await admin.from("restore_jobs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: `force_unlock por admin: ${reason}`,
    }).in("id", ids);
  }
  await forceDeactivateMaintenance(admin);
  await audit(admin, userId, userEmail, "MAINTENANCE_FORCE_OFF", {
    result: "success",
    payload: { reason, aborted_restore_ids: ids },
  });
  return json({ ok: true, aborted_restore_ids: ids });
}

async function forceDeactivateMaintenance(admin: any) {
  await admin.from("system_maintenance_mode").update({
    is_active: false,
    started_at: null,
    started_by: null,
    reason: null,
    expected_end_at: null,
  }).eq("id", 1);
}

// Normaliza o shape do array para upsert: todas as linhas com o MESMO conjunto
// de chaves (preenchendo ausentes com null). Sem isso, PostgREST agrega para
// uniformizar e dispara "function min(uuid) does not exist" em colunas UUID.
function normalizeShape<T extends Record<string, unknown>>(rows: T[], extraKeys?: Iterable<string>): T[] {
  if (rows.length === 0 && !extraKeys) return rows;
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  if (extraKeys) for (const k of extraKeys) keys.add(k);
  return rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    for (const k of keys) if (!(k in out)) out[k] = null;
    return out as T;
  });
}


async function handlePlan(admin: any, body: any, userId: string, userEmail: string | null) {
  const backupId = String(body.backup_id ?? "");
  const mode = body.mode === "partial" ? "partial" : "full";
  const dryRun = !!body.dry_run;
  const mirror = !!body.mirror;
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

  // Schema do destino (colunas + nulabilidade + uniques) — uma única descoberta
  const cols_by_table: Record<string, { allowed: string[]; generated: string[]; identity: string[] }> = {};
  const nullable_by_table: Record<string, Record<string, boolean>> = {};
  const unique_by_table: Record<string, Array<{ name: string; columns: string[] }>> = {};
  try {
    const { data: colsRows } = await admin.rpc("get_public_table_columns", { tables: ordered });
    for (const r of (colsRows ?? []) as Array<{ table_name: string; column_name: string; is_generated: boolean; is_identity: boolean; is_nullable: boolean }>) {
      const e = cols_by_table[r.table_name] ?? (cols_by_table[r.table_name] = { allowed: [], generated: [], identity: [] });
      e.allowed.push(r.column_name);
      if (r.is_generated) e.generated.push(r.column_name);
      if (r.is_identity) e.identity.push(r.column_name);
      (nullable_by_table[r.table_name] ??= {})[r.column_name] = !!r.is_nullable;
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
      mirror,
      mirror_truncated_tables: [] as string[],
      schema: { cols_by_table, nullable_by_table, unique_by_table },
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

  // MODO ESPELHO: apaga todas as linhas das tabelas do plano antes do upsert.
  // Não roda em dry-run. Não toca em auth.users (fase separada).
  let mirrorTruncated: string[] = [];
  if (mirror && !dryRun && ordered.length > 0) {
    const { error: trErr } = await admin.rpc("mirror_truncate_tables", { table_names: ordered });
    if (trErr) {
      // libera manutenção antes de abortar
      await admin.from("system_maintenance_mode").update({ is_active: false }).eq("id", 1);
      await admin.from("restore_jobs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: `mirror_truncate falhou: ${trErr.message}`,
      }).eq("id", rj.id);
      return json({ error: `Modo espelho falhou ao apagar tabelas: ${trErr.message}` }, 500);
    }
    mirrorTruncated = ordered;
    await admin.from("restore_jobs").update({
      progress: { ...rj.progress, mirror_truncated_tables: mirrorTruncated },
    }).eq("id", rj.id);
    await audit(admin, userId, userEmail, "BACKUP_RESTORE_MIRROR_TRUNCATE", {
      restore_job_id: rj.id, backup_job_id: backupId,
      payload: { tables: mirrorTruncated },
    });
  }

  await audit(admin, userId, userEmail, "BACKUP_RESTORE_START", {
    restore_job_id: rj.id, backup_job_id: backupId,
    payload: { mode, dry_run: dryRun, mirror, tables: ordered, has_auth_users: authUserParts.length > 0, reason },
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
  let sliceDedupesDropped = 0;
  let droppedNoPk = 0;
  let minUuidRetries = 0;
  // orphanFkDropped[fkCol] = n — drops verdadeiros (coluna NOT NULL ou linha sem alternativa)
  const orphanFkDropped: Record<string, number> = {};
  // nulledFkCounts["<table>.<fkCol>"] = n — coluna anulada (linha preservada)
  const nulledFkCounts: Record<string, number> = {};
  // linhas que ficaram sem nenhum vínculo de paciente após anulação (linha preservada)
  let noPatientLinkRows = 0;
  // parent_id pendings desta part (prescriptions); merge no progress, aplicado em finalize
  const pendingParentFixups: Record<string, string> = {};

  const schema = rj.progress?.schema ?? { cols_by_table: {}, nullable_by_table: {}, unique_by_table: {} };
  const nullableForTable: Record<string, boolean> = schema.nullable_by_table?.[table] ?? {};
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

    // Dedupe last-wins por chave composta. Evita "function min(uuid) does not exist"
    // que o PostgREST dispara ao agregar duplicatas no payload de upsert.
    const dedupeBy = <T extends Record<string, unknown>>(arr: T[], keyFn: (r: T) => string): T[] => {
      const m = new Map<string, T>();
      for (const r of arr) m.set(keyFn(r), r);
      return Array.from(m.values());
    };

    if (rows.length > 0 && !rj.dry_run) {
      const pk = tEntry.pk ?? ["id"];
      const isCatalog = !!tEntry.is_catalog && Array.isArray(tEntry.catalog_natural_key) && tEntry.catalog_natural_key.length > 0;

      if (isCatalog) {
        // Catálogo: resolve por chave natural, popula id_map, backup vence (UPDATE).
        // Aplica translateRow para que FKs (ex.: hospital_units.state_id) sejam remapeadas via id_maps.
        const naturalKey: string[] = tEntry.catalog_natural_key;
        const pkCol = pk[0] ?? "id";
        for (const raw of rows) {
          const cleaned = translateRow(cleanRow(raw as Record<string, unknown>));
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
        // Dedupe por (user_id, role) antes do upsert (last-wins) para não disparar min(uuid).
        let allRows = rows.map((r) => {
          const c = translateRow(cleanRow(r as Record<string, unknown>));
          delete (c as any).id;
          return c;
        });
        const beforeDedupe = allRows.length;
        allRows = dedupeBy(allRows, (r) => `${String((r as any).user_id)}::${String((r as any).role)}`);
        sliceDedupesDropped += beforeDedupe - allRows.length;
        for (let i = 0; i < allRows.length; i += BATCH) {
          const slice = normalizeShape(allRows.slice(i, i + BATCH));
          const { error } = await admin.from("user_roles").upsert(slice, { onConflict: "user_id,role" });
          if (error) {
            errors += slice.length;
            if (errorSamples.length < 3) errorSamples.push(error.message);
          } else {
            processed += slice.length;
          }
        }
      } else {
        // Não-catálogo: filtro + tradução de FK + dedupe por PK + filtro de FK órfã + upsert.
        const onConflict = pk.join(",");
        const pkCol = pk[0] ?? "id";
        let allRows = rows.map((r) => translateRow(cleanRow(r as Record<string, unknown>)));

        // Drop linhas sem PK válido (id null/""): impossíveis em upsert por id, e
        // colapsam entre si no PostgREST disparando min(uuid).
        const beforeNoPk = allRows.length;
        allRows = allRows.filter((r) => pk.every((c) => {
          const v = (r as any)[c];
          return v != null && v !== "";
        }));
        droppedNoPk += beforeNoPk - allRows.length;

        // Dedupe por PK (last-wins): blinda contra min(uuid) do PostgREST.
        const beforePkDedupe = allRows.length;
        allRows = dedupeBy(allRows, (r) => pk.map((c) => String((r as any)[c])).join("::"));
        sliceDedupesDropped += beforePkDedupe - allRows.length;

        // patients: libera bed_number ocupado no destino por outros ids (backup vence).
        if (table === "patients") {
          const beds = Array.from(new Set(
            allRows.map((r) => (r as any).bed_number).filter((v) => v != null && v !== "")
          ));
          const backupIds = new Set(allRows.map((r) => String((r as any)[pkCol])).filter((v) => v != null));
          if (beds.length > 0) {
            const CHUNK = 500;
            for (let i = 0; i < beds.length; i += CHUNK) {
              const bedChunk = beds.slice(i, i + CHUNK);
              const { data: conflicting, error: selErr } = await admin
                .from("patients")
                .select(`${pkCol}, bed_number`)
                .in("bed_number", bedChunk);
              if (selErr) {
                if (errorSamples.length < 3) errorSamples.push(`patients bed_number lookup: ${selErr.message}`);
                continue;
              }
              if (!Array.isArray(conflicting) || conflicting.length === 0) continue;
              const toFree = conflicting
                .filter((r: any) => !backupIds.has(String(r[pkCol])))
                .map((r: any) => r[pkCol]);
              if (toFree.length === 0) continue;
              const { error: updErr, count } = await admin
                .from("patients")
                .update({ bed_number: null }, { count: "exact" })
                .in(pkCol, toFree);
              if (updErr) {
                if (errorSamples.length < 3) errorSamples.push(`patients bed_number release: ${updErr.message}`);
              } else {
                bedNumberReassigned += count ?? toFree.length;
              }
            }
          }
          const beforeBedDedupe = allRows.length;
          const withBed = allRows.filter((r) => (r as any).bed_number != null && (r as any).bed_number !== "");
          const withoutBed = allRows.filter((r) => (r as any).bed_number == null || (r as any).bed_number === "");
          const dedupedBed = dedupeBy(withBed, (r) => String((r as any).bed_number));
          allRows = [...withoutBed, ...dedupedBed];
          sliceDedupesDropped += beforeBedDedupe - allRows.length;
        }

        // ── Filtro de FK órfã: anula coluna se NULLABLE, senão dropa linha ──
        const allowedCols = new Set<string>(meta?.allowed ?? []);
        const fkColsApplicable = Object.entries(FK_PARENTS).filter(
          ([col]) => (allowedCols.size === 0 || allowedCols.has(col)) &&
                     allRows.some((r) => (r as any)[col] != null && (r as any)[col] !== "")
        );

        // Nulabilidade pré-carregada na descoberta de schema (reusa RPC já cacheada
        // get_public_table_columns). Sem nova chamada RPC aqui — evita o problema
        // de schema-cache que afundava get_public_columns_nullability.
        const nullableMap: Record<string, boolean> = nullableForTable;

        for (const [fkCol, parentTable] of fkColsApplicable) {
          if (parentTable === table) continue; // segurança contra auto-FK
          const isNullable = !!nullableMap[fkCol]; // default false (mais seguro)
          const vals = Array.from(new Set(
            allRows.map((r) => (r as any)[fkCol]).filter((v) => v != null && v !== "")
          ));
          if (vals.length === 0) continue;
          const existing = new Set<string>();
          // Chunk pequeno: 500 UUIDs estouram URL do PostgREST (~19 KB) e o
          // select falha silenciosamente; 100 dá ~3.8 KB, seguro.
          const CHUNK = 100;
          let lookupOk = true;
          for (let i = 0; i < vals.length; i += CHUNK) {
            const chunk = vals.slice(i, i + CHUNK);
            const { data, error: selErr } = await admin
              .from(parentTable)
              .select("id")
              .in("id", chunk);
            if (selErr) {
              lookupOk = false;
              console.error(`[backup-restore] FK lookup ${table}.${fkCol}→${parentTable}:`, selErr.message);
              if (errorSamples.length < 3) errorSamples.push(`FK lookup ${table}.${fkCol}→${parentTable}: ${selErr.message}`);
              break;
            }
            for (const row of (data ?? [])) existing.add(String((row as any).id));
          }

          const fkKey = `${table}.${fkCol}`;

          // Fail-safe: lookup falhou. Se a coluna for nullable, anula em todas as
          // linhas que tinham valor (preserva a linha). Se for NOT NULL, dropa.
          if (!lookupOk) {
            if (isNullable) {
              let nulled = 0;
              for (const r of allRows) {
                const v = (r as any)[fkCol];
                if (v != null && v !== "") {
                  (r as any)[fkCol] = null;
                  nulled++;
                }
              }
              if (nulled > 0) {
                nulledFkCounts[fkKey] = (nulledFkCounts[fkKey] ?? 0) + nulled;
                if (errorSamples.length < 5) {
                  errorSamples.push(`FK fail-safe ${table}.${fkCol}→${parentTable}: ${nulled} campo(s) anulado(s) (lookup falhou)`);
                }
              }
            } else {
              const before = allRows.length;
              allRows = allRows.filter((r) => {
                const v = (r as any)[fkCol];
                return v == null || v === "";
              });
              const dropped = before - allRows.length;
              if (dropped > 0) {
                orphanFkDropped[fkCol] = (orphanFkDropped[fkCol] ?? 0) + dropped;
                if (errorSamples.length < 5) {
                  errorSamples.push(`FK fail-safe ${table}.${fkCol}→${parentTable} (NOT NULL): ${dropped} linha(s) dropada(s) (lookup falhou)`);
                }
              }
            }
            continue;
          }

          // Caminho feliz: para cada linha com FK órfã, anula (se nullable) ou dropa.
          if (isNullable) {
            let nulled = 0;
            for (const r of allRows) {
              const v = (r as any)[fkCol];
              if (v == null || v === "") continue;
              if (!existing.has(String(v))) {
                (r as any)[fkCol] = null;
                nulled++;
              }
            }
            if (nulled > 0) {
              nulledFkCounts[fkKey] = (nulledFkCounts[fkKey] ?? 0) + nulled;
              if (errorSamples.length < 5) {
                errorSamples.push(`FK órfã ANULADA ${table}.${fkCol}→${parentTable}: ${nulled} campo(s)`);
              }
            }
          } else {
            const before = allRows.length;
            allRows = allRows.filter((r) => {
              const v = (r as any)[fkCol];
              if (v == null || v === "") return true;
              return existing.has(String(v));
            });
            const dropped = before - allRows.length;
            if (dropped > 0) {
              orphanFkDropped[fkCol] = (orphanFkDropped[fkCol] ?? 0) + dropped;
              if (errorSamples.length < 5) {
                errorSamples.push(`FK órfã DROPADA ${table}.${fkCol}→${parentTable} (NOT NULL): ${dropped} linha(s)`);
              }
            }
          }
        }

        // Conta linhas sem nenhum vínculo de paciente (patient_id + patient_registry_id + encounter_id todos null/ausentes).
        // Regra de negócio: backup vence — linha permanece, só é contabilizada para revisão.
        const linkCols = ["patient_id", "patient_registry_id", "encounter_id"];
        const linkApplicable = linkCols.filter((c) => allowedCols.size === 0 || allowedCols.has(c));
        if (linkApplicable.length > 0) {
          for (const r of allRows) {
            const hasAny = linkApplicable.some((c) => {
              const v = (r as any)[c];
              return v != null && v !== "";
            });
            if (!hasAny) noPatientLinkRows++;
          }
        }


        // ── Two-pass parent_id para prescriptions (auto-FK) ──
        // Pass A: envia parent_id=null e guarda mapa para reaplicar em finalize.
        if (table === "prescriptions" && allowedCols.has("parent_id")) {
          for (const r of allRows) {
            const id = (r as any).id;
            const parent = (r as any).parent_id;
            if (id != null && parent != null && parent !== "" && String(parent) !== String(id)) {
              pendingParentFixups[String(id)] = String(parent);
            }
            (r as any).parent_id = null;
          }
        }

        // Normalização GLOBAL: todas as linhas (e o row-fallback) compartilham o
        // mesmo conjunto-união de chaves. Sem isso, PostgREST agrega min/max para
        // uniformizar shape entre chamadas e dispara "function min(uuid) does not exist".
        const normalizedRows = normalizeShape(allRows);
        const shapeKeys = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];

        // Upsert com fallback linha-a-linha em caso de min(uuid).
        for (let i = 0; i < normalizedRows.length; i += BATCH) {
          const slice = normalizedRows.slice(i, i + BATCH);
          const { error } = await admin.from(table).upsert(slice, { onConflict });
          if (error) {
            const msg = error.message ?? String(error);
            if (/min\(uuid\)/i.test(msg)) {
              // Fallback: refaz linha-a-linha mantendo o MESMO shape-união global.
              minUuidRetries++;
              for (const row of slice) {
                const rowNormalized = normalizeShape([row], shapeKeys)[0];

                // Contorna bug do PostgREST merge-duplicates ("function min(uuid)
                // does not exist") com múltiplas colunas uuid nulas: resolve
                // INSERT vs UPDATE explicitamente via select pela PK.
                const pkMatch: Record<string, unknown> = Object.fromEntries(
                  pk.map((c) => [c, (rowNormalized as any)[c]]),
                );
                let e1: any = null;
                try {
                  const { data: existingRow, error: selErr } = await admin
                    .from(table)
                    .select(pk.join(","))
                    .match(pkMatch)
                    .maybeSingle();
                  if (selErr) {
                    e1 = selErr;
                  } else if (existingRow) {
                    const updatePayload: Record<string, unknown> = { ...rowNormalized };
                    for (const c of pk) delete updatePayload[c];
                    ({ error: e1 } = await admin.from(table).update(updatePayload).match(pkMatch));
                  } else {
                    ({ error: e1 } = await admin.from(table).insert(rowNormalized));
                  }
                } catch (ex) {
                  e1 = ex instanceof Error ? ex : new Error(String(ex));
                }

                if (e1) {
                  errors++;
                  if (errorSamples.length < 3) {
                    // Sentinela: se min(uuid) reaparecer por aqui, mantém o dump didático
                    if (/min\(uuid\)/i.test(e1.message ?? "")) {
                      let dump = "";
                      try {
                        const full = JSON.stringify(rowNormalized);
                        dump = full.length <= 4000
                          ? ` payload=${full}`
                          : ` types=${Object.entries(rowNormalized)
                              .map(([k, v]) => `${k}:${v === null ? "null" : Array.isArray(v) ? `array[${v.length}]` : typeof v}`)
                              .join(",")}`;
                      } catch {
                        dump = ` types=${Object.entries(rowNormalized)
                          .map(([k, v]) => `${k}:${typeof v}`).join(",")}`;
                      }
                      errorSamples.push(`row-fallback ${table}: ${e1.message}${dump}`);
                    } else {
                      errorSamples.push(`row-fallback ${table}: ${e1.message}`);
                    }
                  }
                } else {
                  processed++;
                }
              }
            } else {
              errors += slice.length;
              if (errorSamples.length < 3) errorSamples.push(msg);
            }
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

  // Merge orphan_fk_dropped_by_table[table][col] = n
  const prevOrphanFk: Record<string, Record<string, number>> =
    rj.progress?.orphan_fk_dropped_by_table ?? {};
  if (Object.keys(orphanFkDropped).length > 0) {
    const t = { ...(prevOrphanFk[table] ?? {}) };
    for (const [c, n] of Object.entries(orphanFkDropped)) t[c] = (t[c] ?? 0) + n;
    prevOrphanFk[table] = t;
  }

  // Merge pending_parent_id_fixups[table] = { id: parent_id, ... }
  const prevPendingFix: Record<string, Record<string, string>> =
    rj.progress?.pending_parent_id_fixups ?? {};
  if (Object.keys(pendingParentFixups).length > 0) {
    prevPendingFix[table] = { ...(prevPendingFix[table] ?? {}), ...pendingParentFixups };
  }

  // Merge nulled_fk_counts ["<table>.<fkCol>"] = n
  const prevNulledFk: Record<string, number> = rj.progress?.nulled_fk_counts ?? {};
  for (const [k, n] of Object.entries(nulledFkCounts)) {
    prevNulledFk[k] = (prevNulledFk[k] ?? 0) + n;
  }

  // Merge rows_without_patient_link_by_table[table] = n
  const prevNoLinkBy: Record<string, number> = rj.progress?.rows_without_patient_link_by_table ?? {};
  if (noPatientLinkRows > 0) {
    prevNoLinkBy[table] = (prevNoLinkBy[table] ?? 0) + noPatientLinkRows;
  }

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
    slice_dedupes_dropped: Number(rj.progress?.slice_dedupes_dropped ?? 0) + sliceDedupesDropped,
    dropped_no_pk: Number(rj.progress?.dropped_no_pk ?? 0) + droppedNoPk,
    min_uuid_retries: Number(rj.progress?.min_uuid_retries ?? 0) + minUuidRetries,
    orphan_fk_dropped_by_table: prevOrphanFk,
    pending_parent_id_fixups: prevPendingFix,
    nulled_fk_counts: prevNulledFk,
    rows_without_patient_link_by_table: prevNoLinkBy,
    rows_without_patient_link_total:
      Number(rj.progress?.rows_without_patient_link_total ?? 0) + noPatientLinkRows,
  };
  await admin.from("restore_jobs").update({ progress: newProgress }).eq("id", restoreId);


  return json({
    rows_processed: processed, errors, error_samples: errorSamples,
    percent, done_parts: doneParts, total_parts: totalParts,
    dropped_columns: droppedCols, catalog_stats: catalogStats,
    orphan_fk_dropped: orphanFkDropped,
    nulled_fk_counts: nulledFkCounts,
    rows_without_patient_link: noPatientLinkRows,
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

  // ── Pass B: reaplicar parent_id em prescriptions (auto-FK) ──
  let parentIdRelinked = 0;
  let parentIdDropped = 0;
  const pendingFix: Record<string, Record<string, string>> =
    rj?.progress?.pending_parent_id_fixups ?? {};
  if (success && !rj?.dry_run) {
    for (const [tbl, map] of Object.entries(pendingFix)) {
      const entries = Object.entries(map ?? {});
      if (entries.length === 0) continue;
      const parentIds = Array.from(new Set(entries.map(([, p]) => p)));
      const existing = new Set<string>();
      const lookupFailed = new Set<string>(); // parentIds em chunks cuja verificação falhou
      const CHUNK = 100; // mesmo padrão do FK lookup do handleStep — evita estouro de URL do PostgREST
      for (let i = 0; i < parentIds.length; i += CHUNK) {
        const chunk = parentIds.slice(i, i + CHUNK);
        const { data, error: selErr } = await admin.from(tbl).select("id").in("id", chunk);
        if (selErr) {
          console.error(
            `[backup-restore] Pass B lookup falhou em ${tbl} chunk ${i}-${i + chunk.length}:`,
            selErr.message,
          );
          // Fail-safe: NÃO dropa por falha de verificação. Marca como inconclusivo
          // e deixa o UPDATE tentar — o FK do banco é a verdade final.
          for (const pid of chunk) lookupFailed.add(String(pid));
          continue;
        }
        for (const r of (data ?? [])) existing.add(String((r as any).id));
      }
      // Atualiza em lotes pequenos (uma chamada por linha — simples e seguro)
      for (const [childId, parentId] of entries) {
        const pidStr = String(parentId);
        const verified = existing.has(pidStr);
        const inconclusive = !verified && lookupFailed.has(pidStr);
        // Só dropa quando temos CERTEZA: lookup funcionou E pai está ausente.
        if (!verified && !inconclusive) { parentIdDropped++; continue; }
        const { error: uErr } = await admin.from(tbl).update({ parent_id: parentId }).eq("id", childId);
        if (uErr) parentIdDropped++; else parentIdRelinked++;
      }
    }
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
      slice_dedupes_dropped: Number(rj?.progress?.slice_dedupes_dropped ?? 0),
      dropped_no_pk: Number(rj?.progress?.dropped_no_pk ?? 0),
      min_uuid_retries: Number(rj?.progress?.min_uuid_retries ?? 0),
      orphan_fk_dropped_by_table: rj?.progress?.orphan_fk_dropped_by_table ?? {},
      parent_id_relinked: parentIdRelinked,
      parent_id_dropped: parentIdDropped,
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
