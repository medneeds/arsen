// db-restore — Super Admin only. Action-based dispatch.
//
// actions:
//   "start"    { backup_id, mode: "full"|"partial", tables?: string[], reason: string, password: string }
//              → { restore_id, ordered_tables: [{ name, pk, parts: string[], rows_before }] }
//   "chunk"    { restore_id, table, object_path }
//              → { rows_processed, errors }
//   "finalize" { restore_id, success, error?, row_counts_after }
//              → { ok: true }
//
// Side effects:
//   - "start" activates system_maintenance_mode (singleton id=1)
//   - "finalize" deactivates it (always, success OR failure)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const token = authHeader.replace("Bearer ", "");
  const { data: udata, error: cErr } = await userClient.auth.getUser(token);
  if (cErr || !udata?.user?.id) return json({ error: "Unauthorized" }, 401);
  const userId = udata.user.id;
  const userEmail = udata.user.email ?? null;

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!roleRow) return json({ error: "Forbidden: super_admin required" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const action = String(body?.action ?? "");

  try {
    if (action === "start") return await startRestore(admin, userId, userEmail, body);
    if (action === "chunk") return await chunkRestore(admin, body);
    if (action === "finalize") return await finalizeRestore(admin, userId, userEmail, body);
    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[db-restore]", action, msg);
    // best-effort: try to deactivate maintenance on hard error
    try {
      await admin.from("system_maintenance_mode").update({ is_active: false }).eq("id", 1);
    } catch {}
    return json({ error: msg }, 500);
  }
});

async function startRestore(admin: any, userId: string, userEmail: string | null, body: any) {
  const backupId = String(body?.backup_id ?? "");
  const mode = body?.mode as "full" | "partial";
  const reason = String(body?.reason ?? "");
  const password = String(body?.password ?? "");
  const requested: string[] = Array.isArray(body?.tables) ? body.tables : [];

  if (!backupId) return json({ error: "backup_id required" }, 400);
  if (!["full", "partial"].includes(mode)) return json({ error: "mode must be full|partial" }, 400);
  if (!password) return json({ error: "password required" }, 400);
  if (!userEmail) return json({ error: "user email missing" }, 400);

  const verify = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: pwErr } = await verify.auth.signInWithPassword({ email: userEmail, password });
  if (pwErr) return json({ error: "Senha incorreta" }, 401);

  // Already-active maintenance ⇒ another restore is running
  const { data: mm } = await admin.from("system_maintenance_mode").select("is_active").eq("id", 1).single();
  if (mm?.is_active) return json({ error: "Já existe uma operação de manutenção em andamento" }, 409);

  // Load backup
  const { data: bk, error: bkErr } = await admin.from("db_backups").select("*").eq("id", backupId).single();
  if (bkErr || !bk) return json({ error: "Backup not found" }, 404);
  if (bk.status !== "completed") return json({ error: `Backup status=${bk.status}` }, 400);

  let targetTables: string[] = bk.tables ?? [];
  if (mode === "partial") {
    const reqSet = new Set(requested);
    targetTables = targetTables.filter((t: string) => reqSet.has(t));
    if (targetTables.length === 0) return json({ error: "Nenhuma tabela selecionada" }, 400);
  }

  // Topological FK order (insert parents first)
  const order: string[] = await topoOrder(admin, targetTables);

  // Compute PKs and list of part objects for each table
  const pkMap = await fetchPks(admin, order);
  const orderedTables: any[] = [];
  for (const table of order) {
    const prefix = `${backupId}/${table}/`;
    const { data: list, error: lsErr } = await admin.storage.from(BUCKET).list(`${backupId}/${table}`, { limit: 1000 });
    if (lsErr) return json({ error: `storage list ${table}: ${lsErr.message}` }, 500);
    const parts = (list ?? []).map((o: any) => prefix + o.name).sort();
    const { count } = await admin.from(table).select("*", { count: "exact", head: true });
    orderedTables.push({ name: table, pk: pkMap[table] ?? ["id"], parts, rows_before: count ?? 0 });
  }

  // Create restore audit row
  const rowsBefore = Object.fromEntries(orderedTables.map((t) => [t.name, t.rows_before]));
  const { data: ra, error: raErr } = await admin
    .from("db_restore_audit")
    .insert({
      super_admin_id: userId,
      backup_id: backupId,
      mode,
      tables: order,
      rows_before: rowsBefore,
      reason,
    })
    .select()
    .single();
  if (raErr) return json({ error: raErr.message }, 500);

  // Activate maintenance mode
  const { error: mmErr } = await admin.from("system_maintenance_mode").update({
    is_active: true,
    started_at: new Date().toISOString(),
    started_by: userId,
    reason: `Restore ${ra.id}: ${reason}`,
    expected_end_at: null,
  }).eq("id", 1);
  if (mmErr) return json({ error: `maintenance: ${mmErr.message}` }, 500);

  await logAudit(admin, userId, userEmail, "SUPER_ADMIN_RESTORE_START", {
    restore_id: ra.id, backup_id: backupId, mode, tables: order, reason,
  });
  await logAudit(admin, userId, userEmail, "MAINTENANCE_MODE_ON", { restore_id: ra.id });

  return json({ restore_id: ra.id, ordered_tables: orderedTables });
}

