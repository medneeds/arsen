/**
 * Catálogo canônico de setores do hospital para uso em formulários
 * de requisição (hemocomponentes, culturas, etc.). Mantém sincronia
 * com os códigos definidos em DepartmentContext.
 */
import { DEPARTMENT_TO_SECTOR, SECTOR_DISPLAY } from "@/contexts/DepartmentContext";

export interface HospitalSectorItem {
  /** Código interno (mesmo usado em selected_sector / patients.sector) */
  key: string;
  /** Rótulo amigável para exibição */
  label: string;
}

export interface HospitalSectorGroup {
  title: string;
  items: HospitalSectorItem[];
}

const make = (code: string, fallback?: string): HospitalSectorItem => ({
  key: code,
  label: SECTOR_DISPLAY[code] || fallback || code,
});

export const HOSPITAL_SECTOR_GROUPS: HospitalSectorGroup[] = [
  {
    title: "UTI / UCI",
    items: [
      make("red"),
      make("yellow"),
      make("blue"),
      make("outside"),
      make("ucc"),
    ],
  },
  {
    title: "Pronto Socorro",
    items: [
      make("ue_vertical"),
      make("ue_horizontal"),
      make("sala_vermelha"),
      make("sala_laranja"),
      make("observacao_clinica"),
      make("internacao_ue"),
    ],
  },
  {
    title: "Centro Cirúrgico",
    items: [
      make("cc_preparo"),
      make("cc_bloco"),
      make("cc_rpa"),
    ],
  },
  {
    title: "Clínicas",
    items: [
      make("clinica_cirurgica"),
      make("neuro_01"),
      make("neuro_02"),
      make("enfermaria_transicao"),
      make("enfermaria_vascular"),
      make("riv"),
    ],
  },
];

/** Lookup label por código (com fallback ao próprio código). */
export const sectorLabelFromCode = (code?: string | null): string => {
  if (!code) return "";
  return SECTOR_DISPLAY[code] || code;
};

/** Garante que um código de setor existe em algum grupo. */
export const isKnownSectorCode = (code?: string | null): boolean => {
  if (!code) return false;
  return HOSPITAL_SECTOR_GROUPS.some((g) => g.items.some((i) => i.key === code));
};

export { DEPARTMENT_TO_SECTOR, SECTOR_DISPLAY };
