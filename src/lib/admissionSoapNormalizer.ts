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
  /** HDA limpa (sem AMP/MUC/Alergias e SEM o bloco de exames laboratoriais) */
  hda: string;
  antecedentes: string[];
  planItems: string[];
  /** Exames complementares (ex.: "Lab admissional: ...") separados da HDA. */
  complementares: string;
  /** Medicacoes de uso continuo (MUC). "" quando ausente/Desconhecidas vazio. */
  muc: string;
  /** Alergias. "" quando ausente. */
  allergies: string;
  /** Rotulo cru da previsao de alta (ex.: "01/10/2026 (D+5)"), "" se ausente. */
  dischargeLabel: string;
}

const asStr = (v: unknown): string => (typeof v === "string" ? v : "");

/** "—"/"-"/vazio contam como sem conteudo. */
const cleanField = (v: string): string => {
  const t = v.trim();
  return t === "—" || t === "-" ? "" : t;
};

/**
 * Converte um valor que pode ser array real OU uma string JSON de array
 * (["a","b"]) em lista de strings. Registros antigos gravaram hipoteses como
 * JSON serializado numa unica linha — sem isso, viram um item unico com o array
 * cru dentro (bug visto na tela: ["Estado de mal epileptico","PNM?"]).
 */
export const parseMaybeJsonArray = (v: string): string[] | null => {
  const t = v.trim();
  if (!(t.startsWith("[") && t.endsWith("]"))) return null;
  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
  } catch { /* nao era JSON valido */ }
  return null;
};

const asArr = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  const items = (v as unknown[]).map((x) => String(x).trim()).filter(Boolean);
  // Caso degenerado: array de um unico elemento que e um JSON de array.
  if (items.length === 1) {
    const inner = parseMaybeJsonArray(items[0]);
    if (inner) return inner;
  }
  return items;
};

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

  // ── Hipoteses: array estruturado, texto __diagnostic_hypotheses, ou bloco
  //    "Hipoteses diagnosticas:" do assessment. Tolera JSON de array em string. ──
  let hypotheses = asArr(s.diagnosticHypotheses);
  if (hypotheses.length === 0 && asStr(s.__diagnostic_hypotheses).trim()) {
    const raw = asStr(s.__diagnostic_hypotheses).trim();
    hypotheses = parseMaybeJsonArray(raw) ?? raw.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  if (hypotheses.length === 0) {
    // limita ao bloco das hipoteses: para na 1a linha em branco (separador do
    // bloco UTI/cirurgico que vem depois no assessment).
    const m = assessment.match(/Hip[oó]teses\s+diagn[oó]sticas\s*:\s*\n?([\s\S]*?)(?:\n\s*\n|$)/i);
    if (m) hypotheses = parseMaybeJsonArray(m[1].trim()) ?? m[1].split("\n").map((l) => l.trim()).filter(Boolean);
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

  // ── Exames complementares: o medico costuma digitar o laboratorio no fim da
  //    HDA ("Lab admissional: ..."). Separa esse bloco para o campo proprio. ──
  let complementares = "";
  const labIdx = hda.search(/^[ \t]*(?:lab(?:orat[oó]rio)?(?:\s+admissional)?|exames?(?:\s+complementares)?|complementares)\s*:/im);
  if (labIdx >= 0) {
    complementares = hda.slice(labIdx).trim();
    hda = hda.slice(0, labIdx).trim();
  }

  // ── Antecedentes (AMP): array estruturado ou "AMP:" do subjective ──
  let antecedentes = asArr(s.antecedentes);
  if (antecedentes.length === 0) {
    const am = subjective.match(/\bAMP\s*:\s*(.+?)(?:\n\s*(?:MUC|Alergias)\b|\n\s*\n|$)/i);
    if (am) antecedentes = am[1].split(/[,;\n]/).map((x) => x.trim()).filter((x) => x && x !== "—");
  }

  // ── MUC (medicacoes de uso continuo) e Alergias: texto do subjective ──
  let muc = "";
  const mucM = subjective.match(/\bMUC\s*:\s*([\s\S]*?)(?:\n\s*(?:Alergias|CID|Hip[oó]teses|Motivo)\b|\n\s*\n|$)/i);
  if (mucM) muc = cleanField(mucM[1]);
  let allergies = "";
  const algM = subjective.match(/\bAlergias\s*:\s*([\s\S]*?)(?:\n\s*(?:CID|Hip[oó]teses|Motivo)\b|\n\s*\n|$)/i);
  if (algM) allergies = cleanField(algM[1]);

  // ── Plano: array estruturado ou texto (sem o sufixo "Previsao de alta:") ──
  let planItems = asArr(s.planItems);
  if (planItems.length === 0) {
    const body = plan.replace(/\n*Previs[aã]o de alta\s*:[\s\S]*$/i, "").trim();
    if (body) planItems = body.split("\n").map((x) => x.trim()).filter(Boolean);
  }

  // ── Previsao de alta: rotulo cru ("01/10/2026 (D+5)") ──
  let dischargeLabel = "";
  const dal = plan.match(/Previs[aã]o de alta\s*:\s*(.+)/i);
  if (dal) dischargeLabel = cleanField(dal[1]);

  return {
    cidPrimary, cidSecondary, hypotheses, hda, antecedentes, planItems,
    complementares, muc, allergies, dischargeLabel,
  };
}
