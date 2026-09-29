/**
 * Regras de justificativa do formulario de requisicao (aba Laboratorio).
 *
 * Laboratorio NAO pede justificativa clinica geral. A unica exigencia e a da
 * liberacao condicionada: exame fora dos pacotes de rotina (Rotina UTI /
 * Enfermaria) precisa de justificativa especifica. Parecer e Imagens seguem
 * exigindo a justificativa clinica.
 */

/** Minimo de caracteres da justificativa de exame fora da rotina. */
export const MIN_JUSTIFICATIVA_FORA_ROTINA = 10;

/** Justificativa clinica geral: exigida em toda categoria, exceto Laboratorio. */
export function exigeJustificativaPrincipal(categoria: string): boolean {
  return categoria !== "laboratorio";
}

/** Itens de laboratorio que nao pertencem a nenhum pacote de rotina. */
export function itensForaDaRotina(
  categoria: string,
  selecionados: string[],
  rotina: ReadonlySet<string>,
): string[] {
  if (categoria !== "laboratorio") return [];
  return selecionados.filter((i) => !rotina.has(i));
}

/** Justificativa de fora da rotina so vale com o minimo de caracteres uteis. */
export function justificativaForaDaRotinaValida(texto: string): boolean {
  return texto.trim().length >= MIN_JUSTIFICATIVA_FORA_ROTINA;
}
