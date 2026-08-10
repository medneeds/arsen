/**
 * TESTE: Renovação de plantão não pode ressuscitar itens suspensos
 *
 * Reportado em 05/08/2026: prescrições do dia seguinte não batiam com a
 * última prescrição validada do dia anterior — reportado inicialmente como
 * "erro nos antibióticos", mas o escopo real é QUALQUER categoria
 * (medicação simples, dieta, inalatório, reposição/eletrólitos,
 * antimicrobiano, cuidados de enfermagem etc.), porque todas compartilham
 * o mesmo array `items` e o mesmo campo `status: 'active' | 'suspended'`.
 *
 * Causa raiz: dois dos três caminhos que copiam prescrição para o dia
 * seguinte (PrescricaoPage.tsx) forçavam `status: 'active'` incondicional-
 * mente em TODOS os itens da fonte, sem checar se o item já estava
 * `'suspended'` (descontinuado por médico/farmácia no dia anterior):
 *
 *   1. Renovação automática de plantão (cruzar 05h SP) — `loadValidatedPrescription`
 *   2. "Somar" rascunho restaurado (SOMAR sem duplicar) — `restoreFromPrescription`
 *
 * Só o terceiro caminho — botão manual "Repetir prescrição anterior"
 * (`openRepeatDialog` / `applyRepeatedItems`) — já filtrava
 * `status === 'active' && !isExtra` corretamente.
 *
 * Este teste replica a regra de filtro que passou a valer nos três
 * caminhos, com itens fictícios cobrindo várias categorias, e falha se
 * algum item suspenso vazar para a lista renovada.
 *
 * Dados fictícios | Zero impacto em produção.
 */

// ── Tipos (subconjunto relevante de PrescriptionItem) ──────────────────

type PrescriptionCategory =
  | "nutrition"
  | "hydration"
  | "replacement"
  | "medication"
  | "antimicrobial"
  | "high_alert"
  | "inhalation"
  | "hemotherapy"
  | "care"
  | "nonstandard";

interface FakePrescriptionItem {
  id: string;
  name: string;
  category: PrescriptionCategory;
  status: "active" | "suspended";
  isExtra?: boolean;
}

// ── Regra replicada dos dois pontos corrigidos em PrescricaoPage.tsx ───
// (renewableItems na renovação automática / filtro no loop de restoreFromPrescription)

function filterRenewable(sourceItems: FakePrescriptionItem[]): FakePrescriptionItem[] {
  return sourceItems.filter((it) => it.status === "active" && !it.isExtra);
}

// ── Fixture: prescrição validada do dia anterior, várias categorias ────

const previousDayItems: FakePrescriptionItem[] = [
  { id: "1", name: "Ceftriaxona 2g EV",       category: "antimicrobial", status: "suspended" }, // trocado por outro esquema
  { id: "2", name: "Dipirona 1g EV",          category: "medication",    status: "active" },
  { id: "3", name: "Dieta enteral polimérica", category: "nutrition",     status: "suspended" }, // suspensa p/ jejum pré-procedimento
  { id: "4", name: "Berotec inalatório",      category: "inhalation",    status: "active" },
  { id: "5", name: "KCl 19,1% reposição",     category: "replacement",   status: "suspended" }, // potássio já corrigido
  { id: "6", name: "SF 0,9% 1000ml",          category: "hydration",     status: "active" },
  { id: "7", name: "Curativo diário",         category: "care",          status: "active" },
  { id: "8", name: "Paracetamol extra S/N",   category: "medication",    status: "active", isExtra: true },
];

// ── Runner mínimo (mesmo estilo dos demais testes do projeto) ──────────

let total = 0;
let falhas = 0;
function check(label: string, cond: boolean, detail?: string) {
  total++;
  if (cond) {
    console.log(`  OK  ${label}`);
  } else {
    falhas++;
    console.error(`FALHA  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("=== Renovação de plantão: itens suspensos nunca voltam ativos ===");
{
  const renewed = filterRenewable(previousDayItems);
  const renewedNames = renewed.map((i) => i.name);

  check(
    "itens ativos (não-extra) de TODAS as categorias são renovados",
    ["Dipirona 1g EV", "Berotec inalatório", "SF 0,9% 1000ml", "Curativo diário"]
      .every((n) => renewedNames.includes(n)),
    `renovados: ${renewedNames.join(", ")}`,
  );

  check(
    "antimicrobiano suspenso NÃO é renovado",
    !renewedNames.includes("Ceftriaxona 2g EV"),
  );
  check(
    "dieta suspensa NÃO é renovada",
    !renewedNames.includes("Dieta enteral polimérica"),
  );
  check(
    "reposição eletrolítica suspensa NÃO é renovada",
    !renewedNames.includes("KCl 19,1% reposição"),
  );
  check(
    "item extra NÃO é renovado (mesma regra do botão manual)",
    !renewedNames.includes("Paracetamol extra S/N"),
  );
  check(
    "nenhum item com status 'suspended' sobrevive ao filtro, para qualquer categoria",
    renewed.every((i) => i.status === "active"),
  );
  check(
    "contagem final bate: 8 itens de origem, 3 suspensos + 1 extra descartados = 4 renovados",
    renewed.length === 4,
    `veio ${renewed.length}`,
  );
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Todos os casos passaram.\n");
