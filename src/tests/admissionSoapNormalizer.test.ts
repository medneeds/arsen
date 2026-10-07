/**
 * Normalizador do soap de admissao -> campos do formulario de nova admissao
 * (aproveitamento inteligente de cada campo). Cobre o caso real do OSIMAR
 * (atend 128): HDA com laboratorio digitado no fim, AMP/MUC/Alergias, CID,
 * hipoteses, plano e previsao de alta; mais casos de borda (hipotese como JSON
 * de array, soap em HTML, HDA sem lab, HDA vazia, estruturado presente).
 */
import { test } from "node:test";
import assert from "node:assert";
import { normalizeAdmissionSoap } from "../lib/admissionSoapNormalizer.ts";

// soap como o AdmissionForm grava (subjective = HDA\n\nAMP:...\nMUC:...\nAlergias:...).
// O lab foi digitado pelo medico DENTRO da HDA (deve ir para complementares).
const osimarSubjective = [
  "HDA:",
  "Paciente do sexo masculino de 60 anos, previamente hipertenso e etilista, deu entrada por crises convulsivas reentrantes apos libacao alcoolica. Admitido em sala vermelha, intubado em estado pos ictal, admito em UTI.",
  "Ja realizou tomografia de cranio sem alteracoes e torax com opacidade em vidro fosco a direita, sugestiva de processo infeccioso/inflamatorio pulmonar.",
  "Lab admissional: Hb 14,6 | Leu 18480 | Plaq 227000 | Cr 2,07 | K 4,4 | Na 142 | PCR 1,26 | Ur 47,16 | INR 1,05",
  "",
  "AMP: Hipertensao, etilismo",
  "MUC: Desconhecidas",
  "Alergias: Dipirona",
].join("\n");

const osimarSoap = {
  subjective: osimarSubjective,
  objective: "Antropometria: peso — kg, altura — m\nSSVV admissionais: PA — | FC — | FR — | SpO2 — | Tax — | Dx —",
  assessment:
    "CID primario: G41 - Estado de mal epileptico\n\n" +
    "Hipoteses diagnosticas:\nEstado de mal epileptico\n\n" +
    "Justificativa de admissao UTI: Suporte intensivo\nDroga vasoativa: Nao\nOrigem: Sala Vermelha",
  plan: "Suporte intensivo\nHidantalizacao\nOtimizo hidratacao\n\nPrevisao de alta: 01/10/2026 (D+5)",
  __cid_primary: "G41 - Estado de mal epileptico",
  __diagnostic_hypotheses: "Estado de mal epileptico",
  antecedentes: ["Hipertensao", "etilismo"],
};

test("OSIMAR: HDA sem o laboratorio, com a narrativa e a imagem", () => {
  const n = normalizeAdmissionSoap(osimarSoap);
  assert.ok(n.hda.startsWith("Paciente do sexo masculino de 60 anos"));
  assert.ok(n.hda.includes("tomografia de cranio"));
  assert.ok(!/Lab admissional/i.test(n.hda), "HDA nao pode conter o bloco de laboratorio");
  assert.ok(!/HDA\s*:/i.test(n.hda), "HDA nao pode conter o rotulo HDA:");
});

test("OSIMAR: laboratorio vai para complementares", () => {
  const n = normalizeAdmissionSoap(osimarSoap);
  assert.ok(n.complementares.startsWith("Lab admissional:"));
  assert.ok(n.complementares.includes("Hb 14,6"));
  assert.ok(n.complementares.includes("INR 1,05"));
});

test("OSIMAR: AMP, MUC, Alergias, CID, hipoteses, plano e previsao nos campos certos", () => {
  const n = normalizeAdmissionSoap(osimarSoap);
  assert.deepStrictEqual(n.antecedentes, ["Hipertensao", "etilismo"]);
  assert.strictEqual(n.muc, "Desconhecidas");
  assert.strictEqual(n.allergies, "Dipirona");
  assert.strictEqual(n.cidPrimary, "G41 - Estado de mal epileptico");
  assert.deepStrictEqual(n.hypotheses, ["Estado de mal epileptico"]);
  assert.deepStrictEqual(n.planItems, ["Suporte intensivo", "Hidantalizacao", "Otimizo hidratacao"]);
  assert.ok(!n.planItems.some((p) => /Previsao de alta/i.test(p)), "plano nao arrasta a previsao");
  assert.strictEqual(n.dischargeLabel, "01/10/2026 (D+5)");
});

