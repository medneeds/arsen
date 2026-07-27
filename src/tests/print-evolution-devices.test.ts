/**
 * TESTE: dispositivos invasivos no IMPRESSO de evolução
 *
 * Achado de 27/07/2026: a seção de dispositivos invasivos existia só na TELA.
 * Varredura nos oito arquivos de impressão: zero ocorrências em printEvolution,
 * printRound, printExtraPrescription e demais. A única menção estava em
 * printAdmission, e é outra coisa (o campo texto patients.uti_devices).
 *
 * Consequência clínica: quem lê o prontuário impresso não sabia que o paciente
 * está com CVC há doze dias. Os limiares D7 (âmbar) e D14 (vermelho) existem
 * justamente para disparar reavaliação de risco de IRAS (CLABSI/CAUTI/VAP).
 *
 * Requisitos do gestor: COMPACTO, sem ocupar muito espaço, e a seção só
 * aparece se houver conteúdo — campo vazio não ocupa papel.
 *
 * Este teste cobre a REGRA de montagem da linha (a mesma lógica do impresso),
 * já que printEvolution depende de Supabase e window e não roda sob tsx.
 *
 * Dados fictícios | Zero impacto em produção.
 */

import { formatDeviceLabel, deviceAlertTone } from "../lib/devicesCatalog.ts";
import { calcDIH, parseAdmissionDate } from "../lib/dihCalc.ts";

let falhas = 0;
let total = 0;

function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) {
    console.log(`  OK   ${nome}`);
  } else {
    falhas++;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

/** Espelha a regra do impresso: item só existe com rótulo string utilizável. */
function montarItem(raw: unknown): string {
  const d = raw as { label?: unknown; detail?: unknown; insertedAt?: unknown };
  const rotuloBase = typeof d?.label === "string" ? d.label.trim() : "";
  if (!rotuloBase) return "";
  const subtipo = typeof d?.detail === "string" ? d.detail : undefined;
  const rotulo = formatDeviceLabel({ label: rotuloBase, detail: subtipo });
  const inserido = typeof d?.insertedAt === "string" ? d.insertedAt.trim() : "";
  const temData = !!parseAdmissionDate(inserido);
  const dias = inserido ? calcDIH(inserido) : null;
  return [rotulo, temData ? "<data>" : "", dias !== null ? `D${dias}` : ""].filter(Boolean).join(" ");
}

const montarSecao = (devs: unknown[]) => devs.map(montarItem).filter(Boolean);

console.log("\n=== Seção só aparece se houver conteúdo ===");
{
  check("array vazio -> nenhum item", montarSecao([]).length === 0);
  check("dispositivo sem rótulo -> descartado", montarSecao([{ label: "", insertedAt: "10/07/2026" }]).length === 0);
  check("dispositivo só com espaços -> descartado", montarSecao([{ label: "   " }]).length === 0);
  check("undefined -> descartado", montarSecao([{ insertedAt: "10/07/2026" }]).length === 0);
}

console.log("\n=== Só sai o que está preenchido ===");
{
  const soRotulo = montarItem({ label: "CVC" });
  check("sem data: não sai data nem Dn", soRotulo === "CVC", soRotulo);

  const comData = montarItem({ label: "CVC", insertedAt: "10/07/2026" });
  check("com data: sai data e Dn", comData.includes("<data>") && /D\d+/.test(comData), comData);

  const dataInvalida = montarItem({ label: "CVC", insertedAt: "não é data" });
  check("data inválida: não inventa data", !dataInvalida.includes("<data>"), dataInvalida);
}

console.log("\n=== Subtipo entra no rótulo (mesma fonte da tela) ===");
{
  const comSub = montarItem({ label: "Dreno", detail: "Torácico (selo d'água)", insertedAt: "14/07/2026" });
  check("dreno com subtipo", comSub.startsWith("Dreno — Torácico (selo d'água)"), comSub);

  const semSub = montarItem({ label: "Dreno", insertedAt: "14/07/2026" });
  check("dreno sem subtipo não ganha travessão solto", semSub.startsWith("Dreno ") && !semSub.includes("—"), semSub);
}

console.log("\n=== DEFESA: registro corrompido pela regressão do onClick ===");
console.log("     (entre 1d9a8b20 e ab9f580a, label podia ser objeto de evento)");
{
  const corrompido = { label: { nativeEvent: {}, type: "click" }, insertedAt: "10/07/2026", custom: true };
  check(
    "label objeto -> item descartado (não imprime [object Object])",
    montarItem(corrompido) === "",
    montarItem(corrompido),
  );
  check("label numérico -> descartado", montarItem({ label: 42 }) === "");
  check("label null -> descartado", montarItem({ label: null }) === "");

  // O item bom no meio de corrompidos precisa sobreviver.
  const mistura = montarSecao([
    { label: { type: "click" }, insertedAt: "10/07/2026" },
    { label: "Dreno", detail: "Penrose (laminar)", insertedAt: "14/07/2026" },
  ]);
  check("dispositivo válido sobrevive ao lado de corrompido", mistura.length === 1, JSON.stringify(mistura));
}

console.log("\n=== Tons de alerta IRAS preservados ===");
{
  const hoje = new Date();
  const diasAtras = (n: number) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };
  check("D3 -> ok (verde)", deviceAlertTone(calcDIH(diasAtras(3))) === "ok");
  check("D8 -> amber (≥7)", deviceAlertTone(calcDIH(diasAtras(8))) === "amber");
  check("D15 -> red (≥14)", deviceAlertTone(calcDIH(diasAtras(15))) === "red");
  check("sem data -> ok (não alarma à toa)", deviceAlertTone(null) === "ok");
}

console.log("\n=== Vários dispositivos numa linha só (compacto) ===");
{
  const itens = montarSecao([
    { label: "CVC", insertedAt: "10/07/2026" },
    { label: "Dreno", detail: "Torácico (selo d'água)", insertedAt: "14/07/2026" },
    { label: "Dreno", detail: "Penrose (laminar)", insertedAt: "16/07/2026" },
    { label: "SVD" },
  ]);
  check("4 dispositivos viram 4 itens", itens.length === 4, `${itens.length}`);
  check("os dois drenos aparecem com subtipos distintos", itens[1] !== itens[2], itens.join(" | "));
  check("SVD sem data aparece só com rótulo", itens[3] === "SVD", itens[3]);
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Todos os casos passaram.\n");
