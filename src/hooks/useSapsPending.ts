import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SapsPendingInfo {
  /** Ficha existente para RETOMAR (status 'pendente'/rascunho), ou null quando ainda nao ha linha. */
  id: string | null;
  pending_since: string | null;
}

/**
 * Observa se a internação DEVE o SAPS 3 e, em caso afirmativo, devolve a âncora
 * do cronômetro e a ficha existente (se houver) para retomada.
 *
 * REGRA (derivada, fonte única `sapsPendente`): pendente = setor exige SAPS
 * (lido direto de `setores.aplica_saps` via leito, sem depender do cache do
 * app) E a internação NÃO tem ficha `validada`. Antes o hook dependia de uma
 * linha stub `status='pendente'` ter sido criada no clique opcional "Depois" da
 * admissão — pacientes admitidos por outra via nunca eram cobrados. Agora o
 * estado nasce da invariante clínica; a linha stub virou apenas rascunho opcional.
 *
 * Âncora do cronômetro (`pending_since`): a da ficha-rascunho, se existir; senão
 * a admissão na UTI (`data_admissao_uti`) ou a entrada hospitalar
 * (`data_entrada`). O retorno `id` é a ficha a retomar, ou null para ficha nova.
 */
export function useSapsPending(internacaoId?: string | null): SapsPendingInfo | null {
  const [pending, setPending] = useState<SapsPendingInfo | null>(null);

  useEffect(() => {
    if (!internacaoId) {
      setPending(null);
      return;
    }

    let active = true;

    const fetchPending = async () => {
      // Setor exige SAPS? Lê a flag real do banco pelo leito da internação.
      const { data: inter } = await supabase
        .from("internacoes")
        .select("data_admissao_uti, data_entrada, leito:leitos(setor:setores(aplica_saps))")
        .eq("id", internacaoId)
        .maybeSingle();
      // Fichas da internação (mais recente primeiro): define validada x rascunho.
      const { data: fichas } = await supabase
        .from("avaliacoes_saps3")
        .select("id, status, pending_since, criado_em")
        .eq("internacao_id", internacaoId)
        .order("criado_em", { ascending: false });
      if (!active) return;

      const leitoRel = (inter as any)?.leito;
      const leito = Array.isArray(leitoRel) ? leitoRel[0] : leitoRel;
      const setorRel = leito?.setor;
      const setor = Array.isArray(setorRel) ? setorRel[0] : setorRel;
      const aplicaSaps = setor?.aplica_saps === true;

      const linhas = (fichas as { id: string; status: string | null; pending_since: string | null }[] | null) ?? [];
      const temValidada = linhas.some((f) => f.status === "validada");

      if (!aplicaSaps || temValidada) {
        setPending(null);
        return;
      }

      // Pendente derivado: usa a ficha-rascunho mais recente (se houver) para
      // retomar; a âncora do cronômetro cai para a admissão quando não há linha.
      const rascunho = linhas[0] ?? null;
      const anchor =
        rascunho?.pending_since ??
        ((inter as any)?.data_admissao_uti as string | null) ??
        ((inter as any)?.data_entrada as string | null) ??
        null;
      setPending({ id: rascunho?.id ?? null, pending_since: anchor });
    };

    fetchPending();

    const channel = supabase
      .channel(`saps-pending-${internacaoId}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "avaliacoes_saps3", filter: `internacao_id=eq.${internacaoId}` },
        () => fetchPending(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [internacaoId]);

  return pending;
}
