// backup-create — Admin / Super Admin only.
// Cria um snapshot completo (dados públicos + auth users + profiles + roles + settings)
// como múltiplos arquivos no bucket `db-backups`, sob o prefixo `${jobId}/`.
// Nenhum ZIP é montado em memória — isso é feito sob demanda pela função `backup-download`.
//
// Body: { reason?: string, include_audit_logs?: boolean }
// Retorna: { backup_id, status: "running" } (202) — o trabalho roda em background.
// Cliente acompanha por polling em backup_jobs.

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
const BACKUP_VERSION = "2.0"; // v2: arquivos separados, sem ZIP em memória
const PAGE_SIZE = 1000;

const SPECIAL_TABLES = new Set([
  "profiles", "user_roles", "user_departments", "user_hospital_assignments",
  "institution_branding", "hospital_units", "states", "system_maintenance_mode",
]);

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

  let body: { reason?: string; include_audit_logs?: boolean } = {};
  try { body = await req.json(); } catch { /* opcional */ }
  const reason = body.reason ?? "Backup manual";
  const includeAudit = !!body.include_audit_logs;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const startedAt = Date.now();
  const { data: jobRow, error: jobErr } = await admin.from("backup_jobs").insert({
    created_by: userId,
    created_by_email: userEmail,
    status: "running",
    started_at: new Date(startedAt).toISOString(),
    source_instance: SUPABASE_URL,
    reason,
    progress: { step: "iniciando", percent: 0 },
  }).select().single();
  if (jobErr || !jobRow) return json({ error: `Falha ao criar job: ${jobErr?.message}` }, 500);
  const jobId = jobRow.id as string;

  await audit(admin, userId, userEmail, "BACKUP_CREATE_START", { backup_job_id: jobId, payload: { reason, include_audit_logs: includeAudit }, ip, userAgent });

  // deno-lint-ignore no-explicit-any
  const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil?.bind((globalThis as any).EdgeRuntime);
  const work = runBackup({ admin, jobId, userId, userEmail, reason, includeAudit, startedAt, ip, userAgent })
    .catch(async (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[backup-create] background", msg);
      await admin.from("backup_jobs").update({
        status: "failed", error: msg, finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
      }).eq("id", jobId);
      await audit(admin, userId, userEmail, "BACKUP_CREATE_FAIL", { backup_job_id: jobId, result: "fail", error: msg, ip, userAgent });
    });
  if (waitUntil) waitUntil(work);

  return json({ backup_id: jobId, status: "running" }, 202);
});

