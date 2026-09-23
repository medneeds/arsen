/**
 * Via proibida — Penicilina Benzatina nunca por via endovenosa.
 *
 * Contexto: o catalogo de medicamentos e carregado direto no banco, sem passar
 * pelo git. Em 11/09/2026 encontrou-se "Penicilina Benzatina — 200.000UI" com
 * route = 'EV' no medication_presentations do ambiente de testes. Benzatina e
 * suspensao de deposito: por via endovenosa pode causar parada
 * cardiorrespiratoria. A regra clinica passou a viver no codigo justamente
 * para nao depender do que esta cadastrado.
 *
 * Convencao do projeto: import RELATIVO com extensao .ts, sem alias "@/",
 * porque os testes rodam por `npx tsx <arquivo>`, fora da resolucao do Vite.
 */

import { viaProibidaPara } from "../lib/ivMedicationFlags.ts";
import { runClinicalAlertChecks } from "../lib/clinicalAlertChecks.ts";

let falhas = 0;
let total = 0;

function check(descricao: string, condicao: boolean) {
  total++;
  if (condicao) {
    console.log(`  ok   ${descricao}`);
  } else {
    falhas++;
    console.error(`  FALHA ${descricao}`);
  }
}

console.log("\nVia proibida — benzatina x via endovenosa\n");

// ── Os tres vocabularios de via que convivem no projeto ────────────────────
// sigla do catalogo (EV/IV), nome completo do seletor (Intravenosa) e a forma
// escrita a mao (endovenosa). A trava precisa pegar os tres.
for (const via of ["EV", "IV", "ev", "iv", "Intravenosa", "intravenosa", "Endovenosa", "endo-venosa"]) {
  check(`bloqueia "Penicilina Benzatina" via "${via}"`,
    viaProibidaPara("Penicilina Benzatina", via) !== null);
}

// Nomes como aparecem no catalogo e na digitacao livre dos medicos
for (const nome of [
  "Penicilina Benzatina",
  "PENICILINA G BENZATINA 1.200.000 UI",
  "Benzetacil",
  "Penicilina G Procaina",
]) {
  check(`bloqueia "${nome}" via EV`, viaProibidaPara(nome, "EV") !== null);
}

// ── Vias legitimas continuam passando ──────────────────────────────────────
for (const via of ["IM", "Intramuscular"]) {
  check(`permite "Penicilina Benzatina" via "${via}"`,
    viaProibidaPara("Penicilina Benzatina", via) === null);
}

// ── Nao pode pegar o farmaco errado ────────────────────────────────────────
// Cristalina e aquosa e E endovenosa: bloquea-la seria impedir uso correto.
check('permite "Penicilina G Cristalina" via EV',
  viaProibidaPara("Penicilina G Cristalina", "EV") === null);
check('permite "Benzilpenicilina Potassica" via EV',
  viaProibidaPara("Benzilpenicilina Potassica", "EV") === null);
check('permite "Ceftriaxona" via EV',
  viaProibidaPara("Ceftriaxona", "EV") === null);

// ── Entradas incompletas nao quebram ───────────────────────────────────────
check("nome vazio retorna null", viaProibidaPara("", "EV") === null);
check("via vazia retorna null", viaProibidaPara("Penicilina Benzatina", "") === null);
check("undefined retorna null", viaProibidaPara(undefined, undefined) === null);

// ── Integracao com o motor de alertas ──────────────────────────────────────
const alertas = runClinicalAlertChecks(
  [
    { id: "a", name: "Penicilina Benzatina", category: "antimicrobial", status: "active", route: "EV" },
    { id: "b", name: "Ceftriaxona", category: "antimicrobial", status: "active", route: "EV" },
  ],
  "",
);
const alertaVia = alertas.filter(a => a.type === "route");
check("motor de alertas acusa exatamente 1 via proibida", alertaVia.length === 1);
check("o alerta aponta o item certo", alertaVia[0]?.itemIds[0] === "a");
check("severidade alta", alertaVia[0]?.severity === "high");
check("via proibida vem antes dos demais alertas", alertas[0]?.type === "route");

// Item suspenso nao gera alerta: nao esta em uso.
const suspenso = runClinicalAlertChecks(
  [{ id: "c", name: "Penicilina Benzatina", category: "antimicrobial", status: "suspended", route: "EV" }],
  "",
);
check("item suspenso nao gera alerta de via",
  suspenso.filter(a => a.type === "route").length === 0);

console.log(`\n${total - falhas}/${total} verificacoes passaram\n`);
if (falhas > 0) process.exit(1);
