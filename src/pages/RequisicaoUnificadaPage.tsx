import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";

import { PatientCockpit } from "@/components/PatientCockpit";
import { useCockpitPatient } from "@/hooks/useCockpitPatient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TestTubes, ScanLine, UserCheck, Plus, Search, Clock, CheckCircle2,
  Heart, Activity, Navigation2,
  XCircle, FileText, AlertTriangle, Loader2, Send, Trash2,
  ChevronDown, ChevronUp, Eye, ClipboardList, Package, TrendingUp,
  CalendarIcon, Printer, RotateCcw, FileCheck, Microscope, Droplet, Syringe,
  ShieldAlert, ChevronRight,
} from "lucide-react";
import { HemocomponentRequestDialog } from "@/components/HemocomponentRequestDialog";
import { SatRequestDialog } from "@/components/SatRequestDialog";
import { CultureRequestDialog } from "@/components/CultureRequestDialog";
import { AihFormDialog } from "@/components/AihFormDialog";
import { OPMEDialog } from "@/components/OPMEDialog";

import ExamResultInput, { ResultFile } from "@/components/ExamResultInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, richHtmlToPlainText, sanitizeRichHtml } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn, asUuidOrNull } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import { PrintableRequisitionGuide } from "@/components/PrintableRequisitionGuide";
import { printRequisitionGuideWithGasometriaPrompt } from "@/lib/printRequisitionWithGasometriaPrompt";
import { openPrintWindow } from "@/lib/printNormaZero";
import { registrarSolicitacao } from "@/lib/registrarSolicitacao";
import { PostValidationPrintDialog } from "@/components/PostValidationPrintDialog";
import { useHospital } from "@/contexts/HospitalContext";
import { getSectorDisplayLabel } from "@/utils/bedNaming";

const getSectorLabel = getSectorDisplayLabel;

// ── UTI Exam Combos ──
type ComboCategory = "laboratorio" | "imagem";
interface UtiCombo {
  id: string;
  label: string;
  description: string;
  icon: typeof Clock;
  color: string;
  bg: string;
  border: string;
  scope: "uti" | "enfermaria" | "all";
  categories: Partial<Record<ComboCategory, string[]>>;
}

const UTI_COMBOS: UtiCombo[] = [
  {
    id: "admissao-uti",
    label: "Admissão UTI",
    description: "Painel completo de admissão — inclui sorologias e coagulograma",
    icon: Clock,
    scope: "uti",
    color: "text-red-600",
    bg: "bg-red-500/10",
    border: "border-red-300",
    categories: {
      laboratorio: [
        "Hemograma Completo",
        "TAP/INR", "TTPA", "Fibrinogênio",
        "Ureia", "Creatinina", "Sódio", "Potássio", "Cálcio", "Magnésio", "PCR",
        "Fósforo", "Bilirrubina Total e Frações",
        "Gasometria Arterial",
        "Sífilis (VDRL)", "HBsAg", "Anti-HBc", "Anti-HBs", "Anti-HCV", "Anti-HIV",
      ],
    },
  },
  {
    id: "rotina-uti-sem-vm",
    label: "Rotina UTI s/ VM",
    description: "Rotina diária — paciente crítico sem ventilação mecânica",
    icon: Clock,
    scope: "uti",
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    border: "border-blue-300",
    categories: {
      laboratorio: [
        "Hemograma Completo",
        "TAP/INR", "TTPA", "Fibrinogênio",
        "Ureia", "Creatinina", "Sódio", "Potássio", "Cálcio", "Magnésio", "PCR",
      ],
    },
  },
  {
    id: "rotina-uti-vm",
    label: "Rotina UTI VM",
    description: "Rotina diária — paciente em ventilação mecânica (+gasometria)",
    icon: Clock,
    scope: "uti",
    color: "text-indigo-600",
    bg: "bg-indigo-500/10",
    border: "border-indigo-300",
    categories: {
      laboratorio: [
        "Hemograma Completo",
        "TAP/INR", "TTPA", "Fibrinogênio",
        "Ureia", "Creatinina", "Sódio", "Potássio", "Cálcio", "Magnésio", "PCR",
        "Gasometria Arterial",
      ],
    },
  },
  {
    id: "rotina-enfermaria",
    label: "Rotina Enfermaria",
    description: "Controle laboratorial diário — hemograma, função renal, eletrólitos, PCR",
    icon: Clock,
    scope: "enfermaria",
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    border: "border-emerald-300",
    categories: {
      laboratorio: [
        "Hemograma Completo", "Ureia", "Creatinina", "Sódio", "Potássio", "PCR",
      ],
    },
  },
];

// Setores classificados como UTI para filtro de combos
const UTI_SECTOR_KEYS = new Set(["red", "yellow", "blue", "outside", "ucc"]);
const isUtiSector = (sector: string) => UTI_SECTOR_KEYS.has(sector);

// ── Category config ──
const CATEGORIES = {
  laboratorio: {
    label: "Exames Laboratoriais",
    shortLabel: "Laboratório",
    icon: TestTubes,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    presets: [
      { group: "Hemograma", items: ["Hemograma Completo", "Hemoglobina", "Hematócrito", "Plaquetas", "Leucograma", "Reticulócitos", "VHS", "Ferritina", "Ferro Sérico", "Transferrina", "Saturação de Transferrina", "Vitamina B12", "Ácido Fólico", "Eletroforese de Hemoglobina", "Coombs Direto", "Coombs Indireto"] },
      { group: "Bioquímica", items: ["Glicemia", "Glicemia Pós-prandial", "Hemoglobina Glicada (HbA1c)", "Ureia", "Creatinina", "Sódio", "Potássio", "Cloro", "Cálcio", "Cálcio Iônico", "Magnésio", "Fósforo", "TGO", "TGP", "Gama-GT", "Fosfatase Alcalina", "Bilirrubina Total e Frações", "Albumina", "Proteínas Totais e Frações", "PCR", "Amilase", "Lipase", "DHL", "CPK", "CK-MB", "Ácido Úrico", "Colesterol Total", "HDL", "LDL", "Triglicerídeos", "Osmolaridade Sérica"] },
      { group: "Coagulação", items: ["TAP/INR", "TTPA", "Fibrinogênio", "D-Dímero", "Tempo de Trombina", "Antitrombina III", "Atividade de Protrombina"] },
      { group: "Gasometria", items: ["Gasometria Arterial", "Gasometria Venosa", "Lactato", "Saturação Venosa Central (SvcO2)"] },
      { group: "Marcadores", items: ["Troponina", "BNP/NT-proBNP", "Procalcitonina", "DHL", "CK-MB", "Mioglobina", "Dímero-D"] },
      { group: "Marcadores Tumorais", items: ["PSA Total", "PSA Livre", "CEA", "CA 125", "CA 19-9", "CA 15-3", "Alfafetoproteína (AFP)", "Beta-HCG", "CA 72-4"] },
      { group: "Função Tireoidiana / Hormônios", items: ["TSH", "T4 Livre", "T4 Total", "T3", "T3 Livre", "Anti-TPO", "Anti-Tireoglobulina", "Cortisol", "Cortisol Salivar", "ACTH", "Prolactina", "FSH", "LH", "Estradiol", "Testosterona Total", "Testosterona Livre", "Progesterona", "PTH", "Vitamina D (25-OH)", "Insulina", "Peptídeo C"] },
      { group: "Urina", items: ["EAS/Urina Tipo I", "Creatinina Urinária", "Ureia Urinária", "Sódio Urinário", "Potássio Urinário", "Proteinúria 24h", "Microalbuminúria", "Clearance de Creatinina", "Urocultura", "Relação Proteína/Creatinina Urinária", "Osmolaridade Urinária"] },
      { group: "Sorologias", items: ["Sífilis (VDRL)", "HBsAg", "Anti-HBc", "Anti-HBs", "Anti-HCV", "Anti-HIV", "Anti-HAV IgM", "Anti-HAV IgG"] },
      { group: "Imunologia / Reumatologia", items: ["FAN", "Fator Reumatoide", "Anti-DNA", "Complemento C3", "Complemento C4", "Anti-CCP", "ANCA", "Imunoglobulinas (IgG/IgA/IgM)"] },
    ],
  },
  imagem: {
    label: "Exames de Imagem",
    shortLabel: "Imagem",
    icon: ScanLine,
    color: "text-violet-600",
    bg: "bg-violet-500/10",
    presets: [
      { group: "Radiografia", items: ["RX Tórax PA", "RX Tórax AP (leito)", "RX Abdome", "RX Coluna Cervical", "RX Seios da Face"] },
      { group: "Tomografia", items: ["TC Crânio s/ contraste", "TC Crânio c/ contraste", "TC Tórax", "TC Abdome Total", "TC Coluna", "Angio-TC Tórax (TEP)", "Angio-TC Crânio (AVC)"] },
      { group: "Ultrassonografia", items: ["USG Abdome Total", "USG Vias Urinárias", "USG Point-of-Care (POCUS)", "USG Partes Moles"] },
      { group: "Doppler / Duplex (alta complexidade)", items: ["USG Doppler Venoso MMII", "USG Doppler Arterial MMII", "Doppler Duplex de Carótidas e Vertebrais", "Doppler Transcraniano", "USG Doppler Renal"] },
      { group: "Ressonância", items: ["RM Crânio", "RM Coluna", "RM Abdome"] },
      { group: "Outros", items: ["Ecocardiograma TT", "Ecocardiograma TE", "ECG 12 derivações"] },
    ],
  },
  parecer: {
    label: "Pareceres",
    shortLabel: "Pareceres",
    icon: UserCheck,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    presets: [
      { group: "Especialidades Médicas", items: ["Anestesiologia", "Cabeça e Pescoço", "Cardiologia", "Cirurgia Bucomaxilofacial", "Cirurgia Geral", "Cirurgia Plástica", "Cirurgia Torácica", "Cirurgia Vascular", "Clínica Médica", "Coloproctologia", "Endocrinologia", "Hematologia", "Infectologia", "Medicina Intensiva", "Nefrologia", "Neurocirurgia", "Neurologia", "Ortopedia", "Otorrinolaringologia", "Urologia"] },
      { group: "Apoio", items: ["Fisioterapia", "Fonoaudiologia", "Nutrição", "Psicologia", "Assistência Social", "Farmácia Clínica", "Cuidados Paliativos"] },
    ],
  },
  procedimento: {
    label: "Procedimentos",
    shortLabel: "Procedimento",
    icon: FileCheck,
    color: "text-orange-600",
    bg: "bg-orange-500/10",
    presets: [],
  },
  terapeutico: {
    label: "Terapêutico",
    shortLabel: "Terapêutico",
    icon: Heart,
    color: "text-rose-600",
    bg: "bg-rose-500/10",
    presets: [],
  },
  regulacao: {
    label: "Regulação",
    shortLabel: "Regulação",
    icon: Navigation2,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    presets: [],
  },
} as const;

// Categorias clínicas (internas) vs Regulação (externa)
const CLINICAL_CATEGORIES: CategoryKey[] = ["laboratorio", "imagem", "parecer", "procedimento", "terapeutico"];

// Retrocompatibilidade: category='apac' legado mapeia para 'procedimento'
const LEGACY_CATEGORY_MAP: Record<string, string> = { apac: "procedimento" };

type CategoryKey = keyof typeof CATEGORIES;

// ──────────────────────────────────────────────────────────────────────────
// ETAPA 1 — Classificação de instrumento de faturamento (alta complexidade)
//
// Regra absoluta da direção clínica do Socorrão I:
//   TODA tomografia, ressonância e ecocardiograma → fluxo APAC.
// O reconhecimento usa DUAS camadas, nesta ordem:
//   1) Regra por tipo (nome do exame)  → garante cobertura mesmo sem código
//   2) Código SIGTAP (quando houver)    → confirma e enriquece
// Assim, exames de alta complexidade ainda sem código SIGTAP cadastrado
// NÃO escapam — a regra de tipo já os reconhece.
// ──────────────────────────────────────────────────────────────────────────

// Instrumento de faturamento derivado do exame.
//   "apac"   → alta complexidade, exige fluxo de Procedimento (APAC)
//   "comum"  → requisição comum (Norma Zero)
type ExamInstrument = "apac" | "comum";

// Camada 1 — regra por tipo: padrões no nome que SEMPRE são APAC.
// Mantida em minúsculas e sem acento para casar de forma robusta.
//
// IMPORTANTE — distinção clínica do ultrassom:
//   • Ultrassom COMUM (abdome, vias urinárias, partes moles) → requisição comum
//   • Ultrassom com DOPPLER / DUPLEX (carótidas, MMII, arterial/venoso) → APAC
// Por isso o padrão captura "doppler"/"duplex", não "ultrassom" genérico.
const HIGH_COMPLEXITY_NAME_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(tc|tomografia|angio-?tc)\b/i, label: "Tomografia" },
  { pattern: /\b(rm|rnm|ressonancia)\b/i, label: "Ressonância" },
  { pattern: /\becocardiograma\b/i, label: "Ecocardiograma" },
  { pattern: /\b(doppler|duplex|duplo-?scan)\b/i, label: "Doppler / Duplex" },
  { pattern: /\bcintilografia\b/i, label: "Medicina Nuclear" },
  { pattern: /\b(angiografia|arteriografia|cateterismo)\b/i, label: "Angiografia / Hemodinâmica" },
  { pattern: /\bmamografia\b/i, label: "Mamografia" },
  { pattern: /\bdensitometria\b/i, label: "Densitometria óssea" },
  { pattern: /\b(endoscopia|colonoscopia|broncoscopia|endoscópica)\b/i, label: "Endoscopia" },
];

// Camada 2 — códigos SIGTAP conhecidos de alta complexidade (enriquecível).
// Esta lista é um REFORÇO de precisão; pode crescer conforme o cadastro.
// Prefixos do grupo 02.06 (diagnóstico em alta complexidade) do SIGTAP.
const HIGH_COMPLEXITY_SIGTAP_PREFIXES: string[] = [
  "0206",   // Diagnóstico por tomografia, ressonância, medicina nuclear
];

// Normaliza para comparação (sem acento, minúsculo, espaços colapsados).
const normalizeExam = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

/**
 * Classifica um exame quanto ao instrumento de faturamento.
 * Retorna o instrumento e, quando alta complexidade, o rótulo do tipo.
 */
function classifyExamInstrument(
  examName: string,
  sigtapCode?: string
): { instrument: ExamInstrument; highComplexityLabel?: string } {
  // Camada 1 — regra por tipo (prioritária, cobre itens sem código)
  const normalized = normalizeExam(examName);
  for (const { pattern, label } of HIGH_COMPLEXITY_NAME_PATTERNS) {
    if (pattern.test(normalized)) {
      return { instrument: "apac", highComplexityLabel: label };
    }
  }
  // Camada 2 — código SIGTAP (reforço)
  if (sigtapCode) {
    const clean = sigtapCode.replace(/\D/g, "");
    if (HIGH_COMPLEXITY_SIGTAP_PREFIXES.some(p => clean.startsWith(p))) {
      return { instrument: "apac", highComplexityLabel: "Alta complexidade" };
    }
  }
  return { instrument: "comum" };
}

// Atalho booleano de conveniência.
const isHighComplexityExam = (examName: string, sigtapCode?: string): boolean =>
  classifyExamInstrument(examName, sigtapCode).instrument === "apac";

// Motivos pré-definidos para a saída de exceção do popup de bloqueio.
// (usados na Etapa 3 — "continuar mesmo assim" exige justificativa)
const APAC_OVERRIDE_REASONS = [
  "Urgência clínica — sem tempo para o fluxo APAC",
  "Indisponibilidade momentânea do fluxo de Procedimento",
  "Orientação do faturamento para este caso",
  "Exame sem código APAC aplicável nesta situação",
  "Outro motivo (descrever abaixo)",
];

const PRIORITY_OPTIONS = [
  { value: "programado", label: "Programado", color: "text-blue-600" },
  { value: "rotina", label: "Rotina", color: "text-cyan-600" },
  { value: "urgente", label: "Urgente", color: "text-red-600" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock; dotColor: string; pulsing: boolean }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-700 border-amber-300", icon: Clock, dotColor: "bg-amber-500", pulsing: true },
  acknowledged: { label: "Ciência", color: "bg-indigo-500/15 text-indigo-700 border-indigo-300", icon: Eye, dotColor: "bg-indigo-500", pulsing: true },
  in_progress: { label: "Em Andamento", color: "bg-blue-500/15 text-blue-700 border-blue-300", icon: Loader2, dotColor: "bg-blue-500", pulsing: true },
  completed: { label: "Concluído", color: "bg-emerald-500/15 text-emerald-700 border-emerald-300", icon: CheckCircle2, dotColor: "bg-emerald-500", pulsing: false },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border", icon: XCircle, dotColor: "bg-muted-foreground", pulsing: false },
};

