// backup-import — Super Admin only.
// Importa um backup v3 (ZIP gerado pelo backup-create) extraído no cliente.
// O cliente envia manifest + cada part em chamadas separadas (chunked).
//
// Actions:
//   "init"     { manifest, original_reason? } -> { backup_id }
//   "part"     { backup_id, rel_path, content_b64? } -> { ok, bytes } ou { upload, token, path }
//   "finalize" { backup_id } -> { ok }

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

const contentTypeForPath = (relPath: string) => relPath.endsWith(".jsonl") ? "application/x-ndjson" :
  relPath.endsWith(".json") ? "application/json" : "application/octet-stream";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
  const action = String(body.action ?? "");

  try {
    if (action === "init")     return await handleInit(admin, body, userId, userEmail);
    if (action === "part")     return await handlePart(admin, body);
    if (action === "finalize") return await handleFinalize(admin, body, userId, userEmail);
    return json({ error: `action inválida: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[backup-import]", action, msg);
    return json({ error: msg }, 500);
  }
});

async function handleInit(admin: any, body: any, userId: string, userEmail: string | null) {
  const manifest = body.manifest;
  if (!manifest || typeof manifest !== "object") return json({ error: "manifest obrigatório" }, 400);
  if (!manifest.backup_version || !String(manifest.backup_version).startsWith("3.")) {
    return json({ error: `versão de backup não suportada: ${manifest.backup_version}` }, 400);
  }
  if (!Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    return json({ error: "manifest.parts inválido" }, 400);
  }

  // Cria novo job com novo UUID (independente do backup_id original do manifest)
  const originalId = manifest.backup_id ?? "?";
  const originalSource = manifest.source_instance ?? "?";
  const reason = `[IMPORTADO] de ${originalSource} · backup original ${String(originalId).slice(0, 8)}…`;

  const { data: job, error } = await admin.from("backup_jobs").insert({
    created_by: userId,
    created_by_email: userEmail,
    status: "running",
    started_at: new Date().toISOString(),
    source_instance: originalSource,
    reason,
    progress: { step: "importando", percent: 0, imported: true, original_backup_id: originalId, original_source: originalSource },
    table_counts: manifest.table_counts ?? null,
    auth_user_count: manifest.auth_users ?? 0,
  }).select().single();
  if (error || !job) return json({ error: `criar job: ${error?.message}` }, 500);

  // Reescreve manifest com o novo backup_id e marca como importado
  const newManifest = {
    ...manifest,
    backup_id: job.id,
    imported: true,
    original_backup_id: originalId,
    original_source_instance: originalSource,
    imported_at: new Date().toISOString(),
    imported_by: { id: userId, email: userEmail },
  };
  const mBytes = new TextEncoder().encode(JSON.stringify(newManifest, null, 2));
  const { error: upErr } = await admin.storage.from(BUCKET).upload(`${job.id}/manifest.json`, mBytes, {
    contentType: "application/json", upsert: true,
  });
  if (upErr) return json({ error: `upload manifest: ${upErr.message}` }, 500);

  await admin.from("backup_audit").insert({
    actor_id: userId, actor_email: userEmail, action: "BACKUP_IMPORT_START",
    backup_job_id: job.id, source_instance: SUPABASE_URL,
    payload: { original_backup_id: originalId, original_source: originalSource, total_parts: manifest.parts.length },
  }).then(() => {}, () => {});

  return json({ backup_id: job.id, total_parts: manifest.parts.length });
}

async function handlePart(admin: any, body: any) {
  const backupId = String(body.backup_id ?? "");
  const relPath = String(body.rel_path ?? "");
  const contentB64 = typeof body.content_b64 === "string" ? body.content_b64 : "";
  if (!backupId || !relPath) return json({ error: "backup_id+rel_path obrigatórios" }, 400);
  if (relPath.includes("..") || relPath.startsWith("/")) return json({ error: "rel_path inválido" }, 400);
  if (relPath === "manifest.json") return json({ error: "manifest.json é reservado" }, 400);

  const fullPath = `${backupId}/${relPath}`;
  if (!contentB64) {
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(fullPath, { upsert: true });
    if (error || !data) return json({ error: `url upload ${relPath}: ${error?.message}` }, 500);
    return json({ upload: true, token: data.token, path: fullPath, rel_path: relPath, content_type: contentTypeForPath(relPath) });
  }

  const bytes = b64ToBytes(contentB64);
  const { error } = await admin.storage.from(BUCKET).upload(fullPath, bytes, {
    contentType: contentTypeForPath(relPath), upsert: true,
  });
  if (error) return json({ error: `upload ${relPath}: ${error.message}` }, 500);
  return json({ ok: true, bytes: bytes.byteLength });
}

async function handleFinalize(admin: any, body: any, userId: string, userEmail: string | null) {
  const backupId = String(body.backup_id ?? "");
  if (!backupId) return json({ error: "backup_id obrigatório" }, 400);

  const { data: job } = await admin.from("backup_jobs").select("*").eq("id", backupId).maybeSingle();
  if (!job) return json({ error: "job não encontrado" }, 404);

  // Recarrega manifest para somar bytes totais
  const { data: mFile } = await admin.storage.from(BUCKET).download(`${backupId}/manifest.json`);
  let totalBytes = 0;
  if (mFile) {
    const m = JSON.parse(await mFile.text());
    totalBytes = (m.parts ?? []).reduce((a: number, p: any) => a + (p.bytes ?? 0), 0);
  }

  const finishedAt = new Date();
  const startedAtMs = job.started_at ? new Date(job.started_at).getTime() : finishedAt.getTime();
  await admin.from("backup_jobs").update({
    status: "completed",
    storage_path: `${backupId}/manifest.json`,
    file_size_bytes: totalBytes,
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAtMs,
    progress: { ...(job.progress ?? {}), step: "importado", percent: 100 },
  }).eq("id", backupId);

  await admin.from("backup_audit").insert({
    actor_id: userId, actor_email: userEmail, action: "BACKUP_IMPORT_DONE",
    backup_job_id: backupId, result: "success", source_instance: SUPABASE_URL,
  }).then(() => {}, () => {});

  return json({ ok: true });
}
