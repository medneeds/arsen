/**
 * TESTE: formatação do momento na etapa pós-validação
 *
 * A etapa pós-validação (PostValidationPrintDialog) substitui, na evolução, um
 * banner que sumia sozinho em 30s, e acrescenta na prescrição um passo que
 * antes não existia.
 *
 * formatMoment é a única lógica pura do componente. O que ela precisa garantir:
 * data ausente ou inválida NÃO pode virar "Invalid Date" na tela de um
 * prontuário — nesses casos o componente cai num texto sem data.
 *
 * O restante do componente é JSX e não é alcançável pela convenção de teste
 * deste projeto (scripts sob tsx, sem DOM nem React Testing Library).
 *
 * Dados fictícios | Zero impacto em produção.
 */

import { formatValidationMoment as formatMoment } from "../lib/formatValidationMoment.ts";

let falhas = 0;
let total = 0;

function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

console.log("\n=== Ausência devolve null (componente omite a data) ===");
check("undefined -> null", formatMoment(undefined) === null);
check("null -> null", formatMoment(null) === null);
check("string vazia -> null", formatMoment("") === null);

console.log("\n=== Data inválida NUNCA vira 'Invalid Date' ===");
for (const ruim of ["não é data", "2026-13-45", "abc", "//"]) {
  const r = formatMoment(ruim);
  check(`"${ruim}" -> null`, r === null, String(r));
}

console.log("\n=== Data válida formata em pt-BR ===");
{
  const d = new Date(2026, 6, 27, 14, 5); // 27/07/2026 14:05 local
  const r = formatMoment(d);
  check("aceita Date", typeof r === "string" && r.includes("27/07/2026"), String(r));
  check("inclui hora zero-padded", typeof r === "string" && r.includes("14:05"), String(r));

  const iso = formatMoment(d.toISOString());
  check("aceita ISO equivalente ao Date", iso === r, `${iso} vs ${r}`);
}

console.log("\n=== Sem 'Invalid Date' em nenhuma saída ===");
{
  const amostras = [undefined, null, "", "x", "2026-13-45", new Date(NaN), new Date(2026, 0, 1)];
  const nenhum = amostras.every((v) => !String(formatMoment(v as never)).includes("Invalid"));
  check("nenhuma amostra produz 'Invalid'", nenhum);
  check("Date(NaN) -> null", formatMoment(new Date(NaN)) === null);
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
console.log("Todos os casos passaram.\n");
