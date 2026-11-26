/** Ponte prescricao -> aprazamento -> checagem (itens reais do banco de teste). */
import { test } from "node:test";
import assert from "node:assert";
import { itensAprazaveis, planejarAprazamento, statusDose, horariosACancelar, parseVolume, ehViaEV, horariosDaOpcao, validarLivre, instanteChecagem, itensJaAprazados } from "../lib/aprazamentoItens.ts";
import { prescriptionValidityWindow } from "../lib/prescriptionValidity.ts";
import { fortalezaLocal, fortalezaParts } from "../lib/docPrefixes.ts";

const agora = fortalezaLocal(2026, 11, 26, 13, 0); // 13h: janela 26/11 12h -> 27/11 12h
const w = prescriptionValidityWindow(agora);
const hora = (d: Date) => fortalezaParts(d).hour;

const ITENS = [
  { id: "atb", name: "Levofloxacino", category: "antimicrobial", status: "active", route: "EV", posology: "12/12h", dose: "1", diluentVolume: "150", atbStartDate: "2026-10-23" },
  { id: "care", name: "Higiene oral com Clorexidina 0,12%", category: "care", status: "active", route: "-", posology: "8/8h" },
  { id: "dex", name: "Dexmedetomidina", category: "high_alert", status: "active", route: "EV", posology: "ACM", highAlert: true, doubleCheck: true, volumeTotal: "100" },
  { id: "agua", name: "Água mineral natural", category: "hydration", status: "active", route: "Gastrostomia", posology: "4/4h", volumeTotal: "200", doseValue: "200" },
  { id: "kcl", name: "Cloreto de Potássio (KCl) 10%", category: "replacement", status: "active", route: "Intravenosa", posology: "12/12h", volumeTotal: "250", diluentVolume: "220" },
  { id: "diet", name: "Dieta enteral", category: "nutrition", status: "active", posology: "Intermitente" },
  { id: "fen", name: "Fenitoína", category: "medication", status: "active", route: "EV", highAlert: true, securityCategory: "MAV_PORT_344" },
  { id: "susp", name: "Dipirona", category: "medication", status: "suspended", route: "EV", posology: "6/6h" },
  { id: "dip", name: "Dipirona 1g", category: "medication", status: "active", route: "EV", posology: "6/6h S/N", volumeTotal: "-" },
  { id: "ond", name: "Ondansetrona", category: "medication", status: "active", route: "EV", posology: "8/8h", schedule: "-" },
  { id: "omep", name: "Omeprazol", category: "medication", status: "active", route: "VO", posology: "1x/dia", schedule: "06h" },
  { name: "" },
  null,
];

test("filtra cuidados, dieta, suspensos e itens sem nome", () => {
  const ids = itensAprazaveis(ITENS, agora).map((i) => i.itemId);
  assert.deepStrictEqual(ids, ["atb", "dex", "agua", "kcl", "fen", "dip", "ond", "omep"]);
  assert.deepStrictEqual(itensAprazaveis(null, agora), []);
  assert.deepStrictEqual(itensAprazaveis("x", agora), []);
});

test("tipo, volume, categoria do BH e MAV", () => {
  const m = new Map(itensAprazaveis(ITENS, agora).map((i) => [i.itemId, i]));
  assert.strictEqual(m.get("atb")!.tipo, "grade");
  assert.strictEqual(m.get("atb")!.volumeMl, 150);
  assert.strictEqual(m.get("atb")!.bhCategoria, "ev_intermitente");
  assert.strictEqual(m.get("atb")!.classe, "antibiotico");
  assert.strictEqual(m.get("atb")!.novoAntibiotico, false);
  assert.strictEqual(m.get("dex")!.tipo, "sn"); // ACM
  assert.strictEqual(m.get("dex")!.mav, true);
  assert.strictEqual(m.get("agua")!.bhCategoria, "agua_enteral");
  assert.strictEqual(m.get("agua")!.volumeMl, 200);
  assert.strictEqual(m.get("kcl")!.volumeMl, 250); // volumeTotal prevalece sobre diluente
  assert.strictEqual(m.get("fen")!.tipo, "manual"); // sem posologia
  assert.strictEqual(m.get("fen")!.mav, true);       // MAV pela categoria de seguranca
  assert.strictEqual(m.get("dip")!.tipo, "grade");   // 6/6h S/N: grade com S/N
  assert.strictEqual(m.get("dip")!.volumeMl, null);
  assert.strictEqual(m.get("dip")!.bhCategoria, null);
  assert.strictEqual(m.get("dip")!.classe, "antitermico");
  assert.strictEqual(m.get("ond")!.classe, "antiemetico");
  assert.deepStrictEqual(m.get("ond")!.recomendacao, []);
  assert.deepStrictEqual(m.get("omep")!.recomendacao, [6]);
  assert.strictEqual(m.get("omep")!.volumeMl, null); // VO comprimido nao vai ao BH
});

