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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } =
      await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow admin OR gestor to reset passwords
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("access_profile, access_profiles")
      .eq("id", requestingUser.id)
      .maybeSingle();

    const roleSet = new Set((roles || []).map((r: any) => r.role));
    const profileSet = new Set<string>([
      ...(profile?.access_profile ? [profile.access_profile] : []),
      ...((profile?.access_profiles as string[] | null) || []),
    ]);

    const isAuthorized =
      roleSet.has("admin") ||
      profileSet.has("gestor") ||
      profileSet.has("admin");

    if (!isAuthorized) {
      console.error("Not authorized:", requestingUser.id);
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores ou gestores podem redefinir senhas." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { userId, newPassword, requestId } = body as {
      userId?: string;
      newPassword?: string;
      requestId?: string | null;
    };

    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ error: "userId e newPassword são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 6 || newPassword.length > 12) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter de 6 a 12 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If requestId provided, validate it (approved request flow)
    if (requestId) {
      const { data: resetRequest, error: requestError } = await supabaseAdmin
        .from("password_reset_requests")
        .select("*")
        .eq("id", requestId)
        .eq("user_id", userId)
        .eq("status", "approved")
        .maybeSingle();

      if (requestError || !resetRequest) {
        console.error("Reset request not found/approved:", requestError);
        return new Response(
          JSON.stringify({ error: "Solicitação de reset não encontrada ou não aprovada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Resetting password for ${userId} by ${requestingUser.id} (mode: ${requestId ? "approved-request" : "admin-direct"})`);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return new Response(
        JSON.stringify({ error: "Falha ao atualizar senha: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (requestId) {
      await supabaseAdmin
        .from("password_reset_requests")
        .update({
          status: "completed",
          new_password_set_at: new Date().toISOString(),
        })
        .eq("id", requestId);
    }

    // Audit
    try {
      await supabaseAdmin.from("user_admin_audit").insert({
        actor_id: requestingUser.id,
        target_user_id: userId,
        action: "password_reset",
        details: { mode: requestId ? "approved-request" : "admin-direct" },
      });
    } catch (auditErr) {
      console.warn("Audit insert failed (non-critical):", auditErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Senha redefinida com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
