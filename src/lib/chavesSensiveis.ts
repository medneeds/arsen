/**
 * Quais chaves de armazenamento local precisam sair no logout.
 *
 * POR QUE ISTO EXISTE (auditoria de 18/09/2026)
 * A varredura defensiva do signOut usava a lista
 *   /^(patient|clinical|prescription|evolution|exam|culture|note|checklist)/i
 * e nao alcancava NENHUMA das chaves de rascunho realmente gravadas:
 *
 *   rx-draft::<NOME DO PACIENTE>::<data>   PrescricaoPage
 *   admission_draft:v2:<registryId>        AdmissionDialog
 *   saps3_draft:v1:<...>                   Saps3Page
 *   atb-draft-v<N>-<patientId>             AntimicrobialGuideDialog
 *
 * Todas sobreviviam ao logout. Em terminal compartilhado de plantao, o proximo
 * usuario herdava prescricao, admissao e SAPS3 do paciente anterior — e a
 * chave da prescricao traz o NOME do paciente, legivel sem abrir o valor.
 *
 * A regra vive AQUI, fora do componente, para poder ser testada sem DOM e para
 * nao repetir a "regra espalhada" que ja custou caro neste projeto.
 */

const PREFIXOS_SENSIVEIS =
  /^(patient|clinical|prescription|evolution|exam|culture|note|checklist|rx-draft|admission_draft|saps3_draft|atb-draft)/i;

/**
 * True quando a chave deve ser apagada ao sair.
 *
 * Qualquer chave de rascunho sai junto, mesmo as que nao sao de paciente: o
 * custo de perder um rascunho de formulario ao deslogar e baixinho perto do
 * custo de deixar dado clinico no navegador de um terminal compartilhado.
 */
export function ehChaveSensivel(chave: string): boolean {
  if (!chave) return false;
  return PREFIXOS_SENSIVEIS.test(chave) || /draft/i.test(chave);
}
