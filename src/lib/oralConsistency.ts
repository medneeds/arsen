/**
 * Consistência da dieta oral — vocabulário único entre o assistente e o corpo
 * da prescrição.
 *
 * O PROBLEMA (17/09/2026): duas listas para o mesmo campo, e um mapa achatando
 * uma na outra.
 *
 *   assistente (ORAL_CONSISTENCIES) ... 7 opções, gravadas em nutConsistency
 *   editor (ORAL_DIET_TYPES) .......... 6 opções, gravadas em dietType
 *   ORAL_DIETTYPE ..................... mapa que traduzia 7 -> 5
 *
 * O mapa perdia informação: "Semilíquida" virava "Pastosa" e "Líquida
 * espessada" virava "Líquida". Ou seja, as duas consistências mais específicas
 * — justamente as que importam em disfagia — sumiam ao chegar no item. A
 * cozinha recebia "Pastosa" quando o médico havia prescrito outra coisa.
 *
 * Agora é uma lista só, gravada em `dietType`, editável nos dois lugares.
 *
 * NOMENCLATURA (decisão clínica do Artur, 17/09/2026)
 *   "Semilíquida"       -> "Líquida-pastosa"
 *   "Líquida espessada" -> "Liquidificada"
 *
 * Sem subdescrição: o nome da consistência é o que a cozinha executa, e a
 * explicação embaixo de cada opção ocupava espaço sem acrescentar decisão.
 */

export const ORAL_DIET_CONSISTENCIES: string[] = [
  "Geral / Livre",
  "Branda",
  "Pastosa",
  "Líquida-pastosa",
  "Liquidificada",
  "Líquida completa",
  "Líquida restrita",
];

/**
 * Rótulos que já circularam, traduzidos para o vocabulário atual — inclui as
 * duas listas antigas e os nomes anteriores à mudança de nomenclatura.
 */
const LEGADO: Record<string, string> = {
  geral: "Geral / Livre",
  livre: "Geral / Livre",
  leve: "Branda",
  semiliquida: "Líquida-pastosa",
  "liquida espessada": "Liquidificada",
  liquida: "Líquida completa",
  "liquida completa": "Líquida completa",
  "liquida restrita": "Líquida restrita",
};

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Traduz qualquer grafia conhecida para o rótulo atual. Devolve string vazia
 * quando não reconhece — melhor um campo honestamente vazio do que uma
 * consistência inventada numa prescrição que a cozinha vai executar.
 */
export function normalizeConsistency(valor?: string | null): string {
  if (!valor) return "";
  const t = valor.trim();
  if (!t || t === "-") return "";
  const direto = ORAL_DIET_CONSISTENCIES.find((o) => semAcento(o) === semAcento(t));
  return direto ?? LEGADO[semAcento(t)] ?? "";
}
