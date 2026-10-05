/**
 * Normalizador do `soap` de uma admissao/evolucao para o arcabouço ESTRUTURADO novo.
 *
 * Motivo: ao longo das refatoracoes o formato mudou. Registros ANTIGOS guardam
 * CID, hipoteses, HDA, antecedentes e plano como TEXTO dentro de
 * subjective/assessment/plan; os registros novos ja trazem campos estruturados
 * (__cid_primary, diagnosticHypotheses[], antecedentes[], planItems[]). A UI nova
 * le o estruturado — entao o dado antigo "nao puxa". Este normalizador extrai os
 * campos de QUALQUER formato (estruturado quando existe, senao parseia o texto),
 * para o aproveitamento (ex.: copiar admissao -> evolucao) cair no lugar certo.
 *
 * Padroes de texto reconhecidos (admissao antiga):
 *  - subjective: "HDA:\n{hda}\n\nAMP: {antecedentes}\nMUC: {muc}\nAlergias: {alergias}"
 *  - assessment: "CID primario: {cod - desc}\nCID secundario: {...}\n\nHipoteses diagnosticas:\n{linhas}"
 *  - plan:       "{plano em linhas}\n\nPrevisao de alta: {...}"
 */

export interface NormalizedAdmission {
  /** "CODIGO - descricao" (ou "") */
  cidPrimary: string;
  /** lista de "CODIGO - descricao" */
  cidSecondary: string[];
  hypotheses: string[];
  /** HDA limpa (sem AMP/MUC/Alergias) — alimenta o campo "Evolucao" */
  hda: string;
  antecedentes: string[];
  planItems: string[];
}

const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
const asArr = (v: unknown): string[] =>
  Array.isArray(v) ? (v as unknown[]).map((x) => String(x).trim()).filter(Boolean) : [];

/**
 * Converte HTML de editor rico em texto com quebras de linha reais, PRESERVANDO
 * texto puro intacto. Evolucoes novas gravam o soap como HTML (<p><b>HDA</b>: …),
 * enquanto a admissao/D0 costuma ser texto puro com "\n". Sem isso, o parsing por
 * "\n" (HDA antes de AMP/MUC/Alergias) falharia nos registros em HTML.
 */
const htmlToLines = (raw: string): string => {
  if (!/[<&]/.test(raw)) return raw; // texto puro: nao mexe (preserva os \n)
  return raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(?:p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n");
};

export function normalizeAdmissionSoap(soap: Record<string, unknown> | null | undefined): NormalizedAdmission {
  const s = soap ?? {};
  const subjective = htmlToLines(asStr(s.subjective));
  const assessment = htmlToLines(asStr(s.assessment));
  const plan = htmlToLines(asStr(s.plan));

  // ── CID: estruturado (__cid_primary/secundario) ou do texto do assessment ──
  let cidPrimary = asStr(s.__cid_primary).trim();
  let cidSecondary = Array.isArray(s.__cid_secondary)
    ? asArr(s.__cid_secondary)
    : asStr(s.__cid_secondary).trim() ? [asStr(s.__cid_secondary).trim()] : [];
  if (!cidPrimary) {
    const m = assessment.match(/CID\s+prim[aá]rio\s*:\s*(.+)/i);
    if (m) cidPrimary = m[1].trim();
  }
  if (cidSecondary.length === 0) {
    const secs = [...assessment.matchAll(/CID\s+secund[aá]rio\s*:\s*(.+)/gi)]
      .map((x) => x[1].trim()).filter(Boolean);
    if (secs.length) cidSecondary = secs;
  }

  // ── Hipoteses: array estruturado ou bloco "Hipoteses diagnosticas:" ──
  let hypotheses = asArr(s.diagnosticHypotheses);
  if (hypotheses.length === 0) {
    const m = assessment.match(/Hip[oó]teses\s+diagn[oó]sticas\s*:\s*\n?([\s\S]*)$/i);
    if (m) hypotheses = m[1].split("\n").map((l) => l.trim()).filter(Boolean);
  }

  // ── HDA: tudo em subjective ANTES do bloco AMP/MUC/Alergias, sem o rotulo "HDA:".
  //    Robusto a: HDA vazia (nao arrasta o AMP), quebra simples ou dupla de linha
  //    antes do AMP, SSVV/gasometria no meio, e subjective sem o prefixo "HDA:". ──
  let hda = subjective;
  // Corta no PRIMEIRO marcador que encerra a HDA — inline (apos ponto) ou em
  // nova linha: AMP/MUC/Alergias (antecedentes/medicacoes/alergias) ou o inicio
  // da "Evolucao medica" (nota diaria, que nao e historia admissional).
  const cut = subjective.search(/(?:\bAMP\s*:|\bMUC\s*:|\bAlergias\s*:|Evolu[çc][aã]o\s+m[eé]dica\s*:)/i);
  if (cut >= 0) hda = subjective.slice(0, cut);
  hda = hda.replace(/^\s*HDA\s*:\s*/i, "").trim();

  // ── Antecedentes: array estruturado ou "AMP:" do subjective ──
  let antecedentes = asArr(s.antecedentes);
  if (antecedentes.length === 0) {
    const am = subjective.match(/\bAMP\s*:\s*(.+?)(?:\n\s*(?:MUC|Alergias)\b|\n\s*\n|$)/i);
    if (am) antecedentes = am[1].split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  }

  // ── Plano: array estruturado ou texto (sem o sufixo "Previsao de alta:") ──
  let planItems = asArr(s.planItems);
  if (planItems.length === 0) {
    const body = plan.replace(/\n*Previs[aã]o de alta\s*:[\s\S]*$/i, "").trim();
    if (body) planItems = body.split("\n").map((x) => x.trim()).filter(Boolean);
  }

  return { cidPrimary, cidSecondary, hypotheses, hda, antecedentes, planItems };
}
