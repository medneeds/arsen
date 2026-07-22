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
