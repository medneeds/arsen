import React, { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TestTubes, ScanLine, UserCheck, Plus, Search, Clock, CheckCircle2,
  XCircle, FileText, AlertTriangle, Loader2, Send, Trash2,
  ChevronDown, Filter, Eye, ClipboardList, Package, Zap,
} from "lucide-react";
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-700 border-amber-300", icon: Clock },
  in_progress: { label: "Em Andamento", color: "bg-blue-500/15 text-blue-700 border-blue-300", icon: Loader2 },
  completed: { label: "Concluído", color: "bg-emerald-500/15 text-emerald-700 border-emerald-300", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

const RequisicaoUnificadaPage = () => {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const unitId = currentHospital?.id;
  const stateId = currentState?.id;

  const [activeCategory, setActiveCategory] = useState<CategoryKey>("laboratorio");
  const [activeSubTab, setActiveSubTab] = useState("solicitar");
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // ── New request form ──
  const [showNewRequest, setShowNewRequest] = useState(false);
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
  const [savingResult, setSavingResult] = useState(false);

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
      const { error } = await supabase
        .from("exam_requests")
        .update({
          status: "completed",
          results: resultText.trim() || null,
          completed_at: new Date().toISOString(),
          completed_by: user?.email?.split("@")[0] || "Sistema",
        })
        .eq("id", viewingRequest.id);
      if (error) throw error;
      toast.success("Resultado registrado");
      setViewingRequest(null);
      setResultText("");
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
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Dados do Paciente</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do Paciente *</Label>
                <Input placeholder="Nome completo" value={formPatientName} onChange={e => setFormPatientName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Leito</Label>
                <Input placeholder="Ex: 01" value={formPatientBed} onChange={e => setFormPatientBed(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Setor</Label>
                <Input placeholder="Ex: UTI 1" value={formPatientSector} onChange={e => setFormPatientSector(e.target.value)} />
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
                onViewResult={() => { setViewingRequest(req); setResultText(req.results || ""); }}
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
                onViewResult={() => { setViewingRequest(req); setResultText(req.results || ""); }}
                showResult
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ── Result Dialog ── */}
      <Dialog open={!!viewingRequest} onOpenChange={() => { setViewingRequest(null); setResultText(""); }}>
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
                    <span className="text-foreground">{viewingRequest.patient_sector} · L{viewingRequest.patient_bed}</span>
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

              {/* Result input */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Resultado</Label>
                <Textarea
                  placeholder="Digite os resultados do exame/parecer..."
                  value={resultText}
                  onChange={e => setResultText(e.target.value)}
                  rows={8}
                  readOnly={viewingRequest.status === "completed"}
                  className={viewingRequest.status === "completed" ? "bg-muted/30" : ""}
                />
              </div>

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
              <Button onClick={handleSaveResult} disabled={savingResult || !resultText.trim()} className="gap-2">
                {savingResult ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Salvar Resultado
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
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
              <Badge variant="outline" className={cn("text-[10px] border", statusCfg.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />{statusCfg.label}
              </Badge>
              {request.priority !== "rotina" && (
                <Badge variant={request.priority === "emergencia" ? "destructive" : "secondary"} className="text-[10px]">
                  {priorityCfg?.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
              {request.patient_bed && <span>{request.patient_sector} · L{request.patient_bed}</span>}
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

export default RequisicaoUnificadaPage;
