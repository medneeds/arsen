/**
 * FONTE ÚNICA DE COBERTURA DE SETORES
 *
 * ─── Por que este arquivo existe ────────────────────────────────────────────
 * Os códigos de setor estavam espalhados por 25 arquivos, em pelo menos cinco
 * listas paralelas (SECTOR_DISPLAY, DEPARTMENT_TO_SECTOR, SECTOR_BED_CONFIG,
 * HOSPITAL_SECTOR_GROUPS, DESTINATION_SECTORS, SECTOR_SCOPE, sectorComplexity),
 * mais um array hardcoded dentro de uma função SQL. Cada setor novo exigia
 * lembrar de sete lugares, e a divergência já produziu bugs reais — entre eles
 * um código de setor inexistente (`cc_bloco_cirurgico`) que fez o Bloco
 * Cirúrgico ser classificado como enfermaria.
 *
 * Este módulo declara cada setor UMA vez. Os demais mapas devem passar a
 * derivar daqui.
 *
 * ─── O modelo de três níveis ────────────────────────────────────────────────
 * A plataforma Arsen cobre INTERNAÇÃO hospitalar. Paciente de consultório ou de
 * primeiro atendimento não entra no fluxo — a entrada acontece no momento em
 * que a internação é decidida. Dentro disso há dois graus de cobertura, e é
 * essencial não confundi-los com "setor travado":
 *
 *   "clinical" — operação clínica completa: prescrição, evolução, requisição.
 *
 *   "tracking" — o paciente ESTÁ internado e é rastreado (censo, NIR, encontro
 *                aberto), mas a operação clínica ainda não foi implantada ali.
 *                NÃO é setor desativado. Marcá-lo como travado faria o paciente
 *                sumir do sistema e suas sinalizações serem canceladas — o
 *                oposto do desejado.
 *
 *   "out"      — fora do escopo de internação. Só estes podem ter sinalizações
 *                canceladas automaticamente pelo mecanismo de setor sem
 *                implantação ativa.
 *
 * ─── Ao acrescentar ou mudar um setor ───────────────────────────────────────
 * 1. Use o CÓDIGO real do banco, nunca um código derivado do rótulo de
 *    exibição. Confira em DEPARTMENT_TO_SECTOR e na constraint
 *    `patients_sector_check`. Foi exatamente esse erro que gerou
 *    `cc_bloco_cirurgico`.
 * 2. Rode a verificação de consistência (assertSectorCoverageIntegrity) — ela
 *    compara esta lista com SECTOR_DISPLAY e acusa código órfão ou faltante.
 * 3. Se o setor for "out", ele passa a ser candidato ao cancelamento automático
 *    de sinalizações. Ver docs/sql-cadeado-setores-dessincronizado.md.
 */
import { SECTOR_DISPLAY, DEPARTMENT_TO_SECTOR } from "@/contexts/DepartmentContext";
import { isSectorType } from "@/types/patient";

/** Grau de cobertura da plataforma sobre o setor. */
export type SectorCoverageLevel = "clinical" | "tracking" | "out";

/** Agrupamento de exibição. */
export type SectorGroup =
  | "alta_complexidade"
  | "enfermaria"
  | "urgencia_horizontal"
  | "centro_cirurgico"
  | "fora_escopo";

export interface SectorCoverage {
  /** Código interno, idêntico ao gravado em patients.sector. */
  code: string;
  level: SectorCoverageLevel;
  group: SectorGroup;
}

/**
 * Definição canônica. Decisões do gestor em 19/08/2026.
 *
 * `ue_horizontal` NÃO aparece aqui: é o guarda-chuva da urgência, não um lugar
 * onde paciente ocupa leito. Sua resolução depende de verificar se existem
 * leitos EH gravados no banco.
 */
export const SECTOR_COVERAGE: readonly SectorCoverage[] = [
  // ─── Nível 1: operação clínica ────────────────────────────────────────────
  { code: "red", level: "clinical", group: "alta_complexidade" },
  { code: "yellow", level: "clinical", group: "alta_complexidade" },
  { code: "blue", level: "clinical", group: "alta_complexidade" },
  { code: "outside", level: "clinical", group: "alta_complexidade" },
  // UCC = Unidade de Cuidados Clinicos. Agrupa como ENFERMARIA, nao alta
  // complexidade (decisao do gestor, 19/08/2026).
  { code: "ucc", level: "clinical", group: "enfermaria" },
  { code: "enfermaria_transicao", level: "clinical", group: "enfermaria" },
  { code: "sala_vermelha", level: "clinical", group: "urgencia_horizontal" },
  { code: "sala_laranja", level: "clinical", group: "urgencia_horizontal" },
  { code: "internacao_ue", level: "clinical", group: "urgencia_horizontal" },

  // ─── Nível 2: internação rastreada, sem operação clínica ──────────────────
  { code: "clinica_cirurgica", level: "tracking", group: "enfermaria" },
  { code: "enfermaria_vascular", level: "tracking", group: "enfermaria" },
  { code: "neuro_01", level: "tracking", group: "enfermaria" },
  { code: "neuro_02", level: "tracking", group: "enfermaria" },
  { code: "cc_preparo", level: "tracking", group: "centro_cirurgico" },
  { code: "cc_bloco", level: "tracking", group: "centro_cirurgico" },
  { code: "cc_rpa", level: "tracking", group: "centro_cirurgico" },

  // ─── Nível 3: fora do escopo de internação ────────────────────────────────
  { code: "ue_vertical", level: "out", group: "fora_escopo" },
  { code: "observacao_clinica", level: "out", group: "fora_escopo" },
  { code: "riv", level: "out", group: "fora_escopo" },
] as const;

