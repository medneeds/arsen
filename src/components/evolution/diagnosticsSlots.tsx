import { DiagnosticsPanel, type DiagnosticsPanelProps } from "@/components/evolution/DiagnosticsPanel";

/**
 * Fonte UNICA da segmentacao do painel de diagnosticos da evolucao — mesma
 * divisao da admissao: Diagnosticos (CID + previsoes + paliativo + precaucao),
 * Hipoteses e Antecedentes em secoes proprias; a Revisao usa o painel completo.
 *
 * Usada pela evolucao nova/duplicada (EvolucaoPage) e pelo rascunho reaberto
 * (EvolutionTimeline). Antes so a evolucao nova era segmentada: ao salvar o
 * rascunho e reabrir, hipoteses e antecedentes "mudavam de lugar" para dentro
 * de Diagnosticos.
 */
export interface DiagnosticsSlots {
  diagnosticsSlot: React.ReactNode;
  hypothesesSlot: React.ReactNode;
  antecedentesSlot: React.ReactNode;
  diagnosticsReviewSlot: React.ReactNode;
}

export function buildDiagnosticsSlots(props: Omit<DiagnosticsPanelProps, "render">): DiagnosticsSlots {
  return {
    diagnosticsSlot: <DiagnosticsPanel {...props} render="main" />,
    hypothesesSlot: <DiagnosticsPanel {...props} render="hypotheses" />,
    antecedentesSlot: <DiagnosticsPanel {...props} render="antecedentes" />,
    diagnosticsReviewSlot: <DiagnosticsPanel {...props} render="all" />,
  };
}

export { toHypothesesList } from "@/lib/internacaoDiagnosticContext";
