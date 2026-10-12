import { supabase } from "@/integrations/supabase/client";
import { applyPendencyDone } from "./pendenciasSync";

/**
 * Marca/desmarca UMA pendencia na fonte unica (internacoes.pendencias).
 * Le-modifica-grava: relê a lista no banco antes de alterar, para nao sobrescrever
 * o que outra tela/pessoa acabou de mudar. Devolve a lista gravada (ou a atual, se
 * nada mudou). Lanca em caso de erro de leitura/gravacao (RLS inclusive).
 */
export async function togglePendencyRemote(
  internacaoId: string,
  text: string,
  done: boolean,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("internacoes")
    .select("pendencias")
    .eq("id", internacaoId)
    .single();
  if (error) throw error;
  const current = ((data as { pendencias?: string | null } | null)?.pendencias ?? "")
    .split("\n")
    .filter((l) => l.trim());
  const next = applyPendencyDone(current, text, done);
  if (next === null) return current;
  const { data: upd, error: updErr } = await supabase
    .from("internacoes")
    .update({ pendencias: next.join("\n") })
    .eq("id", internacaoId)
    .select("id");
  if (updErr) throw updErr;
  // RLS pode bloquear sem erro (0 linhas): trata como falha, nunca como sucesso silencioso.
  if (!upd || upd.length === 0) throw new Error("A pendência não foi gravada (sem permissão ou internação não encontrada).");
  return next;
}
