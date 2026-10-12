import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHeaderLayout, formatSexLabel, formatAtendimento, type HeaderPatient } from "../lib/documentHeaderLayout.ts";
import { renderHeaderHtml, renderFooterHtml, type HeaderBrand } from "../lib/documentHeaderHtml.ts";

const brand: HeaderBrand = {
  line1: "PREFEITURA", line2: "SECRETARIA", line3: "HOSPITAL",
  colors: { red: "#r", orange: "#o", yellow: "#y", green: "#g", blue: "#b" },
};
const pac: HeaderPatient = {
  name: "MARINETE COSTA DUTRA", bed: "L14", sector: "UTI 2", record: "193097-1", atendimento: "#000000000165",
  birthDate: "06/10/1968", age: "58a", sex: "F", weight: "62kg", sectorAdmission: "08/10/2026",
  allergies: "Sem relato", motherName: "FRANCISCA FEQUES COSTA",
};
const flat = (l: ReturnType<typeof buildHeaderLayout>) => l.rows.flat();
const find = (l: ReturnType<typeof buildHeaderLayout>, label: string) => flat(l).find((c) => c.label === label);

test("sexo por extenso e nunca assumido", () => {
  assert.equal(formatSexLabel("F"), "Feminino");
  assert.equal(formatSexLabel(" feminino "), "Feminino");
  assert.equal(formatSexLabel("M"), "Masculino");
  assert.equal(formatSexLabel("MASCULINO"), "Masculino");
  assert.equal(formatSexLabel("Outro"), "Outro");
  assert.equal(formatSexLabel("x"), "x");
  assert.equal(formatSexLabel(""), "—");
  assert.equal(formatSexLabel(null), "—");
  assert.equal(formatSexLabel(undefined), "—");
});

test("atendimento sem #", () => {
  assert.equal(formatAtendimento("#000000000165"), "000000000165");
  assert.equal(formatAtendimento(" ## 123 "), "123");
  assert.equal(formatAtendimento(null), "");
});

test("modelo assistencial: campos fixos, sexo por extenso, sem # e alergia verde", () => {
  const l = buildHeaderLayout({ model: "assistencial", title: "Prescrição médica diária", emission: "11/10/2026 19:10:54", patient: pac });
  assert.equal(find(l, "Sexo")?.value, "Feminino");
  assert.equal(find(l, "Atendimento")?.value, "000000000165");
  assert.equal(find(l, "Alergias")?.tone, "allergyOk");
  assert.equal(find(l, "Peso")?.value, "62kg");
  assert.equal(find(l, "Nome da mãe")?.value, "FRANCISCA FEQUES COSTA");
  // Setor aparece antes de Sexo (ordem pedida)
  const labels = flat(l).map((c) => c.label);
  assert.ok(labels.indexOf("Setor") < labels.indexOf("Sexo"));
  assert.equal(find(l, "CPF"), undefined);
});

test("modelo assistencial: alergia real fica em alerta; vazia vira Sem relato (verde)", () => {
  const a = buildHeaderLayout({ model: "assistencial", title: "x", emission: "e", patient: { ...pac, allergies: "Dipirona" } });
  assert.equal(find(a, "Alergias")?.tone, "allergyAlert");
  const b = buildHeaderLayout({ model: "assistencial", title: "x", emission: "e", patient: { ...pac, allergies: "" } });
  assert.equal(find(b, "Alergias")?.value, "Sem relato");
  assert.equal(find(b, "Alergias")?.tone, "allergyOk");
  const c = buildHeaderLayout({ model: "assistencial", title: "x", emission: "e", patient: { ...pac, allergies: "NDAM" } });
  assert.equal(find(c, "Alergias")?.tone, "allergyOk");
});

test("campos clinicos vazios viram traco; opcionais de cadastro somem", () => {
  const l = buildHeaderLayout({ model: "assistencial", title: "x", emission: "e", patient: { name: "FULANO" } });
  assert.equal(find(l, "Peso")?.value, "—");
  assert.equal(find(l, "Prontuário")?.value, "—");
  assert.equal(find(l, "Sexo")?.value, "—");
  assert.equal(find(l, "Nome da mãe"), undefined);
});