const RequisicaoUnificadaPage = () => {
  const { user } = useAuth();
  const doctor = useCurrentDoctor();
  const { currentHospital, currentState } = useHospital();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const unitId = currentHospital?.id;
  const stateId = currentState?.id;

  // Initial category from URL: ?categoria=laboratorio|imagem|parecer|procedimento|terapeutico
  const initialCategory: CategoryKey = (() => {
    const cat = searchParams.get("categoria");
    const esp = searchParams.get("especial");
    // Retrocompatibilidade: ?especial=apac → procedimento
    if (esp === "apac" || cat === "apac") return "procedimento";
    if (esp === "cultura") return "laboratorio";
    if (cat === "laboratorio" || cat === "imagem" || cat === "parecer" || cat === "procedimento" || cat === "terapeutico") return cat as CategoryKey;
    return "laboratorio";
  })();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>(initialCategory);
  const [activeSubTab, setActiveSubTab] = useState("solicitar");
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [allProcedureRequests, setAllProcedureRequests] = useState<any[]>([]);
  const [loadingAllProcedures, setLoadingAllProcedures] = useState(false);

  // Cockpit (right rail) — same pattern as Evolução / Prescrição
  const cockpitPatient = useCockpitPatient();

  // ── New request form ──
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [formPatientId, setFormPatientId] = useState<string | null>(null);
  const [formPatientName, setFormPatientName] = useState("");
  const [formPatientBed, setFormPatientBed] = useState("");
  const [formPatientSector, setFormPatientSector] = useState("");
  const [formPriority, setFormPriority] = useState("rotina");
  const [formScheduledDate, setFormScheduledDate] = useState("");
  const [formScheduledTime, setFormScheduledTime] = useState("");
  const [formIndication, setFormIndication] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSelectedItems, setFormSelectedItems] = useState<string[]>([]);
  const [formCustomItem, setFormCustomItem] = useState("");
  // Etapa 2 — busca de exame dentro da categoria (Imagem e demais)
  const [examSearch, setExamSearch] = useState("");
  // Etapa 3 — popup de bloqueio de alta complexidade (APAC)
  const [apacBlock, setApacBlock] = useState<{
    open: boolean;
    examName: string;
    label: string;
  }>({ open: false, examName: "", label: "" });
  // Saída de exceção: justificativa (motivo pré-definido + complemento livre)
  const [apacOverrideReason, setApacOverrideReason] = useState("");
  const [apacOverrideNote, setApacOverrideNote] = useState("");
  // Itens solicitados como comum por exceção (rastreio interno p/ gestão)
  const [apacOverrides, setApacOverrides] = useState<{ item: string; reason: string; note: string; at: string }[]>([]);
  // Exame pré-selecionado ao redirecionar da Imagem para o fluxo APAC
  const [apacPreselect, setApacPreselect] = useState<string>("");
  const [formExtraJustification, setFormExtraJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedCombo, setExpandedCombo] = useState<string | null>(null);
  const [hemoDialogOpen, setHemoDialogOpen] = useState(false);
  const [satDialogOpen, setSatDialogOpen] = useState(false);
  const [cultureDialogOpen, setCultureDialogOpen] = useState(false);
  const [aihRegulacaoOpen, setAihRegulacaoOpen] = useState(false);
  const [opmeOpen, setOpmeOpen] = useState(false);
  const [regulacaoType, setRegulacaoType] = useState<"transferencia" | "vaga" | "externo" | null>(null);

  // ── Result dialog ──
  const [viewingRequest, setViewingRequest] = useState<any | null>(null);
  const [resultText, setResultText] = useState("");
  const [resultFiles, setResultFiles] = useState<ResultFile[]>([]);
  const [savingResult, setSavingResult] = useState(false);

  // ── Sync patient from URL params (reactive to header patient switcher) ──
  useEffect(() => {
    const state = location.state as any;
    const patientId = state?.patientId || searchParams.get("patientId");
    const patientName = state?.patientName || searchParams.get("patientName");
    const patientBed = state?.patientBed || searchParams.get("patientBed");
    const patientSector = state?.patientSector || searchParams.get("patientSector");
    setFormPatientId(patientId || null);
    setFormPatientName(patientName || "");
    setFormPatientBed(patientBed || "");
    setFormPatientSector(patientSector || "");
    if (patientId || patientName) setActiveSubTab("solicitar");
  }, [searchParams.get("patientId"), searchParams.get("patientName")]);

  // ── Sync category from URL (?categoria=, ?especial=) — sem escopo ──
  useEffect(() => {
    const cat = searchParams.get("categoria");
    const esp = searchParams.get("especial");
    // Retrocompatibilidade: ?especial=apac ou ?categoria=apac → procedimento
    if (esp === "apac" || cat === "apac") {
      setActiveCategory("procedimento");
    } else if (esp === "cultura") {
      setActiveCategory("laboratorio");
      setCultureDialogOpen(true);
    } else if (cat === "laboratorio" || cat === "imagem" || cat === "parecer" || cat === "procedimento" || cat === "terapeutico") {
      setActiveCategory(cat as CategoryKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("categoria"), searchParams.get("especial")]);

  useEffect(() => {
    if (unitId && stateId) {
      fetchRequests();
      if (activeCategory === "procedimento") fetchAllProcedures();
    }
  }, [unitId, stateId, activeCategory, formPatientId]);

  const fetchRequests = async () => {
    if (!unitId || !stateId) return;
    setLoading(true);
    try {
      // Algumas categorias agregam sub-fluxos que persistem com category própria:
      //   terapeutico → hemocomponente + sat (diálogos especializados)
      //   regulacao   → regulacao + transferencia + vaga + externo
      // A aba precisa buscar TODAS as categorias relacionadas para o rastro aparecer.
      const CATEGORY_GROUPS: Record<string, string[]> = {
        terapeutico: ["terapeutico", "hemocomponente", "sat"],
        regulacao: ["regulacao", "transferencia", "vaga", "externo"],
      };
      const categoriesToFetch = CATEGORY_GROUPS[activeCategory] || [activeCategory];

      let query = supabase
        .from("exam_requests")
        .select("*")
        .eq("hospital_unit_id", unitId)
        .eq("state_id", stateId)
        .in("category", categoriesToFetch)
        .order("created_at", { ascending: false })
        .limit(200);

      // When patient context is present AND id is a real UUID, filter by patient
      const validPatientId = asUuidOrNull(formPatientId);
      if (validPatientId) {
        query = query.eq("patient_id", validPatientId);
      } else if (formPatientName) {
        // Fallback para mocks (sem UUID real): filtra por nome
        query = query.eq("patient_name", formPatientName);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);
    } catch {
      toast.error("Erro ao carregar requisições");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProcedures = async () => {
    if (!unitId || !stateId) return;
    setLoadingAllProcedures(true);
    try {
      const { data } = await supabase
        .from("exam_requests")
        .select("*")
        .eq("hospital_unit_id", unitId)
        .eq("state_id", stateId)
        .eq("category", "procedimento")
        .order("created_at", { ascending: false })
        .limit(100);
      setAllProcedureRequests(data || []);
    } catch {
      // silent — histórico geral é suplementar
    } finally {
      setLoadingAllProcedures(false);
    }
  };

  // ── Filtered lists ──
  // Defesa em profundidade: mesmo após o filtro server-side, garante que
  // só apareçam itens do paciente atualmente aberto quando há contexto.
  const validPatientIdMemo = useMemo(() => asUuidOrNull(formPatientId), [formPatientId]);
  const scopedRequests = useMemo(() => {
    if (validPatientIdMemo) {
      return requests.filter(r => r.patient_id === validPatientIdMemo);
    }
    if (formPatientName) {
      return requests.filter(r => (r.patient_name || "").trim().toLowerCase() === formPatientName.trim().toLowerCase());
    }
    // Sem contexto de paciente: parecer não exibe nada (evita vazar entre pacientes)
    if (activeCategory === "parecer") return [];
    return requests;
  }, [requests, validPatientIdMemo, formPatientName, activeCategory]);

  const pendingRequests = useMemo(() =>
    scopedRequests.filter(r => (r.status === "pending" || r.status === "in_progress") &&
      (!search || r.patient_name?.toLowerCase().includes(search.toLowerCase()))),
    [scopedRequests, search]
  );
  const completedRequests = useMemo(() =>
    scopedRequests.filter(r => r.status === "completed" &&
      (!search || r.patient_name?.toLowerCase().includes(search.toLowerCase()))),
    [scopedRequests, search]
  );

  const allPendingProcedures = useMemo(() =>
    allProcedureRequests.filter(r => r.status === "pending" || r.status === "in_progress"),
    [allProcedureRequests]
  );
  const allCompletedProcedures = useMemo(() =>
    allProcedureRequests.filter(r => r.status === "completed"),
    [allProcedureRequests]
  );

  const toggleItem = (item: string) => {
    // Etapa 3 — bloqueio educativo: na categoria Imagem, exame de alta
    // complexidade não pode ser solicitado como comum. Intercepta a SELEÇÃO
    // (não a remoção) e abre o popup de redirecionamento.
    const alreadySelected = formSelectedItems.includes(item);
    if (!alreadySelected && activeCategory === "imagem") {
      const { instrument, highComplexityLabel } = classifyExamInstrument(item);
      if (instrument === "apac") {
        setApacBlock({ open: true, examName: item, label: highComplexityLabel || "Alta complexidade" });
        setApacOverrideReason("");
        setApacOverrideNote("");
        return; // não adiciona ainda — aguarda decisão no popup
      }
    }
    setFormSelectedItems(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  // Etapa 3 — botão primário do popup: ir para o fluxo correto (Procedimento/APAC)
  // já com o exame pré-selecionado.
  const goToApacFlow = () => {
    const exam = apacBlock.examName;
    setApacBlock({ open: false, examName: "", label: "" });
    // Leva para o fluxo APAC carregando o exame pré-selecionado via querystring.
    setActiveCategory("procedimento");
    setActiveSubTab("solicitar");
    setApacPreselect(exam);
  };

  // Etapa 3 — saída de exceção: continuar como comum, exige justificativa.
  const confirmApacOverride = () => {
    if (!apacOverrideReason) { toast.error("Selecione um motivo para continuar"); return; }
    if (apacOverrideReason === APAC_OVERRIDE_REASONS[APAC_OVERRIDE_REASONS.length - 1] && !apacOverrideNote.trim()) {
      toast.error("Descreva o motivo no campo complementar"); return;
    }
    const exam = apacBlock.examName;
    // Registra a exceção para rastreio interno da gestão.
    setApacOverrides(prev => [...prev, {
      item: exam,
      reason: apacOverrideReason,
      note: apacOverrideNote.trim(),
      at: new Date().toISOString(),
    }]);
    // Agora sim adiciona o item como comum.
    setFormSelectedItems(prev => prev.includes(exam) ? prev : [...prev, exam]);
    setApacBlock({ open: false, examName: "", label: "" });
    toast.warning(`"${exam}" incluído como requisição comum (exceção registrada)`);
  };

  const addCustomItem = () => {
    if (formCustomItem.trim() && !formSelectedItems.includes(formCustomItem.trim())) {
      setFormSelectedItems(prev => [...prev, formCustomItem.trim()]);
      setFormCustomItem("");
    }
  };

  const applyCombo = (combo: UtiCombo) => {
    const currentCatItems = combo.categories[activeCategory as ComboCategory] || [];
    const otherCatItems = Object.entries(combo.categories)
      .filter(([cat]) => cat !== activeCategory)
      .flatMap(([, items]) => items || []);
    const allComboItems = [...currentCatItems, ...otherCatItems];
    setFormSelectedItems(prev => {
      const merged = new Set([...prev, ...allComboItems]);
      return Array.from(merged);
    });
    const crossCats = Object.keys(combo.categories).filter(c => c !== activeCategory);
    const crossNote = crossCats.length > 0
      ? ` (inclui itens de ${crossCats.map(c => CATEGORIES[c as CategoryKey]?.shortLabel).join(", ")})`
      : "";
    toast.success(`${combo.label} aplicado — ${allComboItems.length} exames${crossNote}`);
  };

  const removeCombo = (combo: UtiCombo) => {
    const allComboItems = Object.values(combo.categories).flat();
    setFormSelectedItems(prev => prev.filter(item => !allComboItems.includes(item)));
    toast.info(`${combo.label} removido`);
  };

  const isComboFullySelected = (combo: UtiCombo) => {
    const allItems = Object.values(combo.categories).flat();
    return allItems.every(item => formSelectedItems.includes(item));
  };

  const isComboPartiallySelected = (combo: UtiCombo) => {
    const allItems = Object.values(combo.categories).flat();
    return allItems.some(item => formSelectedItems.includes(item)) && !isComboFullySelected(combo);
  };

  // Conjunto de exames laboratoriais cobertos pelos combos rápidos (Rotina UTI / Enfermaria).
  // Itens fora deste set, quando solicitados na categoria laboratório, exigem justificativa extra.
  const QUICK_LAB_SET = useMemo(() => {
    const s = new Set<string>();
    UTI_COMBOS.forEach(c => (c.categories.laboratorio || []).forEach(i => s.add(i)));
    return s;
  }, []);

  // Filter combos by sector: UTI sectors see UTI combos, others see enfermaria combo
  const visibleCombos = useMemo(() => {
    const sectorIsUti = isUtiSector(formPatientSector || "");
    return UTI_COMBOS.filter(c => c.scope === "all" || (sectorIsUti ? c.scope === "uti" : c.scope === "enfermaria"));
  }, [formPatientSector]);

  const offQuickLabItems = useMemo(() => {
    if (activeCategory !== "laboratorio") return [] as string[];
    return formSelectedItems.filter(i => !QUICK_LAB_SET.has(i));
  }, [formSelectedItems, activeCategory, QUICK_LAB_SET]);

  const requiresExtraJustification = offQuickLabItems.length > 0;

  // Limpa SOMENTE os campos da requisição — preserva paciente selecionado para encadear
  // múltiplas solicitações sem perder identificação. (Bug: após submit a identificação sumia.)
  const resetRequestFields = () => {
    setFormPriority("rotina");
    setFormScheduledDate("");
    setFormScheduledTime("");
    setFormIndication("");
    setFormNotes("");
    setFormSelectedItems([]);
    setFormCustomItem("");
    setFormExtraJustification("");
    setExpandedCombo(null);
  };

  // Limpa TUDO (paciente + campos) — usado pelo botão "Limpar" explícito.
  const resetForm = () => {
    setFormPatientId(null);
    setFormPatientName("");
    setFormPatientBed("");
    setFormPatientSector("");
    resetRequestFields();
  };

  const handleSubmitRequest = async () => {
    if (!formPatientName.trim()) { toast.error("Informe o nome do paciente"); return; }
    if (formSelectedItems.length === 0) { toast.error("Selecione ao menos um item"); return; }
    if (!richHtmlToPlainText(formIndication).trim()) { toast.error("Informe a justificativa clínica"); return; }
    if (requiresExtraJustification && formExtraJustification.trim().length < 10) {
      toast.error("Itens fora dos pacotes de rotina exigem justificativa específica (mín. 10 caracteres) para liberação da guia");
      return;
    }
    if (formPriority === "programado" && !formScheduledDate) { toast.error("Informe a data programada"); return; }

    // Validações de contexto com mensagens claras (antes só fazia return silencioso)
    if (!user) { toast.error("Sessão inválida — refaça login"); return; }
    if (!unitId) { toast.error("Unidade hospitalar não selecionada"); return; }
    if (!stateId) { toast.error("Estado não selecionado"); return; }

    setSubmitting(true);
    try {
      // Build notes with scheduled info if programado
      let notesContent = formNotes.trim() || "";
      if (formPriority === "programado" && formScheduledDate) {
        const scheduledInfo = `[PROGRAMADO: ${formScheduledDate}${formScheduledTime ? " às " + formScheduledTime : ""}]`;
        notesContent = scheduledInfo + (notesContent ? "\n" + notesContent : "");
      }
      if (requiresExtraJustification) {
        const extraBlock = `[JUSTIFICATIVA — EXAMES FORA DA ROTINA]\nItens: ${offQuickLabItems.join(", ")}\nMotivo: ${formExtraJustification.trim()}`;
        notesContent = (notesContent ? notesContent + "\n\n" : "") + extraBlock;
      }

      // Mesmo helper das fichas APAC e AIH — um ponto único de gravação.
      // Esta ficha já bloqueava corretamente; o ganho aqui é não haver três
      // montagens diferentes do mesmo payload, que foi como as outras duas
      // acabaram divergindo (AIH nem gravava leito e setor).
      await registrarSolicitacao({
        category: activeCategory,
        patientId: formPatientId,
        patientName: formPatientName,
        patientBed: formPatientBed,
        patientSector: formPatientSector,
        items: formSelectedItems.map(name => ({ name })),
        clinicalIndication: activeCategory === "parecer" ? sanitizeRichHtml(formIndication) : formIndication,
        priority: formPriority,
        notes: notesContent,
        requestedBy: user.id,
        requestedByName: (() => {
          const name = (doctor.fullName || "").trim()
            || (user.user_metadata?.full_name as string | undefined)?.trim()
            || user.user_metadata?.username
            || user.email?.split("@")[0]
            || "Médico";
          const crm = (doctor.crm || "").trim();
          return crm ? `${name} — CRM ${crm}` : name;
        })(),
        hospitalUnitId: unitId,
        stateId: stateId,
      });
      toast.success(`${CATEGORIES[activeCategory].shortLabel}: ${formSelectedItems.length} item(ns) solicitado(s)`);
      // Preserva paciente selecionado para encadear novas solicitações sem reabrir o picker.
      resetRequestFields();
      setActiveSubTab("solicitados");
      fetchRequests();
    } catch (err: any) {
      console.error("[Requisicoes] handleSubmitRequest falhou:", err);
      const msg = err?.message || err?.error_description || err?.details || "Erro desconhecido";
      toast.error(`Erro ao criar requisição: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveResult = async () => {
    if (!viewingRequest) return;
    setSavingResult(true);
    try {
      const updateData: any = {
        status: "completed",
        results: resultText.trim() || null,
        completed_at: new Date().toISOString(),
        completed_by: user?.email?.split("@")[0] || "Sistema",
      };
      if (resultFiles.length > 0) {
        updateData.result_data = { files: resultFiles };
      }
      const { error } = await supabase
        .from("exam_requests")
        .update(updateData)
        .eq("id", viewingRequest.id);
      if (error) throw error;
      toast.success("Resultado registrado");
      setViewingRequest(null);
      setResultText("");
      setResultFiles([]);
      fetchRequests();
    } catch {
      toast.error("Erro ao salvar resultado");
    } finally {
      setSavingResult(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    try {
      const { error } = await supabase
        .from("exam_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      toast.success("Requisição cancelada");
      fetchRequests();
      if (activeCategory === "procedimento") fetchAllProcedures();
    } catch {
      toast.error("Erro ao cancelar");
    }
  };

  // Bloco reutilizável de rastreabilidade (Solicitar | Solicitados | <3ª aba>).
  // Usado por Procedimento, Terapêutico e Regulação para listar o que foi solicitado
  // e permitir reimprimir/visualizar. O rótulo da 3ª aba varia por categoria.
  const renderTrackingTabs = (
    thirdLabel: string,
    emptyIcon: typeof Clock,
    emptyMsg: string,
    opts?: {
      header?: string;
      pending?: any[];
      completed?: any[];
      isLoading?: boolean;
      tabValue?: string;
      onTabChange?: (v: string) => void;
    }
  ) => {
    const activePending   = opts?.pending    ?? pendingRequests;
    const activeCompleted = opts?.completed  ?? completedRequests;
    const activeLoading   = opts?.isLoading  ?? loading;
    const trackTab        = opts?.tabValue   ?? (activeSubTab === "resultados" ? "resultados" : "solicitados");
    const setTrackTab     = opts?.onTabChange ?? setActiveSubTab;
    const sectionHeader   = opts?.header     ?? "Histórico de solicitações";
    return (
    <div className="mt-2 pt-3 border-t border-border/60">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {sectionHeader}
      </p>
      <Tabs value={trackTab} onValueChange={setTrackTab}>
      <TabsList className="bg-muted/50">
        <TabsTrigger value="solicitados" className="gap-1.5 text-xs">
          <Clock className="h-3.5 w-3.5" /> Solicitados
          {activePending.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">{activePending.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="resultados" className="gap-1.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5" /> {thirdLabel}
          {activeCompleted.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">{activeCompleted.length}</Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="solicitados" className="mt-4 space-y-3">
        {activeLoading ? (
          <SectionLoader message="Carregando solicitações" subMessage="" size="sm" />
        ) : activePending.length === 0 ? (
          <EmptyState icon={emptyIcon} message={emptyMsg} />
        ) : (
          activePending.map(req => (
            <RequestCard key={req.id} request={req} category={activeCategory}
              onViewResult={() => { setViewingRequest(req); setResultText(req.results || ""); setResultFiles(req.result_data?.files || []); }}
              onCancel={() => handleCancelRequest(req.id)} />
          ))
        )}
      </TabsContent>
      <TabsContent value="resultados" className="mt-4 space-y-3">
        {activeLoading ? (
          <SectionLoader message="Carregando" subMessage="" size="sm" />
        ) : activeCompleted.length === 0 ? (
          <EmptyState icon={CheckCircle2} message={`Nenhum item em "${thirdLabel}"`} />
        ) : (
          activeCompleted.map(req => (
            <RequestCard key={req.id} request={req} category={activeCategory}
              onViewResult={() => { setViewingRequest(req); setResultText(req.results || ""); setResultFiles(req.result_data?.files || []); }}
              showResult />
          ))
        )}
      </TabsContent>
      </Tabs>
    </div>
    );
  };

  const catConfig = CATEGORIES[activeCategory];
  if (!catConfig) console.error("[Requisicoes] catConfig undefined; activeCategory =", activeCategory);
  const CatIcon = catConfig?.icon ?? ClipboardList;

  return (
    <div>
      <div className="print:hidden">
        <ClinicalHeader moduleLabel="Requisições" />
      </div>
      <div className="flex print:block">
        <div className="flex-1 min-w-0 p-4 md:p-6 space-y-4 print:p-0 print:m-0">
        {/* SAPS pending alert removed */}
      {/* Header — title + patient identity inline */}
      <div className="hidden sm:block print:hidden">
        <div className="flex items-center justify-between gap-4 mb-1">
          {/* ESQUERDA */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {formPatientBed && (
              <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-primary/15 border border-primary/20 shrink-0">
                <span className="text-[7px] font-bold uppercase tracking-wide text-primary/70 leading-none">Leito</span>
                <span className="text-base font-extrabold text-primary leading-tight mt-0.5">{formPatientBed}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-base font-extrabold text-foreground uppercase tracking-wide leading-tight truncate">
                {formPatientName || "—"}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {formPatientSector && <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">{formPatientSector}</span>}
              </div>
            </div>
          </div>
          {/* DIREITA */}
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground leading-tight">REQUISIÇÕES</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Exames e pareceres</p>
          </div>
        </div>
      </div>

      {/* Identificação do paciente fica integralmente no cockpit à direita
          (com Prontuário, Atendimento e botão "Ver dados do prontuário"). */}

      {/* ── Category Selector — clínicas + divisória + Regulação (Fase 1+2) ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 print:hidden items-center">
        {(Object.keys(CATEGORIES) as CategoryKey[]).map(key => {
          const cat = CATEGORIES[key];
          const Icon = cat.icon;
          const isActive = activeCategory === key;
          const isRegulacao = key === "regulacao";
          return (
            <React.Fragment key={key}>
              {/* Divisória visual antes de Regulação */}
              {isRegulacao && (
                <div className="flex items-center gap-1.5 shrink-0 mx-1">
                  <div className="w-px h-8 bg-border" />
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider rotate-0 whitespace-nowrap">externo</span>
                  <div className="w-px h-8 bg-border" />
                </div>
              )}
              <button
                onClick={() => { setActiveCategory(key); setActiveSubTab("solicitar"); setSearch(""); setRegulacaoType(null); }}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all duration-200 min-w-fit",
                  isActive
                    ? isRegulacao
                      ? "border-amber-500 bg-amber-50/60 dark:bg-amber-500/10 shadow-sm ring-1 ring-amber-500/30"
                      : "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/50 hover:border-border"
                )}
              >
                <div className={cn("p-1.5 rounded-lg", isActive ? cat.bg : "bg-muted")}>
                  <Icon className={cn("h-4 w-4", isActive ? cat.color : "text-muted-foreground")} />
                </div>
                <div className="text-left">
                  <p className={cn("text-xs font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>
                    {cat.shortLabel}
                  </p>
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Procedimento: abas Solicitar | Solicitados | Laudos — igual ao padrão de Lab/Imagem ── */}
      {activeCategory === "procedimento" ? (
        <Tabs
          value={["solicitados", "resultados"].includes(activeSubTab) ? activeSubTab : "solicitar"}
          onValueChange={setActiveSubTab}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="solicitar" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Solicitar
              </TabsTrigger>
              <TabsTrigger value="solicitados" className="gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5" /> Solicitados
                {allPendingProcedures.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">{allPendingProcedures.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resultados" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Laudos
                {allCompletedProcedures.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">{allCompletedProcedures.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Aba: Solicitar ── */}
          <TabsContent value="solicitar" className="mt-4 space-y-4">
            <ApacEmbeddedForm
              patientName={formPatientName}
              patientBed={formPatientBed}
              patientSector={formPatientSector}
              patientId={formPatientId}
              preselectProcedure={apacPreselect}
              onPreselectConsumed={() => setApacPreselect("")}
              onSelectPatient={(p) => {
                setFormPatientId(p.id);
                setFormPatientName(p.name || "");
                setFormPatientBed(p.bed_number || "");
                setFormPatientSector(p.sector || "");
              }}
              onProcedureRegistered={() => { fetchAllProcedures(); setActiveSubTab("solicitados"); }}
            />
            {/* OPME — complementar ao laudo */}
            <div className="border rounded-lg p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Registro de OPME</p>
                    <p className="text-[11px] text-muted-foreground">Órtese, Prótese e Material Especial — complementar ao laudo</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setOpmeOpen(true)}>
                  <Package className="h-3.5 w-3.5" /> Registrar OPME
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── Aba: Solicitados (todos os pacientes da unidade) ── */}
          <TabsContent value="solicitados" className="mt-4 space-y-3">
            {loadingAllProcedures ? (
              <SectionLoader message="Carregando solicitações" subMessage="" size="sm" />
            ) : allPendingProcedures.length === 0 ? (
              <EmptyState icon={FileText} message="Nenhum procedimento solicitado" />
            ) : (
              allPendingProcedures.map(req => (
                <RequestCard key={req.id} request={req} category="procedimento"
                  onViewResult={() => { setViewingRequest(req); setResultText(req.results || ""); setResultFiles(req.result_data?.files || []); }}
                  onCancel={() => handleCancelRequest(req.id)} />
              ))
            )}
          </TabsContent>

          {/* ── Aba: Laudos (todos os concluídos da unidade) ── */}
          <TabsContent value="resultados" className="mt-4 space-y-3">
            {loadingAllProcedures ? (
              <SectionLoader message="Carregando" subMessage="" size="sm" />
            ) : allCompletedProcedures.length === 0 ? (
              <EmptyState icon={CheckCircle2} message="Nenhum item em &quot;Laudos&quot;" />
            ) : (
              allCompletedProcedures.map(req => (
                <RequestCard key={req.id} request={req} category="procedimento"
                  onViewResult={() => { setViewingRequest(req); setResultText(req.results || ""); setResultFiles(req.result_data?.files || []); }}
                  showResult />
              ))
            )}
          </TabsContent>
        </Tabs>
      ) : activeCategory === "terapeutico" ? (
        /* ── Terapêutico: Hemocomponentes + SAT ── */
        <div className="space-y-3">
          {/* Rastreabilidade — terapêuticos solicitados (logo abaixo, antes das guias) */}
          {renderTrackingTabs("Executados", Droplet, "Nenhum terapêutico solicitado")}
          <p className="text-[11px] text-muted-foreground font-medium px-1">
            Selecione o formulário terapêutico para o paciente:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setHemoDialogOpen(true)}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-sky-200 bg-sky-50/60 dark:bg-sky-500/5 dark:border-sky-500/20 hover:border-sky-400 hover:bg-sky-100/60 transition-all text-left"
            >
              <div className="p-3 rounded-xl bg-sky-500/15 shrink-0">
                <Droplet className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Hemocomponentes</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Solicitação de sangue e derivados — Socorrão I</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSatDialogOpen(true)}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/60 dark:bg-indigo-500/5 dark:border-indigo-500/20 hover:border-indigo-400 hover:bg-indigo-100/60 transition-all text-left"
            >
              <div className="p-3 rounded-xl bg-indigo-500/15 shrink-0">
                <Syringe className="h-6 w-6 text-indigo-700 dark:text-indigo-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">SAT / IGHAT</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Soro antitetânico e imunoglobulina</p>
              </div>
            </button>
          </div>
        </div>
      ) : activeCategory === "regulacao" ? (
        /* ── Regulação: Transferência | Vaga | Externo ── */
        <div className="space-y-4">
          {/* Seletor de tipo */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Tipo de solicitação
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { key: "transferencia", label: "Transferência", desc: "Encaminhamento para outro serviço de saúde", color: "amber", icon: Navigation2 },
                { key: "vaga", label: "Vaga de Maior Complexidade", desc: "Solicitação de vaga em UTI ou serviço especializado", color: "orange", icon: Activity },
                { key: "externo", label: "Procedimento / Exame Externo", desc: "Procedimento ou exame a ser realizado em outra unidade", color: "yellow", icon: FileCheck },
              ] as const).map(({ key, label, desc, color, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setRegulacaoType(key);
                    setAihRegulacaoOpen(true);
                  }}
                  className={cn(
                    "flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all",
                    regulacaoType === key
                      ? `border-${color}-400 bg-${color}-50/60 dark:bg-${color}-500/10 ring-1 ring-${color}-400/40`
                      : "border-border hover:border-amber-300 hover:bg-amber-50/30 dark:hover:bg-amber-500/5"
                  )}
                >
                  <div className={`p-2.5 rounded-lg bg-${color}-500/15 w-fit`}>
                    <Icon className={`h-5 w-5 text-${color}-600 dark:text-${color}-400`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mt-auto">
                    Abre formulário AIH →
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* Rastreabilidade — regulações solicitadas (logo abaixo dos subtópicos) */}
          {renderTrackingTabs("Laudos", Navigation2, "Nenhuma solicitação de regulação pendente")}
        </div>
      ) : (
      <>
      {/* ── Sub Tabs: Solicitar | Solicitados | Resultados ── */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="solicitar" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Solicitar
            </TabsTrigger>
            <TabsTrigger value="solicitados" className="gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" /> Solicitados
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resultados" className="gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {/* Terapêutico/Regulação não geram laudo: o desfecho é "Executados". */}
              {(activeCategory as string) === "terapeutico" || (activeCategory as string) === "regulacao" ? "Executados" : "Resultados"}
              {completedRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">{completedRequests.length}</Badge>
              )}
            </TabsTrigger>
            {activeCategory === "laboratorio" && (
              <TabsTrigger value="comparativo" className="gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" /> Comparativo
              </TabsTrigger>
            )}
          </TabsList>
          {activeSubTab !== "solicitar" && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════ */}
        {/* TAB: SOLICITAR                              */}
        {/* ════════════════════════════════════════════ */}
        <TabsContent value="solicitar" className="mt-4 space-y-4">

          {/* Priority Selection */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold">Classificação da Requisição</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={formPriority === "urgente" ? "default" : "outline"}
                className={cn(
                  "flex-1 gap-2 h-12 text-sm font-semibold transition-all",
                  formPriority === "urgente"
                    ? "bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-lg shadow-red-500/20"
                    : "border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                )}
                onClick={() => setFormPriority("urgente")}
              >
                <AlertTriangle className="h-4.5 w-4.5" />
                Urgente
              </Button>
              <Button
                type="button"
                variant={formPriority === "rotina" ? "default" : "outline"}
                className={cn(
                  "flex-1 gap-2 h-12 text-sm font-semibold transition-all",
                  formPriority === "rotina"
                    ? "bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600 shadow-lg shadow-cyan-500/20"
                    : "border-cyan-300 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-500/10"
                )}
                onClick={() => setFormPriority("rotina")}
              >
                <Clock className="h-4.5 w-4.5" />
                Rotina
              </Button>
              <Button
                type="button"
                variant={formPriority === "programado" ? "default" : "outline"}
                className={cn(
                  "flex-1 gap-2 h-12 text-sm font-semibold transition-all",
                  formPriority === "programado"
                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                    : "border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                )}
                onClick={() => setFormPriority("programado")}
              >
                <CalendarIcon className="h-4.5 w-4.5" />
                Programado
              </Button>
            </div>

            {/* Scheduled date/time for programado */}
            {formPriority === "programado" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-500/5 dark:border-blue-500/20">
                <div className="space-y-1.5">
                  <Label className="text-xs text-blue-700 dark:text-blue-400">Data Programada *</Label>
                  <Input
                    type="date"
                    value={formScheduledDate}
                    onChange={e => setFormScheduledDate(e.target.value)}
                    className="text-sm"
                    min={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-blue-700 dark:text-blue-400">Horário (opcional)</Label>
                  <Input
                    type="time"
                    value={formScheduledTime}
                    onChange={e => setFormScheduledTime(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Clinical Justification */}
          {activeCategory === "parecer" ? (
            (() => {
              const PARECER_HARD = 2200; // limite fixo p/ caber em 1 página A4 junto da resposta manual
              const plain = richHtmlToPlainText(formIndication);
              const used = plain.length;
              const overHard = used >= PARECER_HARD;
              const nearLimit = used >= PARECER_HARD * 0.85;
              return (
                <Card className="border-l-[4px] border-l-primary border-primary/20 bg-card shadow-sm">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      Justificativa Clínica para o Parecerista
                      <span className="text-destructive">*</span>
                      <Badge variant="outline" className="ml-auto text-[10px] font-normal border-primary/30 text-primary">
                        Imprime no laudo
                      </Badge>
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Descreva história resumida, hipótese diagnóstica, exames relevantes e a pergunta objetiva ao especialista. Use <strong>negrito</strong>, <em>itálico</em>, <u>sublinhado</u> e listas para organizar tópicos. <strong>Enter</strong> cria parágrafo · <strong>Shift+Enter</strong> quebra de linha.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <RichTextEditor
                      value={formIndication}
                      onChange={(html) => {
                        setFormIndication(html);
                      }}
                      placeholder="Ex.: Paciente 54a, sepse de foco abdominal D3, em uso de meropenem. Lactato em queda, mas mantém disfunção renal (Cr 2,8). Solicito avaliação da Nefrologia quanto à indicação de TRS."
                      minHeight={170}
                      className="bg-background border-primary/20"
                    />

                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-200",
                          overHard ? "bg-destructive" : nearLimit ? "bg-amber-500" : "bg-primary"
                        )}
                        style={{ width: `${Math.min(100, (used / PARECER_HARD) * 100)}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <span className="text-muted-foreground">
                        Limite fixo para garantir resposta do parecerista em <strong>1 página A4</strong>.
                      </span>
                      <span className={cn(
                        "font-mono tabular-nums",
                        overHard ? "text-destructive font-bold" : nearLimit ? "text-amber-700 font-semibold" : "text-muted-foreground"
                      )}>
                        {PARECER_HARD - used} restantes
                      </span>
                    </div>

                    {overHard && (
                      <p className="text-[10.5px] leading-snug text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2 py-1.5">
                        <strong>Limite máximo atingido ({PARECER_HARD}).</strong> Conteúdo adicional bloqueado para preservar o bloco-resposta do parecerista. Anexe detalhes na evolução clínica.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })()
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Justificativa Clínica <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Descreva a justificativa clínica para esta requisição..."
                value={formIndication}
                onChange={e => setFormIndication(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          )}

          {/* ── Cultura: atalho rápido dentro de Laboratório ── */}
          {activeCategory === "laboratorio" && (
            <button
              type="button"
              onClick={() => setCultureDialogOpen(true)}
              className="w-full flex items-center gap-4 p-3 rounded-xl border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-500/5 dark:border-blue-500/20 hover:border-blue-400 hover:bg-blue-100/50 transition-all text-left"
            >
              <div className="p-2.5 rounded-xl bg-blue-500/15 shrink-0">
                <Microscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Cultura Microbiológica</p>
                <p className="text-[11px] text-muted-foreground">Hemocultura · Urinocultura · Secreção · LCR — formulário próprio</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0 border-blue-300 text-blue-700 dark:text-blue-300">Formulário específico</Badge>
            </button>
          )}

          {/* ── Pacotes rápidos de rotina (UTI / Enfermaria) ── */}
          {activeCategory === "laboratorio" && (
            <Card className="border-border/50 bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  <Package className="h-4 w-4 text-primary" />
                  Pacotes de Rotina
                  <Badge variant="outline" className="text-[10px] font-normal">Clique para aplicar</Badge>
                </CardTitle>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Combos filtrados pelo setor do paciente. Culturas e exames de imagem devem ser solicitados pelo fluxo próprio (aba <em>Imagem</em> e <em>Cultura</em>).
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {visibleCombos.map(combo => {
                  const ComboIcon = combo.icon;
                  const fullySelected = isComboFullySelected(combo);
                  const partiallySelected = isComboPartiallySelected(combo);
                  const isExpanded = expandedCombo === combo.id;
                  const allItems = Object.entries(combo.categories).flatMap(([cat, items]) =>
                    (items || []).map(item => ({ item, category: cat }))
                  );

                  return (
                    <div key={combo.id} className={cn(
                      "rounded-lg border transition-all",
                      fullySelected ? `${combo.border} ${combo.bg}` : "border-border bg-background",
                    )}>
                      <div className="flex items-center gap-3 p-3">
                        <div className={cn("p-1.5 rounded-lg", combo.bg)}>
                          <ComboIcon className={cn("h-4 w-4", combo.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{combo.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{combo.description}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {partiallySelected && (
                            <Badge variant="outline" className="text-[9px] h-5 border-amber-300 text-amber-600">Parcial</Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => setExpandedCombo(isExpanded ? null : combo.id)}
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                          </Button>
                          {fullySelected ? (
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => removeCombo(combo)}>
                              Remover
                            </Button>
                          ) : (
                            <Button size="sm" className="h-7 px-2.5 text-[10px]" onClick={() => applyCombo(combo)}>
                              Aplicar
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expanded: show all items with individual toggles */}
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-2">
                          {Object.entries(combo.categories).map(([cat, items]) => (
                            <div key={cat}>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                {CATEGORIES[cat as CategoryKey]?.shortLabel || cat}
                                {cat !== activeCategory && (
                                  <span className="ml-1 text-[9px] normal-case font-normal">(outra categoria)</span>
                                )}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {(items || []).map(item => {
                                  const idx = formSelectedItems.indexOf(item);
                                  const selected = idx >= 0;
                                  return (
                                    <button
                                      key={item}
                                      onClick={() => toggleItem(item)}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-all duration-150",
                                        selected
                                          ? "border-primary bg-primary/10 text-primary font-medium"
                                          : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50"
                                      )}
                                    >
                                      {selected && (
                                        <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded bg-primary text-primary-foreground text-[9px] font-bold tabular-nums">
                                          {idx + 1}
                                        </span>
                                      )}
                                      {item}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Item selection */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CatIcon className={cn("h-4 w-4", catConfig.color)} />
                Selecionar {catConfig.label}
                {formSelectedItems.length > 0 && (
                  <Badge variant="default" className="text-[10px]">{formSelectedItems.length} selecionado(s)</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Etapa 2 — campo de busca de exame (facilita reconhecimento) */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Buscar ${activeCategory === "parecer" ? "especialidade" : "exame"}...`}
                  value={examSearch}
                  onChange={e => setExamSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              {catConfig.presets.map(group => {
                const q = normalizeExam(examSearch);
                const visibleItems = q
                  ? group.items.filter(it => normalizeExam(it).includes(q))
                  : group.items;
                if (visibleItems.length === 0) return null;
                return (
                <div key={group.group}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleItems.map(item => {
                      const idx = formSelectedItems.indexOf(item);
                      const selected = idx >= 0;
                      // Etapa 2 — etiqueta de instrumento (igual a Procedimento)
                      const isApac = activeCategory === "imagem" && isHighComplexityExam(item);
                      return (
                        <button
                          key={item}
                          onClick={() => toggleItem(item)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all duration-150",
                            selected
                              ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                              : isApac
                                ? "border-amber-300/70 bg-amber-50/60 text-foreground hover:bg-amber-100/60 dark:bg-amber-500/10 dark:border-amber-500/30"
                                : "border-border bg-background text-foreground hover:bg-muted/50"
                          )}
                        >
                          {selected && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded bg-primary text-primary-foreground text-[10px] font-bold tabular-nums">
                              {idx + 1}
                            </span>
                          )}
                          {item}
                          {isApac && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold tracking-wide">
                              APAC
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })}

              {/* Custom item */}
              <div className="flex gap-2 pt-2 border-t border-border/50">
                <Input
                  placeholder={`Adicionar ${activeCategory === "parecer" ? "especialidade" : "exame"} personalizado...`}
                  value={formCustomItem}
                  onChange={e => setFormCustomItem(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomItem()}
                  className="h-9"
                />
                <Button size="sm" variant="outline" onClick={addCustomItem} disabled={!formCustomItem.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Selected items summary */}
              {formSelectedItems.length > 0 && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <p className="text-[11px] font-semibold text-primary mb-2">
                    Itens solicitados ({formSelectedItems.length}) — a numeração reflete a ordem que sairá impressa
                  </p>
                  <ol className="flex flex-wrap gap-1.5 list-none">
                    {formSelectedItems.map((item, idx) => (
                      <li key={item}>
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors gap-1.5 pl-1"
                          onClick={() => toggleItem(item)}
                          title="Clique para remover"
                        >
                          <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded bg-primary text-primary-foreground text-[10px] font-bold tabular-nums">
                            {idx + 1}
                          </span>
                          {item} ×
                        </Badge>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Justificativa extra para exames laboratoriais fora dos pacotes rápidos */}
          {requiresExtraJustification && (
            <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Liberação condicionada — exame fora da rotina
                </CardTitle>
                <p className="text-[11px] text-amber-700/90 dark:text-amber-400/80 mt-1">
                  Os itens abaixo não fazem parte dos pacotes rápidos (Rotina UTI / Enfermaria) e exigem
                  justificativa clínica específica para liberação da guia pelo laboratório.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {offQuickLabItems.map(it => (
                    <Badge key={it} variant="outline" className="text-[11px] border-amber-400 text-amber-800 dark:text-amber-300 bg-amber-100/60">
                      {it}
                    </Badge>
                  ))}
                </div>
                <Label className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Justificativa específica <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  placeholder="Ex.: suspeita de hipotireoidismo subclínico — solicito TSH e T4 livre..."
                  value={formExtraJustification}
                  onChange={e => setFormExtraJustification(e.target.value)}
                  rows={3}
                  className="resize-none text-sm bg-background"
                />
                <p className="text-[10px] text-muted-foreground">
                  Mínimo 10 caracteres. Esta justificativa fica registrada na guia para auditoria.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Campo "Observações" removido — a Justificativa Clínica acima já cobre.
              `formNotes` permanece no state para concatenar [PROGRAMADO] e [JUSTIFICATIVA EXTRA]. */}


          {/* Submit */}
          {(() => {
            const missing: string[] = [];
            if (!formPatientName.trim()) missing.push("identificar o paciente");
            if (formSelectedItems.length === 0) missing.push(`selecionar pelo menos 1 ${activeCategory === "parecer" ? "especialidade" : "exame"}`);
            if (!richHtmlToPlainText(formIndication).trim()) missing.push("preencher a justificativa clínica");
            if (requiresExtraJustification && formExtraJustification.trim().length < 10) missing.push("justificar exames fora da rotina (mín. 10 caracteres)");
            const blocked = missing.length > 0;
            return (
              <div className="flex flex-col items-end gap-2 pt-2">
                {blocked && (
                  <div className="w-full rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      Para enviar, falta: <strong>{missing.join(" · ")}</strong>.
                    </span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm} disabled={submitting}>Limpar</Button>
                  <Button
                    onClick={handleSubmitRequest}
                    disabled={submitting || blocked}
                    className="gap-2"
                    title={blocked ? `Falta: ${missing.join(" · ")}` : "Enviar requisição"}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar Requisição
                  </Button>
                </div>
              </div>
            );
          })()}
        </TabsContent>

        {/* ════════════════════════════════════════════ */}
        {/* TAB: SOLICITADOS                            */}
        {/* ════════════════════════════════════════════ */}
        <TabsContent value="solicitados" className="mt-4 space-y-3">
          {loading ? (
            <SectionLoader message="Carregando requisições" subMessage="Buscando dados do paciente" size="sm" />
          ) : pendingRequests.length === 0 ? (
            <EmptyState icon={CatIcon} message={`Nenhuma requisição pendente de ${catConfig.shortLabel.toLowerCase()}`} />
          ) : (
            pendingRequests.map(req => (
              <RequestCard
                key={req.id}
                request={req}
                category={activeCategory}
                onViewResult={() => { setViewingRequest(req); setResultText(req.results || ""); setResultFiles(req.result_data?.files || []); }}
                onCancel={() => handleCancelRequest(req.id)}
              />
            ))
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════ */}
        {/* TAB: RESULTADOS                             */}
        {/* ════════════════════════════════════════════ */}
        <TabsContent value="resultados" className="mt-4 space-y-3">
          {loading ? (
            <SectionLoader message="Carregando requisições" subMessage="Buscando dados do paciente" size="sm" />
          ) : completedRequests.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="Nenhum resultado disponível" />
          ) : (
            completedRequests.map(req => (
              <RequestCard
                key={req.id}
                request={req}
                category={activeCategory}
                onViewResult={() => { setViewingRequest(req); setResultText(req.results || ""); setResultFiles(req.result_data?.files || []); }}
                showResult
              />
            ))
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════ */}
        {/* TAB: COMPARATIVO (somente laboratório)      */}
        {/* ════════════════════════════════════════════ */}
        {activeCategory === "laboratorio" && (
          <TabsContent value="comparativo" className="mt-4">
            <LabComparativeView
              requests={completedRequests}
              patientName={formPatientName}
              patientId={formPatientId}
              allRequests={requests.filter(r => r.status === "completed" && r.category === "laboratorio")}
            />
          </TabsContent>
        )}
      </Tabs>
      </>
      )}

      {/* ── Result Dialog (read-only for physicians) ── */}
      <Dialog open={!!viewingRequest} onOpenChange={() => { setViewingRequest(null); setResultText(""); setResultFiles([]); }}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {viewingRequest?.status === "completed" ? "Visualizar Resultado" : "Requisição Solicitada"}
            </DialogTitle>
            <DialogDescription>
              {viewingRequest?.patient_name} — {CATEGORIES[activeCategory].shortLabel}
            </DialogDescription>
          </DialogHeader>
          {viewingRequest && (
            <div className="space-y-4">
              {/* Pré-visualização Norma Zero — espelha exatamente o documento impresso */}
              <PrintableRequisitionGuide
                request={viewingRequest as any}
                sectorLabel={(s) => getSectorLabel(s)}
              />

              {/* Result display (read-only — physicians only view results) */}
              {viewingRequest.status === "completed" ? (
                <ExamResultInput
                  resultText={resultText}
                  onResultTextChange={() => {}}
                  resultFiles={resultFiles}
                  onResultFilesChange={() => {}}
                  readOnly={true}
                  requestId={viewingRequest.id}
                  hospitalUnitId={unitId}
                />
              ) : (
                <div className="p-4 rounded-lg border border-border/50 bg-muted/20 text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Aguardando resultado do setor responsável</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">O resultado será importado pelo setor de {activeCategory === "laboratorio" ? "laboratório" : activeCategory === "imagem" ? "imagem" : "parecer"}</p>
                </div>
              )}

              {viewingRequest.completed_at && (
                <p className="text-[10px] text-muted-foreground">
                  Concluído em {format(new Date(viewingRequest.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} por {viewingRequest.completed_by || "—"}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            {viewingRequest?.status === "completed" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs mr-auto"
                onClick={() => printRequisitionGuideWithGasometriaPrompt(viewingRequest, (s) => getSectorLabel(s))}
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir Guia
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewingRequest(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hemocomponentes — diálogo padrão Socorrão I */}
      <HemocomponentRequestDialog
        open={hemoDialogOpen}
        onOpenChange={setHemoDialogOpen}
        patientId={asUuidOrNull(formPatientId)}
        patientName={formPatientName}
        patientBed={formPatientBed}
        patientSector={formPatientSector}
      />

      {/* Cultura — diálogo otimizado microbiológico */}
      <CultureRequestDialog
        open={cultureDialogOpen}
        onOpenChange={setCultureDialogOpen}
        patientId={asUuidOrNull(formPatientId)}
        patientName={formPatientName}
        patientBed={formPatientBed}
        patientSector={formPatientSector}
      />

      {/* SAT — Soro Antitetânico / IGHAT */}
      <SatRequestDialog
        open={satDialogOpen}
        onOpenChange={setSatDialogOpen}
        patientId={formPatientId}
        patientName={formPatientName}
        patientBed={formPatientBed}
        patientSector={formPatientSector}
      />

      {/* AIH de Regulação — distinto da AIH de internação */}
      <AihFormDialog
        open={aihRegulacaoOpen}
        onOpenChange={(o) => { setAihRegulacaoOpen(o); if (!o) setRegulacaoType(null); }}
        patientId={formPatientId || ""}
        patientName={formPatientName}
        origin="regulacao"
        regulacaoType={regulacaoType ?? undefined}
      />

      {/* OPME — Registro de Órtese, Prótese e Material Especial */}
      <OPMEDialog
        open={opmeOpen}
        onOpenChange={setOpmeOpen}
        patientId={formPatientId}
        patientName={formPatientName}
        patientBed={formPatientBed}
        patientSector={formPatientSector}
      />
      {/* ── Etapa 3 — Popup de bloqueio: exame de alta complexidade (APAC) ── */}
      <Dialog open={apacBlock.open} onOpenChange={(o) => !o && setApacBlock({ open: false, examName: "", label: "" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15">
              <ShieldAlert className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-center text-base">
              Exame de alta complexidade
            </DialogTitle>
            <DialogDescription className="text-center">
              <span className="font-semibold text-foreground">{apacBlock.examName}</span>
              {" "}é um exame de <span className="font-semibold text-amber-700 dark:text-amber-500">{apacBlock.label}</span> e deve ser solicitado pelo <span className="font-semibold text-foreground">fluxo de Procedimento (APAC)</span>, não como requisição comum.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-muted/50 border border-border/60 p-3 text-[12px] text-muted-foreground leading-relaxed">
            O preenchimento correto garante o faturamento adequado pelo SUS. Recomendamos seguir pelo fluxo APAC, onde este exame já estará pré-selecionado para você.
          </div>

          {/* Saída de exceção — exige justificativa */}
          <details className="group">
            <summary className="cursor-pointer text-[12px] text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
              Preciso continuar como requisição comum (exceção)
            </summary>
            <div className="mt-3 space-y-2.5 pl-1">
              <div>
                <Label className="text-[11px] text-muted-foreground">Motivo da exceção</Label>
                <Select value={apacOverrideReason} onValueChange={setApacOverrideReason}>
                  <SelectTrigger className="h-9 mt-1 text-[12px]">
                    <SelectValue placeholder="Selecione um motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {APAC_OVERRIDE_REASONS.map(r => (
                      <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Complemento (opcional, mas recomendado para análise da gestão)..."
                value={apacOverrideNote}
                onChange={e => setApacOverrideNote(e.target.value)}
                className="text-[12px] min-h-[60px]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={confirmApacOverride}
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-500"
              >
                Continuar como comum (registrar exceção)
              </Button>
            </div>
          </details>

          <DialogFooter className="sm:flex-col sm:space-x-0 gap-2">
            <Button onClick={goToApacFlow} className="w-full">
              Ir para o fluxo correto (APAC)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </div>
        {/* Patient Cockpit — fixed right sidebar */}
        <PatientCockpit patient={cockpitPatient} className="print:hidden" />
      </div>
    </div>
  );
};

// ── APAC Embedded Form ──
const APAC_PROCEDURES: Array<{ code: string; name: string; category: string; instrumento: "APAC" | "AIH" }> = [
  { code: "02.06.01.007-9", name: "TOMOGRAFIA COMPUTADORIZADA DO CRÂNIO", category: "TC", instrumento: "APAC" },
  { code: "02.06.01.008-7", name: "TOMOGRAFIA COMPUTADORIZADA DE FACE / SEIOS DA FACE", category: "TC", instrumento: "APAC" },
  { code: "02.06.01.009-5", name: "TOMOGRAFIA COMPUTADORIZADA DE SELA TÚRCICA", category: "TC", instrumento: "APAC" },
  { code: "02.06.02.003-5", name: "TOMOGRAFIA COMPUTADORIZADA DO PESCOÇO", category: "TC", instrumento: "APAC" },
  { code: "02.06.03.001-0", name: "TOMOGRAFIA COMPUTADORIZADA DO TÓRAX", category: "TC", instrumento: "APAC" },
  { code: "02.06.03.002-9", name: "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN SUPERIOR", category: "TC", instrumento: "APAC" },
  { code: "02.06.03.003-7", name: "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN INFERIOR", category: "TC", instrumento: "APAC" },
  { code: "02.06.03.004-5", name: "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN TOTAL", category: "TC", instrumento: "APAC" },
  { code: "02.06.03.005-3", name: "TOMOGRAFIA COMPUTADORIZADA DE PELVE / BACIA", category: "TC", instrumento: "APAC" },
  { code: "02.06.04.001-6", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA CERVICAL", category: "TC", instrumento: "APAC" },
  { code: "02.06.04.002-4", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA TORÁCICA", category: "TC", instrumento: "APAC" },
  { code: "02.06.04.003-2", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA LOMBO-SACRA", category: "TC", instrumento: "APAC" },
  { code: "02.06.05.001-1", name: "TOMOGRAFIA COMPUTADORIZADA DE ARTICULAÇÕES", category: "TC", instrumento: "APAC" },
  { code: "02.06.05.002-0", name: "TOMOGRAFIA COMPUTADORIZADA DE SEGMENTOS APENDICULARES", category: "TC", instrumento: "APAC" },
  { code: "02.06.01.001-0", name: "ANGIOTOMOGRAFIA DE ARTÉRIAS CERVICO CEREBRAIS", category: "TC", instrumento: "APAC" },
  { code: "02.06.01.002-8", name: "ANGIOTOMOGRAFIA DE AORTA TORÁCICA", category: "TC", instrumento: "APAC" },
  { code: "02.06.01.003-6", name: "ANGIOTOMOGRAFIA DE AORTA ABDOMINAL", category: "TC", instrumento: "APAC" },
  { code: "02.06.01.004-4", name: "ANGIOTOMOGRAFIA CORONARIANA", category: "TC", instrumento: "APAC" },
  { code: "02.06.01.005-2", name: "ANGIOTOMOGRAFIA DE ARTÉRIAS PULMONARES (TEP)", category: "TC", instrumento: "APAC" },
  { code: "02.07.01.001-3", name: "RESSONÂNCIA MAGNÉTICA DE CRÂNIO", category: "RM", instrumento: "APAC" },
  { code: "02.07.01.002-1", name: "RESSONÂNCIA MAGNÉTICA DE SELA TÚRCICA", category: "RM", instrumento: "APAC" },
  { code: "02.07.02.001-9", name: "RESSONÂNCIA MAGNÉTICA DE COLUNA CERVICAL", category: "RM", instrumento: "APAC" },
  { code: "02.07.02.002-7", name: "RESSONÂNCIA MAGNÉTICA DE COLUNA TORÁCICA", category: "RM", instrumento: "APAC" },
  { code: "02.07.02.003-5", name: "RESSONÂNCIA MAGNÉTICA DE COLUNA LOMBO-SACRA", category: "RM", instrumento: "APAC" },
  { code: "02.07.03.001-4", name: "RESSONÂNCIA MAGNÉTICA DE TÓRAX", category: "RM", instrumento: "APAC" },
  { code: "02.07.03.002-2", name: "RESSONÂNCIA MAGNÉTICA DE ABDOMEN SUPERIOR", category: "RM", instrumento: "APAC" },
  { code: "02.07.03.003-0", name: "RESSONÂNCIA MAGNÉTICA DE PELVE", category: "RM", instrumento: "APAC" },
  { code: "02.07.04.001-0", name: "RESSONÂNCIA MAGNÉTICA DE ARTICULAÇÃO", category: "RM", instrumento: "APAC" },
  { code: "02.05.02.001-7", name: "DOPPLER COLORIDO DE VASOS CERVICAIS (CARÓTIDAS E VERTEBRAIS)", category: "DOPPLER", instrumento: "APAC" },
  { code: "02.05.02.002-5", name: "DOPPLER COLORIDO VENOSO DE MEMBROS INFERIORES", category: "DOPPLER", instrumento: "APAC" },
  { code: "02.05.02.003-3", name: "DOPPLER COLORIDO ARTERIAL DE MEMBROS INFERIORES", category: "DOPPLER", instrumento: "APAC" },
  { code: "02.05.02.004-1", name: "DOPPLER COLORIDO VENOSO DE MEMBROS SUPERIORES", category: "DOPPLER", instrumento: "APAC" },
  { code: "02.05.02.005-0", name: "DOPPLER COLORIDO DE AORTA E ARTÉRIAS RENAIS", category: "DOPPLER", instrumento: "APAC" },
  { code: "02.05.01.003-0", name: "ULTRASSONOGRAFIA DE ABDOMEN TOTAL", category: "USG", instrumento: "APAC" },
  { code: "02.05.01.004-8", name: "ULTRASSONOGRAFIA DE TÓRAX", category: "USG", instrumento: "APAC" },
  { code: "02.05.01.005-6", name: "ECOCARDIOGRAMA TRANSTORÁCICO", category: "USG", instrumento: "APAC" },
  { code: "02.07.03.004-9", name: "COLANGIORRESSONÂNCIA (CPRM)", category: "RM", instrumento: "APAC" },
  { code: "02.07.01.003-0", name: "ANGIORRESSONÂNCIA DE CRÂNIO", category: "RM", instrumento: "APAC" },
  { code: "02.07.03.005-7", name: "RESSONÂNCIA MAGNÉTICA DE FÍGADO E VIAS BILIARES", category: "RM", instrumento: "APAC" },
  { code: "02.07.03.006-5", name: "RESSONÂNCIA MAGNÉTICA DE PÂNCREAS", category: "RM", instrumento: "APAC" },
  { code: "02.06.01.006-0", name: "ANGIOTOMOGRAFIA DE ARTÉRIAS RENAIS", category: "TC", instrumento: "APAC" },
];

const APAC_QUICK_ACCESS = [
  { code: "02.06.01.007-9", label: "TC Crânio" },
  { code: "02.06.03.001-0", label: "TC Tórax" },
  { code: "02.06.03.002-9", label: "TC Abdome Sup" },
  { code: "02.06.03.003-7", label: "TC Abdome Inf" },
  { code: "02.06.03.004-5", label: "TC Abdome Total" },
  { code: "02.06.01.005-2", label: "AngioTC Pulmonar" },
  { code: "02.06.01.001-0", label: "AngioTC Cervical" },
  { code: "02.06.03.005-3", label: "TC Pelve" },
];


// Procedimentos AIH (SIGTAP 03.xx / 04.xx) — instrumento AIH
const AIH_PROCEDURES_SIGTAP: Array<{ code: string; name: string; category: string; instrumento: "APAC" | "AIH" }> = [
  { code: "03.03.06.019-0", name: "TRATAMENTO DE PNEUMONIA OU INFLUENZA", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.04.014-9", name: "TRATAMENTO DE AVC ISQUÊMICO OU HEMORRÁGICO AGUDO", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.06.002-6", name: "TRATAMENTO DE INFECÇÃO DO TRATO URINÁRIO", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.02.001-4", name: "TRATAMENTO DE INSUFICIÊNCIA CARDÍACA", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.06.018-2", name: "TRATAMENTO DE SEPTICEMIA", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.04.001-7", name: "TRATAMENTO DE CRISE HIPERTENSIVA", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.03.003-0", name: "TRATAMENTO DE DIABETES MELLITUS", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.10.011-0", name: "TRATAMENTO DE INSUFICIÊNCIA RENAL AGUDA", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.06.007-7", name: "TRATAMENTO DE CELULITE", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.02.003-0", name: "TRATAMENTO DE INFARTO AGUDO DO MIOCÁRDIO", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.07.002-0", name: "TRATAMENTO DE ABDOME AGUDO", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.06.003-4", name: "TRATAMENTO DE ERISIPELA", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.04.003-3", name: "TRATAMENTO DE EPILEPSIA", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.02.004-9", name: "TRATAMENTO DE ANGINA INSTÁVEL", category: "CLÍNICA", instrumento: "AIH" },
  { code: "03.03.08.004-9", name: "TRATAMENTO DE DPOC", category: "CLÍNICA", instrumento: "AIH" },
  { code: "04.08.04.001-4", name: "TRATAMENTO CIRÚRGICO DE FRATURA DO FÊMUR", category: "CIRÚRGICA", instrumento: "AIH" },
  { code: "04.07.02.003-3", name: "COLECISTECTOMIA VIDEOLAPAROSCÓPICA", category: "CIRÚRGICA", instrumento: "AIH" },
  { code: "04.07.02.010-6", name: "APENDICECTOMIA", category: "CIRÚRGICA", instrumento: "AIH" },
  { code: "04.07.02.004-1", name: "HERNIORRAFIA", category: "CIRÚRGICA", instrumento: "AIH" },
  { code: "04.12.02.002-1", name: "TRATAMENTO CIRÚRGICO DE FRATURA DO TORNOZELO", category: "CIRÚRGICA", instrumento: "AIH" },
  { code: "04.14.01.009-2", name: "TRATAMENTO CIRÚRGICO DE HÉRNIA INGUINAL", category: "CIRÚRGICA", instrumento: "AIH" },
  { code: "04.11.06.027-0", name: "TRAQUEOSTOMIA", category: "CIRÚRGICA", instrumento: "AIH" },
  { code: "04.11.06.019-9", name: "DRENAGEM DE TÓRAX", category: "CIRÚRGICA", instrumento: "AIH" },
  { code: "04.11.06.025-4", name: "LAPAROTOMIA EXPLORADORA", category: "CIRÚRGICA", instrumento: "AIH" },
];

// Lista unificada SIGTAP (APAC + AIH)
const SIGTAP_PROCEDURES = [...APAC_PROCEDURES, ...AIH_PROCEDURES_SIGTAP];

// Deriva instrumento pelo código SIGTAP ou por campo explícito
function getInstrumento(code: string): "APAC" | "AIH" | null {
  if (!code || !code.trim()) return null;
  const proc = SIGTAP_PROCEDURES.find(p => p.code === code);
  if (proc) return proc.instrumento;
  // Heurística: código começa com 02. → APAC; 03./04. → AIH
  if (code.startsWith("02.")) return "APAC";
  if (code.startsWith("03.") || code.startsWith("04.")) return "AIH";
  return null; // custom sem padrão conhecido → SEM CÓDIGO
}

const APAC_INSTITUTION = {
  name: "HOSPITAL MUNICIPAL DJALMA MARQUES",
  cnes: "2308762",
};

// ── Builder do HTML do Laudo APAC para impressão isolada (janela própria) ──
// Mantém o layout SUS oficial (5 colunas, faixas escuras, página A4 única) e
// é totalmente independente da UI da página — evita que outros painéis
// vazem para o PDF.
function buildApacHtml(input: {
  institution: { name: string; cnes: string };
  patient: {
    name: string; record: string; cpf: string; cns: string; dob: string;
    sex: string; motherName: string; phone: string; address: string;
    city: string; uf: string;
  };
  procedures: Array<{ code: string; name: string; qty: number }>;
  diagnosis: string;
  cidPrimary: string;
  cidSecondary: string;
  cidAssociated: string;
  observations: string;
  doctor: { name: string; cpf: string; crm: string };
  today: string;
}): string {
  const esc = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const up = (s: string) => esc((s || "").toUpperCase());
  const dobFmt = (() => {
    if (!input.patient.dob) return "";
    try { return format(new Date(input.patient.dob + "T12:00:00"), "dd/MM/yyyy"); }
    catch { return ""; }
  })();
  const sexFmt = input.patient.sex === "M" ? "Masculino" : input.patient.sex === "F" ? "Feminino" : "";
  const main = input.procedures[0];
  const secRows = [1, 2, 3, 4, 5].map((idx) => {
    const proc = input.procedures[idx];
    const fn = 18 + (idx - 1) * 3;
    return `<tr>
      <td><span class="lbl">${fn} — Código</span><div class="val-mono">${esc(proc?.code || "")}</div></td>
      <td colspan="3"><span class="lbl">${fn + 1} — Nome do Procedimento</span><div class="val">${esc(proc?.name || "")}</div></td>
      <td><span class="lbl">${fn + 2} — Qtde.</span><div class="val" style="text-align:center">${esc(String(proc?.qty || ""))}</div></td>
    </tr>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Laudo APAC</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  html, body { margin: 0; padding: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Arial, Helvetica, sans-serif; color: #000; }
  .apac-root { width: 186mm; height: 273mm; box-sizing: border-box; display: flex; flex-direction: column; margin: 0 auto; }
  .apac-root * { box-sizing: border-box; }
  .apac-doc-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 3px; }
  .apac-doc-header .apac-sus { font-size: 6.5pt; margin: 0; color: #333; }
  .apac-doc-header .apac-title { font-size: 9pt; font-weight: 700; margin: 2px 0 0 0; letter-spacing: 0.3px; }
  .apac-form { width: 100%; border-collapse: collapse; table-layout: fixed; flex: 1; }
  .apac-form col.c1, .apac-form col.c2, .apac-form col.c3 { width: 22%; }
  .apac-form col.c4, .apac-form col.c5 { width: 17%; }
  .apac-form td, .apac-form th { border: 0.5pt solid #000; padding: 2px 4px; vertical-align: top; font-size: 8pt; line-height: 1.2; }
  .apac-form .sec { background: #1e293b; color: #fff; font-weight: 700; font-size: 7.5pt; padding: 2.5px 4px; text-transform: uppercase; letter-spacing: 0.3px; text-align: center; }
  .apac-form .lbl { font-size: 6.5pt; color: #555; display: block; line-height: 1.1; margin-bottom: 0.5px; white-space: nowrap; }
  .apac-form .val { font-size: 8.5pt; font-weight: 500; min-height: 11px; line-height: 1.2; }
  .apac-form .val-mono { font-family: 'Courier New', monospace; font-size: 8.5pt; font-weight: 600; min-height: 11px; line-height: 1.2; }
  .apac-form .obs-space { min-height: 95px; white-space: pre-wrap; font-size: 8pt; font-weight: 400; line-height: 1.25; }
  .apac-form .sig-space { height: 12px; }
  .apac-form .sig-space-sm { height: 9px; }
</style></head><body>
<div class="apac-root">
  <div class="apac-doc-header">
    <p class="apac-sus">SISTEMA ÚNICO DE SAÚDE — SUS &nbsp;·&nbsp; MINISTÉRIO DA SAÚDE</p>
    <p class="apac-title">LAUDO PARA SOLICITAÇÃO / AUTORIZAÇÃO DE PROCEDIMENTO AMBULATORIAL</p>
  </div>
  <table class="apac-form">
    <colgroup><col class="c1"/><col class="c2"/><col class="c3"/><col class="c4"/><col class="c5"/></colgroup>
    <tbody>
      <tr><td colspan="5" class="sec">Identificação do Estabelecimento de Saúde (Solicitante)</td></tr>
      <tr>
        <td colspan="4"><span class="lbl">1 — Nome do Estabelecimento</span><div class="val">${esc(input.institution.name)}</div></td>
        <td><span class="lbl">2 — CNES</span><div class="val-mono" style="font-size:9pt">${esc(input.institution.cnes)}</div></td>
      </tr>
      <tr><td colspan="5" class="sec">Identificação do Paciente</td></tr>
      <tr>
        <td colspan="3"><span class="lbl">3 — Nome do Paciente</span><div class="val">${up(input.patient.name)}</div></td>
        <td colspan="2"><span class="lbl">4 — Nº do Prontuário</span><div class="val">${esc(input.patient.record)}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">5a — CPF</span><div class="val-mono">${esc(input.patient.cpf)}</div></td>
        <td><span class="lbl">5 — CNS</span><div class="val">${esc(input.patient.cns)}</div></td>
        <td><span class="lbl">6 — Data de Nascimento</span><div class="val">${esc(dobFmt)}</div></td>
        <td colspan="2"><span class="lbl">7 — Sexo</span><div class="val">${esc(sexFmt)}</div></td>
      </tr>
      <tr>
        <td colspan="3"><span class="lbl">8 — Nome da Mãe ou Responsável</span><div class="val">${up(input.patient.motherName)}</div></td>
        <td colspan="2"><span class="lbl">9 — Telefone de Contato</span><div class="val">${esc(input.patient.phone)}</div></td>
      </tr>
      <tr>
        <td colspan="2"><span class="lbl">10 — Endereço (Rua, Nº)</span><div class="val">${up(input.patient.address)}</div></td>
        <td><span class="lbl">11 — Município</span><div class="val">${up(input.patient.city)}</div></td>
        <td><span class="lbl">13 — UF</span><div class="val">${esc(input.patient.uf)}</div></td>
        <td><span class="lbl">14 — CEP</span><div class="val"></div></td>
      </tr>
      <tr><td colspan="5" class="sec">Procedimento(s) Solicitado(s)</td></tr>
      <tr>
        <td><span class="lbl">15 — Cód. Proc. Principal</span><div class="val-mono">${esc(main?.code || "")}</div></td>
        <td colspan="3"><span class="lbl">16 — Nome do Procedimento Principal</span><div class="val">${esc(main?.name || "")}</div></td>
        <td><span class="lbl">17 — Qtde.</span><div class="val" style="text-align:center">${esc(String(main?.qty || ""))}</div></td>
      </tr>
      <tr><td colspan="5" class="sec">Procedimento(s) Secundário(s)</td></tr>
      ${secRows}
      <tr><td colspan="5" class="sec">Justificativa do(s) Procedimento(s) Solicitado(s)</td></tr>
      <tr>
        <td colspan="2"><span class="lbl">33 — Diagnóstico Inicial</span><div class="val">${up(input.diagnosis)}</div></td>
        <td><span class="lbl">34 — CID-10 Principal</span><div class="val-mono">${up(input.cidPrimary)}</div></td>
        <td><span class="lbl">35 — CID-10 Secundário</span><div class="val-mono">${up(input.cidSecondary)}</div></td>
        <td><span class="lbl">36 — CID-10 Causas Assoc.</span><div class="val-mono">${up(input.cidAssociated)}</div></td>
      </tr>
      <tr>
        <td colspan="5"><span class="lbl">37 — Observações</span><div class="obs-space">${esc(input.observations)}</div></td>
      </tr>
      <tr><td colspan="5" class="sec">Solicitação</td></tr>
      <tr>
        <td colspan="2"><span class="lbl">38 — Nome do Profissional Solicitante</span><div class="val">${up(input.doctor.name)}</div></td>
        <td><span class="lbl">39 — Data da Solicitação</span><div class="val">${esc(input.today)}</div></td>
        <td><span class="lbl">40 — Doc. (X) CPF ( ) CNS</span><div class="val-mono">${esc(input.doctor.cpf)}</div></td>
        <td><span class="lbl">42 — Assinatura / Carimbo</span><div class="sig-space"></div></td>
      </tr>
      <tr>
        <td colspan="5"><span class="lbl">41 — Nº do Documento / CRM</span><div class="val-mono">${esc(input.doctor.cpf)} ${input.doctor.crm ? `· CRM: ${esc(input.doctor.crm)}` : ""}</div></td>
      </tr>
      <tr><td colspan="5" class="sec">Autorização (Preenchimento pelo Autorizador)</td></tr>
      <tr>
        <td colspan="2"><span class="lbl">43 — Nome do Profissional Autorizador</span><div class="sig-space-sm"></div></td>
        <td><span class="lbl">44 — Cód. Órgão Emissor</span><div class="sig-space-sm"></div></td>
        <td><span class="lbl">45 — Doc. ( ) CPF ( ) CNS</span><div class="sig-space-sm"></div></td>
        <td><span class="lbl">49 — Nº da Autorização (APAC)</span><div class="sig-space-sm"></div></td>
      </tr>
      <tr>
        <td><span class="lbl">46 — Nº do Documento</span><div class="sig-space-sm"></div></td>
        <td colspan="2"><span class="lbl">47 — Data da Autorização</span><div class="sig-space-sm"></div></td>
        <td colspan="2"><span class="lbl">48 — Assinatura e Carimbo (Autorizador)</span><div class="sig-space"></div></td>
      </tr>
    </tbody>
  </table>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>
</body></html>`;
}


interface ApacSelectedProcedure {
  code: string;
  name: string;
  qty: number;
  instrumento: "APAC" | "AIH" | null; // derivado do SIGTAP; null = sem código
}

function CollapsibleInfoCard({ title, summary, badge, children }: { title: string; summary: string; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-xs text-foreground truncate">{summary}</p>
        </div>
        {badge && <Badge variant="outline" className="shrink-0 text-[10px]">{badge}</Badge>}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <CardContent className="pt-3 border-t">{children}</CardContent>}
    </Card>
  );
}

function ApacEmbeddedForm({ patientName: initialPatientName, patientBed, patientSector, patientId, onSelectPatient, preselectProcedure, onPreselectConsumed, onProcedureRegistered }: {
  patientName: string;
  patientBed: string;
  patientSector: string;
  patientId: string | null;
  onSelectPatient?: (p: { id: string; name: string; bed_number: string | null; sector: string | null }) => void;
  preselectProcedure?: string;
  onPreselectConsumed?: () => void;
  onProcedureRegistered?: () => void;
}) {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const printRef = useRef<HTMLDivElement>(null);
  const [importingAdmission, setImportingAdmission] = useState(false);
  const [importingEvolution, setImportingEvolution] = useState(false);
  const [doctorName, setDoctorName] = useState("");
  const [doctorCRM, setDoctorCRM] = useState("");
  const [doctorCPF, setDoctorCPF] = useState("");

  const [apacPatientName, setApacPatientName] = useState(initialPatientName);
  const [patientRecord, setPatientRecord] = useState("");
  const [patientCPF, setPatientCPF] = useState("");
  const [patientCNS, setPatientCNS] = useState("");
  const [patientDOB, setPatientDOB] = useState("");
  const [patientSex, setPatientSex] = useState("");
  const [patientMotherName, setPatientMotherName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [patientCity, setPatientCity] = useState("São Luís");
  const [patientUF, setPatientUF] = useState("MA");
  // UUID permanente do paciente (patients.patient_registry_id) — persiste entre admissões
  const [patientRegistryId, setPatientRegistryId] = useState<string | null>(null);

  // ── Seletor de paciente (apenas quando entrou em /requisicoes sem patientId) ──
  const [unitPatients, setUnitPatients] = useState<Array<{ id: string; name: string; bed_number: string | null; sector: string | null; medical_record: string | null }>>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const needsPicker = !asUuidOrNull(patientId);
  useEffect(() => {
    if (!needsPicker || !currentHospital?.id || !currentState?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("patients")
        .select("id, name, bed_number, sector, medical_record")
        .eq("unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .order("bed_number", { ascending: true })
        .limit(500);
      if (!cancelled && data) setUnitPatients(data as any);
    })();
    return () => { cancelled = true; };
  }, [needsPicker, currentHospital?.id, currentState?.id]);
  const filteredPickerPatients = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!q) return unitPatients.slice(0, 50);
    return unitPatients.filter(p => {
      const hay = `${p.name || ""} ${p.bed_number || ""} ${p.medical_record || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return hay.includes(q);
    }).slice(0, 50);
  }, [unitPatients, pickerSearch]);

  const [selectedProcedures, setSelectedProcedures] = useState<ApacSelectedProcedure[]>([]);
  const [customProcCode, setCustomProcCode] = useState("");
  const [customProcName, setCustomProcName] = useState("");
  const [searchProcedure, setSearchProcedure] = useState("");

  // Quando vem um exame pré-selecionado do redirecionamento da Imagem,
  // preenche a busca de procedimento para o médico localizar rapidamente.
  useEffect(() => {
    if (preselectProcedure && preselectProcedure.trim()) {
      setSearchProcedure(preselectProcedure.trim());
      onPreselectConsumed?.();
      toast.info(`Busca preenchida com "${preselectProcedure.trim()}" — selecione o procedimento APAC correspondente`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectProcedure]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [instrumentoFilter, setInstrumentoFilter] = useState<string>("all");
  const [aihRoutingOpen, setAihRoutingOpen] = useState(false); // roteamento AIH por instrumento SIGTAP

  const [diagnosis, setDiagnosis] = useState("");
  const [cidPrimary, setCidPrimary] = useState("");
  // HTML do laudo aguardando a etapa pos-envio. null = nada pendente.
  const [apacPrintHtml, setApacPrintHtml] = useState<string | null>(null);
  const [cidSecondary, setCidSecondary] = useState("");
  const [cidAssociated, setCidAssociated] = useState("");
  const [observations, setObservations] = useState("");
  const [observationsAutoFilled, setObservationsAutoFilled] = useState(false);

  useEffect(() => { setApacPatientName(initialPatientName); }, [initialPatientName]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("profiles").select("full_name, crm, cpf").eq("id", user.id).maybeSingle();
      if (data) { setDoctorName(data.full_name || ""); setDoctorCRM(data.crm || ""); if ((data as any).cpf) setDoctorCPF((data as any).cpf); }
    };
    load();
  }, [user]);

  // Auto-hidratação do prontuário do paciente vinculado (patient_registry via patients.patient_registry_id)
  useEffect(() => {
    setPatientRegistryId(null); // reseta ao trocar de paciente, evita ID obsoleto
    const validPid = asUuidOrNull(patientId);
    if (!validPid) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: pat } = await supabase
          .from("patients")
          .select("patient_registry_id, medical_record, name")
          .eq("id", validPid)
          .maybeSingle();
        if (!pat || cancelled) return;
        const registryId = (pat as any).patient_registry_id as string | null;
        if (!cancelled) setPatientRegistryId(registryId);

        // Diagnóstico/CID e justificativa via admissão mais recente (ORDER BY garante)
        const { data: adm } = await supabase
          .from("admission_histories")
          .select("diagnostic_hypothesis, primary_cid10, secondary_cid10, chief_complaint, clinical_history, initial_conduct")
          .eq("patient_id", validPid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (adm && !cancelled) {
          setDiagnosis((adm as any).diagnostic_hypothesis || "");
          setCidPrimary((adm as any).primary_cid10 || "");
          setCidSecondary((adm as any).secondary_cid10 || "");
          const admParts: string[] = [];
          if ((adm as any).chief_complaint)  admParts.push(`QP: ${(adm as any).chief_complaint}`);
          if ((adm as any).clinical_history) admParts.push(`HDA: ${(adm as any).clinical_history}`);
          if ((adm as any).diagnostic_hypothesis) admParts.push(`HD: ${(adm as any).diagnostic_hypothesis}`);
          if ((adm as any).initial_conduct)  admParts.push(`Conduta: ${(adm as any).initial_conduct}`);
          if (admParts.length > 0) {
            setObservations(prev => {
              if (prev.trim()) return prev;
              setObservationsAutoFilled(true);
              return admParts.join("\n");
            });
          }
        }

        if (!registryId) {
          // Sem registry: hidrata prontuário e tenta CPF direto na tabela patients
          const { data: patExtra } = await supabase
            .from("patients")
            .select("cpf")
            .eq("id", validPid)
            .maybeSingle();
          if (cancelled) return;
          if ((patExtra as any)?.cpf) setPatientCPF((patExtra as any).cpf);
          if ((pat as any).medical_record) setPatientRecord((pat as any).medical_record);
          return;
        }

        const { data: reg } = await supabase
          .from("patient_registry")
          .select("medical_record, full_name, cpf, cns, birth_date, sex, mother_name, phone, address, city, state")
          .eq("id", registryId)
          .maybeSingle();
        if (!reg || cancelled) return;

        const r = reg as any;
        setPatientRecord(r.medical_record || (pat as any).medical_record || "");
        setApacPatientName(r.full_name || "");
        setPatientCPF(r.cpf || "");
        setPatientCNS(r.cns || "");
        setPatientDOB(r.birth_date ? String(r.birth_date).slice(0, 10) : "");
        setPatientSex(r.sex === "M" || r.sex === "F" ? r.sex : "");
        setPatientMotherName(r.mother_name || "");
        setPatientPhone(r.phone || "");
        setPatientAddress(r.address || "");
        if (r.city) setPatientCity(r.city);
        if (r.state) setPatientUF(r.state);
      } catch {
        /* hidratação silenciosa */
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  const addProcedure = (proc: { code: string; name: string }) => {
    if (selectedProcedures.find((p) => p.code === proc.code)) { toast.info("Procedimento já adicionado"); return; }
    if (selectedProcedures.length >= 6) { toast.error("Máximo de 6 procedimentos por laudo"); return; }
    const instrumento = getInstrumento(proc.code);
    // Warn when mixing APAC and AIH instruments in the same form
    if (selectedProcedures.length > 0 && instrumento) {
      const existingInstrumento = selectedProcedures[0].instrumento;
      if (existingInstrumento && existingInstrumento !== instrumento) {
        toast.warning(`Misturando ${existingInstrumento} com ${instrumento} — cada instrumento exige formulário separado`, { duration: 5000 });
      }
    }
    setSelectedProcedures((prev) => [...prev, { code: proc.code, name: proc.name, qty: 1, instrumento }]);
    if (instrumento === "AIH") toast.info("Procedimento AIH — será gerado Laudo AIH");
    else if (instrumento === null) toast.warning("Procedimento sem código SIGTAP — será sinalizado internamente");
    else toast.success("Procedimento adicionado");
  };

  const removeProcedure = (code: string) => setSelectedProcedures((prev) => prev.filter((p) => p.code !== code));

  const resetApacForm = () => {
    setApacPatientName(initialPatientName); setPatientRecord(""); setPatientCPF(""); setPatientCNS("");
    setPatientDOB(""); setPatientSex(""); setPatientMotherName("");
    setPatientPhone(""); setPatientAddress("");
    setSelectedProcedures([]); setDiagnosis(""); setCidPrimary(""); setCidSecondary(""); setCidAssociated(""); setObservations("");
    toast.info("Formulário limpo");
  };

  // Registra a solicitação de procedimento no histórico do paciente.
  //
  // ANTES era "rastro": chamado com `void` DEPOIS de imprimir, e uma falha só
  // gerava toast. Ou seja, o laudo saía impresso e podia não existir no
  // sistema. Agora BLOQUEIA — gravar é o objetivo do ato, não efeito colateral.
  const registrarProcedimento = async (): Promise<boolean> => {
    if (!user?.id || !currentHospital?.id || !currentState?.id) {
      toast.error("Não foi possível registrar a solicitação", {
        description: "Contexto de unidade ou usuário ausente.",
      });
      return false;
    }
    const requesterName = (() => {
      const nm = (doctorName || "").trim() || user.email?.split("@")[0] || "Médico";
      const crm = (doctorCRM || "").trim();
      return crm ? `${nm} — CRM ${crm}` : nm;
    })();
    try {
      await registrarSolicitacao({
        category: "procedimento", // taxonomia preservada
        patientId,
        patientRegistryId: patientRegistryId ?? null,
        patientName: apacPatientName,
        patientBed,
        patientSector,
        items: selectedProcedures.map(p => ({ name: p.code ? `${p.name} (${p.code})` : p.name })),
        clinicalIndication: null, // o laudo APAC já contempla o procedimento no corpo
        priority: "rotina",
        notes: "[PROCEDIMENTO — Laudo APAC gerado]",
        requestedBy: user.id,
        requestedByName: requesterName,
        hospitalUnitId: currentHospital.id,
        stateId: currentState.id,
      });
      onProcedureRegistered?.();
      return true;
    } catch (err) {
      toast.error("Falha ao registrar a solicitação", {
        description: err instanceof Error ? err.message : "Erro desconhecido. O laudo não foi impresso.",
      });
      return false;
    }
  };

  const handlePrint = async () => {
    /*
      Obrigatorios do APAC, definidos pelo gestor: nome do paciente, CID e
      procedimento.

      O CID faltava. Sem ele o laudo sai com o campo 34 (CID-10 Principal) em
      branco e o SUS devolve — mas o formulario deixava imprimir, e a partir da
      fase 2 tambem deixava GRAVAR. O registro entrava no historico parecendo
      completo e nunca geraria documento aceito.

      Bloqueio ANTES do roteamento para AIH: o Laudo AIH tem o mesmo campo de
      CID, entao a exigencia vale para os dois caminhos.
    */
    if (selectedProcedures.length === 0) { toast.error("Adicione ao menos um procedimento"); return; }
    if (!apacPatientName.trim()) { toast.error("Informe o nome do paciente"); return; }
    if (!cidPrimary.trim()) {
      toast.error("Informe o CID-10 Principal", {
        description: "Obrigatório no laudo — sem ele o documento não é aceito.",
      });
      return;
    }
    const hasAih = selectedProcedures.some(p => p.instrumento === "AIH");
    if (hasAih) {
      // Roteamento: procedimento AIH → abre Laudo AIH
      setAihRoutingOpen(true);
      return;
    }
    // Gera o HTML do laudo APAC em janela isolada (garante página única
    // sem interferência do restante da UI da página).
    const html = buildApacHtml({
      institution: APAC_INSTITUTION,
      patient: {
        name: apacPatientName,
        record: patientRecord,
        cpf: patientCPF,
        cns: patientCNS,
        dob: patientDOB,
        sex: patientSex,
        motherName: patientMotherName,
        phone: patientPhone,
        address: patientAddress,
        city: patientCity,
        uf: patientUF,
      },
      procedures: selectedProcedures,
      diagnosis,
      cidPrimary,
      cidSecondary,
      cidAssociated,
      observations,
      doctor: { name: doctorName, cpf: doctorCPF, crm: doctorCRM },
      today: todayFormatted,
    });
    // Grava PRIMEIRO. Se falhar, nada é impresso — laudo no papel sem
    // contrapartida no sistema é o furo de rastreabilidade que este trabalho
    // veio fechar.
    const ok = await registrarProcedimento();
    if (!ok) return;

    /*
      O ato terminou aqui: a requisicao foi ENVIADA. A impressao vira um passo
      seguinte, oferecido — nao uma consequencia automatica do botao.

      Mesmo desenho da validacao de evolucao e prescricao (34f3a868): o botao
      cumpre o ato, e o documento se oferece depois. O usuario que so queria
      registrar nao leva uma janela de impressao na cara; o que precisa do papel
      esta a um clique.

      O HTML ja foi montado ANTES da gravacao de proposito: se buildApacHtml
      falhasse depois de gravar, existiria solicitacao sem laudo possivel.
    */
    setApacPrintHtml(html);
  };


  const importAdmission = async () => {
    const validPid = asUuidOrNull(patientId);
    if (!validPid) { toast.error("Paciente não vinculado ao mapa (sem ID válido)"); return; }
    setImportingAdmission(true);
    try {
      const { data } = await supabase
        .from("admission_histories")
        .select("chief_complaint, clinical_history, diagnostic_hypothesis, initial_conduct")
        .eq("patient_id", validPid)
        .maybeSingle();
      if (!data) { toast.error("Nenhuma admissão encontrada para este paciente"); return; }
      const parts: string[] = [];
      if (data.chief_complaint) parts.push(`QP: ${data.chief_complaint}`);
      if (data.clinical_history) parts.push(`HDA: ${data.clinical_history}`);
      if (data.diagnostic_hypothesis) parts.push(`HD: ${data.diagnostic_hypothesis}`);
      if (data.initial_conduct) parts.push(`Conduta: ${data.initial_conduct}`);
      if (parts.length === 0) { toast.info("Admissão sem dados preenchidos"); return; }
      setObservations(prev => prev ? prev + "\n\n" + parts.join("\n") : parts.join("\n"));
      toast.success("Dados da admissão importados");
    } catch { toast.error("Erro ao importar admissão"); }
    finally { setImportingAdmission(false); }
  };

  const importEvolution = async () => {
    const validPid = asUuidOrNull(patientId);
    if (!validPid) { toast.error("Paciente não vinculado ao mapa (sem ID válido)"); return; }
    setImportingEvolution(true);
    try {
      // 1. patient_registry_id do paciente atual
      const { data: pat } = await supabase
        .from("patients")
        .select("patient_registry_id")
        .eq("id", validPid)
        .maybeSingle();
      const registryId = (pat as any)?.patient_registry_id ?? null;

      // 2. Última evolução VALIDADA em clinical_evolutions
      let evQuery = supabase
        .from("clinical_evolutions")
        .select("soap_data, diagnostic_hypotheses, created_at, validated_at")
        .eq("status", "validated")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (registryId) {
        evQuery = evQuery.or(`patient_id.eq.${validPid},patient_registry_id.eq.${registryId}`);
      } else {
        evQuery = evQuery.eq("patient_id", validPid);
      }
      const { data: evol } = await evQuery.maybeSingle();

      // 3. CID da admissão ativa
      let ahQuery = supabase
        .from("admission_histories")
        .select("cid_primary, cid_secondary, macro_diagnosis, diagnostic_hypothesis")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (registryId) {
        ahQuery = ahQuery.or(`patient_id.eq.${validPid},patient_registry_id.eq.${registryId}`);
      } else {
        ahQuery = ahQuery.eq("patient_id", validPid);
      }
      const { data: ah } = await ahQuery.maybeSingle();

      // 4. CID-10 Principal + Diagnóstico Inicial
      if (ah?.cid_primary) {
        const primaryStr = String(ah.cid_primary);
        const cidMatch = primaryStr.match(/([A-Za-z]\d{2}\.?\d*)/);
        const cidCode = cidMatch ? cidMatch[1].toUpperCase() : "";
        if (cidCode) setCidPrimary(cidCode);

        let desc = primaryStr.replace(/^[A-Za-z]\d{2}\.?\d*\s*[-–—]\s*/, "").trim();
        if (!desc || desc === primaryStr.trim()) {
          try {
            const { data: cidEntry } = await supabase
              .from("cid10_codes")
              .select("description")
              .ilike("code", cidCode)
              .limit(1)
              .maybeSingle();
            desc = (cidEntry as any)?.description || (ah as any).macro_diagnosis || (ah as any).diagnostic_hypothesis || "";
          } catch {
            desc = (ah as any).macro_diagnosis || (ah as any).diagnostic_hypothesis || "";
          }
        }
        if (desc) setDiagnosis(desc);
      }

      // 5. Observações a partir do SOAP
      let imported = false;
      if (evol?.soap_data) {
        const soap = evol.soap_data as any;
        const evolDate = evol.validated_at || evol.created_at;
        const dateStr = evolDate ? new Date(evolDate).toLocaleDateString("pt-BR") : "";
        const stripHtml = (html: string) =>
          (html || "").replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();

        const parts: string[] = [];
        if (dateStr) parts.push(`Evolução de ${dateStr}:`);

        const subj = stripHtml(soap.subjective || soap.evolucao || "");
        if (subj) parts.push(subj);

        const assess = stripHtml(soap.assessment || "");
        if (assess && assess !== subj) parts.push(`Avaliação: ${assess}`);

        const plan = stripHtml(soap.plan || "");
        if (plan) parts.push(`Conduta: ${plan}`);

        if (evol.diagnostic_hypotheses) {
          let hypo: any = evol.diagnostic_hypotheses;
          try {
            const parsed = typeof hypo === "string" ? JSON.parse(hypo) : hypo;
            hypo = Array.isArray(parsed)
              ? parsed.map((h: any) => String(h).trim()).filter(Boolean).join("; ")
              : String(parsed).trim();
          } catch { /* mantém */ }
          if (String(hypo).trim()) parts.push(`Hipóteses: ${String(hypo).trim()}`);
        }

        const obsText = parts.join("\n").trim();
        if (obsText) {
          setObservations(obsText);
          setObservationsAutoFilled(true);
          imported = true;
        }
      }

      if (imported || ah?.cid_primary) {
        toast.success("Dados da evolução importados");
      } else {
        toast.info("Nenhuma evolução validada encontrada");
      }
    } catch (err) {
      console.error("[APAC] importEvolution error:", err);
      toast.error("Erro ao importar evolução");
    } finally { setImportingEvolution(false); }
  };

  const filteredProcedures = SIGTAP_PROCEDURES.filter((p) => {
    const matchSearch = searchProcedure === "" || p.name.toLowerCase().includes(searchProcedure.toLowerCase()) || p.code.includes(searchProcedure);
    const matchCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchInstrumento = instrumentoFilter === "all" || p.instrumento === instrumentoFilter;
    return matchSearch && matchCategory && matchInstrumento;
  });

  const todayFormatted = format(new Date(), "dd/MM/yyyy");

  return (
    <>
      <div className="space-y-4 print:hidden mt-4">
        {/* Quick access — neutral, soft styling */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acesso rápido — Tomografias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {APAC_QUICK_ACCESS.map((qa) => {
                const proc = APAC_PROCEDURES.find((p) => p.code === qa.code);
                const isSelected = selectedProcedures.some((p) => p.code === qa.code);
                return (
                  <Button
                    key={qa.code}
                    size="sm"
                    variant="outline"
                    className={`h-7 text-xs font-normal ${isSelected ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/15 hover:text-primary" : "bg-muted/40 text-foreground border-border hover:bg-accent hover:text-accent-foreground hover:border-primary/40"}`}
                    onClick={() => proc && addProcedure(proc)}
                    disabled={isSelected}
                  >
                    <Plus className="h-3 w-3 mr-1" />{qa.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* PRIMARY: Procedure selection + Justification (highlighted) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-primary/40 ring-1 ring-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                <ScanLine className="h-4 w-4" /> Procedimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={searchProcedure} onChange={(e) => setSearchProcedure(e.target.value)} placeholder="Buscar por nome ou código SIGTAP..." className="pl-9" />
                </div>
                <Select value={instrumentoFilter} onValueChange={setInstrumentoFilter}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="APAC">APAC</SelectItem>
                    <SelectItem value="AIH">AIH</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="TC">TC</SelectItem>
                    <SelectItem value="RM">RM</SelectItem>
                    <SelectItem value="DOPPLER">Doppler</SelectItem>
                    <SelectItem value="USG">USG</SelectItem>
                    <SelectSeparator />
                    <SelectItem value="CLÍNICA">Clínica</SelectItem>
                    <SelectItem value="CIRÚRGICA">Cirúrgica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filteredProcedures.length === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
                  <Search className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  Nenhum procedimento encontrado
                </div>
              )}
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {filteredProcedures.map((proc) => {
                  const isSelected = selectedProcedures.some((p) => p.code === proc.code);
                  return (
                    <button key={proc.code} className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 ${isSelected ? "bg-primary/5 opacity-60" : ""}`} onClick={() => addProcedure(proc)} disabled={isSelected}>
                      <div className="min-w-0 flex-1"><span className="font-mono text-xs text-muted-foreground mr-2">{proc.code}</span><span className="text-foreground">{proc.name}</span></div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className={`text-[10px] font-bold ${proc.instrumento === "AIH" ? "border-purple-400 text-purple-700 bg-purple-50 dark:bg-purple-500/10" : "border-orange-400 text-orange-700 bg-orange-50 dark:bg-orange-500/10"}`}>{proc.instrumento}</Badge>
                        <Badge variant="outline" className="text-[10px]">{proc.category}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Procedimento não listado no SIGTAP
                </p>
                <div className="flex gap-2">
                  <Input
                    value={customProcCode}
                    onChange={(e) => setCustomProcCode(e.target.value)}
                    placeholder="Código SIGTAP (opcional)"
                    className="w-40 font-mono text-xs"
                  />
                  <Input
                    value={customProcName}
                    onChange={(e) => setCustomProcName(e.target.value)}
                    placeholder="Nome do procedimento"
                    className="flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const name = customProcName.trim();
                      if (!name) { toast.error("Informe o nome do procedimento"); return; }
                      const code = customProcCode.trim() || "00.00.00.000-0";
                      if (selectedProcedures.find((p) => p.code === code && p.name === name.toUpperCase())) {
                        toast.info("Procedimento já adicionado"); return;
                      }
                      if (selectedProcedures.length >= 6) {
                        toast.error("Máximo de 6 procedimentos por laudo"); return;
                      }
                      const instrumento = getInstrumento(customProcCode.trim());
                      setSelectedProcedures((prev) => [
                        ...prev,
                        { code, name: name.toUpperCase(), qty: 1, instrumento },
                      ]);
                      if (!instrumento) toast.warning("Procedimento sem código SIGTAP — sinalizará internamente como 'sem código'");
                      setCustomProcCode("");
                      setCustomProcName("");
                      toast.success("Procedimento avulso adicionado");
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Selecionados ({selectedProcedures.length}/6)
                </div>
                {selectedProcedures.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Use o acesso rápido ou busque acima</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedProcedures.map((proc, idx) => (
                      <div key={proc.code} className="flex items-center gap-2 p-1.5 rounded border bg-card">
                        <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">{idx === 0 ? "Princ." : `Sec.${idx}`}</Badge>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 mb-0.5">
                            {proc.instrumento === "AIH" && <Badge className="text-[9px] h-4 px-1.5 bg-purple-600 hover:bg-purple-600">AIH</Badge>}
                            {proc.instrumento === "APAC" && <Badge className="text-[9px] h-4 px-1.5 bg-orange-500 hover:bg-orange-500">APAC</Badge>}
                            {proc.instrumento === null && <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-400 text-amber-700">SEM CÓDIGO</Badge>}
                          </div>
                          <p className="text-xs font-medium text-foreground truncate">{proc.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{proc.code}</p>
                        </div>
                        <Input type="number" min={1} max={99} value={proc.qty} onChange={(e) => { const qty = parseInt(e.target.value) || 1; setSelectedProcedures((prev) => prev.map((p) => (p.code === proc.code ? { ...p, qty } : p))); }} className="w-12 h-7 text-center text-xs" />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeProcedure(proc.code)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/40 ring-1 ring-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Justificativa Clínica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="text-xs text-muted-foreground">Diagnóstico Inicial</Label><Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Descreva o diagnóstico" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs text-muted-foreground">CID-10 Principal *</Label><Input value={cidPrimary} onChange={(e) => setCidPrimary(e.target.value)} placeholder="I63.9" className="font-mono" /></div>
                <div><Label className="text-xs text-muted-foreground">Secundário</Label><Input value={cidSecondary} onChange={(e) => setCidSecondary(e.target.value)} className="font-mono" /></div>
                <div><Label className="text-xs text-muted-foreground">Associado</Label><Input value={cidAssociated} onChange={(e) => setCidAssociated(e.target.value)} className="font-mono" /></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs text-muted-foreground">Observações / Justificativa</Label>
                    {observationsAutoFilled && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30">
                        ✦ Preenchido automaticamente · Editável
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={importAdmission} disabled={!patientId || importingAdmission}>
                      <FileText className="h-3 w-3" /> {importingAdmission ? "..." : "Admissão"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={importEvolution} disabled={!patientId || importingEvolution}>
                      <ClipboardList className="h-3 w-3" /> {importingEvolution ? "..." : "Evolução"}
                    </Button>
                  </div>
                </div>
                <Textarea value={observations} onChange={(e) => { setObservations(e.target.value); setObservationsAutoFilled(false); }} placeholder="Informações clínicas relevantes..." rows={6} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SECONDARY: Pre-filled data — collapsed by default */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <CollapsibleInfoCard title="Estabelecimento solicitante" summary={`${APAC_INSTITUTION.name} · CNES ${APAC_INSTITUTION.cnes}`}>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input value={APAC_INSTITUTION.name} readOnly className="bg-muted/50 font-medium text-sm" />
              </div>
              <div className="w-28">
                <Label className="text-xs text-muted-foreground">CNES</Label>
                <Input value={APAC_INSTITUTION.cnes} readOnly className="bg-muted/50 font-mono font-bold text-sm text-center" />
              </div>
            </div>
          </CollapsibleInfoCard>

          <CollapsibleInfoCard
            title="Identificação do paciente"
            summary={apacPatientName || "—"}
            badge={patientRecord ? `Pront. ${patientRecord}` : undefined}
          >
            <div className="space-y-3">
              {needsPicker && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300">Selecione o paciente para sincronizar prontuário, CPF, CNS, mãe e endereço</Label>
                  </div>
                  <Input
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Buscar por nome, leito ou prontuário..."
                    className="h-8 text-xs"
                  />
                  <div className="max-h-48 overflow-y-auto rounded border border-border bg-background divide-y divide-border">
                    {filteredPickerPatients.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum paciente encontrado nesta unidade.</div>
                    ) : (
                      filteredPickerPatients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { onSelectPatient?.({ id: p.id, name: p.name, bed_number: p.bed_number, sector: p.sector }); setPickerSearch(""); }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted/60 transition"
                        >
                          <span className="text-xs font-medium truncate">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                            {p.bed_number || "—"}{p.medical_record ? ` · ${p.medical_record}` : ""}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Nome do Paciente *</Label>
                  <Input value={apacPatientName} onChange={(e) => setApacPatientName(e.target.value)} placeholder="Nome completo" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nº Prontuário</Label>
                  <Input value={patientRecord} onChange={(e) => setPatientRecord(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><Label className="text-xs text-muted-foreground">CPF</Label><Input value={patientCPF} onChange={(e) => setPatientCPF(e.target.value)} placeholder="000.000.000-00" /></div>
                <div><Label className="text-xs text-muted-foreground">CNS</Label><Input value={patientCNS} onChange={(e) => setPatientCNS(e.target.value)} /></div>
                <div><Label className="text-xs text-muted-foreground">Data Nasc.</Label><Input type="date" value={patientDOB} onChange={(e) => setPatientDOB(e.target.value)} /></div>
                <div>
                  <Label className="text-xs text-muted-foreground">Sexo</Label>
                  <Select value={patientSex} onValueChange={setPatientSex}>
                    <SelectTrigger><SelectValue placeholder="Sel." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Nome da Mãe</Label><Input value={patientMotherName} onChange={(e) => setPatientMotherName(e.target.value)} /></div>
                <div><Label className="text-xs text-muted-foreground">Telefone</Label><Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Endereço</Label><Input value={patientAddress} onChange={(e) => setPatientAddress(e.target.value)} /></div>
                <div><Label className="text-xs text-muted-foreground">Município</Label><Input value={patientCity} onChange={(e) => setPatientCity(e.target.value)} /></div>
                <div><Label className="text-xs text-muted-foreground">UF</Label><Input value={patientUF} onChange={(e) => setPatientUF(e.target.value)} maxLength={2} /></div>
              </div>
            </div>
          </CollapsibleInfoCard>

          <CollapsibleInfoCard
            title="Profissional solicitante"
            summary={doctorName || "—"}
            badge={doctorCRM ? `CRM ${doctorCRM}` : undefined}
          >
            <div className="space-y-3">
              <div><Label className="text-xs text-muted-foreground">Nome do Profissional</Label><Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="bg-muted/30 font-medium" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">CRM</Label><Input value={doctorCRM} onChange={(e) => setDoctorCRM(e.target.value)} className="bg-muted/30 font-mono" /></div>
                <div><Label className="text-xs text-muted-foreground">CPF</Label><Input value={doctorCPF} onChange={(e) => setDoctorCPF(e.target.value)} placeholder="000.000.000-00" className="font-mono" /></div>
              </div>
              <p className="text-xs text-muted-foreground">Data: <strong>{todayFormatted}</strong></p>
            </div>
          </CollapsibleInfoCard>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={resetApacForm}><RotateCcw className="h-4 w-4 mr-1" /> Limpar</Button>
          {/* Icone de envio, nao de impressora: este botao cumpre o ATO. A
              impressao virou passo seguinte, na etapa pos-envio. */}
          <Button className="flex-1" onClick={handlePrint}>
            <Send className="h-4 w-4 mr-1" />
            {selectedProcedures.some(p => p.instrumento === "AIH") ? "Encaminhar via AIH" : "Enviar Requisição"}
          </Button>
        </div>

        {/*
          Etapa pos-envio do APAC — mesmo componente da validacao de evolucao e
          prescricao (34f3a868), entao o usuario reconhece o padrao: acao
          concluida, check animado, e o documento oferecido num botao.

          Fechar sem imprimir NAO perde nada: a solicitacao ja esta gravada com o
          snapshot, e o laudo podera ser reemitido pelo historico.
        */}
        <PostValidationPrintDialog
          open={!!apacPrintHtml}
          onOpenChange={(v) => { if (!v) setApacPrintHtml(null); }}
          documentLabel="Requisição"
          validatedAt={new Date()}
          note="O laudo APAC pode ser impresso agora ou reemitido depois pela aba de solicitações."
          onPrint={() => { if (apacPrintHtml) openPrintWindow(apacPrintHtml, "Preparando Laudo APAC…"); }}
        />

      </div>

      {/* ── APAC Print Layout ──
          Só imprime quando a AIH routing NÃO está aberta. Garante que gerar a AIH
          não arraste o laudo APAC junto, e vice-versa — fluxos independentes. */}
      {!aihRoutingOpen && (
      <div ref={printRef} className="hidden print:block">
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
            .print\\:block { display: block !important; }
            .print\\:hidden { display: none !important; }
          }
          .apac-root {
            width: 186mm;
            height: 273mm;
            font-family: Arial, Helvetica, sans-serif;
            color: #000;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            margin: 0 auto;
          }
          .apac-root * { box-sizing: border-box; }
          /* Header */
          .apac-doc-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 3px;
            margin-bottom: 0;
          }
          .apac-doc-header .apac-sus { font-size: 6.5pt; margin: 0; color: #333; }
          .apac-doc-header .apac-title { font-size: 9pt; font-weight: 700; margin: 2px 0 0 0; letter-spacing: 0.3px; }
          /* Unified table */
          .apac-form {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            flex: 1;
          }
          .apac-form col.c1 { width: 22%; }
          .apac-form col.c2 { width: 22%; }
          .apac-form col.c3 { width: 22%; }
          .apac-form col.c4 { width: 17%; }
          .apac-form col.c5 { width: 17%; }
          .apac-form td, .apac-form th {
            border: 0.5pt solid #000;
            padding: 2px 4px;
            vertical-align: top;
            font-size: 8pt;
            line-height: 1.2;
          }
          .apac-form .sec {
            background: #1e293b;
            color: #fff;
            font-weight: 700;
            font-size: 7.5pt;
            padding: 2.5px 4px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            text-align: center;
          }
          .apac-form .lbl {
            font-size: 6.5pt;
            color: #555;
            display: block;
            line-height: 1.1;
            margin-bottom: 0.5px;
            white-space: nowrap;
          }
          .apac-form .val {
            font-size: 8.5pt;
            font-weight: 500;
            min-height: 11px;
            line-height: 1.2;
          }
          .apac-form .val-mono {
            font-family: 'Courier New', monospace;
            font-size: 8.5pt;
            font-weight: 600;
            min-height: 11px;
            line-height: 1.2;
          }
          .apac-form .obs-cell {
            height: auto;
          }
          .apac-form .obs-space {
            min-height: 95px;
            white-space: pre-wrap;
            font-size: 8pt;
            font-weight: 400;
            line-height: 1.25;
          }
          .apac-form .sig-space { height: 12px; }
          .apac-form .sig-space-sm { height: 9px; }
        `}</style>
        <div className="apac-root">
          <div className="apac-doc-header">
            <p className="apac-sus">SISTEMA ÚNICO DE SAÚDE — SUS &nbsp;·&nbsp; MINISTÉRIO DA SAÚDE</p>
            <p className="apac-title">LAUDO PARA SOLICITAÇÃO / AUTORIZAÇÃO DE PROCEDIMENTO AMBULATORIAL</p>
          </div>
          <table className="apac-form">
            <colgroup><col className="c1"/><col className="c2"/><col className="c3"/><col className="c4"/><col className="c5"/></colgroup>
            <tbody>
              {/* ── ESTABELECIMENTO ── */}
              <tr><td colSpan={5} className="sec">Identificação do Estabelecimento de Saúde (Solicitante)</td></tr>
              <tr>
                <td colSpan={4}><span className="lbl">1 — Nome do Estabelecimento</span><div className="val">{APAC_INSTITUTION.name}</div></td>
                <td><span className="lbl">2 — CNES</span><div className="val-mono" style={{ fontSize: "9pt" }}>{APAC_INSTITUTION.cnes}</div></td>
              </tr>

              {/* ── PACIENTE ── */}
              <tr><td colSpan={5} className="sec">Identificação do Paciente</td></tr>
              <tr>
                <td colSpan={3}><span className="lbl">3 — Nome do Paciente</span><div className="val">{apacPatientName.toUpperCase()}</div></td>
                <td colSpan={2}><span className="lbl">4 — Nº do Prontuário</span><div className="val">{patientRecord}</div></td>
              </tr>
              <tr>
                <td><span className="lbl">5a — CPF</span><div className="val-mono">{patientCPF}</div></td>
                <td><span className="lbl">5 — Cartão Nacional de Saúde (CNS)</span><div className="val">{patientCNS}</div></td>
                <td><span className="lbl">6 — Data de Nascimento</span><div className="val">{patientDOB ? format(new Date(patientDOB + "T12:00:00"), "dd/MM/yyyy") : ""}</div></td>
                <td colSpan={2}><span className="lbl">7 — Sexo</span><div className="val">{patientSex === "M" ? "Masculino" : patientSex === "F" ? "Feminino" : ""}</div></td>
              </tr>
              <tr>
                <td colSpan={3}><span className="lbl">8 — Nome da Mãe ou Responsável</span><div className="val">{patientMotherName.toUpperCase()}</div></td>
                <td colSpan={2}><span className="lbl">9 — Telefone de Contato</span><div className="val">{patientPhone}</div></td>
              </tr>
              <tr>
                <td colSpan={2}><span className="lbl">10 — Endereço (Rua, Nº)</span><div className="val">{patientAddress.toUpperCase()}</div></td>
                <td><span className="lbl">11 — Município</span><div className="val">{patientCity.toUpperCase()}</div></td>
                <td><span className="lbl">13 — UF</span><div className="val">{patientUF}</div></td>
                <td><span className="lbl">14 — CEP</span><div className="val"></div></td>
              </tr>

              {/* ── PROCEDIMENTO PRINCIPAL ── */}
              <tr><td colSpan={5} className="sec">Procedimento(s) Solicitado(s)</td></tr>
              <tr>
                <td><span className="lbl">15 — Cód. Proc. Principal</span><div className="val-mono">{selectedProcedures[0]?.code || ""}</div></td>
                <td colSpan={3}><span className="lbl">16 — Nome do Procedimento Principal</span><div className="val">{selectedProcedures[0]?.name || ""}</div></td>
                <td><span className="lbl">17 — Qtde.</span><div className="val" style={{ textAlign: "center" }}>{selectedProcedures[0]?.qty || ""}</div></td>
              </tr>

              {/* ── PROCEDIMENTOS SECUNDÁRIOS ── */}
              <tr><td colSpan={5} className="sec">Procedimento(s) Secundário(s)</td></tr>
              {[1, 2, 3, 4, 5].map((idx) => {
                const proc = selectedProcedures[idx];
                const fn = 18 + (idx - 1) * 3;
                return (
                  <tr key={idx}>
                    <td><span className="lbl">{fn} — Código</span><div className="val-mono">{proc?.code || ""}</div></td>
                    <td colSpan={3}><span className="lbl">{fn + 1} — Nome do Procedimento</span><div className="val">{proc?.name || ""}</div></td>
                    <td><span className="lbl">{fn + 2} — Qtde.</span><div className="val" style={{ textAlign: "center" }}>{proc?.qty || ""}</div></td>
                  </tr>
                );
              })}

              {/* ── JUSTIFICATIVA ── */}
              <tr><td colSpan={5} className="sec">Justificativa do(s) Procedimento(s) Solicitado(s)</td></tr>
              <tr>
                <td colSpan={2}><span className="lbl">33 — Diagnóstico Inicial</span><div className="val">{diagnosis.toUpperCase()}</div></td>
                <td><span className="lbl">34 — CID-10 Principal</span><div className="val-mono">{cidPrimary.toUpperCase()}</div></td>
                <td><span className="lbl">35 — CID-10 Secundário</span><div className="val-mono">{cidSecondary.toUpperCase()}</div></td>
                <td><span className="lbl">36 — CID-10 Causas Assoc.</span><div className="val-mono">{cidAssociated.toUpperCase()}</div></td>
              </tr>
              <tr>
                <td colSpan={5} className="obs-cell"><span className="lbl">37 — Observações</span><div className="obs-space">{observations}</div></td>
              </tr>

              {/* ── SOLICITAÇÃO ── */}
              <tr><td colSpan={5} className="sec">Solicitação</td></tr>
              <tr>
                <td colSpan={2}><span className="lbl">38 — Nome do Profissional Solicitante</span><div className="val">{doctorName.toUpperCase()}</div></td>
                <td><span className="lbl">39 — Data da Solicitação</span><div className="val">{todayFormatted}</div></td>
                <td><span className="lbl">40 — Doc. (X) CPF ( ) CNS</span><div className="val-mono">{doctorCPF}</div></td>
                <td><span className="lbl">42 — Assinatura / Carimbo</span><div className="sig-space"></div></td>
              </tr>
              <tr>
                <td colSpan={5}><span className="lbl">41 — Nº do Documento / CRM</span><div className="val-mono">{doctorCPF} {doctorCRM ? `· CRM: ${doctorCRM}` : ""}</div></td>
              </tr>

              {/* ── AUTORIZAÇÃO ── */}
              <tr><td colSpan={5} className="sec">Autorização (Preenchimento pelo Autorizador)</td></tr>
              <tr>
                <td colSpan={2}><span className="lbl">43 — Nome do Profissional Autorizador</span><div className="sig-space-sm"></div></td>
                <td><span className="lbl">44 — Cód. Órgão Emissor</span><div className="sig-space-sm"></div></td>
                <td><span className="lbl">45 — Doc. ( ) CPF ( ) CNS</span><div className="sig-space-sm"></div></td>
                <td><span className="lbl">49 — Nº da Autorização (APAC)</span><div className="sig-space-sm"></div></td>
              </tr>
              <tr>
                <td><span className="lbl">46 — Nº do Documento</span><div className="sig-space-sm"></div></td>
                <td colSpan={2}><span className="lbl">47 — Data da Autorização</span><div className="sig-space-sm"></div></td>
                <td colSpan={2}><span className="lbl">48 — Assinatura e Carimbo (Autorizador)</span><div className="sig-space"></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ── AIH routing dialog ── */}
      <AihFormDialog
        open={aihRoutingOpen}
        onOpenChange={setAihRoutingOpen}
        patientId={patientId}
        patientName={apacPatientName}
        origin="regulacao"
        regulacaoType={undefined}
      />
    </>
  );
}

// ── Sub-components ──
function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="h-10 w-10 mx-auto mb-3 opacity-20" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function RequestCard({ request, category, onViewResult, onCancel, showResult }: {
  request: any;
  category: CategoryKey;
  onViewResult: () => void;
  onCancel?: () => void;
  showResult?: boolean;
}) {
  const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const items = request.items as any[];
  const priorityCfg = PRIORITY_OPTIONS.find(p => p.value === request.priority);

  return (
    <Card className="border-border/50 hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-sm text-foreground">{request.patient_name}</h3>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  statusCfg.dotColor,
                  statusCfg.pulsing && "animate-pulse-soft"
                )} />
                <Badge variant="outline" className={cn("text-[10px] border", statusCfg.color)}>
                  <StatusIcon className="h-3 w-3 mr-1" />{statusCfg.label}
                </Badge>
              </div>
              <Badge 
                variant={request.priority === "urgente" ? "destructive" : "secondary"} 
                className={cn("text-[10px]", request.priority === "urgente" && "animate-pulse")}
              >
                {request.priority === "urgente" ? "⚡ Urgente" : request.priority === "rotina" ? "🔵 Rotina" : "📅 Programado"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
              {request.patient_bed && <span>{getSectorLabel(request.patient_sector)} · L{request.patient_bed}</span>}
              <span>{format(new Date(request.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
              <span>por {request.requested_by_name}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {items.slice(0, 6).map((item: any, i: number) => (
                <Badge key={i} variant="outline" className="text-[10px] bg-background">{item.name || item}</Badge>
              ))}
              {items.length > 6 && <Badge variant="secondary" className="text-[10px]">+{items.length - 6}</Badge>}
            </div>
            {showResult && request.results && (
              <div className="mt-2 p-2 bg-muted/30 rounded-lg text-xs text-foreground whitespace-pre-wrap line-clamp-3">
                {request.results}
              </div>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); printRequisitionGuideWithGasometriaPrompt(request, (s) => getSectorLabel(s)); }}
              title="Imprimir Guia"
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs gap-1" onClick={onViewResult}>
              <Eye className="h-3.5 w-3.5" />
              {showResult ? "Ver Resultado" : "Ver Detalhes"}
            </Button>
            {onCancel && request.status === "pending" && (
              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" onClick={onCancel}>
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Lab Comparative View ──
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { SectionLoader } from "@/components/SectionLoader";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#f97316", "#14b8a6",
];

function LabComparativeView({ requests, patientName, patientId, allRequests }: {
  requests: any[];
  patientName: string;
  patientId: string | null;
  allRequests: any[];
}) {
  const [selectedExams, setSelectedExams] = useState<string[]>([]);

  // Get all completed lab requests for this patient, sorted by date
  const patientRequests = useMemo(() => {
    const filtered = patientId
      ? allRequests.filter(r => r.patient_id === patientId)
      : allRequests.filter(r => r.patient_name === patientName);
    return filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [allRequests, patientId, patientName]);

  // Extract unique exam names from all requests
  const availableExams = useMemo(() => {
    const examSet = new Set<string>();
    patientRequests.forEach(req => {
      const items = req.items as any[];
      items.forEach((item: any) => {
        const name = typeof item === "string" ? item : item.name;
        if (name) examSet.add(name);
      });
    });
    return Array.from(examSet).sort();
  }, [patientRequests]);

  // Build chart data: each data point is a request date, with exam names as keys
  // We try to parse numeric values from results text
  const chartData = useMemo(() => {
    return patientRequests.map(req => {
      const dateStr = format(new Date(req.created_at), "dd/MM HH:mm", { locale: ptBR });
      const point: Record<string, any> = { date: dateStr, fullDate: req.created_at };

      // Try to extract values from results text
      if (req.results) {
        const lines = req.results.split("\n");
        lines.forEach((line: string) => {
          // Try common patterns: "Exam Name: 12.5" or "Exam Name = 12.5" or "Exam Name - 12.5"
          const match = line.match(/^(.+?)[\s]*[:=\-–]\s*([\d.,]+)/);
          if (match) {
            const examName = match[1].trim();
            const value = parseFloat(match[2].replace(",", "."));
            if (!isNaN(value)) {
              point[examName] = value;
            }
          }
        });
      }

      // Also check result_data JSON if available
      if (req.result_data && typeof req.result_data === "object") {
        Object.entries(req.result_data).forEach(([key, val]) => {
          if (typeof val === "number") {
            point[key] = val;
          } else if (typeof val === "string") {
            const num = parseFloat(val.replace(",", "."));
            if (!isNaN(num)) point[key] = num;
          }
        });
      }

      return point;
    });
  }, [patientRequests]);

  // Exams that have at least one numeric data point
  const examsWithData = useMemo(() => {
    const exams = new Set<string>();
    chartData.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key !== "date" && key !== "fullDate" && typeof point[key] === "number") {
          exams.add(key);
        }
      });
    });
    return Array.from(exams).sort();
  }, [chartData]);

  const toggleExam = (exam: string) => {
    setSelectedExams(prev =>
      prev.includes(exam) ? prev.filter(e => e !== exam) : [...prev, exam]
    );
  };

  if (!patientId && !patientName) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm text-muted-foreground">Selecione um paciente para visualizar o comparativo de exames</p>
      </div>
    );
  }

  if (patientRequests.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm text-muted-foreground">Nenhum resultado laboratorial encontrado para {patientName || "este paciente"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Patient header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">{patientName || "Paciente"}</h3>
              <p className="text-xs text-muted-foreground">
                {patientRequests.length} coleta{patientRequests.length !== 1 ? "s" : ""} registrada{patientRequests.length !== 1 ? "s" : ""} · 
                {" "}{availableExams.length} tipo{availableExams.length !== 1 ? "s" : ""} de exame
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {examsWithData.length > 0 ? (
        <>
          {/* Exam selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Selecione os exames para comparar
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex flex-wrap gap-1.5">
                {examsWithData.map((exam, i) => (
                  <button
                    key={exam}
                    onClick={() => toggleExam(exam)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                      selectedExams.includes(exam)
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/60"
                    )}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full mr-1.5"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    {exam}
                  </button>
                ))}
              </div>
              {selectedExams.length === 0 && (
                <p className="text-[10px] text-muted-foreground mt-2">Clique nos exames acima para visualizar a tendência</p>
              )}
            </CardContent>
          </Card>

          {/* Chart */}
          {selectedExams.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--background))",
                      }}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {selectedExams.map((exam, i) => (
                      <Line
                        key={exam}
                        type="monotone"
                        dataKey={exam}
                        stroke={CHART_COLORS[examsWithData.indexOf(exam) % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <AlertTriangle className="h-8 w-8 mx-auto text-amber-500/60" />
              <p className="text-sm font-medium text-foreground">Dados numéricos não encontrados</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Para gerar gráficos comparativos, os resultados devem conter valores numéricos no formato: 
                <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded mx-1">Nome do Exame: valor</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw results timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Histórico de Resultados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {patientRequests.map(req => (
            <div key={req.id} className="border border-border/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {format(new Date(req.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">por {req.requested_by_name || "—"}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(req.items as any[]).slice(0, 4).map((item: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[9px]">{typeof item === "string" ? item : item.name}</Badge>
                  ))}
                  {(req.items as any[]).length > 4 && (
                    <Badge variant="secondary" className="text-[9px]">+{(req.items as any[]).length - 4}</Badge>
                  )}
                </div>
              </div>
              {req.results && (
                <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap bg-muted/20 rounded p-2 max-h-32 overflow-y-auto font-sans">
                  {req.results}
                </pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default RequisicaoUnificadaPage;