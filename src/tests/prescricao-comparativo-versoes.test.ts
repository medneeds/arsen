/**
 * Comparativo entre versões da prescrição.
 *
 * O diff É o registro do que mudou entre duas versões assinadas. Se um campo
 * não está rastreado, a alteração dele acontece em silêncio: o médico troca o
 * volume da dieta, gera nova versão, e o comparativo diz "nenhuma alteração".
 *
 * O DEFEITO ORIGINAL (16/09/2026): rastreavam-se 12 campos, e TRÊS deles nem
 * existiam no item — "frequency", "observations" e "rate" são nomes mortos (o
 * item usa schedule, instructions e infusionRate). O item tem 85 campos.
 * Ficavam de fora quantidade, volume total, reconstituição, dose de
 * nebulização, fluxo de oxigênio, toda a configuração de dieta e os campos de
 * antimicrobiano exigidos pela CCIH.
 *
 * Este teste trava as duas pontas: todo campo rastreado precisa existir no
 * item, e os campos que mudam a administração precisam estar rastreados.
 *
 * Convenção do projeto: import RELATIVO com extensão .ts.
 */

import { readFileSync } from "node:fs";
import { computePrescriptionDiff } from "../lib/prescriptionDiff.ts";

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

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf-8");
const diffSrc = ler("../lib/prescriptionDiff.ts");
const prescricao = ler("../pages/PrescricaoPage.tsx");

const rastreados = [...diffSrc.matchAll(/\{\s*key:\s*"([a-zA-Z]+)"/g)].map(m => m[1]);
const camposDoItem = (() => {
  const m = prescricao.match(/interface PrescriptionItem\s*\{([\s\S]*?)\n\}/);
  return m ? [...m[1].matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\??\s*:/gm)].map(x => x[1]) : [];
})();

console.log("\nComparativo entre versões da prescrição\n");

check("há campos rastreados", rastreados.length > 0);
check("o item tem campos declarados", camposDoItem.length > 0);

// ── Nenhum nome morto ──────────────────────────────────────────────────────
const inexistentes = rastreados.filter(c => !camposDoItem.includes(c));
check(
  "todo campo rastreado existe no item",
  inexistentes.length === 0,
  inexistentes.length
    ? `nomes mortos: ${inexistentes.join(", ")} — rastrear um campo que não existe é rastrear nada`
    : "",
);

// ── Cobertura do que muda a administração ──────────────────────────────────
const ESSENCIAIS = [
  "dose", "quantity", "route", "schedule", "presentation",
  "diluent", "diluentVolume", "reconstitutionSolvent", "reconstitutionVolume",
  "infusionTime", "infusionRate", "volumeTotal",
  "nutVolDay", "nutAccess", "dietType", "nutFraction",
  "atbJustification", "atbCultureCollected", "atbInfectionSite",
  "instructions", "guidance", "status",
];
const semCobertura = ESSENCIAIS.filter(c => !rastreados.includes(c));
check(
  "campos que mudam a administração estão rastreados",
  semCobertura.length === 0,
  semCobertura.length ? `fora do comparativo: ${semCobertura.join(", ")}` : "",
);

// ── Comportamento ──────────────────────────────────────────────────────────
console.log("\nComportamento");

const base = { id: "a", name: "Dieta enteral", category: "nutrition", route: "SNE" };

const semMudanca = computePrescriptionDiff([base], [{ ...base }]);
check(
  "item idêntico não gera alteração",
  semMudanca.entries.every(e => (e.changes?.length ?? 0) === 0),
);

const volume = computePrescriptionDiff(
  [{ ...base, nutVolDay: "1000" }],
  [{ ...base, nutVolDay: "1500" }],
);
const mudouVolume = volume.entries.some(e =>
  e.changes?.some(f => f.field === "nutVolDay" && f.before === "1000" && f.after === "1500"),
);
check(
  "mudança de volume/dia aparece no comparativo",
  mudouVolume,
  "era o caso que passava em silêncio",
);

const recon = computePrescriptionDiff(
  [{ id: "b", name: "Ceftriaxona", category: "antimicrobial", reconstitutionSolvent: "AD" }],
  [{ id: "b", name: "Ceftriaxona", category: "antimicrobial", reconstitutionSolvent: "Lidocaína 1%" }],
);
check(
  "troca de solvente de reconstituição aparece",
  recon.entries.some(e => e.changes?.some(f => f.field === "reconstitutionSolvent")),
  "trocar AD por lidocaína muda a via segura do medicamento",
);

// Booleano ausente x false é a mesma coisa: a sinalização não está ligada.
const booleano = computePrescriptionDiff(
  [{ ...base }],
  [{ ...base, doubleCheck: false }],
);
check(
  "campo booleano ausente não difere de false",
  booleano.entries.every(e => !e.changes?.some(f => f.field === "doubleCheck")),
  'sem isso o comparativo mostrava "— → false", ruído num documento assinado',
);

const ligou = computePrescriptionDiff(
  [{ ...base, doubleCheck: false }],
  [{ ...base, doubleCheck: true }],
);
check(
  "ligar a dupla checagem aparece como Não → Sim",
  ligou.entries.some(e =>
    e.changes?.some(f => f.field === "doubleCheck" && f.before === "Não" && f.after === "Sim"),
  ),
);

console.log(`\n${total - falhas}/${total} verificações passaram\n`);
if (falhas > 0) process.exit(1);
