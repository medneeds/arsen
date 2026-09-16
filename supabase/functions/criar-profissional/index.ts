// Edge function: admin de hospital cria um profissional (médico/enfermeiro/etc.)
// com conta de acesso, no hospital dele.
//
// Segurança:
//   - Chamador precisa ser admin de um hospital (profissionais.papel='admin').
//     O hospital do profissional criado é derivado daí (não do body).
//   - Papéis permitidos: apenas equipe clínica/operacional (nunca super_admin,
//     admin ou dev).
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

    // Deriva o hospital do admin (papel='admin'). Só admin cria equipe.
    const { data: adminRow, error: admErr } = await admin
      .from("profissionais")
      .select("hospital_id")
      .eq("user_id", caller.id)
      .eq("papel", "admin")
      .maybeSingle();
    if (admErr) return json(500, { error: admErr.message });
    if (!adminRow?.hospital_id) return json(403, { error: "Apenas o admin do hospital pode cadastrar profissionais." });
    const hospitalId = adminRow.hospital_id;

    const body = await req.json().catch(() => ({}));
    const nome = String(body?.nome ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const papel = String(body?.papel ?? "").trim();
    const conselho = String(body?.conselho ?? "").trim() || null;
    const numeroConselho = String(body?.numeroConselho ?? "").trim() || null;
    const cargo = String(body?.cargo ?? "").trim() || null;
    // Perfis de acesso (ambiente/UI). Sem coluna em profissionais → vive no user_metadata.
    // perfilAcesso = principal; perfisAcesso = lista completa (multi-perfil).
    const perfilAcesso = String(body?.perfilAcesso ?? "").trim() || null;
    const perfisAcesso: string[] = Array.isArray(body?.perfisAcesso)
      ? body.perfisAcesso.map((x: unknown) => String(x)).filter(Boolean)
      : (perfilAcesso ? [perfilAcesso] : []);

    if (!nome || !email || !papel) return json(400, { error: "Campos obrigatórios: nome, email, papel." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "E-mail inválido." });
    if (!PAPEIS_PERMITIDOS.has(papel)) return json(400, { error: `Papel inválido. Permitidos: ${[...PAPEIS_PERMITIDOS].join(", ")}.` });

    // E-mail já usado?
    const { data: dup } = await admin.from("profissionais").select("id, nome").eq("email", email).maybeSingle();
    if (dup) return json(409, { error: `Já existe um profissional com o e-mail ${email} (${dup.nome}).`, code: "email_duplicado" });

    // Cria a conta
    const tempPassword = gerarSenhaProvisoria();
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
      user_metadata: { nome, papel, access_profile: perfilAcesso, access_profiles: perfisAcesso, must_change_password: true },
    });
    if (cErr || !created?.user) {
      const msg = cErr?.message ?? "Falha ao criar conta.";
      const ja = /already.*registered|already.*exists/i.test(msg);
      return json(ja ? 409 : 400, { error: ja ? `O e-mail ${email} já está cadastrado no sistema de autenticação.` : msg });
    }

    // Vincula o profissional ao hospital do admin
    const { error: insErr } = await admin.from("profissionais").insert({
      hospital_id: hospitalId, user_id: created.user.id, nome, email, papel,
      conselho, numero_conselho: numeroConselho, cargo, ativo: true,
    });
    if (insErr) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
      return json(400, { error: `Falha ao cadastrar profissional: ${insErr.message}` });
    }

    return json(200, { success: true, email, nome, tempPassword });
  } catch (err) {
    console.error("criar-profissional error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
