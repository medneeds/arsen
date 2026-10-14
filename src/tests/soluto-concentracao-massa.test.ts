/**
 * buildSolutoToken — massa a partir da CONCENTRACAO da apresentacao (prescrito em mL)
 *
 * Regra (Artur): quando o item e prescrito em mL e a APRESENTACAO traz a
 * concentracao (mg/mL, mcg/mL, g/mL, UI/mL), o token mostra tambem a massa
 * computada (volume x concentracao) — ex.: Dipirona 500mg/mL, 4 mL -> "4 mL (2 g)".
 * Sem concentracao na apresentacao, o comportamento anterior e preservado (so o volume).
 */
import { buildSolutoToken } from "../lib/solutoToken.ts";

let passed = 0, failed = 0;
function eq(label: string, got: string, exp: string) {
  if (got === exp) { console.log(`  OK  ${label}`); passed++; }
  else { console.error(`  XX  ${label} — esperado "${exp}", obtido "${got}"`); failed++; }
}

// ── Dipirona 500mg/mL (caso do relatorio) ─────────────────────────────────────
eq("Dipirona 500mg/mL, 4 mL -> 2 g",
   buildSolutoToken({ quantity: "4", quantityUnit: "mL", dose: "1g (2mL)", presentation: "500mg/mL - amp 2mL" }),
   "4 mL (2 g)");

eq("Dipirona 500mg/mL, 2 mL -> 1 g",
   buildSolutoToken({ quantity: "2", quantityUnit: "mL", dose: "1g (2mL)", presentation: "500mg/mL - amp 2mL" }),
   "2 mL (1 g)");

eq("Dipirona 500mg/mL, 1 mL -> 500 mg (abaixo de 1 g)",
   buildSolutoToken({ quantity: "1", quantityUnit: "mL", dose: "1g (2mL)", presentation: "500mg/mL - amp 2mL" }),
   "1 mL (500 mg)");

// ── mcg/mL e UI/mL ────────────────────────────────────────────────────────────
eq("Noradrenalina 1mg/mL (=1000mcg/mL irrelevante), 10 mL -> 10 mg",
   buildSolutoToken({ quantity: "10", quantityUnit: "mL", dose: "", presentation: "1mg/mL - Ampola" }),
   "10 mL (10 mg)");

eq("Fentanil 50mcg/mL, 20 mL -> 1 mg (converte mcg->mg)",
   buildSolutoToken({ quantity: "20", quantityUnit: "mL", dose: "", presentation: "50mcg/mL - Ampola" }),
   "20 mL (1 mg)");

eq("Insulina 100UI/mL, 0,5 mL -> 50 UI",
   buildSolutoToken({ quantity: "0,5", quantityUnit: "mL", dose: "", presentation: "100UI/mL - Frasco" }),
   "0,5 mL (50 UI)");

// ── Sem concentracao na apresentacao -> comportamento anterior (so volume) ─────
eq("Agua destilada 'Frasco 100mL', 10 mL -> sem massa",
   buildSolutoToken({ quantity: "10", quantityUnit: "mL", dose: "1g (2mL)", presentation: "Frasco 100mL" }),
   "10 mL");

eq("SF 0,9% (percentual, nao mg/mL), 20 mL -> sem massa",
   buildSolutoToken({ quantity: "20", quantityUnit: "mL", dose: "", presentation: "0,9% - Frasco 500mL" }),
   "20 mL");

// ── Nao prescrito em mL -> nao anexa massa por concentracao ───────────────────
eq("Prescrito em AMP (nao mL) -> sem sufixo de concentracao",
   buildSolutoToken({ quantity: "1", quantityUnit: "ampola", dose: "1g (2mL)", presentation: "500mg/mL - amp 2mL" }),
   "1 AMP 1g (2mL)");

console.log(`\n${"=".repeat(56)}\n  RESULTADO: ${passed} passed · ${failed} failed\n${"=".repeat(56)}\n`);
if (failed > 0) process.exit(1);
