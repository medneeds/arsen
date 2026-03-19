import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TestTubes, ScanLine, UserCheck, Plus, Search, Clock, CheckCircle2,
  XCircle, FileText, AlertTriangle, Loader2, Send, Trash2,
  ChevronDown, Filter, Eye, ClipboardList, Package, Zap, TrendingUp,
  CalendarIcon, Printer, RotateCcw, FileCheck,
} from "lucide-react";

import ExamResultInput, { ResultFile } from "@/components/ExamResultInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { printRequisitionGuide } from "@/components/PrintableRequisitionGuide";
import { useHospital } from "@/contexts/HospitalContext";
import { SECTOR_BED_CONFIG, getSectorDisplayLabel } from "@/utils/bedNaming";

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
  categories: Partial<Record<ComboCategory, string[]>>;
}

const UTI_COMBOS: UtiCombo[] = [
  {
    id: "rotina-uti",
    label: "Rotina UTI",
    description: "Exames laboratoriais de rotina diária da UTI",
    icon: Clock,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    border: "border-blue-300",
    categories: {
      laboratorio: [
        "Hemograma Completo", "Ureia", "Creatinina", "Sódio", "Potássio", "Cálcio", "Magnésio", "Fósforo",
        "Glicemia", "TGO", "TGP", "Bilirrubina Total e Frações", "PCR",
        "TAP/INR", "TTPA", "Gasometria Arterial", "Lactato",
      ],
    },
  },
  {
    id: "admissao-uti",
    label: "Admissão UTI (SAPS)",
    description: "Pacote completo: SAPS 3, culturas, RX tórax admissional, ECG",
    icon: Package,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    border: "border-emerald-300",
    categories: {
      laboratorio: [
        "Hemograma Completo", "Plaquetas",
        "Ureia", "Creatinina", "Sódio", "Potássio", "Cálcio", "Magnésio", "Fósforo",
        "Glicemia", "TGO", "TGP", "Bilirrubina Total e Frações", "Albumina", "PCR",
        "Amilase", "Lipase", "DHL",
        "TAP/INR", "TTPA", "Fibrinogênio", "D-Dímero",
        "Gasometria Arterial", "Lactato",
        "Troponina", "BNP/NT-proBNP", "Procalcitonina",
        "Hemocultura (2 pares)", "Urocultura", "Cultura de Secreção",
        "EAS/Urina Tipo I",
        "TSH", "T4 Livre", "Cortisol",
      ],
      imagem: [
        "RX Tórax AP (leito)", "ECG 12 derivações",
      ],
    },
  },
  {
    id: "sepse-uti",
    label: "Pacote Sepse",
    description: "Investigação e manejo de sepse: labs + culturas",
    icon: Zap,
    color: "text-red-600",
    bg: "bg-red-500/10",
    border: "border-red-300",
    categories: {
      laboratorio: [
        "Hemograma Completo", "Plaquetas", "PCR", "Procalcitonina", "Lactato",
        "Gasometria Arterial", "Ureia", "Creatinina", "Sódio", "Potássio",
        "TGO", "TGP", "Bilirrubina Total e Frações",
        "TAP/INR", "TTPA", "Fibrinogênio", "D-Dímero",
        "Hemocultura (2 pares)", "Urocultura", "Cultura de Secreção",
      ],
    },
  },
];

