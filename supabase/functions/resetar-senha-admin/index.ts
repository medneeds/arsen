// Edge function: super_admin gera uma NOVA senha provisória para o admin de uma
// unidade (quando a senha original não foi anotada no cadastro).
//
// Segurança:
//   - Só super_admin (verifica eh_super_admin pelo JWT do chamador).
//   - Só reseta profissionais com papel='admin' (nunca super_admin/clínicos).
//   - Não usa e-mail (SMTP fake): a nova senha volta no response para o
//     super_admin repassar. Marca must_change_password para troca no 1º acesso.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function gerarSenhaProvisoria(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const rnd = (set: string) => set[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * set.length)];
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

    // 1) Autentica o chamador e exige super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autorizado" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) return json(401, { error: "Token inválido" });

    const { data: isSuper, error: superErr } = await admin.rpc("eh_super_admin", { _user_id: caller.id });
    if (superErr) return json(500, { error: `Falha ao verificar papel: ${superErr.message}` });
    if (!isSuper) return json(403, { error: "Apenas o super_admin pode redefinir a senha de administradores." });

    // 2) Valida o alvo (precisa ser papel='admin')
    const adminUserId = String((await req.json().catch(() => ({})))?.adminUserId ?? "");
    if (!adminUserId) return json(400, { error: "adminUserId é obrigatório." });

    const { data: alvo, error: alvoErr } = await admin
      .from("profissionais")
      .select("nome, email, papel")
      .eq("user_id", adminUserId)
      .maybeSingle();
    if (alvoErr) return json(500, { error: alvoErr.message });
    if (!alvo) return json(404, { error: "Profissional não encontrado." });
    if (alvo.papel !== "admin") return json(403, { error: "Só é permitido redefinir a senha de administradores de unidade." });

    // 3) Gera e aplica a nova senha provisória
    const tempPassword = gerarSenhaProvisoria();
    const { error: updErr } = await admin.auth.admin.updateUserById(adminUserId, {
      password: tempPassword,
      user_metadata: { must_change_password: true },
    });
    if (updErr) return json(500, { error: `Falha ao redefinir senha: ${updErr.message}` });

    return json(200, { email: alvo.email, nome: alvo.nome, tempPassword });
  } catch (err) {
    console.error("resetar-senha-admin error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
