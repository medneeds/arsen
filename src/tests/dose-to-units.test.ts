/**
 * TESTE: dose -> numero de unidades (ampolas/frascos/comprimidos).
 *
 * Cobre o calculo Qtd = dose / forca_por_unidade da apresentacao e, sobretudo,
 * as RECUSAS de seguranca (faixa, condicional, por peso, concentracao, unidade
 * incompativel, fracao em unidade discreta). Regra: em duvida, nao calcula.
 *
 * Dados ficticios | Zero impacto em producao.
 */

import {
  computeUnitsFromDose,
  parsePresentationStrength,
  type DoseUnitsResult,
} from "../lib/doseToUnits.ts";

let falhas = 0;
let total = 0;
function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}
const ok = (r: DoseUnitsResult | null): r is Extract<DoseUnitsResult, { ok: true }> =>
  !!r && r.ok === true;
const recusa = (r: DoseUnitsResult | null) => !!r && r.ok === false;

console.log("\n=== parsePresentationStrength ===");
{
  const a = parsePresentationStrength("500mg - Frasco-ampola");
  check("500mg-FA: forma frasco-ampola", a.forma === "frasco-ampola", `obtido ${a.forma}`);
  check("500mg-FA: base 500 massa", a.base === 500 && a.dim === "massa", `obtido ${a.base}/${a.dim}`);
  check("1g-FA: base 1000", parsePresentationStrength("1g - Frasco-ampola").base === 1000);
  const v = parsePresentationStrength("10mL - Ampola");
  check("10mL-Ampola: forma ampola, base 10 volume", v.forma === "ampola" && v.base === 10 && v.dim === "volume");
  const c = parsePresentationStrength("667mg/mL - Frasco");
  check("667mg/mL: concentracao detectada", c.isConcentration === true && c.forma === "frasco");
  check("Comprimido 500mg: forma comprimido", parsePresentationStrength("Comprimido 500mg").forma === "comprimido");
  check("Solucao oral: nao contavel -> forma null", parsePresentationStrength("Solução oral 100mL").forma === null);
}

console.log("\n=== calculo OK (dose -> Qtd) ===");
{
  const vanco = computeUnitsFromDose({ presentation: "500mg - Frasco-ampola", dose: "1g" });
  check("Vancomicina 500mg-FA + 1g -> 2 FA",
    ok(vanco) && vanco.quantity === "2" && vanco.unit === "frasco-ampola",
    JSON.stringify(vanco));
  check("Vancomicina: perUnitDose = 500mg (impresso multiplica p/ total)",
    ok(vanco) && vanco.perUnitDose === "500mg", JSON.stringify(vanco));
  const cef1 = computeUnitsFromDose({ presentation: "1g - Frasco-ampola", dose: "1g" });
  check("Ceftriaxona 1g-FA + 1g -> 1", ok(cef1) && cef1.quantity === "1");
  const cef2 = computeUnitsFromDose({ presentation: "2g - Frasco-ampola", dose: "2g" });
  check("Ceftriaxona 2g-FA + 2g -> 1", ok(cef2) && cef2.quantity === "1");
  const pip = computeUnitsFromDose({ presentation: "4,5g - Frasco-ampola", dose: "4,5g" });
  check("Piper/Tazo 4,5g-FA + 4,5g -> 1", ok(pip) && pip.quantity === "1");
  const kcl = computeUnitsFromDose({ presentation: "10mL - Ampola", dose: "20mL" });
  check("KCl 10mL-Ampola + 20mL -> 2 ampola", ok(kcl) && kcl.quantity === "2" && kcl.unit === "ampola");
  const split = computeUnitsFromDose({ presentation: "500mg - Frasco-ampola", doseValue: "1", doseUnit: "g" });
  check("split valor/grandeza (1 + g) -> 2 FA", ok(split) && split.quantity === "2");
  const cpr = computeUnitsFromDose({ presentation: "Comprimido 500mg", dose: "1g" });
  check("Comprimido 500mg + 1g -> 2 comprimido", ok(cpr) && cpr.quantity === "2" && cpr.unit === "comprimido");
}

console.log("\n=== recusas de seguranca ===");
{
  check("fracao (750mg com FA 500mg) -> recusa",
    recusa(computeUnitsFromDose({ presentation: "500mg - Frasco-ampola", dose: "750mg" })));
  check("faixa (1-2 g) -> recusa",
    recusa(computeUnitsFromDose({ presentation: "1g - Frasco-ampola", dose: "1-2g" })));
  check("faixa por extenso (1 a 2 g) -> recusa",
    recusa(computeUnitsFromDose({ presentation: "1g - Frasco-ampola", dose: "1 a 2 g" })));
  check("condicional (ACM) -> recusa",
    recusa(computeUnitsFromDose({ presentation: "10mL - Ampola", dose: "ACM" })));
  check("por peso (mcg/kg/min) -> recusa",
    recusa(computeUnitsFromDose({ presentation: "4mg - Ampola", dose: "0,05 mcg/kg/min" })));
  check("concentracao (667mg/mL Frasco) -> recusa",
    recusa(computeUnitsFromDose({ presentation: "667mg/mL - Frasco", dose: "30mL" })));
  check("unidade incompativel (dose mL, apresentacao mg) -> recusa",
    recusa(computeUnitsFromDose({ presentation: "500mg - Frasco-ampola", dose: "10mL" })));
}

console.log("\n=== silencio (nada a calcular) ===");
{
  check("sem dose -> null", computeUnitsFromDose({ presentation: "500mg - Frasco-ampola", dose: "" }) === null);
  check("apresentacao nao contavel -> null", computeUnitsFromDose({ presentation: "Solução oral 100mL", dose: "10mL" }) === null);
  check("apresentacao vazia -> null", computeUnitsFromDose({ presentation: "", dose: "1g" }) === null);
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
console.log("Todos os casos passaram.\n");
