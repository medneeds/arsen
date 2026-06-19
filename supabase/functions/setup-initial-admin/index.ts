// Edge function: bootstrap do PRIMEIRO super_admin do sistema.
// Sem JWT — porém só funciona quando NÃO existe nenhum super_admin/admin.
// Após criado, qualquer chamada subsequente retorna 403.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    if (req.method === "GET") {
      const { count, error } = await admin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .in("role", ["super_admin", "admin"] as any);
      if (error) return json(500, { error: error.message });
      return json(200, { needsSetup: (count ?? 0) === 0 });
    }

    if (req.method !== "POST") return json(405, { error: "Método não permitido" });

    // Guard: já existe admin?
    const { count: existing, error: countErr } = await admin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .in("role", ["super_admin", "admin"] as any);
    if (countErr) return json(500, { error: countErr.message });
    if ((existing ?? 0) > 0) {
      return json(403, { error: "Setup já foi realizado. Contate um administrador existente." });
    }

    const { fullName, email, password } = (await req.json()) ?? {};
    if (!fullName || !email || !password) {
      return json(400, { error: "Campos obrigatórios: fullName, email, password" });
    }
    if (String(password).length < 6) {
      return json(400, { error: "Senha deve ter ao menos 6 caracteres" });
    }

    // 1) Criar usuário no Auth
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created.user) {
      return json(400, { error: createErr?.message ?? "Falha ao criar usuário" });
    }
    const userId = created.user.id;

    // 2) Profile (best-effort: pode existir via trigger)
    await admin.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      email,
      access_profile: "admin",
      access_profiles: ["admin"],
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: userId,
    }, { onConflict: "id" });

    // 3) Roles: super_admin + admin
    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert([
        { user_id: userId, role: "super_admin" as any },
        { user_id: userId, role: "admin" as any },
      ]);
    if (roleErr) {
      // Rollback: remove auth user para permitir nova tentativa
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return json(500, { error: `Falha ao atribuir papéis: ${roleErr.message}` });
    }

    // 4) Auditoria best-effort
    try {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? req.headers.get("cf-connecting-ip") ?? null;
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "SETUP_INITIAL_ADMIN",
        details: { email, fullName, ip } as any,
      });
    } catch (e) {
      console.warn("audit failed (non-blocking)", e);
    }

    return json(200, { success: true, userId });
  } catch (err) {
    console.error("setup-initial-admin error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