async function chunkRestore(admin: any, body: any) {
  const restoreId = String(body?.restore_id ?? "");
  const table = String(body?.table ?? "");
  const objectPath = String(body?.object_path ?? "");
  if (!restoreId || !table || !objectPath) return json({ error: "restore_id+table+object_path required" }, 400);

  // Confirm maintenance still on and restore running
  const { data: ra } = await admin.from("db_restore_audit").select("status,tables").eq("id", restoreId).single();
  if (!ra) return json({ error: "Restore not found" }, 404);
  if (ra.status !== "running") return json({ error: `Restore status=${ra.status}` }, 400);
  if (!ra.tables.includes(table)) return json({ error: "Table not in restore set" }, 400);

  // Download JSONL
  const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(objectPath);
  if (dlErr) return json({ error: `download: ${dlErr.message}` }, 500);
  const text = await file.text();
  const rows: any[] = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  if (rows.length === 0) return json({ rows_processed: 0, errors: 0 });

  // PK
  const pkMap = await fetchPks(admin, [table]);
  const pk = pkMap[table] ?? ["id"];
  const onConflict = pk.join(",");

  // Upsert in batches of 500
  const BATCH = 500;
  let processed = 0, errors = 0;
  const errorSamples: string[] = [];
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
  return json({ rows_processed: processed, errors, error_samples: errorSamples });
}

async function finalizeRestore(admin: any, userId: string, userEmail: string | null, body: any) {
  const restoreId = String(body?.restore_id ?? "");
  const success = !!body?.success;
  const rowsAfter = body?.row_counts_after ?? {};
  const errStr = body?.error ? String(body.error) : null;

  await admin.from("db_restore_audit").update({
    finished_at: new Date().toISOString(),
    status: success ? "completed" : "failed",
    rows_after: rowsAfter,
    error: errStr,
  }).eq("id", restoreId);

  // ALWAYS deactivate maintenance
  await admin.from("system_maintenance_mode").update({
    is_active: false,
    started_at: null,
    started_by: null,
    reason: null,
    expected_end_at: null,
  }).eq("id", 1);

  await logAudit(admin, userId, userEmail,
    success ? "SUPER_ADMIN_RESTORE_DONE" : "SUPER_ADMIN_RESTORE_FAIL",
    { restore_id: restoreId, rows_after: rowsAfter, error: errStr });
  await logAudit(admin, userId, userEmail, "MAINTENANCE_MODE_OFF", { restore_id: restoreId });

  return json({ ok: true });
}

// ─── helpers ────────────────────────────────────────────────────────────
async function topoOrder(admin: any, tables: string[]): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_fk_pairs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("get_public_fk_pairs helper missing");
  const pairs: { child: string; parent: string }[] = await res.json();

  const setT = new Set(tables);
  const adj = new Map<string, Set<string>>(); // parent → children
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
  // Cycles: append remaining in stable order
  for (const t of tables) if (!out.includes(t)) out.push(t);
  return out;
}

async function fetchPks(admin: any, tables: string[]): Promise<Record<string, string[]>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_tables_with_pk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("get_public_tables_with_pk helper missing");
  const list: { name: string; pk: string[] }[] = await res.json();
  const setT = new Set(tables);
  const out: Record<string, string[]> = {};
  for (const t of list) if (setT.has(t.name)) out[t.name] = t.pk;
  return out;
}

async function logAudit(admin: any, userId: string, email: string | null, action: string, payload: unknown) {
  try {
    await admin.from("user_admin_audit").insert({
      actor_id: userId, actor_email: email, action,
      new_data: payload as any, metadata: { source: "db-restore" } as any,
    });
  } catch (e) { console.warn("[db-restore] audit failed", e); }
}
