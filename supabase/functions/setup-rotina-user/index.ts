import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cria/garante o usuário de sistema "rotina@sistema.local".
 *
 * SEGURANÇA: a senha é lida exclusivamente do segredo `ROTINA_USER_PASSWORD`.
 * Nunca há senha em código. Apenas admins autenticados podem invocar.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const rotinaPassword = Deno.env.get("ROTINA_USER_PASSWORD");

    if (!rotinaPassword || rotinaPassword.length < 16) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "ROTINA_USER_PASSWORD não configurado (ou muito curto). Defina o segredo antes de executar.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Exige caller autenticado e com role admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(token);
    if (!u?.user) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", u.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin")) {
      return new Response(JSON.stringify({ success: false, error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se já existe, apenas confirma
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email === "rotina@sistema.local"
    );

    if (existingUser) {
      return new Response(
        JSON.stringify({ success: true, message: "User already exists", user_id: existingUser.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: "rotina@sistema.local",
      password: rotinaPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "ROTINA UTI 2",
        username: "ROTINA",
        role: "medico",
      },
    });

    if (createError) throw createError;

    const userId = newUser.user.id;

    await supabase.from("user_hospital_assignments").insert({
      user_id: userId,
      hospital_unit_id: "8297082d-bd9e-40da-a08b-8e3c0e53209f",
    });

    await supabase.from("user_departments").insert({
      user_id: userId,
      department: "UTI",
    });

    await supabase.from("profiles").update({
      status: "approved",
      approved_at: new Date().toISOString(),
    }).eq("id", userId);

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
