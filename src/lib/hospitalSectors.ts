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
  /**
   * true = fora do escopo de internação, ou agrupamento sem leito próprio.
   * Continua no catálogo porque um paciente PODE estar fisicamente ali (uma
   * transfusão em observação clínica é legítima) e porque requisições antigas
   * referenciam esses códigos. Mas não pode ser oferecido como DESTINO de
   * internação — ver INPATIENT_SECTOR_GROUPS.
   */
  outOfInpatientScope?: boolean;
}

export interface HospitalSectorGroup {
  title: string;
  items: HospitalSectorItem[];
}

const make = (code: string, fallback?: string): HospitalSectorItem => ({
  key: code,
  label: SECTOR_DISPLAY[code] || fallback || code,
});

/** Item fora do escopo de internação (ou agrupamento). */
const makeOut = (code: string, fallback?: string): HospitalSectorItem => ({
  ...make(code, fallback),
  outOfInpatientScope: true,
});

export const HOSPITAL_SECTOR_GROUPS: HospitalSectorGroup[] = [
  {
    title: "UTI/UCI",
    items: [
      make("red"),
      make("yellow"),
      make("blue"),
      make("outside"),
    ],
  },
  {
    title: "Urgência e Emergência",
    items: [
      makeOut("ue_vertical"),
      makeOut("ue_horizontal"),
      make("sala_vermelha"),
      make("sala_laranja"),
      makeOut("observacao_clinica"),
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
    title: "Enfermarias",
    items: [
      // UCC = Unidade de Cuidados Clínicos: bloco de enfermarias por
      // definição institucional (Direção Clínica, 19/08/2026).
      make("ucc"),
      make("clinica_cirurgica"),
      make("neuro_01"),
      make("neuro_02"),
      make("enfermaria_transicao"),
      make("enfermaria_vascular"),
      // riv: fora do escopo de internação; permanece no catálogo porque
      // requisições legadas podem referenciar o setor.
      makeOut("riv"),
    ],
  },
];

/**
 * Setores válidos como DESTINO de internação: exclui os fora do escopo e os
 * agrupamentos. Sinalizar transferência interna para um setor fora do escopo
 * gerava registro que a rotina SQL cancela em 24h.
 */
export const INPATIENT_SECTOR_GROUPS: HospitalSectorGroup[] = HOSPITAL_SECTOR_GROUPS
  .map((g) => ({ ...g, items: g.items.filter((i) => !i.outOfInpatientScope) }))
  .filter((g) => g.items.length > 0);

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