/** Rótulos legíveis dos grupos. */
export const SECTOR_GROUP_LABELS: Record<SectorGroup, string> = {
  alta_complexidade: "UTI/UCI",
  enfermaria: "Enfermarias",
  urgencia_horizontal: "Urgência e Emergência (Horizontal)",
  centro_cirurgico: "Centro Cirúrgico",
  fora_escopo: "Fora do escopo de internação",
};

const BY_CODE = new Map(SECTOR_COVERAGE.map((s) => [s.code, s]));

/** Cobertura de um setor, ou undefined se o código não for conhecido. */
export function getSectorCoverage(code: string | null | undefined): SectorCoverage | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code);
}

/**
 * O setor está dentro do escopo de internação da plataforma?
 * Verdadeiro para "clinical" e "tracking".
 *
 * Código desconhecido devolve `false`: é mais seguro tratar setor não
 * declarado como fora do escopo do que assumir cobertura que não foi decidida.
 */
export function isWithinInpatientScope(code: string | null | undefined): boolean {
  const level = getSectorCoverage(code)?.level;
  return level === "clinical" || level === "tracking";
}

/** O setor tem operação clínica (prescrição, evolução, requisição)? */
export function hasClinicalOperation(code: string | null | undefined): boolean {
  return getSectorCoverage(code)?.level === "clinical";
}

/** Códigos de um nível. */
export function sectorsByLevel(level: SectorCoverageLevel): string[] {
  return SECTOR_COVERAGE.filter((s) => s.level === level).map((s) => s.code);
}

/** Códigos de um grupo. */
export function sectorsByGroup(group: SectorGroup): string[] {
  return SECTOR_COVERAGE.filter((s) => s.group === group).map((s) => s.code);
}

/**
 * Setores fora do escopo — os únicos elegíveis ao cancelamento automático de
 * sinalizações. Deve espelhar o array `v_locked_codes` da função SQL
 * cleanup_locked_sector_pending_allocations. Enquanto a função não ler daqui,
 * as duas listas precisam ser mantidas iguais à mão.
 */
export const OUT_OF_SCOPE_SECTOR_CODES: readonly string[] = sectorsByLevel("out");

/**
 * Resolve o CODIGO do setor a partir de qualquer forma em que ele apareca no
 * banco: o proprio codigo ("red"), o rotulo de exibicao ("UTI 1") ou o
 * departamento ("UTI 1", "POSTO INTERNAÇÃO").
 *
 * Existe porque `destination_sector` em pre_admissions e
 * bed_allocation_requests guarda ora codigo, ora rotulo — o front gravou das
 * duas formas ao longo do tempo. Comparar por substring ("includes('uti')")
 * acertava o rotulo e errava o codigo, em silencio.
 */
// Aliases de nomes REAIS de setor no banco (setores.nome) que divergem de
// SECTOR_DISPLAY e de DEPARTMENT_TO_SECTOR. Ex.: a UCC est\u00e1 gravada como
// "UCC \u2014 Unidade de Cuidados Cl\u00ednicos" (nome oficial/PDF, com travess\u00e3o), mas o
// r\u00f3tulo curto do app \u00e9 s\u00f3 "UCC". Sem este alias, resolveSectorCode devolvia
// undefined para a UCC \u2192 a transfer\u00eancia interna para UCC n\u00e3o sinalizava (n\u00e3o
// aparecia na fila) e os leitos da UCC ficavam sem c\u00f3digo can\u00f4nico no mapa.
// Chaves NORMALIZADAS (sem acento, min\u00fasculas, travess\u00e3o/\u2013/\u2014 \u2192 h\u00edfen).
const SECTOR_NAME_ALIASES: Record<string, string> = {
  "ucc - unidade de cuidados clinicos": "ucc",
  "unidade de cuidados clinicos": "ucc",
};

