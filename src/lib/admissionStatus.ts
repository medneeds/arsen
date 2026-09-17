// ════════════════════════════════════════════════════════════════════════
// ADMISSION STATUS — constantes únicas (fonte única de literais)
// ════════════════════════════════════════════════════════════════════════
// Auditoria 22/07/2026: os literais de admission_status apareciam como
// strings mágicas em 40+ pontos do front (16× "transferencia_interna_pendente",
// 11× "transferencia_externa_pendente", etc.). Um typo em qualquer ponto
// compila normalmente e silenciosamente quebra tarjas/fluxos. Este módulo
// centraliza os valores — que têm CHECK constraint correspondente no banco —
// e o type union garante erro de compilação para valores inválidos.

export const ADMISSION_STATUS = {
  PRE_ADMITTED: 'pre_admitido',
  ADMITTED: 'admitido',
  DISCHARGE_GIVEN: 'alta_dada',
  DEATH: 'obito',
  INTERNAL_TRANSFER_PENDING: 'transferencia_interna_pendente',
  EXTERNAL_TRANSFER_PENDING: 'transferencia_externa_pendente',
} as const;

export type AdmissionStatus = typeof ADMISSION_STATUS[keyof typeof ADMISSION_STATUS];

// ════════════════════════════════════════════════════════════════════════
// MIGRAÇÃO: o antigo `patients.admission_status` (vocabulário acima) foi
// escrito direto em `internacoes.status`, cujo CHECK só aceita
// ativa | alta | obito | transferida | cancelada. Isso quebrava TODOS os
// desfechos ("new row for relation internacoes violates check constraint
// internacoes_status_check": alta médica, alta a pedido, evasão, óbito,
// transferências). Este mapa converte o status de negócio (VM) para o valor
// aceito pelo banco, no ÚNICO ponto de escrita em internacoes.status.
// ════════════════════════════════════════════════════════════════════════
export type InternacaoStatusDb = "ativa" | "alta" | "obito" | "transferida" | "cancelada";

const ADMISSION_TO_INTERNACAO: Record<string, InternacaoStatusDb> = {
  pre_admitido: "ativa",
  admitido: "ativa",
  alta_dada: "alta",
  obito: "obito",
  // Transferência interna mantém a internação ABERTA (só muda de leito) → ativa.
  // Externa é desfecho de saída do hospital → transferida.
  transferencia_interna_pendente: "ativa",
  transferencia_externa_pendente: "transferida",
  // aceita já-em-banco (idempotente)
  ativa: "ativa",
  alta: "alta",
  transferida: "transferida",
  cancelada: "cancelada",
};

/** Status de negócio (admission_status) → `internacoes.status` (CHECK). Default: ativa. */
export function toInternacaoStatusDb(status: string | null | undefined): InternacaoStatusDb {
  return ADMISSION_TO_INTERNACAO[(status ?? "").toString()] ?? "ativa";
}
