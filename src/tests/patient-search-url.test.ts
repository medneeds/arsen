/**
 * URL do painel do paciente aberta a partir da busca (tela inicial e sidebar).
 * Identificacao de paciente: a URL tem de devolver EXATAMENTE os mesmos dados,
 * mesmo com caracteres que quebram query string.
 */
import { test } from "node:test";
import assert from "node:assert";
import { montarUrlPaciente, type PacienteParaUrl } from "../lib/patientSearchUrl.ts";

const base: PacienteParaUrl = {
  id: "abc-123",
  name: "MARIA DA SILVA",
  bedNumber: "L03",
  sectorCode: "red",
  age: "67a",
  medicalRecord: "0012345",
};

const ler = (url: string) => {
  const [caminho, qs] = url.split("?");
  return { caminho, params: new URLSearchParams(qs) };
};

test("caso simples: todos os campos chegam intactos", () => {
  const { caminho, params } = ler(montarUrlPaciente(base));
  assert.strictEqual(caminho, "/paciente");
  assert.strictEqual(params.get("patientId"), "abc-123");
  assert.strictEqual(params.get("patientName"), "MARIA DA SILVA");
  assert.strictEqual(params.get("patientBed"), "L03");
  assert.strictEqual(params.get("patientSector"), "red");
  assert.strictEqual(params.get("patientAge"), "67a");
  assert.strictEqual(params.get("patientRecord"), "0012345");
});

test("nome com acento, cedilha e til volta igual", () => {
  const nome = "JOSÉ AÇÃO DA CONCEIÇÃO";
  assert.strictEqual(ler(montarUrlPaciente({ ...base, name: nome })).params.get("patientName"), nome);
});

test("nome com & # + = e espaco nao corta nem vaza para outro parametro", () => {
  const nome = "ANA & FILHOS #2 + 1=1";
  const { params } = ler(montarUrlPaciente({ ...base, name: nome }));
  assert.strictEqual(params.get("patientName"), nome);
  assert.strictEqual(params.get("patientId"), "abc-123");
  assert.strictEqual(params.get("patientBed"), "L03");
});

test("prontuario com zeros a esquerda nao perde os zeros", () => {
  assert.strictEqual(
    ler(montarUrlPaciente({ ...base, medicalRecord: "000045" })).params.get("patientRecord"),
    "000045",
  );
});

test("sem idade e sem prontuario: parametros omitidos, nao 'null'", () => {
  const { params } = ler(montarUrlPaciente({ ...base, age: null, medicalRecord: null }));
  assert.strictEqual(params.has("patientAge"), false);
  assert.strictEqual(params.has("patientRecord"), false);
});

test("leito EXTRA e homonimos: id distingue pacientes de mesmo nome", () => {
  const a = ler(montarUrlPaciente({ ...base, id: "id-A", bedNumber: "EXTRA1" })).params;
  const b = ler(montarUrlPaciente({ ...base, id: "id-B", bedNumber: "L03" })).params;
  assert.strictEqual(a.get("patientName"), b.get("patientName"));
  assert.notStrictEqual(a.get("patientId"), b.get("patientId"));
  assert.strictEqual(a.get("patientBed"), "EXTRA1");
});
