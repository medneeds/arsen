/** Etapa 4d: escalas, anotacoes, evolucao, SBAR e corpos dos PDFs. */
import { test } from "node:test";
import assert from "node:assert";
import { classificarBraden, classificarMorse, FUGULIN_OPCOES, BRADEN_ITENS } from "../lib/escalasEnfermagem.ts";
import { FUGULIN_AREAS } from "../lib/fugulin.ts";
import {
  montarAnotacaoTecnico, montarIntercorrencia, validarIntercorrencia, montarEvolucao, secoesEvolucao, validarEvolucao, montarSbarLeito,
  type ConteudoEvolucao,
} from "../lib/anotacoesEnfermagem.ts";
import { buildEvolucaoEnfermagemBody, buildSbarBody } from "../lib/enfermagemDocs.ts";

test("Fugulin tem 4 opcoes para cada uma das 12 areas", () => {
  for (const a of FUGULIN_AREAS) assert.strictEqual(FUGULIN_OPCOES[a.key].length, 4, a.key);
});

test("Braden: limites de risco", () => {
  const todos = (v: number) => Object.fromEntries(BRADEN_ITENS.map((i) => [i.key, Math.min(v, i.opcoes.length)]));
  assert.deepStrictEqual([classificarBraden(todos(1)).escore, classificarBraden(todos(1)).risco], [6, "muito_alto"]);
  assert.deepStrictEqual([classificarBraden(todos(4)).escore, classificarBraden(todos(4)).risco], [23, "sem_risco"]);
  // 9 muito alto, 10 alto, 12 alto, 13 moderado, 14 moderado, 15 baixo, 18 baixo, 19 sem risco
  const com = (soma: number) => {
    const resp: Record<string, number> = { percepcao: 1, umidade: 1, atividade: 1, mobilidade: 1, nutricao: 1, friccao: 1 };
    let falta = soma - 6;
    for (const it of BRADEN_ITENS) { const add = Math.min(falta, it.opcoes.length - 1); resp[it.key] += add; falta -= add; }
    return classificarBraden(resp).risco;
  };
  assert.deepStrictEqual([9, 10, 12, 13, 14, 15, 18, 19].map(com), ["muito_alto", "alto", "alto", "moderado", "moderado", "baixo", "baixo", "sem_risco"]);
  assert.strictEqual(classificarBraden({ percepcao: 2 }).completo, false);
  assert.strictEqual(classificarBraden({ percepcao: 1, umidade: 1, atividade: 1, mobilidade: 1, nutricao: 1, friccao: 4 }).completo, false); // friccao vai ate 3
});

test("Morse: pontos e limites", () => {
  const zero = { historico_queda: 0, diagnostico_secundario: 0, auxilio_deambulacao: 0, terapia_ev: 0, marcha: 0, estado_mental: 0 };
  assert.deepStrictEqual([classificarMorse(zero).escore, classificarMorse(zero).risco], [0, "baixo"]);
  assert.strictEqual(classificarMorse({ ...zero, terapia_ev: 1 }).risco, "baixo"); // 20
  assert.strictEqual(classificarMorse({ ...zero, historico_queda: 1 }).risco, "moderado"); // 25
  assert.strictEqual(classificarMorse({ ...zero, historico_queda: 1, terapia_ev: 1 }).risco, "alto"); // 45
  assert.strictEqual(classificarMorse({ historico_queda: 1, diagnostico_secundario: 1, auxilio_deambulacao: 2, terapia_ev: 1, marcha: 2, estado_mental: 1 }).escore, 125);
  assert.strictEqual(classificarMorse({ ...zero, marcha: 3 }).completo, false);
});

