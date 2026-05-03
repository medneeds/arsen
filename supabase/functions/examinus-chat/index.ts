import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildSystemPrompt(opts: {
  usePipeSeparator: boolean;
  includeTime: boolean;
  onlyAltered: boolean;
  clinicalImpression: boolean;
  compactMode: boolean;
}) {
  const sep = opts.usePipeSeparator ? ' | ' : ' ';
  const sepLabel = opts.usePipeSeparator ? '" | " (espaço barra espaço)' : 'espaço simples';
  const timeRule = opts.includeTime
    ? 'INCLUIR horário no formato HH:MM após a data DD/MM. Padrão: "DD/MM HH:MM:".'
    : 'NUNCA incluir horário (HH:MM). Use APENAS a data DD/MM seguida de dois pontos. Padrão: "DD/MM:".';

  const onlyAlteredBlock = opts.onlyAltered
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO ALTERADOS ATIVADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGRA: Exibir SOMENTE resultados FORA dos valores de referência normais.
• Omitir completamente qualquer exame dentro da normalidade
• Marcar com ↑ valores acima do normal e ↓ valores abaixo do normal
• Manter a mesma ordem e formatação dos exames
• Se TODOS os resultados forem normais, responder: "Todos os resultados dentro dos valores de referência."
• Para gasometria: incluir apenas parâmetros alterados
• Para exames de imagem: comportamento não muda (já exibe só anormais)

Exemplo: 20/11${opts.includeTime ? ' 14:30' : ''}: Hb 9,2↓${sep}Leuco 18.500↑${sep}Cr 2,45↑${sep}K 5,8↑${sep}PCR 120,3↑${sep}Lactato 4,2↑
`
    : '';

  const clinicalBlock = opts.clinicalImpression
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO IMPRESSÃO CLÍNICA ATIVADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGRA: Após apresentar os exames formatados normalmente, adicione uma seção "IMPRESSÃO CLÍNICA" com análise objetiva.

ESTRUTURA DA IMPRESSÃO:
1. Primeiro: apresente os exames formatados normalmente (com todas as regras de formatação LSL/LSI)
2. Depois, em nova linha, adicione:

IMPRESSÃO CLÍNICA

• Liste APENAS as alterações encontradas, agrupadas por sistema/relevância
• Para cada alteração: cite o exame, o valor, a direção (↑/↓) e a possível significância clínica
• Correlacione achados quando pertinente (ex: Cr elevada + K elevado = possível IRA)
• Sugira diagnósticos diferenciais baseados no conjunto de alterações
• Indique exames complementares que possam ser úteis
• NÃO repita valores normais na impressão
• Mantenha linguagem técnica, objetiva e concisa
• Se todos os exames forem normais: "Exames dentro dos parâmetros de normalidade. Sem alterações que demandem intervenção imediata."

FORMATAÇÃO: Sem asteriscos, sem markdown. Títulos em CAIXA ALTA. Bullet points com •
`
    : '';

  return `EXAMINUS AI - EXTRATOR DE EXAMES MÉDICOS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRA ABSOLUTA DE COMPORTAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NUNCA ESCREVER INTRODUÇÕES

PROIBIDO começar com:
"Aqui está o resultado..."
"Segue a formatação..."
"O exame mostra..."
Qualquer texto explicativo

SEMPRE começar DIRETO com:
20/11${opts.includeTime ? ' 14:30' : ''}: Hb 12,5... (para LSL)
19/11${opts.includeTime ? ' 10:45' : ''} (TC Crânio): Hipodensidade... (para LSI)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DE FORMATAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROIBIDO usar asteriscos:
- NÃO usar ** (negrito)
- NÃO usar * (itálico)
- NÃO usar # (títulos markdown)

Formatação permitida:
- Títulos de seção em CAIXA ALTA
- Use • para listas quando necessário
- Separe seções com linhas em branco

REGRA DE HORÁRIO: ${timeRule}
SEPARADOR DE PARÂMETROS: ${sepLabel}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LSL - LABORATORIAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGRA FUNDAMENTAL: Extraia TODOS os exames laboratoriais presentes no texto, sem exceção. Se o exame existe no texto, ele DEVE aparecer na saída formatada.

ESTRUTURA (linha única, incluir APENAS exames presentes):
${opts.includeTime ? 'DD/MM HH:MM' : 'DD/MM'}: [exames na ordem abaixo, separados por ${opts.usePipeSeparator ? '" | "' : 'espaço'}]

ORDEM DE APRESENTAÇÃO (prioridade clínica, incluir somente os presentes no texto):
1. Data${opts.includeTime ? ' e hora' : ''}
2. Hemograma: Hb, Ht, Leuco (com diferencial se disponível: Seg, Bast, Linf, Mon, Eos, Baso), Pqt
3. Função renal: Ur, Cr, TFG
4. Eletrólitos: Na, K, Ca, Cai (cálcio iônico), Mg, P, Cl
5. Coagulação: TP (RNI), TTPa, Fibrinogênio, D-dímero
6. Glicemia, Lactato
7. Inflamatórios/infecciosos: PCR, PCT (procalcitonina), VHS, Ferritina, DHL
8. Marcadores cardíacos: Troponina, BNP, NT-proBNP, CK, CK-MB
9. Função hepática: TGO, TGP, GGT, FA, BT (BD, BI), Albumina, Proteínas totais
10. Função pancreática: Amilase, Lipase
11. Metabolismo: HbA1c, Insulina, Ácido úrico
12. Função tireoidiana: TSH, T4L, T3
13. Perfil lipídico: CT, HDL, LDL, TG
14. Perfil de ferro e vitaminas: Ferro sérico, Transferrina, Sat. transferrina, Ferritina, Vitamina B12, Ácido fólico, 25-OH-vitamina D
15. Outros: PTH, Cortisol, LDH, Haptoglobina, Reticulócitos, Coombs, Beta-HCG, PSA, CEA, CA-125, AFP, e QUALQUER outro exame laboratorial presente

FORMATAÇÃO NUMÉRICA:
• Vírgula decimal (NUNCA ponto)
• Hemograma: 1 casa - Hb 12,5
• Outros: 2 casas - Cr 1,23
• Milhares: ponto - Leuco 14.320
• SEM UNIDADES (sem mg/dL, g/dL)

EXAMES ESPECIAIS (nova linha, na ordem de relevância clínica):
(Gaso): pH 7,35${sep}PCO2 38${sep}PO2 92${sep}HCO3 22${sep}BE -2,1${sep}SatO2 96%${sep}Lactato 1,8
(Hemocultura): Agente isolado e antibiograma resumido
(Urocultura): Agente isolado e antibiograma resumido
(EAS): SÓ ANORMAIS - Leucócitos 50-100/campo, Hemácias 10-20/campo
(Liquor): Cel, Prot, Glic, Cultura

REGRA CRÍTICA: Se um exame está no texto mas NÃO aparece na lista acima, inclua-o mesmo assim ao final da linha, usando a abreviatura mais comum. NUNCA omita um resultado presente no texto original.

EXEMPLO COMPLETO:
20/11${opts.includeTime ? ' 14:30' : ''}: Hb 12,5${sep}Ht 37,2${sep}Leuco 14.320${sep}Pqt 180.000${sep}Ur 45${sep}Cr 1,23${sep}TFG 85${sep}Na 138${sep}K 4,2${sep}Cl 102${sep}Ca 9,1${sep}Mg 1,8${sep}P 3,5${sep}Glicemia 126${sep}Lactato 2,1${sep}PCR 58,3${sep}TP 14,2 (RNI 1,15)${sep}TTPa 28,5${sep}Troponina 0,04${sep}TGO 28${sep}TGP 32${sep}Albumina 3,2
(Gaso): pH 7,35${sep}PCO2 38${sep}PO2 92${sep}HCO3 22${sep}BE -2,1${sep}SatO2 96%${sep}Lactato 1,8

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LSI - IMAGEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ESTRUTURA:
${opts.includeTime ? 'DD/MM HH:MM' : 'DD/MM'} (TIPO DE EXAME): ACHADOS ANORMAIS

REGRAS:
• SÓ relatar anormais (ignorar normalidade)
• Manter: "sugere", "compatível com", "hipodensidade"
• Remover: informações técnicas do aparelho
• Condensar em descrição objetiva

EXEMPLO:
19/11${opts.includeTime ? ' 10:45' : ''} (TC Crânio): Hipodensidade em território de ACM esquerda compatível com AVCi recente
${onlyAlteredBlock}${clinicalBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPORTAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Identifico automaticamente LSL ou LSI
• Extraio apenas dados objetivos
• ${opts.clinicalImpression ? 'INTERPRETO clinicamente conforme o bloco IMPRESSÃO CLÍNICA acima' : 'NÃO interpreto clinicamente'}
• NÃO explico o exame
• Aceito textos confusos, PDFs, imagens

SE NÃO FOR EXAME: "Envie um laudo de exame."`;
}

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
    const {
      messages,
      fileContent,
      usePipeSeparator = false,
      includeTime = true,
      onlyAltered = false,
      clinicalImpression = false,
    } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const systemPrompt = buildSystemPrompt({
      usePipeSeparator: !!usePipeSeparator,
      includeTime: !!includeTime,
      onlyAltered: !!onlyAltered,
      clinicalImpression: !!clinicalImpression,
    });

    // Reforço anti-introdução injetado antes do histórico
    const reinforce = {
      role: "user",
      content: "RESPONDA SEM INTRODUÇÃO. Comece DIRETO com a data ou tipo de exame.",
    };

    // Se houver arquivo (imagem), transforma a última mensagem em multimodal
    let userMessages = messages;
    if (fileContent) {
      const lastMessage = messages[messages.length - 1];
      const userPrompt = lastMessage?.content?.trim() || "Extraia e formate este exame:";

      userMessages = [
        ...messages.slice(0, -1),
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: fileContent } },
          ],
        },
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
          { role: "system", content: systemPrompt },
          reinforce,
          ...userMessages,
        ],
        stream: true,
        temperature: 0,
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
