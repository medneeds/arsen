// Edge function: o admin de um hospital APROVA uma solicitação de pré-cadastro,
// criando a conta do profissional e vinculando-o ao seu hospital.
//
// Segurança:
//   - Chamador precisa ser admin de um hospital (profissionais.papel='admin').
//   - A solicitação precisa ser do MESMO hospital do admin e estar 'pendente'.
//   - O papel definitivo é escolhido pelo admin (o perfil_acesso do formulário
//     público é só uma dica); nunca admin/super_admin/dev.
//   - createUser via service_role (email_confirm:true, sem SMTP). Senha
//     provisória volta no response para o admin repassar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PAPEIS_PERMITIDOS = new Set([
  "medico", "enfermeiro", "tecnico", "regulador", "farmacia", "nir", "porta", "visitante", "coordenador",
]);

function gerarSenhaProvisoria(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ", lower = "abcdefghijkmnpqrstuvwxyz", digits = "23456789", symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const rnd = (s: string) => s[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * s.length)];
  const base = [rnd(upper), rnd(lower), rnd(digits), rnd(symbols)];
  while (base.length < 12) base.push(rnd(all));
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autorizado" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) return json(401, { error: "Token inválido" });

    // Deriva o hospital do admin (papel='admin').
    const { data: adminRow, error: admErr } = await admin
      .from("profissionais").select("hospital_id").eq("user_id", caller.id).eq("papel", "admin").maybeSingle();
    if (admErr) return json(500, { error: admErr.message });
    if (!adminRow?.hospital_id) return json(403, { error: "Apenas o admin do hospital pode aprovar cadastros." });
    const hospitalId = adminRow.hospital_id;

    const body = await req.json().catch(() => ({}));
    const solicitacaoId = String(body?.solicitacaoId ?? "").trim();
    const papel = String(body?.papel ?? "").trim();
    const cargo = String(body?.cargo ?? "").trim() || null;
    const observacoes = String(body?.observacoes ?? "").trim() || null;
    if (!solicitacaoId) return json(400, { error: "solicitacaoId é obrigatório." });
    if (!PAPEIS_PERMITIDOS.has(papel)) return json(400, { error: `Papel inválido. Permitidos: ${[...PAPEIS_PERMITIDOS].join(", ")}.` });

    // Carrega a solicitação e valida hospital + status.
    const { data: sol, error: solErr } = await admin
      .from("solicitacoes_pre_cadastro")
      .select("id, nome_completo, email, crm, hospital_id, status, perfil_acesso")
      .eq("id", solicitacaoId).maybeSingle();
    if (solErr) return json(500, { error: solErr.message });
    if (!sol) return json(404, { error: "Solicitação não encontrada." });
    if (sol.hospital_id !== hospitalId) return json(403, { error: "Esta solicitação não pertence ao seu hospital." });
    if (sol.status !== "pendente") return json(409, { error: `Solicitação já foi ${sol.status}.` });

    const email = String(sol.email).trim().toLowerCase();
    const nome = String(sol.nome_completo).trim();

    // E-mail já é profissional?
    const { data: dup } = await admin.from("profissionais").select("id").eq("email", email).maybeSingle();
    if (dup) return json(409, { error: `Já existe um profissional com o e-mail ${email}.`, code: "email_duplicado" });

    // Cria a conta.
    const tempPassword = gerarSenhaProvisoria();
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
      user_metadata: { nome, papel, access_profile: (sol as any).perfil_acesso ?? null, access_profiles: (sol as any).perfil_acesso ? [(sol as any).perfil_acesso] : [], must_change_password: true },
    });
    if (cErr || !created?.user) {
      const msg = cErr?.message ?? "Falha ao criar conta.";
      const ja = /already.*registered|already.*exists/i.test(msg);
      return json(ja ? 409 : 400, { error: ja ? `O e-mail ${email} já está cadastrado no sistema de autenticação.` : msg });
    }

    // Vincula o profissional. CRM médico vira conselho quando presente.
    const conselho = papel === "medico" && sol.crm ? "CRM" : null;
    const numeroConselho = papel === "medico" && sol.crm ? String(sol.crm) : null;
    const { error: insErr } = await admin.from("profissionais").insert({
      hospital_id: hospitalId, user_id: created.user.id, nome, email, papel,
      conselho, numero_conselho: numeroConselho, cargo, ativo: true,
    });
    if (insErr) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
      return json(400, { error: `Falha ao cadastrar profissional: ${insErr.message}` });
    }

    // Marca a solicitação como aprovada.
    const { error: updErr } = await admin.from("solicitacoes_pre_cadastro").update({
      status: "aprovado", avaliado_por: caller.id, avaliado_em: new Date().toISOString(),
      usuario_criado_id: created.user.id, observacoes_avaliador: observacoes,
    }).eq("id", solicitacaoId);
    if (updErr) {
      // Conta já criada; não desfaz. Sinaliza para o admin reprocessar manualmente se preciso.
      return json(207, { success: true, email, nome, tempPassword, aviso: `Usuário criado, mas falha ao atualizar a solicitação: ${updErr.message}` });
    }

    return json(200, { success: true, email, nome, tempPassword });
  } catch (err) {
    console.error("aprovar-pre-cadastro error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
