/**
 * Integridade dos contratos assistente → item de prescrição.
 *
 * O PADRÃO DE FALHA que este teste existe para impedir:
 * o Arsen tem fluxos (Assistente de Terapia Nutricional, Guia ATM) que montam
 * uma configuração clínica e a entregam ao PrescricaoPage, que a copia para o
 * item. Cada ponta declara sua própria lista de campos, À MÃO. Quando um
 * assistente ganha um campo novo e a cópia do meio não acompanha, o dado
 * desaparece SEM ERRO: o médico configura, salva, e o item nasce sem aquilo.
 * Não quebra build, não quebra tipo, não aparece no console.
 *
 * Ocorrências reais encontradas em 16/09/2026:
 *  - dietProfile (perfil da dieta oral, sistema da enteral) e nutAccess (via
 *    enteral, acesso parenteral central x periférico): emitidos pelo assistente
 *    e lidos pelo corpo do item, mas ausentes da lista de cópia;
 *  - atbJustification, atbCultureCollected e atbCultureResult: preenchidos na
 *    Guia ATM, exigidos pela CCIH, consumidos pelo AtmStatusDialog — e perdidos
 *    em DOIS pontos da cadeia (a cópia para o item e o repasse ao diálogo).
 *
 * Convenção do projeto: import RELATIVO com extensão .ts, porque os testes
 * rodam por `npx tsx <arquivo>`, fora da resolução do Vite.
 */

import { readFileSync } from "node:fs";

let falhas = 0;
let total = 0;

function check(descricao: string, condicao: boolean, detalhe = "") {
  total++;
  if (condicao) {
    console.log(`  ok   ${descricao}`);
  } else {
    falhas++;
    console.error(`  FALHA ${descricao}${detalhe ? `\n         ${detalhe}` : ""}`);
  }
}

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf-8");

const wizard = ler("../components/NutritionWizard.tsx");
const prescricao = ler("../pages/PrescricaoPage.tsx");
const corpo = ler("../lib/nutritionHydration.ts");
const guiaAtb = ler("../components/AntimicrobialGuideDialog.tsx");
const atmDialog = ler("../components/AtmStatusDialog.tsx");

