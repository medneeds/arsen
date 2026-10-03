/**
 * Status de alergia — terminologia unica "Sem relato" (substitui o antigo "NDAM").
 *
 * Um paciente sem alergias relatadas tem o campo com o valor SEM_RELATO, e isso
 * dispara o indicador VERDE em todos os fluxos (cabecalho da prescricao, chips,
 * cards, guia ATM). COMPAT: registros antigos gravaram "NDAM" (prescricao/cadastro)
 * ou "Nega" (admissao); ambos continuam contando como "sem alergia" (verde), sem
 * migracao de dados. Comparacao sempre case-insensitive, trim.
 */
export const SEM_RELATO = "Sem relato";

const NEGATIVOS = new Set(["SEM RELATO", "NDAM", "NEGA"]);

/** true quando o valor representa "sem alergia relatada" (dispara o verde). */
export function isSemAlergia(value: string | null | undefined): boolean {
  const v = (value ?? "").trim().toUpperCase();
  return NEGATIVOS.has(v);
}
