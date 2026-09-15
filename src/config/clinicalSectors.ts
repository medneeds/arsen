import {
  Activity,
  Ambulance,
  BedDouble,
  Brain,
  HeartPulse,
  Scissors,
  Siren,
  Stethoscope,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { Department } from "@/contexts/DepartmentContext";

/**
 * Agrupamento dos setores clinicos para a tela de entrada.
 *
 * A taxonomia NAO foi inventada aqui: e a mesma que o hospital usa em
 * user_departments e que o AccessLimitsScreen ja expandia. Um usuario com
 * permissao "UTI" enxerga os cinco setores daquele grupo. Manter uma unica
 * fonte evita o descompasso entre o que a tela mostra e o que a permissao
 * realmente libera.
 *
 * Ordem deliberada: intensiva primeiro, depois porta de entrada, enfermarias e
 * centro cirurgico. E a ordem em que o corpo clinico fala desses lugares.
 */

export interface SectorGroup {
  /** Departamento macro, como gravado em user_departments */
  macro: string;
  label: string;
  /** Uma linha explicando o grupo — ajuda quem e novo no hospital */
  hint: string;
  sectors: Department[];
}

export const SECTOR_GROUPS: SectorGroup[] = [
  {
    macro: "UTI",
    label: "Terapia intensiva e intermediária",
    hint: "Leitos de suporte avançado e cuidados semi-intensivos",
    sectors: ["UTI 1", "UTI 2", "UCI 1", "UCI 2", "UCC"] as Department[],
  },
  {
    macro: "URGÊNCIA E EMERGÊNCIA ADULTO",
    label: "Urgência e emergência",
    hint: "Salas de estabilização, observação e internação da UE",
    sectors: [
      "SALA VERMELHA",
      "SALA LARANJA",
      "UE VERTICAL",
      "UE HORIZONTAL",
      "OBSERVAÇÃO CLÍNICA",
      "INTERNAÇÃO UE",
    ] as Department[],
  },
  {
    macro: "ENFERMARIA",
    label: "Enfermarias",
    hint: "Internação em leitos de cuidado geral e especialidades",
    sectors: [
      "NEURO 01",
      "NEURO 02",
      "CLÍNICA CIRÚRGICA",
      "ENFERMARIA DE TRANSIÇÃO",
      "ENFERMARIA VASCULAR",
    ] as Department[],
  },
  {
    macro: "CENTRO CIRÚRGICO",
    label: "Centro cirúrgico",
    hint: "Preparo, bloco e recuperação pós-anestésica",
    sectors: ["CC PREPARO", "CC BLOCO CIRÚRGICO", "CC RPA"] as Department[],
  },
];

/**
 * Icone por setor. Indica o TIPO de lugar, nao decora: o medico reconhece o
 * destino pela silhueta antes de ler o nome, que e o que acelera a escolha
 * numa passagem de plantao.
 */
export const SECTOR_ICONS: Record<string, LucideIcon> = {
  "UTI 1": Activity,
  "UTI 2": Activity,
  "UCI 1": HeartPulse,
  "UCI 2": HeartPulse,
  UCC: HeartPulse,

  "SALA VERMELHA": Siren,
  "SALA LARANJA": Siren,
  "UE VERTICAL": Ambulance,
  "UE HORIZONTAL": Ambulance,
  "OBSERVAÇÃO CLÍNICA": Timer,
  "INTERNAÇÃO UE": BedDouble,

  "NEURO 01": Brain,
  "NEURO 02": Brain,
  "CLÍNICA CIRÚRGICA": Scissors,
  "ENFERMARIA DE TRANSIÇÃO": BedDouble,
  "ENFERMARIA VASCULAR": Stethoscope,

  "CC PREPARO": Scissors,
  "CC BLOCO CIRÚRGICO": Scissors,
  "CC RPA": Timer,
};

/** Setores com pagina propria — o destino muda conforme o setor escolhido. */
export const SECTOR_ROUTES: Record<string, string> = {
  "UE VERTICAL": "/ue-vertical",
  "UE HORIZONTAL": "/ue-horizontal",
};
