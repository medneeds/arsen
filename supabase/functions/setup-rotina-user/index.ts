import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user already exists
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

    // Create user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: "rotina@sistema.local",
      password: "GIRAFA",
      email_confirm: true,
      user_metadata: {
        full_name: "ROTINA UTI 2",
        username: "ROTINA",
        role: "medico",
      },
    });

    if (createError) {
      throw createError;
    }

    const userId = newUser.user.id;

    // Assign hospital
    await supabase.from("user_hospital_assignments").insert({
      user_id: userId,
      hospital_unit_id: "8297082d-bd9e-40da-a08b-8e3c0e53209f",
    });

    // Assign UTI department
    await supabase.from("user_departments").insert({
      user_id: userId,
      department: "UTI",
    });

    // Update profile status to approved
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
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
