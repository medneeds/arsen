/** Plantao de enfermagem: turno, NEWS2 de sinais_vitais, fila Agora, resumo do leito. */
import { test } from "node:test";
import assert from "node:assert";
import { turnoAtual, news2DeSinaisVitais, tarefasAgora, resumoLeito, validarSSVV, itensSemAprazamento } from "../lib/plantaoEnfermagem.ts";
import { itensAprazaveis } from "../lib/aprazamentoItens.ts";
import { prescriptionValidityWindow } from "../lib/prescriptionValidity.ts";
import { formatNews2 } from "../lib/news2.ts";
import { fortalezaLocal, fortalezaParts } from "../lib/docPrefixes.ts";

const L = (d: number, h: number, m = 0) => fortalezaLocal(2026, 11, d, h, m);
const hora = (x: Date) => fortalezaParts(x).hour;

test("turno diurno e noturno, inclusive a madrugada", () => {
  const d = turnoAtual(L(26, 10));
  assert.strictEqual(d.label, "Diurno 07h–19h");
  assert.strictEqual(d.inicio.getTime(), L(26, 7).getTime());
  assert.strictEqual(d.fim.getTime(), L(26, 19).getTime());
  const n = turnoAtual(L(26, 2));
  assert.ok(n.noturno);
  assert.strictEqual(n.inicio.getTime(), L(25, 19).getTime());
  assert.strictEqual(n.fim.getTime(), L(26, 7).getTime());
  assert.strictEqual(turnoAtual(L(26, 19)).inicio.getTime(), L(26, 19).getTime());
  assert.strictEqual(turnoAtual(L(26, 7)).noturno, false);
  assert.strictEqual(turnoAtual(L(26, 6, 59)).noturno, true);
});

const base = { data_hora: L(26, 10).toISOString(), freq_respiratoria: 18, spo2: 97, temperatura: 36.8, pressao_sistolica: 120, freq_cardiaca: 80, nivel_consciencia: "alert" };

test("NEWS2: sem o2_suplementar e parcial; com o dado e completo", () => {
  const p = news2DeSinaisVitais(base);
  assert.strictEqual(p.parcial, true);
  assert.ok(formatNews2(p).startsWith("NEWS2 parcial 0"));
  const c = news2DeSinaisVitais({ ...base, o2_suplementar: false });
  assert.strictEqual(c.parcial, false);
  assert.strictEqual(formatNews2(c), "NEWS2 0");
  const o2 = news2DeSinaisVitais({ ...base, o2_suplementar: true });
  assert.strictEqual(o2.score, 2); // O2 suplementar soma 2
});

test("NEWS2: alerta ao enfermeiro com >= 5 ou parametro isolado 3", () => {
  const isolado = news2DeSinaisVitais({ ...base, o2_suplementar: false, pressao_sistolica: 88 });
  assert.strictEqual(isolado.score, 3);
  assert.strictEqual(isolado.alertaEnfermeiro, true);
  const cinco = news2DeSinaisVitais({ ...base, o2_suplementar: true, freq_respiratoria: 22, spo2: 95 });
  assert.strictEqual(cinco.score, 5);
  assert.strictEqual(cinco.alertaEnfermeiro, true);
  const ok = news2DeSinaisVitais({ ...base, o2_suplementar: false, freq_cardiaca: 95 });
  assert.strictEqual(ok.alertaEnfermeiro, false);
  // valores numericos vindos como texto do banco (numeric -> string)
  const txt = news2DeSinaisVitais({ ...base, spo2: "91" as unknown as number, o2_suplementar: false });
  assert.strictEqual(txt.score, 3);
});

test("validacao de faixas do SSVV", () => {
  assert.deepStrictEqual(validarSSVV({ pressao_sistolica: 120, pressao_diastolica: 80, spo2: 97 }), []);
  assert.strictEqual(validarSSVV({ spo2: 120 }).length, 1);
  assert.strictEqual(validarSSVV({ temperatura: 3.68 }).length, 1);
  assert.strictEqual(validarSSVV({ pressao_sistolica: 80, pressao_diastolica: 90 }).length, 1);
  assert.strictEqual(validarSSVV({ fio2: 21 }).length, 1); // FiO2 em fracao, nao %
  assert.strictEqual(validarSSVV({ dor_escala: 11 }).length, 1);
});

