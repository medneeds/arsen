import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TestTubes, ScanLine, UserCheck, Plus, Search, Clock, CheckCircle2,
  XCircle, FileText, AlertTriangle, Loader2, Send, Trash2,
  ChevronDown, Filter, Eye, ClipboardList, Package, Zap, TrendingUp,
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
import { useHospital } from "@/contexts/HospitalContext";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";

const getSectorLabel = (sector: string | null) => {
  if (!sector) return "";
  return SECTOR_BED_CONFIG[sector]?.label || sector;
};

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
} as const;

type CategoryKey = keyof typeof CATEGORIES;

const PRIORITY_OPTIONS = [
  { value: "rotina", label: "Rotina", color: "text-muted-foreground" },
  { value: "urgente", label: "Urgente", color: "text-amber-600" },
  { value: "emergencia", label: "Emergência", color: "text-destructive" },
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
    setFormIndication("");
    setFormNotes("");
    setFormSelectedItems([]);
    setFormCustomItem("");
    setExpandedCombo(null);
  };

  const handleSubmitRequest = async () => {
    if (!formPatientName.trim()) { toast.error("Informe o nome do paciente"); return; }
    if (formSelectedItems.length === 0) { toast.error("Selecione ao menos um item"); return; }
    if (!unitId || !stateId || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("exam_requests").insert({
        category: activeCategory,
        patient_id: formPatientId || null,
        patient_name: formPatientName.trim(),
        patient_bed: formPatientBed.trim() || null,
        patient_sector: formPatientSector.trim() || null,
        items: formSelectedItems.map(name => ({ name })),
        clinical_indication: formIndication.trim() || null,
        priority: formPriority,
        notes: formNotes.trim() || null,
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
      <ClinicalHeader moduleLabel="Requisições" />
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
      <div className="flex gap-2 overflow-x-auto pb-1">
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

          {/* Priority + Indication */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade</Label>
              <Select value={formPriority} onValueChange={setFormPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className={p.color}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Indicação Clínica</Label>
              <Input placeholder="Motivo da solicitação" value={formIndication} onChange={e => setFormIndication(e.target.value)} />
            </div>
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

      {/* ── Result Dialog ── */}
      <Dialog open={!!viewingRequest} onOpenChange={() => { setViewingRequest(null); setResultText(""); setResultFiles([]); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {viewingRequest?.status === "completed" ? "Visualizar Resultado" : "Registrar Resultado"}
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
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Indicação</span>
                    <span className="text-foreground">{viewingRequest.clinical_indication}</span>
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

              {/* Result input with text + image + PDF */}
              <ExamResultInput
                resultText={resultText}
                onResultTextChange={setResultText}
                resultFiles={resultFiles}
                onResultFilesChange={setResultFiles}
                readOnly={viewingRequest.status === "completed"}
                requestId={viewingRequest.id}
              />

              {viewingRequest.completed_at && (
                <p className="text-[10px] text-muted-foreground">
                  Concluído em {format(new Date(viewingRequest.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} por {viewingRequest.completed_by || "—"}
                </p>
              )}
            </div>
          )}
          {viewingRequest?.status !== "completed" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingRequest(null)}>Cancelar</Button>
              <Button onClick={handleSaveResult} disabled={savingResult || (!resultText.trim() && resultFiles.length === 0)} className="gap-2">
                {savingResult ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Salvar Resultado
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

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
              {request.priority !== "rotina" && (
                <Badge variant={request.priority === "emergencia" ? "destructive" : "secondary"} className="text-[10px]">
                  {priorityCfg?.label}
                </Badge>
              )}
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
            <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs gap-1" onClick={onViewResult}>
              <Eye className="h-3.5 w-3.5" />
              {showResult ? "Ver" : "Resultado"}
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
