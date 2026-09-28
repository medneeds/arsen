/**
 * SAPS 3 — tabela de pontuacao, faixas e conversoes. Funcoes puras, testaveis
 * sem a tela (src/tests/saps3.test.ts).
 *
 * Referencia: Moreno RP et al. SAPS 3 — From evaluation of the patient to
 * evaluation of the intensive care unit. Part 2. Intensive Care Med
 * 2005;31:1345-55. Faixas conferidas com as calculadoras MedNerd (referencia
 * da Direcao Clinica) e MDCalc em 28/09/2026. Qualquer mudanca de faixa ou de
 * pontos aqui exige validacao da Direcao Clinica e atualizacao do teste.
 *
 * Preenchimento POR FAIXA: cada item e um conjunto de faixas com os pontos.
 * O medico escolhe a faixa; se digitar o valor exato, a faixa e marcada
 * sozinha. Valor numerico so e gravado quando foi digitado — faixa escolhida
 * sem valor nao inventa numero.
 *
 * Os codigos das opcoes categoricas (local, infeccao, status/sitio cirurgico,
 * comorbidades) sao os MESMOS ja gravados em avaliacoes_saps3: nenhuma coluna
 * recebe vocabulario novo.
 */

export interface Faixa {
  id: string;
  rotulo: string;
  pontos: number;
}

export interface ItemFaixas {
  faixas: Faixa[];
  /** Faixa correspondente a um valor numerico; null fora do dominio. */
  faixaDoValor?: (valor: number) => string | null;
}

const pontosDe = (item: ItemFaixas, id: string | null | undefined): number =>
  (id && item.faixas.find((f) => f.id === id)?.pontos) || 0;

// ───────────────────────────── Box I ─────────────────────────────

export const IDADE: ItemFaixas = {
  faixas: [
    { id: "lt40", rotulo: "< 40 anos", pontos: 0 },
    { id: "40_59", rotulo: "40–59", pontos: 5 },
    { id: "60_69", rotulo: "60–69", pontos: 9 },
    { id: "70_74", rotulo: "70–74", pontos: 13 },
    { id: "75_79", rotulo: "75–79", pontos: 15 },
    { id: "ge80", rotulo: "≥ 80", pontos: 18 },
  ],
  faixaDoValor: (v) => {
    if (v < 0 || v > 130) return null;
    if (v < 40) return "lt40";
    if (v < 60) return "40_59";
    if (v < 70) return "60_69";
    if (v < 75) return "70_74";
    if (v < 80) return "75_79";
    return "ge80";
  },
};

export const DIAS_ANTES_UTI: ItemFaixas = {
  faixas: [
    { id: "lt14", rotulo: "< 14 dias", pontos: 0 },
    { id: "14_27", rotulo: "14–27 dias", pontos: 6 },
    { id: "ge28", rotulo: "≥ 28 dias", pontos: 7 },
  ],
  faixaDoValor: (v) => {
    if (v < 0) return null;
    if (v < 14) return "lt14";
    if (v < 28) return "14_27";
    return "ge28";
  },
};

/** Codigos = origem_admissao ja gravada. SAPS 3: CC 0 · Emergencia 5 · Outra UTI 7 · Outros 8. */
export const LOCAL_ANTES_UTI: ItemFaixas = {
  faixas: [
    { id: "operating_room", rotulo: "Centro cirúrgico", pontos: 0 },
    { id: "emergency", rotulo: "Emergência / pronto-socorro", pontos: 5 },
    { id: "other_icu", rotulo: "Outra UTI", pontos: 7 },
    { id: "same_hospital_floor", rotulo: "Enfermaria / outros", pontos: 8 },
    { id: "other_hospital", rotulo: "Outro hospital", pontos: 8 },
  ],
};

/** Codigos = comorbidades ja gravadas. Somam entre si. */
export const COMORBIDADES: Faixa[] = [
  { id: "chemotherapy", rotulo: "Quimio, radio, imunossupressão ou corticoide", pontos: 3 },
  { id: "heart_failure_nyha4", rotulo: "Insuficiência cardíaca NYHA IV", pontos: 6 },
  { id: "cancer_hematologic", rotulo: "Câncer hematológico", pontos: 6 },
  { id: "cirrhosis", rotulo: "Cirrose", pontos: 8 },
  { id: "hiv_aids", rotulo: "HIV em fase AIDS", pontos: 8 },
  { id: "cancer_metastatic", rotulo: "Câncer metastático", pontos: 11 },
];

