// Edge function: super_admin cria um hospital + o admin responsável.
//
// Por que Edge Function e não supabase-js no cliente:
//   criar a conta de auth do admin exige service_role (auth.admin.createUser),
//   que NUNCA pode ir para o frontend. Aqui roda server-side.
//
// Fluxo:
//   1. Autentica o chamador pelo JWT e confirma que é super_admin (RPC eh_super_admin).
//   2. Cria a conta do admin no Auth com senha provisória (email_confirm:true).
//      → createUser (não invite): a instância está com SMTP fake, então o link de
//        convite por e-mail não seria entregue. A senha provisória volta no response
//        para o super_admin repassar; o admin troca no primeiro acesso.
//   3. Chama a RPC criar_hospital_com_admin, que insere em hospitais + profissionais
//      numa transação só.
//   4. Se a RPC falhar depois do createUser, remove a conta órfã (rollback).
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

// Senha provisória forte (12 chars, com letra, dígito e símbolo garantidos).
function gerarSenhaProvisoria(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const rnd = (set: string) => set[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * set.length)];
  const base = [rnd(upper), rnd(lower), rnd(digits), rnd(symbols)];
  while (base.length < 12) base.push(rnd(all));
  // embaralha
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1) Autentica o chamador
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autorizado" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) return json(401, { error: "Token inválido" });

    // Cliente com a IDENTIDADE do chamador (JWT do super_admin). A RPC
    // criar_hospital_com_admin checa auth.uid() internamente — chamada via
    // service_role, auth.uid() é NULL e ela recusa. createUser fica no service_role.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    // Guard: apenas super_admin. eh_super_admin lê a tabela profissionais (SECURITY DEFINER).
    const { data: isSuper, error: superErr } = await admin.rpc("eh_super_admin", { _user_id: caller.id });
    if (superErr) return json(500, { error: `Falha ao verificar papel: ${superErr.message}` });
    if (!isSuper) return json(403, { error: "Acesso negado — apenas o super_admin pode cadastrar hospitais." });

    // 2) Valida entrada
    const body = await req.json().catch(() => ({}));
    const nomeHospital = String(body?.nomeHospital ?? "").trim();
    const cnpjDigits = String(body?.cnpj ?? "").replace(/\D/g, "");
    const endereco = String(body?.endereco ?? "").trim();
    const adminNome = String(body?.adminNome ?? "").trim();
    const adminEmail = String(body?.adminEmail ?? "").trim().toLowerCase();

    if (!nomeHospital || !cnpjDigits || !adminNome || !adminEmail) {
      return json(400, { error: "Campos obrigatórios: nomeHospital, cnpj, adminNome, adminEmail." });
    }
    if (cnpjDigits.length !== 14) return json(400, { error: "CNPJ deve ter 14 dígitos." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) return json(400, { error: "E-mail do admin inválido." });

    // 3) Pré-checagem de CNPJ duplicado (mensagem clara antes de tocar no Auth)
    const { data: cnpjDup } = await admin.from("hospitais").select("id, nome").eq("cnpj", cnpjDigits).maybeSingle();
    if (cnpjDup) {
      return json(409, { error: `CNPJ já cadastrado para o hospital "${cnpjDup.nome}".`, code: "cnpj_duplicado" });
    }

    // 4) Pré-checagem de admin já existente (por e-mail em profissionais)
    const { data: emailDup } = await admin.from("profissionais").select("id, nome").eq("email", adminEmail).maybeSingle();
    if (emailDup) {
      return json(409, {
        error: `Já existe um profissional cadastrado com o e-mail ${adminEmail} (${emailDup.nome}).`,
        code: "email_duplicado",
      });
    }

    // 5) Cria a conta de auth do admin (senha provisória, acesso imediato)
    const tempPassword = gerarSenhaProvisoria();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nome: adminNome, papel: "admin", must_change_password: true },
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "Falha ao criar a conta do admin.";
      const jaExiste = /already.*registered|already.*exists/i.test(msg);
      return json(jaExiste ? 409 : 400, {
        error: jaExiste ? `O e-mail ${adminEmail} já está cadastrado no sistema de autenticação.` : msg,
        code: jaExiste ? "email_duplicado" : "auth_create_failed",
      });
    }
    const adminUserId = created.user.id;

    // 6) Insere hospital + profissional na transação da RPC
    const { data: hospitalId, error: rpcErr } = await userClient.rpc("criar_hospital_com_admin", {
      p_nome_hospital: nomeHospital,
      p_cnpj: cnpjDigits,
      p_endereco: endereco,
      p_admin_user_id: adminUserId,
      p_admin_nome: adminNome,
      p_admin_email: adminEmail,
    });

    if (rpcErr) {
      // Rollback: remove a conta de auth órfã para o super_admin poder tentar de novo.
      await admin.auth.admin.deleteUser(adminUserId).catch(() => {});
      const dupCnpj = /duplicate key|unique|cnpj/i.test(rpcErr.message);
      return json(dupCnpj ? 409 : 400, {
        error: dupCnpj
          ? "CNPJ já cadastrado (detectado na gravação)."
          : `Falha ao criar hospital: ${rpcErr.message}`,
        code: dupCnpj ? "cnpj_duplicado" : "rpc_failed",
      });
    }

    return json(200, {
      success: true,
      hospitalId,
      adminUserId,
      adminEmail,
      tempPassword, // exibido uma vez ao super_admin — SMTP fake não entrega convite
    });
  } catch (err) {
    console.error("criar-hospital-admin error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
