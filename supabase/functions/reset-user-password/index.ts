import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the JWT token and verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      console.error("Role check failed:", roleError);
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas coordenadores podem redefinir senhas." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { userId, newPassword, requestId } = await req.json();

    if (!userId || !newPassword || !requestId) {
      console.error("Missing required fields:", { userId: !!userId, newPassword: !!newPassword, requestId: !!requestId });
      return new Response(
        JSON.stringify({ error: "userId, newPassword e requestId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password format (6 chars, alphanumeric, uppercase only)
    const passwordRegex = /^[A-Z0-9]{6}$/;
    if (!passwordRegex.test(newPassword)) {
      console.error("Invalid password format");
      return new Response(
        JSON.stringify({ error: "Senha deve ter exatamente 6 caracteres alfanuméricos maiúsculos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the reset request exists and is pending
    const { data: resetRequest, error: requestError } = await supabaseAdmin
      .from("password_reset_requests")
      .select("*")
      .eq("id", requestId)
      .eq("user_id", userId)
      .eq("status", "approved")
      .single();

    if (requestError || !resetRequest) {
      console.error("Reset request not found or not approved:", requestError);
      return new Response(
        JSON.stringify({ error: "Solicitação de reset não encontrada ou não aprovada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Resetting password for user ${userId} by admin ${requestingUser.id}`);

    // Update the user's password using admin API
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

    // Update the reset request status to completed
    const { error: statusError } = await supabaseAdmin
      .from("password_reset_requests")
      .update({
        status: "completed",
        new_password_set_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (statusError) {
      console.error("Failed to update request status:", statusError);
      // Password was changed, but status update failed - not critical
    }

    console.log(`Password reset completed successfully for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Senha redefinida com sucesso" 
      }),
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
