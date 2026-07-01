// backup-create v3 — Admin / Super Admin only.
// Backup chunked: cliente invoca repetidamente; cada chamada faz UM passo curto
// (uma página de uma tabela / uma seção). Estado persistido em backup_jobs.progress.state.
//
// Actions:
//   { action: "start", reason?, include_audit_logs? } -> { backup_id, status:"running" }
//   { action: "step",  backup_id }                    -> { phase, percent, done }
//
// Sem background work. Sem ZIP em memória. Cada invocação dura <2s.

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
const BACKUP_VERSION = "3.0";
const PAGE_SIZE = 500;

const SPECIAL_TABLES = [
  "profiles", "user_roles", "user_departments", "user_hospital_assignments",
  "institution_branding", "hospital_units", "states", "system_maintenance_mode",
  // catálogo estático — sempre completo no incremental
  "cid10_codes",
];
const SPECIAL_SET = new Set(SPECIAL_TABLES);

type FilterMode = "updated_at" | "created_at" | "full";
type TableMeta = { has_updated_at: boolean; has_created_at: boolean };
type Part = { path: string; bytes: number };
type State = {
  phase: "init" | "data" | "special" | "auth" | "manifest" | "done";
  tables?: string[];
  tableIdx?: number;
  pageFrom?: number;
  partN?: number;
  specialIdx?: number;
  specialPageFrom?: number;
  specialPartN?: number;
  authPage?: number;
  authPartN?: number;
  authTotal?: number;
  tableCounts: Record<string, number>;
  parts: Part[];
  totalBytes: number;
  reason: string;
  includeAudit: boolean;
  userId: string;
  userEmail: string | null;
  startedAt: number;
  // ── incremental
  since: string | null;                                // ISO-8601 ou null
  tableMeta?: Record<string, TableMeta>;                // por tabela pública
  tableFilterMode?: Record<string, FilterMode>;         // decisão efetiva
};

function isValidIsoTimestamp(s: unknown): s is string {
  if (typeof s !== "string" || !s.trim()) return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

function pickFilterMode(table: string, meta: TableMeta | undefined): FilterMode {
  if (SPECIAL_SET.has(table)) return "full";
  if (!meta) return "full";
  if (meta.has_updated_at) return "updated_at";
  if (meta.has_created_at) return "created_at";
  return "full";
}

function applySinceFilter<T>(query: T, table: string, s: State): T {
  if (!s.since) return query;
  const mode = s.tableFilterMode?.[table] ?? "full";
  if (mode === "full") return query;
  // supabase-js query builder
  return (query as any).gt(mode, s.since) as T;
}

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

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const allowed = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "super_admin");
  if (!allowed) return json({ error: "Acesso restrito a administradores" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const action = body.action ?? "start";

  if (action === "start") return await handleStart(admin, body, userId, userEmail, req);
  if (action === "step")  return await handleStep(admin, body, userId, userEmail);
  return json({ error: "action inválida" }, 400);
});

async function handleStart(admin: any, body: any, userId: string, userEmail: string | null, req: Request) {
  const reason = body.reason ?? "Backup manual";
  const includeAudit = !!body.include_audit_logs;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  const startedAt = Date.now();

  // Parâmetro opcional para backup incremental
  let since: string | null = null;
  if (body.since !== undefined && body.since !== null && body.since !== "") {
    if (!isValidIsoTimestamp(body.since)) {
      return json({ error: "Parâmetro 'since' inválido: precisa ser ISO-8601 (ex.: 2026-06-29T13:47:46Z)." }, 400);
    }
    since = new Date(body.since).toISOString();
  }

  const initState: State = {
    phase: "init",
    tableCounts: {},
    parts: [],
    totalBytes: 0,
    reason, includeAudit,
    userId, userEmail,
    startedAt,
    since,
  };

  const displayReason = since ? `[INCR desde ${since}] ${reason}` : reason;

  const { data: jobRow, error: jobErr } = await admin.from("backup_jobs").insert({
    created_by: userId,
    created_by_email: userEmail,
    status: "running",
    started_at: new Date(startedAt).toISOString(),
    source_instance: SUPABASE_URL,
    reason: displayReason,
    progress: { step: since ? "iniciando (incremental)" : "iniciando", percent: 0, state: initState },
  }).select().single();
  if (jobErr || !jobRow) return json({ error: `Falha ao criar job: ${jobErr?.message}` }, 500);

  await audit(admin, userId, userEmail, "BACKUP_CREATE_START", {
    backup_job_id: jobRow.id,
    payload: { reason, include_audit_logs: includeAudit, incremental: !!since, since },
    ip, userAgent,
  });
  return json({ backup_id: jobRow.id, status: "running", incremental: !!since, since }, 202);
}

