/**
 * Setores SEM implantação ativa nesta unidade.
 * Aparecem com cadeado cinza nos seletores e, se receberem
 * sinalizações de leito, são limpos automaticamente em 24h
 * (preservando o prontuário do paciente).
 *
 * ── STAGING: TODOS OS SETORES LIBERADOS (05/08/2026) ──────────────────────
 * A lista foi esvaziada a pedido do gestor para permitir teste de Enfermarias,
 * Urgência e Emergência, Centro Cirúrgico e Anexo Vascular no ambiente de
 * validação.
 *
 * O MECANISMO CONTINUA INTACTO: para voltar a travar um setor, basta
 * reintroduzi-lo no Set abaixo — nenhum outro arquivo precisa mudar.
 *
 * A lista original, caso precise ser restaurada:
 *   Enfermarias .......... NEURO 01, NEURO 02, CLÍNICA CIRÚRGICA
 *   Urgência/Emergência .. UE VERTICAL, UE HORIZONTAL, SALA VERMELHA,
 *                          SALA LARANJA, INTERNAÇÃO UE, OBSERVAÇÃO CLÍNICA
 *   Anexo Vascular ....... ENFERMARIA VASCULAR, RIV
 *   Centro Cirúrgico ..... CC PREPARO, CC BLOCO CIRÚRGICO, CC RPA
 *
 * ATENÇÃO ao promover para produção: esta liberação é de AMBIENTE DE TESTE.
 * Levar o Set vazio para a unidade real expõe setores que podem não ter leitos
 * cadastrados nem fluxo implantado.
 */
import type { Department } from "@/contexts/DepartmentContext";
import { DEPARTMENT_TO_SECTOR } from "@/contexts/DepartmentContext";

export const LOCKED_DEPARTMENTS: ReadonlySet<Department> = new Set<Department>([
  // (vazio em staging — ver cabeçalho)
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
