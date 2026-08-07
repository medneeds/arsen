/**
 * TESTE: Cabeçalho impresso (prescrição/evolução) — sexo correto + sem
 * corrida entre carregamento assíncrono e impressão
 *
 * Reportado em 07/08/2026: campos do cabeçalho (nascimento, sexo, peso,
 * idade) às vezes em branco na folha impressa; um caso grave de paciente
 * masculino impresso como feminino, não reproduzível sob demanda.
 *
 * DOIS BUGS DISTINTOS, mesma raiz arquitetural (múltiplas buscas
 * assíncronas independentes hidratando o mesmo cabeçalho, sem nenhum
 * sinal consolidado de "terminou"):
 *
 *  1. `patient.sex.toLowerCase().startsWith('m') ? 'M' : 'F'` — qualquer
 *     valor que não começasse por 'm' (cadastro com sexo "Outro", opção
 *     real e selecionável em PatientRegistrationDialog.tsx; ou dado legado
 *     malformado) virava Feminino por padrão, silenciosamente.
 *
 *  2. Nenhum gate impedia `window.print()` de disparar antes de todas as
 *     buscas assíncronas que hidratam o cabeçalho terminarem — se o clique
 *     em Imprimir viesse antes, o campo daquela busca específica saía em
 *     branco no documento.
 *
 * Este teste replica as duas correções (PrescricaoPage.tsx / EvolucaoPage.tsx):
 *  - formatSexCode / formatSexLabel: checagem explícita, nunca assume F.
 *  - isPatientHeaderReady: só true quando TODOS os sinais de carregamento
 *    já concluíram — sem depender de "o campo está vazio?", que confunde
 *    dado legitimamente ausente (paciente NI) com dado ainda não carregado.
 *
 * Dados fictícios | Zero impacto em produção.
 */

// ── Réplica exata da correção em PrescricaoPage.tsx ────────────────────

function formatSexCode(sex?: string | null): string {
  if (!sex) return "—";
  const v = sex.trim().toUpperCase();
  if (v === "M" || v === "MASCULINO") return "M";
  if (v === "F" || v === "FEMININO") return "F";
  return sex.trim();
}

// ── Réplica exata da correção em EvolucaoPage.tsx ───────────────────────

function formatSexLabel(sex?: string | null): string {
  if (!sex) return "—";
  const v = sex.trim().toUpperCase();
  if (v === "M" || v === "MASCULINO") return "Masculino";
  if (v === "F" || v === "FEMININO") return "Feminino";
  return sex.trim();
}

// ── Réplica do gate de prontidão (isPatientHeaderReady) ─────────────────

interface HeaderLoadingSignals {
  identifiersLoading: boolean;
  fallbackDataReady: boolean;
  weightHydrated: boolean;
  hasPatientSelected: boolean;
}

function isPatientHeaderReady(s: HeaderLoadingSignals): boolean {
  return (
    !s.identifiersLoading &&
    s.fallbackDataReady &&
    (s.weightHydrated || !s.hasPatientSelected)
  );
}

// ── Runner mínimo (mesmo estilo dos demais testes do projeto) ──────────

let total = 0;
let falhas = 0;
function check(label: string, cond: boolean, detail?: string) {
  total++;
  if (cond) {
    console.log(`  OK  ${label}`);
  } else {
    falhas++;
    console.error(`FALHA  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("=== Sexo: PrescricaoPage (formatSexCode) ===");
{
  check("'M' -> 'M'", formatSexCode("M") === "M");
  check("'F' -> 'F'", formatSexCode("F") === "F");
  check("'Masculino' -> 'M'", formatSexCode("Masculino") === "M");
  check("'Feminino' -> 'F'", formatSexCode("Feminino") === "F");
  check("'m' minúsculo -> 'M'", formatSexCode("m") === "M");
  check("' M' com espaço -> 'M' (não cai em F por engano)", formatSexCode(" M") === "M");
  check(
    "'Outro' NÃO vira 'F' (era o bug: startsWith('m') falhava e assumia F)",
    formatSexCode("Outro") !== "F",
  );
  check("'Outro' preserva o valor real", formatSexCode("Outro") === "Outro");
  check("vazio/null -> '—' (não assume nada)", formatSexCode(null) === "—" && formatSexCode("") === "—");
  check(
    "valor legado malformado (ex: 'Nao informado') não vira 'F' por padrão",
    formatSexCode("Nao informado") !== "F",
  );
}

console.log("\n=== Sexo: EvolucaoPage (formatSexLabel) ===");
{
  check("'M' -> 'Masculino'", formatSexLabel("M") === "Masculino");
  check("'F' -> 'Feminino'", formatSexLabel("F") === "Feminino");
  check(
    "'Outro' NÃO vira 'Feminino' (mesmo bug replicado nesta tela)",
    formatSexLabel("Outro") !== "Feminino",
  );
  check("vazio -> '—'", formatSexLabel(undefined) === "—");
}

console.log("\n=== Gate de impressão: isPatientHeaderReady ===");
{
  check(
    "tudo carregado -> pronto para imprimir",
    isPatientHeaderReady({
      identifiersLoading: false,
      fallbackDataReady: true,
      weightHydrated: true,
      hasPatientSelected: true,
    }) === true,
  );
  check(
    "identifiers (registry/sexo/nascimento) ainda carregando -> NÃO pronto",
    isPatientHeaderReady({
      identifiersLoading: true,
      fallbackDataReady: true,
      weightHydrated: true,
      hasPatientSelected: true,
    }) === false,
  );
  check(
    "fallback (idade/admissão/alergias) ainda carregando -> NÃO pronto",
    isPatientHeaderReady({
      identifiersLoading: false,
      fallbackDataReady: false,
      weightHydrated: true,
      hasPatientSelected: true,
    }) === false,
  );
  check(
    "peso ainda não hidratado, COM paciente selecionado -> NÃO pronto",
    isPatientHeaderReady({
      identifiersLoading: false,
      fallbackDataReady: true,
      weightHydrated: false,
      hasPatientSelected: true,
    }) === false,
  );
  check(
    "sem paciente selecionado -> pronto mesmo com weightHydrated=false (nada a esperar)",
    isPatientHeaderReady({
      identifiersLoading: false,
      fallbackDataReady: true,
      weightHydrated: false,
      hasPatientSelected: false,
    }) === true,
  );
  check(
    "TODOS ainda carregando -> NÃO pronto",
    isPatientHeaderReady({
      identifiersLoading: true,
      fallbackDataReady: false,
      weightHydrated: false,
      hasPatientSelected: true,
    }) === false,
  );
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Todos os casos passaram.\n");
