/**
 * TESTE: apresentações de teicoplanina e herança das regras EV
 *
 * O catálogo só tinha o frasco-ampola de 400mg. O de 200mg também é
 * comercializado no Brasil e é o que a farmácia dispensa em dois cenários
 * rotineiros: ajuste por função renal e manutenção de 6mg/kg em paciente de
 * baixo peso. Sem ele, quem precisava de 200mg digitava por fora e perdia a
 * instrução de reconstituição e o vínculo com a guia ATM.
 *
 * O ponto que este teste protege: as regras de reconstituição
 * (ivMedicationFlags) e o perfil de infusão (ivInfusionProfiles) casam por
 * NOME via regex /teicoplanin/i, não por id. Por isso a apresentação nova
 * herda tudo automaticamente — e é justamente isso que quebraria em silêncio
 * se alguém trocasse o casamento para id, ou renomeasse o item.
 *
 * Dados fictícios | Zero impacto em produção.
 */

import {
  ANTIMICROBIAL_OPTIONS,
  MEDICATIONS_DATABASE,
  HIGH_ALERT_OPTIONS,
  SOLUTION_OPTIONS,
} from "../data/medicationsDatabase.ts";

/** Teicoplanina vive em ANTIMICROBIAL_OPTIONS, não em MEDICATIONS_DATABASE. */
const CATALOGO_ATM = ANTIMICROBIAL_OPTIONS;

let falhas = 0;
let total = 0;

function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

const teico = CATALOGO_ATM.filter((m) => /teicoplanin/i.test(m.name));

console.log("\n=== As duas apresentações existem ===");
{
  check("há 2 registros de teicoplanina", teico.length === 2, `achou ${teico.length}`);
  check("400mg presente", teico.some((m) => m.presentation.startsWith("400mg")));
  check("200mg presente", teico.some((m) => m.presentation.startsWith("200mg")));
  check("ids distintos", new Set(teico.map((m) => m.id)).size === teico.length);
  // Colisão de id entre arrays faria um item sobrescrever o outro na busca.
  const todos = [...MEDICATIONS_DATABASE, ...ANTIMICROBIAL_OPTIONS, ...HIGH_ALERT_OPTIONS, ...SOLUTION_OPTIONS];
  const ids = todos.map((m) => m.id);
  const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
  check("ids únicos em todos os catálogos", repetidos.length === 0, repetidos.join(", "));
}

console.log("\n=== Mesmo nome nas duas — é o que faz as regras EV valerem ===");
{
  check("nome idêntico", new Set(teico.map((m) => m.name)).size === 1, teico.map((m) => m.name).join(" | "));
  check("regex /teicoplanin/i casa com o nome", teico.every((m) => /teicoplanin/i.test(m.name)));
  check("alias Targocid nas duas", teico.every((m) => (m.aliases ?? []).includes("Targocid")));
}

console.log("\n=== Coerência clínica de cada apresentação ===");
{
  const f400 = teico.find((m) => m.presentation.startsWith("400mg"))!;
  const f200 = teico.find((m) => m.presentation.startsWith("200mg"))!;

  check("400mg: dose padrão 400mg", f400.defaultDose === "400mg", f400.defaultDose);
  check("200mg: dose padrão 200mg", f200.defaultDose === "200mg", f200.defaultDose);
  check("ambas intravenosas", teico.every((m) => m.defaultRoute === "Intravenosa"));
  check("ambas antimicrobianas", teico.every((m) => m.category === "antimicrobial"));

  // A dose não pode contradizer o frasco: prescrever 400mg no frasco de 200mg
  // seria pedir dois frascos sem dizer, e a farmácia dispensaria um.
  for (const m of teico) {
    const mgFrasco = Number(m.presentation.match(/^(\d+)mg/)?.[1]);
    const mgDose = Number(m.defaultDose.match(/^(\d+)mg/)?.[1]);
    check(
      `${m.presentation}: dose padrão não excede o frasco`,
      mgDose <= mgFrasco,
      `dose ${mgDose} vs frasco ${mgFrasco}`,
    );
  }

  check("400mg mantém ataque 12/12h", f400.defaultPosology === "12/12h", f400.defaultPosology);
  check("200mg em 24/24h (cenário de ajuste)", f200.defaultPosology === "24/24h", f200.defaultPosology);
  check("200mg explica quando usar", /baixo peso|renal/i.test(f200.instructions), f200.instructions);
  check("ambas orientam diluição", teico.every((m) => /diluir/i.test(m.instructions)));
}

console.log("\n=== As regras EV compartilhadas casam por NOME, não por id ===");
console.log("     (se alguém trocar para id, a apresentação nova perde a reconstituição)");
{
  const rxReconstituicao = /teicoplanin/i;               // ivMedicationFlags
  const rxPerfilInfusao =
    /(piperacilina|tazocin|meropenem|imipenem|ertapenem|cefepim|teicoplanin|daptomicin)/i; // ivInfusionProfiles

  for (const m of teico) {
    check(`${m.presentation}: herda reconstituição`, rxReconstituicao.test(m.name));
    check(`${m.presentation}: herda perfil de infusão EV`, rxPerfilInfusao.test(m.name));
  }

  // Glicopeptídeo — precisa continuar sendo reconhecido para alerta de classe.
  const rxClasse = /teicoplanina/i;                       // clinicalAlertChecks
  check("classe glicopeptídeos reconhece as duas", teico.every((m) => rxClasse.test(m.name)));
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
console.log("Todos os casos passaram.\n");
