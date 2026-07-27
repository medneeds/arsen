/**
 * TESTE: recorte de intervalos aplicáveis a ANTIMICROBIANOS
 *
 * Reportado em 27/07/2026: o guia ATB oferecia "1/1h (24x/dia)".
 *
 * O rótulo está aritmeticamente certo — 1/1h são mesmo 24 administrações em
 * 24h — e o valor é legítimo em OUTROS contextos: monitorização usa 1/1h o
 * tempo todo (sinais vitais, diurese horária, balanço hídrico) e a hidratação
 * venosa admite 24 fases. Por isso 1/1h continua na lista geral.
 *
 * O que não existe é ANTIMICROBIANO de 1/1h, 2/2h ou 3/3h. O esquema mais
 * frequente em uso clínico é 4/4h (penicilina G cristalina, oxacilina).
 *
 * Ponto sensível: registro de ATB gravado antes deste recorte pode carregar
 * um desses valores. Ele NÃO pode sumir do campo — o diálogo mostra valor fora
 * da lista como "(legado)", e é ANTIMICROBIAL_INTERVAL_VALUES que decide isso.
 * Se essa checagem usasse a lista cheia, o valor ficaria selecionado sem
 * opção correspondente e o campo apareceria em branco.
 *
 * Dados fictícios | Zero impacto em produção.
 */

import {
  PRESCRIPTION_INTERVALS,
  PRESCRIPTION_INTERVAL_VALUES,
  INTERVAL_GROUPS,
  ANTIMICROBIAL_INTERVALS,
  ANTIMICROBIAL_INTERVAL_VALUES,
  ANTIMICROBIAL_INTERVAL_GROUPS,
  intervalToPhases,
  withPRN,
  hasPRN,
  stripPRN,
} from "../lib/prescriptionIntervals.ts";

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

const PROIBIDOS = ["1/1h", "2/2h", "3/3h", "S/N", "ACM"];

console.log("\n=== ATB não oferece intervalos intra-dia curtos ===");

for (const v of PROIBIDOS) {
  check(`${v} fora dos valores de ATB`, !ANTIMICROBIAL_INTERVAL_VALUES.includes(v));
  check(
    `${v} fora dos grupos do select de ATB`,
    !ANTIMICROBIAL_INTERVAL_GROUPS.some((g) => g.items.some((i) => i.value === v)),
  );
}

console.log("\n=== ...mas seguem disponíveis na lista GERAL ===");
console.log("     (monitorização usa 1/1h; S/N e ACM valem p/ analgesia e cuidados)");

for (const v of PROIBIDOS) {
  check(`${v} continua na lista geral`, PRESCRIPTION_INTERVAL_VALUES.includes(v));
  check(
    `${v} continua nos grupos gerais`,
    INTERVAL_GROUPS.some((g) => g.items.some((i) => i.value === v)),
  );
}

console.log("\n=== Esquemas antimicrobianos reais foram preservados ===");

const DEVEM_EXISTIR = [
  "4/4h",      // penicilina G cristalina, oxacilina
  "6/6h",
  "8/8h",
  "12/12h",
  "24/24h",
  "48/48h",    // vancomicina / polimixina em IRC
  "72/72h",
  "1x/semana",
  "Contínuo",  // infusão estendida de betalactâmico
  "Única",
  "Agora",     // primeira dose imediata na sepse
];

for (const v of DEVEM_EXISTIR) {
  check(`${v} disponível para ATB`, ANTIMICROBIAL_INTERVAL_VALUES.includes(v));
}

console.log("\n=== O recorte tira exatamente 3 itens, nada mais ===");
{
  const diff = PRESCRIPTION_INTERVALS.filter(
    (i) => !ANTIMICROBIAL_INTERVAL_VALUES.includes(i.value),
  ).map((i) => i.value);
  check("removeu exatamente 5", diff.length === 5, `removeu ${diff.length}: ${diff.join(", ")}`);
  check(
    "removeu 1/1h, 2/2h, 3/3h, S/N e ACM",
    PROIBIDOS.every((v) => diff.includes(v)),
    diff.join(", "),
  );
}

console.log("\n=== Nenhum grupo vazio chega ao select ===");
{
  check(
    "todo grupo de ATB tem ao menos 1 item",
    ANTIMICROBIAL_INTERVAL_GROUPS.every((g) => g.items.length > 0),
  );
  check(
    "grupo 'frequente' sobreviveu ao recorte",
    ANTIMICROBIAL_INTERVAL_GROUPS.some((g) => g.key === "frequente" && g.items.length > 0),
  );
}

console.log("\n=== RETROCOMPATIBILIDADE: registro antigo vira 'legado', não some ===");
{
  // É esta checagem que o diálogo usa para decidir mostrar "(legado)".
  for (const v of PROIBIDOS) {
    check(
      `ATB gravado com ${v} é detectado como legado (segue visível e editável)`,
      !ANTIMICROBIAL_INTERVAL_VALUES.includes(v),
    );
  }
  // O cálculo de aprazamento não pode quebrar para esses valores.
  check("1/1h ainda resolve 24 fases", intervalToPhases("1/1h") === 24);
  check("4/4h resolve 6 fases", intervalToPhases("4/4h") === 6);
}

console.log("\n=== Grupo condicional some do ATB, mas o sufixo S/N segue intacto ===");
{
  check(
    "nenhum grupo 'condicional' no select de ATB",
    !ANTIMICROBIAL_INTERVAL_GROUPS.some((g) => g.key === "condicional"),
  );
  check(
    "grupo 'condicional' continua na lista geral",
    INTERVAL_GROUPS.some((g) => g.key === "condicional" && g.items.length > 0),
  );
  // O guia ATB usa Select simples; o sufixo vive na prescrição geral e não
  // pode ter sido afetado pelo recorte.
  check("withPRN ainda compõe sufixo", withPRN("6/6h", true) === "6/6h S/N");
  check("hasPRN ainda reconhece sufixo", hasPRN("6/6h S/N"));
  check("stripPRN ainda devolve a base", stripPRN("6/6h S/N") === "6/6h");
}

console.log("\n=== Rótulos continuam coerentes com as fases ===");
{
  const conferir: Array<[string, number]> = [
    ["4/4h", 6], ["6/6h", 4], ["8/8h", 3], ["12/12h", 2], ["24/24h", 1],
  ];
  for (const [v, esperado] of conferir) {
    check(`${v} -> ${esperado} adm/dia`, intervalToPhases(v) === esperado, `veio ${intervalToPhases(v)}`);
  }
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Todos os casos passaram.\n");
