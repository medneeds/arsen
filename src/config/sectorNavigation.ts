/**
 * HIERARQUIA DE NAVEGAÇÃO DE SETORES — fonte única
 *
 * ─── Por que este arquivo existe ────────────────────────────────────────────
 * A árvore de setores estava duplicada em SectorSelector.tsx e AppSidebar.tsx,
 * e as duas cópias já divergiam entre si ("Anexo Vascular" contra "Enf.
 * Vascular (Anexo)"). Quem mexia num lugar esquecia o outro, e o menu passava a
 * mostrar coisa diferente conforme o caminho.
 *
 * ─── O que aparece aqui ─────────────────────────────────────────────────────
 * Apenas setores DENTRO do escopo de internação (níveis "clinical" e
 * "tracking" em sectorCoverage.ts). Ficam de fora, por decisão da Direção
 * Clínica de 19/08/2026:
 *
 *   riv, observacao_clinica  — fora do escopo de internação. Sinalização para
 *                              eles é cancelada em 24h pela rotina SQL; ofertá-los
 *                              como setor produzia registro nascido para morrer.
 *   ue_horizontal            — agrupamento, não setor-folha. Os leitos estão nos
 *                              filhos: Sala Vermelha, Sala Laranja e Posto de
 *                              Internação.
 *
 * ─── Atendimento fora da internação ─────────────────────────────────────────
 * UE Vertical e UE Horizontal continuam acessíveis, mas em bloco PRÓPRIO e
 * separado, porque são páginas de atendimento e não setores de internação —
 * os consultórios da triagem gravam em `ue_vertical`, e a página da UE
 * Horizontal é onde a equipe acompanha as macas. Removê-las do menu deixaria
 * esses pacientes sem via de acesso, o que é inaceitável numa plataforma em
 * uso à beira do leito.
 *
 * Os grupos e a ordem espelham docs/disposicao-setores-leitos-arsen.pdf.
 */
import type { Department } from "@/contexts/DepartmentContext";

export interface NavSector {
  name: string;
  department: Department;
  /** Rota própria. Sem ela, o item abre o mapa de leitos do setor. */
  link?: string;
}

export interface NavSectorGroup {
  group: string;
  sectors: NavSector[];
  /**
   * true = não é setor de internação; é página de atendimento. Renderizado em
   * bloco separado para não se confundir com leito instalado.
   */
  outOfInpatientScope?: boolean;
}

export const SECTOR_NAVIGATION: NavSectorGroup[] = [
  {
    group: "Enfermarias",
    sectors: [
      // UCC = Unidade de Cuidados CLÍNICOS: enfermaria por definição
      // institucional, não cuidado intermediário.
      { name: "UCC", department: "UCC" as Department },
      { name: "Neuro 01", department: "NEURO 01" as Department },
      { name: "Neuro 02", department: "NEURO 02" as Department },
      { name: "Clínica Cirúrgica", department: "CLÍNICA CIRÚRGICA" as Department },
      { name: "Enf. Transição", department: "ENFERMARIA DE TRANSIÇÃO" as Department },
      // Enf. Vascular pertence ao bloco de Enfermarias (Bloco II do documento).
      // Estava sozinha num grupo "Anexo Vascular" junto do RIV, que saiu.
      { name: "Enf. Vascular", department: "ENFERMARIA VASCULAR" as Department },
    ],
  },
  {
    group: "UTI",
    sectors: [
      { name: "UTI 1", department: "UTI 1" as Department },
      { name: "UTI 2", department: "UTI 2" as Department },
    ],
  },
  {
    group: "UCI",
    sectors: [
      { name: "UCI 1", department: "UCI 1" as Department },
      { name: "UCI 2", department: "UCI 2" as Department },
    ],
  },
  {
    group: "Urgência e Emergência",
    sectors: [
      { name: "Sala Vermelha", department: "SALA VERMELHA" as Department },
      { name: "Sala Laranja", department: "SALA LARANJA" as Department },
      // Rótulo institucional aprovado; department alinhado ao gravado nos
      // leitos M01–M14 (era "INTERNAÇÃO UE", mantido apenas como alias).
      { name: "Posto de Internação", department: "POSTO INTERNAÇÃO" as Department },
    ],
  },
  {
    group: "Centro Cirúrgico",
    sectors: [
      { name: "Preparo", department: "CC PREPARO" as Department },
      { name: "Bloco Cirúrgico", department: "CC BLOCO CIRÚRGICO" as Department },
      { name: "RPA", department: "CC RPA" as Department },
    ],
  },
  {
    group: "Atendimento (fora da internação)",
    outOfInpatientScope: true,
    sectors: [
      { name: "UE Vertical", department: "UE VERTICAL" as Department, link: "/ue-vertical" },
      { name: "UE Horizontal", department: "UE HORIZONTAL" as Department, link: "/ue-horizontal" },
    ],
  },
];

/** Grupos de setores de internação — sem o bloco de atendimento. */
export const INPATIENT_SECTOR_GROUPS = SECTOR_NAVIGATION.filter((g) => !g.outOfInpatientScope);

/** Todos os departments alcançáveis pelo menu. */
export const NAVIGABLE_DEPARTMENTS: string[] = SECTOR_NAVIGATION.flatMap((g) =>
  g.sectors.map((s) => s.department as string),
);
