/**
 * O logout precisa apagar TODO rascunho clinico do navegador.
 *
 * Origem (auditoria de 18/09/2026): a varredura do signOut usava prefixos que
 * nao casavam com nenhuma das chaves de rascunho realmente gravadas, entao
 * prescricao, admissao, SAPS3 e guia ATB do paciente anterior sobreviviam ao
 * logout num terminal compartilhado de plantao.
 *
 * Rodar com: npx tsx src/tests/logout-limpa-rascunhos.test.ts
 */
import { ehChaveSensivel } from "../lib/chavesSensiveis.ts";

let ok = 0;
let falhas = 0;

function check(nome: string, condicao: boolean) {
  if (condicao) {
    ok++;
    console.log(`  OK   ${nome}`);
  } else {
    falhas++;
    console.log(`  FALHA ${nome}`);
  }
}

console.log("  TESTE: logout apaga rascunhos clinicos do localStorage\n");

console.log("=== As chaves REAIS gravadas pelo sistema precisam sair ===");
const DEVEM_SAIR = [
  "rx-draft::MARIA DA SILVA::2026-09-18",   // PrescricaoPage:5483
  "admission_draft:v2:abc-123",             // AdmissionDialog:37
  "saps3_draft:v1:leito-09",                // Saps3Page:363
  "atb-draft-v2-paciente-xyz",              // AntimicrobialGuideDialog:360
  "atb-draft-v2-paciente-xyz-prescribe",    // autosaveKey derivada
  "patients",
  "patientHistory",
  "clinicalNotes",
  "clinicalChecklist",
  "prescriptionCache",
  "evolutionDraft",
  "createUserForm:draft:v1",
  "dev_console:sector_drafts:v1",
];
for (const k of DEVEM_SAIR) check(`sai: ${k}`, ehChaveSensivel(k));

console.log("\n=== O que NAO e dado clinico deve permanecer ===");
const DEVEM_FICAR = [
  "theme",
  "sb-auth-token",
  "i18nextLng",
  "sidebar:collapsed",
  "ultimo_hospital",
  "",
];
for (const k of DEVEM_FICAR) check(`fica: ${k || "<chave vazia>"}`, !ehChaveSensivel(k));

console.log("\n=== Regressao: a lista antiga deixava estas passarem ===");
const REGRA_ANTIGA = /^(patient|clinical|prescription|evolution|exam|culture|note|checklist)/i;
const ESCAPAVAM = [
  "rx-draft::MARIA DA SILVA::2026-09-18",
  "admission_draft:v2:abc-123",
  "saps3_draft:v1:leito-09",
  "atb-draft-v2-paciente-xyz",
];
for (const k of ESCAPAVAM) {
  check(`antes escapava, agora nao: ${k.slice(0, 28)}`, !REGRA_ANTIGA.test(k) && ehChaveSensivel(k));
}

console.log("\n" + "-".repeat(50));
console.log(`${ok}/${ok + falhas} verificacoes passaram`);
if (falhas > 0) {
  console.log(`${falhas} FALHA(S)`);
  process.exit(1);
}
