/** Peso de referencia, dispositivos/VM, NEWS2 parcial, prefixos Norma Zero e Fugulin. */
import { test } from "node:test";
import assert from "node:assert";
import { pesoRefFromRow, parsePesoKg, parseAlturaCm, buildPesoUpdate } from "../lib/pesoReferencia.ts";
import { getActiveDevices, ventilationDayLabel, daysOn, type Dispositivo } from "../lib/devicesActive.ts";
import { news2Status, formatNews2 } from "../lib/news2.ts";
import { DOC_PREFIXES, formatDocCode, isValidDocCode, fortalezaLocal } from "../lib/docPrefixes.ts";
import { classificarFugulin, categoriaPorEscore, horasNecessarias, FUGULIN_AREAS, type FugulinRespostas } from "../lib/fugulin.ts";

// ── Peso ────────────────────────────────────────────────────────────────────
test("peso: aferido com data, estimado sem data, sem peso -> '—'", () => {
  assert.strictEqual(pesoRefFromRow({ peso_kg: 72, peso_origem: "aferido", peso_aferido_em: fortalezaLocal(2026, 11, 20, 8).toISOString() }).texto, "72 kg · aferido 20/11");
  assert.strictEqual(pesoRefFromRow({ peso_kg: "68,5", peso_origem: "estimado" }).texto, "68,5 kg · estimado");
  assert.strictEqual(pesoRefFromRow({ peso_kg: null, peso_origem: "aferido" }).texto, "—");
  assert.strictEqual(pesoRefFromRow(null).texto, "—");
});

test("peso: valores absurdos sao rejeitados; origem desconhecida e ignorada", () => {
  for (const v of [0, -5, 900, "abc", ""]) assert.strictEqual(parsePesoKg(v), null, String(v));
  assert.strictEqual(pesoRefFromRow({ peso_kg: 70, peso_origem: "chute" }).texto, "70 kg");
});

test("altura: metros ou centimetros viram cm; absurdos sao rejeitados", () => {
  assert.strictEqual(parseAlturaCm("1,70"), 170);
  assert.strictEqual(parseAlturaCm("170"), 170);
  assert.strictEqual(parseAlturaCm(1.655), 165.5);
  for (const v of ["", "0", "abc", "5", "400"]) assert.strictEqual(parseAlturaCm(v), null, v);
});

test("gravacao do peso: so campos validos; vazio nao apaga o peso existente", () => {
  const agora = fortalezaLocal(2026, 11, 26, 9);
  assert.deepStrictEqual(buildPesoUpdate("72,5", "1,70", "aferido", agora), {
    peso_kg: 72.5, peso_aferido_em: agora.toISOString(), peso_origem: "aferido", altura_cm: 170,
  });
  assert.deepStrictEqual(buildPesoUpdate("", "", "aferido", agora), {}, "admissao sem peso nao sobrescreve");
  assert.deepStrictEqual(buildPesoUpdate("900", "", "aferido", agora), {}, "peso absurdo nao grava");
  assert.deepStrictEqual(buildPesoUpdate("70", "", undefined, agora), { peso_kg: 70, peso_aferido_em: agora.toISOString() }, "origem undefined nao mexe");
  assert.strictEqual(buildPesoUpdate("70", "", null, agora).peso_origem, null, "prescricao: origem desconhecida");
});

// ── Dispositivos ────────────────────────────────────────────────────────────
const D = (id: string, tipo: string, ins: Date, rem?: Date): Dispositivo => ({ id, tipo, insertedAt: ins, removedAt: rem ?? null });

test("D de VM: IOT -> TQT sem intervalo nao zera a contagem", () => {
  const lista = [D("1", "iot", fortalezaLocal(2026, 11, 20, 10), fortalezaLocal(2026, 11, 24, 9)), D("2", "tqt", fortalezaLocal(2026, 11, 24, 10))];
  assert.strictEqual(ventilationDayLabel(lista, fortalezaLocal(2026, 11, 25, 8)), "D5 de VM");
});

test("D de VM: extubado por mais de 24h e reintubado recomeca", () => {
  const lista = [D("1", "iot", fortalezaLocal(2026, 11, 10, 10), fortalezaLocal(2026, 11, 12, 9)), D("2", "iot", fortalezaLocal(2026, 11, 20, 10))];
  assert.strictEqual(ventilationDayLabel(lista, fortalezaLocal(2026, 11, 25, 8)), "D5 de VM");
});

