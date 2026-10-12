import { test } from "node:test";
import assert from "node:assert";
import {
  supportsContraste, isContrasteInerente, comContraste, procedureDisplayName,
  contrasteObservation, observationsWithContraste, cleanDiagnosisText,
} from "../lib/apacContraste.ts";

const TC = { name: "TOMOGRAFIA COMPUTADORIZADA DO CRÂNIO", code: "02.06.01.007-9" };
const ANGIO = { name: "ANGIOTOMOGRAFIA DE ARTÉRIAS PULMONARES (TEP)", code: "02.06.01.005-2" };
const RM = { name: "RESSONÂNCIA MAGNÉTICA DE CRÂNIO", code: "02.07.01.001-3" };
const DOPPLER = { name: "DOPPLER COLORIDO DE VASOS CERVICAIS", code: "02.05.02.001-7" };

test("padrao e sem contraste; marcado vira com contraste so em TC/RM", () => {
  assert.equal(comContraste(TC), false);
  assert.equal(procedureDisplayName(TC), TC.name);
  assert.equal(comContraste({ ...TC, contraste: true }), true);
  assert.equal(procedureDisplayName({ ...TC, contraste: true }), TC.name + " — COM CONTRASTE");
  assert.equal(procedureDisplayName({ ...RM, contraste: true }), RM.name + " — COM CONTRASTE");
});

test("angiotomografia e sempre com contraste; doppler nunca", () => {
  assert.equal(isContrasteInerente(ANGIO.name), true);
  assert.equal(comContraste(ANGIO), true);
  assert.equal(procedureDisplayName(ANGIO), ANGIO.name + " — COM CONTRASTE");
  assert.equal(supportsContraste(DOPPLER.name, DOPPLER.code), false);
  assert.equal(procedureDisplayName({ ...DOPPLER, contraste: true }), DOPPLER.name);
});

test("nao duplica o sufixo", () => {
  const p = { name: "TC DE ABDOME COM CONTRASTE", code: "02.06.03.002-9", contraste: true };
  assert.equal(procedureDisplayName(p), p.name);
});

test("observacao lista so o que leva contraste e nao duplica", () => {
  const names = [
    procedureDisplayName({ ...TC, contraste: true }),
    procedureDisplayName({ name: "TOMOGRAFIA COMPUTADORIZADA DO TÓRAX", code: "02.06.03.001-0" }),
    procedureDisplayName(ANGIO),
    procedureDisplayName({ ...RM, contraste: true }),
  ];
  assert.equal(contrasteObservation(names), "Contraste: TC CRÂNIO, ANGIOTC ARTÉRIAS PULMONARES (TEP) e RM CRÂNIO com contraste.");
  assert.equal(contrasteObservation([TC.name]), "");
  const once = observationsWithContraste("QP: x", names);
  assert.ok(once.endsWith("com contraste."));
  assert.equal(observationsWithContraste(once, names), once);
  assert.equal(observationsWithContraste("", names), contrasteObservation(names));
  assert.equal(observationsWithContraste("QP: x", [TC.name]), "QP: x");
});

test("diagnostico serializado vira texto limpo", () => {
  assert.equal(cleanDiagnosisText('["CAD desencadeada por sepse de foco cutâneo"]'), "CAD desencadeada por sepse de foco cutâneo");
  assert.equal(cleanDiagnosisText('["IAMSSST","IC descompensada??","Pneumonia"]'), "IAMSSST; IC descompensada??; Pneumonia");
  assert.equal(cleanDiagnosisText("texto comum [com colchete]"), "texto comum [com colchete]");
  assert.equal(cleanDiagnosisText(null), "");
});
