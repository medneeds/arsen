// Edge function (super_admin): aprova ou reprova uma solicitacao de implantacao pendente.
//
// Aprovar: reaproveita a conta INERTE ja criada no envio (admin_user_id) ->
//   RPC criar_hospital_com_admin (cria hospital + profissional admin ligados aa conta)
//   -> confirma o email da conta (passa a poder logar com a senha que o usuario escolheu)
//   -> marca a linha 'aprovado' + hospital_id.
// Reprovar: marca 'reprovado' e DELETA a conta inerte (libera o e-mail).
//
// Guard: super_admin (RPC eh_super_admin). criar_hospital_com_admin checa auth.uid()
// internamente, entao e chamada com a identidade do chamador (userClient), nao service_role.
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

    // 1) Autentica o chamador
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Nao autorizado" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) return json(401, { error: "Token invalido" });

    // Guard: apenas super_admin
    const { data: isSuper, error: superErr } = await admin.rpc("eh_super_admin", { _user_id: caller.id });
    if (superErr) return json(500, { error: `Falha ao verificar papel: ${superErr.message}` });
    if (!isSuper) return json(403, { error: "Acesso negado — apenas o super_admin pode avaliar implantacoes." });

    // Cliente com a IDENTIDADE do chamador para a RPC (ela checa auth.uid())
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const body = await req.json().catch(() => ({}));
    const solicitacaoId = String(body?.solicitacaoId ?? "").trim();
    const decisao = String(body?.decisao ?? "").trim(); // 'aprovar' | 'reprovar'
    const observacoes = body?.observacoes ? String(body.observacoes).trim() : null;

    if (!solicitacaoId) return json(400, { error: "solicitacaoId obrigatorio." });
    if (decisao !== "aprovar" && decisao !== "reprovar") {
      return json(400, { error: "decisao deve ser 'aprovar' ou 'reprovar'." });
    }

    const { data: sol, error: solErr } = await admin
      .from("solicitacoes_implantacao")
      .select("id, status, hospital_nome, cnpj, endereco, contato_nome, contato_email, admin_user_id")
      .eq("id", solicitacaoId)
      .maybeSingle();
    if (solErr) return json(500, { error: `Falha ao carregar solicitacao: ${solErr.message}` });
    if (!sol) return json(404, { error: "Solicitacao nao encontrada." });
    if (sol.status !== "pendente") {
      return json(409, { error: `Solicitacao ja foi ${sol.status}.`, code: "status_invalido" });
    }

    if (decisao === "reprovar") {
      const { error: updErr } = await admin
        .from("solicitacoes_implantacao")
        .update({
          status: "reprovado",
          avaliado_por: caller.id,
          avaliado_em: new Date().toISOString(),
          observacoes_avaliador: observacoes,
        })
        .eq("id", sol.id);
      if (updErr) return json(400, { error: `Falha ao reprovar: ${updErr.message}` });
      // Libera o e-mail removendo a conta inerte.
      if (sol.admin_user_id) {
        await admin.auth.admin.deleteUser(sol.admin_user_id).catch(() => {});
      }
      return json(200, { success: true, decisao: "reprovar" });
    }

    // Aprovar
    if (!sol.admin_user_id) {
      return json(400, { error: "Solicitacao sem conta associada (admin_user_id ausente)." });
    }
    const { data: hospitalId, error: rpcErr } = await userClient.rpc("criar_hospital_com_admin", {
      p_nome_hospital: sol.hospital_nome,
      p_cnpj: String(sol.cnpj ?? "").replace(/\D/g, ""),
      p_endereco: sol.endereco ?? "",
      p_admin_user_id: sol.admin_user_id,
      p_admin_nome: sol.contato_nome,
      p_admin_email: sol.contato_email,
    });
    if (rpcErr) {
      const dupCnpj = /duplicate key|unique|cnpj/i.test(rpcErr.message);
      return json(dupCnpj ? 409 : 400, {
        error: dupCnpj ? "CNPJ ja cadastrado (detectado na gravacao)." : `Falha ao criar hospital: ${rpcErr.message}`,
        code: dupCnpj ? "cnpj_duplicado" : "rpc_failed",
      });
    }

    // Ativa o login: remove o ban, confirma o e-mail e limpa a flag de pendencia.
    await admin.auth.admin.updateUserById(sol.admin_user_id, {
      email_confirm: true,
      ban_duration: "none",
      user_metadata: { nome: sol.contato_nome, papel: "admin" },
    }).catch(() => {});

    const { error: updErr } = await admin
      .from("solicitacoes_implantacao")
      .update({
        status: "aprovado",
        hospital_id: hospitalId as unknown as string,
        avaliado_por: caller.id,
        avaliado_em: new Date().toISOString(),
        observacoes_avaliador: observacoes,
      })
      .eq("id", sol.id);
    if (updErr) {
      // Hospital ja criado; retorna 207 para o super_admin saber do estado parcial.
      return json(207, {
        success: true,
        hospitalId,
        aviso: `Hospital criado, mas a solicitacao nao marcou 'aprovado': ${updErr.message}`,
      });
    }

    return json(200, { success: true, decisao: "aprovar", hospitalId, email: sol.contato_email });
  } catch (err) {
    console.error("avaliar-implantacao error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
