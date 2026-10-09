/**
 * RENOVACAO NA VIRADA 05h — pontual x aprazado
 *
 * Regra (Artur): na virada do dia clinico (05:00), so o que e APRAZADO/continuo
 * persiste para o plantao seguinte (como pendente de revalidacao). Pontuais —
 * "Agora", "Dose unica" e "Dose de ataque" (posologia "Dose unica" ou "Ataque") —
 * NAO renovam; ficaram no historico do dia anterior, mas nao entram no novo
 * plantao. SOS/ACM/Continuo e os intervalos X/Xh renovam.
 *
 * Espelha isPontualPosology e o filtro de renovacao do PrescricaoPage.
 */

let passed = 0;
let failed = 0;
function assert(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  OK  ${label}`); passed++; }
  else { console.error(`  XX  ${label}${detail ? ` — ${detail}` : ""}`); failed++; }
}

// ── Espelho de isPontualPosology (PrescricaoPage) ──────────────────────────────
function isPontualPosology(posology?: string): boolean {
  const p = (posology || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (!p) return false;
  return p === "agora" || p.includes("unica") || p.includes("ataque");
}

// ── BLOCO 1 — classificacao pontual x aprazado ────────────────────────────────
console.log("\nBLOCO 1 — pontual (nao renova) x aprazado (renova)");
const pontuais = ["Agora", "Dose única", "Dose unica", "Ataque", "ATAQUE"];
const aprazados = ["8/8h", "6/6h", "12/12h", "24/24h", "1/1h", "Contínuo", "SOS", "ACM", ""];

for (const p of pontuais) assert(`"${p}" e pontual (NAO renova)`, isPontualPosology(p) === true, `obtido ${isPontualPosology(p)}`);
for (const p of aprazados) assert(`"${p || "(vazio)"}" e aprazado (RENOVA)`, isPontualPosology(p) === false, `obtido ${isPontualPosology(p)}`);

// ── BLOCO 2 — exemplo polimixina B: ataque nao persiste, horario persiste ─────
console.log("\nBLOCO 2 — Polimixina B: dose de ataque NAO renova, dose de horario renova");
interface Item { id: string; name: string; posology: string; status: string; isExtra?: boolean; }
const prescricaoDiaAnterior: Item[] = [
  { id: "1", name: "Polimixina B (ataque)", posology: "Dose única", status: "active" },
  { id: "2", name: "Polimixina B (manutencao)", posology: "12/12h", status: "active" },
  { id: "3", name: "Dipirona SOS", posology: "SOS", status: "active" },
  { id: "4", name: "Noradrenalina BIC", posology: "Contínuo", status: "active" },
  { id: "5", name: "Ranitidina agora", posology: "Agora", status: "active", isExtra: true },
  { id: "6", name: "ATB suspenso", posology: "8/8h", status: "suspended" },
];

// Filtro de renovacao espelhado do loadValidatedPrescription
const renovados = prescricaoDiaAnterior.filter(
  (it) => it.status === "active" && !it.isExtra && !isPontualPosology(it.posology),
);
const nomesRenovados = renovados.map((i) => i.name);

assert("dose de ataque (Dose unica) NAO renova", !nomesRenovados.includes("Polimixina B (ataque)"));
assert("dose de horario (12/12h) renova", nomesRenovados.includes("Polimixina B (manutencao)"));
assert("SOS renova (continua disponivel)", nomesRenovados.includes("Dipirona SOS"));
assert("Continuo (BIC) renova", nomesRenovados.includes("Noradrenalina BIC"));
assert("Agora extra NAO renova", !nomesRenovados.includes("Ranitidina agora"));
assert("item suspenso NAO renova", !nomesRenovados.includes("ATB suspenso"));
assert("total renovado = 3 (manutencao + SOS + BIC)", renovados.length === 3, `obtido ${renovados.length}`);

// ── RESULTADO ─────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(56)}\n  RESULTADO: ${passed} passed · ${failed} failed\n${"=".repeat(56)}\n`);
if (failed > 0) process.exit(1);
