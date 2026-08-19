/**
 * Rótulos históricos de setor.
 *
 * PROBLEMA QUE ISTO RESOLVE
 * `pre_admissions.destination_sector` guarda TEXTO — ora o rótulo de exibição
 * ("Internação UE"), ora o código interno ("internacao_ue"). O filtro de
 * "Aguardando Admissão" compara esse texto com o título do setor no mapa de
 * leitos (SECTOR_VISUAL.title). Logo, renomear um setor faz os registros
 * gravados com o nome antigo pararem de casar: a sinalização some da fila sem
 * ser cancelada, e o paciente fica invisível.
 *
 * Foi exatamente o que aconteceria ao renomear "Internação UE" para "Posto de
 * Internação": havia 1 pré-admissão ativa em `aguardando_leito` com o rótulo
 * antigo.
 *
 * COMO USAR
 * Ao filtrar por rótulo de setor, use `sectorLabelVariants(label)` e um `IN`,
 * nunca uma igualdade simples. Ao renomear um setor daqui em diante, acrescente
 * o nome anterior à lista — não é necessário migrar dados.
 *
 * A chave é o rótulo ATUAL; o array traz todas as formas já gravadas no banco,
 * incluindo o próprio rótulo atual e o código interno.
 */
export const SECTOR_LABEL_ALIASES: Record<string, readonly string[]> = {
  "Posto de Internação": ["Posto de Internação", "Internação UE", "internacao_ue"],
};

/**
 * Retorna todas as formas sob as quais um setor pode estar gravado no banco.
 * Para setores sem histórico de renomeação, devolve apenas o próprio rótulo.
 */
export function sectorLabelVariants(label: string | null | undefined): string[] {
  if (!label) return [];
  const aliases = SECTOR_LABEL_ALIASES[label];
  return aliases ? [...aliases] : [label];
}