/** Campos declarados em um bloco `interface X { ... }`. */
function camposDaInterface(fonte: string, nome: string): string[] {
  const m = fonte.match(new RegExp(`interface ${nome}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m) return [];
  return [...m[1].matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\??\s*:/gm)].map(x => x[1]);
}

console.log("\nContratos assistente → item de prescrição\n");

// ── Nutrição ───────────────────────────────────────────────────────────────
console.log("Assistente de Terapia Nutricional");

const declarados = camposDaInterface(wizard, "NutritionStructured");
const emRuntime = (() => {
  const m = wizard.match(/NUTRITION_STRUCTURED_KEYS\s*=\s*\[([\s\S]*?)\]/);
  return m ? [...m[1].matchAll(/"([a-zA-Z0-9]+)"/g)].map(x => x[1]) : [];
})();

check("a interface NutritionStructured tem campos", declarados.length > 0);
check("a lista em runtime tem campos", emRuntime.length > 0);

const faltamNaLista = declarados.filter(c => !emRuntime.includes(c));
check(
  "todo campo da interface está na lista de runtime",
  faltamNaLista.length === 0,
  faltamNaLista.length ? `ausentes: ${faltamNaLista.join(", ")}` : "",
);

const sobramNaLista = emRuntime.filter(c => !declarados.includes(c));
check(
  "a lista não tem campo que a interface desconhece",
  sobramNaLista.length === 0,
  sobramNaLista.length ? `sobrando: ${sobramNaLista.join(", ")}` : "",
);

// O que o assistente REALMENTE emite nas entries, e não apenas declara.
const emitidos = [...wizard.matchAll(/^\s{6,}(nut[A-Z][a-zA-Z]*|diet[A-Z][a-zA-Z]*|infusionRate)\s*:/gm)]
  .map(m => m[1]);
const emitidosNaoCopiados = [...new Set(emitidos)].filter(c => !emRuntime.includes(c));
check(
  "todo campo emitido nas entries é copiado para o item",
  emitidosNaoCopiados.length === 0,
  emitidosNaoCopiados.length
    ? `emitidos e perdidos: ${emitidosNaoCopiados.join(", ")}`
    : "",
);

check(
  "PrescricaoPage usa a lista do assistente, não uma cópia própria",
  prescricao.includes("NUTRITION_STRUCTURED_KEYS") && !prescricao.includes("NUT_STRUCT_KEYS"),
  "uma cópia manual volta a sair de sincronia — importe a lista do assistente",
);

// Campos que o corpo do item consome e o assistente emite precisam chegar lá.
const consumidosPeloCorpo = [...new Set(
  [...corpo.matchAll(/\bf\.([a-zA-Z][a-zA-Z0-9]*)/g)].map(m => m[1]),
)];
const emitidosSemChegar = emRuntime.filter(
  c => consumidosPeloCorpo.includes(c) && !prescricao.includes("NUTRITION_STRUCTURED_KEYS"),
);
check(
  "campos lidos pelo corpo do item têm caminho até o item",
  emitidosSemChegar.length === 0,
);

// ── Guia ATM ───────────────────────────────────────────────────────────────
console.log("\nGuia ATM");

const CAMPOS_CCIH = [
  ["justification", "atbJustification"],
  ["cultureCollected", "atbCultureCollected"],
  ["cultureResult", "atbCultureResult"],
] as const;

for (const [naGuia, noItem] of CAMPOS_CCIH) {
  check(`a guia emite "${naGuia}"`, guiaAtb.includes(`${naGuia}?:`));
  check(
    `o item recebe "${noItem}" a partir da guia`,
    new RegExp(`base\\.${noItem}\\s*=\\s*entry\\.${naGuia}`).test(prescricao),
    "o médico preenche na guia e o dado se perde no caminho",
  );
  check(
    `"${noItem}" é repassado ao AtmStatusDialog`,
    new RegExp(`${noItem}:\\s*i\\.${noItem}`).test(prescricao),
    "o diálogo declara o campo mas recebe vazio",
  );
  check(`AtmStatusDialog declara "${noItem}"`, atmDialog.includes(`${noItem}?:`));
}

// ── Orientação x recomendações ────────────────────────────────────────────
console.log("\nOrientação do assistente x recomendações do médico");

const impresso = ler("../lib/printExtraPrescription.ts");

// A separação acontece NA ORIGEM: cada entry já nasce com guidance (do
// sistema) e instructions (do médico) em campos distintos. Uma versão anterior
// remapeava os dois no handleConfirm, o que sobrescrevia a nota do médico.
check(
  "cada entrada emite a orientação em campo próprio",
  /guidance:\s*(buildGuidance|\[|")/.test(wizard),
  "se a orientação voltar para `instructions`, ela é apagada na conversão",
);
check(
  "o assistente não ocupa o campo do médico",
  /instructions:\s*doctorNote\(/.test(wizard),
  "instructions pertence ao médico e só recebe o que ele digitou",
);
check("o item copia a orientação", /baseItem\.guidance\s*=/.test(prescricao));
check("o editor exibe a orientação", prescricao.includes("Orientação do assistente"));
check("o impresso declara o campo", /guidance\?:\s*string/.test(impresso));
check("o impresso renderiza a orientação", /it\.guidance\s*\?/.test(impresso));
check(
  "a orientação é repassada ao impresso",
  /guidance:\s*i\.guidance/.test(prescricao),
  "declarar no impresso sem repassar é o elo que rompia nos outros casos",
);

// ── Plano persistido ──────────────────────────────────────────────────────
console.log("\nPlano persistido no item");

check("o item declara o plano", /nutritionPlan\?:\s*NutritionPlan/.test(prescricao));
check("o item copia o plano do assistente", /baseItem\.nutritionPlan\s*=/.test(prescricao));
check(
  "o assistente reabre a partir do plano salvo",
  /initialPlan=\{/.test(prescricao) && /initialPlan\)\s*applyPlan/.test(wizard),
  "sem reabrir preenchido, o assistente volta a ser gerador de uso único",
);

// ── Vocabulário de vias enterais ──────────────────────────────────────────
console.log("\nVias enterais");

const rotas = ler("../lib/enteralRoutes.ts");
const canonicos = [...rotas.matchAll(/value:\s*"([A-Z]+)"/g)].map(m => m[1]);

check("existe um vocabulário canônico de vias", canonicos.length >= 5);

check(
  "o editor usa a lista compartilhada, não uma própria",
  prescricao.includes("ENTERAL_ROUTE_VALUES")
    && !/ENTERAL_ROUTES\s*=\s*\['Nasog/.test(prescricao),
  "listas paralelas voltam a divergir e o seletor de via abre vazio",
);

check(
  "o assistente emite a via pelo normalizador",
  /defaultRoute:\s*normalizeEnteralRoute/.test(wizard),
  'emitir texto livre como "Enteral (SNE/SNG)" deixa o seletor vazio',
);

check(
  "o editor normaliza a via ao ler o item",
  /value=\{normalizeEnteralRoute\(item\.route\)\}/.test(prescricao),
  "sem normalizar, prescrições antigas perdem a via na tela",
);

// Rótulos legados precisam continuar sendo reconhecidos: um item salvo antes
// da unificação não pode aparecer sem via.
for (const legado of ["Nasogástrica (NGT)", "Nasoenteral (NET)", "Enteral (SNE/SNG)"]) {
  const chave = legado.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  check(
    `rótulo legado "${legado}" continua reconhecido`,
    rotas.includes(`"${chave}"`) || rotas.includes(chave),
  );
}

// ── Orientação x recomendação ─────────────────────────────────────────────
console.log("\nOrientação do sistema x nota do médico");

check(
  "o assistente separa guidance de instructions na origem",
  wizard.includes("buildGuidance") && wizard.includes("doctorNote"),
  "misturar os dois num campo só foi o que levou a apagar o texto do assistente",
);

check(
  "o assistente não remapeia instructions para guidance ao confirmar",
  !/guidance:\s*e\.instructions/.test(wizard),
  "esse remapeamento sobrescreve a nota do médico com a orientação do sistema",
);

check(
  "nenhuma entrada volta a usar withCustom",
  !wizard.includes("withCustom("),
  "withCustom juntava orientação e nota do médico no mesmo campo",
);

check("o item declara guidance", /^\s+guidance\?: string;/m.test(prescricao));
check(
  "createItem copia guidance do assistente",
  /baseItem\.guidance = orientacao/.test(prescricao),
);
// A orientação deixou de ser um bloco fixo de leitura e virou um botão
// opcional ao lado do rótulo: o médico decide se aplica. Ela NUNCA é escrita
// em instructions sem ação dele — esse campo é do médico.
check(
  "a orientação é oferecida como ação opcional",
  /aplicarOrientacao/.test(prescricao) && /Aplicar orientação do assistente/.test(prescricao),
  "um bloco fixo de leitura punha dois textos concorrendo pelo mesmo espaço",
);
check(
  "aplicar a orientação acrescenta, não substitui",
  /atual \? `\$\{atual\} · \$\{item\.guidance\}` : item\.guidance/.test(prescricao),
  "sobrescrever apagaria o que o médico já tinha escrito",
);

check(
  "o impresso renderiza guidance",
  /it\.guidance/.test(impresso),
  "sem isso a orientação existe na tela e some no papel",
);
check(
  "o impresso mantém as Recomendações do médico",
  /Recomendações:.*it\.instructions|it\.instructions.*Recomendações/s.test(impresso),
);

// O item NÃO pode continuar zerando instructions para nutrição: esse era o
// sintoma original, e o motivo (disputa de campo) deixou de existir.
check(
  "guidance e instructions são campos distintos no item",
  /guidance\?: string;/.test(prescricao) && /instructions\??: string/.test(prescricao),
);

console.log(`\n${total - falhas}/${total} verificações passaram\n`);
if (falhas > 0) process.exit(1);
