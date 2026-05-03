import { useState, useMemo, useEffect, useCallback } from "react";
import { usePatients } from "@/hooks/usePatients";
import { useDepartment } from "@/contexts/DepartmentContext";
import { Patient } from "@/types/patient";
import { differenceInDays, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Filter, FileText, Pill, Activity, ClipboardList, FolderOpen, User, Calendar, Clock, Stethoscope, Heart, TrendingUp, AlertTriangle, TestTubes, Syringe, Shield, Thermometer, Pencil, Check, X, ClipboardCheck, Plus, LogOut, History } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ClinicalNavTabs } from "@/components/ClinicalNavTabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PatientCockpit } from "@/components/PatientCockpit";

const parseTextArray = (input: string | string[] | undefined | null): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(item => item && item.trim());
  return input.split('\n').filter(item => item && item.trim());
};

const clinicalStatusLabels: Record<string, { label: string; color: string }> = {
  gravissimo: { label: "Gravíssimo", color: "bg-red-600 text-white" },
  grave: { label: "Grave", color: "bg-red-500 text-white" },
  grave_estavel: { label: "Grave estável", color: "bg-orange-500 text-white" },
  potencialmente_grave: { label: "Potencialmente grave", color: "bg-amber-500 text-white" },
  regular: { label: "Regular", color: "bg-blue-500 text-white" },
  paliativado: { label: "Paliativado", color: "bg-purple-500 text-white" },
};

const formatStayDuration = (admissionDate: string): string => {
  if (!admissionDate) return "—";
  try {
    const date = parseISO(admissionDate);
    if (isNaN(date.getTime())) return "—";
    return formatDistanceToNow(date, { locale: ptBR, addSuffix: false });
  } catch {
    return "—";
  }
};

// Helpers
const calcDaysInternment = (admissionDate: string): number | null => {
  if (!admissionDate) return null;
  try {
    const date = parseISO(admissionDate);
    if (isNaN(date.getTime())) return null;
    return differenceInDays(new Date(), date);
  } catch {
    return null;
  }
};

