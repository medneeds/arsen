/**
 * Modulos do capitulo multiprofissional — definicao UNICA lida pelas abas do
 * cabecalho (ClinicalModuleTabs), pelo menu lateral (AppSidebar), pelas rotas
 * (App.tsx) e pela faixa do paciente. Visibilidade e escrita por papel.
 *
 * Tudo atras de FEATURE_MULTIPROFISSIONAL: desligada, nenhum modulo aparece.
 */
import { FEATURE_MULTIPROFISSIONAL } from "./featureFlags";

export type MultiModuleKey = "nutricao" | "fisioterapia" | "enfermagem";

export interface MultiModuleDef {
  key: MultiModuleKey;
  label: string;
  /** Rota do modulo no contexto do paciente (com ?patientId=...). */
  path: string;
  /** Rota do modulo no contexto do setor (lista/mapa/painel), sem paciente. */
  sectorPath: string;
  sectorLabel: string;
  /** Papeis que veem a aba (leitura). */
  readRoles: readonly string[];
  /** Papeis que registram no modulo. Os demais leitores veem em modo leitura. */
  writeRoles: readonly string[];
}

/** Papeis de gestao do sistema: veem tudo, como hoje veem os modulos medicos. */
const GESTAO = ["super_admin", "admin", "coordenador", "dev"] as const;

export const MULTI_MODULES: readonly MultiModuleDef[] = [
  {
    key: "nutricao",
    label: "Nutrição",
    path: "/nutricao",
    sectorPath: "/nutricao/lista",
    sectorLabel: "Lista da nutrição",
    readRoles: ["nutricionista", "medico", "enfermeiro", ...GESTAO],
    writeRoles: ["nutricionista"],
  },
  {
    key: "fisioterapia",
    label: "Fisioterapia",
    path: "/fisioterapia",
    sectorPath: "/fisioterapia/mapa",
    sectorLabel: "Mapa da fisioterapia",
    readRoles: ["fisioterapeuta", "medico", "enfermeiro", ...GESTAO],
    writeRoles: ["fisioterapeuta"],
  },
  {
    key: "enfermagem",
    label: "Enfermagem",
    path: "/enfermagem",
    sectorPath: "/enfermagem/setor",
    sectorLabel: "Painel do enfermeiro",
    readRoles: ["enfermeiro", "tecnico", "medico", ...GESTAO],
    writeRoles: ["enfermeiro", "tecnico"],
  },
];

/** Selo "NOVO" nas abas ate esta data (30 dias da entrada na staging). */
export const MULTI_NEW_BADGE_UNTIL = new Date("2026-12-26T03:00:00Z");

export function multiModulesEnabled(): boolean {
  return FEATURE_MULTIPROFISSIONAL;
}

/** Modulos visiveis para o papel (vazio com a chave desligada ou sem papel). */
export function visibleMultiModules(role: string | null | undefined): MultiModuleDef[] {
  if (!multiModulesEnabled() || !role) return [];
  return MULTI_MODULES.filter((m) => m.readRoles.includes(role));
}

export function canWriteModule(role: string | null | undefined, key: MultiModuleKey): boolean {
  if (!role) return false;
  return !!MULTI_MODULES.find((m) => m.key === key)?.writeRoles.includes(role);
}

export function getMultiModule(key: MultiModuleKey): MultiModuleDef {
  const m = MULTI_MODULES.find((x) => x.key === key);
  if (!m) throw new Error(`modulo multi desconhecido: ${key}`);
  return m;
}

/** Rota de setor exclusiva do tecnico de enfermagem. */
export const MEU_PLANTAO_PATH = "/enfermagem/meu-plantao";