test("ATB iniciado hoje: 1a dose imediata", () => {
  const itens = itensAprazaveis([{ ...ITENS[0], atbStartDate: "2026-11-26" }], agora);
  assert.strictEqual(itens[0].novoAntibiotico, true);
  const [p] = planejarAprazamento(itens, w, agora, []);
  assert.strictEqual(p.sugestao.horarios[0].getTime(), agora.getTime());
});

test("planejamento: horario da prescricao prevalece, ja aprazados saem, intercala", () => {
  const itens = itensAprazaveis(ITENS, agora);
  const plano = planejarAprazamento(itens, w, agora, []);
  const ids = plano.map((p) => p.item.itemId);
  assert.strictEqual(ids[0], "atb"); // antibiotico primeiro
  assert.ok(!ids.includes("dex") && !ids.includes("fen")); // S/N e manual fora da sugestao automatica
  const omep = plano.find((p) => p.item.itemId === "omep")!;
  assert.strictEqual(omep.sugestao.modo, "prescricao");
  assert.deepStrictEqual(omep.sugestao.horarios.map(hora), [6]);
  // todas as doses sugeridas ficam dentro da janela e a partir de agora
  for (const p of plano) for (const d of p.sugestao.horarios) {
    assert.ok(d.getTime() >= agora.getTime() && d.getTime() < w.end.getTime(), p.item.itemId);
  }
  // dipirona (antitermico) e ondansetrona (antiemetico) nao caem na mesma hora que o ATB
  const atbH = new Set(plano.find((p) => p.item.itemId === "atb")!.sugestao.horarios.map(hora));
  const ondH = plano.find((p) => p.item.itemId === "ond")!.sugestao.horarios.map(hora);
  assert.ok(ondH.every((h) => !atbH.has(h)), `ond ${ondH} x atb ${[...atbH]}`);
  // item ja aprazado nao e sugerido de novo
  const plano2 = planejarAprazamento(itens, w, agora, [{ itemId: "atb", horario: fortalezaLocal(2026, 11, 26, 22, 0), cancelado: false }]);
  assert.ok(!plano2.some((p) => p.item.itemId === "atb"));
  // cancelado volta a ser sugerido
  const plano3 = planejarAprazamento(itens, w, agora, [{ itemId: "atb", horario: fortalezaLocal(2026, 11, 26, 22, 0), cancelado: true }]);
  assert.ok(plano3.some((p) => p.item.itemId === "atb"));
});

test("status da dose com tolerancia de 60 min", () => {
  const h = fortalezaLocal(2026, 11, 26, 14, 0);
  assert.strictEqual(statusDose(h, fortalezaLocal(2026, 11, 26, 12, 30), null), "pendente");
  assert.strictEqual(statusDose(h, fortalezaLocal(2026, 11, 26, 13, 30), null), "proxima");
  assert.strictEqual(statusDose(h, fortalezaLocal(2026, 11, 26, 15, 0), null), "proxima");
  assert.strictEqual(statusDose(h, fortalezaLocal(2026, 11, 26, 15, 1), null), "atrasada");
  assert.strictEqual(statusDose(h, agora, { status: "realizado" }), "realizada");
  assert.strictEqual(statusDose(h, agora, { status: "nao_realizado" }), "nao_realizada");
  assert.strictEqual(statusDose(h, agora, null, true), "cancelada");
});

