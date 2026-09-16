import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type Department = 
  | "URGÊNCIA E EMERGÊNCIA ADULTO"
  | "URGÊNCIA E EMERGÊNCIA PEDIÁTRICA"
  | "UTI"
  | "UTI 1"
  | "UTI 2"
  | "UCI 1"
  | "UCI 2"
  | "UCC"
  | "UE VERTICAL"
  | "UE HORIZONTAL"
  | "SALA VERMELHA"
  | "SALA LARANJA"
  | "INTERNAÇÃO UE"
  | "OBSERVAÇÃO CLÍNICA"
  | "POSTO INTERNAÇÃO"
  | "CC PREPARO"
  | "CC BLOCO CIRÚRGICO"
  | "CC RPA"
  | "CCIH"
  | "NIR"
  | "NEURO 01"
  | "NEURO 02"
  | "CLÍNICA CIRÚRGICA"
  | "ENFERMARIA DE TRANSIÇÃO"
  | "ENFERMARIA VASCULAR"
  | "RIV";

/** Canonical mapping: Department → internal sector code (used by localStorage "selected_sector") */
export const DEPARTMENT_TO_SECTOR: Record<string, string> = {
  "UTI 1": "red",
  "UTI 2": "yellow",
  "UCI 1": "blue",
  "UCI 2": "outside",
  "UCC": "ucc",
  "NEURO 01": "neuro_01",
  "NEURO 02": "neuro_02",
  "CLÍNICA CIRÚRGICA": "clinica_cirurgica",
  "ENFERMARIA DE TRANSIÇÃO": "enfermaria_transicao",
  "ENFERMARIA VASCULAR": "enfermaria_vascular",
  "UE VERTICAL": "ue_vertical",
  "UE HORIZONTAL": "ue_horizontal",
  "SALA VERMELHA": "sala_vermelha",
  "SALA LARANJA": "sala_laranja",
  // O rotulo institucional e "POSTO INTERNAÇÃO" (Direcao Clinica, 19/08/2026);
  // os leitos M01-M14 foram gravados com ele. "INTERNAÇÃO UE" fica como ALIAS
  // do mesmo setor, porque registros antigos carregam esse texto. Ambos apontam
  // para internacao_ue: dois departments para o mesmo setor foi exatamente o que
  // duplicou L08/L31/L32 na UCC.
  "POSTO INTERNAÇÃO": "internacao_ue",
  "INTERNAÇÃO UE": "internacao_ue",
  "OBSERVAÇÃO CLÍNICA": "observacao_clinica",
  "RIV": "riv",
  "CC PREPARO": "cc_preparo",
  "CC BLOCO CIRÚRGICO": "cc_bloco",
  "CC RPA": "cc_rpa",
};

/**
 * Departamento CANONICO de cada setor.
 *
 * O department de uma linha de `patients` e propriedade do LEITO, nao de quem
 * operou a tela. Gravar o departamento do contexto do usuario ao ocupar um
 * leito corrompe o cadastro: e o que deixou linhas de `ucc` com department
 * 'UTI' e de `outside` com 'OUTROS'.
 *
 * Espelha a constraint valid_department. Setores fora do escopo de internacao
 * seguem o departamento historico deles.
 */
export const SECTOR_TO_DEPARTMENT: Record<string, string> = {
  red: "UTI 1",
  yellow: "UTI 2",
  blue: "UCI 1",
  outside: "UCI 2",
  ucc: "UCC",
  neuro_01: "NEURO 01",
  neuro_02: "NEURO 02",
  clinica_cirurgica: "CLÍNICA CIRÚRGICA",
  enfermaria_transicao: "ENFERMARIA DE TRANSIÇÃO",
  enfermaria_vascular: "ENFERMARIA VASCULAR",
  sala_vermelha: "SALA VERMELHA",
  sala_laranja: "SALA LARANJA",
  internacao_ue: "POSTO INTERNAÇÃO",
  cc_preparo: "CC PREPARO",
  cc_bloco: "CC BLOCO CIRÚRGICO",
  cc_rpa: "CC RPA",
  observacao_clinica: "OBSERVAÇÃO CLÍNICA",
  ue_vertical: "UE VERTICAL",
  ue_horizontal: "UE HORIZONTAL",
  riv: "RIV",
};

/**
 * Departamento do setor; cai no departamento informado quando o setor nao e
 * conhecido, para nunca gravar nulo em coluna NOT NULL.
 */
export const departmentForSector = (sector: string | null | undefined, fallback: string): string =>
  (sector && SECTOR_TO_DEPARTMENT[sector]) || fallback;

