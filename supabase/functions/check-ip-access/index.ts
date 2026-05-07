import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user ?? null;

    if (!user) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "not_authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const moduleKey = String(body?.module ?? "").trim();
    if (!moduleKey) {
      return new Response(JSON.stringify({ allowed: false, reason: "missing_module" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = extractClientIp(req);
    const admin = createClient(supabaseUrl, serviceKey);

    // Carrega configuração do módulo
    const { data: settings } = await admin
      .from("module_ip_settings")
      .select("enforce, bypass_for_admin")
      .eq("module_key", moduleKey)
      .maybeSingle();

    const enforce = settings?.enforce ?? false;
    const bypassAdmin = settings?.bypass_for_admin ?? true;

    // Se não está em enforce, libera
    if (!enforce) {
      return new Response(
        JSON.stringify({ allowed: true, ip, reason: "not_enforced" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Bypass admin
    if (bypassAdmin) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      if (isAdmin) {
        return new Response(
          JSON.stringify({ allowed: true, ip, reason: "admin_bypass" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!ip) {
      await admin.from("ip_access_log").insert({
        module_key: moduleKey,
        ip: null,
        user_id: user.id,
        user_email: user.email,
        allowed: false,
        reason: "no_ip_detected",
      });
      return new Response(
        JSON.stringify({ allowed: false, ip: null, reason: "no_ip_detected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: allowedRow } = await admin.rpc("is_ip_allowed_for_module", {
      _module: moduleKey,
      _ip: ip,
    });
    const allowed = allowedRow === true;

    if (!allowed) {
      await admin.from("ip_access_log").insert({
        module_key: moduleKey,
        ip,
        user_id: user.id,
        user_email: user.email,
        allowed: false,
        reason: "ip_not_in_allowlist",
      });
    }

    return new Response(
      JSON.stringify({
        allowed,
        ip,
        reason: allowed ? "ip_allowed" : "ip_not_in_allowlist",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("check-ip-access error", e);
    return new Response(
      JSON.stringify({ allowed: false, reason: "internal_error", error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
