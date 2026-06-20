// Edge function: bootstrap do PRIMEIRO super_admin do sistema.
// Sem JWT — porém só funciona quando NÃO existe nenhum super_admin/admin.
// Após criado, qualquer chamada subsequente retorna 403.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    if (req.method === "GET") {
      // Por decisão do owner: setup permanece aberto para criar novos super_admins
      // mesmo com admins já existentes. Mantém formulário sempre disponível.
      return json(200, { needsSetup: true });
    }

    if (req.method !== "POST") return json(405, { error: "Método não permitido" });

    // Guard removido a pedido do owner — /setup pode criar novos super_admins
    // mesmo com admins existentes. ATENÇÃO: rota pública, qualquer um com a URL
    // consegue criar super_admin. Considere proteger por IP allowlist ou desativar
    // quando não estiver em uso.

    const { fullName, email, password } = (await req.json()) ?? {};
    if (!fullName || !email || !password) {
      return json(400, { error: "Campos obrigatórios: fullName, email, password" });
    }
    if (String(password).length < 6) {
      return json(400, { error: "Senha deve ter ao menos 6 caracteres" });
    }

    // 1) Criar (ou reaproveitar) usuário no Auth
    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created?.user) {
      // Se já existe, localiza por e-mail e atualiza senha/metadados
      const msg = (createErr?.message ?? "").toLowerCase();
      const alreadyExists = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!alreadyExists) {
        return json(400, { error: createErr?.message ?? "Falha ao criar usuário" });
      }
      // listUsers paginado — busca pelo email
      let found: { id: string } | null = null;
      for (let page = 1; page <= 20 && !found; page++) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) return json(500, { error: `Falha ao localizar usuário: ${listErr.message}` });
        const u = list.users.find((x) => (x.email ?? "").toLowerCase() === String(email).toLowerCase());
        if (u) found = { id: u.id };
        if (list.users.length < 200) break;
      }
      if (!found) return json(400, { error: "Usuário já existe mas não foi possível localizá-lo" });
      const { error: updErr } = await admin.auth.admin.updateUserById(found.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (updErr) return json(400, { error: `Falha ao atualizar usuário existente: ${updErr.message}` });
      userId = found.id;
    } else {
      userId = created.user.id;
    }

    // 2) Profile — super_admin criado pelo /setup NÃO passa por aprovação.
    // Faz upsert + UPDATE explícito para garantir status=approved mesmo quando
    // o trigger handle_new_user já criou a linha com default status='pending'.
    await admin.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      email,
      access_profile: "desenvolvedor",
      access_profiles: ["desenvolvedor"],
      status: "approved",
      must_change_password: false,
      approved_at: new Date().toISOString(),
      approved_by: userId,
    }, { onConflict: "id" });
    // Garantia extra: força os campos críticos mesmo se o upsert tiver caído
    // em modo "insert ignore" por algum trigger/constraint.
    const { error: forceErr } = await admin
      .from("profiles")
      .update({
        status: "approved",
        access_profile: "desenvolvedor",
        access_profiles: ["desenvolvedor"],
        must_change_password: false,
        approved_at: new Date().toISOString(),
        approved_by: userId,
        full_name: fullName,
        email,
      })
      .eq("id", userId);
    if (forceErr) {
      console.warn("force-approve profile failed (non-blocking)", forceErr);
    }

    // 3) Roles: super_admin + admin
    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert([
        { user_id: userId, role: "super_admin" as any },
        { user_id: userId, role: "admin" as any },
      ]);
    if (roleErr) {
      // Rollback: remove auth user para permitir nova tentativa
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return json(500, { error: `Falha ao atribuir papéis: ${roleErr.message}` });
    }

    // 4) Auditoria best-effort
    try {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? req.headers.get("cf-connecting-ip") ?? null;
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "SETUP_INITIAL_ADMIN",
        details: { email, fullName, ip } as any,
      });
    } catch (e) {
      console.warn("audit failed (non-blocking)", e);
    }

    return json(200, { success: true, userId });
  } catch (err) {
    console.error("setup-initial-admin error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
