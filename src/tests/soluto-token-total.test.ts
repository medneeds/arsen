/**
 * TESTE: total por etapa no buildSolutoToken.
 *
 * Regra cristalina: a dose total POR ETAPA depende da APRESENTACAO (forca por
 * forma) x QUANTIDADE — nao do campo `dose` (ambiguo: ora por-unidade, ora total).
 * Bug corrigido: Vancomicina 500mg/FA + dose "1g" (total, gravada pelo guia ATB) +
 * Qtd 2 FA saia como "total 2g" (dobrado). Deve ser "total 1g".
 *
 * Dados ficticios | Zero impacto em producao.
 */

import { buildSolutoToken } from "../lib/solutoToken.ts";

let falhas = 0;
let total = 0;
function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

console.log("\n=== total por etapa = apresentacao x quantidade ===");

// Bug reportado: Vanco 500mg/FA, dose TOTAL "1g" do guia ATB, Qtd 2 FA.
{
  const s = buildSolutoToken({ presentation: "500mg - Frasco-ampola", dose: "1g", quantity: "2", quantityUnit: "frasco-ampola" });
  check("Vanco dose-total 1g x2 FA -> total 1g", /total 1g\b/.test(s), s);
  check("Vanco dose-total NAO dobra para 2g", !/total 2g\b/.test(s), s);
}

// Caminho correto (dose ja por-unidade "500mg") deve dar o MESMO resultado.
{
  const s = buildSolutoToken({ presentation: "500mg - Frasco-ampola", dose: "500mg", quantity: "2", quantityUnit: "frasco-ampola" });
  check("Vanco dose per-unit 500mg x2 FA -> total 1g", /total 1g\b/.test(s), s);
}

// Oxacilina: 500mg/FA, dose total "2g", Qtd 4 FA -> 4x500mg = 2g (nao 8g).
{
  const s = buildSolutoToken({ presentation: "500mg - Frasco-ampola", dose: "2g", quantity: "4", quantityUnit: "frasco-ampola" });
  check("Oxacilina dose-total 2g x4 FA -> total 2g", /total 2g\b/.test(s), s);
  check("Oxacilina NAO vira 8g", !/total 8g\b/.test(s), s);
}

// qty = 1: sem escalar, nao mostra "total".
{
  const s = buildSolutoToken({ presentation: "500mg - Frasco-ampola", dose: "1g", quantity: "1", quantityUnit: "frasco-ampola" });
  check("qty=1 nao mostra 'total'", !/total/.test(s), s);
}

console.log("\n=== guardas (fallback preserva o comportamento correto) ===");

// Glicose 50%: apresentacao VOLUMETRICA (20mL) com dose em MASSA (10g). A guarda de
// dimensao impede usar 20mL: cai no fallback (dose) e preserva a massa 20g + 40mL.
{
  const s = buildSolutoToken({ presentation: "20mL - Ampola", dose: "10g (20mL)", quantity: "2", quantityUnit: "ampola" });
  check("Glicose 50% preserva massa: total 20g", /total 20g/.test(s), s);
  check("Glicose 50% escala volume embutido: / 40mL", /40mL/.test(s), s);
  check("Glicose 50% NAO troca massa por volume 40mL-total", !/total 40 mL/.test(s), s);
}

// Apresentacao em concentracao (mg/mL): nao ha forca por-forma contavel -> fallback.
{
  const s = buildSolutoToken({ presentation: "667mg/mL - Frasco", dose: "667mg", quantity: "2", quantityUnit: "frasco" });
  check("Concentracao cai no fallback (usa a dose)", /total 1334mg|total 1,334g|total 1334 mg/.test(s) || /667mg/.test(s), s);
}

console.log(`\n=== RESULTADO: ${total - falhas}/${total} OK ===`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