test("modelo documental: sem alergias e sem peso; cadastro so quando existe", () => {
  const full = buildHeaderLayout({
    model: "documental", title: "Atestado médico", emission: "e",
    patient: { ...pac, cpf: "123.456.789-00", cns: "702303177283417", phone: "(98) 99999-0000", address: "RUA X, 1" },
  });
  assert.equal(find(full, "Alergias"), undefined);
  assert.equal(find(full, "Peso"), undefined);
  assert.equal(find(full, "CPF")?.value, "123.456.789-00");
  assert.equal(find(full, "CNS")?.value, "702303177283417");
  assert.equal(find(full, "Telefone")?.value, "(98) 99999-0000");
  assert.equal(find(full, "Endereço")?.value, "RUA X, 1");
  const bare = buildHeaderLayout({ model: "documental", title: "x", emission: "e", patient: pac });
  assert.equal(find(bare, "CPF"), undefined);
  assert.equal(find(bare, "CNS"), undefined);
  assert.equal(find(bare, "Telefone"), undefined);
  assert.equal(find(bare, "Endereço"), undefined);
});

test("linha curta: o ultimo valor ocupa as colunas restantes", () => {
  const l = buildHeaderLayout({ model: "documental", title: "x", emission: "e", patient: pac });
  // linha 3 = so Nascimento -> span 1 + 3*2 = 7
  const nasc = find(l, "Nascimento");
  assert.equal(nasc?.span, 7);
});

test("nome social em segunda linha so quando preenchido", () => {
  const com = buildHeaderLayout({ model: "assistencial", title: "x", emission: "e", patient: { ...pac, socialName: "MARINA" } });
  assert.equal(find(com, "Paciente")?.sub, "Nome social: MARINA");
  const sem = buildHeaderLayout({ model: "assistencial", title: "x", emission: "e", patient: { ...pac, socialName: "  " } });
  assert.equal(find(sem, "Paciente")?.sub, undefined);
});

test("linhas extras so entram com valor", () => {
  const l = buildHeaderLayout({ model: "documental", title: "x", emission: "e", patient: pac, extras: [["CID-10", "I10"], ["Caráter", ""], ["Outro", null]] });
  assert.equal(find(l, "CID-10")?.value, "I10");
  assert.equal(find(l, "Caráter"), undefined);
  assert.equal(find(l, "Outro"), undefined);
});

test("semPaciente: so timbrado e faixa", () => {
  const l = buildHeaderLayout({ model: "semPaciente", title: "Censo do setor", complement: "UTI 2 · 10 pacientes", emission: "e", patient: pac });
  assert.deepEqual(l.rows, []);
  assert.equal(l.complement, "UTI 2 · 10 pacientes");
});

test("nome longo e valores com caracteres especiais saem escapados no HTML", () => {
  const l = buildHeaderLayout({ model: "assistencial", title: "A <b>&</b>", emission: "e", patient: { ...pac, name: "JOSE <script>alert(1)</script> & FILHO", allergies: 'Dipirona "forte"' } });
  const html = renderHeaderHtml(l, brand);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&amp; FILHO"));
  assert.ok(html.includes("A &lt;b&gt;&amp;&lt;/b&gt;"));
});

test("HTML traz emissao, faixa com o nome do documento e nao traz # no atendimento", () => {
  const l = buildHeaderLayout({ model: "assistencial", title: "Prescrição médica diária", emission: "11/10/2026 19:10:54", patient: pac });
  const html = renderHeaderHtml(l, brand);
  assert.ok(html.includes("Emissão"));
  assert.ok(html.includes("11/10/2026 19:10:54"));
  assert.ok(html.includes("Prescrição médica diária"));
  assert.ok(!html.includes("#000000000165"));
  assert.ok(html.includes(">000000000165<"));
});

test("rodape leva o codigo do documento e a linha do paciente", () => {
  const f = renderFooterHtml({ patientLine: "FULANO · 58a", documentCode: "PRESC-20261011-1910", leftLabel: "HMDM", centerLabel: "MAN.05-001", stamp: "11/10/2026 19:10" });
  assert.ok(f.includes("Documento: PRESC-20261011-1910"));
  assert.ok(f.includes("FULANO · 58a"));
});

test("assistencial com includeRegistry mostra CPF, CNS, telefone e endereco quando existem", () => {
  const l = buildHeaderLayout({
    model: "assistencial", title: "x", emission: "e", includeRegistry: true,
    patient: { ...pac, cpf: "123", cns: "456", phone: "(98) 1", address: "RUA X" },
  });
  assert.equal(find(l, "CPF")?.value, "123");
  assert.equal(find(l, "CNS")?.value, "456");
  assert.equal(find(l, "Telefone")?.value, "(98) 1");
  assert.equal(find(l, "Endereço")?.value, "RUA X");
  assert.equal(find(l, "Alergias")?.tone, "allergyOk");
  const sem = buildHeaderLayout({ model: "assistencial", title: "x", emission: "e", patient: { ...pac, cpf: "123" } });
  assert.equal(find(sem, "CPF"), undefined);
});
