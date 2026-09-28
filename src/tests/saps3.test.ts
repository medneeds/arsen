/**
 * TESTE: SAPS 3 — tabela de faixas, pontuação e unidades
 *
 * A tabela segue o SAPS 3 original (Moreno 2005), conferida com as
 * calculadoras MedNerd e MDCalc (28/09/2026). Cada limite de faixa numérica é
 * testado dos dois lados; os itens categóricos têm os pontos conferidos um a
 * um; e dois pacientes completos têm total e mortalidade calculados à mão.
 *
 * Leucócitos e plaquetas são digitados como contagem completa por mm³; banco e
 * faixas seguem em milhares.
 *
 * Dados fictícios | Zero impacto em produção.
 */

import {
  BILIRRUBINA,
  COMORBIDADES,
  CREATININA,
  DIAS_ANTES_UTI,
  FC,
  GLASGOW,
  IDADE,
  INFECCAO,
  LEUCOCITOS,
  LOCAL_ANTES_UTI,
  MOTIVOS_ADMISSAO,
  OXIGENACAO,
  PAS,
  PH,
  PLAQUETAS,
  SITIO_CIRURGICO,
  STATUS_CIRURGICO,
  TEMPERATURA,
  calcularSaps3,
  contagemParaMil,
  faixaEfetiva,
  formatarContagem,
  lerNumero,
  milParaContagem,
  motivoDoBanco,
  normalizarComorbidades,
  plaquetasParaBanco,
  predictMortality,
  somenteDigitos,
  type ItemFaixas,
  type RespostasSaps3,
} from "../lib/saps3.ts";

let falhas = 0;
let total = 0;

function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

const pts = (item: ItemFaixas, v: number) => {
  const id = item.faixaDoValor!(v);
  return item.faixas.find((f) => f.id === id)?.pontos;
};
const faixa = (item: ItemFaixas, v: number, esperado: number, nome: string) => {
  const p = pts(item, v);
  check(`${nome} ${v} -> ${esperado}`, p === esperado, `obtido ${p}`);
};
const ptsId = (item: ItemFaixas, id: string) => item.faixas.find((f) => f.id === id)?.pontos;

console.log("\n=== Box I — idade e dias antes da UTI ===");
{
  for (const [v, e] of [[18, 0], [39, 0], [40, 5], [59, 5], [60, 9], [69, 9], [70, 13], [74, 13], [75, 15], [79, 15], [80, 18], [95, 18]] as const) faixa(IDADE, v, e, "idade");
  for (const [v, e] of [[0, 0], [13, 0], [14, 6], [27, 6], [28, 7], [60, 7]] as const) faixa(DIAS_ANTES_UTI, v, e, "dias");
}

console.log("\n=== Box I — local, comorbidades ===");
{
  check("centro cirúrgico 0", ptsId(LOCAL_ANTES_UTI, "operating_room") === 0);
  check("emergência 5", ptsId(LOCAL_ANTES_UTI, "emergency") === 5);
  check("outra UTI 7", ptsId(LOCAL_ANTES_UTI, "other_icu") === 7);
  check("enfermaria/outros 8", ptsId(LOCAL_ANTES_UTI, "same_hospital_floor") === 8);
  check("outro hospital 8", ptsId(LOCAL_ANTES_UTI, "other_hospital") === 8);
  const c = (id: string) => COMORBIDADES.find((x) => x.id === id)?.pontos;
  check("terapia oncológica/imunossupressão 3", c("chemotherapy") === 3);
  check("ICC NYHA IV 6", c("heart_failure_nyha4") === 6);
  check("câncer hematológico 6", c("cancer_hematologic") === 6);
  check("cirrose 8", c("cirrhosis") === 8);
  check("AIDS 8", c("hiv_aids") === 8);
  check("câncer metastático 11", c("cancer_metastatic") === 11);
  const n = normalizarComorbidades(["immunosuppression", "chemotherapy", "chronic_renal", "cirrhosis"]);
  check("legado: imunossupressão vira terapia (sem duplicar)", n.filter((x) => x === "chemotherapy").length === 1);
  check("legado: DRC descartada (não é SAPS 3)", !n.includes("chronic_renal"));
}

