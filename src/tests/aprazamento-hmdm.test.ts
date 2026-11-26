/** Aprazamento HMDM: grade do Anexo A + regras de escolha. */
import { test } from "node:test";
import assert from "node:assert";
import {
  HMDM_GRID, suggestSchedule, validateFreeSchedule, parseFrequencia, parseScheduleHours,
  gradeOptions, splitSuspended, requiresDoubleCheck, type ClasseFarmaco,
} from "../lib/aprazamentoHmdm.ts";
import { prescriptionValidityWindow } from "../lib/prescriptionValidity.ts";
import { fortalezaLocal, fortalezaParts } from "../lib/docPrefixes.ts";

const horas = (ds: Date[]) => ds.map((d) => fortalezaParts(d).hour);
const w = prescriptionValidityWindow(fortalezaLocal(2026, 11, 25, 12, 0));
const meioDia = fortalezaLocal(2026, 11, 25, 12, 0);

test("Anexo A como dado: cada opcao tem 24/intervalo horarios, sem repeticao, espacados", () => {
  for (const [freq, opts] of Object.entries(HMDM_GRID)) {
    const ih = Number(freq.split("/")[0]);
    for (const o of opts) {
      assert.strictEqual(o.hours.length, 24 / ih, o.key);
      assert.strictEqual(new Set(o.hours).size, o.hours.length, o.key);
      const ord = [...o.hours].sort((a, b) => a - b);
      for (let i = 1; i < ord.length; i++) assert.strictEqual(ord[i] - ord[i - 1], ih, o.key);
    }
  }
});

test("cada frequencia do Anexo A: sem ocupacao, sugere a opcao Padrao", () => {
  for (const freq of ["4/4h", "6/6h", "8/8h", "12/12h", "24/24h"]) {
    const s = suggestSchedule({ frequencia: freq, agora: meioDia }, w);
    assert.strictEqual(s.option?.key, `${freq}:padrao`, freq);
    assert.strictEqual(s.modo, "padrao");
  }
});

test("dipirona 6/6h as 12:00 -> 18 00 06 (12 do dia seguinte e a proxima prescricao)", () => {
  const s = suggestSchedule({ frequencia: "6/6h", classe: "antitermico", agora: meioDia }, w);
  assert.deepStrictEqual(horas(s.horarios), [12, 18, 0, 6]);
});

test("ATB novo 8/8h as 12:00 com dipirona 18·00·06·12 -> 1a dose 12, depois Alt 1 (20·04)", () => {
  const ocupados = new Map<number, ClasseFarmaco[]>([[18, ["antitermico"]], [0, ["antitermico"]], [6, ["antitermico"]], [12, ["antitermico"]]]);
  const s = suggestSchedule({ frequencia: "8/8h", classe: "antibiotico", novoAntibiotico: true, agora: meioDia }, w, ocupados);
  assert.strictEqual(s.option?.key, "8/8h:alt1");
  assert.deepStrictEqual(horas(s.horarios), [12, 20, 4]);
  assert.match(s.motivo, /1ª dose imediata/);
  assert.strictEqual(s.custo, 0);
});

test("ATB novo as 15:30: 1a dose imediata, seguintes na grade (nao ancora na hora da 1a)", () => {
  const agora = fortalezaLocal(2026, 11, 25, 15, 30);
  const s = suggestSchedule({ frequencia: "8/8h", classe: "antibiotico", novoAntibiotico: true, agora }, w);
  assert.strictEqual(s.horarios[0].getTime(), agora.getTime());
  for (const d of s.horarios.slice(1)) assert.strictEqual(fortalezaParts(d).minute, 0);
});

test("recomendacao escrita na prescricao prevalece sobre a grade", () => {
  const s = suggestSchedule({ frequencia: "8/8h", recomendacaoPrescricao: parseScheduleHours("08h, 16h, 00h"), agora: meioDia }, w);
  assert.strictEqual(s.modo, "prescricao");
  assert.deepStrictEqual(horas(s.horarios), [16, 0, 8]);
});

test("intercalacao: 6/6h analgesico com padrao ocupado por antitermico escolhe alternativa", () => {
  const ocupados = new Map<number, ClasseFarmaco[]>([[18, ["antitermico"]], [0, ["antitermico"]], [6, ["antitermico"]], [12, ["antitermico"]]]);
  const s = suggestSchedule({ frequencia: "6/6h", classe: "analgesico", agora: meioDia }, w, ocupados);
  assert.notStrictEqual(s.option?.key, "6/6h:padrao");
  assert.strictEqual(s.custo < 1000, true);
});

test("classe 'outro' nao conta choque (so as 4 classes intercaladas)", () => {
  const ocupados = new Map<number, ClasseFarmaco[]>([[18, ["antitermico"]], [0, ["antitermico"]], [6, ["antitermico"]], [12, ["antitermico"]]]);
  const s = suggestSchedule({ frequencia: "6/6h", classe: "outro", agora: meioDia }, w, ocupados);
  assert.strictEqual(s.option?.key, "6/6h:padrao");
});

