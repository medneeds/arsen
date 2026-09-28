/**
 * SAPS 3 — funcoes puras de pontuacao e de unidade, testaveis sem a tela.
 *
 * Referencia: Moreno RP et al. SAPS 3 — From evaluation of the patient to
 * evaluation of the intensive care unit. Part 2. Intensive Care Med
 * 2005;31:1345-55. Qualquer mudanca de faixa aqui exige validacao da Direcao
 * Clinica e atualizacao de src/tests/saps3.test.ts.
 */

/**
 * Pressao arterial sistolica mais baixa (mmHg), Box III.
 *   < 40 = 11 · 40–69 = 8 · 70–119 = 3 · >= 120 = 0
 *
 * Corrigido em 28/09/2026 (Direcao Clinica): a versao anterior dava 0 para
 * 100–119 e pontuava hipertensao (120–199 = 2, >= 200 = 3), o que nao existe
 * no SAPS 3.
 */
export function calculateSbpScore(sbp: number | null): number {
  if (!sbp) return 0;
  if (sbp < 40) return 11;
  if (sbp < 70) return 8;
  if (sbp < 120) return 3;
  return 0;
}

/**
 * Leucocitos e plaquetas sao digitados como CONTAGEM COMPLETA por mm³
 * (ex.: 15000, 150000), sem "x10³" (pedido da Direcao Clinica, 28/09/2026).
 *
 * O banco (avaliacoes_saps3.leucocitos / plaquetas_mais_baixas) e as faixas de
 * pontuacao continuam em MILHARES, como sempre foram — assim as fichas antigas
 * e as novas ficam na mesma unidade. A conversao acontece so na borda da tela.
 */

/** Mantem apenas digitos: "15.000" -> "15000". Ponto e separador de milhar. */
export function somenteDigitos(valor: string): string {
  return (valor || "").replace(/\D/g, "");
}

/** Contagem completa ("15000") -> milhares (15). Vazio -> null. */
export function contagemParaMil(contagem: string): number | null {
  const d = somenteDigitos(contagem);
  if (!d) return null;
  return parseInt(d, 10) / 1000;
}

/**
 * Plaquetas para a coluna inteira do banco, em milhares. Trunca (floor) para
 * que o valor gravado caia na MESMA faixa da pontuacao: 19.600 -> 19 (< 20),
 * nunca 20.
 */
export function plaquetasParaBanco(contagem: string): number | null {
  const mil = contagemParaMil(contagem);
  return mil == null ? null : Math.floor(mil);
}

/** Valor do banco em milhares (15.5) -> contagem completa ("15500"). */
export function milParaContagem(mil: number | null | undefined): string {
  if (mil == null || Number.isNaN(Number(mil))) return "";
  return String(Math.round(Number(mil) * 1000));
}

/** "15000" -> "15.000" para exibicao no campo. */
export function formatarContagem(contagem: string): string {
  const d = somenteDigitos(contagem);
  if (!d) return "";
  return parseInt(d, 10).toLocaleString("pt-BR");
}