const dose = (id: string, h: number, extra: Partial<{ checado: boolean; cancelado: boolean }> = {}) => ({
  id, internacaoId: "i", horario: L(26, h), checagem: extra.checado ? { status: "realizado" as const } : null, cancelado: !!extra.cancelado,
});

test("fila Agora: ate +2h, atrasadas primeiro, sem checadas/canceladas", () => {
  const agora = L(26, 12);
  const doses = [dose("futura", 15), dose("prox", 13), dose("atr1", 10), dose("atr2", 8), dose("chk", 11, { checado: true }), dose("canc", 12, { cancelado: true }), dose("agora", 12)];
  const f = tarefasAgora(doses, agora);
  assert.deepStrictEqual(f.map((t) => t.dose.id), ["atr2", "atr1", "agora", "prox"]);
  assert.strictEqual(f[0].status, "atrasada");
  assert.strictEqual(hora(f[3].dose.horario), 13);
});

test("resumo do leito: contagens, SSVV atrasado, BH pendente apos 09h", () => {
  const agora = L(26, 12);
  const r = resumoLeito({
    agora, doses: [dose("a", 10), dose("b", 12, {}), dose("c", 11, { checado: true })], duplaPendente: 1, semAprazamento: 2,
    ultimoSSVV: { ...base, data_hora: L(26, 4).toISOString(), o2_suplementar: false }, bhAnterior: "fechado", tecnicos: ["ANA"],
  });
  assert.strictEqual(r.atrasadas, 1);
  assert.strictEqual(r.proximaHora, 1);
  assert.strictEqual(r.ssvvHaHoras, 8);
  assert.strictEqual(r.ssvvAtrasado, true);
  assert.strictEqual(r.bhPendente, true);
  assert.strictEqual(r.pendencias, 1 + 1 + 2 + 0 + 1 + 1);
  const cedo = resumoLeito({ agora: L(26, 8), doses: [], duplaPendente: 0, semAprazamento: 0, ultimoSSVV: { ...base, data_hora: L(26, 7).toISOString(), o2_suplementar: false }, bhAnterior: "aberto", tecnicos: [] });
  assert.strictEqual(cedo.bhPendente, false);
  assert.strictEqual(cedo.ssvvAtrasado, false);
  assert.strictEqual(cedo.pendencias, 0);
  const nunca = resumoLeito({ agora, doses: [], duplaPendente: 0, semAprazamento: 0, ultimoSSVV: null, bhAnterior: "validado", tecnicos: [] });
  assert.strictEqual(nunca.news2, null);
  assert.strictEqual(nunca.ssvvAtrasado, true);
});

test("itens sem aprazamento: novo item entra, sem dose restante e S/N nao", () => {
  const agora = L(26, 13);
  const w = prescriptionValidityWindow(agora);
  const itens = itensAprazaveis([
    { id: "a", name: "Cefepime", category: "antimicrobial", status: "active", route: "EV", posology: "8/8h" },
    { id: "b", name: "Dipirona", category: "medication", status: "active", route: "EV", posology: "SOS" },
    { id: "c", name: "Fenitoina", category: "medication", status: "active", route: "EV" },
    { id: "d", name: "Omeprazol", category: "medication", status: "active", route: "VO", posology: "1x/dia", schedule: "06h" },
  ], agora);
  const ex = [{ itemId: "a", horario: L(26, 14), cancelado: false, aprazadoEm: L(26, 12, 30) }];
  assert.deepStrictEqual(itensSemAprazamento(itens, w, agora, ex).map((i) => i.itemId).sort(), ["c", "d"]);
  // perto do fim da vigencia o 1x/dia das 06h ja passou: nao fica pendente
  const tarde = L(27, 11);
  assert.deepStrictEqual(itensSemAprazamento(itens, prescriptionValidityWindow(tarde), tarde, ex).map((i) => i.itemId), ["c"]);
});