/**
 * Fichas antigas usavam codigos que nao existem no SAPS 3: imunossupressao
 * vira terapia oncologica/imunossupressora (mesmo item); doenca renal cronica
 * nao pontua no SAPS 3 e e descartada.
 */
export function normalizarComorbidades(ids: string[]): string[] {
  const validos = new Set(COMORBIDADES.map((c) => c.id));
  const out = new Set<string>();
  for (const id of ids || []) {
    const n = id === "immunosuppression" ? "chemotherapy" : id;
    if (validos.has(n)) out.add(n);
  }
  return Array.from(out);
}

export const VASOATIVO: ItemFaixas = {
  faixas: [
    { id: "nao", rotulo: "Não", pontos: 0 },
    { id: "sim", rotulo: "Sim", pontos: 3 },
  ],
};

// ───────────────────────────── Box II ─────────────────────────────

export const PLANEJADA: ItemFaixas = {
  faixas: [
    { id: "sim", rotulo: "Planejada", pontos: 0 },
    { id: "nao", rotulo: "Não planejada", pontos: 3 },
  ],
};

export interface MotivoAdmissao extends Faixa {
  /** Valor gravado em motivo_admissao (vocabulario ja existente). */
  grupo: "cardiovascular" | "neurological" | "hepatic" | "digestive" | "other";
}

/** Subitem gravado em motivo_admissao_detalhe (rotulo), grupo em motivo_admissao. */
export const MOTIVOS_ADMISSAO: MotivoAdmissao[] = [
  { id: "arritmia", rotulo: "Distúrbio de ritmo", grupo: "cardiovascular", pontos: -5 },
  { id: "choque_hipovolemico", rotulo: "Choque hipovolêmico (hemorrágico ou não)", grupo: "cardiovascular", pontos: 3 },
  { id: "choque_septico", rotulo: "Choque séptico", grupo: "cardiovascular", pontos: 5 },
  { id: "choque_outro", rotulo: "Choque anafilático, misto ou indefinido", grupo: "cardiovascular", pontos: 5 },
  { id: "convulsoes", rotulo: "Convulsões", grupo: "neurological", pontos: -4 },
  { id: "rebaixamento", rotulo: "Coma, estupor, rebaixamento, confusão, agitação ou delirium", grupo: "neurological", pontos: 4 },
  { id: "deficit_focal", rotulo: "Déficit neurológico focal", grupo: "neurological", pontos: 7 },
  { id: "efeito_massa", rotulo: "Efeito de massa intracraniano", grupo: "neurological", pontos: 10 },
  { id: "insuf_hepatica", rotulo: "Insuficiência hepática aguda", grupo: "hepatic", pontos: 6 },
  { id: "abdome_agudo", rotulo: "Abdome agudo", grupo: "digestive", pontos: 3 },
  { id: "pancreatite", rotulo: "Pancreatite grave", grupo: "digestive", pontos: 9 },
  { id: "outro", rotulo: "Outro motivo", grupo: "other", pontos: 0 },
];

export const MOTIVO: ItemFaixas = { faixas: MOTIVOS_ADMISSAO };

/**
 * Motivo gravado -> opcao. Ficha nova: o detalhe traz o rotulo do subitem.
 * Ficha antiga: so o grupo; "respiratory"/"other" sem detalhe equivalem a
 * "Outro motivo" (0 pts); cardiovascular/neurologico/digestivo sem detalhe nao
 * tem subitem definido e voltam SEM resposta, para o medico escolher.
 */
export function motivoDoBanco(grupo: string | null | undefined, detalhe: string | null | undefined): string {
  const porRotulo = MOTIVOS_ADMISSAO.find((m) => m.rotulo === (detalhe || "").trim());
  if (porRotulo) return porRotulo.id;
  if (grupo === "respiratory" || grupo === "other") return "outro";
  if (grupo === "hepatic") return "insuf_hepatica";
  return "";
}

/** Codigos = status_cirurgico ja gravado. */
export const STATUS_CIRURGICO: ItemFaixas = {
  faixas: [
    { id: "scheduled_surgery", rotulo: "Cirurgia programada", pontos: 0 },
    { id: "no_surgery", rotulo: "Sem cirurgia", pontos: 5 },
    { id: "emergency_surgery", rotulo: "Cirurgia de emergência", pontos: 6 },
  ],
};

