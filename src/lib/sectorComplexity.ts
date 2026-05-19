/**
 * Classificação de complexidade de setores para o fluxo de
 * Transferência Interna.
 *
 * 2 níveis (decisão do produto):
 *   - CRÍTICO:    UTI 1 (red), UTI 2 (yellow), UCI 2 (outside)
 *   - NÃO-CRÍTICO: todos os demais
 *
 * Regras derivadas:
 *   - escalada_critica  (não-crítico → crítico)  → admissão + SAPS pendente
 *   - desescalada       (crítico → não-crítico)  → alocação direta
 *   - lateral_critica   (crítico ↔ crítico)      → alocação direta
 *   - lateral_comum     (não-crítico ↔ não-crítico) → alocação direta
 *
 * Em todos os casos: histórico clínico é PRESERVADO e o
 * mesmo número de atendimento é mantido até o desfecho final
 * (alta, transferência externa ou óbito).
 */

const CRITICAL_SECTOR_CODES: ReadonlySet<string> = new Set([
  "red",     // UTI 1
  "yellow",  // UTI 2
  "outside", // UCI 2
]);

export type TransferClassification =
  | "escalada_critica"
  | "desescalada"
  | "lateral_critica"
  | "lateral_comum";

export function isCriticalSector(sectorCode?: string | null): boolean {
  if (!sectorCode) return false;
  return CRITICAL_SECTOR_CODES.has(sectorCode.trim().toLowerCase());
}

export function classifyTransfer(
  originSector?: string | null,
  destinationSector?: string | null,
): TransferClassification {
  const originCritical = isCriticalSector(originSector);
  const destCritical = isCriticalSector(destinationSector);

  if (!originCritical && destCritical) return "escalada_critica";
  if (originCritical && !destCritical) return "desescalada";
  if (originCritical && destCritical) return "lateral_critica";
  return "lateral_comum";
}

export function requiresSaps(classification: TransferClassification): boolean {
  return classification === "escalada_critica";
}

export function classificationLabel(c: TransferClassification): string {
  switch (c) {
    case "escalada_critica": return "Escalada para setor crítico";
    case "desescalada":      return "Desescalada de setor crítico";
    case "lateral_critica":  return "Transferência entre setores críticos";
    case "lateral_comum":    return "Transferência entre setores comuns";
  }
}
