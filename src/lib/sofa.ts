/**
 * SOFA (Sequential Organ Failure Assessment) para a admissao em UTI.
 *
 * Seis componentes, cada um de 0 a 4 pontos; total 0-24. As FAIXAS sao proprias
 * do SOFA (diferentes do SAPS 3 — ver src/lib/saps3.ts), mas os VALORES CRUS
 * (PaO2/FiO2, plaquetas, bilirrubina, creatinina, Glasgow) sao os mesmos que a
 * ficha SAPS ja captura, entao da para pre-preencher via `faixaDoValor`.
 *
 * Modelo espelha saps3.ts (Faixa/ItemFaixas), para consistencia de UI (pills
 * clicaveis) e de calculo.
 *
 * ATENCAO (cardiovascular): no SOFA completo, o uso de vasopressor e
 * estratificado por agente/dose (2 a 4 pontos). Aqui, a pedido, colapsamos em um
 * unico item "em droga vasoativa". O valor de pontos desse item (SOFA_VASOATIVO_PONTOS)
 * esta isolado para revisao clinica — ajuste num lugar so se a convencao mudar.
 */

export interface SofaFaixa {
  id: string;
  rotulo: string;
  pontos: number;
}

export interface SofaComponente {
  key: "respiracao" | "coagulacao" | "figado" | "cardiovascular" | "neurologico" | "renal";
  titulo: string;
  faixas: SofaFaixa[];
  /** Pre-seleciona a faixa a partir de um valor cru (quando aplicavel). */
  faixaDoValor?: (valor: number) => string | null;
}

// Pontos do item "em droga vasoativa" (cardiovascular). Isolado para revisao:
// no SOFA real varia 2-4 por dose; aqui e bucket unico.
export const SOFA_VASOATIVO_PONTOS = 3;

export const SOFA_RESPIRACAO: SofaComponente = {
  key: "respiracao",
  titulo: "Respiração (PaO₂/FiO₂)",
  faixas: [
    { id: "ge400", rotulo: "≥ 400", pontos: 0 },
    { id: "lt400", rotulo: "< 400", pontos: 1 },
    { id: "lt300", rotulo: "< 300", pontos: 2 },
    { id: "lt200_suporte", rotulo: "< 200 com suporte respiratório", pontos: 3 },
    { id: "lt100_suporte", rotulo: "< 100 com suporte respiratório", pontos: 4 },
  ],
  // Pre-selecao aproximada pelo valor de PF; os itens com "suporte" exigem
  // confirmacao clinica (o valor cru nao carrega o suporte), por isso <200 e
  // <100 so sao sugeridos quando o PF esta claramente nessas faixas.
  faixaDoValor: (v) => {
    if (!Number.isFinite(v)) return null;
    if (v >= 400) return "ge400";
    if (v >= 300) return "lt400";
    if (v >= 200) return "lt300";
    if (v >= 100) return "lt200_suporte";
    return "lt100_suporte";
  },
};

export const SOFA_COAGULACAO: SofaComponente = {
  key: "coagulacao",
  titulo: "Coagulação (plaquetas ×10³/µL)",
  faixas: [
    { id: "ge150", rotulo: "≥ 150 mil", pontos: 0 },
    { id: "lt150", rotulo: "< 150", pontos: 1 },
    { id: "lt100", rotulo: "< 100", pontos: 2 },
    { id: "lt50", rotulo: "< 50", pontos: 3 },
    { id: "lt20", rotulo: "< 20", pontos: 4 },
  ],
  faixaDoValor: (v) => {
    if (!Number.isFinite(v)) return null;
    if (v >= 150) return "ge150";
    if (v >= 100) return "lt150";
    if (v >= 50) return "lt100";
    if (v >= 20) return "lt50";
    return "lt20";
  },
};

