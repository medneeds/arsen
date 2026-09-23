import { supabase } from "@/integrations/supabase/client";
import {
  buildSolicitacaoRow,
  isMissingDocumentPayloadColumn,
  SolicitacaoError,
  type SolicitacaoInput,
  type DocumentPayload,
} from "@/lib/solicitacaoPayload";

export {
  SolicitacaoError,
  type SolicitacaoInput,
  type DocumentPayload,
} from "@/lib/solicitacaoPayload";

/**
 * MIGRAÇÃO: resolve profissionais.id a partir do auth user id. Os campos `*_por`
 * do schema novo (solicitado_por) são FK de profissionais.id (≠ auth.uid).
 */
async function resolveProfissionalId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from("profissionais")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * MIGRAÇÃO (Wave3): exam_requests → solicitacoes_exame. A tabela nova pendura em
 * `internacao_id` (o `patientId` das telas) e só tem campos clínicos. As colunas
 * de paciente/unidade/solicitante do modelo antigo NÃO existem no schema novo e
 * foram DEGRADADAS (ver buildSolicitacaoRow em solicitacaoPayload.ts e
 * MIGRACAO_DEGRADACOES.md). As assinaturas exportadas (registrarSolicitacao,
 * comSnapshotDeDocumento, SolicitacaoInput, DocumentPayload) foram mantidas
 * estáveis para os demais callers.
 *
 * Registra uma solicitação em solicitacoes_exame. Ponto ÚNICO para as três fichas
 * (geral, APAC e AIH).
 *
 * POR QUE ESTE HELPER EXISTE
 * Antes, cada ficha gravava do seu jeito e — pior — tratava o erro de um jeito:
 *   - ficha geral: `throw error` (bloqueava, correto)
 *   - APAC: console.error + toast, mas chamada com `void` — não bloqueava
 *   - AIH: só console.error, falha totalmente silenciosa
 *
 * Como nas duas últimas o registro era considerado "rastro", falhar em silêncio
 * parecia aceitável. Não é: o resultado prático era um histórico furado, sem
 * ninguém saber que estava furado. Solicitação que não gravou não aconteceu.
 *
 * ESTE HELPER SEMPRE AGUARDA E SEMPRE LANÇA em caso de falha. Quem chama decide
 * o que mostrar ao usuário — mas ninguém mais engole o erro.
 *
 * @returns o id da solicitação criada
 * @throws SolicitacaoError se a gravação falhar
 */
export async function registrarSolicitacao(
  input: SolicitacaoInput,
): Promise<string> {
  const comPayload = buildSolicitacaoRow(input);
  // MIGRAÇÃO: solicitado_por (FK profissionais.id) resolvido a partir de
  // input.requestedBy (auth user id). Não cabe na função pura buildSolicitacaoRow.
  (comPayload as Record<string, unknown>).solicitado_por = await resolveProfissionalId(input.requestedBy);

  let { data, error } = await supabase
    .from("solicitacoes_exame")
    .insert(comPayload as never)
    .select("id")
    .single();

  // MIGRAÇÃO: solicitacoes_exame não tem coluna document_payload (o snapshot do
  // impresso não existe no schema novo). buildSolicitacaoRow já não emite a
  // chave, mas o fallback é mantido por segurança: se algum banco tiver a coluna
  // e reclamar, regrava sem o snapshot em vez de derrubar a solicitação.
  if (error && input.documentPayload && isMissingDocumentPayloadColumn(error)) {
    console.warn(
      "[Solicitação] Coluna document_payload ausente — o schema novo não guarda " +
        "snapshot de documento. Gravando sem o snapshot; esta solicitação NÃO " +
        "poderá ser reimpressa pelo histórico.",
      error,
    );
    const semPayload = buildSolicitacaoRow({ ...input, documentPayload: undefined });
    (semPayload as Record<string, unknown>).solicitado_por = await resolveProfissionalId(input.requestedBy);
    ({ data, error } = await supabase
      .from("solicitacoes_exame")
      .insert(semPayload as never)
      .select("id")
      .single());
  }

  if (error) {
    console.error("[Solicitação] Falha ao registrar:", error, comPayload);
    throw new SolicitacaoError(
      error.message || "Não foi possível registrar a solicitação.",
      error,
    );
  }

  const id = (data as { id?: string } | null)?.id;
  if (!id) {
    throw new SolicitacaoError(
      "Solicitação gravada, mas o banco não devolveu o identificador.",
    );
  }
  return id;
}

/**
 * Envelope para os fluxos que fazem a propria gravacao (insert OU update) e
 * so precisam anexar o snapshot do documento.
 *
 * Existe porque registrarSolicitacao() e insert-only, e dialogos como o de
 * hemocomponente suportam EDICAO: rescrever a persistencia deles para caber no
 * helper seria mexer em logica que ja funciona, para ganhar so o snapshot.
 * Aqui a logica de cada dialogo fica intacta e ganha duas coisas:
 *   - o document_payload no payload;
 *   - o mesmo fallback de git != banco do registrarSolicitacao: se a coluna
 *     nao existir neste banco, regrava SEM o snapshot em vez de derrubar a
 *     solicitacao inteira.
 *
 * Sem esse fallback, anexar document_payload antes da migration 20260727180000
 * quebraria hemocomponente, SAT e cultura por completo — hoje eles gravam e
 * funcionam.
 *
 * @param executar recebe o extra a mesclar no payload e devolve o resultado
 *                 do supabase (insert ou update, indiferente)
 */
export async function comSnapshotDeDocumento<T>(
  executar: (extra: Record<string, unknown>) => PromiseLike<{ data: T | null; error: unknown }>,
  snapshot?: DocumentPayload,
): Promise<{ data: T | null; error: unknown }> {
  if (!snapshot) return executar({});

  const primeiro = await executar({ document_payload: snapshot });
  if (!primeiro.error || !isMissingDocumentPayloadColumn(primeiro.error)) return primeiro;

  console.warn(
    "[Solicitação] Coluna document_payload ausente neste banco — a migration " +
      "20260727180000 provavelmente não foi aplicada. Gravando sem o snapshot; " +
      "esta solicitação NÃO poderá ser reimpressa pelo histórico.",
    primeiro.error,
  );
  return executar({});
}
