// db-backup — Super Admin only. Action-based dispatch.
//
// actions:
//   "start"     { kind: "full"|"partial", tables: string[], reason: string, password: string }
//               → { backup_id, tables: [{ name, count, pk, size_bytes, chunk_limit, use_keyset, pk_column }] }
//   "resume"    { backup_id, password }
//               → { backup_id, tables: [...], checkpoint, completed_tables }
//   "chunk"     { backup_id, table, cursor?, offset?, limit?, pk_column?, seq? }
//               → { rows_written, bytes, object_path, next_cursor, next_offset, done, attempts }
//   "finalize"  { backup_id, success, error?, row_counts, size_bytes, object_paths }
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

// Retry / timeout policy for chunk queries
const QUERY_TIMEOUT_MS = 50_000; // below gateway ~60s timeout
const MAX_QUERY_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1000, 2000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRANSIENT_RX =
  /Unexpected token|<html|<\!DOCTYPE|5\d\d|timeout|gateway|fetch failed|network|ECONNRESET|aborted/i;

function isTransientError(msg: string): boolean {
  return TRANSIENT_RX.test(msg);
}

// Wrap a promise with a hard timeout. Rejects with a transient-looking message.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout: ${label} exceeded ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

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
    if (action === "resume") return await resumeBackup(admin, userId, userEmail, body);
    if (action === "chunk") return await chunkBackup(admin, body);
    if (action === "finalize") return await finalizeBackup(admin, userId, userEmail, body);
    if (action === "download") return await downloadBackup(admin, userId, userEmail, body);
    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[db-backup]", action, msg);
    return json({ error: msg }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────
async function buildTablesPlan(
  admin: any,
  tableList: { name: string; pk: string[]; size_bytes: number }[],
) {
  const plan: {
    name: string; count: number; pk: string[]; size_bytes: number;
    chunk_limit: number; use_keyset: boolean; pk_column: string | null;
  }[] = [];
  for (const t of tableList) {
    const { count } = await admin.from(t.name).select("*", { count: "exact", head: true });
    const isLarge = (t.size_bytes ?? 0) > LARGE_TABLE_THRESHOLD;
    const chunk_limit = isLarge ? CHUNK_LIMIT_LARGE : CHUNK_LIMIT_DEFAULT;
    const pk_column = (Array.isArray(t.pk) && t.pk.length === 1) ? t.pk[0] : null;
    const use_keyset = !!pk_column;
    plan.push({
      name: t.name, count: count ?? 0, pk: t.pk ?? [],
      size_bytes: t.size_bytes ?? 0, chunk_limit, use_keyset, pk_column,
    });
  }
  return plan;
}

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

  const verify = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: pwErr } = await verify.auth.signInWithPassword({ email: userEmail, password });
  if (pwErr) return json({ error: "Senha incorreta" }, 401);

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

  const tablesPlan = await buildTablesPlan(admin, tableList);

  const { data: row, error: insErr } = await admin
    .from("db_backups")
    .insert({
      created_by: userId,
      kind,
      tables: tablesPlan.map((t) => t.name),
      status: "running",
      notes: reason,
      checkpoint: null,
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
async function resumeBackup(
  admin: any, userId: string, userEmail: string | null, body: any,
) {
  const backupId = String(body?.backup_id ?? "");
  const password = String(body?.password ?? "");
  if (!backupId) return json({ error: "backup_id required" }, 400);
  if (!password) return json({ error: "password required" }, 400);
  if (!userEmail) return json({ error: "user email missing" }, 400);

  const verify = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: pwErr } = await verify.auth.signInWithPassword({ email: userEmail, password });
  if (pwErr) return json({ error: "Senha incorreta" }, 401);

  const { data: bk, error: bkErr } = await admin.from("db_backups").select("*").eq("id", backupId).single();
  if (bkErr || !bk) return json({ error: "Backup não encontrado" }, 404);
  if (bk.status !== "failed") return json({ error: `Backup status=${bk.status}, só é possível retomar 'failed'` }, 400);
  if (!bk.checkpoint) return json({ error: "Backup sem checkpoint — não pode ser retomado, dispare um novo" }, 400);

  // Re-build plan for the same set of tables (sizes/counts may have changed)
  const { data: rawList, error: rpcErr } = await admin.rpc("get_public_tables_with_pk_and_size");
  if (rpcErr || !Array.isArray(rawList)) {
    return json({ error: `RPC indisponível: ${rpcErr?.message ?? "no data"}` }, 500);
  }
  const setNames = new Set<string>(bk.tables ?? []);
  const tableList = (rawList as any[]).filter((t) => setNames.has(t.name));
  const tablesPlan = await buildTablesPlan(admin, tableList);

  // Reactivate the backup
  await admin
    .from("db_backups")
    .update({ status: "running", finished_at: null, error: null })
    .eq("id", backupId);

  await logAudit(admin, userId, userEmail, "SUPER_ADMIN_BACKUP_RESUME", {
    backup_id: backupId, checkpoint: bk.checkpoint,
  });

  return json({
    backup_id: backupId,
    tables: tablesPlan,
    checkpoint: bk.checkpoint,
    completed_tables: bk.row_counts ?? {},
    object_paths: bk.object_paths ?? [],
    size_bytes: bk.size_bytes ?? 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────
async function chunkBackup(admin: any, body: any) {
  const backupId = String(body?.backup_id ?? "");
  const table = String(body?.table ?? "");
  const pkColumn: string | null = body?.pk_column ? String(body.pk_column) : null;
  const cursor: string | null = body?.cursor != null ? String(body.cursor) : null;
  const offset = Number(body?.offset ?? 0);
  const limit = Math.min(Number(body?.limit ?? CHUNK_LIMIT_DEFAULT), 5000);
  const seq = Number(body?.seq ?? offset);

  if (!backupId || !table) return json({ error: "backup_id + table required" }, 400);

  const { data: bk } = await admin.from("db_backups").select("status,tables").eq("id", backupId).single();
  if (!bk) return json({ error: "Backup not found" }, 404);
  if (bk.status !== "running") return json({ error: `Backup status=${bk.status}` }, 400);
  if (!bk.tables.includes(table)) return json({ error: "Table not in backup set" }, 400);

  // ── Query with up to MAX_QUERY_ATTEMPTS attempts; transient errors caught ──
  const runQuery = () => {
    if (pkColumn) {
      let q = admin.from(table).select("*").order(pkColumn, { ascending: true }).limit(limit);
      if (cursor !== null) q = q.gt(pkColumn, cursor);
      return q;
    }
    return admin.from(table).select("*").range(offset, offset + limit - 1);
  };

  let rowsArr: any[] | null = null;
  let attempts = 0;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_QUERY_ATTEMPTS; attempt++) {
    attempts = attempt;
    try {
      const res: any = await withTimeout(
        Promise.resolve(runQuery()),
        QUERY_TIMEOUT_MS,
        `query ${table} attempt=${attempt}`,
      );
      if (res?.error) {
        const msg = String(res.error?.message ?? "");
        lastError = msg;
        if (attempt < MAX_QUERY_ATTEMPTS && isTransientError(msg)) {
          console.warn(`[db-backup] ${table} attempt=${attempt} transient .error: ${msg} — retry`);
          await sleep(BACKOFF_MS[attempt - 1] ?? 2000);
          continue;
        }
        return json({ error: msg, attempts }, 500);
      }
      rowsArr = res?.data ?? [];
      lastError = null;
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      if (attempt < MAX_QUERY_ATTEMPTS && isTransientError(msg)) {
        console.warn(`[db-backup] ${table} attempt=${attempt} transient throw: ${msg} — retry`);
        await sleep(BACKOFF_MS[attempt - 1] ?? 2000);
        continue;
      }
      return json({ error: msg, attempts }, 500);
    }
  }

  if (rowsArr === null) {
    return json({ error: lastError ?? "unknown query failure", attempts }, 500);
  }

  const jsonl = rowsArr.map((r: any) => JSON.stringify(r)).join("\n") + (rowsArr.length ? "\n" : "");
  const bytes = new TextEncoder().encode(jsonl).byteLength;
  const objectPath = `${backupId}/${table}/part-${String(seq).padStart(10, "0")}.jsonl`;

  if (rowsArr.length > 0) {
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, jsonl, { contentType: "application/x-ndjson", upsert: true });
    if (upErr) return json({ error: `storage: ${upErr.message}`, attempts }, 500);
  }

  const done = rowsArr.length < limit;

  let nextCursor: string | null = null;
  if (pkColumn && rowsArr.length > 0) {
    const lastRow = rowsArr[rowsArr.length - 1] as Record<string, unknown>;
    nextCursor = lastRow[pkColumn] != null ? String(lastRow[pkColumn]) : null;
  }

  if (bytes > SOFT_BYTES_BUDGET) {
    console.warn(`[db-backup] chunk ${table} part-${seq} bytes=${bytes} (>${SOFT_BYTES_BUDGET}); consider smaller limit`);
  }

  // ── Persist checkpoint so a future retry can resume from here ──
  try {
    await admin
      .from("db_backups")
      .update({
        checkpoint: {
          table,
          pk_column: pkColumn,
          last_cursor: nextCursor,
          next_offset: offset + rowsArr.length,
          next_seq: seq + 1,
          done_for_table: done,
          updated_at: new Date().toISOString(),
        },
      })
      .eq("id", backupId);
  } catch (e) {
    console.warn("[db-backup] checkpoint update failed (non-fatal):", e);
  }

  return json({
    rows_written: rowsArr.length,
    bytes,
    object_path: rowsArr.length ? objectPath : null,
    next_cursor: nextCursor,
    next_offset: offset + rowsArr.length,
    done,
    attempts,
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

  const update: any = {
    finished_at: new Date().toISOString(),
    status: success ? "completed" : "failed",
    row_counts: rowCounts,
    size_bytes: sizeBytes,
    object_paths: objectPaths,
    error: errStr,
  };
  // On success, clear checkpoint (no need to resume)
  if (success) update.checkpoint = null;

  const { error } = await admin.from("db_backups").update(update).eq("id", backupId);
  if (error) return json({ error: error.message }, 500);

  await logAudit(admin, userId, userEmail,
    success ? "SUPER_ADMIN_BACKUP_DONE" : "SUPER_ADMIN_BACKUP_FAIL",
    { backup_id: backupId, row_counts: rowCounts, size_bytes: sizeBytes, error: errStr });

  return json({ ok: true });
}


// ─── download ───────────────────────────────────────────────────────────
// Hybrid: zip in memory when total payload fits (~150MB), otherwise return
// per-file signed URLs grouped by table.
const ZIP_THRESHOLD_BYTES = 150 * 1024 * 1024;
const SIGNED_URL_TTL = 600; // 10 minutes

async function downloadBackup(
  admin: any, userId: string, userEmail: string | null, body: any,
) {
  const backupId = String(body?.backup_id ?? "");
  if (!backupId) return json({ error: "backup_id required" }, 400);

  const { data: bk, error: bkErr } = await admin
    .from("db_backups").select("*").eq("id", backupId).maybeSingle();
  if (bkErr) return json({ error: bkErr.message }, 500);
  if (!bk) return json({ error: "Backup não encontrado" }, 404);
  if (bk.status !== "completed") {
    return json({ error: `Backup status=${bk.status}; download requer 'completed'` }, 400);
  }
  const paths: string[] = Array.isArray(bk.object_paths) ? bk.object_paths : [];
  if (paths.length === 0) return json({ error: "Backup sem arquivos" }, 400);

  const totalBytes = Number(bk.size_bytes ?? 0);

  // ── ZIP mode ────────────────────────────────────────────────────────
  if (totalBytes > 0 && totalBytes <= ZIP_THRESHOLD_BYTES) {
    try {
      const { default: JSZip } = await import("npm:jszip@3.10.1");
      const zip = new JSZip();
      for (const p of paths) {
        const { data: blob, error: dErr } = await admin.storage.from(BUCKET).download(p);
        if (dErr || !blob) {
          return json({ error: `Falha ao baixar ${p}: ${dErr?.message ?? "vazio"}` }, 500);
        }
        const buf = new Uint8Array(await blob.arrayBuffer());
        const inner = p.startsWith(`${backupId}/`) ? p.slice(backupId.length + 1) : p;
        zip.file(inner, buf);
      }
      const zipBytes: Uint8Array = await zip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: 1 },
      });
      const exportPath = `_exports/${backupId}.zip`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(
        exportPath, zipBytes,
        { contentType: "application/zip", upsert: true },
      );
      if (upErr) return json({ error: `Upload zip: ${upErr.message}` }, 500);

      const { data: signed, error: sErr } = await admin.storage.from(BUCKET)
        .createSignedUrl(exportPath, SIGNED_URL_TTL);
      if (sErr || !signed?.signedUrl) {
        return json({ error: `Signed URL: ${sErr?.message ?? "vazio"}` }, 500);
      }

      await logAudit(admin, userId, userEmail, "SUPER_ADMIN_BACKUP_DOWNLOAD", {
        backup_id: backupId, mode: "zip", zip_bytes: zipBytes.byteLength,
      });

      return json({
        mode: "zip",
        url: signed.signedUrl,
        size_bytes: zipBytes.byteLength,
        expires_in: SIGNED_URL_TTL,
        file_count: paths.length,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // OOM / memória estourada → cai automaticamente para o modo lista
      console.warn("[db-backup] zip failed, falling back to list:", msg);
    }
  }

  // ── LIST mode (fallback / size > threshold) ─────────────────────────
  const { data: signedList, error: slErr } = await admin.storage.from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  if (slErr || !signedList) {
    return json({ error: `Signed URLs: ${slErr?.message ?? "vazio"}` }, 500);
  }

  // Build per-file size map by listing each table dir under the backup
  const sizeMap: Record<string, number> = {};
  const dirs = new Set<string>();
  for (const p of paths) {
    const i = p.lastIndexOf("/");
    if (i > 0) dirs.add(p.slice(0, i));
  }
  for (const dir of dirs) {
    const { data: list } = await admin.storage.from(BUCKET).list(dir, { limit: 1000 });
    if (list) {
      for (const item of list) {
        const fullPath = `${dir}/${item.name}`;
        const size = (item.metadata as any)?.size ?? (item as any)?.size ?? 0;
        sizeMap[fullPath] = Number(size) || 0;
      }
    }
  }

  const files = signedList.map((s: any, i: number) => {
    const p = paths[i];
    const rel = p.startsWith(`${backupId}/`) ? p.slice(backupId.length + 1) : p;
    const table = rel.split("/")[0] ?? "(root)";
    const fname = rel.split("/").slice(1).join("/") || rel;
    return {
      table,
      path: p,
      filename: fname,
      url: s.signedUrl ?? s.signedURL ?? null,
      size_bytes: sizeMap[p] ?? 0,
      error: s.error ?? null,
    };
  });

  await logAudit(admin, userId, userEmail, "SUPER_ADMIN_BACKUP_DOWNLOAD", {
    backup_id: backupId, mode: "list", file_count: files.length,
  });

  return json({
    mode: "list",
    files,
    expires_in: SIGNED_URL_TTL,
    file_count: files.length,
    total_size_bytes: totalBytes,
  });
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
