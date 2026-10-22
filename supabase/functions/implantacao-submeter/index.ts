// Edge function PUBLICA (token-gated): recebe o cadastro de implantacao de um hospital
// preenchido pelo proprio hospital via link de uso unico, e deixa em 'pendente'.
//
// Por que Edge (e nao RPC): precisa criar a conta de auth do futuro admin com a senha
// escolhida pelo usuario (auth.admin.createUser exige service_role). A conta nasce
// INERTE (email_confirm=false) e so e ativada quando o super_admin aprovar. A senha
// vai direto para o GoTrue — NUNCA e gravada em tabela.
//
// Guard: NAO exige login. O que protege e o token de uso unico gerado pelo super_admin
// (status 'convidado' + nao expirado). Apos o envio o token vira 'pendente' (uso unico).
//
// Fluxo:
//   1. valida o token (convidado + nao expirado).
//   2. valida os campos (cnpj 14 digitos, email, senha >= 8).
//   3. checa duplicidade de CNPJ (hospitais) e de email (profissionais/auth).
//   4. createUser INERTE com a senha escolhida.
//   5. grava os dados na linha + admin_user_id, status 'pendente' (guard status='convidado').
//   6. se a gravacao falhar depois do createUser, remove a conta orfa (rollback).
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

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    const hospitalNome = String(body?.hospitalNome ?? "").trim();
    const cnpjDigits = String(body?.cnpj ?? "").replace(/\D/g, "");
    const endereco = String(body?.endereco ?? "").trim();
    const contatoNome = String(body?.contatoNome ?? "").trim();
    const contatoEmail = String(body?.contatoEmail ?? "").trim().toLowerCase();
    const contatoTelefone = String(body?.contatoTelefone ?? "").replace(/\D/g, "");
    const senha = String(body?.senha ?? "");

    if (!token) return json(400, { error: "Link invalido." });

    // 1) Valida o token (service_role ignora RLS)
    const { data: conv, error: convErr } = await admin
      .from("solicitacoes_implantacao")
      .select("id, status, expira_em")
      .eq("token", token)
      .maybeSingle();
    if (convErr) return json(500, { error: `Falha ao validar o link: ${convErr.message}` });
    if (!conv) return json(404, { error: "Link invalido.", code: "inexistente" });
    if (conv.status !== "convidado") {
      return json(409, { error: "Este link ja foi utilizado.", code: "usado" });
    }
    if (conv.expira_em && new Date(conv.expira_em).getTime() < Date.now()) {
      return json(410, { error: "Este link expirou. Peca um novo a equipe.", code: "expirado" });
    }

    // 2) Valida os campos
    if (!hospitalNome || !cnpjDigits || !contatoNome || !contatoEmail || !senha) {
      return json(400, { error: "Preencha hospital, CNPJ, nome e e-mail de contato e senha." });
    }
    if (cnpjDigits.length !== 14) return json(400, { error: "CNPJ deve ter 14 digitos." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contatoEmail)) return json(400, { error: "E-mail de contato invalido." });
    if (senha.length < 8) return json(400, { error: "A senha deve ter ao menos 8 caracteres." });

    // 3) Duplicidades (mensagem clara antes de tocar no Auth)
    const { data: cnpjDup } = await admin.from("hospitais").select("id, nome").eq("cnpj", cnpjDigits).maybeSingle();
    if (cnpjDup) {
      return json(409, { error: `CNPJ ja cadastrado para o hospital "${cnpjDup.nome}".`, code: "cnpj_duplicado" });
    }
    const { data: emailDup } = await admin.from("profissionais").select("id").eq("email", contatoEmail).maybeSingle();
    if (emailDup) {
      return json(409, { error: `O e-mail ${contatoEmail} ja esta cadastrado.`, code: "email_duplicado" });
    }

    // 4) Cria a conta INERTE com a senha escolhida. Garantia dupla de que nao loga
    //    ate a aprovacao: email_confirm=false E ban_duration (bane a conta). O ban
    //    bloqueia signInWithPassword independentemente da config de confirmacao do GoTrue.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: contatoEmail,
      password: senha,
      email_confirm: false,
      ban_duration: "876000h",
      user_metadata: { nome: contatoNome, papel: "admin", implantacao_pendente: true },
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "Falha ao preparar a conta.";
      const jaExiste = /already.*registered|already.*exists/i.test(msg);
      return json(jaExiste ? 409 : 400, {
        error: jaExiste ? `O e-mail ${contatoEmail} ja esta cadastrado.` : msg,
        code: jaExiste ? "email_duplicado" : "auth_create_failed",
      });
    }
    const adminUserId = created.user.id;

    // 5) Grava os dados e consome o token (guard status='convidado' fecha corrida)
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const userAgent = req.headers.get("user-agent");
    const { data: updated, error: updErr } = await admin
      .from("solicitacoes_implantacao")
      .update({
        hospital_nome: hospitalNome,
        cnpj: cnpjDigits,
        endereco: endereco || null,
        contato_nome: contatoNome,
        contato_email: contatoEmail,
        contato_telefone: contatoTelefone || null,
        admin_user_id: adminUserId,
        status: "pendente",
        enviado_em: new Date().toISOString(),
        ip,
        user_agent: userAgent,
      })
      .eq("id", conv.id)
      .eq("status", "convidado")
      .select("id");

    if (updErr || !updated || updated.length === 0) {
      // Rollback: remove a conta orfa (link ja usado por outra submissao, ou erro)
      await admin.auth.admin.deleteUser(adminUserId).catch(() => {});
      if (updErr) return json(400, { error: `Falha ao enviar: ${updErr.message}` });
      return json(409, { error: "Este link ja foi utilizado.", code: "usado" });
    }

    return json(200, { success: true });
  } catch (err) {
    console.error("implantacao-submeter error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