export function resolveSectorCode(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const raw = value.trim();
  if (BY_CODE.has(raw)) return raw;
  const lower = raw.toLowerCase();
  if (BY_CODE.has(lower)) return lower;

  const norm = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const alvo = norm(raw);

  // Alias por nome de banco (travess\u00e3o/en-dash normalizados para h\u00edfen).
  const alvoDash = alvo.replace(/[\u2014\u2013]/g, "-").replace(/\s+/g, " ").trim();
  if (SECTOR_NAME_ALIASES[alvoDash]) return SECTOR_NAME_ALIASES[alvoDash];

  for (const [code, label] of Object.entries(SECTOR_DISPLAY)) {
    if (norm(label) === alvo) return code;
  }
  for (const [dep, code] of Object.entries(DEPARTMENT_TO_SECTOR)) {
    if (norm(dep) === alvo) return code;
  }
  return undefined;
}

/**
 * O leito, identificado pelo SETOR do banco a que pertence (nome + tipo),
 * casa com o setor PEDIDO no filtro do mapa de leitos?
 *
 * Casamento por IDENTIDADE de setor: o nome real gravado no banco, ou o codigo
 * canonico resolvido a partir do nome. NUNCA por `setores.tipo` quando o valor
 * pedido e uma CLASSIFICACAO (ex.: 'clinico'/'cirurgico').
 *
 * `setores.tipo` e uma classificacao COMPARTILHADA por varios setores, nao a
 * identidade de um setor. Casar o filtro por ela transformava um valor de tipo
 * poluido em `selected_sector` numa GRADE FANTASMA — dezenas de leitos de
 * setores distintos (todos os "clinico") fundidos numa unica tela, com L01
 * repetido N vezes. Este e exatamente o "escape para o setor clinico".
 *
 * Regra de seguranca: um pedido que NAO resolve para um setor real (nem nome do
 * banco, nem codigo valido) casa NADA — o mapa fica vazio em vez de inventar
 * leitos. `tipo` so participa quando o proprio pedido e um SectorType valido
 * (nunca uma classificacao), para preservar bases legadas em que `tipo` guarda
 * o codigo do setor.
 */
export function bedBelongsToSector(
  setor: { nome?: string | null; tipo?: string | null } | null | undefined,
  requested: string | null | undefined,
): boolean {
  if (!requested) return false;
  const req = requested.trim();
  if (!req) return false;

  const rowName = setor?.nome ?? null;
  const rowTipo = setor?.tipo ?? null;

  // 1) Nome real do setor do banco — forma canonica de identidade.
  if (rowName != null && rowName === req) return true;

  // 2) setores.tipo SO quando o pedido e um codigo de setor VALIDO (SectorType).
  //    'clinico'/'cirurgico' nao sao SectorType, entao nunca entram por aqui.
  if (isSectorType(req) && rowTipo != null && rowTipo === req) return true;

  // 3) Codigo canonico resolvido dos DOIS lados. Fallback a tipo apenas quando
  //    tipo e um codigo valido (nunca uma classificacao). Pedido irresolvivel
  //    (wantedCode indefinido) nao casa nada.
  const wantedCode = resolveSectorCode(req) ?? (isSectorType(req) ? req : undefined);
  if (wantedCode == null) return false;
  const rowCode = resolveSectorCode(rowName) ?? (isSectorType(rowTipo) ? rowTipo : undefined);
  return rowCode != null && rowCode === wantedCode;
}

/** O destino pertence ao bloco de alta complexidade (UTI/UCI)? */
export function isHighComplexity(value: string | null | undefined): boolean {
  const code = resolveSectorCode(value);
  return !!code && getSectorCoverage(code)?.group === "alta_complexidade";
}

/**
 * Verificação de consistência contra SECTOR_DISPLAY.
 *
 * Acusa duas classes de erro:
 *  - código declarado aqui que não existe em SECTOR_DISPLAY (provável código
 *    inventado a partir do rótulo — o caso `cc_bloco_cirurgico`);
 *  - setor conhecido pelo sistema que ninguém classificou aqui.
 *
 * `ue_horizontal` é exceção conhecida enquanto o guarda-chuva não é resolvido.
 */
export const KNOWN_UNCLASSIFIED: readonly string[] = ["ue_horizontal"];

export function assertSectorCoverageIntegrity(): { orphans: string[]; missing: string[] } {
  const declared = new Set(SECTOR_COVERAGE.map((s) => s.code));
  const known = new Set(Object.keys(SECTOR_DISPLAY));

  const orphans = [...declared].filter((c) => !known.has(c));
  const missing = [...known].filter((c) => !declared.has(c) && !KNOWN_UNCLASSIFIED.includes(c));

  return { orphans, missing };
}