export const teveCirurgia = (status: string | null | undefined) =>
  status === "scheduled_surgery" || status === "emergency_surgery";

/** Codigos = tipo_cirurgia ja gravado. So conta quando houve cirurgia. */
export const SITIO_CIRURGICO: ItemFaixas = {
  faixas: [
    { id: "transplant", rotulo: "Transplante", pontos: -11 },
    { id: "trauma", rotulo: "Trauma isolado ou politrauma", pontos: -8 },
    { id: "cardiac", rotulo: "Revascularização miocárdica sem troca valvar", pontos: -6 },
    { id: "neurosurgery", rotulo: "Neurocirurgia por AVC", pontos: 5 },
    { id: "other", rotulo: "Outros", pontos: 0 },
  ],
};

/** Codigos = infeccao_na_admissao ja gravada. */
export const INFECCAO: ItemFaixas = {
  faixas: [
    { id: "none", rotulo: "Sem infecção", pontos: 0 },
    { id: "other", rotulo: "Outra infecção", pontos: 0 },
    { id: "nosocomial", rotulo: "Nosocomial", pontos: 4 },
    { id: "respiratory", rotulo: "Respiratória", pontos: 5 },
  ],
};

// ───────────────────────────── Box III ─────────────────────────────

/** Glasgow mais baixo (numerico, sem o sufixo T). */
export const GLASGOW: ItemFaixas = {
  faixas: [
    { id: "ge13", rotulo: "≥ 13", pontos: 0 },
    { id: "7_12", rotulo: "7–12", pontos: 2 },
    { id: "6", rotulo: "6", pontos: 7 },
    { id: "5", rotulo: "5", pontos: 10 },
    { id: "3_4", rotulo: "3–4", pontos: 15 },
  ],
  faixaDoValor: (v) => {
    if (v < 3 || v > 15) return null;
    if (v >= 13) return "ge13";
    if (v >= 7) return "7_12";
    if (v === 6) return "6";
    if (v === 5) return "5";
    return "3_4";
  },
};

/** Frequencia cardiaca MAIS ALTA (bpm). */
export const FC: ItemFaixas = {
  faixas: [
    { id: "lt120", rotulo: "< 120", pontos: 0 },
    { id: "120_159", rotulo: "120–159", pontos: 5 },
    { id: "ge160", rotulo: "≥ 160", pontos: 7 },
  ],
  faixaDoValor: (v) => {
    if (v < 0 || v > 350) return null;
    if (v < 120) return "lt120";
    if (v < 160) return "120_159";
    return "ge160";
  },
};

/** Pressao sistolica, PIOR valor (MAIS BAIXA) da 1a hora (mmHg). */
export const PAS: ItemFaixas = {
  faixas: [
    { id: "ge120", rotulo: "≥ 120", pontos: 0 },
    { id: "70_119", rotulo: "70–119", pontos: 3 },
    { id: "40_69", rotulo: "40–69", pontos: 8 },
    { id: "lt40", rotulo: "< 40", pontos: 11 },
  ],
  faixaDoValor: (v) => {
    if (v < 0 || v > 350) return null;
    if (v < 40) return "lt40";
    if (v < 70) return "40_69";
    if (v < 120) return "70_119";
    return "ge120";
  },
};

/** Temperatura mais baixa (°C). */
export const TEMPERATURA: ItemFaixas = {
  faixas: [
    { id: "ge35", rotulo: "≥ 35 °C", pontos: 0 },
    { id: "lt35", rotulo: "< 35 °C", pontos: 7 },
  ],
  faixaDoValor: (v) => {
    if (v < 20 || v > 45) return null;
    return v < 35 ? "lt35" : "ge35";
  },
};

/** Bilirrubina total mais alta (mg/dL). */
export const BILIRRUBINA: ItemFaixas = {
  faixas: [
    { id: "lt2", rotulo: "< 2", pontos: 0 },
    { id: "2_5.9", rotulo: "2–5,9", pontos: 4 },
    { id: "ge6", rotulo: "≥ 6", pontos: 5 },
  ],
  faixaDoValor: (v) => {
    if (v < 0 || v > 80) return null;
    if (v < 2) return "lt2";
    if (v < 6) return "2_5.9";
    return "ge6";
  },
};

