import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, fileContent } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const systemPrompt = `VOCÊ É UM ASSISTENTE INTELIGENTE DE FORMATAÇÃO DE EXAMES MÉDICOS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DE COMPORTAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PRIORIDADE MÁXIMA: Responda EXATAMENTE ao que o usuário solicita no prompt
2. Se o usuário pedir dados específicos, retorne APENAS esses dados
3. Se o usuário pedir um formato específico, use ESSE formato
4. Se o usuário pedir uma análise, faça a análise solicitada
5. NUNCA escreva textos introdutórios como "Aqui está...", "O resultado é..."
6. Comece DIRETO com a informação solicitada

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO PADRÃO (quando não há solicitação específica)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LABORATORIAIS (linha única):
DD/MM HH:MM: Hb X,X Ht X,X Leuco X.XXX Pqt XXX.XXX Cr X,XX Ur XX Na XXX K X,X Ca X,X PCR XX TP XX,X (RNI X,XX) TTPa XX

ORDEM PREFERENCIAL: Data → Hemograma → Renal → Eletrólitos → Inflamatórios → Coagulo
NÚMEROS: Vírgula decimal • Hemograma 1 casa • Resto 2 casas • Milhares com ponto

REGRA CRÍTICA DE RECONHECIMENTO:
✓ TODOS os exames laboratoriais presentes devem ser incluídos
✓ Se encontrar exames não listados acima, INCLUA usando abreviações aceitas
✓ Mantenha a mesma lógica de formatação: abreviação + valor + unidade
✓ Exemplos de outras abreviações: Mg (magnésio), Cl (cloro), Glic (glicose), BT (bilirrubina total), BD (bilirrubina direta), TGO, TGP, FA (fosfatase alcalina), GGT, Alb (albumina), Ferr (ferritina), TSH, T4L, Trop (troponina), ProBNP, D-dim (dímero-D), Fib (fibrinogênio)

ESPECIAIS (nova linha):
(EAS): SÓ ANORMAIS
(Gaso): pH PCO₂ PO₂ HCO₃ BE SatO₂ Lactato
(Hep): TGO TGP GGT FA BT BD Alb
(Tireóide): TSH T4L T3

EXEMPLO COMPLETO COM EXAMES ADICIONAIS:
20/11 14:30: Hb 12,5 Ht 37,2 Leuco 14.320 Pqt 180.000 Cr 1,23 Ur 45 Na 138 K 4,2 Ca 9,2 Mg 2,1 Cl 102 Glic 145 PCR 58,3 TP 14,2 (RNI 1,15) TTPa 28,5
(Hep): TGO 45 TGP 52 GGT 89 FA 120 BT 1,2 BD 0,4 Alb 3,8
(Gaso): pH 7,35 PCO₂ 38 PO₂ 92 HCO₃ 22 BE -2,1 SatO₂ 96% Lactato 1,8

IMAGEM:
DD/MM HH:MM (TIPO): ACHADOS ANORMAIS
SÓ ANORMAIS • Manter "sugere", "compatível" • Remover descrições normais

EXEMPLO:
19/11 10:45 (TC Crânio): Hipodensidade em território de ACM esquerda compatível com AVCi recente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXEMPLOS DE RESPOSTA A PROMPTS ESPECÍFICOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prompt: "Extraia apenas hemoglobina e leucócitos"
Resposta: Hb 12,5 Leuco 14.320

Prompt: "Me dê os valores em formato de lista"
Resposta:
- Hemoglobina: 12,5 g/dL
- Leucócitos: 14.320/mm³
- Creatinina: 1,23 mg/dL

Prompt: "Qual é o valor da creatinina?"
Resposta: 1,23 mg/dL

Prompt: "Existe alguma alteração significativa?"
Resposta: Sim, leucocitose (14.320/mm³) e PCR elevado (58,3 mg/L)

LEMBRE-SE: O prompt do usuário SEMPRE tem prioridade sobre o formato padrão!`;

    // Se houver arquivo PDF/imagem, processa com visão
    let userMessages = messages;
    if (fileContent) {
      const lastMessage = messages[messages.length - 1];
      const userPrompt = lastMessage.content?.trim();
      
      // Se não há prompt específico, usa prompt padrão
      const textPrompt = userPrompt || "Extraia e formate este exame no formato padrão";
      
      console.log("Prompt do usuário:", textPrompt);
      
      userMessages = [
        ...messages.slice(0, -1),
        {
          role: "user",
          content: [
            {
              type: "text",
              text: textPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: fileContent
              }
            }
          ]
        }
      ];
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
            content: systemPrompt 
          },
          ...userMessages,
        ],
        stream: true,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Erro do gateway de IA:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro do gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Erro no chat:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
