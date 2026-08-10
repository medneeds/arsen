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
 * Registra uma solicitação em exam_requests. Ponto ÚNICO para as três fichas
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

  let { data, error } = await supabase
    .from("exam_requests")
    .insert(comPayload as never)
    .select("id")
    .single();

  // A migration de document_payload pode ainda não ter sido aplicada neste
  // banco (git != banco — lição de julho/2026). Se for só isso, grava sem o
  // snapshot: melhor uma solicitação registrada sem documento reimprimível do
  // que nenhuma solicitação. O aviso fica no console para não passar batido.
  if (error && input.documentPayload && isMissingDocumentPayloadColumn(error)) {
    console.warn(
      "[Solicitação] Coluna document_payload ausente neste banco — a migration " +
        "20260727180000 provavelmente não foi aplicada. Gravando sem o snapshot; " +
        "esta solicitação NÃO poderá ser reimpressa pelo histórico.",
      error,
    );
    const semPayload = buildSolicitacaoRow({ ...input, documentPayload: undefined });
    ({ data, error } = await supabase
      .from("exam_requests")
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