test("evita 07h e 19h quando houver opcao equivalente", () => {
  const s = suggestSchedule({ frequencia: "12/12h", agora: meioDia }, w);
  assert.strictEqual(horas(s.horarios).some((h) => h === 7 || h === 19), false);
});

test("frequencias especiais: continuo, S/N, ACM, Agora, desconhecida", () => {
  assert.strictEqual(suggestSchedule({ frequencia: "Contínuo", agora: meioDia }, w).modo, "continuo");
  assert.strictEqual(suggestSchedule({ frequencia: "S/N", agora: meioDia }, w).modo, "sn");
  assert.strictEqual(suggestSchedule({ frequencia: "ACM", agora: meioDia }, w).modo, "sn");
  const ag = suggestSchedule({ frequencia: "Agora", agora: meioDia }, w);
  assert.deepStrictEqual([ag.modo, ag.horarios.length], ["agora", 1]);
  assert.strictEqual(suggestSchedule({ frequencia: "q.d.", agora: meioDia }, w).modo, "livre");
});

test("6/6h S/N e intervalo com S/N; 2x/dia equivale a 12/12h; 2/2h vira grade calculada", () => {
  assert.deepStrictEqual(parseFrequencia("6/6h S/N"), { tipo: "intervalo", horas: 6, sn: true });
  assert.strictEqual(gradeOptions(parseFrequencia("2x/dia"))[0].key, "12/12h:padrao");
  const g = gradeOptions(parseFrequencia("2/2h"));
  assert.strictEqual(g[0].hours.length, 12);
});

test("livre invalido: numero de doses e espacamento", () => {
  const ok = validateFreeSchedule([18, 2, 10].map((h) => fortalezaLocal(2026, 11, h >= 12 ? 25 : 26, h)), "8/8h", w);
  assert.strictEqual(ok.ok, true);
  const poucas = validateFreeSchedule([fortalezaLocal(2026, 11, 25, 18)], "8/8h", w);
  assert.strictEqual(poucas.ok, false);
  const coladas = validateFreeSchedule([14, 16, 6].map((h) => fortalezaLocal(2026, 11, h >= 12 ? 25 : 26, h)), "8/8h", w);
  assert.strictEqual(coladas.ok, false);
  assert.match(coladas.erros.join(" "), /intervalo de 2h/);
  const tolerancia = validateFreeSchedule([14, 21, 6].map((h) => fortalezaLocal(2026, 11, h >= 12 ? 25 : 26, h)), "8/8h", w);
  assert.strictEqual(tolerancia.ok, true, "7h entre doses de 8/8h esta dentro da tolerancia de 1h");
  const fora = validateFreeSchedule([18, 2, 13].map((h) => fortalezaLocal(2026, 11, h >= 12 ? (h === 13 ? 26 : 25) : 26, h)), "8/8h", w);
  assert.strictEqual(fora.ok, false);
});

test("leitura do horario da prescricao: formatos aceitos", () => {
  assert.deepStrictEqual(parseScheduleHours("06h, 18h"), [6, 18]);
  assert.deepStrictEqual(parseScheduleHours("06:00, 18:00"), [6, 18]);
  assert.deepStrictEqual(parseScheduleHours("00h-08h-16h"), [0, 8, 16]);
  assert.deepStrictEqual(parseScheduleHours(""), []);
  assert.deepStrictEqual(parseScheduleHours(null), []);
});

test("suspensao: so horarios futuros saem", () => {
  const hs = [18, 0, 6].map((h) => fortalezaLocal(2026, 11, h >= 12 ? 25 : 26, h));
  const { mantidos, riscados } = splitSuspended(hs, fortalezaLocal(2026, 11, 25, 20));
  assert.deepStrictEqual([horas(mantidos), horas(riscados)], [[18], [0, 6]]);
});

test("MAV: dupla checagem pelo marcador da prescricao", () => {
  assert.strictEqual(requiresDoubleCheck({ highAlert: true }), true);
  assert.strictEqual(requiresDoubleCheck({ doubleCheck: true }), true);
  assert.strictEqual(requiresDoubleCheck({ highAlert: "true" }), false);
  assert.strictEqual(requiresDoubleCheck(null), false);
});

test("formatos reais da prescricao: continuo, SOS, conforme, antes/apos", () => {
  for (const v of ["Contínuo", "contínuo", "Contínua (BIC)", "continuo"]) assert.strictEqual(parseFrequencia(v).tipo, "continuo", v);
  for (const v of ["SOS", "Conforme glicemia capilar", "Conforme necessidade", "Conforme demanda", "Antes/após dieta e medicações", "S/N"]) assert.strictEqual(parseFrequencia(v).tipo, "sn", v);
  assert.strictEqual(parseFrequencia("-").tipo, "desconhecida");
  assert.deepStrictEqual(parseFrequencia("6x/dia"), { tipo: "vezes_dia", vezes: 6, sn: false });
  assert.strictEqual(gradeOptions(parseFrequencia("6x/dia"))[0].key, "4/4h:padrao");
  assert.deepStrictEqual(parseScheduleHours("08:00"), [8]);
  assert.deepStrictEqual(parseScheduleHours("Atrelado ao HGT"), []);
});
