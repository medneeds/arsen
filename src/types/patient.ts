export type SectorType = 'red' | 'yellow' | 'blue' | 'outside' | 'sala_vermelha' | 'sala_laranja' | 'ue_vertical' | 'ue_horizontal';

export type MedicalResponsibilityType = 'porta' | 'lider' | 'conjunto' | 'obstetra' | 'cirurgiao_geral' | 'traumatologista' | null;

export interface MedicalResponsibility {
  type: MedicalResponsibilityType;
  officeNumber?: string;
  leaderNames?: string;
  portaNames?: string; // Nomes dos médicos porta
}

export interface Patient {
  id: string;
  bedNumber: string;
  name: string;
  age: string | number;
  sector: SectorType;
  diagnoses: string[];
  medicalHistory: string[];
  relevantExams: string[];
  pendencies: string[];
  highlightedPendencies?: number[]; // Índices dos itens destacados em Programações/Pendências
  highlightedDiagnoses?: number[]; // Índices dos itens destacados em Hipóteses/Diagnósticos
  highlightedMedicalHistory?: number[]; // Índices dos itens destacados em Antecedentes/Comorbidades
  highlightedConducts?: number[]; // Índices dos itens destacados em Plano Terapêutico
  schedule: string[];
  admissionHistory: string;
  admissionDate: string;
  medicalResponsibility?: MedicalResponsibility;
  displayOrder?: number; // For persisting patient order in sectors
  createdBy?: string; // User ID who created the patient
  // Internment status fields
  internmentStatus?: 'SOLICITACAO_PENDENTE' | 'PSM_FAVORAVEL' | 'AGUARDANDO_VAGA' | 'IR_PARA_UTI' | 'IR_PARA_ENFERMARIA' | null;
  internmentNotes?: string | null;
  // Door patient fields
  isDoorPatient?: boolean;
  allocationStatus?: 'pending' | 'approved' | 'discussing' | 'rejected' | null;
  // UTI-specific fields
  utiAdmissionDate?: string[];
  utiDischargePrediction?: string[];
  utiAllergies?: string[];
  utiAdmissionReason?: string[];
  utiCurrentStatus?: string[];
  utiDevices?: string[];
  utiCulturesAntibiotics?: string[];
  utiSpecialties?: string[];
  utiOriginSector?: string[];
  utiDailyConducts?: string[]; // Condutas instituídas do dia na UTI
  // PSM (Parecer de Solicitação Médica) status
  psmStatus?: 'favoravel' | 'aguardando' | 'desfavoravel' | null;
  // Clinical status for UTI patients
  clinicalStatus?: 'gravissimo' | 'grave' | 'grave_estavel' | 'potencialmente_grave' | 'regular' | 'paliativado' | null;
  // UTI bed vacancy status
  isVacant?: boolean;
}
