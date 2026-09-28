/**
 * TESTE: SAPS 3 — pressão sistólica e unidades de leucócitos/plaquetas
 *
 * PAS mais baixa (Box III) segue a tabela original do SAPS 3:
 *   < 40 = 11 · 40–69 = 8 · 70–119 = 3 · >= 120 = 0
 * A versão anterior dava 0 para 100–119 e pontuava hipertensão (120–199 = 2,
 * >= 200 = 3). Cada limite de faixa é testado dos dois lados.
 *
 * Leucócitos e plaquetas passaram a ser digitados como contagem completa por
 * mm³. O banco e as faixas continuam em milhares: o teste garante a conversão
 * nos dois sentidos e que o valor gravado cai na mesma faixa da pontuação.
 *
 * Dados fictícios | Zero impacto em produção.
 */

import {
  calculateSbpScore,
  contagemParaMil,
  formatarContagem,
  milParaContagem,
  plaquetasParaBanco,
  somenteDigitos,
} from "../lib/saps3.ts";

let falhas = 0;
let total = 0;

function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

console.log("\n=== PAS mais baixa — limites de faixa ===");
{
  const casos: Array<[number | null, number]> = [
    [null, 0], [0, 0],
    [1, 11], [39, 11],
    [40, 8], [69, 8],
    [70, 3], [99, 3], [100, 3], [119, 3],
    [120, 0], [150, 0], [199, 0], [200, 0], [260, 0],
  ];
  for (const [pas, esperado] of casos) {
    const obtido = calculateSbpScore(pas);
    check(`PAS ${pas} -> ${esperado}`, obtido === esperado, `obtido ${obtido}`);
  }
}

console.log("\n=== Contagem digitada -> milhares ===");
{
  check("vazio -> null", contagemParaMil("") === null);
  check("15000 -> 15", contagemParaMil("15000") === 15);
  check("15.000 (separador de milhar) -> 15", contagemParaMil("15.000") === 15);
  check("12500 -> 12.5", contagemParaMil("12500") === 12.5);
  check("800 -> 0.8 (abaixo de mil)", contagemParaMil("800") === 0.8);
  check("somenteDigitos remove ponto e espaço", somenteDigitos("150.000 ") === "150000");
}

console.log("\n=== Plaquetas gravadas na mesma faixa da pontuação ===");
{
  // Faixas em milhares: < 20 · < 50 · < 100. Truncar preserva o "<".
  check("19.999 -> 19 (continua < 20)", plaquetasParaBanco("19999") === 19);
  check("20.000 -> 20", plaquetasParaBanco("20000") === 20);
  check("49.600 -> 49 (continua < 50)", plaquetasParaBanco("49600") === 49);
  check("99.900 -> 99 (continua < 100)", plaquetasParaBanco("99900") === 99);
  check("150.000 -> 150", plaquetasParaBanco("150000") === 150);
  check("vazio -> null", plaquetasParaBanco("") === null);
}

console.log("\n=== Banco (milhares) -> contagem na tela ===");
{
  check("15 -> 15000", milParaContagem(15) === "15000");
  check("12.5 -> 12500", milParaContagem(12.5) === "12500");
  check("0.8 -> 800", milParaContagem(0.8) === "800");
  check("null -> vazio", milParaContagem(null) === "");
  check("ida e volta 12500", milParaContagem(contagemParaMil("12500")) === "12500");
}

console.log("\n=== Exibição ===");
{
  check("150000 -> 150.000", formatarContagem("150000") === "150.000");
  check("vazio -> vazio", formatarContagem("") === "");
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
console.log("Todos os casos passaram.\n");
