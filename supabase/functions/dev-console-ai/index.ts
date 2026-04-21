// Dev Console — AI assistant with tool calling + SSE streaming.
// Streams token-by-token to the client. Tool calls are executed server-side and
// re-fed to the model; the assistant's final tokens stream back to the user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o Console de Desenvolvimento da plataforma Arsen (sistema clínico hospitalar).
Você ajuda os desenvolvedores e o owner a operar e diagnosticar a plataforma.

REGRAS:
- Responda em português brasileiro, claro e técnico.
- Use as ferramentas (tools) disponíveis para BUSCAR DADOS REAIS — nunca invente métricas.
- Para ações SENSÍVEIS (conceder/revogar role, resetar senhas), NÃO execute direto: explique a ação proposta e peça confirmação explícita do usuário antes de chamar a ferramenta com confirm:true.
- Quando sugerir mudanças de código, escreva o código pronto e explique onde colar (que arquivo / função). O painel não edita o projeto sozinho.
- Seja conciso. Use markdown. Quando mostrar dados tabulares, use tabelas markdown.

CONTEXTO DA PLATAFORMA:
- Frontend: React + Vite + Tailwind + shadcn
- Backend: Lovable Cloud (Supabase) com RLS estrita
- Tabelas-chave: patients, patient_registry, patient_encounters, prescriptions, clinical_evolutions, audit_logs, user_roles
- Perfis: admin, medico, porta, visitante, farmacia, nir, dev`;

const tools = [
  { type: "function", function: { name: "system_health", description: "Métricas gerais: pacientes ativos, prescrições/admissões/deletes nas últimas 24h, total de usuários.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "audit_recent", description: "Últimos eventos do audit_log (criação/edição/exclusão).", parameters: { type: "object", properties: { limit: { type: "number" } } } } },
  { type: "function", function: { name: "user_activity", description: "Atividade de usuários nos últimos 7 dias — top 20.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "clinical_volume", description: "Volume clínico (atendimentos, prescrições, evoluções) por dia, últimos 7 dias.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_users", description: "Lista os 100 usuários mais recentes com seus perfis.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "db_table_sizes", description: "Contagem de linhas das tabelas principais.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "slow_queries", description: "Tabelas mais mutadas nas últimas 24h (proxy de hot paths e potenciais gargalos).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "edge_function_errors", description: "Sinais operacionais de erro: exames com status ERRO e evoluções órfãs.", parameters: { type: "object", properties: {} } } } ,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const jwt = authHeader.replace("Bearer ", "");
    const supaAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await supaAuth.auth.getUser(jwt);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r) => ["dev", "admin"].includes(r.role as string));
    if (!allowed) return new Response(JSON.stringify({ error: "Forbidden — dev role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { messages = [] } = await req.json();

    const callOps = async (action: string, params: Record<string, unknown> = {}) => {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/dev-console-ops`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action, params }),
      });
      return await r.json();
    };

    // Phase 1: resolve any tool calls non-streamed (to keep loop simple).
    const convo: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
    let iterations = 0;
    while (iterations++ < 5) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: convo, tools, tool_choice: "auto" }),
      });
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione fundos em Configurações → Workspace → Uso." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!resp.ok) {
        const t = await resp.text();
        return new Response(JSON.stringify({ error: `Gateway error: ${t}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return new Response(JSON.stringify({ error: "Empty response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // Phase 2: stream the final answer token-by-token.
        // Replace final assistant turn with a fresh streamed call (so client gets SSE).
        const streamResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [...convo, { role: "user", content: "(Reformule sua última resposta de forma clara e final em markdown. Não chame mais ferramentas.)" }],
            stream: true,
          }),
        });
        if (!streamResp.ok || !streamResp.body) {
          // Fallback: send the non-streamed content as a single SSE event.
          const stream = new ReadableStream({
            start(controller) {
              const enc = new TextEncoder();
              const payload = { choices: [{ delta: { content: msg.content ?? "" } }] };
              controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
              controller.enqueue(enc.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });
          return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        }
        return new Response(streamResp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      convo.push(msg);
      for (const tc of toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try { parsedArgs = JSON.parse(tc.function.arguments || "{}"); } catch (_) {}
        const result = await callOps(tc.function.name, parsedArgs);
        convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }

    // Iteration cap reached — stream a polite fallback.
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const payload = { choices: [{ delta: { content: "Limite de iterações atingido — refaça a pergunta de forma mais específica." } }] };
        controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("[dev-console-ai]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
