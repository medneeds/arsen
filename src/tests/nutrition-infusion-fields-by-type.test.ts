/**
 * TESTE: campos de infusão não vazam para tipos que não infundem
 *
 * Bug reportado em 27/07/2026: água ORAL exibia "Correr em: X gts/min".
 *
 * Causa: buildNutritionParts emitia infusionRate/volumeTotal/infusionTime
 * sempre que tivessem valor, sem olhar o nutritionType. Como setSubtype só
 * troca o tipo e NÃO limpa os campos, o caminho era:
 *   prescreve enteral -> preenche gotejamento -> troca subtipo para água
 *   -> o valor residual continua no item e reaparece no detalhamento.
 *
 * Como buildNutritionParts é fonte única da tela compacta e dos DOIS
 * impressos, o erro aparecia nas três superfícies ao mesmo tempo.
 *
 * Gotejamento é grandeza de infusão contínua. Água e dieta oral vão de copo
 * ou seringa; suplemento é tomado; jejum não infunde nada.
 *
 * Dados fictícios | Zero impacto em produção.
 */

import { buildNutritionParts } from "../lib/nutritionHydration.ts";

let falhas = 0;
let total = 0;

function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) {
    console.log(`  OK   ${nome}`);
  } else {
    falhas++;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

/** Campos residuais de infusão, como ficariam após troca de subtipo. */
const residuo = {
  infusionRate: "30",
  nutRateMode: "gtt",
  volumeTotal: "2000",
  infusionTime: "12",
  infusionTimeUnit: "h",
};

const temVazao = (p: string[]) => p.some((s) => s.startsWith("Correr em:"));
const temVol = (p: string[]) => p.some((s) => s.startsWith("Vol:"));
const temTempo = (p: string[]) => p.some((s) => s.startsWith("Tempo:"));

console.log("\n=== Tipos que NÃO infundem: não podem exibir vazão ===");

for (const tipo of ["water", "diet_oral", "supplement", "zero"]) {
  const partes = buildNutritionParts({ nutritionType: tipo, ...residuo });
  check(`${tipo}: sem "Correr em"`, !temVazao(partes), partes.join(" | "));
  check(`${tipo}: sem "Vol:"`, !temVol(partes), partes.join(" | "));
  check(`${tipo}: sem "Tempo:"`, !temTempo(partes), partes.join(" | "));
}

console.log("\n=== Caso exato do bug: água oral com gotejamento residual ===");
{
  const partes = buildNutritionParts({
    nutritionType: "water",
    nutWaterVolPerAdmin: "50",
    nutWaterFreq: "antes/após dieta e meds",
    nutVolDay: "800",
    ...residuo,
  });
  check("água mantém Vol/adm", partes.some((p) => p.includes("Vol/adm: 50 mL")));
  check("água mantém Freq", partes.some((p) => p.startsWith("Freq:")));
  check("água mantém Meta/dia", partes.some((p) => p.includes("Vol/dia: 800 mL")));
  check("água NÃO mostra gts/min", !partes.some((p) => p.includes("gts/min")), partes.join(" | "));
}

console.log("\n=== Tipos que infundem: vazão preservada ===");

for (const tipo of ["diet_enteral", "diet_parenteral", "npt"]) {
  const partes = buildNutritionParts({ nutritionType: tipo, ...residuo });
  check(`${tipo}: mantém "Correr em"`, temVazao(partes), partes.join(" | "));
  check(`${tipo}: mantém "Vol:"`, temVol(partes));
  check(`${tipo}: mantém "Tempo:"`, temTempo(partes));
}

console.log("\n=== Unidade correta conforme nutRateMode ===");
{
  const gtt = buildNutritionParts({ nutritionType: "diet_enteral", infusionRate: "30", nutRateMode: "gtt" });
  check("gtt -> gts/min", gtt.some((p) => p === "Correr em: 30 gts/min"), gtt.join(" | "));
  const mlh = buildNutritionParts({ nutritionType: "diet_enteral", infusionRate: "62", nutRateMode: "mlh" });
  check("mlh -> mL/h", mlh.some((p) => p === "Correr em: 62 mL/h"), mlh.join(" | "));
}

console.log("\n=== Legado: item sem nutritionType mantém comportamento antigo ===");
{
  const partes = buildNutritionParts({ ...residuo });
  check(
    "sem tipo definido: vazão preservada (não esconde dado preenchido de propósito)",
    temVazao(partes),
    partes.join(" | "),
  );
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Todos os casos passaram.\n");