async function runBackup(args: {
  admin: any; jobId: string; userId: string; userEmail: string | null;
  reason: string; includeAudit: boolean; startedAt: number;
  ip: string | null; userAgent: string | null;
}) {
  const { admin, jobId, userId, userEmail, reason, includeAudit, startedAt, ip, userAgent } = args;
  const tableCounts: Record<string, number> = {};
  const parts: { path: string; bytes: number }[] = [];
  let totalBytes = 0;

  const putFile = async (relPath: string, content: string, contentType = "application/json") => {
    const bytes = new TextEncoder().encode(content);
    const fullPath = `${jobId}/${relPath}`;
    const { error } = await admin.storage.from(BUCKET).upload(fullPath, bytes, { contentType, upsert: true });
    if (error) throw new Error(`upload ${relPath}: ${error.message}`);
    parts.push({ path: relPath, bytes: bytes.byteLength });
    totalBytes += bytes.byteLength;
  };

  await updateProgress(admin, jobId, "listando tabelas", 5);
  const tablesRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_tables_with_pk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}),
  });
  if (!tablesRes.ok) throw new Error(`Helper get_public_tables_with_pk indisponível: ${tablesRes.status}`);
  const allTables: { name: string; pk: string[] }[] = await tablesRes.json();
  const dataTables = allTables
    .map((t) => t.name)
    .filter((n) => !SPECIAL_TABLES.has(n))
    .filter((n) => includeAudit || n !== "audit_logs")
    .sort();

  // Dados — uma tabela por arquivo, streaming por páginas (sem acumular tudo na RAM)
  let idx = 0;
  for (const table of dataTables) {
    idx++;
    const pct = 5 + Math.floor((idx / dataTables.length) * 65);
    await updateProgress(admin, jobId, `tabela: ${table}`, pct, idx, dataTables.length);
    const { content, count } = await dumpTableToJsonl(admin, table);
    tableCounts[table] = count;
    await putFile(`data/${table}.jsonl`, content, "application/x-ndjson");
  }

  // Perfis e papéis
  await updateProgress(admin, jobId, "perfis e papéis", 75);
  const profiles = await dumpTableArray(admin, "profiles");
  tableCounts["profiles"] = profiles.length;
  await putFile("profiles.json", JSON.stringify(profiles));

  const roles_rows = await dumpTableArray(admin, "user_roles");
  const depts = await dumpTableArray(admin, "user_departments");
  const hosps = await dumpTableArray(admin, "user_hospital_assignments");
  tableCounts["user_roles"] = roles_rows.length;
  tableCounts["user_departments"] = depts.length;
  tableCounts["user_hospital_assignments"] = hosps.length;
  await putFile("roles.json", JSON.stringify({ user_roles: roles_rows, user_departments: depts, user_hospital_assignments: hosps }));

  // Configurações
  await updateProgress(admin, jobId, "configurações", 80);
  const settings: Record<string, unknown> = {};
  for (const t of ["institution_branding", "hospital_units", "states", "system_maintenance_mode"]) {
    const rows = await dumpTableArray(admin, t);
    settings[t] = rows;
    tableCounts[t] = rows.length;
  }
  await putFile("settings.json", JSON.stringify(settings));

  // Auth users
  await updateProgress(admin, jobId, "usuários auth", 85);
  const authUsers: unknown[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`auth.listUsers: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) {
      authUsers.push({
        id: u.id, email: u.email, phone: u.phone,
        email_confirmed_at: u.email_confirmed_at, phone_confirmed_at: u.phone_confirmed_at,
        created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
        user_metadata: u.user_metadata, app_metadata: u.app_metadata,
        role: u.role, banned_until: (u as any).banned_until ?? null,
        is_sso_user: (u as any).is_sso_user ?? false,
      });
    }
    if (users.length < PAGE_SIZE) break;
    page++;
    if (page > 200) break;
  }
  await putFile("auth/users.json", JSON.stringify(authUsers));

  // Manifest
  await updateProgress(admin, jobId, "gerando manifesto", 95);
  const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0);
  const manifest = {
    backup_version: BACKUP_VERSION,
    backup_id: jobId,
    created_at: new Date().toISOString(),
    created_by: { id: userId, email: userEmail },
    source_instance: SUPABASE_URL,
    table_counts: tableCounts,
    database_records: totalRecords,
    auth_users: authUsers.length,
    include_audit_logs: includeAudit,
    reason,
    parts,
    total_bytes: totalBytes,
    notes: [
      "Backup v2.0 — arquivos separados. Use backup-download para gerar um ZIP único.",
      "DDL (schema) NÃO está incluso — a instância destino deve ter as mesmas migrations aplicadas.",
      "Hashes de senha NÃO são exportados; usuários restaurados recebem email de reset.",
      "MFA e identidades externas (Google/Apple) não são restauráveis via Admin API.",
    ],
  };
  const manifestStr = JSON.stringify(manifest, null, 2);
  const manifestBytes = new TextEncoder().encode(manifestStr);
  await admin.storage.from(BUCKET).upload(`${jobId}/manifest.json`, manifestBytes, { contentType: "application/json", upsert: true });

  const finishedAt = Date.now();
  await admin.from("backup_jobs").update({
    status: "completed",
    storage_path: `${jobId}/manifest.json`, // aponta pro manifest; download monta o ZIP
    file_size_bytes: totalBytes + manifestBytes.byteLength,
    manifest,
    table_counts: tableCounts,
    auth_user_count: authUsers.length,
    finished_at: new Date(finishedAt).toISOString(),
    duration_ms: finishedAt - startedAt,
    progress: { step: "concluído", percent: 100 },
  }).eq("id", jobId);

  await audit(admin, userId, userEmail, "BACKUP_CREATE_DONE", {
    backup_job_id: jobId, result: "success", duration_ms: finishedAt - startedAt,
    payload: { total_bytes: totalBytes, records: totalRecords, auth_users: authUsers.length, parts: parts.length },
    ip, userAgent,
  });
}

// Dump streaming → JSONL string (uma linha por registro)
async function dumpTableToJsonl(admin: any, table: string): Promise<{ content: string; count: number }> {
  const chunks: string[] = [];
  let from = 0;
  let count = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await admin.from(table).select("*").range(from, to);
    if (error) throw new Error(`dump ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) chunks.push(JSON.stringify(row));
    count += data.length;
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (from > 1_000_000) break;
  }
  return { content: chunks.join("\n"), count };
}

async function dumpTableArray(admin: any, table: string): Promise<any[]> {
  const out: any[] = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await admin.from(table).select("*").range(from, to);
    if (error) throw new Error(`dump ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (from > 1_000_000) break;
  }
  return out;
}

async function updateProgress(admin: any, jobId: string, step: string, percent: number, current?: number, total?: number) {
  await admin.from("backup_jobs").update({
    progress: { step, percent, current: current ?? null, total: total ?? null },
  }).eq("id", jobId);
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
