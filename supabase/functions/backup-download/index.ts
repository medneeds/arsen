// backup-download — Admin / Super Admin only.
// Lê os arquivos de um job (prefixo `${jobId}/` no bucket db-backups) e devolve
// um ZIP único streamado. Sem ZIP em memória — usa fflate.Zip streaming.
//
// Body: { backup_id: string }

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { Zip, ZipPassThrough } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "db-backups";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const token = authHeader.replace("Bearer ", "");
  const { data: udata, error: uerr } = await userClient.auth.getUser(token);
  if (uerr || !udata?.user?.id) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userId = udata.user.id;

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const allowed = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "super_admin");
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: { backup_id?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  const backupId = body.backup_id;
  if (!backupId || !/^[0-9a-f-]{36}$/i.test(backupId)) {
    return new Response(JSON.stringify({ error: "backup_id inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Lê manifest pra obter lista de partes
  const { data: manifestBlob, error: manErr } = await admin.storage.from(BUCKET).download(`${backupId}/manifest.json`);
  if (manErr || !manifestBlob) {
    return new Response(JSON.stringify({ error: `manifest não encontrado: ${manErr?.message ?? "?"}` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const manifestStr = await manifestBlob.text();
  const manifest = JSON.parse(manifestStr) as { parts: { path: string; bytes: number }[] };

  const files: { rel: string; storagePath: string }[] = [
    { rel: "manifest.json", storagePath: `${backupId}/manifest.json` },
    ...manifest.parts.map((p) => ({ rel: p.path, storagePath: `${backupId}/${p.path}` })),
  ];

  // Stream ZIP via fflate.Zip → ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const zip = new Zip((err, dat, final) => {
        if (err) { controller.error(err); return; }
        controller.enqueue(dat);
        if (final) controller.close();
      });

      try {
        for (const f of files) {
          const { data: blob, error } = await admin.storage.from(BUCKET).download(f.storagePath);
          if (error || !blob) throw new Error(`download ${f.storagePath}: ${error?.message ?? "vazio"}`);
          const entry = new ZipPassThrough(f.rel); // sem compressão: CPU/memória mínimos
          zip.add(entry);
          // Streama o blob em chunks de 256 KB
          const reader = blob.stream().getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            entry.push(value, false);
          }
          entry.push(new Uint8Array(0), true);
        }
        zip.end();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  // Auditoria best-effort
  admin.from("backup_audit").insert({
    actor_id: userId,
    actor_email: udata.user.email ?? null,
    action: "BACKUP_DOWNLOAD",
    backup_job_id: backupId,
    result: "success",
    source_instance: SUPABASE_URL,
  }).then(() => {}, () => {});

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="backup-${backupId}.zip"`,
      "Cache-Control": "no-store",
    },
  });
});
