import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const supabaseAuth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''));
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { imageBase64, mimeType, rawText } = await req.json();

    if (!imageBase64 && !rawText) {
      return new Response(JSON.stringify({ error: "Forneça imageBase64 ou rawText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um extrator de dados de documentos médicos e de identificação brasileiros (sistema PIS, RG, CNH, Cartão SUS, ficha hospitalar, etc).
Extraia os seguintes dados do paciente:
- patient_name: Nome completo
- mother_name: Nome da mãe (se disponível)
- birth_date: Data de nascimento no formato YYYY-MM-DD
- sex: Sexo (M, F ou Outro)
- cpf: CPF (apenas números)
- cns: Cartão Nacional de Saúde (se disponível)
- address: Endereço completo (logradouro + número)
- neighborhood: Bairro
- city: Cidade
- phone: Telefone (se disponível)
- medical_record: Número do prontuário do paciente no documento (também aparece como "Prontuário", "Pront.", "PRONT", "Nº Prontuário", "Registro", "Matrícula", "Ficha", "Atendimento", "RG Hospitalar", "PEP", "PIS Prontuário"). Retorne apenas o número/código (sem rótulo), preservando dígitos, letras e separadores como hífens.

Se um campo não for encontrado, retorne null. Responda APENAS via tool call.`;

    const userContent = rawText
      ? [{ type: "text", text: `Extraia os dados do paciente deste texto colado (pode estar bruto, com quebras estranhas):\n\n${rawText}` }]
      : [
          { type: "image_url", image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
          { type: "text", text: "Extraia os dados do paciente deste documento." }
        ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_patient_data",
              description: "Extrair dados estruturados do paciente a partir do documento",
              parameters: {
                type: "object",
                properties: {
                  patient_name: { type: "string", description: "Nome completo do paciente" },
                  mother_name: { type: "string", description: "Nome da mãe" },
                  birth_date: { type: "string", description: "Data de nascimento YYYY-MM-DD" },
                  sex: { type: "string", enum: ["M", "F", "Outro"] },
                  cpf: { type: "string", description: "CPF apenas números" },
                  cns: { type: "string", description: "Cartão Nacional de Saúde" },
                  address: { type: "string" },
                  neighborhood: { type: "string" },
                  city: { type: "string" },
                  phone: { type: "string" },
                },
                required: ["patient_name"],
                additionalProperties: false,
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_patient_data" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao processar imagem com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // Extract from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const extracted = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ success: true, data: extracted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify({ success: true, data: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Não foi possível extrair dados do documento" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Resposta inesperada da IA" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("extract-patient-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
