import { resolveSectorCode } from "@/config/sectorCoverage";

/**
 * Setor que chega na tela de Requisicoes (URL/estado) pode vir como CODIGO
 * ("yellow") ou como NOME do setor no banco ("UTI 2"). A tela decide quais
 * pacotes de rotina mostrar (UTI x Enfermaria) comparando com codigos; com o
 * nome, a UTI nao era reconhecida e so aparecia a Rotina Enfermaria.
 *
 * Traduz o nome para o codigo canonico e deixa passar o que ja e codigo. Valor
 * desconhecido volta como veio (mesmo comportamento de antes, sem inventar setor).
 */
export function toSectorCode(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  return resolveSectorCode(raw) ?? raw;
}