console.log("\n=== Box II — motivo, cirurgia, infecção ===");
{
  const m = (id: string) => MOTIVOS_ADMISSAO.find((x) => x.id === id)?.pontos;
  check("arritmia -5", m("arritmia") === -5);
  check("convulsões -4", m("convulsoes") === -4);
  check("choque hipovolêmico 3", m("choque_hipovolemico") === 3);
  check("choque séptico 5", m("choque_septico") === 5);
  check("choque anafilático/misto 5", m("choque_outro") === 5);
  check("rebaixamento 4", m("rebaixamento") === 4);
  check("déficit focal 7", m("deficit_focal") === 7);
  check("efeito de massa 10", m("efeito_massa") === 10);
  check("insuficiência hepática 6", m("insuf_hepatica") === 6);
  check("abdome agudo 3", m("abdome_agudo") === 3);
  check("pancreatite grave 9", m("pancreatite") === 9);
  check("outro 0", m("outro") === 0);
  check("programada 0 / sem cirurgia 5 / emergência 6",
    ptsId(STATUS_CIRURGICO, "scheduled_surgery") === 0 && ptsId(STATUS_CIRURGICO, "no_surgery") === 5 && ptsId(STATUS_CIRURGICO, "emergency_surgery") === 6);
  check("sítio: transplante -11, trauma -8, RM -6, neuro AVC 5, outros 0",
    ptsId(SITIO_CIRURGICO, "transplant") === -11 && ptsId(SITIO_CIRURGICO, "trauma") === -8 &&
    ptsId(SITIO_CIRURGICO, "cardiac") === -6 && ptsId(SITIO_CIRURGICO, "neurosurgery") === 5 && ptsId(SITIO_CIRURGICO, "other") === 0);
  check("infecção: nenhuma 0, outra 0, nosocomial 4, respiratória 5",
    ptsId(INFECCAO, "none") === 0 && ptsId(INFECCAO, "other") === 0 && ptsId(INFECCAO, "nosocomial") === 4 && ptsId(INFECCAO, "respiratory") === 5);
  check("motivo gravado (rótulo) volta à opção", motivoDoBanco("cardiovascular", "Choque séptico") === "choque_septico");
  check("motivo legado respiratório -> outro", motivoDoBanco("respiratory", null) === "outro");
  check("motivo legado cardiovascular sem detalhe -> sem resposta", motivoDoBanco("cardiovascular", null) === "");
}

console.log("\n=== Box III — limites de faixa ===");
{
  for (const [v, e] of [[15, 0], [13, 0], [12, 2], [7, 2], [6, 7], [5, 10], [4, 15], [3, 15]] as const) faixa(GLASGOW, v, e, "Glasgow");
  for (const [v, e] of [[60, 0], [119, 0], [120, 5], [159, 5], [160, 7]] as const) faixa(FC, v, e, "FC");
  for (const [v, e] of [[39, 11], [40, 8], [69, 8], [70, 3], [119, 3], [120, 0], [180, 0]] as const) faixa(PAS, v, e, "PAS");
  for (const [v, e] of [[34.9, 7], [35, 0], [38.5, 0]] as const) faixa(TEMPERATURA, v, e, "Temp");
  for (const [v, e] of [[1.9, 0], [2, 4], [5.9, 4], [6, 5]] as const) faixa(BILIRRUBINA, v, e, "Bili");
  for (const [v, e] of [[1.19, 0], [1.2, 2], [1.99, 2], [2, 7], [3.49, 7], [3.5, 8]] as const) faixa(CREATININA, v, e, "Creat");
  for (const [v, e] of [[14.999, 0], [15, 2], [30, 2]] as const) faixa(LEUCOCITOS, v, e, "Leuco (mil)");
  for (const [v, e] of [[150, 0], [100, 0], [99.999, 5], [50, 5], [49.999, 8], [20, 8], [19.999, 13]] as const) faixa(PLAQUETAS, v, e, "Plaq (mil)");
  for (const [v, e] of [[7.26, 0], [7.25, 3], [7.1, 3]] as const) faixa(PH, v, e, "pH");
  for (const [v, e] of [[99, 11], [100, 7], [300, 7]] as const) faixa(OXIGENACAO, v, e, "P/F com VM");
  check("sem VM PaO2 >= 60 -> 0, < 60 -> 5", ptsId(OXIGENACAO, "sem_vm_ge60") === 0 && ptsId(OXIGENACAO, "sem_vm_lt60") === 5);
}

console.log("\n=== Valores implausíveis não viram faixa ===");
{
  check("pH 72 (vírgula esquecida) -> sem faixa", PH.faixaDoValor!(72) === null);
  check("temperatura 365 -> sem faixa", TEMPERATURA.faixaDoValor!(365) === null);
  check("Glasgow 16 -> sem faixa", GLASGOW.faixaDoValor!(16) === null);
  check("lerNumero aceita vírgula", lerNumero("7,25") === 7.25);
  check("lerNumero vazio -> null", lerNumero("") === null);
  check("valor digitado manda sobre a faixa tocada", faixaEfetiva(PAS, 80, "ge120") === "70_119");
  check("sem valor, vale a faixa tocada", faixaEfetiva(PAS, null, "40_69") === "40_69");
}

