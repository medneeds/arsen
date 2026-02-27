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
    
    if (!input || typeof input !== 'string') {
      return new Response(
        JSON.stringify({ error: "Input is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const systemPrompt = `Você é um assistente especializado em formatar idades pediátricas seguindo RIGOROSAMENTE os padrões clínicos hospitalares brasileiros.

DATA DE HOJE: ${todayStr} (${today.toLocaleDateString('pt-BR')})

TABELA DE FORMATAÇÃO (SIGA EXATAMENTE):
┌─────────────────┬──────────────────────────┬─────────────────────────────┐
│ Faixa etária    │ Formato OBRIGATÓRIO      │ Exemplos                    │
├─────────────────┼──────────────────────────┼─────────────────────────────┤
│ 0-28 dias       │ DV X                     │ DV 1, DV 14, DV 28          │
│ 29 dias-3 meses │ X SEMANA(S) + Y DIA(S)   │ 4 SEMANAS + 2 DIAS          │
│ 3-12 meses      │ X MES(ES) E Y DIA(S)     │ 5 MESES E 18 DIAS           │
│ 12-24 meses     │ X MESES (total)          │ 17 MESES, 20 MESES          │
│ 2-12 anos       │ X ANO(S) E Y MES(ES)     │ 2 ANOS E 3 MESES            │
│ ≥12 anos        │ X ANOS                   │ 12 ANOS, 15 ANOS            │
└─────────────────┴──────────────────────────┴─────────────────────────────┘

REGRAS CRÍTICAS:
1. Se receber data DD/MM/YYYY ou YYYY-MM-DD, calcule PRECISAMENTE a idade até HOJE
2. Use MAIÚSCULAS em todo o resultado
3. Plurais: ANO/ANOS, MES/MESES, DIA/DIAS, SEMANA/SEMANAS
4. Para 29 dias-3 meses: calcule semanas completas (7 dias = 1 semana) + dias restantes
5. Para 3-12 meses: mostre meses E dias (não ignore dias)
6. Para 12-24 meses: converta TUDO para meses totais (ex: 1 ano e 5 meses = 17 MESES)
7. Para 2-12 anos: mostre anos E meses (não ignore meses se >0)

EXEMPLOS DE CÁLCULO:
- Nasceu 20/11/2025, hoje ${todayStr} → 2 dias → "DV 2"
- Nasceu 20/10/2025, hoje ${todayStr} → ~33 dias → "4 SEMANAS + 5 DIAS"
- Nasceu 15/08/2025, hoje ${todayStr} → ~3 meses e 7 dias → "3 MESES E 7 DIAS"
- Nasceu 15/03/2024, hoje ${todayStr} → ~20 meses → "20 MESES"
- Nasceu 15/03/2023, hoje ${todayStr} → ~2 anos e 8 meses → "2 ANOS E 8 MESES"
- Nasceu 15/03/2013, hoje ${todayStr} → ~12 anos → "12 ANOS"

CALCULE COM PRECISÃO ABSOLUTA!`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `CALCULE E FORMATE: "${input}"

Passos obrigatórios:
1. Se for data, calcule idade exata até ${todayStr}
2. Determine dias totais, meses totais, anos totais
3. Identifique a faixa etária correta
4. Aplique o formato EXATO da tabela
5. Use MAIÚSCULAS

Responda apenas com o formato da tabela.` 
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "format_pediatric_age",
              description: "Retorna a idade formatada PRECISAMENTE seguindo padrões clínicos pediátricos brasileiros",
              parameters: {
                type: "object",
                properties: {
                  formatted_age: {
                    type: "string",
                    description: "Idade formatada em MAIÚSCULAS seguindo EXATAMENTE a tabela de formatação (ex: 'DV 14', '4 SEMANAS + 2 DIAS', '3 MESES E 7 DIAS', '17 MESES', '2 ANOS E 8 MESES', '12 ANOS')"
                  },
                  age_category: {
                    type: "string",
                    enum: ["neonatal", "weeks", "months", "months_only", "years_months", "years_only"],
                    description: "Categoria da idade identificada"
                  },
                  calculation_details: {
                    type: "string",
                    description: "Detalhes do cálculo realizado (ex: 'Nasceu 15/03/2023, hoje 22/11/2025: 2 anos, 8 meses, 7 dias. Faixa 2-12 anos → formato: X ANOS E Y MESES')"
                  }
                },
                required: ["formatted_age", "age_category", "calculation_details"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "format_pediatric_age" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione fundos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const result = JSON.parse(toolCall.function.arguments);

    console.log("Format result:", result);

    return new Response(
      JSON.stringify({
        formatted_age: result.formatted_age,
        age_category: result.age_category,
        explanation: result.calculation_details
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in format-pediatric-age:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
