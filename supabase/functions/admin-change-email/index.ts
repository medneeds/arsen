import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: actor }, error: authError } =
      await admin.auth.getUser(token);
    if (authError || !actor) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Autorização: admin (role) ou gestor/admin (access_profile / access_profiles)
    const [{ data: roles }, { data: actorProfile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", actor.id),
      admin
        .from("profiles")
        .select("access_profile, access_profiles, full_name")
        .eq("id", actor.id)
        .maybeSingle(),
    ]);

    const roleSet = new Set((roles || []).map((r: any) => r.role));
    const profileSet = new Set<string>([
      ...(actorProfile?.access_profile ? [actorProfile.access_profile] : []),
      ...((actorProfile?.access_profiles as string[] | null) || []),
    ]);
    const isAuthorized =
      roleSet.has("admin") ||
      profileSet.has("gestor") ||
      profileSet.has("admin");

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          error:
            "Acesso negado. Apenas administradores ou gestores podem alterar e-mails.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { userId, newEmail, reason } = body as {
      userId?: string;
      newEmail?: string;
      reason?: string;
    };

    if (!userId || !newEmail) {
      return new Response(
        JSON.stringify({ error: "userId e newEmail são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalized = String(newEmail).trim().toLowerCase();
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(normalized)) {
      return new Response(JSON.stringify({ error: "E-mail inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Snapshot anterior
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();

    const oldEmail = targetProfile?.email ?? null;

    if (oldEmail && oldEmail.toLowerCase() === normalized) {
      return new Response(
        JSON.stringify({ error: "O novo e-mail é igual ao atual" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Atualiza no Auth (confirma e-mail para evitar fluxo de verificação)
    const { error: updateError } = await admin.auth.admin.updateUserById(
      userId,
      { email: normalized, email_confirm: true }
    );

    if (updateError) {
      console.error("Falha auth.updateUserById:", updateError);
      return new Response(
        JSON.stringify({
          error: "Falha ao atualizar e-mail: " + updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Atualiza profiles.email para manter consistência
    await admin
      .from("profiles")
      .update({ email: normalized })
      .eq("id", userId);

    // Auditoria
    try {
      await admin.from("user_admin_audit").insert({
        actor_id: actor.id,
        actor_email: actor.email,
        actor_name: actorProfile?.full_name ?? null,
        target_user_id: userId,
        target_email: normalized,
        target_name: targetProfile?.full_name ?? null,
        action: "UPDATE_EMAIL",
        old_data: { email: oldEmail },
        new_data: { email: normalized },
        metadata: {
          source: "admin-change-email",
          reason: reason ?? null,
        },
      });
    } catch (auditErr) {
      console.warn("Audit insert failed (non-critical):", auditErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "E-mail atualizado com sucesso",
        oldEmail,
        newEmail: normalized,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