test("item suspenso: so horarios futuros e nao checados saem", () => {
  const ap = [
    { itemId: "x", horario: fortalezaLocal(2026, 11, 26, 12, 0), cancelado: false, checado: false }, // passado
    { itemId: "x", horario: fortalezaLocal(2026, 11, 26, 18, 0), cancelado: false, checado: false }, // futuro
    { itemId: "x", horario: fortalezaLocal(2026, 11, 26, 20, 0), cancelado: true, checado: false },
    { itemId: "y", horario: fortalezaLocal(2026, 11, 26, 18, 0), cancelado: false, checado: false }, // ativo
  ];
  const r = horariosACancelar(ap, new Set(["y"]), agora);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(hora(r[0].horario), 18);
  assert.strictEqual(r[0].itemId, "x");
});

test("volume e via", () => {
  assert.strictEqual(parseVolume("150"), 150);
  assert.strictEqual(parseVolume("96,5"), 96.5);
  assert.strictEqual(parseVolume("-"), null);
  assert.strictEqual(parseVolume("0"), null);
  assert.strictEqual(parseVolume("abc"), null);
  assert.strictEqual(parseVolume(50000), null);
  for (const v of ["EV", "Intravenosa", "IV", "endovenosa"]) assert.ok(ehViaEV(v), v);
  for (const v of ["VO", "SC", "IM", "Inalatória", "Evitar"]) assert.ok(!ehViaEV(v), v);
});

test("opcao alternativa e livre", () => {
  const [atb] = itensAprazaveis([ITENS[0]], agora);
  assert.deepStrictEqual(horariosDaOpcao(atb, [10, 22], w, agora).map(hora), [22, 10]); // 13h: 22h hoje, 10h amanha
  const [novo] = itensAprazaveis([{ ...ITENS[0], atbStartDate: "2026-11-26" }], agora);
  const hs = horariosDaOpcao(novo, [14, 2], w, agora).map(hora);
  assert.deepStrictEqual(hs, [13, 2]); // 1a dose agora; 14h colada (<6h) sai
  const ok = validarLivre(atb, "10, 22", w, agora);
  assert.strictEqual(ok.ok, true);
  const curto = validarLivre(atb, "20, 22", w, agora);
  assert.strictEqual(curto.ok, false);
  const poucas = validarLivre(atb, "22", w, agora);
  assert.strictEqual(poucas.ok, false);
  assert.strictEqual(validarLivre(atb, "", w, agora).ok, false);
  const manual = itensAprazaveis([ITENS[6]], agora)[0];
  assert.strictEqual(validarLivre(manual, "18", w, agora).ok, true); // sem frequencia: so horas
  const passou = validarLivre(manual, "12", w, agora);
  assert.strictEqual(passou.ok, false);
});

test("instante da checagem no dia mais proximo do horario", () => {
  const h = fortalezaLocal(2026, 11, 26, 23, 0);
  assert.strictEqual(instanteChecagem("23:10", h)!.getTime(), fortalezaLocal(2026, 11, 26, 23, 10).getTime());
  assert.strictEqual(instanteChecagem("00:20", h)!.getTime(), fortalezaLocal(2026, 11, 27, 0, 20).getTime());
  const h2 = fortalezaLocal(2026, 11, 27, 0, 0);
  assert.strictEqual(instanteChecagem("23:50", h2)!.getTime(), fortalezaLocal(2026, 11, 26, 23, 50).getTime());
  assert.strictEqual(instanteChecagem("25:00", h), null);
  assert.strictEqual(instanteChecagem("x", h), null);
});

test("reaprazamento: item com futuros riscados volta para A aprazar", () => {
  const t = (h: number) => fortalezaLocal(2026, 11, 26, h, 0);
  const ex = [
    { itemId: "a", horario: t(14), cancelado: false, aprazadoEm: t(12) },                     // passado, ativo
    { itemId: "a", horario: t(22), cancelado: true, aprazadoEm: t(12), canceladoEm: t(13) },  // riscado depois
    { itemId: "b", horario: t(22), cancelado: false, aprazadoEm: t(12) },
    { itemId: "c", horario: t(22), cancelado: true, aprazadoEm: t(12), canceladoEm: t(12) },
    { itemId: "c", horario: t(23), cancelado: false, aprazadoEm: t(13) },                     // reaprazado depois do cancelamento
  ];
  assert.deepStrictEqual([...itensJaAprazados(ex)].sort(), ["b", "c"]);
});