// ── Category config ──
const CATEGORIES = {
  laboratorio: {
    label: "Exames Laboratoriais",
    shortLabel: "Laboratório",
    icon: TestTubes,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    presets: [
      { group: "Hemograma", items: ["Hemograma Completo", "Hemoglobina", "Hematócrito", "Plaquetas", "Leucograma"] },
      { group: "Bioquímica", items: ["Glicemia", "Ureia", "Creatinina", "Sódio", "Potássio", "Cálcio", "Magnésio", "Fósforo", "TGO", "TGP", "Bilirrubina Total e Frações", "Albumina", "PCR", "Amilase", "Lipase"] },
      { group: "Coagulação", items: ["TAP/INR", "TTPA", "Fibrinogênio", "D-Dímero"] },
      { group: "Gasometria", items: ["Gasometria Arterial", "Gasometria Venosa", "Lactato"] },
      { group: "Marcadores", items: ["Troponina", "BNP/NT-proBNP", "Procalcitonina", "DHL"] },
      { group: "Urina", items: ["EAS/Urina Tipo I", "Urocultura", "Creatinina Urinária"] },
      { group: "Culturas", items: ["Hemocultura (2 pares)", "Urocultura", "Cultura de Secreção"] },
      { group: "Hormônios", items: ["TSH", "T4 Livre", "Cortisol"] },
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
      { group: "Ultrassonografia", items: ["USG Abdome Total", "USG Vias Urinárias", "USG Doppler Venoso MMII", "USG Doppler Arterial", "USG Point-of-Care (POCUS)", "USG Partes Moles"] },
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
      { group: "Clínicas", items: ["Cardiologia", "Pneumologia", "Neurologia", "Nefrologia", "Gastroenterologia", "Endocrinologia", "Hematologia", "Infectologia", "Reumatologia", "Oncologia"] },
      { group: "Cirúrgicas", items: ["Cirurgia Geral", "Cirurgia Vascular", "Neurocirurgia", "Ortopedia", "Urologia", "Buco-maxilo-facial", "Cirurgia Torácica", "Cirurgia Plástica"] },
      { group: "Apoio", items: ["Fisioterapia", "Fonoaudiologia", "Nutrição", "Psicologia", "Assistência Social", "Farmácia Clínica", "Cuidados Paliativos"] },
    ],
  },
  apac: {
    label: "APAC — Alta Complexidade",
    shortLabel: "APAC",
    icon: FileCheck,
    color: "text-orange-600",
    bg: "bg-orange-500/10",
    presets: [],
  },
} as const;

