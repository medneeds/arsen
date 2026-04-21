// Dev Console — operational endpoints (read metrics, list logs, run safe ops).
// All endpoints require the caller to have role 'dev' or 'admin' in user_roles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);
    const jwt = authHeader.replace("Bearer ", "");
    const supaAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await supaAuth.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // 2. Check role: must be dev or admin
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await supa
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = (roles ?? []).some((r) =>
      ["dev", "admin"].includes(r.role as string),
    );
    if (!allowed) return json({ error: "Forbidden — dev role required" }, 403);

    // 3. Route by action
    const { action, params = {}, confirm = false } = await req.json();

    switch (action) {
      // ---- READ: metrics ----
      case "system_health": {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const [
          { count: activePatients },
          { count: prescriptions24h },
          { count: admissions24h },
          { count: errors24h },
          { count: usersTotal },
        ] = await Promise.all([
          supa.from("patients").select("id", { count: "exact", head: true }).eq("is_vacant", false),
          supa.from("prescriptions").select("id", { count: "exact", head: true }).gte("created_at", since24h),
          supa.from("patient_encounters").select("id", { count: "exact", head: true }).gte("created_at", since24h),
          supa.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", since24h).eq("action", "DELETE"),
          supa.from("profiles").select("id", { count: "exact", head: true }),
        ]);
        return json({
          activePatients: activePatients ?? 0,
          prescriptions24h: prescriptions24h ?? 0,
          admissions24h: admissions24h ?? 0,
          deletes24h: errors24h ?? 0,
          usersTotal: usersTotal ?? 0,
          checkedAt: new Date().toISOString(),
        });
      }

      case "audit_recent": {
        const limit = Math.min(Number(params.limit ?? 50), 200);
        const { data, error } = await supa
          .from("audit_logs")
          .select("id, action, table_name, user_email, user_role, created_at, record_id, changed_fields")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return json({ error: error.message }, 500);
        return json({ logs: data ?? [] });
      }

      case "user_activity": {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supa
          .from("audit_logs")
          .select("user_email, action, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) return json({ error: error.message }, 500);
        // Aggregate by user
        const byUser: Record<string, number> = {};
        for (const r of data ?? []) {
          if (!r.user_email) continue;
          byUser[r.user_email] = (byUser[r.user_email] ?? 0) + 1;
        }
        const top = Object.entries(byUser)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([email, count]) => ({ email, count }));
        return json({ topUsers: top, totalEvents: (data ?? []).length });
      }

      case "clinical_volume": {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [{ data: encounters }, { data: prescriptions }, { data: evolutions }] =
          await Promise.all([
            supa.from("patient_encounters").select("created_at").gte("created_at", since),
            supa.from("prescriptions").select("created_at").gte("created_at", since),
            supa.from("clinical_evolutions").select("created_at").gte("created_at", since),
          ]);
        const buckets: Record<string, { encounters: number; prescriptions: number; evolutions: number }> = {};
        const day = (d: string) => d.substring(0, 10);
        for (let i = 0; i < 7; i++) {
          const k = new Date(Date.now() - i * 86400000).toISOString().substring(0, 10);
          buckets[k] = { encounters: 0, prescriptions: 0, evolutions: 0 };
        }
        (encounters ?? []).forEach((r) => buckets[day(r.created_at)] && (buckets[day(r.created_at)].encounters++));
        (prescriptions ?? []).forEach((r) => buckets[day(r.created_at)] && (buckets[day(r.created_at)].prescriptions++));
        (evolutions ?? []).forEach((r) => buckets[day(r.created_at)] && (buckets[day(r.created_at)].evolutions++));
        const series = Object.entries(buckets)
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([date, v]) => ({ date, ...v }));
        return json({ series });
      }

      case "list_users": {
        const { data, error } = await supa
          .from("profiles")
          .select("id, email, full_name, created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return json({ error: error.message }, 500);
        // Pull roles too
        const { data: rolesData } = await supa.from("user_roles").select("user_id, role");
        const rolesByUser: Record<string, string[]> = {};
        (rolesData ?? []).forEach((r) => {
          rolesByUser[r.user_id] = rolesByUser[r.user_id] ?? [];
          rolesByUser[r.user_id].push(r.role as string);
        });
        const users = (data ?? []).map((u) => ({ ...u, roles: rolesByUser[u.id] ?? [] }));
        return json({ users });
      }

      case "db_table_sizes": {
        // Query metadata only — counts of rows per business table.
        const tables = [
          "patients", "patient_registry", "patient_encounters",
          "prescriptions", "clinical_evolutions", "exam_requests",
          "culture_results", "audit_logs", "patient_movements",
        ];
        const results: Record<string, number> = {};
        await Promise.all(
          tables.map(async (t) => {
            const { count } = await supa.from(t).select("id", { count: "exact", head: true });
            results[t] = count ?? 0;
          }),
        );
        return json({ tables: results });
      }

      // ---- SENSITIVE: require confirm: true ----
      case "grant_dev_role": {
        if (!confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);
        const targetEmail = String(params.email ?? "").trim();
        if (!targetEmail) return json({ error: "email required" }, 400);
        const { data: target } = await supa.rpc("get_auth_user_id_by_email", { p_email: targetEmail });
        if (!target) return json({ error: "User not found" }, 404);
        const { error } = await supa.from("user_roles").insert({ user_id: target, role: "dev" });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, message: `Role 'dev' concedida a ${targetEmail}` });
      }

      case "revoke_dev_role": {
        if (!confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);
        const targetEmail = String(params.email ?? "").trim();
        if (!targetEmail) return json({ error: "email required" }, 400);
        const { data: target } = await supa.rpc("get_auth_user_id_by_email", { p_email: targetEmail });
        if (!target) return json({ error: "User not found" }, 404);
        const { error } = await supa.from("user_roles").delete().eq("user_id", target).eq("role", "dev");
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, message: `Role 'dev' revogada de ${targetEmail}` });
      }

      case "force_password_reset": {
        if (!confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);
        const targetEmail = String(params.email ?? "").trim();
        const newPassword = String(params.newPassword ?? "").trim();
        if (!targetEmail || newPassword.length < 8) return json({ error: "email and newPassword (min 8) required" }, 400);
        const { data, error } = await supa.rpc("admin_update_user_password", {
          p_email: targetEmail,
          p_new_password: newPassword,
        });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, result: data });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[dev-console-ops]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
