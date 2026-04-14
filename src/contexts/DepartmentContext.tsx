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
  | "OBSERVAÇÃO CLÍNICA"
  | "POSTO INTERNAÇÃO"
  | "CENTRO CIRÚRGICO"
  | "CCIH"
  | "NIR"
  | "NEUROCIRURGIA"
  | "CLÍNICA CIRÚRGICA"
  | "ENFERMARIA DE TRANSIÇÃO"
  | "ENFERMARIA VASCULAR"
  | "RIV";

interface DepartmentContextType {
  currentDepartment: Department;
  setCurrentDepartment: (department: Department) => void;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

const STORAGE_KEY = "selected_department";

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const [currentDepartment, setCurrentDepartmentState] = useState<Department>("UTI");

  const setCurrentDepartment = (department: Department) => {
    setCurrentDepartmentState(department);
    localStorage.setItem(STORAGE_KEY, department);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentDepartment);
  }, [currentDepartment]);

  return (
    <DepartmentContext.Provider value={{ currentDepartment, setCurrentDepartment }}>
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
  "OBSERVAÇÃO CLÍNICA",
  "POSTO INTERNAÇÃO",
  "CENTRO CIRÚRGICO",
  "NEUROCIRURGIA",
  "CLÍNICA CIRÚRGICA",
  "ENFERMARIA DE TRANSIÇÃO",
  "ENFERMARIA VASCULAR",
  "RIV",
  "CCIH",
  "NIR",
];