/** Creatinina mais alta (mg/dL). */
export const CREATININA: ItemFaixas = {
  faixas: [
    { id: "lt1.2", rotulo: "< 1,2", pontos: 0 },
    { id: "1.2_1.9", rotulo: "1,2–1,9", pontos: 2 },
    { id: "2_3.4", rotulo: "2–3,4", pontos: 7 },
    { id: "ge3.5", rotulo: "≥ 3,5", pontos: 8 },
  ],
  faixaDoValor: (v) => {
    if (v < 0 || v > 30) return null;
    if (v < 1.2) return "lt1.2";
    if (v < 2) return "1.2_1.9";
    if (v < 3.5) return "2_3.4";
    return "ge3.5";
  },
};

/** Leucocitos mais altos, em MILHARES/mm³ (a tela converte da contagem completa). */
export const LEUCOCITOS: ItemFaixas = {
  faixas: [
    { id: "lt15", rotulo: "< 15.000", pontos: 0 },
    { id: "ge15", rotulo: "≥ 15.000", pontos: 2 },
  ],
  faixaDoValor: (v) => {
    if (v < 0 || v > 500) return null;
    return v < 15 ? "lt15" : "ge15";
  },
};

/** Plaquetas mais baixas, em MILHARES/mm³. */
export const PLAQUETAS: ItemFaixas = {
  faixas: [
    { id: "ge100", rotulo: "≥ 100.000", pontos: 0 },
    { id: "50_99", rotulo: "50.000–99.999", pontos: 5 },
    { id: "20_49", rotulo: "20.000–49.999", pontos: 8 },
    { id: "lt20", rotulo: "< 20.000", pontos: 13 },
  ],
  faixaDoValor: (v) => {
    if (v < 0 || v > 3000) return null;
    if (v < 20) return "lt20";
    if (v < 50) return "20_49";
    if (v < 100) return "50_99";
    return "ge100";
  },
};

/** pH mais baixo. */
export const PH: ItemFaixas = {
  faixas: [
    { id: "gt7.25", rotulo: "> 7,25", pontos: 0 },
    { id: "le7.25", rotulo: "≤ 7,25", pontos: 3 },
  ],
  faixaDoValor: (v) => {
    if (v < 6.5 || v > 8) return null;
    return v <= 7.25 ? "le7.25" : "gt7.25";
  },
};

/**
 * Suporte ventilatorio e oxigenacao. Sem VM usa a PaO2; com VM usa a relacao
 * PaO2/FiO2. O valor digitado (P/F) so se aplica com VM.
 */
export const OXIGENACAO: ItemFaixas = {
  faixas: [
    { id: "sem_vm_ge60", rotulo: "Sem VM · PaO₂ ≥ 60", pontos: 0 },
    { id: "sem_vm_lt60", rotulo: "Sem VM · PaO₂ < 60", pontos: 5 },
    { id: "vm_ge100", rotulo: "Com VM · PaO₂/FiO₂ ≥ 100", pontos: 7 },
    { id: "vm_lt100", rotulo: "Com VM · PaO₂/FiO₂ < 100", pontos: 11 },
  ],
  faixaDoValor: (pf) => {
    if (pf < 0 || pf > 700) return null;
    return pf < 100 ? "vm_lt100" : "vm_ge100";
  },
};

export const emVentilacao = (oxigenacao: string | null | undefined) =>
  oxigenacao === "vm_ge100" || oxigenacao === "vm_lt100";

// ───────────────────────────── Escore ─────────────────────────────

export interface RespostasSaps3 {
  idade: string | null;
  dias: string | null;
  local: string | null;
  comorbidades: string[];
  vasoativo: string | null;
  planejada: string | null;
  motivo: string | null;
  statusCirurgico: string | null;
  sitioCirurgico: string | null;
  infeccao: string | null;
  glasgow: string | null;
  fc: string | null;
  pas: string | null;
  temperatura: string | null;
  bilirrubina: string | null;
  creatinina: string | null;
  leucocitos: string | null;
  plaquetas: string | null;
  ph: string | null;
  oxigenacao: string | null;
}

