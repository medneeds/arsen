// Edge function: detect-unidentified-patient
// Camada IA para casos ambíguos do reconhecimento de paciente NI.
// Usa Lovable AI Gateway com Gemini 3 Flash + structured output.

import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  name: string;
  arrivalMode?: string;
  context?: string;
}

interface AiResult {
  isUnidentified: boolean;
  confidence: number;
  reason: string;
  suggestedSex?: "M" | "F" | null;
}

const SYSTEM_PROMPT = `Você é um classificador clínico em português brasileiro.
Sua tarefa: dado um NOME de paciente (e contexto opcional), decidir se é provavelmente um paciente NÃO IDENTIFICADO (NI) chegando em emergência hospitalar.

Considere "NI" quando:
- Nome contém marcadores de identificação ausente: "NÃO IDENTIFICADO", "N/I", "S/N", "DESCONHECIDO", "IGNORADO".
- Apelidos institucionais: "TIO", "TIA", "FULANO", "BELTRANO", placeholders ("XXX", "???").
- Nome muito curto (1-2 caracteres) sem sobrenome plausível.
- Códigos administrativos como "PIS-12345", "PIN-2026-001".
- Padrões "MASC NI", "FEM NI", "MASCULINO SEM ID".
- Contexto indica trauma grave / paciente inconsciente sem documentos.

NÃO considere NI quando:
- Nome próprio brasileiro plausível, mesmo curto (ex.: "ANA SILVA", "JOAO LIMA", "MARIA").
- Nome estrangeiro plausível (ex.: "WANG LI", "JOSÉ").
- Apenas falta sobrenome (pode ser cadastro parcial legítimo).

Retorne JSON com isUnidentified, confidence (0..1), reason curto em PT-BR e suggestedSex se inferível.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.name || typeof body.name !== "string") {
      return new Response(
        JSON.stringify({ error: "Campo 'name' é obrigatório." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY ausente." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userPrompt = [
      `NOME: "${body.name}"`,
      body.arrivalMode ? `MODO DE CHEGADA: ${body.arrivalMode}` : null,
      body.context ? `CONTEXTO: ${body.context}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "classify_patient_identification",
                description:
                  "Classifica se um nome representa paciente não identificado.",
                parameters: {
                  type: "object",
                  properties: {
                    isUnidentified: { type: "boolean" },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    reason: { type: "string", maxLength: 200 },
                    suggestedSex: {
                      type: ["string", "null"],
                      enum: ["M", "F", null],
                    },
                  },
                  required: ["isUnidentified", "confidence", "reason"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "classify_patient_identification" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[detect-unidentified-patient] AI gateway error", {
        status: aiResponse.status,
        body: errText,
      });
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({ error: "Falha ao consultar IA." }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall =
      aiData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!toolCall) {
      return new Response(
        JSON.stringify({
          isUnidentified: false,
          confidence: 0,
          reason: "Resposta da IA sem tool_call.",
          suggestedSex: null,
        } satisfies AiResult),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const parsed = JSON.parse(toolCall) as AiResult;
    return new Response(
      JSON.stringify({
        isUnidentified: !!parsed.isUnidentified,
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0)),
        reason: parsed.reason || "Sem justificativa.",
        suggestedSex: parsed.suggestedSex ?? null,
      } satisfies AiResult),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[detect-unidentified-patient] error", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao classificar nome." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
