/**
 * TESTE: sugestões de subtipo alcançam também os dispositivos CUSTOMIZADOS
 *
 * Reportado em 27/07/2026: as sugestões de tipo de dreno apareciam só no item
 * do catálogo. O catálogo tem UM checkbox por dispositivo, mas o paciente pode
 * ter mais de um do mesmo tipo — dois drenos é rotina. O segundo é cadastrado
 * como customizado e ficava sem campo de tipo e sem sugestão alguma, enquanto
 * o primeiro tinha os dois.
 *
 * suggestDetailForLabel casa o rótulo digitado livremente contra os itens do
 * catálogo que declaram detailOptions, por inclusão sobre texto normalizado
 * (sem acento, minúsculo).
 *
 * Dados fictícios | Zero impacto em produção.
 */

import {
  suggestDetailForLabel,
  formatDeviceLabel,
  DEVICES_CATALOG,
} from "../lib/devicesCatalog.ts";

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

console.log("\n=== Rótulos que DEVEM oferecer sugestões de dreno ===");

const devemCasar = [
  "Dreno",
  "dreno",
  "DRENO",
  "dreno 2",
  "Dreno 2",
  "dreno torácico",
  "DRENO DE TÓRAX",
  "Dreno toracico E",       // sem acento
  "  dreno  ",              // espaços nas pontas
  "segundo dreno",
];

for (const rotulo of devemCasar) {
  const sug = suggestDetailForLabel(rotulo);
  check(
    `"${rotulo}" -> encontra item dreno`,
    sug?.id === "dreno",
    `recebeu ${sug?.id ?? "undefined"}`,
  );
  check(
    `"${rotulo}" -> traz as opções`,
    (sug?.detailOptions?.length ?? 0) > 0,
  );
}

console.log("\n=== Rótulos que NÃO devem oferecer sugestões de dreno ===");

const naoDevemCasar = ["", "   ", "Cateter umbilical", "Marca-passo", "Bota de Unna", "Sonda retal"];

for (const rotulo of naoDevemCasar) {
  const sug = suggestDetailForLabel(rotulo);
  check(`"${rotulo}" -> sem sugestão de dreno`, sug?.id !== "dreno", `recebeu ${sug?.id ?? "undefined"}`);
}

console.log("\n=== Só itens com detailOptions são sugeríveis ===");
{
  // CVC hoje não declara detailOptions — não pode ser retornado.
  const sug = suggestDetailForLabel("CVC");
  check("CVC (sem detailOptions) não retorna item", sug === undefined, `recebeu ${sug?.id ?? "undefined"}`);

  const comOpcoes = DEVICES_CATALOG.filter((c) => c.detailOptions?.length);
  check("catálogo tem ao menos 1 item com subtipos", comOpcoes.length >= 1);
  check(
    "todo item com detailOptions também define detailLabel",
    comOpcoes.every((c) => !!c.detailLabel),
  );
}

console.log("\n=== Dreno não exibe mais hint no rótulo ===");
{
  const dreno = DEVICES_CATALOG.find((c) => c.id === "dreno");
  check("item dreno existe", !!dreno);
  check("dreno sem hint (evita parecer valor preenchido)", !dreno?.hint, `hint=${dreno?.hint}`);
  check("dreno mantém detailLabel", dreno?.detailLabel === "Tipo de dreno");
}

console.log("\n=== formatDeviceLabel com e sem subtipo ===");
{
  check(
    "com subtipo",
    formatDeviceLabel({ label: "Dreno", detail: "Torácico (selo d'água)" }) ===
      "Dreno — Torácico (selo d'água)",
  );
  check("sem subtipo", formatDeviceLabel({ label: "Dreno" }) === "Dreno");
  check("subtipo vazio não vira travessão solto", formatDeviceLabel({ label: "Dreno", detail: "   " }) === "Dreno");
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Todos os casos passaram.\n");