/** Item sem resposta soma 0 — a tela exige todos antes de validar. */
export function calcularSaps3(r: RespostasSaps3) {
  const comorb = normalizarComorbidades(r.comorbidades).reduce(
    (s, id) => s + (COMORBIDADES.find((c) => c.id === id)?.pontos || 0),
    0,
  );
  // 16 pontos de base: o menor escore possivel do SAPS 3 e 16.
  const box1 =
    16 +
    pontosDe(IDADE, r.idade) +
    pontosDe(DIAS_ANTES_UTI, r.dias) +
    pontosDe(LOCAL_ANTES_UTI, r.local) +
    comorb +
    pontosDe(VASOATIVO, r.vasoativo);
  const box2 =
    pontosDe(PLANEJADA, r.planejada) +
    pontosDe(MOTIVO, r.motivo) +
    pontosDe(STATUS_CIRURGICO, r.statusCirurgico) +
    (teveCirurgia(r.statusCirurgico) ? pontosDe(SITIO_CIRURGICO, r.sitioCirurgico) : 0) +
    pontosDe(INFECCAO, r.infeccao);
  const box3 =
    pontosDe(GLASGOW, r.glasgow) +
    pontosDe(FC, r.fc) +
    pontosDe(PAS, r.pas) +
    pontosDe(TEMPERATURA, r.temperatura) +
    pontosDe(BILIRRUBINA, r.bilirrubina) +
    pontosDe(CREATININA, r.creatinina) +
    pontosDe(LEUCOCITOS, r.leucocitos) +
    pontosDe(PLAQUETAS, r.plaquetas) +
    pontosDe(PH, r.ph) +
    pontosDe(OXIGENACAO, r.oxigenacao);
  const total = box1 + box2 + box3;
  return { box1, box2, box3, total, mortality: predictMortality(total) };
}

/** Equacao geral do SAPS 3 (Moreno 2005). */
export function predictMortality(totalScore: number): number {
  const logit = -32.6659 + Math.log(totalScore + 20.5958) * 7.3068;
  const probability = Math.exp(logit) / (1 + Math.exp(logit));
  return Math.round(probability * 1000) / 10;
}

/** Converte texto digitado ("7,25", "36.5") em numero; vazio/invalido -> null. */
export function lerNumero(valor: string | null | undefined): number | null {
  const t = (valor ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Faixa efetiva: valor digitado manda; sem valor, vale a faixa escolhida. */
export function faixaEfetiva(item: ItemFaixas, valorDigitado: number | null, faixaEscolhida: string | null | undefined): string | null {
  if (valorDigitado != null && item.faixaDoValor) return item.faixaDoValor(valorDigitado);
  return faixaEscolhida || null;
}

// ─────────────────── Leucocitos e plaquetas: unidades ───────────────────

/**
 * Leucocitos e plaquetas sao digitados como CONTAGEM COMPLETA por mm³
 * (ex.: 15000, 150000), sem "x10³" (pedido da Direcao Clinica, 28/09/2026).
 *
 * O banco (avaliacoes_saps3.leucocitos / plaquetas_mais_baixas) e as faixas de
 * pontuacao continuam em MILHARES, como sempre foram — assim as fichas antigas
 * e as novas ficam na mesma unidade. A conversao acontece so na borda da tela.
 */

/** Mantem apenas digitos: "15.000" -> "15000". Ponto e separador de milhar. */
export function somenteDigitos(valor: string): string {
  return (valor || "").replace(/\D/g, "");
}

/** Contagem completa ("15000") -> milhares (15). Vazio -> null. */
export function contagemParaMil(contagem: string): number | null {
  const d = somenteDigitos(contagem);
  if (!d) return null;
  return parseInt(d, 10) / 1000;
}

/**
 * Plaquetas para a coluna inteira do banco, em milhares. Trunca (floor) para
 * que o valor gravado caia na MESMA faixa da pontuacao: 19.600 -> 19 (< 20),
 * nunca 20.
 */
export function plaquetasParaBanco(contagem: string): number | null {
  const mil = contagemParaMil(contagem);
  return mil == null ? null : Math.floor(mil);
}

/** Valor do banco em milhares (15.5) -> contagem completa ("15500"). */
export function milParaContagem(mil: number | null | undefined): string {
  if (mil == null || Number.isNaN(Number(mil))) return "";
  return String(Math.round(Number(mil) * 1000));
}

/** "15000" -> "15.000" para exibicao no campo. */
export function formatarContagem(contagem: string): string {
  const d = somenteDigitos(contagem);
  if (!d) return "";
  return parseInt(d, 10).toLocaleString("pt-BR");
}
