/**
 * Busca em LOTE o CID (seed) e as hipoteses diagnosticas por internacao, a partir
 * da evolucao/admissao MAIS RECENTE que tenha soap.__cid_primary /
 * __diagnostic_hypotheses (mesma regra do PrintableRound). Usado pelo impresso do
 * round de setor (folhas multiplas) para preencher o cabecalho sem N requisicoes.
 *
 * Retorna { [internacaoId]: { cid, hypotheses } }. Tolerante a falha: devolve o que
 * conseguiu (ou {}), nunca lanca — o impresso sai com o que tiver.
 */
import { supabase } from "@/integrations/supabase/client";

export interface RoundDiagnosis {
  cid: string;        // so o codigo (antes do " - descricao")
  hypotheses: string; // texto das hipoteses diagnosticas
}

export async function fetchRoundDiagnosisByInternacao(
  internacaoIds: string[],
): Promise<Record<string, RoundDiagnosis>> {
  const ids = Array.from(new Set(internacaoIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const out: Record<string, RoundDiagnosis> = {};
  const onlyCode = (v: string) => v.split(/\s[-–—]\s/)[0].trim();
  // Lotes: `.in()` entra na URL (GET) — limitar o tamanho por requisicao.
  const CHUNK = 150;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const { data } = await supabase
        .from("evolucoes")
        .select("internacao_id, soap, data_hora")
        .in("internacao_id", chunk)
        .order("data_hora", { ascending: false });
      for (const row of (data ?? []) as { internacao_id: string | null; soap?: Record<string, unknown> }[]) {
        const id = row.internacao_id;
        if (!id) continue;
        const soap = (row.soap ?? {}) as { __cid_primary?: unknown; __diagnostic_hypotheses?: unknown };
        const cur = out[id] ?? { cid: "", hypotheses: "" };
        // Ordem desc por data_hora: o primeiro nao-vazio por internacao vence.
        if (!cur.cid && typeof soap.__cid_primary === "string" && soap.__cid_primary.trim()) {
          cur.cid = onlyCode(soap.__cid_primary);
        }
        if (!cur.hypotheses && typeof soap.__diagnostic_hypotheses === "string" && soap.__diagnostic_hypotheses.trim()) {
          cur.hypotheses = soap.__diagnostic_hypotheses.trim();
        }
        out[id] = cur;
      }
    } catch {
      /* lote com erro: ignora e segue — impresso sai com o que tiver */
    }
  }
  return out;
}
