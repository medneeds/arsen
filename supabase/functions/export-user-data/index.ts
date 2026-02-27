import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UserData {
  profile: Record<string, unknown> | null;
  consents: Record<string, unknown>[];
  data_requests: Record<string, unknown>[];
  audit_logs: Record<string, unknown>[];
  shift_handovers: Record<string, unknown>[];
  patients_created: Record<string, unknown>[];
  movements_created: Record<string, unknown>[];
  internment_requests: Record<string, unknown>[];
  export_metadata: {
    generated_at: string;
    user_id: string;
    format: string;
    lgpd_article: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the authorization header to identify the user
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

    // Create client with user's token to get their identity
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

    console.log(`Exporting data for user: ${user.id}`);

    // Use service role client to access all tables
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional request_id
    let requestId: string | null = null;
    try {
      const body = await req.json();
      requestId = body.request_id || null;
    } catch {
      // No body provided, that's fine
    }

    // Collect all user data
    const userData: UserData = {
      profile: null,
      consents: [],
      data_requests: [],
      audit_logs: [],
      shift_handovers: [],
      patients_created: [],
      movements_created: [],
      internment_requests: [],
      export_metadata: {
        generated_at: new Date().toISOString(),
        user_id: user.id,
        format: "JSON",
        lgpd_article: "Art. 18, V - Portabilidade de Dados",
      },
    };

    // 1. Profile data
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    userData.profile = profile;

    // 2. User consents
    const { data: consents } = await supabaseAdmin
      .from("user_consents")
      .select("*")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false });
    userData.consents = consents || [];

    // 3. Data requests history
    const { data: dataRequests } = await supabaseAdmin
      .from("data_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false });
    userData.data_requests = dataRequests || [];

    // 4. Audit logs (user's own actions)
    const { data: auditLogs } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000); // Limit to last 1000 entries
    userData.audit_logs = auditLogs || [];

    // 5. Shift handovers created by user
    const { data: handovers } = await supabaseAdmin
      .from("shift_handovers")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    userData.shift_handovers = handovers || [];

    // 6. Patients created by user
    const { data: patients } = await supabaseAdmin
      .from("patients")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    userData.patients_created = patients || [];

    // 7. Patient movements created by user
    const { data: movements } = await supabaseAdmin
      .from("patient_movements")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    userData.movements_created = movements || [];

    // 8. Internment requests created by user
    const { data: internmentRequests } = await supabaseAdmin
      .from("internment_requests")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    userData.internment_requests = internmentRequests || [];

    // Update the data request status if request_id was provided
    if (requestId) {
      await supabaseAdmin
        .from("data_requests")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          notes: "Dados exportados com sucesso via LGPD portability",
        })
        .eq("id", requestId)
        .eq("user_id", user.id);
    }

    console.log(`Data export completed for user: ${user.id}`);

    // Return the data as JSON
    return new Response(JSON.stringify(userData, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="dados-lgpd-${user.id.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Error exporting user data:", error);
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