/** Reverse mapping: sector code → display label */
export const SECTOR_DISPLAY: Record<string, string> = {
  red: "UTI 1",
  yellow: "UTI 2",
  blue: "UCI 1",
  outside: "UCI 2",
  ucc: "UCC",
  neuro_01: "Neuro 01",
  neuro_02: "Neuro 02",
  clinica_cirurgica: "Clínica Cirúrgica",
  enfermaria_transicao: "Enf. Transição",
  enfermaria_vascular: "Enf. Vascular",
  sala_vermelha: "Sala Vermelha",
  sala_laranja: "Sala Laranja",
  observacao_clinica: "Obs. Clínica",
  internacao_ue: "Posto de Internação",
  ue_vertical: "UE Vertical",
  ue_horizontal: "UE Horizontal",
  riv: "RIV",
  cc_preparo: "CC Preparo",
  cc_bloco: "CC Bloco Cirúrgico",
  cc_rpa: "CC RPA",
};

interface DepartmentContextType {
  currentDepartment: Department;
  setCurrentDepartment: (department: Department) => void;
  /** Current sector code (e.g. "red", "ucc") derived from department */
  currentSectorCode: string;
  /** Display label for the current sector */
  currentSectorLabel: string;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

const STORAGE_KEY = "selected_department";

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const [currentDepartment, setCurrentDepartmentState] = useState<Department>(() => {
    // MIGRAÇÃO: NÃO há mais setor padrão "UTI"/"UTI 1" (não existe no banco novo).
    // O padrão é o ÚLTIMO setor selecionado (localStorage); se nunca houve seleção,
    // fica em branco ("") e a UI pede para selecionar.
    if (typeof window === "undefined") return "" as Department;
    const stored = localStorage.getItem(STORAGE_KEY) as Department | null;
    if (stored && DEPARTMENT_TO_SECTOR[stored]) return stored;
    // Recupera pelo sector code salvo separadamente (perfis legados).
    const storedSector = localStorage.getItem("selected_sector");
    if (storedSector) {
      const dept = Object.entries(DEPARTMENT_TO_SECTOR).find(([, v]) => v === storedSector)?.[0] as Department | undefined;
      if (dept) return dept;
      // Setor do banco (ex.: "Amarelo") salvo como código = próprio nome.
      return storedSector as Department;
    }
    // Último recurso: valor salvo cru (nome de setor do banco) ou vazio.
    return (stored ?? "") as Department;
  });

  // MIGRAÇÃO: quando o department não está no taxonômico antigo, ele já É um
  // setor do banco (setor.nome) → usa o próprio nome como "código" para o mapa.
  const currentSectorCode = DEPARTMENT_TO_SECTOR[currentDepartment] || currentDepartment;
  const currentSectorLabel =
    SECTOR_DISPLAY[DEPARTMENT_TO_SECTOR[currentDepartment]] || currentDepartment;

  const setCurrentDepartment = (department: Department) => {
    setCurrentDepartmentState(department);
    localStorage.setItem(STORAGE_KEY, department);
    // Sync sector code: código legado quando existir, senão o próprio nome do setor.
    localStorage.setItem("selected_sector", DEPARTMENT_TO_SECTOR[department] || department);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentDepartment);
    localStorage.setItem("selected_sector", DEPARTMENT_TO_SECTOR[currentDepartment] || currentDepartment);
  }, [currentDepartment]);

  return (
    <DepartmentContext.Provider value={{ currentDepartment, setCurrentDepartment, currentSectorCode, currentSectorLabel }}>
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartment() {
  const context = useContext(DepartmentContext);
  if (context === undefined) {
    throw new Error("useDepartment must be used within a DepartmentProvider");
  }
  return context;
}

export const DEPARTMENTS: Department[] = [
  "URGÊNCIA E EMERGÊNCIA ADULTO",
  "URGÊNCIA E EMERGÊNCIA PEDIÁTRICA",
  "UTI 1",
  "UTI 2",
  "UCI 1",
  "UCI 2",
  "UCC",
  "UE VERTICAL",
  "UE HORIZONTAL",
  "SALA VERMELHA",
  "SALA LARANJA",
  "POSTO INTERNAÇÃO",
  "OBSERVAÇÃO CLÍNICA",
  "CC PREPARO",
  "CC BLOCO CIRÚRGICO",
  "CC RPA",
  "NEURO 01",
  "NEURO 02",
  "CLÍNICA CIRÚRGICA",
  "ENFERMARIA DE TRANSIÇÃO",
  "ENFERMARIA VASCULAR",
  "RIV",
  "CCIH",
  "NIR",
];
