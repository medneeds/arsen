/**
 * Setores SEM implantação ativa nesta unidade.
 * Aparecem com cadeado cinza nos seletores e, se receberem
 * sinalizações de leito, são limpos automaticamente em 24h
 * (preservando o prontuário do paciente).
 *
 * Liberados: UTI 1, UTI 2, UCI 1, UCI 2, UCC, ENFERMARIA DE TRANSIÇÃO.
 */
import type { Department } from "@/contexts/DepartmentContext";
import { DEPARTMENT_TO_SECTOR } from "@/contexts/DepartmentContext";

export const LOCKED_DEPARTMENTS: ReadonlySet<Department> = new Set<Department>([
  // Enfermarias bloqueadas
  "NEURO 01",
  "NEURO 02",
  "CLÍNICA CIRÚRGICA",
  // Urgência e Emergência (todos)
  "UE VERTICAL",
  "UE HORIZONTAL",
  "SALA VERMELHA",
  "SALA LARANJA",
  "INTERNAÇÃO UE",
  "OBSERVAÇÃO CLÍNICA",
  // Anexo Vascular
  "ENFERMARIA VASCULAR",
  "RIV",
  // Centro Cirúrgico
  "CC PREPARO",
  "CC BLOCO CIRÚRGICO",
  "CC RPA",
]);

export function isDepartmentLocked(d: string | null | undefined): boolean {
  if (!d) return false;
  return LOCKED_DEPARTMENTS.has(d as Department);
}

/** Códigos internos de setor (ex.: "neuro_01") correspondentes aos bloqueados. */
export const LOCKED_SECTOR_CODES: ReadonlySet<string> = new Set(
  Array.from(LOCKED_DEPARTMENTS)
    .map((d) => DEPARTMENT_TO_SECTOR[d])
    .filter(Boolean),
);

export function isSectorCodeLocked(code: string | null | undefined): boolean {
  if (!code) return false;
  return LOCKED_SECTOR_CODES.has(code);
}

export const LOCKED_TOOLTIP = "Setor sem implantação ativa nesta unidade";
