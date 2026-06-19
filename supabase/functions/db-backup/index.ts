// db-backup — Super Admin only. Action-based dispatch.
//
// actions:
//   "start"     { kind: "full"|"partial", tables: string[], reason: string, password: string }
//               → { backup_id, tables: [{ name, count, pk }] }
//   "chunk"     { backup_id, table, offset, limit }
//               → { rows_written, bytes, object_path, next_offset, done }
//   "finalize"  { backup_id, success, error?, row_counts, size_bytes, object_paths, notes? }
//               → { ok: true }
//
// Bucket: db-backups (private). Path: <backup_id>/<table>/part-<offset>.jsonl
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "db-backups";
const CHUNK_LIMIT_DEFAULT = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Auth: JWT + super_admin role ─────────────────────────────────────
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
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "Forbidden: super_admin required" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const action = String(body?.action ?? "");

  try {
    if (action === "start") return await startBackup(admin, userClient, userId, userEmail, body);
    if (action === "chunk") return await chunkBackup(admin, body);
    if (action === "finalize") return await finalizeBackup(admin, userId, userEmail, body);
    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[db-backup]", action, msg);
    return json({ error: msg }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────
async function startBackup(
  admin: any, userClient: any, userId: string, userEmail: string | null, body: any,
) {
  const kind = body?.kind as "full" | "partial";
  const reason = String(body?.reason ?? "");
  const password = String(body?.password ?? "");
  const requested = Array.isArray(body?.tables) ? (body.tables as string[]) : [];

  if (!["full", "partial"].includes(kind)) return json({ error: "kind must be full|partial" }, 400);
  if (!password) return json({ error: "password required" }, 400);
  if (!userEmail) return json({ error: "user email missing" }, 400);

  // Password reverification: try a signin with the same email
  const verify = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: pwErr } = await verify.auth.signInWithPassword({ email: userEmail, password });
  if (pwErr) return json({ error: "Senha incorreta" }, 401);

  // List public tables (exclude control + audit tables we own)
  const excluded = new Set(["system_maintenance_mode", "db_backups", "db_restore_audit"]);
  const { data: allTables } = await admin.rpc("get_public_tables_with_pk").maybeSingle().then(
    (r: any) => r,
    () => ({ data: null }),
  );
  // Fallback path: query directly when the rpc is absent
  let tableList: { name: string; pk: string[] }[] = [];
  if (Array.isArray(allTables)) tableList = allTables;
  else {
    // Inline query via SQL via REST: use information_schema
    const { data: t } = await admin
      .from("__bogus__") // placeholder to keep TS happy
      .select("*")
      .limit(0);
    void t;
    // Direct SQL via service-role using PostgREST is not possible; use a helper rpc.
    // We'll provide the SQL inline by calling a dedicated rpc if not present, so do a manual call:
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_tables_with_pk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (res.ok) tableList = await res.json();
    else {
      return json({
        error: "Helper RPC 'get_public_tables_with_pk' não está disponível. Execute a migração de helpers.",
      }, 500);
    }
  }

  let tables = tableList.filter((t) => !excluded.has(t.name));
  if (kind === "partial") {
    const reqSet = new Set(requested);
    tables = tables.filter((t) => reqSet.has(t.name));
    if (tables.length === 0) return json({ error: "Nenhuma tabela selecionada" }, 400);
  }

  // Count rows per table (use head: true)
  const tablesWithCount: { name: string; count: number; pk: string[] }[] = [];
  for (const t of tables) {
    const { count } = await admin.from(t.name).select("*", { count: "exact", head: true });
    tablesWithCount.push({ name: t.name, count: count ?? 0, pk: t.pk });
  }

  // Create db_backups row
  const { data: row, error: insErr } = await admin
    .from("db_backups")
    .insert({
      created_by: userId,
      kind,
      tables: tablesWithCount.map((t) => t.name),
      status: "running",
      notes: reason,
    })
    .select()
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  await logAudit(admin, userId, userEmail, "SUPER_ADMIN_BACKUP_START", {
    backup_id: row.id, kind, tables: tablesWithCount.map((t) => t.name), reason,
  });

  return json({ backup_id: row.id, tables: tablesWithCount, chunk_limit: CHUNK_LIMIT_DEFAULT });
}

// ─────────────────────────────────────────────────────────────────────────
async function chunkBackup(admin: any, body: any) {
  const backupId = String(body?.backup_id ?? "");
  const table = String(body?.table ?? "");
  const offset = Number(body?.offset ?? 0);
  const limit = Math.min(Number(body?.limit ?? CHUNK_LIMIT_DEFAULT), 5000);

  if (!backupId || !table) return json({ error: "backup_id + table required" }, 400);

  // Sanity: backup must be running
  const { data: bk } = await admin.from("db_backups").select("status,tables").eq("id", backupId).single();
  if (!bk) return json({ error: "Backup not found" }, 404);
  if (bk.status !== "running") return json({ error: `Backup status=${bk.status}` }, 400);
  if (!bk.tables.includes(table)) return json({ error: "Table not in backup set" }, 400);

  const { data: rows, error } = await admin
    .from(table)
    .select("*")
    .range(offset, offset + limit - 1);
  if (error) return json({ error: error.message }, 500);

  const rowsArr = rows ?? [];
  const jsonl = rowsArr.map((r) => JSON.stringify(r)).join("\n") + (rowsArr.length ? "\n" : "");
  const objectPath = `${backupId}/${table}/part-${String(offset).padStart(10, "0")}.jsonl`;
  const bytes = new TextEncoder().encode(jsonl).byteLength;

  if (rowsArr.length > 0) {
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, jsonl, { contentType: "application/x-ndjson", upsert: true });
    if (upErr) return json({ error: `storage: ${upErr.message}` }, 500);
  }

  const done = rowsArr.length < limit;
  return json({
    rows_written: rowsArr.length,
    bytes,
    object_path: rowsArr.length ? objectPath : null,
    next_offset: offset + rowsArr.length,
    done,
  });
}

// ─────────────────────────────────────────────────────────────────────────
async function finalizeBackup(
  admin: any, userId: string, userEmail: string | null, body: any,
) {
  const backupId = String(body?.backup_id ?? "");
  const success = !!body?.success;
  const rowCounts = body?.row_counts ?? {};
  const sizeBytes = Number(body?.size_bytes ?? 0);
  const objectPaths: string[] = Array.isArray(body?.object_paths) ? body.object_paths : [];
  const errStr = body?.error ? String(body.error) : null;

  const { error } = await admin
    .from("db_backups")
    .update({
      finished_at: new Date().toISOString(),
      status: success ? "completed" : "failed",
      row_counts: rowCounts,
      size_bytes: sizeBytes,
      object_paths: objectPaths,
      error: errStr,
    })
    .eq("id", backupId);
  if (error) return json({ error: error.message }, 500);

  await logAudit(admin, userId, userEmail,
    success ? "SUPER_ADMIN_BACKUP_DONE" : "SUPER_ADMIN_BACKUP_FAIL",
    { backup_id: backupId, row_counts: rowCounts, size_bytes: sizeBytes, error: errStr });

  return json({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────────
async function logAudit(
  admin: any, userId: string, userEmail: string | null, action: string, payload: unknown,
) {
  try {
    await admin.from("user_admin_audit").insert({
      actor_id: userId,
      actor_email: userEmail,
      action,
      new_data: payload as any,
      metadata: { source: "db-backup" } as any,
    });
  } catch (e) {
    console.warn("[db-backup] audit failed", e);
  }
}
