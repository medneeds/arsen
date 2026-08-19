/**
 * TESTE: cálculo de idade a partir de birth_date (causa raiz da idade estática)
 *
 * `patients.age` é um campo de texto gravado uma única vez na admissão e
 * nunca recalculado — um paciente internado por meses, ou que faz
 * aniversário durante a internação, ficava com a idade "congelada" do dia
 * da admissão em toda tela e documento que lia esse campo direto.
 *
 * A correção não foi "atualizar o campo de tempos em tempos" (ainda ficaria
 * defasado entre atualizações) — foi parar de confiar nele e SEMPRE calcular
 * a idade a partir de `patient_registry.birth_date` (que não muda) no
 * momento da exibição, através de um único ponto de cálculo.
 *
 * Havia também 2 fórmulas diferentes e divergentes pelo sistema: uma
 * aproximada por `365.25 dias` (erra perto do aniversário) e uma
 * calendar-aware (correta). Este teste protege a fórmula correta e os casos
 * de borda que a versão aproximada errava.
 *
 * Dados fictícios | Zero impacto em produção.
 */

import { calculateAgeYears, formatAge } from "../lib/patientAge.ts";

let falhas = 0;
let total = 0;

function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

/** Constrói uma data ISO "yyyy-mm-dd" a partir de hoje menos N anos, M dias. */
function isoDateYearsAgo(years: number, extraDays = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + extraDays);
  return d.toISOString().slice(0, 10);
}

console.log("\n=== Casos básicos ===");
{
  check("nasceu há exatos 45 anos → 45", calculateAgeYears(isoDateYearsAgo(45)) === 45);
  check("nasceu há exatos 1 ano → 1", calculateAgeYears(isoDateYearsAgo(1)) === 1);
  check("recém-nascido (hoje) → 0", calculateAgeYears(new Date().toISOString().slice(0, 10)) === 0);
  check("null → null", calculateAgeYears(null) === null);
  check("undefined → null", calculateAgeYears(undefined) === null);
  check("string vazia → null", calculateAgeYears("") === null);
}

console.log("\n=== O ponto que a fórmula aproximada (365.25 dias) errava ===");
{
  // Aniversário É AMANHÃ: já fez 45 anos há quase 1 ano, mas o 46º só
  // amanhã. A fórmula aproximada podia arredondar para 46 cedo demais;
  // a calendar-aware correta ainda deve dizer 45.
  const aniversarioAmanha = isoDateYearsAgo(46, 1); // nasceu, mas falta 1 dia pro 46º
  check(
    "aniversário é amanhã → ainda 45 (não 46)",
    calculateAgeYears(aniversarioAmanha) === 45,
    `retornou ${calculateAgeYears(aniversarioAmanha)}`,
  );

  // Aniversário foi ONTEM: já completou 46 anos ontem.
  const aniversarioOntem = isoDateYearsAgo(46, -1);
  check(
    "aniversário foi ontem → já 46",
    calculateAgeYears(aniversarioOntem) === 46,
    `retornou ${calculateAgeYears(aniversarioOntem)}`,
  );
}

console.log("\n=== Datas corrompidas não geram idade absurda ===");
{
  // Caso real já visto em produção: ano "19536" em vez de "1953".
  check("ano corrompido (19536) → null, não uma idade gigante", calculateAgeYears("19536-04-10") === null);
  check("ano no futuro → null", calculateAgeYears("2099-01-01") === null);
  check("lixo não-parseável → null", calculateAgeYears("não é uma data") === null);
}

console.log("\n=== formatAge segue o padrão de exibição do sistema (\"45a\") ===");
{
  check("45 anos → \"45a\"", formatAge(isoDateYearsAgo(45)) === "45a");
  check("sem data → null (não \"undefineda\" ou string vazia)", formatAge(null) === null);
}

console.log("\n=== Aceita tanto \"yyyy-mm-dd\" quanto ISO com horário ===");
{
  const dataSoDia = isoDateYearsAgo(30);
  const dataComHora = `${dataSoDia}T12:00:00.000Z`;
  check(
    "yyyy-mm-dd e ISO com horário dão a mesma idade",
    calculateAgeYears(dataSoDia) === calculateAgeYears(dataComHora),
    `${calculateAgeYears(dataSoDia)} vs ${calculateAgeYears(dataComHora)}`,
  );
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
console.log("Todos os casos passaram.\n");
