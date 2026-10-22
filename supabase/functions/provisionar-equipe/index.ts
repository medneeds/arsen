// Edge function: super_admin provisiona a EQUIPE de um hospital recem-criado,
// na tela /implantacao (fase 2).
//
// Por que existe (e nao reusa criar-profissional): criar-profissional deriva o
// hospital_id do chamador exigindo papel='admin' e bloqueia super_admin (403).
// Aqui o chamador e validado como super_admin (eh_super_admin) e o hospital_id
// vem no body, explicito. Cria cada conta (service_role), insere em
// profissionais e, se houver, os vinculos em profissionais_setores.
//
// Seguranca:
//   - Chamador precisa ser super_admin (RPC eh_super_admin).
//   - Papeis permitidos: apenas equipe clinica/operacional (nunca super_admin,
//     admin ou dev) -- mesma lista de criar-profissional.
//   - createUser via service_role (email_confirm:true, sem SMTP). Senha
//     provisoria volta no response, por pessoa, para o super_admin repassar.
//   - Falha ao inserir o profissional faz rollback da conta auth daquela pessoa.
//     As pessoas sao processadas uma a uma; o retorno diz o que deu certo/errado
//     (nao e transacional entre pessoas -- cada pessoa e independente).
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

interface PessoaInput {
  nome?: string; email?: string; papel?: string;
  conselho?: string; numeroConselho?: string; cargo?: string;
  perfilAcesso?: string; perfisAcesso?: unknown;
  setorIds?: unknown;
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

    // Guard: somente super_admin (ao contrario de criar-profissional, que exige admin).
    const { data: isSuper, error: superErr } = await admin.rpc("eh_super_admin", { _user_id: caller.id });
    if (superErr) return json(500, { error: superErr.message });
    if (!isSuper) return json(403, { error: "Apenas o super_admin pode provisionar a equipe." });

    const body = await req.json().catch(() => ({}));
    const hospitalId = String(body?.hospitalId ?? "").trim();
    const pessoas: PessoaInput[] = Array.isArray(body?.pessoas) ? body.pessoas : [];
    if (!hospitalId) return json(400, { error: "hospitalId obrigatório." });
    if (pessoas.length === 0) return json(400, { error: "Nenhuma pessoa informada." });

    // Hospital precisa existir (leitura via service_role).
    const { data: hosp } = await admin.from("hospitais").select("id").eq("id", hospitalId).maybeSingle();
    if (!hosp) return json(404, { error: "Hospital não encontrado." });

    const results: Array<{ email: string; nome: string; ok: boolean; tempPassword?: string; error?: string }> = [];

    for (const p of pessoas) {
      const nome = String(p?.nome ?? "").trim();
      const email = String(p?.email ?? "").trim().toLowerCase();
      const papel = String(p?.papel ?? "").trim();
      const conselho = String(p?.conselho ?? "").trim() || null;
      const numeroConselho = String(p?.numeroConselho ?? "").trim() || null;
      const cargo = String(p?.cargo ?? "").trim() || null;
      const perfilAcesso = String(p?.perfilAcesso ?? "").trim() || null;
      const perfisAcesso: string[] = Array.isArray(p?.perfisAcesso)
        ? p.perfisAcesso.map((x: unknown) => String(x)).filter(Boolean)
        : (perfilAcesso ? [perfilAcesso] : []);
      const setorIds: string[] = Array.isArray(p?.setorIds)
        ? p.setorIds.map((x: unknown) => String(x)).filter(Boolean)
        : [];

      if (!nome || !email || !papel) { results.push({ email, nome, ok: false, error: "Campos obrigatórios: nome, email, papel." }); continue; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { results.push({ email, nome, ok: false, error: "E-mail inválido." }); continue; }
      if (!PAPEIS_PERMITIDOS.has(papel)) { results.push({ email, nome, ok: false, error: `Papel inválido: ${papel}.` }); continue; }

      // E-mail já usado em profissionais?
      const { data: dup } = await admin.from("profissionais").select("id").eq("email", email).maybeSingle();
      if (dup) { results.push({ email, nome, ok: false, error: `Já existe profissional com o e-mail ${email}.` }); continue; }

      const tempPassword = gerarSenhaProvisoria();
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password: tempPassword, email_confirm: true,
        user_metadata: { nome, papel, access_profile: perfilAcesso, access_profiles: perfisAcesso, must_change_password: true },
      });
      if (cErr || !created?.user) {
        const msg = cErr?.message ?? "Falha ao criar conta.";
        results.push({ email, nome, ok: false, error: /already/i.test(msg) ? `E-mail ${email} já cadastrado na autenticação.` : msg });
        continue;
      }

      const { error: insErr } = await admin.from("profissionais").insert({
        hospital_id: hospitalId, user_id: created.user.id, nome, email, papel,
        conselho, numero_conselho: numeroConselho, cargo, ativo: true,
      });
      if (insErr) {
        await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
        results.push({ email, nome, ok: false, error: `Falha ao cadastrar: ${insErr.message}` });
        continue;
      }

      // Vinculos de setor (opcional). Resolve o profissional por e-mail (o insert nao
      // devolve o id) e grava profissionais_setores. Falha aqui NAO derruba a pessoa
      // (conta e profissional ja existem) -- so registra aviso.
      if (setorIds.length > 0) {
        const { data: prof } = await admin.from("profissionais").select("id").eq("email", email).maybeSingle();
        if (prof?.id) {
          const vinculos = setorIds.map((setor_id) => ({ profissional_id: prof.id, setor_id }));
          await admin.from("profissionais_setores").insert(vinculos).catch(() => {});
        }
      }

      results.push({ email, nome, ok: true, tempPassword });
    }

    const criadas = results.filter((r) => r.ok).length;
    return json(200, { success: true, criadas, total: pessoas.length, results });
  } catch (err) {
    console.error("provisionar-equipe error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
