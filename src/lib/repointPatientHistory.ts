// MIGRAÇÃO: patients / clinical_evolutions (tabelas mortas) → schema novo.
//
// No modelo antigo, cada "leito-paciente" era uma linha em `patients` e mover um
// paciente entre leitos criava uma linha nova — por isso o histórico clínico
// (evoluções, prescrições, exames, culturas, condutas) precisava ser REPONTADO
// de um patient_id para outro via a RPC `repoint_patient_history`, com verificação
// em `clinical_evolutions`/`patients`.
//
// No schema novo o histórico pendura em `internacao_id` e uma transferência de
// leito é apenas um UPDATE de `internacoes.leito_id`: a internação mantém o mesmo
// id, então NÃO há o que repontar — o histórico acompanha a internação
// automaticamente. A RPC `repoint_patient_history` e as tabelas de verificação
// não existem mais. A função foi DEGRADADA para um no-op de sucesso, preservando
// a assinatura e o shape de retorno para os chamadores existentes.
// Ver MIGRACAO_DEGRADACOES.md.

/**
 * Repontava o histórico clínico de um leito-paciente de origem para um de destino.
 *
 * DEGRADADO no schema novo: o histórico pendura em `internacoes.id` (imutável na
 * transferência de leito), portanto não há repontamento a fazer. Retorna sucesso
 * sem tocar o banco. Assinatura e retorno preservados por compatibilidade.
 */
export async function repointPatientHistory(
  sourcePatientId: string,
  targetPatientId: string,
  _reason?: string,
): Promise<{ ok: boolean; counts?: Record<string, number>; error?: string; verificationWarning?: string }> {
  if (!sourcePatientId || !targetPatientId) {
    return { ok: false, error: "source/target ausente" };
  }
  // No-op: nada a repontar no schema novo (histórico segue a internação).
  return { ok: true, counts: {} };
}
