/**
 * TESTE: SOFA (6 componentes, 0-4 pts, total 0-24) + qSOFA (0-3, >=2 alto).
 *
 * Confere os pontos de cada faixa, a pre-selecao por valor cru (faixaDoValor) nos
 * dois lados de cada limite, o total, e os tres criterios do qSOFA.
 *
 * Dados ficticios | Zero impacto em producao.
 */

import {
  SOFA_RESPIRACAO,
  SOFA_COAGULACAO,
  SOFA_FIGADO,
  SOFA_CARDIOVASCULAR,
  SOFA_NEUROLOGICO,
  SOFA_RENAL,
  SOFA_VASOATIVO_PONTOS,
  calcularSofaTotal,
  componentesPreenchidos,
  pontosComponente,
  type SofaComponente,
} from "../lib/sofa.ts";
import { calcularQSofa } from "../lib/qsofa.ts";

let falhas = 0;
let total = 0;
function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}
const pts = (c: SofaComponente, id: string) => c.faixas.find((f) => f.id === id)?.pontos;
const faixa = (c: SofaComponente, v: number) => c.faixaDoValor?.(v) ?? null;

console.log("\n=== SOFA — pontos por faixa ===");
check("resp ge400 = 0", pts(SOFA_RESPIRACAO, "ge400") === 0);
check("resp lt100_suporte = 4", pts(SOFA_RESPIRACAO, "lt100_suporte") === 4);
check("coag ge150 = 0", pts(SOFA_COAGULACAO, "ge150") === 0);
check("coag lt20 = 4", pts(SOFA_COAGULACAO, "lt20") === 4);
check("figado lt1_2 = 0", pts(SOFA_FIGADO, "lt1_2") === 0);
check("figado ge12 = 4", pts(SOFA_FIGADO, "ge12") === 4);
check("cardio pam_ge70 = 0", pts(SOFA_CARDIOVASCULAR, "pam_ge70") === 0);
check("cardio pam_lt70 = 1", pts(SOFA_CARDIOVASCULAR, "pam_lt70") === 1);
check("cardio vasoativo = SOFA_VASOATIVO_PONTOS", pts(SOFA_CARDIOVASCULAR, "vasoativo") === SOFA_VASOATIVO_PONTOS);
check("neuro g15 = 0", pts(SOFA_NEUROLOGICO, "g15") === 0);
check("neuro g3_5 = 4", pts(SOFA_NEUROLOGICO, "g3_5") === 4);
check("renal lt1_2 = 0", pts(SOFA_RENAL, "lt1_2") === 0);
check("renal ge5 = 4", pts(SOFA_RENAL, "ge5") === 4);

console.log("\n=== SOFA — faixaDoValor nos limites ===");
check("PF 400 -> ge400", faixa(SOFA_RESPIRACAO, 400) === "ge400");
check("PF 399 -> lt400", faixa(SOFA_RESPIRACAO, 399) === "lt400");
check("PF 299 -> lt300", faixa(SOFA_RESPIRACAO, 299) === "lt300");
check("PF 199 -> lt200_suporte", faixa(SOFA_RESPIRACAO, 199) === "lt200_suporte");
check("PF 99 -> lt100_suporte", faixa(SOFA_RESPIRACAO, 99) === "lt100_suporte");
check("plaq 150 -> ge150", faixa(SOFA_COAGULACAO, 150) === "ge150");
check("plaq 149 -> lt150", faixa(SOFA_COAGULACAO, 149) === "lt150");
check("plaq 19 -> lt20", faixa(SOFA_COAGULACAO, 19) === "lt20");
check("bili 1.19 -> lt1_2", faixa(SOFA_FIGADO, 1.19) === "lt1_2");
check("bili 1.2 -> 1_2_1_9", faixa(SOFA_FIGADO, 1.2) === "1_2_1_9");
check("bili 2 -> 2_5_9", faixa(SOFA_FIGADO, 2) === "2_5_9");
check("bili 12 -> ge12", faixa(SOFA_FIGADO, 12) === "ge12");
check("GCS 15 -> g15", faixa(SOFA_NEUROLOGICO, 15) === "g15");
check("GCS 14 -> g13_14", faixa(SOFA_NEUROLOGICO, 14) === "g13_14");
check("GCS 9 -> g6_9", faixa(SOFA_NEUROLOGICO, 9) === "g6_9");
check("GCS 5 -> g3_5", faixa(SOFA_NEUROLOGICO, 5) === "g3_5");
check("creat 1.19 -> lt1_2", faixa(SOFA_RENAL, 1.19) === "lt1_2");
check("creat 3.4 -> 2_3_4", faixa(SOFA_RENAL, 3.4) === "2_3_4");
check("creat 5 -> ge5", faixa(SOFA_RENAL, 5) === "ge5");
check("PAM 70 -> pam_ge70", faixa(SOFA_CARDIOVASCULAR, 70) === "pam_ge70");
check("PAM 69 -> pam_lt70", faixa(SOFA_CARDIOVASCULAR, 69) === "pam_lt70");

console.log("\n=== SOFA — total ===");
check("vazio -> 0", calcularSofaTotal({}) === 0);
check("componentesPreenchidos vazio -> 0", componentesPreenchidos({}) === 0);
check(
  "maximo (4x6) -> 24",
  calcularSofaTotal({
    respiracao: "lt100_suporte", coagulacao: "lt20", figado: "ge12",
    cardiovascular: "vasoativo" /* 3 */, neurologico: "g3_5", renal: "ge5",
  }) === (4 + 4 + 4 + SOFA_VASOATIVO_PONTOS + 4 + 4),
);
check(
  "misto: resp2 + cardio1 + neuro0 = 3",
  calcularSofaTotal({ respiracao: "lt300", cardiovascular: "pam_lt70", neurologico: "g15" }) === 3,
);
check("id invalido conta 0", pontosComponente(SOFA_RENAL, "xyz") === 0);
check("componentesPreenchidos 2", componentesPreenchidos({ respiracao: "lt300", renal: "ge5" }) === 2);

console.log("\n=== qSOFA ===");
check("tudo normal -> 0, baixo", (() => { const r = calcularQSofa({ pasSistolica: 120, freqRespiratoria: 16, glasgowTotal: 15 }); return r.score === 0 && !r.alto; })());
check("PAS 100 -> criterio pasBaixa", calcularQSofa({ pasSistolica: 100 }).criterios.pasBaixa === true);
check("PAS 101 -> sem pasBaixa", calcularQSofa({ pasSistolica: 101 }).criterios.pasBaixa === false);
check("FR 22 -> frAlta", calcularQSofa({ freqRespiratoria: 22 }).criterios.frAlta === true);
check("FR 21 -> sem frAlta", calcularQSofa({ freqRespiratoria: 21 }).criterios.frAlta === false);
check("GCS 14 -> consciencia", calcularQSofa({ glasgowTotal: 14 }).criterios.consciencia === true);
check("GCS 15 -> sem consciencia", calcularQSofa({ glasgowTotal: 15 }).criterios.consciencia === false);
check("2 criterios -> alto", (() => { const r = calcularQSofa({ pasSistolica: 90, freqRespiratoria: 24, glasgowTotal: 15 }); return r.score === 2 && r.alto; })());
check("3 criterios -> 3, alto", calcularQSofa({ pasSistolica: 90, freqRespiratoria: 24, glasgowTotal: 10 }).score === 3);
check("sem valores -> 0 avaliados", calcularQSofa({}).avaliados === 0);

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
console.log("Todos os casos passaram.\n");