test("anotacao do tecnico e intercorrencia", () => {
  assert.strictEqual(montarAnotacaoTecnico({ frases: ["Realizado banho no leito", "Aceitou bem a dieta oferecida."], livre: "  sem   queixas " }),
    "Realizado banho no leito. Aceitou bem a dieta oferecida. sem queixas.");
  assert.strictEqual(montarAnotacaoTecnico({ frases: [], livre: "" }), "");
  assert.deepStrictEqual(validarIntercorrencia({ tipo: "", descricao: "x", condutaImediata: "", medicoComunicado: false }).length, 2);
  assert.strictEqual(
    montarIntercorrencia({ tipo: "Queda", descricao: "Paciente encontrado no chão ao lado do leito", condutaImediata: "Avaliado, sem lesões", medicoComunicado: true }),
    "Intercorrência: Queda. Paciente encontrado no chão ao lado do leito. Conduta imediata: Avaliado, sem lesões. Médico plantonista comunicado.",
  );
});

const evo: ConteudoEvolucao = {
  sistemas: { neurologico: "Glasgow 15", respiratorio: "" },
  fugulin: { escore: 36, categoria: "cuidados_intensivos" },
  braden: { escore: 11, risco: "alto" },
  morse: null,
  diagnosticos: "Risco de lesão por pressão",
  intervencoes: "Mudança de decúbito 2/2h",
  contexto: ["NEWS2 4"],
  anotacoesTurno: ["08:00 TEC A: Realizado banho no leito."],
  observacoes: "",
};

test("evolucao: campo vazio vira traco, escalas e secoes", () => {
  const txt = montarEvolucao(evo);
  assert.ok(txt.includes("Neurológico: Glasgow 15"));
  assert.ok(txt.includes("Respiratório: —"));
  assert.ok(txt.includes("Fugulin 36 — Cuidados intensivos"));
  assert.ok(txt.includes("Braden 11 — Risco alto"));
  assert.ok(txt.includes("Morse: —"));
  assert.ok(!secoesEvolucao(evo).some((s) => s.titulo === "Observações"));
  assert.deepStrictEqual(validarEvolucao(evo), []);
  assert.strictEqual(validarEvolucao({ ...evo, sistemas: {}, diagnosticos: " " }).length, 1);
});

test("SBAR por leito e corpos dos PDFs (escape)", () => {
  const l = montarSbarLeito({
    leito: "L09", paciente: "Paciente <X>", diagnosticos: ["Sepse"], diasInternacao: 4, intercorrencias: ["Queda às 03h"],
    pendencias: ["2 doses atrasadas"], news2Texto: "NEWS2 7", news2Alerta: true, precaucao: "Contato", recomendacao: "Reavaliar acesso",
  });
  assert.strictEqual(l.alerta, true);
  assert.ok(l.s.includes("NEWS2 7 — em alerta"));
  assert.ok(l.b.includes("D4 de internação"));
  assert.deepStrictEqual(l.r, ["2 doses atrasadas", "Reavaliar acesso"]);
  const vazio = montarSbarLeito({ leito: "L10", paciente: "P", diagnosticos: [], intercorrencias: [], pendencias: [] });
  assert.deepStrictEqual(vazio.r, ["Sem pendências registradas"]);
  assert.ok(vazio.b[0].endsWith("—"));
  const html = buildSbarBody([l, vazio], { turno: "Noturno", setor: "UTI 2" });
  assert.ok(html.includes("Paciente &lt;X&gt;"));
  assert.ok(html.includes("sb-alerta"));
  assert.strictEqual((html.match(/class="sb-card/g) ?? []).length, 2);
  const ev = buildEvolucaoEnfermagemBody(secoesEvolucao(evo), { dataHora: "26/11 10:00", status: "Registrada" });
  assert.ok(ev.includes("Exame físico por sistemas"));
  assert.ok(ev.includes("Respiratório: —"));
});

test("diagnosticos legiveis: texto, JSON antigo, vazios e repetidos", async () => {
  const { diagnosticosLegiveis } = await import("../lib/anotacoesEnfermagem.ts");
  assert.deepStrictEqual(diagnosticosLegiveis(['["Sepse","DRC"]', "[]", " ", "Sepse", "Pneumonia"]), ["Sepse", "DRC", "Pneumonia"]);
  assert.deepStrictEqual(diagnosticosLegiveis(["[nao json"]), ["[nao json"]);
  assert.deepStrictEqual(diagnosticosLegiveis(undefined), []);
});
