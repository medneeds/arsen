/**
 * Classificação de complexidade de setores para o fluxo de
 * Transferência Interna.
 *
 * ═══════════════════════════════════════════════════════════════
 * NÍVEIS DE COMPLEXIDADE
 * ═══════════════════════════════════════════════════════════════
 *
 *  Nível 1 — Crítico Máximo : UTI 1 (red), UTI 2 (yellow)
 *  Nível 2 — Crítico Alto   : UCI 2 (outside)
 *  Nível 3 — Intermediário  : UCI 1 (blue)
 *  Nível 4 — Baixa          : UCC, Enfermarias, UE, Sala Vermelha,
 *                             Sala Laranja, Obs. Clínica, RIV, CC…
 *
 * ═══════════════════════════════════════════════════════════════
 * REGRAS DE ADMISSÃO
 * ═══════════════════════════════════════════════════════════════
 *
 *  • Mesma complexidade (qualquer nível) → SEM nova admissão
 *    Ex.: UTI 1 → UTI 2, UCI 1 → UCI 1 (remaneio), Enf. A → Enf. B
 *
 *  • Escalada (nível sobe) → COM nova admissão no destino
 *    Histórico da admissão anterior PRESERVADO no prontuário.
 *    Ex.: Enfermaria → UTI, UCI 1 → UCI 2, UCC → UTI
 *
 *  • Desescalada (nível cai) → SEM nova admissão
 *    Continua o mesmo atendimento, histórico integral preservado.
 *    Ex.: UTI → UCI 1, UCI 2 → Enfermaria
 *
 *  • SAPS 3 obrigatório SOMENTE em escalada para Nível 1 (UTI 1 ou UTI 2)
 *    ou Nível 2 (UCI 2) vindo de Nível 3 ou 4.
 *
 * ═══════════════════════════════════════════════════════════════
 * PRINCÍPIO FUNDAMENTAL
 * ═══════════════════════════════════════════════════════════════
 *  1 internação = 1 número de atendimento até o desfecho final.
 *  A transferência interna NUNCA fecha o encounter vigente —
 *  apenas cria um novo encounter paralelo na escalada, preservando
 *  o anterior no histórico com a data de início e setor de origem.
 */

// ─── Mapeamento de setor → nível de complexidade ──────────────
export const SECTOR_COMPLEXITY_LEVEL: Record<string, number> = {
  // Nível 1 — Crítico Máximo
  red:      1, // UTI 1
  yellow:   1, // UTI 2

  // Nível 2 — Crítico Alto
  outside:  2, // UCI 2

  // Nível 3 — Intermediário
  blue:     3, // UCI 1

  // Nível 4 — Baixa complexidade (todos os demais)
  ucc:                   4,
  neuro_01:              4,
  neuro_02:              4,
  clinica_cirurgica:     4,
  enfermaria_transicao:  4,
  enfermaria_vascular:   4,
  sala_vermelha:         4,
  sala_laranja:          4,
  observacao_clinica:    4,
  ue_vertical:           4,
  ue_horizontal:         4,
  internacao_ue:         4,
  riv:                   4,
  cc_preparo:            4,
  cc_bloco:              4,
  cc_rpa:                4,
};

/** Retorna o nível de complexidade de um setor (1=máximo, 4=mínimo). */
export function getSectorComplexityLevel(sectorCode?: string | null): number {
  if (!sectorCode) return 4;
  return SECTOR_COMPLEXITY_LEVEL[sectorCode.trim().toLowerCase()] ?? 4;
}

/** Retorna true se o setor for de alta complexidade (níveis 1 ou 2). */
export function isCriticalSector(sectorCode?: string | null): boolean {
  return getSectorComplexityLevel(sectorCode) <= 2;
}

/** Retorna true se for setor de nível máximo (UTI 1 ou UTI 2). */
export function isMaxCriticalSector(sectorCode?: string | null): boolean {
  return getSectorComplexityLevel(sectorCode) === 1;
}

// ─── Tipos de transferência ────────────────────────────────────

export type TransferClassification =
  | "escalada_critica"      // escalada p/ nível 1 ou 2 (requer admissão + SAPS)
  | "escalada_intermediaria" // escalada p/ nível 3 (requer admissão, sem SAPS)
  | "escalada_simples"      // escalada entre baixas complexidades (mesma exigência → sem nova admissão)
  | "desescalada"           // nível cai (sem nova admissão)
  | "lateral_critica"       // mesmo nível crítico (sem nova admissão)
  | "lateral_comum";        // mesmo nível não-crítico (sem nova admissão)

/**
 * Classifica a transferência com base nos níveis de complexidade.
 */
export function classifyTransfer(
  originSector?: string | null,
  destinationSector?: string | null,
): TransferClassification {
  const originLevel = getSectorComplexityLevel(originSector);
  const destLevel   = getSectorComplexityLevel(destinationSector);

  // Mesma complexidade → lateral
  if (originLevel === destLevel) {
    return originLevel <= 2 ? "lateral_critica" : "lateral_comum";
  }

  // Escalada (destino mais restritivo = menor número de nível)
  if (destLevel < originLevel) {
    if (destLevel <= 2) return "escalada_critica";      // → UTI ou UCI 2
    if (destLevel === 3) return "escalada_intermediaria"; // → UCI 1
    return "escalada_simples"; // escalada entre níveis 4 (não deveria ocorrer)
  }

  // Desescalada (destino menos restritivo = maior número de nível)
  return "desescalada";
}

/**
 * Retorna true se a transferência exige ABERTURA DE NOVA ADMISSÃO no destino.
 * Regra: qualquer escalada (nível de complexidade sobe) requer nova admissão.
 */
export function requiresNewAdmission(classification: TransferClassification): boolean {
  return (
    classification === "escalada_critica" ||
    classification === "escalada_intermediaria"
    // escalada_simples entre nível 4: mantém mesmo encounter — sem nova admissão
  );
}

/**
 * Retorna true se a transferência exige avaliação SAPS 3.
 * Critério: escalada para nível 1 (UTI) ou nível 2 (UCI 2).
 */
export function requiresSaps(classification: TransferClassification): boolean {
  return classification === "escalada_critica";
}

// ─── Labels de exibição ────────────────────────────────────────

export function classificationLabel(c: TransferClassification): string {
  switch (c) {
    case "escalada_critica":       return "Escalada para setor crítico (nova admissão + SAPS)";
    case "escalada_intermediaria": return "Escalada para UCI 1 (nova admissão)";
    case "escalada_simples":       return "Escalada entre setores de mesma baixa complexidade";
    case "desescalada":            return "Desescalada — continuidade de atendimento";
    case "lateral_critica":        return "Transferência entre setores críticos — continuidade";
    case "lateral_comum":          return "Transferência entre setores — continuidade";
  }
}

export function classificationBadgeClass(c: TransferClassification): string {
  switch (c) {
    case "escalada_critica":       return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
    case "escalada_intermediaria": return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "escalada_simples":       return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
    case "desescalada":            return "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30";
    case "lateral_critica":        return "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30";
    case "lateral_comum":          return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  }
}