test("sem via aerea ativa -> null; ativos excluem retirados e futuros", () => {
  const lista = [D("1", "iot", fortalezaLocal(2026, 11, 20, 10), fortalezaLocal(2026, 11, 22, 9)), D("2", "cvc", fortalezaLocal(2026, 11, 19, 10)), D("3", "svd", fortalezaLocal(2026, 11, 30, 10))];
  const at = fortalezaLocal(2026, 11, 25, 8);
  assert.strictEqual(ventilationDayLabel(lista, at), null);
  assert.deepStrictEqual(getActiveDevices(lista, at).map((d) => d.id), ["2"]);
  assert.strictEqual(daysOn(lista[1], at), 6);
});

// ── NEWS2 ───────────────────────────────────────────────────────────────────
const completo = { respiratoryRate: 18, spo2: 96, supplementalOxygen: false, temperature: 37, systolicBp: 120, heartRate: 80, consciousnessLevel: "alert" };

test("NEWS2 completo quando os 7 parametros existem (O2 explicito, inclusive false)", () => {
  const s = news2Status(completo);
  assert.deepStrictEqual([s.parcial, s.score], [false, 0]);
  assert.strictEqual(formatNews2(s), "NEWS2 0");
});

test("NEWS2 sem o2_suplementar e PARCIAL, nunca numero completo", () => {
  const { supplementalOxygen: _o2, ...semO2 } = completo;
  const s = news2Status(semO2);
  assert.strictEqual(s.parcial, true);
  assert.deepStrictEqual(s.faltando, ["supplementalOxygen"]);
  assert.match(formatNews2(s), /^NEWS2 parcial 0 \(sem O₂ suplementar\)$/);
});

test("NEWS2: alerta ao enfermeiro com escore >= 5 ou parametro isolado = 3", () => {
  assert.strictEqual(news2Status({ ...completo, spo2: 90 }).alertaEnfermeiro, true, "SpO2 90 = 3 pontos isolados");
  assert.strictEqual(news2Status({ ...completo, heartRate: 115, respiratoryRate: 22, supplementalOxygen: true }).alertaEnfermeiro, true);
  assert.strictEqual(news2Status({ ...completo, heartRate: 95 }).alertaEnfermeiro, false);
});

// ── Prefixos ────────────────────────────────────────────────────────────────
test("prefixos: nenhum duplicado e formato PREFIXO-AAAAMMDD-HHMM no fuso de Sao Luis", () => {
  const vals = Object.values(DOC_PREFIXES);
  assert.strictEqual(new Set(vals).size, vals.length);
  const code = formatDocCode(DOC_PREFIXES.enfBalanco, new Date(Date.UTC(2026, 10, 26, 1, 5)));
  assert.strictEqual(code, "ENF-BH-20261125-2205");
  for (const p of vals) assert.strictEqual(isValidDocCode(formatDocCode(p)), true, p);
  assert.strictEqual(isValidDocCode("ENF-BH-2026112-2205"), false);
});

// ── Fugulin ─────────────────────────────────────────────────────────────────
const todas = (v: number): FugulinRespostas => Object.fromEntries(FUGULIN_AREAS.map((a) => [a.key, v]));

test("Fugulin: limites de cada categoria e horas COFEN 543/2017", () => {
  assert.deepStrictEqual([12, 17, 18, 22, 23, 28, 29, 34, 35, 48].map(categoriaPorEscore), [
    "cuidados_minimos", "cuidados_minimos", "cuidados_intermediarios", "cuidados_intermediarios",
    "alta_dependencia", "alta_dependencia", "cuidados_semi_intensivos", "cuidados_semi_intensivos",
    "cuidados_intensivos", "cuidados_intensivos",
  ]);
  const r = classificarFugulin(todas(3));
  assert.deepStrictEqual([r.escore, r.categoria, r.horas24h], [36, "cuidados_intensivos", 18]);
});

test("Fugulin incompleto ou fora de 1–4 nao classifica", () => {
  const r = classificarFugulin({ ...todas(2), curativo: undefined, oxigenacao: 5 });
  assert.strictEqual(r.completo, false);
  assert.deepStrictEqual(r.faltando.sort(), ["curativo", "oxigenacao"]);
  assert.strictEqual(r.categoria, null);
});

test("Fugulin: horas necessarias do setor somam so os classificados", () => {
  assert.strictEqual(horasNecessarias(["cuidados_intensivos", "cuidados_minimos", null]), 22);
});
