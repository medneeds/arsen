import { useState, useMemo } from "react";
import { usePatients } from "@/hooks/usePatients";
import { useDepartment } from "@/contexts/DepartmentContext";
import { Patient } from "@/types/patient";
import { differenceInDays, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Filter, FileText, Pill, Activity, ClipboardList, FolderOpen, User, Calendar, Clock, Stethoscope, Heart, TrendingUp, AlertTriangle, TestTubes, Syringe, Shield, Thermometer } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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
  const map: Record<string, string> = { red: "Vermelho", yellow: "Amarelo", blue: "Azul", outside: "Externo" };
  return map[sector] || sector;
};

const getSectorColor = (sector: string) => {
  const map: Record<string, string> = {
    red: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200",
    yellow: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200",
    outside: "bg-muted text-muted-foreground border-border",
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

const getPrescriptionStatus = (patient: Patient): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } => {
  const scheduleItems = parseTextArray(patient.schedule);
  if (scheduleItems.length > 0) {
    return { label: "Ativa", variant: "default" };
  }
  return { label: "Pendente", variant: "secondary" };
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
  const { patients: dbPatients, isLoading } = usePatients(currentDepartment);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [sidebarTab, setSidebarTab] = useState("resumo");

  // Use DB patients if available (occupied ones), otherwise fallback to mock for demo
  const occupiedDbPatients = dbPatients.filter(p => !p.isVacant && p.name && p.name.trim() !== "");
  const patients = occupiedDbPatients.length > 0 ? dbPatients : MOCK_UTI2_PATIENTS;

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

  const openPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSidebarTab("resumo");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <ClinicalNavTabs />
          </div>
          <Badge variant="outline" className="text-sm">
            {filteredPatients.length} paciente{filteredPatients.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, leito ou diagnóstico..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              <SelectItem value="red">Vermelho</SelectItem>
              <SelectItem value="yellow">Amarelo</SelectItem>
              <SelectItem value="blue">Azul</SelectItem>
              <SelectItem value="outside">Externo</SelectItem>
            </SelectContent>
          </Select>
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
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-mono font-bold text-foreground">{patient.bedNumber}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getSectorColor(patient.sector))}>
                            {getSectorLabel(patient.sector)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground leading-tight">{patient.name}</p>
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
                        <Badge variant={prescStatus.variant} className="text-[11px]">
                          {prescStatus.label}
                        </Badge>
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

      {/* Patient Sidebar Sheet */}
      <Sheet open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col" side="right">
          {selectedPatient && (
            <>
              {/* Sidebar Header */}
              <div className="px-4 py-3 border-b bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg text-foreground leading-tight">{selectedPatient.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Leito {selectedPatient.bedNumber} • {selectedPatient.age ? `${selectedPatient.age} anos` : ""} • {getSectorLabel(selectedPatient.sector)}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-xs", getSectorColor(selectedPatient.sector))}>
                    {getSectorLabel(selectedPatient.sector)}
                  </Badge>
                </div>
                {selectedPatient.clinicalStatus && clinicalStatusLabels[selectedPatient.clinicalStatus] && (
                  <Badge className={cn("mt-2 text-xs", clinicalStatusLabels[selectedPatient.clinicalStatus].color)}>
                    {clinicalStatusLabels[selectedPatient.clinicalStatus].label}
                  </Badge>
                )}
              </div>

              {/* Tabs */}
              <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="flex-1 flex flex-col min-h-0">
                <div className="px-4 pt-2 border-b bg-card">
                  <TabsList className="w-full grid grid-cols-5 h-9">
                    <TabsTrigger value="resumo" className="text-xs px-1">
                      <Activity className="h-3 w-3 mr-1" /> Resumo
                    </TabsTrigger>
                    <TabsTrigger value="prescricao" className="text-xs px-1">
                      <Pill className="h-3 w-3 mr-1" /> Prescrição
                    </TabsTrigger>
                    <TabsTrigger value="evolucao" className="text-xs px-1">
                      <FileText className="h-3 w-3 mr-1" /> Evolução
                    </TabsTrigger>
                    <TabsTrigger value="requisicoes" className="text-xs px-1">
                      <ClipboardList className="h-3 w-3 mr-1" /> Requisições
                    </TabsTrigger>
                    <TabsTrigger value="documentos" className="text-xs px-1">
                      <FolderOpen className="h-3 w-3 mr-1" /> Docs
                    </TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="flex-1">
                  {/* RESUMO */}
                  <TabsContent value="resumo" className="p-4 space-y-4 mt-0">
                    {/* Quick Stats - synced with map sidebar */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted/50 rounded-lg p-2 text-center border border-border/30">
                        <User className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                        <p className="text-[10px] text-muted-foreground">Idade</p>
                        <p className="text-xs font-semibold">{selectedPatient.age ? `${selectedPatient.age} anos` : "—"}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center border border-border/30">
                        <Calendar className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                        <p className="text-[10px] text-muted-foreground">Admissão</p>
                        <p className="text-xs font-semibold">
                          {selectedPatient.admissionDate
                            ? new Date(selectedPatient.admissionDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                            : "—"}
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center border border-border/30">
                        <Clock className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                        <p className="text-[10px] text-muted-foreground">Tempo</p>
                        <p className="text-xs font-semibold">{formatStayDuration(selectedPatient.admissionDate)}</p>
                      </div>
                    </div>

                    <InfoSection icon={Stethoscope} title="Hipóteses / Diagnósticos" items={parseTextArray(selectedPatient.diagnoses)} />
                    <InfoSection icon={Heart} title="Antecedentes / Comorbidades" items={parseTextArray(selectedPatient.medicalHistory)} />
                    <InfoSection icon={TrendingUp} title="Exames Relevantes" items={parseTextArray(selectedPatient.relevantExams)} />
                    <InfoSection icon={ClipboardList} title="Plano Terapêutico / Condutas" items={parseTextArray(selectedPatient.schedule)} />
                    <InfoSection icon={AlertTriangle} title="Programações / Pendências" items={parseTextArray(selectedPatient.pendencies)} />

                    {/* UTI-specific fields */}
                    {parseTextArray(selectedPatient.utiAdmissionReason).length > 0 && (
                      <InfoSection icon={Thermometer} title="Motivo da Admissão UTI" items={parseTextArray(selectedPatient.utiAdmissionReason)} />
                    )}
                    {parseTextArray(selectedPatient.utiCurrentStatus).length > 0 && (
                      <InfoSection icon={Activity} title="Status Atual UTI" items={parseTextArray(selectedPatient.utiCurrentStatus)} />
                    )}
                    {parseTextArray(selectedPatient.utiDevices).length > 0 && (
                      <InfoSection icon={Syringe} title="Dispositivos" items={parseTextArray(selectedPatient.utiDevices)} />
                    )}
                    {parseTextArray(selectedPatient.utiCulturesAntibiotics).length > 0 && (
                      <InfoSection icon={Shield} title="Culturas / Antibióticos" items={parseTextArray(selectedPatient.utiCulturesAntibiotics)} />
                    )}
                    {parseTextArray(selectedPatient.utiAllergies).length > 0 && (
                      <InfoSection icon={AlertTriangle} title="Alergias" items={parseTextArray(selectedPatient.utiAllergies)} />
                    )}
                    {parseTextArray(selectedPatient.utiDailyConducts).length > 0 && (
                      <InfoSection icon={ClipboardList} title="Condutas do Dia" items={parseTextArray(selectedPatient.utiDailyConducts)} />
                    )}
                    {parseTextArray(selectedPatient.utiDischargePrediction).length > 0 && (
                      <InfoSection icon={Calendar} title="Previsão de Alta" items={parseTextArray(selectedPatient.utiDischargePrediction)} />
                    )}

                    {selectedPatient.admissionHistory && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">História Admissional</h4>
                        </div>
                        <p className="text-sm text-foreground pl-5 leading-relaxed whitespace-pre-line">{selectedPatient.admissionHistory}</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* PRESCRIÇÃO */}
                  <TabsContent value="prescricao" className="p-4 mt-0">
                    <div className="space-y-4">
                      {(() => {
                        const mockPresc = MOCK_PRESCRIPTIONS[selectedPatient.id];
                        if (!mockPresc) return (
                          <p className="text-sm text-muted-foreground italic">Nenhuma prescrição registrada para este paciente.</p>
                        );
                        return mockPresc.map((cat, ci) => (
                          <div key={ci} className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{cat.category}</h4>
                            <div className="space-y-1.5">
                              {cat.items.map((item, ii) => (
                                <div key={ii} className="bg-muted/40 border border-border/30 rounded-lg px-3 py-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                                    <div className="flex gap-1.5">
                                      <Badge variant="outline" className="text-[10px]">{item.route}</Badge>
                                      <Badge variant="secondary" className="text-[10px]">{item.frequency}</Badge>
                                    </div>
                                  </div>
                                  {item.notes && (
                                    <p className="text-xs text-muted-foreground italic mt-1">{item.notes}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                            {ci < mockPresc.length - 1 && <Separator />}
                          </div>
                        ));
                      })()}
                      <Separator />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate(`/prescricao?patientId=${selectedPatient.id}&patientName=${encodeURIComponent(selectedPatient.name)}&patientBed=${encodeURIComponent(selectedPatient.bedNumber)}&patientSector=${encodeURIComponent(selectedPatient.sector)}`)}
                      >
                        <Pill className="h-4 w-4 mr-2" />
                        Abrir módulo completo
                      </Button>
                    </div>
                  </TabsContent>

                  {/* EVOLUÇÃO */}
                  <TabsContent value="evolucao" className="p-4 mt-0">
                    <div className="space-y-4">
                      {(() => {
                        const mockEvol = MOCK_EVOLUTIONS[selectedPatient.id];
                        if (!mockEvol) return (
                          <p className="text-sm text-muted-foreground italic">Nenhuma evolução registrada para este paciente.</p>
                        );
                        return mockEvol.map((evol, ei) => (
                          <div key={ei} className="bg-muted/40 border border-border/30 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-[10px]">{evol.type}</Badge>
                              <span className="text-[10px] text-muted-foreground">{evol.date}</span>
                            </div>
                            <p className="text-xs font-medium text-primary">{evol.author}</p>
                            <p className="text-sm text-foreground leading-relaxed">{evol.content}</p>
                          </div>
                        ));
                      })()}
                      <Separator />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate(`/evolucao?patientId=${selectedPatient.id}&patientName=${encodeURIComponent(selectedPatient.name)}&patientBed=${encodeURIComponent(selectedPatient.bedNumber)}&patientSector=${encodeURIComponent(selectedPatient.sector)}`)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Abrir módulo completo
                      </Button>
                    </div>
                  </TabsContent>

                  {/* REQUISIÇÕES */}
                  <TabsContent value="requisicoes" className="p-4 mt-0">
                    <div className="space-y-4">
                      {(() => {
                        const mockReqs = MOCK_REQUISITIONS[selectedPatient.id];
                        if (!mockReqs) return (
                          <p className="text-sm text-muted-foreground italic">Nenhuma requisição registrada para este paciente.</p>
                        );
                        return mockReqs.map((req, ri) => {
                          const statusColors: Record<string, string> = {
                            "Resultado disponível": "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200",
                            "Solicitado": "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200",
                            "Em processamento": "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200",
                            "Aguardando": "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200",
                            "Respondido": "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200",
                          };
                          return (
                            <div key={ri} className="bg-muted/40 border border-border/30 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">{req.category}</Badge>
                                  <Badge variant="outline" className={cn("text-[10px]", statusColors[req.status] || "")}>{req.status}</Badge>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{req.date}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Solicitado por: {req.requestedBy}</p>
                              <ul className="list-disc list-inside space-y-0.5">
                                {req.items.map((item, ii) => (
                                  <li key={ii} className="text-sm text-foreground">{item}</li>
                                ))}
                              </ul>
                              {req.results && (
                                <div className="bg-background/50 rounded p-2 mt-1">
                                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Resultado:</p>
                                  <p className="text-sm text-foreground">{req.results}</p>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                      <Separator />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate(`/requisicoes?patientId=${selectedPatient.id}&patientName=${encodeURIComponent(selectedPatient.name)}&patientBed=${encodeURIComponent(selectedPatient.bedNumber)}&patientSector=${encodeURIComponent(selectedPatient.sector)}`)}
                      >
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Abrir módulo completo
                      </Button>
                    </div>
                  </TabsContent>

                  {/* DOCUMENTOS */}
                  <TabsContent value="documentos" className="p-4 mt-0">
                    <p className="text-sm text-muted-foreground mb-4">
                      Documentos institucionais disponíveis para <strong>{selectedPatient.name}</strong> — Leito {selectedPatient.bedNumber}.
                    </p>
                    <div className="space-y-4">
                      {DOCUMENTS.map((group) => (
                        <div key={group.group}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.group}</p>
                          <div className="space-y-1">
                            {group.items.map((doc) => (
                              <a
                                key={doc.path}
                                href={doc.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/50 text-sm text-foreground transition-colors"
                              >
                                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {doc.name}
                              </a>
                            ))}
                          </div>
                          <Separator className="mt-3" />
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// InfoSection component - synced with map sidebar style
function InfoSection({ icon: Icon, title, items }: { icon: React.ElementType; title: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-0.5 list-disc list-inside pl-5">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-foreground">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground italic pl-5">Nenhum registro</p>
      )}
    </div>
  );
}
