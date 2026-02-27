import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Legacy users configuration
const LEGACY_USERS = [
  { name: "MEDICOPORTA", email: "medicoporta@sistema.local", role: "porta", department: "URGÊNCIA E EMERGÊNCIA ADULTO" },
  { name: "LIDER", email: "lider@sistema.local", role: "medico", department: "URGÊNCIA E EMERGÊNCIA ADULTO" },
  { name: "VISITANTE", email: "visitante@sistema.local", role: "visitante", department: null },
  { name: "MEDICOUTI", email: "medicouti@sistema.local", role: "medico", department: "UTI" },
  { name: "LIDERPED", email: "liderped@sistema.local", role: "medico", department: "URGÊNCIA E EMERGÊNCIA PEDIÁTRICA" },
  { name: "COORDENADOR", email: "coordenador@sistema.local", role: "admin", department: null },
];

Deno.serve(async (req) => {
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

    let newPassword = "HAPVID";
    try {
      const body = await req.json();
      if (body.password) {
        newPassword = body.password;
      }
    } catch {
      // Use default
    }

    const passwordRegex = /^[A-Z0-9]{6}$/;
    if (!passwordRegex.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter exatamente 6 caracteres alfanuméricos maiúsculos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting legacy user password reset with password:", newPassword);

    // Get default hospital unit
    const { data: hospitalUnit } = await supabaseAdmin
      .from("hospital_units")
      .select("id, state_id")
      .limit(1)
      .single();

    const results: { name: string; success: boolean; error?: string; action?: string; userId?: string }[] = [];

    for (const legacyUser of LEGACY_USERS) {
      console.log(`Processing user: ${legacyUser.name} (${legacyUser.email})`);

      // Use the database function to update password directly
      const { data: updateResult, error: updateError } = await supabaseAdmin
        .rpc("admin_update_user_password", {
          p_email: legacyUser.email,
          p_new_password: newPassword
        });

      if (updateError) {
        console.error(`RPC error for ${legacyUser.name}:`, updateError);
        results.push({ 
          name: legacyUser.name, 
          success: false, 
          error: updateError.message,
          action: "rpc_error"
        });
        continue;
      }

      console.log(`Update result for ${legacyUser.name}:`, updateResult);

      if (!updateResult?.success) {
        console.error(`Password update failed for ${legacyUser.name}:`, updateResult?.error);
        results.push({ 
          name: legacyUser.name, 
          success: false, 
          error: updateResult?.error || "Unknown error",
          action: "update_failed"
        });
        continue;
      }

      const userId = updateResult.user_id;
      console.log(`Password updated for ${legacyUser.name}, user_id: ${userId}`);

      // Update profile
      await supabaseAdmin
        .from("profiles")
        .upsert({ 
          id: userId,
          status: "approved",
          full_name: legacyUser.name
        }, { onConflict: "id" });

      // Set role
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: legacyUser.role });

      // Set department
      await supabaseAdmin.from("user_departments").delete().eq("user_id", userId);
      if (legacyUser.department) {
        await supabaseAdmin.from("user_departments").insert({ 
          user_id: userId, 
          department: legacyUser.department 
        });
      }

      // Set hospital assignment
      if (hospitalUnit) {
        await supabaseAdmin.from("user_hospital_assignments").delete().eq("user_id", userId);
        await supabaseAdmin.from("user_hospital_assignments").insert({ 
          user_id: userId, 
          hospital_unit_id: hospitalUnit.id 
        });
      }

      results.push({ 
        name: legacyUser.name, 
        success: true, 
        action: "password_updated",
        userId 
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Setup completed: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Usuários configurados: ${successCount} sucesso, ${failCount} falha`,
        newPassword,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor: " + (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
