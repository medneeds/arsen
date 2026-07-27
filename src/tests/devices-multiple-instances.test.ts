/**
 * TESTE: dispositivos de unidade múltipla (dreno) — modelo de instâncias
 *
 * Reestruturado em 27/07/2026. Antes o item de catálogo era ao mesmo tempo o
 * interruptor E o primeiro registro (carregava data e tipo na própria linha),
 * e o segundo dreno virava "dispositivo customizado" — outra natureza, outros
 * campos, sem as sugestões. Dois drenos do mesmo paciente apareciam como duas
 * entidades diferentes.
 *
 * Agora: o checkbox é só interruptor; cada dreno é uma INSTÂNCIA com id
 * próprio e `catalogId: "dreno"`, todas no mesmo formato.
 *
 * O ponto mais sensível é a RETROCOMPATIBILIDADE: evoluções salvas no formato
 * antigo têm `id: "dreno"` e nenhum `catalogId`. Elas precisam continuar sendo
 * reconhecidas como instâncias, senão sumiriam da tela — perda de dado
 * clínico já registrado.
 *
 * Dados fictícios | Zero impacto em produção.
 */

import {
  DEVICES_CATALOG,
  DETAIL_OTHER_LABEL,
  deviceCatalogId,
  makeDeviceInstanceId,
  formatDeviceLabel,
  type EvolutionDevice,
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

console.log("\n=== Catálogo: dreno é múltiplo, os demais não ===");
{
  const dreno = DEVICES_CATALOG.find((c) => c.id === "dreno");
  check("dreno existe", !!dreno);
  check("dreno é multiple", dreno?.multiple === true);
  check("dreno tem detailLabel", dreno?.detailLabel === "Tipo de dreno");
  check("dreno tem 11 tipos", (dreno?.detailOptions?.length ?? 0) === 11);
  check("dreno sem hint", !dreno?.hint);

  const outros = DEVICES_CATALOG.filter((c) => c.id !== "dreno");
  check(
    "nenhum outro dispositivo virou múltiplo (escopo mantido em dreno)",
    outros.every((c) => !c.multiple),
    outros.filter((c) => c.multiple).map((c) => c.id).join(","),
  );
}

console.log("\n=== RETROCOMPATIBILIDADE: registro antigo continua reconhecido ===");
{
  // Formato salvo antes da reestruturação: id = id do catálogo, sem catalogId.
  const legado: EvolutionDevice = { id: "dreno", label: "Dreno", insertedAt: "10/07/2026" };
  check("legado resolve para o catálogo dreno", deviceCatalogId(legado) === "dreno");

  const legadoComTipo: EvolutionDevice = {
    id: "dreno",
    label: "Dreno",
    insertedAt: "10/07/2026",
    detail: "Torácico (selo d'água)",
  };
  check("legado com subtipo preserva o subtipo", legadoComTipo.detail === "Torácico (selo d'água)");
  check(
    "legado com subtipo ainda exibe corretamente",
    formatDeviceLabel(legadoComTipo) === "Dreno — Torácico (selo d'água)",
  );

  // Outros dispositivos de unidade única seguem resolvendo pelo id.
  check("CVC legado resolve", deviceCatalogId({ id: "cvc", label: "CVC", insertedAt: "" }) === "cvc");
}

console.log("\n=== Instâncias novas ===");
{
  const id1 = makeDeviceInstanceId("dreno");
  const id2 = makeDeviceInstanceId("dreno");
  check("id de instância começa com o catalogId", id1.startsWith("dreno-"));
  check("ids de instância são distintos", id1 !== id2, `${id1} vs ${id2}`);

  const inst: EvolutionDevice = { id: id1, catalogId: "dreno", label: "Dreno", insertedAt: "" };
  check("instância resolve pelo catalogId", deviceCatalogId(inst) === "dreno");
}

console.log("\n=== Customizado não é confundido com instância ===");
{
  const custom: EvolutionDevice = { id: "custom-abc", label: "Cateter umbilical", insertedAt: "", custom: true };
  check("customizado não resolve para catálogo", deviceCatalogId(custom) === undefined);

  // Nome que casaria por texto, mas é customizado — não pode virar dreno.
  const customChamadoDreno: EvolutionDevice = { id: "custom-xyz", label: "Dreno", insertedAt: "", custom: true };
  check(
    "customizado rotulado 'Dreno' segue customizado",
    deviceCatalogId(customChamadoDreno) === undefined,
  );
}

console.log("\n=== Convivência de várias unidades ===");
{
  const devices: EvolutionDevice[] = [
    { id: "cvc", label: "CVC", insertedAt: "12/07/2026" },
    { id: "dreno", label: "Dreno", insertedAt: "10/07/2026", detail: "Torácico (selo d'água)" }, // legado
    { id: makeDeviceInstanceId("dreno"), catalogId: "dreno", label: "Dreno", insertedAt: "14/07/2026", detail: "Penrose (laminar)" },
    { id: makeDeviceInstanceId("dreno"), catalogId: "dreno", label: "Dreno", insertedAt: "", detail: "Dreno de Blake" }, // texto livre
    { id: "custom-1", label: "Cateter umbilical", insertedAt: "", custom: true },
  ];

  const drenos = devices.filter((d) => deviceCatalogId(d) === "dreno");
  check("encontra os 3 drenos (1 legado + 2 novos)", drenos.length === 3, `achou ${drenos.length}`);
  check("CVC não entra na lista de drenos", !drenos.some((d) => d.label === "CVC"));
  check("customizado não entra na lista de drenos", !drenos.some((d) => d.id === "custom-1"));

  const cvcs = devices.filter((d) => deviceCatalogId(d) === "cvc");
  check("CVC segue resolvendo sozinho", cvcs.length === 1);

  // Cada dreno mantém seu próprio subtipo — o ponto do pedido.
  const tipos = drenos.map((d) => d.detail);
  check(
    "cada dreno tem subtipo independente",
    new Set(tipos).size === 3,
    tipos.join(" | "),
  );
}

console.log("\n=== Texto livre: subtipo fora da lista é preservado ===");
{
  const dreno = DEVICES_CATALOG.find((c) => c.id === "dreno");
  const opcoes = dreno?.detailOptions ?? [];
  check("'Dreno de Blake' não está nas opções (logo, é texto livre)", !opcoes.includes("Dreno de Blake"));
  check("sentinela 'Outro' não polui a lista de tipos", !opcoes.includes(DETAIL_OTHER_LABEL));
  check(
    "texto livre exibe normalmente",
    formatDeviceLabel({ label: "Dreno", detail: "Dreno de Blake" }) === "Dreno — Dreno de Blake",
  );
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Todos os casos passaram.\n");
