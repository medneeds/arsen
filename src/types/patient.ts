/**
 * Códigos de setor aceitos pelo banco.
 *
 * Espelha a constraint `patients_sector_check`. O tipo é DERIVADO desta lista,
 * de modo que acrescentar um setor num lugar só já propaga tipo e validação.
 *
 * Antes havia um `| string` no fim da união: o TypeScript aceitava qualquer
 * texto como setor, e um código errado só aparecia como violação de constraint
 * em produção — foi assim que `cc_bloco_cirurgico` passou pela revisão. Com a
 * união fechada, o erro passa a ser pego na compilação.
 *
 * Ao acrescentar um setor: incluir aqui, na constraint do banco, em
 * SECTOR_COVERAGE (src/config/sectorCoverage.ts) e em SECTOR_BED_CONFIG
 * (src/utils/bedNaming.ts).
 */
export const SECTOR_TYPES = [
  'red', 'yellow', 'blue', 'outside',
  'ucc', 'neuro_01', 'neuro_02', 'clinica_cirurgica',
  'enfermaria_transicao', 'enfermaria_vascular',
  'sala_vermelha', 'sala_laranja', 'observacao_clinica', 'internacao_ue',
  'ue_vertical', 'ue_horizontal', 'riv',
  'cc_preparo', 'cc_bloco', 'cc_rpa',
] as const;

export type SectorType = typeof SECTOR_TYPES[number];

/**
 * Valida um código vindo de fonte não confiável (localStorage, URL, banco
 * legado). Devolve false para qualquer coisa fora da lista.
 */
export function isSectorType(value: unknown): value is SectorType {
  return typeof value === 'string' && (SECTOR_TYPES as readonly string[]).includes(value);
}

export type MedicalResponsibilityType =
  | 'rotineiro'
  | 'plantonista'
  | 'intercorrencista'
  // Legacy (mantidos para compatibilidade com registros existentes)
  | 'porta'
  | 'lider'
  | 'conjunto'
  | 'obstetra'
  | 'cirurgiao_geral'
  | 'traumatologista'
  | null;

export interface MedicalResponsibility {
  type: MedicalResponsibilityType;
  officeNumber?: string;
  leaderNames?: string;
  portaNames?: string; // Nomes dos médicos porta
  responsibleDoctorId?: string; // ID do médico responsável (rotineiro do setor)
  responsibleDoctorName?: string; // Nome do médico responsável
  responsibleDoctorCrm?: string;
  specialties?: string[]; // Especialidades médicas envolvidas no atendimento
}

export interface Patient {
  id: string;
  bedNumber: string;
  name: string;
  registryId?: string | null; // patient_registry_id — vínculo com o prontuário permanente
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
  // Hospital admission lifecycle: 'pre_admitido' (alocado em leito, aguardando admissão clínica),
  // 'admitido' (admissão hospitalar concluída — D0), 'suspenso' (admissão suspensa),
  // 'alta_dada' (alta médica/administrativa registrada — leito aguardando liberação),
  // 'obito' (óbito registrado — leito aguardando preparo),
  // 'transferencia_interna_pendente' (transferência interna sinalizada — aguardando relocação física),
  // 'transferencia_externa_pendente' (transferência externa sinalizada — leito aguardando liberação)
  admissionStatus?: 'pre_admitido' | 'admitido' | 'suspenso' | 'alta_dada' | 'obito' | 'transferencia_interna_pendente' | 'transferencia_externa_pendente';
  admittedAt?: string | null;
}
