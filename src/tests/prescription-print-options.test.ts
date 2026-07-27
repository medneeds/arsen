/**
 * TESTE: guia regulatória NUNCA vem marcada por padrão
 *
 * Correção de 27/07/2026. A primeira versão da etapa pós-validação exibia a
 * frase "Sairão junto as guias regulatórias aplicáveis (ATM / Psicotrópicos)".
 * Era falso: no diálogo do botão impressora as guias vêm DESMARCADAS e quem
 * escolhe é o usuário.
 *
 * Assumir impressão conjunta é pior que inconveniente. Guia ATM e Guia de
 * Psicotrópicos (Portaria 344) são atos regulatórios — emitir sem que alguém
 * tenha pedido gera papel indevido e passa a impressão de que a guia foi
 * emitida quando talvez não tenha sido.
 *
 * Dados fictícios | Zero impacto em produção.
 */

import { buildPrescriptionPrintOptions } from "../lib/prescriptionPrintOptions.ts";

let falhas = 0;
let total = 0;

function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

console.log("\n=== Sem guia aplicável: nenhuma caixa para marcar ===");
{
  const r = buildPrescriptionPrintOptions(false, false);
  check("sem ATB e sem psicotrópico -> undefined", r === undefined, String(r));
}

console.log("\n=== A REGRA: nenhuma guia vem marcada ===");
for (const [atb, psy, cenario] of [
  [true, false, "só ATB"],
  [false, true, "só psicotrópico"],
  [true, true, "ATB + psicotrópico"],
] as Array<[boolean, boolean, string]>) {
  const opts = buildPrescriptionPrintOptions(atb, psy)!;
  const guias = opts.filter((o) => o.id !== "prescricao");
  check(
    `${cenario}: nenhuma guia com defaultChecked`,
    guias.every((g) => !g.defaultChecked),
    guias.map((g) => `${g.id}=${g.defaultChecked}`).join(", "),
  );
  check(`${cenario}: prescrição vem marcada`, opts[0].defaultChecked === true);
  check(`${cenario}: prescrição é a primeira`, opts[0].id === "prescricao");
}

console.log("\n=== Só aparece a guia que se aplica ===");
{
  const soAtb = buildPrescriptionPrintOptions(true, false)!;
  check("só ATB: tem atm", soAtb.some((o) => o.id === "atm"));
  check("só ATB: NÃO tem psy", !soAtb.some((o) => o.id === "psy"), soAtb.map((o) => o.id).join(","));

  const soPsy = buildPrescriptionPrintOptions(false, true)!;
  check("só psicotrópico: tem psy", soPsy.some((o) => o.id === "psy"));
  check("só psicotrópico: NÃO tem atm", !soPsy.some((o) => o.id === "atm"), soPsy.map((o) => o.id).join(","));

  const ambos = buildPrescriptionPrintOptions(true, true)!;
  check("ambos: 3 opções", ambos.length === 3, String(ambos.length));
  check("ambos: ordem prescricao, atm, psy", ambos.map((o) => o.id).join(",") === "prescricao,atm,psy", ambos.map((o) => o.id).join(","));
}

console.log("\n=== Todas as opções têm rótulo e descrição ===");
{
  const opts = buildPrescriptionPrintOptions(true, true)!;
  check("todas com label não vazio", opts.every((o) => !!o.label.trim()));
  check("todas com description", opts.every((o) => !!o.description?.trim()));
  check("ids únicos", new Set(opts.map((o) => o.id)).size === opts.length);
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
console.log("Todos os casos passaram.\n");
