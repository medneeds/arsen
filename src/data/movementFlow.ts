import {
  LogIn,
  ClipboardCheck,
  BedDouble,
  ArrowLeftRight,
  Building2,
  Home,
  UserMinus,
  LogOut,
  Skull,
  type LucideIcon,
} from "lucide-react";

export type MovementCategory = "TRANSFERENCIA" | "SAIDA";

export type MovementSubtype =
  // Entrada (legado — coberto pelo fluxo de Admissão)
  | "ENTRADA"
  | "ADMISSAO"
  | "INTERNACAO"
  // Transferência
  | "TRANSFERENCIA_INTERNA"
  | "TRANSFERENCIA_EXTERNA"
  // Saída
  | "ALTA_HOSPITALAR"
  | "ALTA_PEDIDO"
  | "EVASAO"
  | "OBITO";

/** Legacy values still stored in DB. We keep them as valid movement_type values. */
export type LegacyMovementType = "ALTA" | "ÓBITO" | "TRANSFERÊNCIA";

export type AnyMovementType = MovementSubtype | LegacyMovementType;

export interface SubtypeDef {
  id: MovementSubtype;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  category: MovementCategory;
  /** show destination field */
  needsDestination?: boolean;
  /** suggests linking to Alta/Desfecho summary */
  linksToDischargeSummary?: boolean;
}

export interface CategoryDef {
  id: MovementCategory;
  label: string;
  description: string;
  /** semantic token color name */
  tone: "primary" | "accent" | "destructive";
  icon: LucideIcon;
}

export const MOVEMENT_CATEGORIES: CategoryDef[] = [
  {
    id: "TRANSFERENCIA",
    label: "Transferências",
    description: "Movimentação entre setores ou para outra instituição",
    tone: "primary",
    icon: ArrowLeftRight,
  },
  {
    id: "SAIDA",
    label: "Saídas",
    description: "Encerramento do atendimento — leito liberado pelo setor administrativo",
    tone: "destructive",
    icon: LogOut,
  },
];

export const MOVEMENT_SUBTYPES: SubtypeDef[] = [
  // Transferência
  {
    id: "TRANSFERENCIA_INTERNA",
    label: "Transferência Interna",
    shortLabel: "Interna",
    description: "Mudança de setor, leito ou anexo dentro da instituição",
    icon: ArrowLeftRight,
    category: "TRANSFERENCIA",
    needsDestination: true,
  },
  {
    id: "TRANSFERENCIA_EXTERNA",
    label: "Transferência Externa",
    shortLabel: "Externa",
    description: "Transferência para outra unidade hospitalar",
    icon: Building2,
    category: "TRANSFERENCIA",
    needsDestination: true,
  },
  // Saída
  {
    id: "ALTA_HOSPITALAR",
    label: "Alta Hospitalar",
    shortLabel: "Alta",
    description: "Alta médica com sumário de alta e orientações",
    icon: Home,
    category: "SAIDA",
    linksToDischargeSummary: true,
  },
  {
    id: "ALTA_PEDIDO",
    label: "Alta a Pedido",
    shortLabel: "A Pedido",
    description: "Saída a pedido do paciente/responsável (termo)",
    icon: UserMinus,
    category: "SAIDA",
    linksToDischargeSummary: true,
  },
  {
    id: "EVASAO",
    label: "Evasão",
    shortLabel: "Evasão",
    description: "Saída sem alta médica registrada",
    icon: LogOut,
    category: "SAIDA",
  },
  {
    id: "OBITO",
    label: "Óbito",
    shortLabel: "Óbito",
    description: "Registro de óbito do paciente",
    icon: Skull,
    category: "SAIDA",
    linksToDischargeSummary: true,
  },
];

/** Map legacy movement_type values to new subtype ids for display. */
export const LEGACY_TO_SUBTYPE: Record<LegacyMovementType, MovementSubtype> = {
  ALTA: "ALTA_HOSPITALAR",
  ÓBITO: "OBITO",
  TRANSFERÊNCIA: "TRANSFERENCIA_INTERNA",
};

export function getSubtypeDef(value: AnyMovementType | string | null | undefined): SubtypeDef | null {
  if (!value) return null;
  const direct = MOVEMENT_SUBTYPES.find((s) => s.id === value);
  if (direct) return direct;
  const legacy = LEGACY_TO_SUBTYPE[value as LegacyMovementType];
  if (legacy) return MOVEMENT_SUBTYPES.find((s) => s.id === legacy) || null;
  return null;
}

export function getCategoryDef(id: MovementCategory): CategoryDef {
  return MOVEMENT_CATEGORIES.find((c) => c.id === id)!;
}

export function getSubtypesByCategory(cat: MovementCategory): SubtypeDef[] {
  return MOVEMENT_SUBTYPES.filter((s) => s.category === cat);
}

/** Legacy adapter: map a legacy type id to the corresponding new subtype id. */
export function adaptLegacyType(value: AnyMovementType | null): MovementSubtype | null {
  if (!value) return null;
  if ((MOVEMENT_SUBTYPES as readonly { id: string }[]).some((s) => s.id === value)) {
    return value as MovementSubtype;
  }
  return LEGACY_TO_SUBTYPE[value as LegacyMovementType] ?? null;
}

// Lista oficial de setores internos (sincronizada com a estrutura real do hospital)
// Ver mem://structure/hospital-sectors-and-beds
export const INTERNAL_TRANSFER_DESTINATIONS = [
  // Terapias intensivas
  "UTI 01",
  "UTI 02",
  "UCI 01",
  "UCI 02",
  // Enfermarias
  "ENFERMARIA NEURO 01",
  "ENFERMARIA NEURO 02",
  "ENFERMARIA CLÍNICA CIRÚRGICA",
  "ENFERMARIA DE TRANSIÇÃO",
  "UCC (UNIDADE DE CUIDADOS CLÍNICOS)",
  "ENFERMARIA VASCULAR (ANEXO)",
  // Cirúrgicos / procedimentos
  "CENTRO CIRÚRGICO",
  "RIV (REFERÊNCIA DE INTERNAÇÃO VASCULAR)",
  "HEMODINÂMICA",
  // Urgência e Emergência
  "UE VERTICAL",
  "UE HORIZONTAL",
  "SALA VERMELHA",
  "SALA LARANJA",
  "OBSERVAÇÃO CLÍNICA (UE HORIZONTAL)",
  "INTERNAÇÃO UE",
];

export const EXTERNAL_TRANSFER_DESTINATIONS = [
  "INSTITUTO VOLTA VIDA (IVV)",
  "PSIQUIATRIA (INSTITUTO VOLTA VIDA)",
  "HOSPITAL DE REFERÊNCIA REGIONAL",
  "OUTRO HOSPITAL",
];

// Destinos de internação (a partir da UE / pré-admissão)
export const INTERNMENT_DESTINATIONS = [
  "UTI 01",
  "UTI 02",
  "UCI 01",
  "UCI 02",
  "ENFERMARIA NEURO 01",
  "ENFERMARIA NEURO 02",
  "ENFERMARIA CLÍNICA CIRÚRGICA",
  "ENFERMARIA DE TRANSIÇÃO",
  "UCC (UNIDADE DE CUIDADOS CLÍNICOS)",
  "ENFERMARIA VASCULAR (ANEXO)",
];
