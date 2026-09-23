// Edge function: o admin de um hospital gera uma NOVA senha provisória para um
// profissional da SUA equipe (quando o profissional perdeu/esqueceu a senha).
//
// Segurança:
//   - Chamador precisa ser admin de um hospital (profissionais.papel='admin').
//   - O alvo precisa ser um profissional do MESMO hospital do admin, e nunca
//     admin/super_admin/dev (o admin não redefine a própria senha nem a de pares).
//   - Não usa e-mail (SMTP fake): a nova senha volta no response para o admin
//     repassar. Marca must_change_password para troca no 1º acesso.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PAPEIS_BLOQUEADOS = new Set(["admin", "super_admin", "dev"]);

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

    // Deriva o hospital do admin (papel='admin'). Só admin reseta senha da equipe.
    const { data: adminRow, error: admErr } = await admin
      .from("profissionais")
      .select("hospital_id")
      .eq("user_id", caller.id)
      .eq("papel", "admin")
      .maybeSingle();
    if (admErr) return json(500, { error: admErr.message });
    if (!adminRow?.hospital_id) return json(403, { error: "Apenas o admin do hospital pode redefinir senhas da equipe." });
    const hospitalId = adminRow.hospital_id;

    const profissionalId = String((await req.json().catch(() => ({})))?.profissionalId ?? "");
    if (!profissionalId) return json(400, { error: "profissionalId é obrigatório." });

    // Alvo precisa ser do mesmo hospital do admin e ter user_id (conta de acesso).
    const { data: alvo, error: alvoErr } = await admin
      .from("profissionais")
      .select("nome, email, papel, user_id, hospital_id")
      .eq("id", profissionalId)
      .maybeSingle();
    if (alvoErr) return json(500, { error: alvoErr.message });
    if (!alvo) return json(404, { error: "Profissional não encontrado." });
    if (alvo.hospital_id !== hospitalId) return json(403, { error: "Este profissional não pertence ao seu hospital." });
    if (PAPEIS_BLOQUEADOS.has(alvo.papel)) return json(403, { error: "Não é permitido redefinir a senha desse tipo de usuário." });
    if (!alvo.user_id) return json(400, { error: "Este profissional não possui conta de acesso." });

    const tempPassword = gerarSenhaProvisoria();
    const { error: updErr } = await admin.auth.admin.updateUserById(alvo.user_id, {
      password: tempPassword,
      user_metadata: { must_change_password: true },
    });
    if (updErr) return json(500, { error: `Falha ao redefinir senha: ${updErr.message}` });

    return json(200, { email: alvo.email, nome: alvo.nome, tempPassword });
  } catch (err) {
    console.error("resetar-senha-profissional error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