test("hipotese como JSON de array em string vira itens separados", () => {
  const n = normalizeAdmissionSoap({
    subjective: "HDA:\nQuadro x\n\nAMP: —\nMUC: —\nAlergias: —",
    __diagnostic_hypotheses: '["Estado de mal epileptico","PNM?"]',
  });
  assert.deepStrictEqual(n.hypotheses, ["Estado de mal epileptico", "PNM?"]);
  // AMP/MUC/Alergias com "—" nao viram conteudo.
  assert.deepStrictEqual(n.antecedentes, []);
  assert.strictEqual(n.muc, "");
  assert.strictEqual(n.allergies, "");
});

test("antecedentes estruturado como array de 1 item JSON tambem e desempacotado", () => {
  const n = normalizeAdmissionSoap({ subjective: "HDA:\nx", antecedentes: ['["HAS","DM"]'] });
  assert.deepStrictEqual(n.antecedentes, ["HAS", "DM"]);
});

test("soap em HTML (evolucao nova) e convertido antes de parsear", () => {
  const n = normalizeAdmissionSoap({
    subjective: "<p><b>HDA</b>: Paciente com dor toracica.</p><p>AMP: HAS</p><p>MUC: AAS</p><p>Alergias: Nenhuma</p>",
  });
  assert.ok(n.hda.includes("dor toracica"));
  assert.ok(!/AMP/i.test(n.hda));
  assert.deepStrictEqual(n.antecedentes, ["HAS"]);
  assert.strictEqual(n.muc, "AAS");
  assert.strictEqual(n.allergies, "Nenhuma");
});

test("HDA sem laboratorio: complementares fica vazio e HDA intacta", () => {
  const n = normalizeAdmissionSoap({ subjective: "HDA:\nQuadro clinico simples.\n\nAMP: HAS" });
  assert.strictEqual(n.hda, "Quadro clinico simples.");
  assert.strictEqual(n.complementares, "");
});

test("HDA vazia nao arrasta AMP para a historia", () => {
  const n = normalizeAdmissionSoap({ subjective: "HDA:\n\n\nAMP: HAS\nMUC: AAS\nAlergias: Nenhuma" });
  assert.strictEqual(n.hda, "");
  assert.deepStrictEqual(n.antecedentes, ["HAS"]);
});

test("antropometria: peso e altura extraidos do objective", () => {
  const n = normalizeAdmissionSoap({
    subjective: "HDA:\nx",
    objective: "Antropometria: peso 78 kg, altura 1,70 m (IMC 27,0)\nSSVV admissionais: PA 120/80 | FC 88",
  });
  assert.strictEqual(n.weight, "78");
  assert.strictEqual(n.height, "1,70");
});

test("antropometria ausente ('—') nao vira valor", () => {
  const n = normalizeAdmissionSoap({
    subjective: "HDA:\nx",
    objective: "Antropometria: peso — kg, altura — m\nSSVV admissionais: PA — | FC —",
  });
  assert.strictEqual(n.weight, "");
  assert.strictEqual(n.height, "");
});

test("soap nulo/sem chaves devolve tudo vazio, nunca lanca", () => {
  const n = normalizeAdmissionSoap(null);
  assert.strictEqual(n.hda, "");
  assert.strictEqual(n.complementares, "");
  assert.strictEqual(n.muc, "");
  assert.strictEqual(n.allergies, "");
  assert.strictEqual(n.cidPrimary, "");
  assert.strictEqual(n.dischargeLabel, "");
  assert.strictEqual(n.weight, "");
  assert.strictEqual(n.height, "");
  assert.deepStrictEqual(n.hypotheses, []);
  assert.deepStrictEqual(n.antecedentes, []);
  assert.deepStrictEqual(n.planItems, []);
  assert.deepStrictEqual(n.cidSecondary, []);
});
