// Edge function: resolve-login
// Recebe um identificador (CPF, usuário interno ou email) e retorna o email
// real cadastrado no auth.users para que o cliente faça signInWithPassword.
// Usa SERVICE_ROLE para consultar profiles + auth.users sem expor dados.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Restringe CORS à origem configurada em ALLOWED_ORIGIN (variável de ambiente).
// Se não configurada, cai em "*" para compatibilidade retroativa em dev local.
// Em produção, definir ALLOWED_ORIGIN=https://app.exemplo.com.br nos secrets do projeto.
function buildCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
  const requestOrigin = req.headers.get("origin") ?? "";
  const effectiveOrigin =
    allowedOrigin === "*"
      ? "*"
      : requestOrigin === allowedOrigin
      ? allowedOrigin
      : "null"; // origem não autorizada → bloqueia o browser
  return {
    "Access-Control-Allow-Origin": effectiveOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const onlyDigits = (v: string) => v.replace(/\D+/g, "");

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// Protege contra enumeração de usuários: um atacante não pode enviar milhares
// de CPFs para descobrir quais profissionais estão cadastrados no sistema.
//
// Implementação: Map em memória por IP com janela deslizante de 60 segundos.
// Limite: 5 tentativas por minuto por IP.
//
// Limitação conhecida: o estado não é compartilhado entre instâncias paralelas
// da Edge Function (Deno isolates independentes). Em picos de escala, cada
// instância mantém seu próprio contador. Para um sistema hospitalar de volume
// baixo como o Socorrão I, isso é suficiente para bloquear ataques automatizados.
// Para proteção distribuída total, seria necessário Redis ou banco de dados.
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = 5;          // máximo de tentativas por janela
const RATE_LIMIT_WINDOW_MS = 60_000; // janela de 60 segundos
const STORE_MAX_SIZE = 2_000;      // limite do Map para evitar vazamento de memória

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIp(req: Request): string {
  // Supabase Edge Functions são executadas atrás de um proxy.
  // x-forwarded-for contém o IP real do cliente (pode ser lista separada por vírgulas).
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Limpeza periódica: quando o Map atinge o limite, remove entradas expiradas.
  // Evita crescimento ilimitado de memória em caso de muitos IPs únicos.
  if (rateLimitStore.size >= STORE_MAX_SIZE) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) rateLimitStore.delete(key);
    }
  }

  const entry = rateLimitStore.get(ip);

  // Janela expirada ou primeiro acesso: inicia nova janela com count = 1
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Dentro da janela e acima do limite
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // Dentro da janela e abaixo do limite: incrementa
  entry.count++;
  rateLimitStore.set(ip, entry);
  return { allowed: true, retryAfterSeconds: 0 };
}

// ── Handler ───────────────────────────────────────────────────────────────────

// Mensagem genérica para "não encontrado": igual à mensagem de erro de rate-limit,
// impedindo que um atacante distinga entre "conta não existe" (antes: 404 distinto)
// e "conta existe, mas tentativas esgotadas" (antes: 429 distinto).
const MSG_NOT_FOUND = "Identificador não encontrado ou acesso bloqueado.";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Verificação de rate limit ────────────────────────────────────────────
  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(clientIp);

  if (!rateCheck.allowed) {
    console.warn(`[resolve-login] rate limit atingido — IP: ${clientIp}`);
    return new Response(
      JSON.stringify({
        // Mesma mensagem do caso "não encontrado" — evita enumeração por mensagem.
        error: MSG_NOT_FOUND,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": rateCheck.retryAfterSeconds.toString(),
        },
      },
    );
  }
  // ────────────────────────────────────────────────────────────────────────

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
        JSON.stringify({ error: MSG_NOT_FOUND }),
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
