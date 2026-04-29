// Edge function: cria um novo usuário (admin/gestor only)
// Modos: 'password' (senha provisória) | 'invite' (magic link)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Perfis de acesso "globais" — ignoram seleção de setor
const GLOBAL_PROFILES = new Set(["gestor"]);
// Roles globais
const GLOBAL_ROLES = new Set(["admin"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autorizado" });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) return json(401, { error: "Token inválido" });

    // Guard: caller deve ser admin OU ter access_profile=gestor
    const [{ data: callerRoles }, { data: callerProfile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", caller.id),
      admin.from("profiles").select("access_profile").eq("id", caller.id).maybeSingle(),
    ]);
    const isAdmin = (callerRoles ?? []).some((r: { role: string }) => r.role === "admin");
    const isGestor = (callerProfile as { access_profile?: string } | null)?.access_profile === "gestor";
    if (!isAdmin && !isGestor) {
      return json(403, { error: "Acesso negado. Apenas admin/gestor podem cadastrar usuários." });
    }

    const body = await req.json();
    const {
      mode, // 'password' | 'invite'
      email,
      password,
      fullName,
      cpf,
      phone,
      crm,
      accessProfile,
      role,
      hospitalUnitId,
      departments = [], // array<string>
      redirectTo,
    } = body ?? {};

    // Validações
    if (!mode || !["password", "invite"].includes(mode)) return json(400, { error: "mode inválido" });
    if (!email || !fullName || !cpf || !phone || !hospitalUnitId) {
      return json(400, { error: "Campos obrigatórios: email, fullName, cpf, phone, hospitalUnitId" });
    }
    if (mode === "password" && (!password || String(password).length < 8)) {
      return json(400, { error: "Senha provisória deve ter ao menos 8 caracteres" });
    }
    const profile = accessProfile ?? "medico";
    const appRole = role ?? "medico";
    const isGlobal = GLOBAL_PROFILES.has(profile) || GLOBAL_ROLES.has(appRole);

    // Perfis globais NUNCA recebem setores específicos — limpa silenciosamente
    const effectiveDepartments: string[] = isGlobal ? [] : (Array.isArray(departments) ? departments : []);

    if (!isGlobal && effectiveDepartments.length === 0) {
      return json(400, { error: "Selecione ao menos um setor (perfis não-globais)." });
    }

    // Se o caller é gestor (não admin), validar escopo: hospitalUnitId precisa
    // estar entre as unidades do gestor.
    if (!isAdmin && isGestor) {
      const { data: callerUnits } = await admin
        .from("user_hospital_assignments")
        .select("hospital_unit_id")
        .eq("user_id", caller.id);
      const allowedUnits = new Set((callerUnits ?? []).map((u: { hospital_unit_id: string }) => u.hospital_unit_id));
      if (!allowedUnits.has(hospitalUnitId)) {
        return json(403, { error: "Você não tem permissão para cadastrar usuários nesta unidade hospitalar." });
      }
    }

    // CPF unique check
    const cpfDigits = String(cpf).replace(/\D/g, "");
    if (cpfDigits.length !== 11) return json(400, { error: "CPF inválido" });
    const { data: cpfDup } = await admin
      .from("profiles")
      .select("id")
      .eq("cpf", cpfDigits)
      .maybeSingle();
    if (cpfDup) return json(409, { error: "CPF já cadastrado no sistema." });

    // 1) Criar usuário no Auth
    let userId: string;
    if (mode === "password") {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // acesso imediato
        user_metadata: { full_name: fullName, crm, must_change_password: true },
      });
      if (error || !data.user) return json(400, { error: error?.message ?? "Falha ao criar usuário" });
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectTo || undefined,
        data: { full_name: fullName, crm },
      });
      if (error || !data.user) return json(400, { error: error?.message ?? "Falha ao enviar convite" });
      userId = data.user.id;
    }

    // 2) Upsert profile (trigger handle_new_user pode já ter criado linha)
    const { error: profErr } = await admin.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      email,
      cpf: cpfDigits,
      phone,
      crm: crm || null,
      access_profile: profile,
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: caller.id,
    }, { onConflict: "id" });
    if (profErr) console.error("profile upsert", profErr);

    // 3) Role
    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role: appRole });
    if (roleErr) console.error("role insert", roleErr);

    // 4) Hospital assignment
    await admin.from("user_hospital_assignments").delete().eq("user_id", userId);
    await admin.from("user_hospital_assignments").insert({ user_id: userId, hospital_unit_id: hospitalUnitId });

    // 5) Setores (apenas se não-global)
    await admin.from("user_departments").delete().eq("user_id", userId);
    if (!isGlobal && effectiveDepartments.length > 0) {
      const rows = effectiveDepartments.map((d: string) => ({ user_id: userId, department: d }));
      const { error: depErr } = await admin.from("user_departments").insert(rows);
      if (depErr) console.error("departments insert", depErr);
    }

    // 6) Auditoria — registra ação administrativa (não bloqueante)
    try {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("cf-connecting-ip")
        || null;
      const ua = req.headers.get("user-agent") ?? null;
      const callerName = (callerProfile as { full_name?: string } | null)?.full_name ?? null;
      await admin.from("user_admin_audit").insert({
        actor_id: caller.id,
        actor_email: caller.email ?? null,
        actor_name: callerName,
        target_user_id: userId,
        target_email: email,
        target_name: fullName,
        action: mode === "password" ? "user.created.password" : "user.created.invite",
        hospital_unit_id: hospitalUnitId,
        access_profile: profile,
        app_role: appRole,
        departments: effectiveDepartments,
        new_data: {
          mode,
          fullName,
          email,
          cpf: cpfDigits,
          phone,
          crm: crm || null,
          accessProfile: profile,
          role: appRole,
          hospitalUnitId,
          departments: effectiveDepartments,
          isGlobal,
        },
        metadata: { source: "admin-create-user" },
        ip_address: ip,
        user_agent: ua,
      });
    } catch (auditErr) {
      console.error("audit insert failed (non-blocking)", auditErr);
    }

    return json(200, { success: true, userId, mode });
  } catch (err) {
    console.error("admin-create-user error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