console.log("\n=== Pacientes completos ===");
{
  const vazio: RespostasSaps3 = {
    idade: null, dias: null, local: null, comorbidades: [], vasoativo: null, planejada: null, motivo: null,
    statusCirurgico: null, sitioCirurgico: null, infeccao: null, glasgow: null, fc: null, pas: null,
    temperatura: null, bilirrubina: null, creatinina: null, leucocitos: null, plaquetas: null, ph: null, oxigenacao: null,
  };
  // Choque séptico clínico: 72 anos (13), 3 dias (0), enfermaria (8), cirrose (8), vasoativo (3)
  // = 16 + 32 = 48 · não planejada (3), choque séptico (5), sem cirurgia (5), nosocomial (4) = 17
  // · GCS 10 (2), FC 130 (5), PAS 65 (8), T 36 (0), bili 3 (4), creat 2,4 (7), leuco 18 mil (2),
  //   plaq 45 mil (8), pH 7,20 (3), VM P/F 150 (7) = 46 → total 111.
  const a = calcularSaps3({
    ...vazio, idade: "70_74", dias: "lt14", local: "same_hospital_floor", comorbidades: ["cirrhosis"], vasoativo: "sim",
    planejada: "nao", motivo: "choque_septico", statusCirurgico: "no_surgery", infeccao: "nosocomial",
    glasgow: "7_12", fc: "120_159", pas: "40_69", temperatura: "ge35", bilirrubina: "2_5.9", creatinina: "2_3.4",
    leucocitos: "ge15", plaquetas: "20_49", ph: "le7.25", oxigenacao: "vm_ge100",
  });
  check("caso A: box1 48", a.box1 === 48, `obtido ${a.box1}`);
  check("caso A: box2 17", a.box2 === 17, `obtido ${a.box2}`);
  check("caso A: box3 46", a.box3 === 46, `obtido ${a.box3}`);
  check("caso A: total 111", a.total === 111, `obtido ${a.total}`);
  check("caso A: mortalidade = equação geral", a.mortality === predictMortality(111));

  // Pós-operatório eletivo de revascularização: 55 anos (5), CC (0) = 21 · planejada (0),
  // outro (0), programada (0), RM (-6), sem infecção (0) = -6 · fisiologia normal = 0 → 15.
  const b = calcularSaps3({
    ...vazio, idade: "40_59", dias: "lt14", local: "operating_room", vasoativo: "nao",
    planejada: "sim", motivo: "outro", statusCirurgico: "scheduled_surgery", sitioCirurgico: "cardiac", infeccao: "none",
    glasgow: "ge13", fc: "lt120", pas: "ge120", temperatura: "ge35", bilirrubina: "lt2", creatinina: "lt1.2",
    leucocitos: "lt15", plaquetas: "ge100", ph: "gt7.25", oxigenacao: "sem_vm_ge60",
  });
  check("caso B: sítio negativo conta com cirurgia (total 15)", b.total === 15, `obtido ${b.total}`);
  const c = calcularSaps3({ ...vazio, statusCirurgico: "no_surgery", sitioCirurgico: "transplant" });
  check("sítio ignorado sem cirurgia", c.box2 === 5, `obtido ${c.box2}`);
  // Conferido à mão: logit = -32,6659 + ln(131,5958) x 7,3068 = 2,9889 -> 95,2%.
  check("mortalidade 111 = 95,2%", predictMortality(111) === 95.2, `obtido ${predictMortality(111)}`);
}

console.log("\n=== Leucócitos e plaquetas: unidades ===");
{
  check("15.000 -> 15 mil", contagemParaMil("15.000") === 15);
  check("12500 -> 12.5 mil", contagemParaMil("12500") === 12.5);
  check("somenteDigitos", somenteDigitos("150.000 ") === "150000");
  check("plaquetas 19.999 gravadas 19 (continua < 20)", plaquetasParaBanco("19999") === 19);
  check("plaquetas 99.900 gravadas 99", plaquetasParaBanco("99900") === 99);
  check("banco 12.5 -> 12500", milParaContagem(12.5) === "12500");
  check("banco null -> vazio", milParaContagem(null) === "");
  check("exibe 150.000", formatarContagem("150000") === "150.000");
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
console.log("Todos os casos passaram.\n");
