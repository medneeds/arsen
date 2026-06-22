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
  const parts: { path: string; bytes: number }[] = manifest.parts ?? [];

  // Mapeia parts por tabela: data/<table>.part-XXXX.jsonl e special/<table>.part-XXXX.jsonl
  // Ignora auth/ e a própria audit_logs se não solicitada
  const partsByTable = new Map<string, string[]>();
  for (const p of parts) {
    const m = p.path.match(/^(data|special)\/([^/]+)\.part-\d{4}\.jsonl$/);
    if (!m) continue;
    const table = m[2];
    if (!partsByTable.has(table)) partsByTable.set(table, []);
    partsByTable.get(table)!.push(p.path);
  }
  for (const arr of partsByTable.values()) arr.sort();

  let targetTables = Array.from(partsByTable.keys());
  if (mode === "partial") {
    const reqSet = new Set(requested);
    targetTables = targetTables.filter((t) => reqSet.has(t));
    if (targetTables.length === 0) return json({ error: "Nenhuma tabela selecionada" }, 400);
  }

  // Ordem topológica (pais primeiro)
  const ordered = await topoOrder(targetTables);
  const pkMap = await fetchPks(ordered);

  const plan = ordered.map((t) => ({
    table: t,
    pk: pkMap[t] ?? ["id"],
    parts: (partsByTable.get(t) ?? []).map((path) => ({ path })),
    rows_expected: manifest.table_counts?.[t] ?? 0,
  }));

  // Cria restore_job
  const { data: rj, error: rjErr } = await admin.from("restore_jobs").insert({
    created_by: userId,
    created_by_email: userEmail,
    backup_job_id: backupId,
    uploaded_file_path: `${backupId}/manifest.json`,
    dry_run: dryRun,
    conflict_strategy: "upsert_pk",
    status: "running",
    started_at: new Date().toISOString(),
    target_instance: SUPABASE_URL,
    reason,
    progress: { step: "iniciando", percent: 0, plan, current_table: null, current_part: null, processed: 0, errors: 0 },
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
    payload: { mode, dry_run: dryRun, tables: ordered, reason },
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

  // Sanity: o part deve estar no plano da tabela
  const plan = rj.progress?.plan ?? [];
  const tEntry = plan.find((x: any) => x.table === table);
  if (!tEntry) return json({ error: "tabela fora do plano" }, 400);
  if (!tEntry.parts.some((p: any) => p.path === partPath)) return json({ error: "part fora do plano" }, 400);

  // Download
  const { data: file, error: dErr } = await admin.storage.from(BUCKET).download(partPath);
  if (dErr || !file) return json({ error: `download: ${dErr?.message}` }, 500);
  const text = await file.text();
  const rows: any[] = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));

  let processed = 0, errors = 0;
  const errorSamples: string[] = [];

  if (rows.length > 0 && !rj.dry_run) {
    const pk = tEntry.pk ?? ["id"];
    const onConflict = pk.join(",");
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error } = await admin.from(table).upsert(slice, { onConflict });
      if (error) {
        errors += slice.length;
        if (errorSamples.length < 3) errorSamples.push(error.message);
      } else {
        processed += slice.length;
      }
    }
  } else if (rj.dry_run) {
    // dry-run: só conta linhas válidas
    processed = rows.length;
  }

  // Atualiza progresso
  const totalParts = plan.reduce((a: number, x: any) => a + (x.parts?.length ?? 0), 0) || 1;
  const doneParts = (rj.progress?.done_parts ?? 0) + 1;
  const percent = Math.min(99, Math.floor((doneParts / totalParts) * 100));
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
  };
  await admin.from("restore_jobs").update({ progress: newProgress }).eq("id", restoreId);

  return json({ rows_processed: processed, errors, error_samples: errorSamples, percent, done_parts: doneParts, total_parts: totalParts });
}

async function handleFinalize(admin: any, body: any, userId: string, userEmail: string | null) {
  const restoreId = String(body.restore_id ?? "");
  const success = !!body.success;
  const errStr = body.error ? String(body.error) : null;
  if (!restoreId) return json({ error: "restore_id obrigatório" }, 400);

  const { data: rj } = await admin.from("restore_jobs").select("*").eq("id", restoreId).maybeSingle();

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
