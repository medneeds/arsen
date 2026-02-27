import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create client with user's token
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { request_id, action } = body;

    if (!request_id || !action) {
      return new Response(
        JSON.stringify({ error: "request_id and action are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing data deletion request: ${request_id} for user: ${user.id}`);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the request belongs to the user and is pending
    const { data: existingRequest, error: requestError } = await supabaseAdmin
      .from("data_requests")
      .select("*")
      .eq("id", request_id)
      .eq("user_id", user.id)
      .single();

    if (requestError || !existingRequest) {
      return new Response(
        JSON.stringify({ error: "Request not found or unauthorized" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "request_deletion") {
      // Create a new deletion request
      const { error: insertError } = await supabaseAdmin
        .from("data_requests")
        .insert({
          user_id: user.id,
          request_type: "deletion",
          status: "pending",
          notes: "Solicitação de exclusão de dados conforme Art. 18, VI LGPD",
        });

      if (insertError) {
        throw insertError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Solicitação de exclusão registrada. Será analisada pela equipe.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "process_deletion") {
      // This action should only be available to admins
      // Check if user is admin
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!roleData || roleData.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Unauthorized - Admin access required" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const targetUserId = existingRequest.user_id;

      // Anonymize user data instead of full deletion (preserves audit trail)
      const anonymizedData = {
        full_name: "DADOS_ANONIMIZADOS",
        email: null,
        phone: null,
        crm: null,
        specialty: null,
        data_deletion_requested_at: new Date().toISOString(),
      };

      // 1. Anonymize profile
      await supabaseAdmin
        .from("profiles")
        .update(anonymizedData)
        .eq("id", targetUserId);

      // 2. Mark user consents as revoked
      await supabaseAdmin
        .from("user_consents")
        .update({
          revoked_at: new Date().toISOString(),
          revoked_reason: "Exclusão de dados solicitada pelo titular (Art. 18 LGPD)",
        })
        .eq("user_id", targetUserId);

      // 3. Update audit logs to anonymize user info (keep the log structure)
      await supabaseAdmin
        .from("audit_logs")
        .update({
          user_email: "anonimizado@sistema.local",
        })
        .eq("user_id", targetUserId);

      // 4. Update the deletion request
      await supabaseAdmin
        .from("data_requests")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          notes: "Dados anonimizados conforme Art. 18, VI LGPD. Registros de auditoria preservados conforme CFM 1.821/2007.",
        })
        .eq("id", request_id);

      console.log(`Data anonymization completed for user: ${targetUserId}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Dados do usuário anonimizados com sucesso. Registros de auditoria preservados conforme legislação.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing data deletion:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
