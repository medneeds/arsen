/**
 * Fonte única de verdade para perfis de acesso, roles do sistema e
 * agrupamento de setores. Sincronizado com:
 *  - AccessLimitsScreen (ACCESS_PROFILE_LABELS, ROLE_LABELS)
 *  - AppSidebar (sidebar por accessProfile)
 *  - AuthPage.getRedirectRoute (rota inicial por perfil)
 *  - DepartmentContext (DEPARTMENTS canônicos)
 *  - enum Postgres app_role
 */
import {
  Stethoscope,
  Briefcase,
  ShieldCheck,
  Activity,
  Microscope,
  Pill,
  ClipboardList,
  Users as UsersIcon,
  Building2,
  Eye,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import type { Department } from "@/contexts/DepartmentContext";

export type AppRole =
  | "admin"
  | "medico"
  | "porta"
  | "visitante"
  | "farmacia"
  | "nir";

export type AccessProfile =
  | "medico"
  | "gestor"
  | "farmacia"
  | "ccih"
  | "nir"
  | "imagem"
  | "laboratorio"
  | "administrativo"
  | "multi"
  | "classificacao_risco";

/** Roles do sistema (enum app_role no Postgres). Controla RLS. */
export interface RoleConfig {
  value: AppRole;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SYSTEM_ROLES: RoleConfig[] = [
  {
    value: "admin",
    label: "Coordenador (Admin)",
    description: "Acesso total ao sistema e gestão de usuários",
    icon: ShieldCheck,
  },
  {
    value: "medico",
    label: "Médico",
    description: "Atendimento clínico padrão (CRUD em pacientes/evoluções)",
    icon: Stethoscope,
  },
  {
    value: "porta",
    label: "Médico Porta",
    description: "Triagem e avaliação inicial na emergência",
    icon: Activity,
  },
  {
    value: "farmacia",
    label: "Farmácia Clínica",
    description: "Validação farmacêutica e dispensação",
    icon: Pill,
  },
  {
    value: "nir",
    label: "NIR",
    description: "Núcleo Interno de Regulação (gestão de leitos)",
    icon: Building2,
  },
  {
    value: "visitante",
    label: "Visitante",
    description: "Apenas visualização do mapa de leitos (somente leitura)",
    icon: Eye,
  },
];

/** Perfis de acesso — controlam UI/sidebar e rota inicial */
export interface AccessProfileConfig {
  value: AccessProfile;
  label: string;
  shortLabel: string;
  description: string;
  defaultRoute: string;
  icon: LucideIcon;
  /** Se true, esse perfil ignora seleção de setor (tem painel próprio com filtros internos) */
  skipSectorSelection: boolean;
}

export const ACCESS_PROFILES: AccessProfileConfig[] = [
  {
    value: "medico",
    label: "Médico Assistente",
    shortLabel: "Médico",
    description: "Sidebar clínica completa com prescrição, evolução e prontuário",
    defaultRoute: "/",
    icon: Stethoscope,
    skipSectorSelection: false,
  },
  {
    value: "gestor",
    label: "Gestor Hospitalar",
    shortLabel: "Gestor",
    description: "Painel executivo somente leitura com KPIs hospitalares",
    defaultRoute: "/painel-gestor",
    icon: Briefcase,
    skipSectorSelection: true,
  },
  {
    value: "farmacia",
    label: "Farmácia Clínica",
    shortLabel: "Farmácia",
    description: "Ambiente farmacêutico (validação e dispensação)",
    defaultRoute: "/validacao-farmaceutica",
    icon: Pill,
    skipSectorSelection: true,
  },
  {
    value: "ccih",
    label: "CCIH — Controle de Infecção",
    shortLabel: "CCIH",
    description: "Painel de controle de infecção hospitalar",
    defaultRoute: "/ccih",
    icon: ShieldCheck,
    skipSectorSelection: true,
  },
  {
    value: "nir",
    label: "NIR — Regulação Interna",
    shortLabel: "NIR",
    description: "Núcleo Interno de Regulação (mapa de leitos e fluxos)",
    defaultRoute: "/nir",
    icon: Building2,
    skipSectorSelection: true,
  },
  {
    value: "imagem",
    label: "Setor de Imagem",
    shortLabel: "Imagem",
    description: "Painel diagnóstico (RX, TC, RM, USG)",
    defaultRoute: "/setor-imagem",
    icon: Microscope,
    skipSectorSelection: true,
  },
  {
    value: "laboratorio",
    label: "Setor Laboratorial",
    shortLabel: "Laboratório",
    description: "Painel laboratorial (análises clínicas)",
    defaultRoute: "/setor-laboratorio",
    icon: Microscope,
    skipSectorSelection: true,
  },
  {
    value: "administrativo",
    label: "Administrativo / Recepção",
    shortLabel: "Administrativo",
    description: "Cadastros, recepção e fluxos administrativos",
    defaultRoute: "/recepcao",
    icon: ClipboardList,
    skipSectorSelection: true,
  },
  {
    value: "multi",
    label: "Equipe Multiprofissional",
    shortLabel: "Multi",
    description: "Fluxos da equipe multidisciplinar (enfermagem, nutrição, fisio, etc.)",
    defaultRoute: "/mapa",
    icon: UsersIcon,
    skipSectorSelection: true,
  },
  {
    value: "classificacao_risco",
    label: "Classificação de Risco",
    shortLabel: "Classif. Risco",
    description: "Acesso exclusivo à fila de triagem e Protocolo de Manchester",
    defaultRoute: "/triagem-fila",
    icon: Activity,
    skipSectorSelection: true,
  },
];

/** Combinação sugerida role × access_profile (usada como sugestão) */
export const PROFILE_TO_ROLE_HINT: Record<AccessProfile, AppRole> = {
  medico: "medico",
  gestor: "admin",
  farmacia: "farmacia",
  ccih: "medico",
  nir: "nir",
  imagem: "medico",
  laboratorio: "medico",
  administrativo: "medico",
  multi: "medico",
  classificacao_risco: "medico",
};

/** Agrupamento de setores em blocos hierárquicos para seleção em massa */
export interface SectorGroup {
  id: string;
  label: string;
  description: string;
  departments: Department[];
}

export const SECTOR_GROUPS: SectorGroup[] = [
  {
    id: "uti",
    label: "UTI",
    description: "Unidades de Terapia Intensiva",
    departments: ["UTI 1", "UTI 2"],
  },
  {
    id: "uci",
    label: "UCI / UCC",
    description: "Cuidados Intermediários e Coronariana",
    departments: ["UCI 1", "UCI 2", "UCC"],
  },
  {
    id: "enfermarias",
    label: "Enfermarias",
    description: "Internação clínica e cirúrgica",
    departments: [
      "NEURO 01",
      "NEURO 02",
      "CLÍNICA CIRÚRGICA",
      "ENFERMARIA DE TRANSIÇÃO",
      "ENFERMARIA VASCULAR",
      "RIV",
    ],
  },
  {
    id: "emergencia_adulto",
    label: "Urgência e Emergência — Adulto",
    description: "Pronto-socorro adulto (vertical, horizontal, salas)",
    departments: [
      "URGÊNCIA E EMERGÊNCIA ADULTO",
      "UE VERTICAL",
      "UE HORIZONTAL",
      "SALA VERMELHA",
      "SALA LARANJA",
      "INTERNAÇÃO UE",
      "OBSERVAÇÃO CLÍNICA",
    ],
  },
  {
    id: "emergencia_ped",
    label: "Urgência e Emergência — Pediátrica",
    description: "Pronto-socorro pediátrico",
    departments: ["URGÊNCIA E EMERGÊNCIA PEDIÁTRICA"],
  },
  {
    id: "centro_cirurgico",
    label: "Centro Cirúrgico",
    description: "Preparo, bloco e RPA",
    departments: ["CC PREPARO", "CC BLOCO CIRÚRGICO", "CC RPA"],
  },
  {
    id: "regulacao",
    label: "Regulação e Infecção",
    description: "CCIH e NIR",
    departments: ["CCIH", "NIR"],
  },
];

/** Mapa rápido de role → label */
export const ROLE_LABEL_MAP: Record<AppRole, string> = SYSTEM_ROLES.reduce(
  (acc, r) => ({ ...acc, [r.value]: r.label }),
  {} as Record<AppRole, string>,
);

/** Mapa rápido de access_profile → label */
export const ACCESS_PROFILE_LABEL_MAP: Record<AccessProfile, string> = ACCESS_PROFILES.reduce(
  (acc, p) => ({ ...acc, [p.value]: p.label }),
  {} as Record<AccessProfile, string>,
);
