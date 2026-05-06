// Edge function: resolve-login
// Recebe um identificador (CPF, usuário interno ou email) e retorna o email
// real cadastrado no auth.users para que o cliente faça signInWithPassword.
// Usa SERVICE_ROLE para consultar profiles + auth.users sem expor dados.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const onlyDigits = (v: string) => v.replace(/\D+/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const identifier: string = (body?.identifier ?? "").toString().trim();

    if (!identifier) {
      return new Response(
        JSON.stringify({ error: "identifier é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // 1) Detecta tipo do identificador
    const digits = onlyDigits(identifier);
    const isEmail = identifier.includes("@");
    const isCpf = !isEmail && digits.length === 11;

    let profileId: string | null = null;

    if (isCpf) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("cpf", digits)
        .maybeSingle();
      if (error) throw error;
      profileId = data?.id ?? null;
    } else if (isEmail) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", identifier.toLowerCase())
        .maybeSingle();
      if (error) throw error;
      profileId = data?.id ?? null;

      // fallback: pode ser email real (não interno) — busca direta em auth.users
      if (!profileId) {
        const { data: au } = await supabase.rpc("get_auth_user_id_by_email", {
          p_email: identifier.toLowerCase(),
        });
        if (au) profileId = au as string;
      }
    } else {
      // Identificador alfanumérico: tenta primeiro como username escolhido pelo
      // próprio usuário, depois cai para o e-mail interno legado
      // (`<usuario>@sistema.local`).
      const lowered = identifier.toLowerCase();
      const { data: byUsername, error: unErr } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", lowered)
        .maybeSingle();
      if (unErr) throw unErr;
      profileId = byUsername?.id ?? null;

      if (!profileId) {
        const internalEmail = `${lowered}@sistema.local`;
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", internalEmail)
          .maybeSingle();
        if (error) throw error;
        profileId = data?.id ?? null;
      }
    }

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Busca email real em auth.users via Admin API
    const { data: authUser, error: authErr } =
      await supabase.auth.admin.getUserById(profileId);
    if (authErr) throw authErr;

    const email = authUser?.user?.email;
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Conta sem email associado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Diferencia email interno (sistema.local) de email real,
    // útil para o cliente decidir se mostra/oculta no fluxo "esqueci senha".
    const isInternal = email.endsWith("@sistema.local");

    return new Response(
      JSON.stringify({ email, isInternal }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[resolve-login] erro", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
