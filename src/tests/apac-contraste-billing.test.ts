// Testa a expansao de faturamento do APAC: contraste como CODIGO separado.
// Rodar: npx tsx src/tests/apac-contraste-billing.test.ts
import { expandApacBilling, contrasteLineFor, CONTRASTE_TC, CONTRASTE_RM } from "../lib/apacContraste.ts";

let pass = 0, fail = 0;
function eq(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`FALHOU ${label}\n  got =${g}\n  want=${w}`); }
}

const TC = { code: "02.06.01.007-9", name: "TOMOGRAFIA COMPUTADORIZADA DO CRANIO" };
const RM = { code: "02.07.01.006-4", name: "RESSONANCIA MAGNETICA DE CRANIO" };
const USG = { code: "02.05.01.003-0", name: "ULTRASSONOGRAFIA DE ABDOMEN TOTAL" };
const TC_COL = { code: "02.06.01.001-0", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA CERVICAL C/ OU S/ CONTRASTE" };
const ANGIO_RM = { code: "02.07.01.001-3", name: "ANGIORRESSONANCIA CEREBRAL" };

// contrasteLineFor
eq("TC marcado -> CONTRASTE TC", contrasteLineFor({ ...TC, contraste: true }), { ...CONTRASTE_TC });
eq("RM marcado -> CONTRASTE RM", contrasteLineFor({ ...RM, contraste: true }), { ...CONTRASTE_RM });
eq("TC nao marcado -> null", contrasteLineFor({ ...TC, contraste: false }), null);
eq("USG marcado -> null (nao suporta)", contrasteLineFor({ ...USG, contraste: true }), null);
eq("TC c/ou s/ contraste no nome -> null", contrasteLineFor({ ...TC_COL, contraste: true }), null);
eq("AngioRM inerente -> null (nao bitributa)", contrasteLineFor({ ...ANGIO_RM, contraste: true }), null);

// expandApacBilling
eq("TC marcado -> 2 linhas", expandApacBilling([{ ...TC, contraste: true, qty: 1 }]), [
  { code: "02.06.01.007-9", name: "TOMOGRAFIA COMPUTADORIZADA DO CRANIO — COM CONTRASTE", qty: 1 },
  { code: "02.06.03.004-5", name: "CONTRASTE PARA TOMOGRAFIA COMPUTADORIZADA", qty: 1 },
]);
eq("RM marcado qty 2 -> contraste qty 2", expandApacBilling([{ ...RM, contraste: true, qty: 2 }]), [
  { code: "02.07.01.006-4", name: "RESSONANCIA MAGNETICA DE CRANIO — COM CONTRASTE", qty: 2 },
  { code: "02.06.03.005-3", name: "CONTRASTE PARA RESSONÂNCIA MAGNÉTICA", qty: 2 },
]);
eq("TC sem contraste -> 1 linha", expandApacBilling([{ ...TC, contraste: false, qty: 1 }]), [
  { code: "02.06.01.007-9", name: "TOMOGRAFIA COMPUTADORIZADA DO CRANIO", qty: 1 },
]);
// Ordem: contraste logo apos cada exame; 2 exames contrastados -> 4 linhas
eq("2 exames contrastados -> 4 linhas na ordem", expandApacBilling([
  { ...TC, contraste: true, qty: 1 },
  { ...RM, contraste: true, qty: 1 },
]).map(l => l.code), ["02.06.01.007-9", "02.06.03.004-5", "02.07.01.006-4", "02.06.03.005-3"]);
// Limite: 6 exames todos contrastados -> 12 linhas (o chamador bloqueia >6)
eq("6 TC contrastados -> 12 linhas", expandApacBilling(Array.from({ length: 6 }, () => ({ ...TC, contraste: true, qty: 1 }))).length, 12);

console.log(`\n${pass} passaram, ${fail} falharam`);
if (fail > 0) process.exit(1);
