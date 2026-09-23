/**
 * Plano nutricional — persistência e ida e volta.
 *
 * O assistente deixou de ser gerador de uso único: a configuração inteira passa
 * a viver dentro do item (item.nutritionPlan), que é gravado como JSONB. Isto
 * só funciona se o plano sobreviver a duas travessias:
 *
 *   assistente → item → JSON do banco → item → assistente
 *
 * Se qualquer campo se perder nesse caminho, o médico reabre o assistente e
 * encontra a configuração diferente da que salvou — pior que não reabrir, pois
 * ele confia no que vê.
 *
 * Convenção do projeto: import RELATIVO com extensão .ts (testes rodam por
 * `npx tsx <arquivo>`, fora da resolução do Vite).
 */

import {
  emptyNutritionPlan,
  readNutritionPlan,
  deriveInfusionExpression,
  type NutritionPlan,
} from "../lib/nutritionPlan.ts";

let falhas = 0;
let total = 0;

function check(descricao: string, condicao: boolean, detalhe = "") {
  total++;
  if (condicao) console.log(`  ok   ${descricao}`);
  else {
    falhas++;
    console.error(`  FALHA ${descricao}${detalhe ? `\n         ${detalhe}` : ""}`);
  }
}

const AGUA_PADRAO = {
  type: "filtrada",
  route: "sne",
  volumePerOffering: "250",
  fraction: "6/6h",
  temperature: "ambiente",
  restriction: false,
  restrictionLimit: "",
  notes: "",
} as never;

console.log("\nPlano nutricional — persistência\n");

// ── Ida e volta pelo JSON ──────────────────────────────────────────────────
const plano: NutritionPlan = {
  ...emptyNutritionPlan(AGUA_PADRAO),
  modalities: ["enteral"],
  comorbs: ["has", "dm"],
  enteral: {
    system: "fechado", via: "sne", formula: "polim_padrao", mode: "intermitente",
    rate: "", volDay: "1000", fractions: "6", progression: false,
    custom: "Suspender se resíduo > 250 mL",
  },
  notes: "Reavaliação nutricional em 48h",
};

const viaBanco = readNutritionPlan(
  JSON.parse(JSON.stringify(plano)),
  AGUA_PADRAO,
);

check("o plano sobrevive à serialização", viaBanco !== null);
check("modalidades preservadas", viaBanco?.modalities.join() === "enteral");
check("comorbidades preservadas", viaBanco?.comorbs.join() === "has,dm");
check("volume/dia preservado", viaBanco?.enteral.volDay === "1000");
check("número de tomadas preservado", viaBanco?.enteral.fractions === "6");
check("via enteral preservada", viaBanco?.enteral.via === "sne");
check(
  "texto livre do médico preservado",
  viaBanco?.enteral.custom === "Suspender se resíduo > 250 mL",
);
check("observações gerais preservadas", viaBanco?.notes === "Reavaliação nutricional em 48h");

// Comparação campo a campo: pega qualquer chave que se perca na travessia.
const antes = JSON.stringify(plano);
const depois = JSON.stringify(viaBanco);
check(
  "nenhum campo se perde na ida e volta",
  antes === depois,
  antes === depois ? "" : "o plano voltou diferente do que foi salvo",
);

// ── Robustez na leitura ────────────────────────────────────────────────────
console.log("\nLeitura defensiva");

check("objeto vazio não vira plano", readNutritionPlan({}, AGUA_PADRAO) === null);
check("null não vira plano", readNutritionPlan(null, AGUA_PADRAO) === null);
check("string não vira plano", readNutritionPlan("dieta", AGUA_PADRAO) === null);
check(
  "item antigo sem versão não vira plano",
  readNutritionPlan({ modalities: ["oral"] }, AGUA_PADRAO) === null,
  "sem isso, um item anterior à mudança abriria o assistente com dados inventados",
);

const parcial = readNutritionPlan({ v: 1, modalities: ["oral"] }, AGUA_PADRAO);
check("plano parcial é completado com os padrões", parcial?.enteral.via === "sne");
check("plano parcial mantém o que trouxe", parcial?.modalities.join() === "oral");

// ── Expressão de infusão ───────────────────────────────────────────────────
console.log("\nExpressão de infusão");

const continuo: NutritionPlan = {
  ...emptyNutritionPlan(AGUA_PADRAO),
  enteral: { ...emptyNutritionPlan(AGUA_PADRAO).enteral, mode: "continua", rate: "25" },
};
const c = deriveInfusionExpression(continuo);
check("modo contínuo devolve vazão horária", c.kind === "rate" && c.label === "mL/h");

const i = deriveInfusionExpression(plano);
check(
  "modo intermitente devolve volume por tomada, não vazão",
  i.kind === "perIntake" && i.label === "mL/tomada",
  "uma vazão horária em dieta intermitente não corresponde a nada que se administre",
);
check("1000 mL em 6 tomadas ≈ 167 mL", i.value === "167");

const semDados = deriveInfusionExpression({
  ...emptyNutritionPlan(AGUA_PADRAO),
  enteral: { ...emptyNutritionPlan(AGUA_PADRAO).enteral, mode: "intermitente", volDay: "", fractions: "" },
});
check("sem dados não inventa número", semDados.kind === "none" && semDados.value === "");

console.log(`\n${total - falhas}/${total} verificações passaram\n`);
if (falhas > 0) process.exit(1);