const getSectorLabel = (sector: string) => {
  const map: Record<string, string> = { red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2", ucc: "UCC" };
  return map[sector] || sector;
};

const getSectorColor = (sector: string) => {
  const map: Record<string, string> = {
    red: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200",
    yellow: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200",
    outside: "bg-muted text-muted-foreground border-border",
    ucc: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200",
  };
  return map[sector] || "";
};

const getResponsibleDoctor = (patient: Patient): string => {
  const mr = patient.medicalResponsibility;
  if (!mr) return "—";
  if (mr.leaderNames) return mr.leaderNames;
  if (mr.portaNames) return mr.portaNames;
  if (mr.type) {
    const types: Record<string, string> = {
      lider: "Líder", porta: "Porta", conjunto: "Conjunto",
      obstetra: "Obstetra", cirurgiao_geral: "Cirurgião Geral", traumatologista: "Traumatologista",
    };
    return types[mr.type] || mr.type;
  }
  return "—";
};

const getPrescriptionStatus = (patient: Patient): { label: string; variant: "default" | "secondary" | "outline" | "destructive"; dotColor: string; pulsing: boolean } => {
  const scheduleItems = parseTextArray(patient.schedule);
  if (scheduleItems.length > 0) {
    return { label: "Validada", variant: "default", dotColor: "bg-emerald-500", pulsing: false };
  }
  return { label: "Pendente", variant: "secondary", dotColor: "bg-amber-500", pulsing: true };
};

const getDischargeText = (patient: Patient): string => {
  const predictions = parseTextArray(patient.utiDischargePrediction);
  if (predictions.length > 0) {
    return predictions[0];
  }
  return "Sem previsão";
};

// Documents list
const DOCUMENTS = [
  { group: "Hemoderivados", items: [
    { name: "Ato Transfusional", path: "/documents/hemoderivados/hemoc-ato-sadt.pdf" },
    { name: "Hemoconcentrados SADT", path: "/documents/hemoderivados/hemoc-concentrados-sadt.pdf" },
    { name: "Exames SADT", path: "/documents/hemoderivados/hemoc-exames-sadt.pdf" },
    { name: "Solicitação Hemoconcentrados", path: "/documents/hemoderivados/solicitacao-hemoconcentrados.pdf" },
    { name: "Termo Hemotransfusão", path: "/documents/hemoderivados/termo-esclarecimento-hemotransfusao.pdf" },
  ]},
  { group: "OPME", items: [
    { name: "Angiografia Cerebral", path: "/documents/opme/angiografia-cerebral.doc" },
    { name: "ATC/CATE", path: "/documents/opme/atc-cate.doc" },
    { name: "Cateterismo", path: "/documents/opme/cateterismo.doc" },
    { name: "Gastrostomia", path: "/documents/opme/gastrostomia-endoscopica.doc" },
    { name: "Implante Permcath", path: "/documents/opme/implante-permcath.odt" },
    { name: "Trombectomia Mecânica", path: "/documents/opme/trombectomia-mecanica.doc" },
  ]},
  { group: "SADT", items: [
    { name: "Guia SP/SADT", path: "/documents/sadt/hapvida-guia-sp-sadt.pdf" },
    { name: "Guia SP/SADT Paisagem", path: "/documents/sadt/hapvida-guia-sp-sadt-paisagem.pdf" },
  ]},
  { group: "Tomografias", items: [
    { name: "Ficha Acompanhamento TC", path: "/documents/tomografias/ficha-acompanhamento-tc.pdf" },
    { name: "Termo Consentimento TC", path: "/documents/tomografias/termo-consentimento-tc.pdf" },
    { name: "Termo Gestante", path: "/documents/tomografias/termo-consentimento-gestante.pdf" },
  ]},
  { group: "Protocolos", items: [
    { name: "Protocolo Sepse Adulto", path: "/documents/protocolo-sepse-adulto.pdf" },
    { name: "Controle Glicêmico", path: "/documents/protocolo-controle-glicemico.pdf" },
    { name: "Termo Cuidados Paliativos", path: "/documents/termo-cuidados-paliativos.docx" },
  ]},
  { group: "Regulações SUS", items: [
    { name: "Modelo Anamnese Regulação", path: "/documents/regulacoes-sus/modelo-anamnese-regulacao.pdf" },
  ]},
  { group: "Alto Custo", items: [
    { name: "Alteplase AVEI", path: "/documents/alto-custo/alteplase-avei.odt" },
    { name: "Ciclofosfamida", path: "/documents/alto-custo/ciclofosfamida.odt" },
    { name: "Ertapenem", path: "/documents/alto-custo/ertapenem.odt" },
    { name: "Imunoglobulina Humana", path: "/documents/alto-custo/imunoglobulina-humana.odt" },
    { name: "Teicoplanina", path: "/documents/alto-custo/teicoplanina.odt" },
  ]},
];

// Mock UTI 1 patients (L01-L08)
const MOCK_UTI1_PATIENTS: Patient[] = [
  {
    id: "uti1-01", bedNumber: "L01", name: "Carlos Eduardo Machado", age: "67", sector: "red",
    diagnoses: ["Choque séptico foco abdominal", "Peritonite secundária"], medicalHistory: ["HAS", "DM2", "Colecistectomia prévia"],
    relevantExams: ["Lactato 5.2", "PCT 18.4", "Hemocultura: E. coli ESBL"],
    pendencies: ["Ajuste ATB conforme antibiograma", "Avaliação cirúrgica para reabordagem"], schedule: ["Gasometria 4/4h", "Controle lactato 6h"],
    admissionHistory: "Admitido por quadro de abdome agudo perfurativo, submetido a laparotomia exploradora.", admissionDate: "2026-03-10T08:30:00",
    clinicalStatus: "gravissimo", medicalResponsibility: { type: "lider", leaderNames: "Dr. Fernando Almeida" },
    utiDischargePrediction: ["Sem previsão"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti1-02", bedNumber: "L02", name: "Josefa Maria Lopes", age: "73", sector: "red",
    diagnoses: ["SDRA grave", "Pneumonia aspirativa"], medicalHistory: ["Alzheimer avançado", "Disfagia"],
    relevantExams: ["PaO2/FiO2 = 95", "TC tórax: vidro fosco bilateral", "Hb 10.1"],
    pendencies: ["Avaliação fonoaudiologia", "Discutir limitação terapêutica com família"], schedule: ["Pronação 16h", "Gasometria 2/2h"],
    admissionHistory: "Trazida por familiares após episódio de broncoaspiração maciça.", admissionDate: "2026-03-12T14:00:00",
    clinicalStatus: "gravissimo", medicalResponsibility: { type: "lider", leaderNames: "Dra. Mariana Costa" },
    utiDischargePrediction: ["Sem previsão"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti1-03", bedNumber: "L03", name: "Antônio Marcos Vieira", age: "55", sector: "red",
    diagnoses: ["TCE grave", "Hematoma subdural agudo operado"], medicalHistory: ["Etilismo crônico"],
    relevantExams: ["Glasgow 8T", "TC crânio PO: sem ressangramento", "Na+ 152"],
    pendencies: ["Correção hipernatremia", "PIC monitoring"], schedule: ["TC crânio controle 48h", "Controle Na+ 6/6h"],
    admissionHistory: "Vítima de queda de própria altura em uso de álcool. Glasgow 6 na admissão.", admissionDate: "2026-03-14T22:45:00",
    clinicalStatus: "grave", medicalResponsibility: { type: "lider", leaderNames: "Dr. Paulo Sérgio" },
    utiDischargePrediction: ["Sem previsão"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti1-04", bedNumber: "L04", name: "Rita de Cássia Ferreira", age: "41", sector: "red",
    diagnoses: ["Tromboembolia pulmonar maciça", "Cor pulmonale agudo"], medicalHistory: ["Obesidade grau III", "Uso de ACO"],
    relevantExams: ["AngioTC: TEP bilateral", "Troponina 3.200", "BNP 5.800", "FEVE 35%"],
    pendencies: ["Avaliação para trombólise sistêmica", "Ecocardiograma controle"], schedule: ["Heparina BIC", "Monitorização contínua"],
    admissionHistory: "Dispneia súbita e síncope no domicílio. Hipotensa na chegada ao PS.", admissionDate: "2026-03-16T11:20:00",
    clinicalStatus: "gravissimo", medicalResponsibility: { type: "lider", leaderNames: "Dra. Luciana Prado" },
    utiDischargePrediction: ["7-10 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti1-05", bedNumber: "L05", name: "João Batista Sousa Neto", age: "62", sector: "red",
    diagnoses: ["Estado de mal epiléptico", "Encefalopatia pós-anóxica"], medicalHistory: ["Epilepsia refratária", "AVC prévio"],
    relevantExams: ["EEG: atividade epileptiforme contínua", "Glasgow 3T", "RM crânio: encefalopatia difusa"],
    pendencies: ["Ajuste anticonvulsivantes", "Avaliação neurologia"], schedule: ["EEG contínuo", "Controle glicemia 4/4h"],
    admissionHistory: "Encontrado em estado de mal epiléptico no domicílio. Duração estimada > 30 min.", admissionDate: "2026-03-15T06:00:00",
    clinicalStatus: "gravissimo", medicalResponsibility: { type: "lider", leaderNames: "Dr. Rodrigo Mendes" },
    utiDischargePrediction: ["Sem previsão"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
];

// Mock UTI 2 patients for demo (L09-L18)
const MOCK_UTI2_PATIENTS: Patient[] = [
  {
    id: "uti2-01", bedNumber: "L09", name: "Iglesio Ferreira da Silva", age: "26", sector: "yellow",
    diagnoses: ["Politrauma", "Fratura de fêmur bilateral"], medicalHistory: ["Hígido previamente"],
    relevantExams: ["TC tórax: contusão pulmonar", "Hb 8.2", "Lactato 4.1"],
    pendencies: ["Parecer ortopedia", "Hemotransfusão 2 CH"], schedule: ["Reavaliação cirurgia 14h", "Controle Hb 6h"],
    admissionHistory: "Vítima de acidente motociclístico em alta velocidade. Glasgow 15 na cena.", admissionDate: "2025-10-30T14:20:00",
    clinicalStatus: "grave", medicalResponsibility: { type: "lider", leaderNames: "Dr. Marcos Antônio" },
    utiDischargePrediction: ["Sem previsão"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti2-02", bedNumber: "L10", name: "Ana Carolina Mendes Ribeiro", age: "54", sector: "yellow",
    diagnoses: ["Sepse foco pulmonar", "SDRA moderada"], medicalHistory: ["DPOC", "Tabagismo 30 maços-ano"],
    relevantExams: ["PaO2/FiO2 = 180", "PCT 12.5", "Hemocultura: S. pneumoniae"],
    pendencies: ["Ajuste ATB conforme cultura", "Desmame VM"], schedule: ["Gasometria 4/4h", "Pronação 16h"],
    admissionHistory: "Admitida por pneumonia comunitária grave evoluindo com choque séptico.", admissionDate: "2025-11-01T08:00:00",
    clinicalStatus: "gravissimo", medicalResponsibility: { type: "lider", leaderNames: "Dra. Juliana Costa" },
    utiDischargePrediction: ["7-10 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti2-03", bedNumber: "L11", name: "Francisco das Chagas Oliveira", age: "71", sector: "yellow",
    diagnoses: ["IAM com supra ST anterior extenso", "Choque cardiogênico"], medicalHistory: ["HAS", "DM2", "ICC CF III"],
    relevantExams: ["Troponina 15.800", "FEVE 22%", "BIA implantado"],
    pendencies: ["Avaliação hemodinâmica", "Parecer cardiocirurgia"], schedule: ["Ecocardiograma controle", "Monitorizar DC"],
    admissionHistory: "Dor torácica típica há 4h. IAMCSST anterior extenso. ATC primária com stent em DA.", admissionDate: "2025-11-05T22:10:00",
    clinicalStatus: "gravissimo", medicalResponsibility: { type: "lider", leaderNames: "Dr. Ricardo Souza" },
    utiDischargePrediction: ["Sem previsão"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti2-04", bedNumber: "L12", name: "Tereza Cristina Barros", age: "63", sector: "yellow",
    diagnoses: ["Pós-operatório craniotomia", "Meningioma frontal ressecado"], medicalHistory: ["Hipertireoidismo controlado"],
    relevantExams: ["TC crânio PO: sem sangramento", "Glasgow 14", "Pupilas isocóricas"],
    pendencies: ["Desmame sedação", "Avaliação fonoaudiologia"], schedule: ["TC crânio controle 48h", "Fisioterapia motora"],
    admissionHistory: "Submetida a craniotomia para ressecção de meningioma frontal esquerdo.", admissionDate: "2025-11-08T16:30:00",
    clinicalStatus: "grave_estavel", medicalResponsibility: { type: "lider", leaderNames: "Dr. Alexandre Nunes" },
    utiDischargePrediction: ["3-5 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti2-05", bedNumber: "L13", name: "Raimundo Nonato Pereira", age: "58", sector: "yellow",
    diagnoses: ["Pancreatite aguda grave", "Necrose pancreática infectada"], medicalHistory: ["Etilismo crônico", "Litíase biliar"],
    relevantExams: ["TC abdome: necrose >50%", "PCR 280", "Ranson 5"],
    pendencies: ["Programar drenagem percutânea", "Suporte nutricional enteral"], schedule: ["TC abdome controle", "Parecer cirurgia"],
    admissionHistory: "Quadro de dor abdominal epigástrica em faixa há 5 dias, evoluindo com instabilidade hemodinâmica.", admissionDate: "2025-11-03T10:45:00",
    clinicalStatus: "grave", medicalResponsibility: { type: "lider", leaderNames: "Dra. Patrícia Lima" },
    utiDischargePrediction: ["14+ dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti2-06", bedNumber: "L14", name: "Maria do Socorro Santos", age: "45", sector: "yellow",
    diagnoses: ["Lúpus eritematoso sistêmico", "Nefrite lúpica classe IV", "Hemorragia alveolar"], medicalHistory: ["LES diagnosticado há 10 anos"],
    relevantExams: ["Cr 3.8", "Anti-dsDNA 1:640", "C3/C4 baixos", "Broncoscopia: hemorragia alveolar"],
    pendencies: ["Pulsoterapia ciclofosfamida D3", "Plasmaférese programada"], schedule: ["Controle renal diário", "Hemodiálise seg/qua/sex"],
    admissionHistory: "Paciente com LES em atividade, admitida por dispneia e hemoptise maciça.", admissionDate: "2025-11-06T07:00:00",
    clinicalStatus: "grave", medicalResponsibility: { type: "lider", leaderNames: "Dr. Felipe Arraes" },
    utiDischargePrediction: ["10-14 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti2-07", bedNumber: "L15", name: "José Antônio Rodrigues Lima", age: "82", sector: "yellow",
    diagnoses: ["AVCi extenso em ACM direita", "Transformação hemorrágica"], medicalHistory: ["FA crônica sem anticoagulação", "HAS", "DM2"],
    relevantExams: ["TC crânio: AVCi extenso + petéquias", "NIHSS 18", "Glasgow 10"],
    pendencies: ["Avaliação neurocirurgia", "Monitorizar PIC"], schedule: ["TC crânio controle 24h", "Fisioterapia respiratória"],
    admissionHistory: "Encontrado em casa com hemiplegia esquerda e rebaixamento de consciência.", admissionDate: "2025-11-09T03:15:00",
    clinicalStatus: "gravissimo", medicalResponsibility: { type: "lider", leaderNames: "Dra. Camila Torres" },
    utiDischargePrediction: ["Sem previsão"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti2-08", bedNumber: "L16", name: "Antônia Beatriz Carvalho", age: "37", sector: "yellow",
    diagnoses: ["Cetoacidose diabética grave", "DM tipo 1"], medicalHistory: ["DM1 desde os 12 anos", "Má adesão"],
    relevantExams: ["Glicemia 580", "pH 7.05", "HCO3 6", "K+ 6.2"],
    pendencies: ["BIC venoso seriado", "Ajuste insulina conforme protocolo"], schedule: ["Glicemia capilar 1/1h", "Gasometria 2/2h"],
    admissionHistory: "Admitida com quadro de polidipsia, poliúria e vômitos há 3 dias.", admissionDate: "2025-11-11T19:30:00",
    clinicalStatus: "grave_estavel", medicalResponsibility: { type: "lider", leaderNames: "Dr. André Luís" },
    utiDischargePrediction: ["2-3 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti2-09", bedNumber: "L17", name: "Pedro Henrique Nascimento", age: "49", sector: "yellow",
    diagnoses: ["Pós-PCR", "Protocolo hipotermia terapêutica"], medicalHistory: ["Doença coronariana", "Stent prévio em DA"],
    relevantExams: ["ECG: ritmo sinusal pós-cardioversão", "Troponina 8.500", "Lactato 6.8"],
    pendencies: ["Manter hipotermia 32-34°C por 24h", "Avaliação neurológica após reaquecimento"],
    schedule: ["Controle temperatura horário", "EEG contínuo", "Reaquecer às 08h amanhã"],
    admissionHistory: "PCR em FV testemunhada no domicílio. RCE após 12 min de RCP.", admissionDate: "2025-11-11T06:45:00",
    clinicalStatus: "gravissimo", medicalResponsibility: { type: "lider", leaderNames: "Dra. Renata Melo" },
    utiDischargePrediction: ["Sem previsão"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uti2-10", bedNumber: "L18", name: "Luciana Gabriela Fonseca", age: "33", sector: "yellow",
    diagnoses: ["Eclâmpsia", "HELLP síndrome", "Pós-cesárea de emergência"], medicalHistory: ["Pré-eclâmpsia gestação anterior"],
    relevantExams: ["Plaquetas 42.000", "TGO 890", "LDH 1.200", "Cr 2.1"],
    pendencies: ["Sulfato de magnésio 24h", "Controle plaquetário 6/6h", "Parecer hematologia"],
    schedule: ["Controle PA 1/1h", "Diurese horária", "Hemograma controle 12h"],
    admissionHistory: "Gestante 34 sem, admitida com convulsão tônico-clônica e PA 200x130.", admissionDate: "2025-11-10T22:00:00",
    clinicalStatus: "grave", medicalResponsibility: { type: "lider", leaderNames: "Dr. Bruno Cavalcante" },
    utiDischargePrediction: ["5-7 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
];

// Mock UCI 1 patients (L19-L26)
const MOCK_UCI1_PATIENTS: Patient[] = [
  {
    id: "uci1-01", bedNumber: "L19", name: "Sebastião Alves da Cruz", age: "74", sector: "blue",
    diagnoses: ["Pós-operatório revascularização miocárdica", "DAC triarterial"], medicalHistory: ["HAS", "DM2", "Dislipidemia"],
    relevantExams: ["ECG: ritmo sinusal", "Hb 9.8", "Cr 1.4"],
    pendencies: ["Fisioterapia respiratória intensiva", "Controle glicêmico"], schedule: ["RX tórax controle", "Deambulação assistida"],
    admissionHistory: "PO D3 de CRM x3 sem intercorrências. Estável para step-down.", admissionDate: "2026-03-13T10:00:00",
    clinicalStatus: "grave_estavel", medicalResponsibility: { type: "lider", leaderNames: "Dr. Henrique Bastos" },
    utiDischargePrediction: ["3-4 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uci1-02", bedNumber: "L20", name: "Francisca Soares Lima", age: "68", sector: "blue",
    diagnoses: ["ICC descompensada", "FA de alta resposta"], medicalHistory: ["Valvopatia mitral reumática", "HAS"],
    relevantExams: ["BNP 2.800", "FEVE 38%", "RX: congestão pulmonar"],
    pendencies: ["Otimizar diuréticos", "Controle frequência cardíaca"], schedule: ["Balanço hídrico rigoroso", "ECG controle"],
    admissionHistory: "Dispneia progressiva há 7 dias com ortopneia e edema de MMII.", admissionDate: "2026-03-15T16:30:00",
    clinicalStatus: "potencialmente_grave", medicalResponsibility: { type: "lider", leaderNames: "Dra. Cristina Rocha" },
    utiDischargePrediction: ["5-7 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uci1-03", bedNumber: "L21", name: "Manuel Ribeiro dos Santos", age: "59", sector: "blue",
    diagnoses: ["Pneumonia comunitária grave", "Derrame pleural volumoso drenado"], medicalHistory: ["DPOC Gold III", "Ex-tabagista"],
    relevantExams: ["Líquido pleural: exsudato", "PCT 4.2", "Hb 11.5"],
    pendencies: ["Controle débito dreno", "Fisioterapia respiratória"], schedule: ["RX tórax pós-drenagem", "ATB D7"],
    admissionHistory: "Internado por pneumonia com derrame pleural volumoso à direita.", admissionDate: "2026-03-11T09:15:00",
    clinicalStatus: "regular", medicalResponsibility: { type: "lider", leaderNames: "Dr. Augusto Pereira" },
    utiDischargePrediction: ["2-3 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uci1-04", bedNumber: "L22", name: "Conceição Aparecida Moura", age: "81", sector: "blue",
    diagnoses: ["Fratura de fêmur proximal operada", "Delirium pós-operatório"], medicalHistory: ["Osteoporose", "HAS", "Demência leve"],
    relevantExams: ["Hb 8.9", "Cr 1.1", "Na+ 134"],
    pendencies: ["Manejo de delirium", "Profilaxia TVP", "Parecer geriatria"], schedule: ["Fisioterapia motora", "Controle dor"],
    admissionHistory: "Queda da própria altura. PO D2 de osteossíntese de fêmur.", admissionDate: "2026-03-16T20:00:00",
    clinicalStatus: "potencialmente_grave", medicalResponsibility: { type: "lider", leaderNames: "Dra. Ana Beatriz" },
    utiDischargePrediction: ["4-5 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
];

// Mock UCI 2 patients (L27-L34)
const MOCK_UCI2_PATIENTS: Patient[] = [
  {
    id: "uci2-01", bedNumber: "L27", name: "Domingos Sávio Carvalho", age: "52", sector: "outside",
    diagnoses: ["Pielonefrite complicada", "IRA pré-renal em resolução"], medicalHistory: ["DM2", "Litíase renal recorrente"],
    relevantExams: ["Cr 2.8 (era 4.5)", "Urocultura: E. coli sensível", "USG: hidronefrose leve"],
    pendencies: ["Controle função renal", "Avaliação urologia"], schedule: ["ATB EV D10", "Hidratação vigorosa"],
    admissionHistory: "Febre alta e dor lombar direita há 5 dias. IRA na admissão.", admissionDate: "2026-03-08T12:00:00",
    clinicalStatus: "regular", medicalResponsibility: { type: "lider", leaderNames: "Dr. Marcos Tavares" },
    utiDischargePrediction: ["2-3 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uci2-02", bedNumber: "L28", name: "Maria Nazaré Oliveira", age: "78", sector: "outside",
    diagnoses: ["AVCi lacunar", "HAS mal controlada"], medicalHistory: ["HAS", "DM2", "Dislipidemia", "AVCi prévio"],
    relevantExams: ["TC crânio: lacunas talâmicas", "NIHSS 4", "Glasgow 15"],
    pendencies: ["Ajuste anti-hipertensivos", "Fonoaudiologia para disfagia leve"], schedule: ["Fisioterapia neuro", "Controle PA 4/4h"],
    admissionHistory: "Disartria e hemiparesia direita sutil de início há 12h.", admissionDate: "2026-03-17T07:30:00",
    clinicalStatus: "potencialmente_grave", medicalResponsibility: { type: "lider", leaderNames: "Dra. Patrícia Nogueira" },
    utiDischargePrediction: ["3-5 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
  {
    id: "uci2-03", bedNumber: "L29", name: "Raimunda Ferreira Costa", age: "65", sector: "outside",
    diagnoses: ["DPOC exacerbado", "Insuficiência respiratória hipercápnica"], medicalHistory: ["DPOC Gold IV", "Cor pulmonale", "Tabagismo 45 maços-ano"],
    relevantExams: ["Gasometria: pH 7.32, pCO2 58", "RX: hiperinsuflação", "BNP 450"],
    pendencies: ["Desmame VNI", "Otimizar broncodilatadores"], schedule: ["Gasometria 8/8h", "Fisioterapia respiratória 3x/dia"],
    admissionHistory: "Piora progressiva da dispneia há 3 dias após IVAS.", admissionDate: "2026-03-14T18:00:00",
    clinicalStatus: "grave_estavel", medicalResponsibility: { type: "lider", leaderNames: "Dr. Leonardo Barros" },
    utiDischargePrediction: ["3-4 dias"], isVacant: false,
    highlightedDiagnoses: [], highlightedMedicalHistory: [], highlightedPendencies: [], highlightedConducts: [],
  },
];

// All mock patients combined
const ALL_MOCK_PATIENTS: Patient[] = [
  ...MOCK_UTI1_PATIENTS,
  ...MOCK_UTI2_PATIENTS,
  ...MOCK_UCI1_PATIENTS,
  ...MOCK_UCI2_PATIENTS,
];

// Mock prescription data per patient
const MOCK_PRESCRIPTIONS: Record<string, Array<{ category: string; items: Array<{ name: string; dose: string; route: string; frequency: string; notes?: string }> }>> = {
  "uti2-01": [
    { category: "Analgesia", items: [
      { name: "Dipirona 1g", dose: "1g", route: "EV", frequency: "6/6h", notes: "Diluir em 100ml SF 0,9%" },
      { name: "Tramadol 100mg", dose: "100mg", route: "EV", frequency: "8/8h", notes: "Infundir em 30 min" },
    ]},
    { category: "Antibiótico", items: [
      { name: "Ceftriaxona 2g", dose: "2g", route: "EV", frequency: "12/12h" },
    ]},
    { category: "Profilaxia", items: [
      { name: "Enoxaparina 40mg", dose: "40mg", route: "SC", frequency: "1x/dia" },
      { name: "Omeprazol 40mg", dose: "40mg", route: "EV", frequency: "1x/dia" },
    ]},
  ],
  "uti2-02": [
    { category: "Antibiótico", items: [
      { name: "Meropenem 1g", dose: "1g", route: "EV", frequency: "8/8h", notes: "Infusão estendida 3h" },
      { name: "Vancomicina 1g", dose: "1g", route: "EV", frequency: "12/12h", notes: "Monitorar vancocinemia" },
    ]},
    { category: "Sedação", items: [
      { name: "Midazolam", dose: "5mg/h", route: "BIC", frequency: "Contínuo" },
      { name: "Fentanil", dose: "100mcg/h", route: "BIC", frequency: "Contínuo" },
    ]},
    { category: "Suporte", items: [
      { name: "Noradrenalina", dose: "0.3mcg/kg/min", route: "BIC", frequency: "Contínuo", notes: "Titular para PAM >65" },
    ]},
  ],
  "uti2-03": [
    { category: "Cardiovascular", items: [
      { name: "Dobutamina", dose: "10mcg/kg/min", route: "BIC", frequency: "Contínuo", notes: "Titular conforme DC" },
      { name: "AAS 100mg", dose: "100mg", route: "VO/SNE", frequency: "1x/dia" },
      { name: "Clopidogrel 75mg", dose: "75mg", route: "VO/SNE", frequency: "1x/dia" },
    ]},
    { category: "Anticoagulação", items: [
      { name: "Heparina não fracionada", dose: "1.000UI/h", route: "BIC", frequency: "Contínuo", notes: "Controle TTPa 6/6h" },
    ]},
  ],
};

// Mock evolution data per patient
const MOCK_EVOLUTIONS: Record<string, Array<{ date: string; author: string; content: string; type: string }>> = {
  "uti2-01": [
    { date: "2025-11-11 07:00", author: "Dr. Marcos Antônio", type: "Evolução Médica", content: "Paciente estável hemodinamicamente. Dor controlada com analgesia atual. Aguardando parecer da ortopedia para programação cirúrgica de fixação de fêmur bilateral. Ferida operatória limpa. Diurese satisfatória. Plano: manter analgesia, solicitar pré-operatório." },
    { date: "2025-11-10 19:00", author: "Dra. Fernanda Reis", type: "Evolução Médica", content: "Admitido na UTI procedente do bloco cirúrgico. Politrauma com fratura de fêmur bilateral. Estabilizado com fixador externo. Recebeu 2 CH. Hb pós-transfusão 9.1. Vigil, orientado. Sem sinais de sangramento ativo." },
  ],
  "uti2-02": [
    { date: "2025-11-11 07:00", author: "Dra. Juliana Costa", type: "Evolução Médica", content: "Paciente em VM modo PCV, FiO2 60%, PEEP 12. P/F ratio melhorou para 200 após sessão de prona de 16h. Noradrenalina em desmame (0.15mcg/kg/min). Hemocultura com S. pneumoniae sensível a ceftriaxona — considerar descalonamento. Diurese 0.8ml/kg/h." },
    { date: "2025-11-10 19:00", author: "Dr. Paulo Henrique", type: "Evolução Médica", content: "Paciente mantém quadro de SDRA moderada. Iniciada pronação às 16h conforme protocolo. Noradrenalina estável em 0.3mcg/kg/min. Lactato em queda: 3.2 → 2.1. Mantidos ATB de amplo espectro até resultado de culturas." },
  ],
  "uti2-03": [
    { date: "2025-11-11 07:00", author: "Dr. Ricardo Souza", type: "Evolução Médica", content: "Paciente em choque cardiogênico refratário. BIA em funcionamento. Dobutamina 10mcg/kg/min. PA 90x60 com suporte. FEVE estimada 22% ao eco beira-leito. Débito cardíaco 3.2L/min. Programado cateterismo de revisão. Discussão com equipe de cardiocirurgia sobre indicação de ECMO." },
  ],
};

// Mock exam requisitions per patient
const MOCK_REQUISITIONS: Record<string, Array<{ date: string; category: string; status: string; items: string[]; requestedBy: string; results?: string }>> = {
  "uti2-01": [
    { date: "2025-11-11 06:00", category: "Laboratório", status: "Resultado disponível", requestedBy: "Dr. Marcos Antônio", items: ["Hemograma completo", "Coagulograma", "Função renal", "Eletrólitos"], results: "Hb 9.1 | Leuco 12.400 | Plaq 198.000 | Cr 0.9 | Na 138 | K 4.2" },
    { date: "2025-11-11 08:00", category: "Imagem", status: "Solicitado", requestedBy: "Dr. Marcos Antônio", items: ["RX tórax AP leito", "RX pelve AP"] },
    { date: "2025-11-10 20:00", category: "Parecer", status: "Respondido", requestedBy: "Dr. Marcos Antônio", items: ["Parecer Ortopedia"], results: "Programar fixação interna fêmur bilateral em 48-72h após estabilização clínica. Manter fixador externo." },
  ],
  "uti2-02": [
    { date: "2025-11-11 04:00", category: "Laboratório", status: "Resultado disponível", requestedBy: "Dra. Juliana Costa", items: ["Gasometria arterial", "Lactato", "Procalcitonina", "Hemograma"], results: "pH 7.32 | PaO2 85 | PaCO2 38 | HCO3 19 | Lactato 2.1 | PCT 8.3" },
    { date: "2025-11-11 06:00", category: "Laboratório", status: "Em processamento", requestedBy: "Dra. Juliana Costa", items: ["Vancocinemia vale", "Função hepática", "PCR"] },
    { date: "2025-11-10 22:00", category: "Imagem", status: "Resultado disponível", requestedBy: "Dr. Paulo Henrique", items: ["RX tórax AP leito"], results: "Infiltrado bilateral difuso, sem pneumotórax. TOT em posição adequada." },
  ],
  "uti2-03": [
    { date: "2025-11-11 06:00", category: "Laboratório", status: "Resultado disponível", requestedBy: "Dr. Ricardo Souza", items: ["Troponina", "BNP", "Gasometria venosa mista", "Lactato"], results: "Troponina 12.300 (em queda) | BNP 4.500 | SvO2 58% | Lactato 4.8" },
    { date: "2025-11-11 08:00", category: "Imagem", status: "Solicitado", requestedBy: "Dr. Ricardo Souza", items: ["Ecocardiograma transtorácico beira-leito"] },
    { date: "2025-11-11 07:00", category: "Parecer", status: "Aguardando", requestedBy: "Dr. Ricardo Souza", items: ["Parecer Cardiocirurgia — avaliar indicação ECMO"] },
  ],
};

export default function PainelClinicoPage() {
  const { currentDepartment } = useDepartment();
  const { patients: dbPatients, isLoading, updatePatient } = usePatients(currentDepartment);
  const navigate = useNavigate();

  // Gestor não acessa o Painel Clínico — redireciona para o Mapa de Leitos
  const accessProfile = typeof window !== "undefined" ? localStorage.getItem("access_profile") : null;
  useEffect(() => {
    if (accessProfile === "gestor") {
      navigate("/mapa", { replace: true });
    }
  }, [accessProfile, navigate]);

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>(() => {
    return localStorage.getItem("selected_sector") || "all";
  });
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [sidebarTab, setSidebarTab] = useState("resumo");
  const [sapsScores, setSapsScores] = useState<Record<string, { score: number; mortality: number; status: string; pending_since: string | null }>>({});

  // Fetch SAPS 3 scores for all patients
  useEffect(() => {
    const fetchSaps = async () => {
      const { data } = await supabase
        .from("saps3_assessments" as any)
        .select("patient_name, total_score, predicted_mortality, status, pending_since")
        .order("created_at", { ascending: false });
      if (data) {
        const map: Record<string, { score: number; mortality: number; status: string; pending_since: string | null }> = {};
        (data as any[]).forEach((r: any) => {
          if (!map[r.patient_name]) {
            map[r.patient_name] = { score: r.total_score ?? 0, mortality: r.predicted_mortality ?? 0, status: r.status ?? 'completed', pending_since: r.pending_since ?? null };
          }
        });
        setSapsScores(map);
      }
    };
    fetchSaps();
  }, []);

  // Use DB patients if available (occupied ones), otherwise fallback to mock for demo
  const occupiedDbPatients = dbPatients.filter(p => !p.isVacant && p.name && p.name.trim() !== "");
  const patients = occupiedDbPatients.length > 0 ? dbPatients : ALL_MOCK_PATIENTS;

  // Filter out vacant beds and apply search/sector filter
  const filteredPatients = useMemo(() => {
    return patients
      .filter(p => !p.isVacant && p.name && p.name.trim() !== "")
      .filter(p => sectorFilter === "all" || p.sector === sectorFilter)
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        const diagArr = parseTextArray(p.diagnoses);
        return (
          p.name.toLowerCase().includes(q) ||
          p.bedNumber.toLowerCase().includes(q) ||
          diagArr.some(d => d.toLowerCase().includes(q))
        );
      });
  }, [patients, search, sectorFilter]);

  const handleInlineSave = useCallback(async (patientId: string, field: string, items: string[]) => {
    await updatePatient(patientId, { [field]: items } as Partial<Patient>);
    // Update local selectedPatient state
    setSelectedPatient(prev => prev ? { ...prev, [field]: items } : prev);
  }, [updatePatient]);

  const openPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSidebarTab("resumo");
  };

  // Clique no nome → entra direto no painel clínico individual (prescrição com contexto)
  const goToPatientPanel = (patient: Patient) => {
    const params = new URLSearchParams({
      patientId: patient.id,
      patientName: patient.name,
      patientBed: patient.bedNumber,
      patientSector: patient.sector,
    });
    if (patient.age) params.set("patientAge", patient.age.toString());
    navigate(`/prescricao?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header — barra institucional padronizada (mesmo padrão do Mapa de Leitos) */}
      <div className="px-2 sm:px-4 pt-3">
        <BreadcrumbBar
          variant="institutional"
          actions={
            <Badge variant="outline" className="text-xs bg-white/95 text-foreground border-white/40 shadow-sm">
              {filteredPatients.length} paciente{filteredPatients.length !== 1 ? "s" : ""}
            </Badge>
          }
        />
      </div>

      {/* Search bar below header */}
      <div className="px-4 py-2">
        <div className="flex gap-2 items-center">
          <Select value={sectorFilter} onValueChange={(val) => { setSectorFilter(val); if (val !== "all") localStorage.setItem("selected_sector", val); }}>
            <SelectTrigger className="h-8 w-auto gap-1 text-xs font-medium px-2.5 [&>svg]:h-3 [&>svg]:w-3 rounded-md">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              <SelectItem value="red">UTI 1</SelectItem>
              <SelectItem value="yellow">UTI 2</SelectItem>
              <SelectItem value="blue">UCI 1</SelectItem>
              <SelectItem value="outside">UCI 2</SelectItem>
              <SelectItem value="ucc">UCC</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Buscar por nome, leito ou diagnóstico..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Carregando pacientes...
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <ClipboardList className="h-10 w-10 opacity-30" />
              <p>Nenhum paciente encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24">Leito</TableHead>
                   <TableHead>Paciente</TableHead>
                  <TableHead className="w-24 text-center">SAPS 3</TableHead>
                  <TableHead className="w-48">Pendências</TableHead>
                  <TableHead className="w-28 text-center">Prescrição</TableHead>
                  <TableHead className="w-24 text-center">Dias Int.</TableHead>
                  <TableHead className="w-36">Previsão Alta</TableHead>
                  <TableHead className="w-40">Médico Resp.</TableHead>
                  <TableHead className="w-20 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map(patient => {
                  const days = calcDaysInternment(patient.admissionDate);
                  const prescStatus = getPrescriptionStatus(patient);
                  const pendencies = parseTextArray(patient.pendencies);
                  
                  return (
                    <TableRow
                      key={patient.id}
                      className="cursor-pointer group hover:bg-accent/50 transition-colors"
                      onClick={() => openPatient(patient)}
                      onDoubleClick={() => goToPatientPanel(patient)}
                      title="Clique para pré-visualizar • Duplo clique para abrir atendimento"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="patient-id font-mono font-bold text-foreground">{patient.bedNumber}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 whitespace-nowrap", getSectorColor(patient.sector))}>
                            {getSectorLabel(patient.sector)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground leading-tight hover:text-primary transition-colors">{patient.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {patient.age ? `${patient.age} anos` : "—"}
                          </p>
                          {parseTextArray(patient.diagnoses).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1 max-w-[200px]">
                              {parseTextArray(patient.diagnoses)[0]}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {sapsScores[patient.name] ? (
                          sapsScores[patient.name].status === 'pending' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Clock className="h-3.5 w-3.5 animate-pulse" />
                                <span className="text-[10px] font-semibold">Pendente</span>
                              </div>
                              <SapsPendingMiniTimer pendingSince={sapsScores[patient.name].pending_since} />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-mono font-bold text-sm text-foreground">{sapsScores[patient.name].score}</span>
                              <Badge variant="outline" className={cn("text-[10px] px-1.5",
                                sapsScores[patient.name].mortality < 10 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400" :
                                sapsScores[patient.name].mortality < 25 ? "text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400" :
                                sapsScores[patient.name].mortality < 50 ? "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400" :
                                "text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
                              )}>
                                {sapsScores[patient.name].mortality}%
                              </Badge>
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {pendencies.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {pendencies.slice(0, 2).map((p, i) => (
                              <span key={i} className="text-xs text-muted-foreground line-clamp-1">{p}</span>
                            ))}
                            {pendencies.length > 2 && (
                              <span className="text-[10px] text-primary">+{pendencies.length - 2} mais</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={cn(
                            "inline-block h-2.5 w-2.5 rounded-full shrink-0",
                            prescStatus.dotColor,
                            prescStatus.pulsing && "animate-pulse-soft"
                          )} />
                          <Badge variant={prescStatus.variant} className="text-[11px]">
                            {prescStatus.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("font-mono font-bold text-sm", days !== null && days > 7 ? "text-destructive" : "text-foreground")}>
                          {days !== null ? days : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{getDischargeText(patient)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-foreground">{getResponsibleDoctor(patient)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); openPatient(patient); }}
                          title="Visualização rápida (preview)"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </ScrollArea>

      {/* Patient Sidebar Sheet — usa o PatientCockpit padronizado dos demais módulos clínicos */}
      <Sheet open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col gap-0" side="right">
          {selectedPatient && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <PatientCockpit patient={selectedPatient} variant="inline" className="h-full border-0 rounded-none" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// EditableInfoSection component - click to edit inline, syncs with map
function EditableInfoSection({ icon: Icon, title, items, onSave }: { icon: React.ElementType; title: string; items: string[]; onSave: (items: string[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEntries(items.length > 0 ? [...items] : [""]);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEntries([]);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const newItems = entries.filter(l => l.trim());
      await onSave(newItems);
      setEditing(false);
    } catch {
      // error handled by updatePatient
    } finally {
      setSaving(false);
    }
  };

  const handleEntryChange = (index: number, value: string) => {
    const updated = [...entries];
    updated[index] = value;
    setEntries(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    }
  };

  const addEntry = () => {
    setEntries([...entries, ""]);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5 group/section">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-muted-foreground tracking-wide flex-1">{title}</h4>
        {!editing && (
          <button
            onClick={startEdit}
            className="opacity-0 group-hover/section:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent"
            title="Editar"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="pl-5 space-y-1.5">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={entry}
                onChange={(e) => handleEntryChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                className="text-sm h-8 flex-1"
                placeholder={`Item ${i + 1}...`}
                autoFocus={i === entries.length - 1}
              />
              {entries.length > 1 && (
                <button onClick={() => removeEntry(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={addEntry} className="h-7 text-xs gap-1 text-muted-foreground">
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="default" onClick={saveEdit} disabled={saving} className="h-7 text-xs gap-1">
              <Check className="h-3 w-3" /> Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving} className="h-7 text-xs gap-1">
              <X className="h-3 w-3" /> Cancelar
            </Button>
          </div>
        </div>
      ) : items.length > 0 ? (
        <ul className="space-y-0.5 list-disc list-inside pl-5 cursor-pointer" onClick={startEdit}>
          {items.map((item, i) => (
            <li key={i} className="text-sm text-foreground">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground italic pl-5 cursor-pointer" onClick={startEdit}>Nenhum registro — clique para adicionar</p>
      )}
    </div>
  );
}

// Editable text block component - for free-form text like admission history
function EditableTextBlock({ icon: Icon, title, value, onSave }: { icon: React.ElementType; title: string; value: string; onSave: (val: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5 group/section">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-muted-foreground tracking-wide flex-1">{title}</h4>
        {!editing && (
          <button onClick={startEdit} className="opacity-0 group-hover/section:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent" title="Editar">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="pl-5 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-sm min-h-[80px] resize-y"
            placeholder="História admissional..."
            autoFocus
            style={{ minHeight: "80px" }}
          />
          <div className="flex gap-1.5">
            <Button size="sm" variant="default" onClick={saveEdit} disabled={saving} className="h-7 text-xs gap-1">
              <Check className="h-3 w-3" /> Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving} className="h-7 text-xs gap-1">
              <X className="h-3 w-3" /> Cancelar
            </Button>
          </div>
        </div>
      ) : value ? (
        <p className="text-sm text-foreground pl-5 leading-relaxed whitespace-pre-line cursor-pointer" onClick={startEdit}>{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic pl-5 cursor-pointer" onClick={startEdit}>Nenhum registro — clique para adicionar</p>
      )}
    </div>
  );
}

// Mini timer for pending SAPS in table
function SapsPendingMiniTimer({ pendingSince }: { pendingSince: string | null }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!pendingSince) return;
    const update = () => {
      const diff = Date.now() - new Date(pendingSince).getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      setElapsed(`${hours}h${String(minutes).padStart(2, "0")}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [pendingSince]);

  if (!pendingSince) return null;

  return (
    <span className="font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
      ⏱ {elapsed}
    </span>
  );
}