export const SOFA_FIGADO: SofaComponente = {
  key: "figado",
  titulo: "Fígado (bilirrubina mg/dL)",
  faixas: [
    { id: "lt1_2", rotulo: "< 1,2", pontos: 0 },
    { id: "1_2_1_9", rotulo: "1,2 – 1,9", pontos: 1 },
    { id: "2_5_9", rotulo: "2,0 – 5,9", pontos: 2 },
    { id: "6_11_9", rotulo: "6,0 – 11,9", pontos: 3 },
    { id: "ge12", rotulo: "≥ 12", pontos: 4 },
  ],
  faixaDoValor: (v) => {
    if (!Number.isFinite(v)) return null;
    if (v < 1.2) return "lt1_2";
    if (v < 2) return "1_2_1_9";
    if (v < 6) return "2_5_9";
    if (v < 12) return "6_11_9";
    return "ge12";
  },
};

export const SOFA_CARDIOVASCULAR: SofaComponente = {
  key: "cardiovascular",
  titulo: "Cardiovascular",
  faixas: [
    { id: "pam_ge70", rotulo: "PAM ≥ 70", pontos: 0 },
    { id: "pam_lt70", rotulo: "PAM < 70", pontos: 1 },
    { id: "vasoativo", rotulo: "Em droga vasoativa", pontos: SOFA_VASOATIVO_PONTOS },
  ],
  // PAM e numerica; o "vasoativo" e selecao manual (nao deriva de valor).
  faixaDoValor: (v) => {
    if (!Number.isFinite(v)) return null;
    return v >= 70 ? "pam_ge70" : "pam_lt70";
  },
};

export const SOFA_NEUROLOGICO: SofaComponente = {
  key: "neurologico",
  titulo: "Neurológico (Glasgow)",
  faixas: [
    { id: "g15", rotulo: "15", pontos: 0 },
    { id: "g13_14", rotulo: "13 – 14", pontos: 1 },
    { id: "g10_12", rotulo: "10 – 12", pontos: 2 },
    { id: "g6_9", rotulo: "6 – 9", pontos: 3 },
    { id: "g3_5", rotulo: "3 – 5", pontos: 4 },
  ],
  faixaDoValor: (v) => {
    if (!Number.isFinite(v)) return null;
    if (v >= 15) return "g15";
    if (v >= 13) return "g13_14";
    if (v >= 10) return "g10_12";
    if (v >= 6) return "g6_9";
    return "g3_5";
  },
};

export const SOFA_RENAL: SofaComponente = {
  key: "renal",
  titulo: "Renal (creatinina mg/dL)",
  faixas: [
    { id: "lt1_2", rotulo: "< 1,2", pontos: 0 },
    { id: "1_2_1_9", rotulo: "1,2 – 1,9", pontos: 1 },
    { id: "2_3_4", rotulo: "2,0 – 3,4", pontos: 2 },
    { id: "3_5_4_9", rotulo: "3,5 – 4,9", pontos: 3 },
    { id: "ge5", rotulo: "≥ 5", pontos: 4 },
  ],
  faixaDoValor: (v) => {
    if (!Number.isFinite(v)) return null;
    if (v < 1.2) return "lt1_2";
    if (v < 2) return "1_2_1_9";
    if (v < 3.5) return "2_3_4";
    if (v < 5) return "3_5_4_9";
    return "ge5";
  },
};

export const SOFA_COMPONENTES: SofaComponente[] = [
  SOFA_RESPIRACAO,
  SOFA_COAGULACAO,
  SOFA_FIGADO,
  SOFA_CARDIOVASCULAR,
  SOFA_NEUROLOGICO,
  SOFA_RENAL,
];

export type SofaRespostas = Partial<Record<SofaComponente["key"], string | null>>;

/** Pontos de um componente a partir do id da faixa selecionada (0 se ausente). */
export function pontosComponente(comp: SofaComponente, id: string | null | undefined): number {
  if (!id) return 0;
  return comp.faixas.find((f) => f.id === id)?.pontos ?? 0;
}

/** Total SOFA (0-24). Componentes sem resposta contam 0. */
export function calcularSofaTotal(respostas: SofaRespostas): number {
  return SOFA_COMPONENTES.reduce((soma, comp) => soma + pontosComponente(comp, respostas[comp.key]), 0);
}

/** Quantos componentes foram preenchidos (para indicar escore parcial). */
export function componentesPreenchidos(respostas: SofaRespostas): number {
  return SOFA_COMPONENTES.filter((comp) => !!respostas[comp.key]).length;
}
