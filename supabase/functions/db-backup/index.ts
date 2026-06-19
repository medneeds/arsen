// db-backup — Super Admin only. Action-based dispatch.
//
// actions:
//   "start"     { kind: "full"|"partial", tables: string[], reason: string, password: string }
//               → { backup_id, tables: [{ name, count, pk, size_bytes, chunk_limit, use_keyset }] }
//   "chunk"     { backup_id, table, cursor?: string|null, offset?: number, limit?: number, pk_column?: string }
//               → { rows_written, bytes, object_path, next_cursor, next_offset, done }
//   "finalize"  { backup_id, success, error?, row_counts, size_bytes, object_paths, notes? }
//               → { ok: true }
//
// Bucket: db-backups (private). Path: <backup_id>/<table>/part-<seq>.jsonl
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

// Per-table chunk sizing
const CHUNK_LIMIT_DEFAULT = 1000;
const CHUNK_LIMIT_LARGE = 200; // for tables > LARGE_TABLE_THRESHOLD
const LARGE_TABLE_THRESHOLD = 100 * 1024 * 1024; // 100 MB
const SOFT_BYTES_BUDGET = 6 * 1024 * 1024; // 6 MB per chunk — informational

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    if (action === "start") return await startBackup(admin, userId, userEmail, body);
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
  admin: any, userId: string, userEmail: string | null, body: any,
) {
  const kind = body?.kind as "full" | "partial";
  const reason = String(body?.reason ?? "");
  const password = String(body?.password ?? "");
  const requested = Array.isArray(body?.tables) ? (body.tables as string[]) : [];

  if (!["full", "partial"].includes(kind)) return json({ error: "kind must be full|partial" }, 400);
  if (!password) return json({ error: "password required" }, 400);
  if (!userEmail) return json({ error: "user email missing" }, 400);

  // Password reverification
  const verify = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: pwErr } = await verify.auth.signInWithPassword({ email: userEmail, password });
  if (pwErr) return json({ error: "Senha incorreta" }, 401);

  // List public tables with pk + size_bytes via helper RPC
  const excluded = new Set(["system_maintenance_mode", "db_backups", "db_restore_audit"]);
  const { data: rawList, error: rpcErr } = await admin.rpc("get_public_tables_with_pk_and_size");
  if (rpcErr || !Array.isArray(rawList)) {
    return json({ error: `RPC get_public_tables_with_pk_and_size indisponível: ${rpcErr?.message ?? "no data"}` }, 500);
  }
  let tableList: { name: string; pk: string[]; size_bytes: number }[] = rawList as any;
  tableList = tableList.filter((t) => !excluded.has(t.name));

  if (kind === "partial") {
    const reqSet = new Set(requested);
    tableList = tableList.filter((t) => reqSet.has(t.name));
    if (tableList.length === 0) return json({ error: "Nenhuma tabela selecionada" }, 400);
  }

  // Count rows per table + decide chunk_limit and pagination mode
  const tablesPlan: {
    name: string; count: number; pk: string[]; size_bytes: number;
    chunk_limit: number; use_keyset: boolean; pk_column: string | null;
  }[] = [];
  for (const t of tableList) {
    const { count } = await admin.from(t.name).select("*", { count: "exact", head: true });
    const isLarge = (t.size_bytes ?? 0) > LARGE_TABLE_THRESHOLD;
    const chunk_limit = isLarge ? CHUNK_LIMIT_LARGE : CHUNK_LIMIT_DEFAULT;
    const pk_column = (Array.isArray(t.pk) && t.pk.length === 1) ? t.pk[0] : null;
    const use_keyset = !!pk_column;
    tablesPlan.push({
      name: t.name, count: count ?? 0, pk: t.pk ?? [],
      size_bytes: t.size_bytes ?? 0, chunk_limit, use_keyset, pk_column,
    });
  }

  // Create db_backups row
  const { data: row, error: insErr } = await admin
    .from("db_backups")
    .insert({
      created_by: userId,
      kind,
      tables: tablesPlan.map((t) => t.name),
      status: "running",
      notes: reason,
    })
    .select()
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  await logAudit(admin, userId, userEmail, "SUPER_ADMIN_BACKUP_START", {
    backup_id: row.id, kind, tables: tablesPlan.map((t) => t.name), reason,
  });

  return json({ backup_id: row.id, tables: tablesPlan });
}

// ─────────────────────────────────────────────────────────────────────────
async function chunkBackup(admin: any, body: any) {
  const backupId = String(body?.backup_id ?? "");
  const table = String(body?.table ?? "");
  const pkColumn: string | null = body?.pk_column ? String(body.pk_column) : null;
  const cursor: string | null = body?.cursor != null ? String(body.cursor) : null;
  const offset = Number(body?.offset ?? 0);
  const limit = Math.min(Number(body?.limit ?? CHUNK_LIMIT_DEFAULT), 5000);
  const seq = Number(body?.seq ?? offset); // used only for file naming

  if (!backupId || !table) return json({ error: "backup_id + table required" }, 400);

  // Sanity: backup must be running
  const { data: bk } = await admin.from("db_backups").select("status,tables").eq("id", backupId).single();
  if (!bk) return json({ error: "Backup not found" }, 404);
  if (bk.status !== "running") return json({ error: `Backup status=${bk.status}` }, 400);
  if (!bk.tables.includes(table)) return json({ error: "Table not in backup set" }, 400);

  // ── Query with retry (1 extra attempt on 5xx/HTML/transient errors) ──
  const runQuery = async () => {
    if (pkColumn) {
      let q = admin.from(table).select("*").order(pkColumn, { ascending: true }).limit(limit);
      if (cursor !== null) q = q.gt(pkColumn, cursor);
      return await q;
    }
    return await admin.from(table).select("*").range(offset, offset + limit - 1);
  };

  let rowsRes = await runQuery();
  if (rowsRes.error) {
    const msg = String(rowsRes.error?.message ?? "");
    const transient = /5\d\d|timeout|html|gateway|<html|Unexpected token/i.test(msg);
    if (transient) {
      console.warn(`[db-backup] chunk transient error on ${table} — retry in 1s: ${msg}`);
      await sleep(1000);
      rowsRes = await runQuery();
    }
  }
  if (rowsRes.error) return json({ error: rowsRes.error.message }, 500);

  const rowsArr = rowsRes.data ?? [];
  const jsonl = rowsArr.map((r: any) => JSON.stringify(r)).join("\n") + (rowsArr.length ? "\n" : "");
  const bytes = new TextEncoder().encode(jsonl).byteLength;
  const objectPath = `${backupId}/${table}/part-${String(seq).padStart(10, "0")}.jsonl`;

  if (rowsArr.length > 0) {
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, jsonl, { contentType: "application/x-ndjson", upsert: true });
    if (upErr) return json({ error: `storage: ${upErr.message}` }, 500);
  }

  const done = rowsArr.length < limit;
  // Compute next cursor for keyset pagination
  let nextCursor: string | null = null;
  if (pkColumn && rowsArr.length > 0) {
    const lastRow = rowsArr[rowsArr.length - 1] as Record<string, unknown>;
    nextCursor = lastRow[pkColumn] != null ? String(lastRow[pkColumn]) : null;
  }

  if (bytes > SOFT_BYTES_BUDGET) {
    console.warn(`[db-backup] chunk ${table} part-${seq} bytes=${bytes} (>${SOFT_BYTES_BUDGET}); consider smaller limit`);
  }

  return json({
    rows_written: rowsArr.length,
    bytes,
    object_path: rowsArr.length ? objectPath : null,
    next_cursor: nextCursor,
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
