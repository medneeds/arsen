// Edge function: super_admin obtém um OTP para "logar como" o admin de uma unidade.
//
// Segurança:
//   - Só o super_admin pode chamar (verifica eh_super_admin pelo JWT do chamador).
//   - Só permite impersonar profissionais com papel='admin' (nunca outro
//     super_admin nem papéis clínicos).
//   - Retorna um OTP de uso único (generate_link/magiclink). O frontend troca
//     esse OTP por uma sessão (verifyOtp) e guarda a sessão do super_admin para
//     poder voltar. Nenhuma senha é exposta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
    if (!isSuper) return json(403, { error: "Apenas o super_admin pode impersonar administradores." });

    // 2) Valida o alvo — precisa ser um profissional papel='admin'
    const adminUserId = String((await req.json().catch(() => ({})))?.adminUserId ?? "");
    if (!adminUserId) return json(400, { error: "adminUserId é obrigatório." });

    const { data: alvo, error: alvoErr } = await admin
      .from("profissionais")
      .select("nome, email, papel")
      .eq("user_id", adminUserId)
      .maybeSingle();
    if (alvoErr) return json(500, { error: alvoErr.message });
    if (!alvo) return json(404, { error: "Profissional não encontrado." });
    if (alvo.papel !== "admin") return json(403, { error: "Só é permitido impersonar administradores de unidade." });
    if (!alvo.email) return json(400, { error: "O admin não tem e-mail cadastrado." });

    // 3) Gera o OTP (magiclink) do alvo
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: alvo.email,
    });
    if (linkErr || !link) return json(500, { error: linkErr?.message ?? "Falha ao gerar acesso." });

    const otp = (link as { properties?: { email_otp?: string } }).properties?.email_otp;
    if (!otp) return json(500, { error: "OTP não retornado pelo servidor de auth." });

    return json(200, { email: alvo.email, nome: alvo.nome, otp });
  } catch (err) {
    console.error("impersonar-admin error", err);
    return json(500, { error: (err as Error).message ?? "Erro interno" });
  }
});
