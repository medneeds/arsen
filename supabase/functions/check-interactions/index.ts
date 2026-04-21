import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { medications, patientContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    if (!medications || !Array.isArray(medications) || medications.length < 2) {
      return new Response(JSON.stringify({ error: "São necessários pelo menos 2 medicamentos para verificar interações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const medicationList = medications.map((m: { name: string; dose: string; route: string; posology: string }) =>
      `- ${m.name} ${m.dose !== '-' ? m.dose : ''} ${m.route !== '-' ? m.route : ''} ${m.posology !== '-' ? m.posology : ''}`.trim()
    ).join('\n');

    const patientInfo = patientContext
      ? `\nCONTEXTO DO PACIENTE:\n- Idade: ${patientContext.age || 'NI'}\n- Sexo: ${patientContext.sex || 'NI'}\n- Peso: ${patientContext.weight || 'NI'}\n- Alergias: ${patientContext.allergies || 'Nenhuma conhecida'}`
      : '';

    const systemPrompt = `Você é um farmacêutico clínico especialista em interações medicamentosas em ambiente hospitalar (urgência/emergência e UTI).

TAREFA: Analise as interações medicamentosas da prescrição abaixo e retorne um relatório estruturado.

FORMATO DE RESPOSTA OBRIGATÓRIO (use exatamente estas seções com os emojis):

## 🔴 Interações Graves (Contraindicadas ou Alto Risco)
Para cada interação grave encontrada:
**[Medicamento A] + [Medicamento B]** — Gravidade: ALTA
- Mecanismo: [explicação breve]
- Risco clínico: [consequência]
- Conduta sugerida: [o que fazer]

## 🟡 Interações Moderadas (Monitorar)
Para cada interação moderada:
**[Medicamento A] + [Medicamento B]** — Gravidade: MODERADA
- Mecanismo: [explicação breve]
- Risco clínico: [consequência]
- Conduta sugerida: [monitorização ou ajuste]

## 🟢 Interações Leves ou Sem Interações Relevantes
Breve nota sobre combinações seguras ou interações de baixa relevância clínica.

## 📋 Resumo
- Total de interações graves: X
- Total de interações moderadas: X
- Recomendação geral: [uma frase resumindo a segurança da prescrição]

REGRAS:
1. Se NÃO houver interações em alguma categoria, escreva "Nenhuma identificada."
2. Seja objetivo e clinicamente relevante — foque em interações com impacto real
3. Considere via de administração e dose quando disponíveis
4. Priorize interações farmacodinâmicas e farmacocinéticas clinicamente significativas
5. Dietas, cuidados de enfermagem e itens não-medicamentosos NÃO devem ser incluídos na análise de interações
6. NÃO invente interações — se não tiver certeza, mencione que a interação é "potencial" ou "teórica"`;

    const userMessage = `PRESCRIÇÃO MÉDICA:
${medicationList}
${patientInfo}

Analise todas as interações medicamentosas entre os itens acima.`;

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
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao consultar IA." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("check-interactions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