type CategoryKey = keyof typeof CATEGORIES;

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
  const { currentHospital, currentState } = useHospital();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const unitId = currentHospital?.id;
  const stateId = currentState?.id;

  const [activeCategory, setActiveCategory] = useState<CategoryKey>("laboratorio");
  const [activeSubTab, setActiveSubTab] = useState("solicitar");
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

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
  const [submitting, setSubmitting] = useState(false);
  const [expandedCombo, setExpandedCombo] = useState<string | null>(null);

  // ── Result dialog ──
  const [viewingRequest, setViewingRequest] = useState<any | null>(null);
  const [resultText, setResultText] = useState("");
  const [resultFiles, setResultFiles] = useState<ResultFile[]>([]);
  const [savingResult, setSavingResult] = useState(false);

  // ── Pre-fill from navigation state or URL params ──
  useEffect(() => {
    const state = location.state as any;
    const patientId = state?.patientId || searchParams.get("patientId");
    const patientName = state?.patientName || searchParams.get("patientName");
    const patientBed = state?.patientBed || searchParams.get("patientBed");
    const patientSector = state?.patientSector || searchParams.get("patientSector");
    if (patientId) setFormPatientId(patientId);
    if (patientName) setFormPatientName(patientName);
    if (patientBed) setFormPatientBed(patientBed);
    if (patientSector) setFormPatientSector(patientSector);
    if (patientId || patientName) setActiveSubTab("solicitar");
  }, []);

  useEffect(() => {
    if (unitId && stateId) fetchRequests();
  }, [unitId, stateId, activeCategory]);

  const fetchRequests = async () => {
    if (!unitId || !stateId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("exam_requests")
        .select("*")
        .eq("hospital_unit_id", unitId)
        .eq("state_id", stateId)
        .eq("category", activeCategory)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setRequests(data || []);
    } catch {
      toast.error("Erro ao carregar requisições");
    } finally {
      setLoading(false);
    }
  };

  // ── Filtered lists ──
  const pendingRequests = useMemo(() =>
    requests.filter(r => (r.status === "pending" || r.status === "in_progress") &&
      (!search || r.patient_name?.toLowerCase().includes(search.toLowerCase()))),
    [requests, search]
  );
  const completedRequests = useMemo(() =>
    requests.filter(r => r.status === "completed" &&
      (!search || r.patient_name?.toLowerCase().includes(search.toLowerCase()))),
    [requests, search]
  );

  const toggleItem = (item: string) => {
    setFormSelectedItems(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
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

  const resetForm = () => {
    setFormPatientId(null);
    setFormPatientName("");
    setFormPatientBed("");
    setFormPatientSector("");
    setFormPriority("rotina");
    setFormScheduledDate("");
    setFormScheduledTime("");
    setFormIndication("");
    setFormNotes("");
    setFormSelectedItems([]);
    setFormCustomItem("");
    setExpandedCombo(null);
  };

  const handleSubmitRequest = async () => {
    if (!formPatientName.trim()) { toast.error("Informe o nome do paciente"); return; }
    if (formSelectedItems.length === 0) { toast.error("Selecione ao menos um item"); return; }
    if (!formIndication.trim()) { toast.error("Informe a justificativa clínica"); return; }
    if (formPriority === "programado" && !formScheduledDate) { toast.error("Informe a data programada"); return; }
    if (!unitId || !stateId || !user) return;

    setSubmitting(true);
    try {
      // Build notes with scheduled info if programado
      let notesContent = formNotes.trim() || "";
      if (formPriority === "programado" && formScheduledDate) {
        const scheduledInfo = `[PROGRAMADO: ${formScheduledDate}${formScheduledTime ? " às " + formScheduledTime : ""}]`;
        notesContent = scheduledInfo + (notesContent ? "\n" + notesContent : "");
      }

      const { error } = await supabase.from("exam_requests").insert({
        category: activeCategory,
        patient_id: formPatientId || null,
        patient_name: formPatientName.trim(),
        patient_bed: formPatientBed.trim() || null,
        patient_sector: formPatientSector.trim() || null,
        items: formSelectedItems.map(name => ({ name })),
        clinical_indication: formIndication.trim() || null,
        priority: formPriority,
        notes: notesContent || null,
        requested_by: user.id,
        requested_by_name: user.user_metadata?.username || user.email?.split("@")[0] || "Médico",
        hospital_unit_id: unitId,
        state_id: stateId,
        status: "pending",
      } as any);
      if (error) throw error;
      toast.success(`${CATEGORIES[activeCategory].shortLabel}: ${formSelectedItems.length} item(ns) solicitado(s)`);
      resetForm();
      setActiveSubTab("solicitados");
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar requisição");
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
    } catch {
      toast.error("Erro ao cancelar");
    }
  };

  const catConfig = CATEGORIES[activeCategory];
  const CatIcon = catConfig.icon;

  return (
    <div>
      <div className="print:hidden">
        <ClinicalHeader moduleLabel="Requisições" />
      </div>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto print:p-0 print:m-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Requisições</h1>
            <p className="text-sm text-muted-foreground">Solicitação e acompanhamento de exames e pareceres</p>
          </div>
        </div>
      </div>

      {/* ── Category Selector ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
        {(Object.keys(CATEGORIES) as CategoryKey[]).map(key => {
          const cat = CATEGORIES[key];
          const Icon = cat.icon;
          const count = requests.length;
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => { setActiveCategory(key); setActiveSubTab("solicitar"); setSearch(""); }}
              className={cn(
                "flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all duration-200 min-w-fit",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                  : "border-border hover:bg-muted/50 hover:border-border"
              )}
            >
              <div className={cn("p-1.5 rounded-lg", isActive ? catConfig.bg : "bg-muted")}>
                <Icon className={cn("h-4 w-4", isActive ? cat.color : "text-muted-foreground")} />
              </div>
              <div className="text-left">
                <p className={cn("text-xs font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>
                  {cat.shortLabel}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── APAC mode: show embedded APAC form ── */}
      {activeCategory === "apac" ? (
        <ApacEmbeddedForm patientName={formPatientName} patientBed={formPatientBed} patientSector={formPatientSector} />
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
              <CheckCircle2 className="h-3.5 w-3.5" /> Resultados
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
          {/* Patient info */}
          <Card className={cn("border-border/50", formPatientId && "border-primary/30 bg-primary/5")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Dados do Paciente
                {formPatientId && (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                    Vinculado ao mapa
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do Paciente *</Label>
                <Input placeholder="Nome completo" value={formPatientName} onChange={e => setFormPatientName(e.target.value)} readOnly={!!formPatientId} className={formPatientId ? "bg-muted/50" : ""} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Leito</Label>
                <Input placeholder="Ex: 01" value={formPatientBed} onChange={e => setFormPatientBed(e.target.value)} readOnly={!!formPatientId} className={formPatientId ? "bg-muted/50" : ""} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Setor</Label>
                <Input placeholder="Ex: UTI 1" value={formPatientSector} onChange={e => setFormPatientSector(e.target.value)} readOnly={!!formPatientId} className={formPatientId ? "bg-muted/50" : ""} />
              </div>
            </CardContent>
          </Card>

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

          {/* ── Combos UTI ── */}
          {(activeCategory === "laboratorio" || activeCategory === "imagem") && (
            <Card className="border-border/50 bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Pacotes Rápidos UTI
                  <Badge variant="outline" className="text-[10px] font-normal">Clique para aplicar</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {UTI_COMBOS.map(combo => {
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
                                  const selected = formSelectedItems.includes(item);
                                  return (
                                    <button
                                      key={item}
                                      onClick={() => toggleItem(item)}
                                      className={cn(
                                        "px-2.5 py-1 rounded-md text-[11px] border transition-all duration-150",
                                        selected
                                          ? "border-primary bg-primary/10 text-primary font-medium"
                                          : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50"
                                      )}
                                    >
                                      {selected && <span className="mr-0.5">✓</span>}
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
              {catConfig.presets.map(group => (
                <div key={group.group}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map(item => {
                      const selected = formSelectedItems.includes(item);
                      return (
                        <button
                          key={item}
                          onClick={() => toggleItem(item)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs border transition-all duration-150",
                            selected
                              ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                              : "border-border bg-background text-foreground hover:bg-muted/50"
                          )}
                        >
                          {selected && <span className="mr-1">✓</span>}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

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
                  <p className="text-[11px] font-semibold text-primary mb-2">Itens selecionados ({formSelectedItems.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {formSelectedItems.map(item => (
                      <Badge
                        key={item}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors"
                        onClick={() => toggleItem(item)}
                      >
                        {item} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea placeholder="Informações adicionais..." value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={resetForm} disabled={submitting}>Limpar</Button>
            <Button onClick={handleSubmitRequest} disabled={submitting || formSelectedItems.length === 0 || !formPatientName.trim()} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Requisição
            </Button>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════ */}
        {/* TAB: SOLICITADOS                            */}
        {/* ════════════════════════════════════════════ */}
        <TabsContent value="solicitados" className="mt-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
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
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
              {/* Request summary */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paciente</span>
                  <span className="font-semibold text-foreground">{viewingRequest.patient_name}</span>
                </div>
                {viewingRequest.patient_bed && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Leito/Setor</span>
                    <span className="text-foreground">{getSectorLabel(viewingRequest.patient_sector)} · L{viewingRequest.patient_bed}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solicitado por</span>
                  <span className="text-foreground">{viewingRequest.requested_by_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data</span>
                  <span className="text-foreground">{format(new Date(viewingRequest.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
                {viewingRequest.clinical_indication && (
                  <div className="p-2 rounded-md bg-amber-50/50 border border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Justificativa Clínica:</span>
                    <p className="text-xs text-foreground mt-0.5">{viewingRequest.clinical_indication}</p>
                  </div>
                )}
                {viewingRequest.notes && viewingRequest.notes.includes("[PROGRAMADO:") && (
                  <div className="p-2 rounded-md bg-blue-50/50 border border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">📅 Agendamento:</span>
                    <p className="text-xs text-foreground mt-0.5">
                      {viewingRequest.notes.match(/\[PROGRAMADO: ([^\]]+)\]/)?.[1] || ""}
                    </p>
                  </div>
                )}
                <div className="pt-1.5 border-t border-border/50">
                  <p className="text-muted-foreground mb-1">Itens solicitados:</p>
                  <div className="flex flex-wrap gap-1">
                    {(viewingRequest.items as any[]).map((item: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{item.name || item}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Result display (read-only — physicians only view results) */}
              {viewingRequest.status === "completed" ? (
                <ExamResultInput
                  resultText={resultText}
                  onResultTextChange={() => {}}
                  resultFiles={resultFiles}
                  onResultFilesChange={() => {}}
                  readOnly={true}
                  requestId={viewingRequest.id}
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
                onClick={() => printRequisitionGuide(viewingRequest, (s) => getSectorLabel(s))}
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir Guia
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewingRequest(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

// ── APAC Embedded Form ──
const APAC_PROCEDURES = [
  { code: "02.06.01.007-9", name: "TOMOGRAFIA COMPUTADORIZADA DO CRÂNIO", category: "TC" },
  { code: "02.06.01.008-7", name: "TOMOGRAFIA COMPUTADORIZADA DE FACE / SEIOS DA FACE", category: "TC" },
  { code: "02.06.01.009-5", name: "TOMOGRAFIA COMPUTADORIZADA DE SELA TÚRCICA", category: "TC" },
  { code: "02.06.02.003-5", name: "TOMOGRAFIA COMPUTADORIZADA DO PESCOÇO", category: "TC" },
  { code: "02.06.03.001-0", name: "TOMOGRAFIA COMPUTADORIZADA DO TÓRAX", category: "TC" },
  { code: "02.06.03.002-9", name: "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN SUPERIOR", category: "TC" },
  { code: "02.06.03.003-7", name: "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN INFERIOR", category: "TC" },
  { code: "02.06.03.004-5", name: "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN TOTAL", category: "TC" },
  { code: "02.06.03.005-3", name: "TOMOGRAFIA COMPUTADORIZADA DE PELVE / BACIA", category: "TC" },
  { code: "02.06.04.001-6", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA CERVICAL", category: "TC" },
  { code: "02.06.04.002-4", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA TORÁCICA", category: "TC" },
  { code: "02.06.04.003-2", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA LOMBO-SACRA", category: "TC" },
  { code: "02.06.05.001-1", name: "TOMOGRAFIA COMPUTADORIZADA DE ARTICULAÇÕES", category: "TC" },
  { code: "02.06.05.002-0", name: "TOMOGRAFIA COMPUTADORIZADA DE SEGMENTOS APENDICULARES", category: "TC" },
  { code: "02.06.01.001-0", name: "ANGIOTOMOGRAFIA DE ARTÉRIAS CERVICO CEREBRAIS", category: "TC" },
  { code: "02.06.01.002-8", name: "ANGIOTOMOGRAFIA DE AORTA TORÁCICA", category: "TC" },
  { code: "02.06.01.003-6", name: "ANGIOTOMOGRAFIA DE AORTA ABDOMINAL", category: "TC" },
  { code: "02.06.01.004-4", name: "ANGIOTOMOGRAFIA CORONARIANA", category: "TC" },
  { code: "02.06.01.005-2", name: "ANGIOTOMOGRAFIA DE ARTÉRIAS PULMONARES (TEP)", category: "TC" },
  { code: "02.07.01.001-3", name: "RESSONÂNCIA MAGNÉTICA DE CRÂNIO", category: "RM" },
  { code: "02.07.01.002-1", name: "RESSONÂNCIA MAGNÉTICA DE SELA TÚRCICA", category: "RM" },
  { code: "02.07.02.001-9", name: "RESSONÂNCIA MAGNÉTICA DE COLUNA CERVICAL", category: "RM" },
  { code: "02.07.02.002-7", name: "RESSONÂNCIA MAGNÉTICA DE COLUNA TORÁCICA", category: "RM" },
  { code: "02.07.02.003-5", name: "RESSONÂNCIA MAGNÉTICA DE COLUNA LOMBO-SACRA", category: "RM" },
  { code: "02.07.03.001-4", name: "RESSONÂNCIA MAGNÉTICA DE TÓRAX", category: "RM" },
  { code: "02.07.03.002-2", name: "RESSONÂNCIA MAGNÉTICA DE ABDOMEN SUPERIOR", category: "RM" },
  { code: "02.07.03.003-0", name: "RESSONÂNCIA MAGNÉTICA DE PELVE", category: "RM" },
  { code: "02.07.04.001-0", name: "RESSONÂNCIA MAGNÉTICA DE ARTICULAÇÃO", category: "RM" },
  { code: "02.05.02.001-7", name: "DOPPLER COLORIDO DE VASOS CERVICAIS (CARÓTIDAS E VERTEBRAIS)", category: "DOPPLER" },
  { code: "02.05.02.002-5", name: "DOPPLER COLORIDO VENOSO DE MEMBROS INFERIORES", category: "DOPPLER" },
  { code: "02.05.02.003-3", name: "DOPPLER COLORIDO ARTERIAL DE MEMBROS INFERIORES", category: "DOPPLER" },
  { code: "02.05.02.004-1", name: "DOPPLER COLORIDO VENOSO DE MEMBROS SUPERIORES", category: "DOPPLER" },
  { code: "02.05.02.005-0", name: "DOPPLER COLORIDO DE AORTA E ARTÉRIAS RENAIS", category: "DOPPLER" },
  { code: "02.05.01.003-0", name: "ULTRASSONOGRAFIA DE ABDOMEN TOTAL", category: "USG" },
  { code: "02.05.01.004-8", name: "ULTRASSONOGRAFIA DE TÓRAX", category: "USG" },
  { code: "02.05.01.005-6", name: "ECOCARDIOGRAMA TRANSTORÁCICO", category: "USG" },
];

const APAC_QUICK_ACCESS = [
  { code: "02.06.01.007-9", label: "TC Crânio", color: "bg-blue-600 hover:bg-blue-700 text-white" },
  { code: "02.06.03.001-0", label: "TC Tórax", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { code: "02.06.03.002-9", label: "TC Abdome Sup", color: "bg-amber-600 hover:bg-amber-700 text-white" },
  { code: "02.06.03.003-7", label: "TC Abdome Inf", color: "bg-orange-600 hover:bg-orange-700 text-white" },
  { code: "02.06.03.004-5", label: "TC Abdome Total", color: "bg-red-600 hover:bg-red-700 text-white" },
  { code: "02.06.01.005-2", label: "AngioTC Pulmonar", color: "bg-purple-600 hover:bg-purple-700 text-white" },
  { code: "02.06.01.001-0", label: "AngioTC Cervical", color: "bg-indigo-600 hover:bg-indigo-700 text-white" },
  { code: "02.06.03.005-3", label: "TC Pelve", color: "bg-pink-600 hover:bg-pink-700 text-white" },
];

const APAC_INSTITUTION = {
  name: "HOSPITAL MUNICIPAL DJALMA MARQUES",
  cnes: "2308762",
};

interface ApacSelectedProcedure {
  code: string;
  name: string;
  qty: number;
}

function ApacEmbeddedForm({ patientName: initialPatientName, patientBed, patientSector }: {
  patientName: string;
  patientBed: string;
  patientSector: string;
}) {
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const [doctorName, setDoctorName] = useState("");
  const [doctorCRM, setDoctorCRM] = useState("");
  const [doctorCPF, setDoctorCPF] = useState("");

  const [apacPatientName, setApacPatientName] = useState(initialPatientName);
  const [patientRecord, setPatientRecord] = useState("");
  const [patientCNS, setPatientCNS] = useState("");
  const [patientDOB, setPatientDOB] = useState("");
  const [patientSex, setPatientSex] = useState("");
  const [patientMotherName, setPatientMotherName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [patientCity, setPatientCity] = useState("São Luís");
  const [patientUF, setPatientUF] = useState("MA");

  const [selectedProcedures, setSelectedProcedures] = useState<ApacSelectedProcedure[]>([]);
  const [searchProcedure, setSearchProcedure] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [diagnosis, setDiagnosis] = useState("");
  const [cidPrimary, setCidPrimary] = useState("");
  const [cidSecondary, setCidSecondary] = useState("");
  const [cidAssociated, setCidAssociated] = useState("");
  const [observations, setObservations] = useState("");

  useEffect(() => { setApacPatientName(initialPatientName); }, [initialPatientName]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("profiles").select("full_name, crm").eq("id", user.id).maybeSingle();
      if (data) { setDoctorName(data.full_name || ""); setDoctorCRM(data.crm || ""); }
    };
    load();
  }, [user]);

  const addProcedure = (proc: { code: string; name: string }) => {
    if (selectedProcedures.find((p) => p.code === proc.code)) { toast.info("Procedimento já adicionado"); return; }
    if (selectedProcedures.length >= 6) { toast.error("Máximo de 6 procedimentos por laudo"); return; }
    setSelectedProcedures((prev) => [...prev, { code: proc.code, name: proc.name, qty: 1 }]);
    toast.success("Procedimento adicionado");
  };

  const removeProcedure = (code: string) => setSelectedProcedures((prev) => prev.filter((p) => p.code !== code));

  const resetApacForm = () => {
    setApacPatientName(initialPatientName); setPatientRecord(""); setPatientCNS("");
    setPatientDOB(""); setPatientSex(""); setPatientMotherName("");
    setPatientPhone(""); setPatientAddress("");
    setSelectedProcedures([]); setDiagnosis(""); setCidPrimary(""); setCidSecondary(""); setCidAssociated(""); setObservations("");
    toast.info("Formulário limpo");
  };

  const handlePrint = () => {
    if (selectedProcedures.length === 0) { toast.error("Adicione ao menos um procedimento"); return; }
    if (!apacPatientName.trim()) { toast.error("Informe o nome do paciente"); return; }
    window.print();
  };

  const filteredProcedures = APAC_PROCEDURES.filter((p) => {
    const matchSearch = searchProcedure === "" || p.name.toLowerCase().includes(searchProcedure.toLowerCase()) || p.code.includes(searchProcedure);
    const matchCategory = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const todayFormatted = format(new Date(), "dd/MM/yyyy");

  return (
    <>
      <div className="space-y-4 print:hidden mt-4">
        {/* Quick access */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Acesso rápido — Tomografias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {APAC_QUICK_ACCESS.map((qa) => {
                const proc = APAC_PROCEDURES.find((p) => p.code === qa.code);
                const isSelected = selectedProcedures.some((p) => p.code === qa.code);
                return (
                  <Button key={qa.code} size="sm" className={`${isSelected ? "ring-2 ring-offset-2 ring-primary opacity-60" : qa.color} transition-all font-semibold`} onClick={() => proc && addProcedure(proc)} disabled={isSelected}>
                    <Plus className="h-3.5 w-3.5 mr-1" />{qa.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: patient + justification */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Estabelecimento solicitante</CardTitle></CardHeader>
              <CardContent className="space-y-2">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Identificação do paciente</CardTitle></CardHeader>
              <CardContent className="space-y-3">
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
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">CNS</Label>
                    <Input value={patientCNS} onChange={(e) => setPatientCNS(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Nasc.</Label>
                    <Input type="date" value={patientDOB} onChange={(e) => setPatientDOB(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sexo</Label>
                    <Select value={patientSex} onValueChange={setPatientSex}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Justificativa clínica</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs text-muted-foreground">Diagnóstico Inicial</Label><Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Descreva o diagnóstico" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs text-muted-foreground">CID-10 Principal</Label><Input value={cidPrimary} onChange={(e) => setCidPrimary(e.target.value)} placeholder="Ex: I63.9" className="font-mono" /></div>
                  <div><Label className="text-xs text-muted-foreground">CID-10 Secundário</Label><Input value={cidSecondary} onChange={(e) => setCidSecondary(e.target.value)} className="font-mono" /></div>
                  <div><Label className="text-xs text-muted-foreground">CID-10 Associado</Label><Input value={cidAssociated} onChange={(e) => setCidAssociated(e.target.value)} className="font-mono" /></div>
                </div>
                <div><Label className="text-xs text-muted-foreground">Observações</Label><Textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Informações clínicas relevantes..." rows={3} /></div>
              </CardContent>
            </Card>
          </div>

          {/* Right: search + selected + doctor */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Catálogo de Procedimentos SIGTAP</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={searchProcedure} onChange={(e) => setSearchProcedure(e.target.value)} placeholder="Buscar por nome ou código..." className="pl-9" />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="TC">TC</SelectItem>
                      <SelectItem value="RM">RM</SelectItem>
                      <SelectItem value="DOPPLER">Doppler</SelectItem>
                      <SelectItem value="USG">USG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                  {filteredProcedures.map((proc) => {
                    const isSelected = selectedProcedures.some((p) => p.code === proc.code);
                    return (
                      <button key={proc.code} className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 ${isSelected ? "bg-primary/5 opacity-60" : ""}`} onClick={() => addProcedure(proc)} disabled={isSelected}>
                        <div className="min-w-0"><span className="font-mono text-xs text-muted-foreground mr-2">{proc.code}</span><span className="text-foreground">{proc.name}</span></div>
                        <Badge variant="outline" className="shrink-0 text-xs">{proc.category}</Badge>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className={selectedProcedures.length > 0 ? "border-primary/30" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Procedimentos selecionados ({selectedProcedures.length}/6)</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedProcedures.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Use os botões de acesso rápido ou busque no catálogo acima</p>
                ) : (
                  <div className="space-y-2">
                    {selectedProcedures.map((proc, idx) => (
                      <div key={proc.code} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                        <Badge variant="secondary" className="shrink-0 font-mono text-xs">{idx === 0 ? "Principal" : `Sec. ${idx}`}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{proc.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{proc.code}</p>
                        </div>
                        <Input type="number" min={1} max={99} value={proc.qty} onChange={(e) => { const qty = parseInt(e.target.value) || 1; setSelectedProcedures((prev) => prev.map((p) => (p.code === proc.code ? { ...p, qty } : p))); }} className="w-14 text-center text-sm" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeProcedure(proc.code)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Profissional solicitante</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs text-muted-foreground">Nome do Profissional</Label><Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="bg-muted/30 font-medium" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">CRM</Label><Input value={doctorCRM} onChange={(e) => setDoctorCRM(e.target.value)} className="bg-muted/30 font-mono" /></div>
                  <div><Label className="text-xs text-muted-foreground">CPF</Label><Input value={doctorCPF} onChange={(e) => setDoctorCPF(e.target.value)} placeholder="000.000.000-00" className="font-mono" /></div>
                </div>
                <p className="text-xs text-muted-foreground">Data da solicitação: <strong>{todayFormatted}</strong></p>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={resetApacForm}><RotateCcw className="h-4 w-4 mr-1" /> Limpar</Button>
              <Button className="flex-1" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Imprimir APAC</Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── APAC Print Layout ── */}
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
                <td colSpan={2}><span className="lbl">5 — Cartão Nacional de Saúde (CNS)</span><div className="val">{patientCNS}</div></td>
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
                <td colSpan={2}><span className="lbl">15 — Código do Procedimento Principal</span><div className="val-mono">{selectedProcedures[0]?.code || ""}</div></td>
                <td colSpan={2}><span className="lbl">16 — Nome do Procedimento Principal</span><div className="val">{selectedProcedures[0]?.name || ""}</div></td>
                <td><span className="lbl">17 — Qtde.</span><div className="val" style={{ textAlign: "center" }}>{selectedProcedures[0]?.qty || ""}</div></td>
              </tr>

              {/* ── PROCEDIMENTOS SECUNDÁRIOS ── */}
              <tr><td colSpan={5} className="sec">Procedimento(s) Secundário(s)</td></tr>
              {[1, 2, 3, 4, 5].map((idx) => {
                const proc = selectedProcedures[idx];
                const fn = 18 + (idx - 1) * 3;
                return (
                  <tr key={idx}>
                    <td colSpan={2}><span className="lbl">{fn} — Código</span><div className="val-mono">{proc?.code || ""}</div></td>
                    <td colSpan={2}><span className="lbl">{fn + 1} — Nome do Procedimento</span><div className="val">{proc?.name || ""}</div></td>
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
              onClick={(e) => { e.stopPropagation(); printRequisitionGuide(request, (s) => getSectorLabel(s)); }}
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
