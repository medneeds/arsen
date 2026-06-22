// backup-download — Admin / Super Admin only.
// Retorna URLs assinadas (1h) para o manifest + cada part do backup.
// O cliente baixa e monta o ZIP localmente — evita timeout/broken pipe da edge function.
//
// Body: { backup_id: string }
// Resp: { files: [{ rel: string, url: string, bytes: number }] }

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
const SIGNED_TTL = 60 * 60; // 1h

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

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const allowed = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "super_admin");
  if (!allowed) return json({ error: "Acesso restrito a administradores" }, 403);

  let body: { backup_id?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  const backupId = body.backup_id;
  if (!backupId || !/^[0-9a-f-]{36}$/i.test(backupId)) return json({ error: "backup_id inválido" }, 400);

  // Lê manifest
  const { data: manifestBlob, error: manErr } = await admin.storage.from(BUCKET).download(`${backupId}/manifest.json`);
  if (manErr || !manifestBlob) return json({ error: `manifest não encontrado: ${manErr?.message ?? "?"}` }, 404);
  const manifest = JSON.parse(await manifestBlob.text()) as { parts: { path: string; bytes: number }[] };

  const entries: { rel: string; storagePath: string; bytes: number }[] = [
    { rel: "manifest.json", storagePath: `${backupId}/manifest.json`, bytes: manifestBlob.size },
    ...manifest.parts.map((p) => ({ rel: p.path, storagePath: `${backupId}/${p.path}`, bytes: p.bytes })),
  ];

  // Gera URLs assinadas em lote
  const paths = entries.map((e) => e.storagePath);
  const { data: signed, error: sErr } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
  if (sErr || !signed) return json({ error: `signed urls: ${sErr?.message ?? "?"}` }, 500);

  const byPath = new Map(signed.map((s: any) => [s.path, s.signedUrl]));
  const files = entries.map((e) => ({
    rel: e.rel,
    bytes: e.bytes,
    url: byPath.get(e.storagePath) ?? null,
  })).filter((f) => f.url);

  // Auditoria best-effort
  admin.from("backup_audit").insert({
    actor_id: userId,
    actor_email: udata.user.email ?? null,
    action: "BACKUP_DOWNLOAD",
    backup_job_id: backupId,
    result: "success",
    source_instance: SUPABASE_URL,
  }).then(() => {}, () => {});

  return json({ backup_id: backupId, file_count: files.length, files });
});