async function handleStep(admin: any, body: any, userId: string, userEmail: string | null) {
  const backupId = body.backup_id;
  if (!backupId) return json({ error: "backup_id obrigatório" }, 400);

  const { data: job, error } = await admin.from("backup_jobs").select("*").eq("id", backupId).maybeSingle();
  if (error || !job) return json({ error: "job não encontrado" }, 404);
  if (job.status !== "running") return json({ phase: "done", percent: 100, done: true, status: job.status });

  const state: State = job.progress?.state;
  if (!state) return json({ error: "state ausente" }, 500);

  try {
    const { step, percent, done } = await doOneStep(admin, backupId, state);
    if (done) {
      return json({ phase: "done", percent: 100, done: true, status: "completed" });
    }
    await admin.from("backup_jobs").update({
      progress: { step, percent, state, current: state.tableIdx ?? null, total: state.tables?.length ?? null },
    }).eq("id", backupId);
    return json({ phase: state.phase, percent, step, done: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[backup-create.step]", msg);
    await admin.from("backup_jobs").update({
      status: "failed", error: msg, finished_at: new Date().toISOString(),
      duration_ms: Date.now() - state.startedAt,
    }).eq("id", backupId);
    await audit(admin, userId, userEmail, "BACKUP_CREATE_FAIL", { backup_job_id: backupId, result: "fail", error: msg });
    return json({ error: msg, phase: "failed", done: true }, 500);
  }
}

async function doOneStep(admin: any, jobId: string, s: State): Promise<{ step: string; percent: number; done: boolean }> {
  // ───────────── INIT: planejar tabelas
  if (s.phase === "init") {
    const tablesRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_tables_with_pk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!tablesRes.ok) throw new Error(`get_public_tables_with_pk: ${tablesRes.status}`);
    const allTables: { name: string }[] = await tablesRes.json();
    s.tables = allTables.map((t) => t.name)
      .filter((n) => !SPECIAL_SET.has(n))
      .filter((n) => s.includeAudit || n !== "audit_logs")
      .sort();
    s.phase = "data";
    s.tableIdx = 0;
    s.pageFrom = 0;
    s.partN = 0;
    return { step: "planejado", percent: 2, done: false };
  }

  // ───────────── DATA: uma página por chamada
  if (s.phase === "data") {
    const tables = s.tables!;
    if (s.tableIdx! >= tables.length) {
      s.phase = "special";
      s.specialIdx = 0;
      s.specialPageFrom = 0;
      s.specialPartN = 0;
      return { step: "tabelas concluídas", percent: 70, done: false };
    }
    const table = tables[s.tableIdx!];
    const from = s.pageFrom!;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await admin.from(table).select("*").range(from, to);
    if (error) throw new Error(`dump ${table}: ${error.message}`);
    const rows = data ?? [];
    if (rows.length > 0) {
      const content = rows.map((r: any) => JSON.stringify(r)).join("\n");
      const path = `data/${table}.part-${String(s.partN!).padStart(4, "0")}.jsonl`;
      await putContent(admin, jobId, path, content, "application/x-ndjson", s);
      s.tableCounts[table] = (s.tableCounts[table] ?? 0) + rows.length;
      s.partN! += 1;
    }
    if (rows.length < PAGE_SIZE) {
      // tabela concluída
      s.tableIdx! += 1;
      s.pageFrom = 0;
      s.partN = 0;
    } else {
      s.pageFrom = from + PAGE_SIZE;
    }
    const pct = 5 + Math.floor((s.tableIdx! / tables.length) * 65);
    return { step: `tabela: ${table} (${(s.tableCounts[table] ?? 0).toLocaleString("pt-BR")} regs)`, percent: pct, done: false };
  }

  // ───────────── SPECIAL: profiles/roles/units/etc paginados
  if (s.phase === "special") {
    if (s.specialIdx! >= SPECIAL_TABLES.length) {
      s.phase = "auth";
      s.authPage = 1;
      s.authPartN = 0;
      s.authTotal = 0;
      return { step: "configurações concluídas", percent: 82, done: false };
    }
    const table = SPECIAL_TABLES[s.specialIdx!];
    const from = s.specialPageFrom!;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await admin.from(table).select("*").range(from, to);
    if (error) throw new Error(`dump ${table}: ${error.message}`);
    const rows = data ?? [];
    if (rows.length > 0) {
      const content = rows.map((r: any) => JSON.stringify(r)).join("\n");
      const path = `special/${table}.part-${String(s.specialPartN!).padStart(4, "0")}.jsonl`;
      await putContent(admin, jobId, path, content, "application/x-ndjson", s);
      s.tableCounts[table] = (s.tableCounts[table] ?? 0) + rows.length;
      s.specialPartN! += 1;
    }
    if (rows.length < PAGE_SIZE) {
      s.specialIdx! += 1;
      s.specialPageFrom = 0;
      s.specialPartN = 0;
    } else {
      s.specialPageFrom = from + PAGE_SIZE;
    }
    return { step: `config: ${table}`, percent: 72 + Math.floor((s.specialIdx! / SPECIAL_TABLES.length) * 10), done: false };
  }

  // ───────────── AUTH: uma página por chamada
  if (s.phase === "auth") {
    const page = s.authPage!;
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`auth.listUsers: ${error.message}`);
    const users = data?.users ?? [];
    if (users.length > 0) {
      const slim = users.map((u: any) => ({
        id: u.id, email: u.email, phone: u.phone,
        email_confirmed_at: u.email_confirmed_at, phone_confirmed_at: u.phone_confirmed_at,
        created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
        user_metadata: u.user_metadata, app_metadata: u.app_metadata,
        role: u.role, banned_until: u.banned_until ?? null,
        is_sso_user: u.is_sso_user ?? false,
      }));
      const path = `auth/users.part-${String(s.authPartN!).padStart(4, "0")}.json`;
      await putContent(admin, jobId, path, JSON.stringify(slim), "application/json", s);
      s.authPartN! += 1;
      s.authTotal! += users.length;
    }
    if (users.length < PAGE_SIZE) {
      s.phase = "manifest";
      return { step: `auth concluída (${s.authTotal} usuários)`, percent: 92, done: false };
    }
    s.authPage! += 1;
    return { step: `auth users página ${page}`, percent: 84, done: false };
  }

  // ───────────── MANIFEST + finalizar
  if (s.phase === "manifest") {
    const totalRecords = Object.values(s.tableCounts).reduce((a, b) => a + b, 0);
    const manifest = {
      backup_version: BACKUP_VERSION,
      backup_id: jobId,
      created_at: new Date().toISOString(),
      created_by: { id: s.userId, email: s.userEmail },
      source_instance: SUPABASE_URL,
      table_counts: s.tableCounts,
      database_records: totalRecords,
      auth_users: s.authTotal ?? 0,
      include_audit_logs: s.includeAudit,
      reason: s.reason,
      parts: s.parts,
      total_bytes: s.totalBytes,
      notes: [
        "Backup v3.0 — chunked. Use backup-download para gerar um ZIP único.",
        "DDL (schema) NÃO está incluso — a instância destino deve ter as mesmas migrations aplicadas.",
        "Hashes de senha NÃO são exportados; usuários restaurados recebem email de reset.",
        "MFA e identidades externas (Google/Apple) não são restauráveis via Admin API.",
      ],
    };
    const manifestStr = JSON.stringify(manifest, null, 2);
    const manifestBytes = new TextEncoder().encode(manifestStr);
    const { error: upErr } = await admin.storage.from(BUCKET).upload(`${jobId}/manifest.json`, manifestBytes, {
      contentType: "application/json", upsert: true,
    });
    if (upErr) throw new Error(`upload manifest: ${upErr.message}`);

    const finishedAt = Date.now();
    await admin.from("backup_jobs").update({
      status: "completed",
      storage_path: `${jobId}/manifest.json`,
      file_size_bytes: s.totalBytes + manifestBytes.byteLength,
      manifest,
      table_counts: s.tableCounts,
      auth_user_count: s.authTotal ?? 0,
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: finishedAt - s.startedAt,
      progress: { step: "concluído", percent: 100, state: { ...s, phase: "done" } },
    }).eq("id", jobId);

    await audit(admin, s.userId, s.userEmail, "BACKUP_CREATE_DONE", {
      backup_job_id: jobId, result: "success", duration_ms: finishedAt - s.startedAt,
      payload: { total_bytes: s.totalBytes, records: totalRecords, auth_users: s.authTotal ?? 0, parts: s.parts.length },
    });
    return { step: "concluído", percent: 100, done: true };
  }

  return { step: "?", percent: 0, done: true };
}

async function putContent(admin: any, jobId: string, relPath: string, content: string, contentType: string, s: State) {
  const bytes = new TextEncoder().encode(content);
  const fullPath = `${jobId}/${relPath}`;
  const { error } = await admin.storage.from(BUCKET).upload(fullPath, bytes, { contentType, upsert: true });
  if (error) throw new Error(`upload ${relPath}: ${error.message}`);
  s.parts.push({ path: relPath, bytes: bytes.byteLength });
  s.totalBytes += bytes.byteLength;
}

async function audit(admin: any, userId: string, email: string | null, action: string, extra: Record<string, unknown>) {
  try {
    await admin.from("backup_audit").insert({
      actor_id: userId, actor_email: email, action,
      backup_job_id: (extra as any).backup_job_id ?? null,
      result: (extra as any).result ?? null,
      error: (extra as any).error ?? null,
      duration_ms: (extra as any).duration_ms ?? null,
      ip_address: (extra as any).ip ?? null,
      user_agent: (extra as any).userAgent ?? null,
      source_instance: SUPABASE_URL,
      payload: (extra as any).payload ?? null,
    });
  } catch (e) { console.warn("[backup-create] audit fail", e); }
}
