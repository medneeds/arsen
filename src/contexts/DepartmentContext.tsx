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
  "INTERNAÇÃO UE": "internacao_ue",
  "OBSERVAÇÃO CLÍNICA": "observacao_clinica",
  "RIV": "riv",
  "CC PREPARO": "cc_preparo",
  "CC BLOCO CIRÚRGICO": "cc_bloco",
  "CC RPA": "cc_rpa",
};

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
  internacao_ue: "Internação UE",
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
  const [currentDepartment, setCurrentDepartmentState] = useState<Department>("UTI");

  const currentSectorCode = DEPARTMENT_TO_SECTOR[currentDepartment] || "";
  const currentSectorLabel = SECTOR_DISPLAY[currentSectorCode] || currentDepartment;

  const setCurrentDepartment = (department: Department) => {
    setCurrentDepartmentState(department);
    localStorage.setItem(STORAGE_KEY, department);
    // Sync sector code for legacy consumers
    const sectorCode = DEPARTMENT_TO_SECTOR[department];
    if (sectorCode) {
      localStorage.setItem("selected_sector", sectorCode);
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentDepartment);
    const sectorCode = DEPARTMENT_TO_SECTOR[currentDepartment];
    if (sectorCode) {
      localStorage.setItem("selected_sector", sectorCode);
    }
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
  "INTERNAÇÃO UE",
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
