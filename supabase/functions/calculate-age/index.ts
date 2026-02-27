import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input } = await req.json();
    
    if (!input) {
      return new Response(
        JSON.stringify({ error: "Input é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que calcula idade a partir de datas de nascimento ou retorna a idade se já foi fornecida como número.
            
REGRAS:
- Se o input for um número (ex: "25", "30"), retorne APENAS esse número
- Se o input for uma data (qualquer formato), calcule a idade em anos completos a partir da data atual
- Retorne APENAS o número da idade, nada mais
- Use a data atual para cálculos: ${new Date().toISOString().split('T')[0]}`
          },
          {
            role: "user",
            content: input
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_age",
              description: "Retorna a idade calculada ou fornecida",
              parameters: {
                type: "object",
                properties: {
                  age: {
                    type: "number",
                    description: "Idade em anos completos"
                  }
                },
                required: ["age"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_age" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Erro da API:", response.status, errorText);
      throw new Error("Erro ao processar requisição");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("Resposta inválida da IA");
    }

    const args = JSON.parse(toolCall.function.arguments);
    const age = args.age;

    return new Response(
      JSON.stringify({ age }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
