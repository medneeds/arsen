import React, { useState, useEffect, useMemo } from "react";
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TestTubes, Search, Clock, CheckCircle2, XCircle, Eye, Loader2,
  RefreshCw, AlertTriangle, FileText, Droplets, Flame, Beaker,
  Microscope, Heart, CalendarIcon, Printer,
} from "lucide-react";
import ExamResultInput, { ResultFile } from "@/components/ExamResultInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toSolicitacaoStatusDb, fromSolicitacaoStatusDb } from "@/lib/solicitacaoStatus";
import { useAuth } from "@/contexts/AuthContext";
import { PlatformHeader } from "@/components/layout/PlatformHeader";
import { useHospital } from "@/contexts/HospitalContext";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { printRequisitionGuideWithGasometriaPrompt } from "@/lib/printRequisitionWithGasometriaPrompt";

const getSectorLabel = getSectorDisplayLabel;

// MIGRAÇÃO (Wave3): exam_requests → solicitacoes_exame. A tabela nova pendura só
// em internacao_id + campos clínicos; nome/leito/setor/solicitante do paciente
// são reconstruídos via join internacoes→pacientes/leitos/setores/profissionais.
// Colunas: category→categoria, items→itens, priority→prioridade, results→
// resultado_texto, result_data→resultado_dados, completed_at→concluido_em,
// completed_by→concluido_por (FK profissional). Sem coluna: hospital_unit_id/
// state_id (filtro removido — RLS escopa por hospital do profissional),
// requested_by_name (via join solicitante). concluido_por não tem relationship
// declarada em types.ts → nome do concluinte degradado (completed_by = null).
const SOLICITACAO_SELECT = `
  *,
  internacao:internacoes!solicitacoes_exame_internacao_id_fkey(
    paciente:pacientes(nome_completo, nome_social),
    leito:leitos(numero),
    setor:setores(tipo, nome)
  ),
  solicitante:profissionais!solicitacoes_exame_solicitado_por_fkey(nome)
`;

/** Resolve profissionais.id a partir do auth user id (concluido_por ≠ auth.uid). */
async function resolveProfissionalId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase.from("profissionais").select("id").eq("user_id", userId).maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  } catch { return null; }
}

/** Normaliza a linha de solicitacoes_exame para o shape legado ExamRequest. */
function normalizeSolicitacao(row: any): ExamRequest {
  const internacao = row?.internacao || {};
  const paciente = internacao.paciente || {};
  return {
    id: row.id,
    internacao_id: row.internacao_id,
    patient_id: row.internacao_id,
    patient_name: paciente.nome_social || paciente.nome_completo || "",
    patient_sector: internacao.setor?.tipo || null,
    patient_bed: internacao.leito?.numero || null,
    category: row.categoria,
    items: Array.isArray(row.itens) ? row.itens : [],
    priority: row.prioridade,
    status: fromSolicitacaoStatusDb(row.status),
    clinical_indication: row.indicacao_clinica || null,
    notes: row.observacoes || null,
    results: row.resultado_texto || null,
    result_data: row.resultado_dados || null,
    requested_by_name: row.solicitante?.nome || null,
    created_at: row.criado_em,
    completed_at: row.concluido_em || null,
    completed_by: null, // MIGRAÇÃO: concluido_por é FK sem relationship declarada → nome não resolvido
  };
}

// ── Lab exam categories ──
const LAB_CATEGORIES = [
  { key: "all", label: "Todos", icon: TestTubes },
  { key: "hemograma", label: "Hemograma", icon: Droplets },
  { key: "bioquimica", label: "Bioquímica", icon: Beaker },
  { key: "gasometria", label: "Gasometria", icon: Flame },
  { key: "coagulacao", label: "Coagulação", icon: Heart },
  { key: "microbiologia", label: "Microbiologia", icon: Microscope },
  { key: "outros", label: "Outros", icon: FileText },
];

const classifyLabExam = (examName: string): string => {
  const name = examName.toLowerCase();
  if (name.includes("hemograma") || name.includes("hematócrito") || name.includes("hemoglobina") || name.includes("leucograma") || name.includes("plaqueta")) return "hemograma";
  if (name.includes("glicemia") || name.includes("ureia") || name.includes("creatinina") || name.includes("sódio") || name.includes("potássio") || name.includes("cálcio") || name.includes("magnésio") || name.includes("fósforo") || name.includes("tgo") || name.includes("tgp") || name.includes("bilirrubina") || name.includes("albumina") || name.includes("pcr") || name.includes("lactato") || name.includes("amilase") || name.includes("lipase")) return "bioquimica";
  if (name.includes("gasometria") || name.includes("ph") || name.includes("pco2") || name.includes("po2") || name.includes("bicarbonato")) return "gasometria";
  if (name.includes("coagul") || name.includes("tp") || name.includes("inr") || name.includes("ttpa") || name.includes("fibrinogênio") || name.includes("d-dímero")) return "coagulacao";
  if (name.includes("cultura") || name.includes("antibiograma") || name.includes("urocultura") || name.includes("hemocultura") || name.includes("gram")) return "microbiologia";
  return "outros";
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock; dotColor: string; pulsing: boolean }> = {
  pending: { label: "Pendente", color: "bg-warning/15 text-warning-on-soft border-warning-border", icon: Clock, dotColor: "bg-warning", pulsing: true },
  acknowledged: { label: "Ciência", color: "bg-primary/15 text-foreground border-border", icon: Eye, dotColor: "bg-primary", pulsing: true },
  in_progress: { label: "Em Execução", color: "bg-primary/15 text-foreground border-border", icon: Loader2, dotColor: "bg-primary", pulsing: true },
  completed: { label: "Concluído", color: "bg-released/15 text-released-on-soft border-released-border", icon: CheckCircle2, dotColor: "bg-released", pulsing: false },
  cancelled: { label: "Cancelado", color: "bg-critical/15 text-critical-on-soft border-critical-border", icon: XCircle, dotColor: "bg-critical", pulsing: false },
};

interface ExamRequest {
  id: string;
  internacao_id?: string;
  patient_id?: string;
  patient_name: string;
  patient_sector: string | null;
  patient_bed: string | null;
  category: string;
  items: any[];
  priority: string;
  status: string;
  clinical_indication: string | null;
  notes: string | null;
  results: string | null;
  result_data: any;
  requested_by_name: string | null;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
}

const SetorLaboratorioPage = () => {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const selectedHospitalId = currentHospital?.id;
  const selectedStateId = currentState?.id;
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<ExamRequest | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [resultText, setResultText] = useState("");
  const [resultFiles, setResultFiles] = useState<ResultFile[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [dateStart, setDateStart] = useState<Date>(startOfDay(new Date()));
  const [dateEnd, setDateEnd] = useState<Date>(endOfDay(new Date()));

  const fetchRequests = async () => {
    if (!selectedHospitalId || !selectedStateId) return;
    setLoading(true);
    try {
      // MIGRAÇÃO: solicitacoes_exame não tem hospital_unit_id/state_id → filtro por
      // unidade removido (RLS escopa por hospital do profissional). Paciente
      // reconstruído via join. Limite para não trazer histórico inteiro.
      const { data, error } = await supabase
        .from("solicitacoes_exame")
        .select(SOLICITACAO_SELECT)
        .eq("categoria", "laboratorio")
        .order("criado_em", { ascending: false })
        .limit(500);

      if (error) throw error;
      setRequests(((data as any[]) || []).map(normalizeSolicitacao));
    } catch (err) {
      console.error("Erro ao carregar requisições:", err);
      toast.error("Não foi possível carregar requisições laboratoriais");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedHospitalId, selectedStateId]);

  useEffect(() => {
    if (!selectedHospitalId) return;
    // MIGRAÇÃO: realtime em solicitacoes_exame. Sem coluna hospital_unit_id →
    // sem filtro por unidade (RLS escopa); refetch por evento (payload não traz joins).
    const channel = supabase
      .channel("lab-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "solicitacoes_exame",
        },
        () => fetchRequests()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedHospitalId]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Date range filter
      try {
        const createdDate = parseISO(r.created_at);
        if (!isWithinInterval(createdDate, { start: dateStart, end: dateEnd })) return false;
      } catch { return false; }

      if (activeTab === "pending" && r.status !== "pending") return false;
      if (activeTab === "acknowledged" && r.status !== "acknowledged") return false;
      if (activeTab === "in_progress" && r.status !== "in_progress") return false;
      if (activeTab === "completed" && r.status !== "completed") return false;

      if (selectedCategory !== "all") {
        const items = Array.isArray(r.items) ? r.items : [];
        const hasCat = items.some((item: any) => classifyLabExam(item.name || item) === selectedCategory);
        if (!hasCat) return false;
      }

      if (search) {
        const term = search.toLowerCase();
        const matchName = r.patient_name?.toLowerCase().includes(term);
        const matchBed = r.patient_bed?.toLowerCase().includes(term);
        const matchSector = getSectorLabel(r.patient_sector)?.toLowerCase().includes(term);
        const matchItems = Array.isArray(r.items) && r.items.some((item: any) =>
          (item.name || item).toString().toLowerCase().includes(term)
        );
        if (!matchName && !matchBed && !matchSector && !matchItems) return false;
      }

      return true;
    });
  }, [requests, activeTab, selectedCategory, search, dateStart, dateEnd]);

  const dateFilteredRequests = useMemo(() => {
    return requests.filter((r) => {
      try {
        const createdDate = parseISO(r.created_at);
        return isWithinInterval(createdDate, { start: dateStart, end: dateEnd });
      } catch { return false; }
    });
  }, [requests, dateStart, dateEnd]);

  const stats = useMemo(() => ({
    pending: dateFilteredRequests.filter(r => r.status === "pending").length,
    acknowledged: dateFilteredRequests.filter(r => r.status === "acknowledged").length,
    inProgress: dateFilteredRequests.filter(r => r.status === "in_progress").length,
    completed: dateFilteredRequests.filter(r => r.status === "completed").length,
    urgent: dateFilteredRequests.filter(r => r.priority === "urgente" && (r.status === "pending" || r.status === "acknowledged")).length,
  }), [dateFilteredRequests]);

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      // MIGRAÇÃO: colunas novas — results→resultado_texto, result_data→
      // resultado_dados, completed_at→concluido_em, completed_by→concluido_por
      // (FK profissional via user_id; e-mail avulso não tem mais coluna).
      const updateData: any = { status: toSolicitacaoStatusDb(newStatus) };
      if (newStatus === "completed") {
        updateData.concluido_em = new Date().toISOString();
        updateData.concluido_por = await resolveProfissionalId(user?.id);
        if (resultText.trim()) {
          updateData.resultado_texto = resultText.trim();
        }
        if (resultFiles.length > 0) {
          updateData.resultado_dados = { files: resultFiles };
        }
      }

      const { error } = await supabase
        .from("solicitacoes_exame")
        .update(updateData)
        .eq("id", requestId);

      if (error) throw error;

      toast.success(
        newStatus === "acknowledged" ? "Ciência declarada" :
        newStatus === "in_progress" ? "Exame em execução" :
        newStatus === "completed" ? "Exame concluído" :
        "Status atualizado"
      );
      setShowDetailDialog(false);
      setResultText("");
      setResultFiles([]);
      fetchRequests();
    } catch (err) {
      toast.error("Não foi possível atualizar status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openDetail = (request: ExamRequest) => {
    setSelectedRequest(request);
    setResultText(request.results || "");
    const existingFiles: ResultFile[] = request.result_data?.files || [];
    setResultFiles(existingFiles);
    setShowDetailDialog(true);
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === "urgente") return (
      <Badge className="bg-critical/15 text-critical-on-soft border-critical-border text-xs font-semibold animate-pulse">
        <AlertTriangle className="h-3 w-3 mr-1" /> URGENTE
      </Badge>
    );
    if (priority === "rotina") return (
      <Badge variant="outline" className="text-xs text-foreground border-border bg-primary/10">
        <Clock className="h-3 w-3 mr-1" /> Rotina
      </Badge>
    );
    return (
      <Badge variant="outline" className="text-xs text-foreground border-border bg-primary/10">
        <CalendarIcon className="h-3 w-3 mr-1" /> Programado
      </Badge>
    );
  };

  return (
    <>
      <PlatformHeader
        variant="institutional"
        eyebrow="Diagnóstico · Laboratório"
        title="Setor Laboratorial"
        icon={TestTubes}
        subtitle={<span className="truncate">Recepção e execução de exames laboratoriais</span>}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            className="gap-2 h-9 bg-white/95 text-foreground border-border hover:bg-white hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        }
      />

    <div className="p-4 sm:p-6 space-y-4">

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-warning-border bg-warning-soft/50">
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="h-8 w-8 text-warning" />
            <div>
              <p className="text-2xl font-semibold text-warning-on-soft">{stats.pending}</p>
              <p className="text-xs text-warning-on-soft uppercase tracking-wider font-medium">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-muted/50">
          <CardContent className="p-3 flex items-center gap-3">
            <Loader2 className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold text-foreground">{stats.inProgress}</p>
              <p className="text-xs text-foreground uppercase tracking-wider font-medium">Em Execução</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-released-border bg-released-soft/50">
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-released" />
            <div>
              <p className="text-2xl font-semibold text-released-on-soft">{stats.completed}</p>
              <p className="text-xs text-released-on-soft uppercase tracking-wider font-medium">Concluídos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-critical-border bg-critical-soft/50">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-critical" />
            <div>
              <p className="text-2xl font-semibold text-critical-on-soft">{stats.urgent}</p>
              <p className="text-xs text-critical-on-soft uppercase tracking-wider font-medium">Urgentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/30">
        <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground shrink-0">Período:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(dateStart, "dd/MM/yyyy", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateStart}
              onSelect={(d) => d && setDateStart(startOfDay(d))}
              locale={ptBR}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">até</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(dateEnd, "dd/MM/yyyy", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateEnd}
              onSelect={(d) => d && setDateEnd(endOfDay(d))}
              locale={ptBR}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setDateStart(startOfDay(new Date()));
            setDateEnd(endOfDay(new Date()));
          }}
        >
          Hoje
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {LAB_CATEGORIES.map((cat) => (
          <Button
            key={cat.key}
            variant={selectedCategory === cat.key ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.key)}
            className={cn(
              "gap-2 text-xs whitespace-nowrap shrink-0",
              selectedCategory === cat.key && "bg-warning hover:bg-warning text-white"
            )}
          >
            <cat.icon className="h-3.5 w-3.5" />
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente, leito ou exame..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="pending" className="gap-2 text-xs">
            <Clock className="h-3.5 w-3.5" /> Pendentes ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="acknowledged" className="gap-2 text-xs">
            <Eye className="h-3.5 w-3.5" /> Ciência ({stats.acknowledged})
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5" /> Execução ({stats.inProgress})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluídos ({stats.completed})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2 text-xs">
            <TestTubes className="h-3.5 w-3.5" /> Todos
          </TabsTrigger>
        </TabsList>

        {["pending", "acknowledged", "in_progress", "completed", "all"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-warning" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TestTubes className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma requisição encontrada</p>
                <p className="text-sm mt-1">
                   {tab === "pending" ? "Sem exames pendentes no momento" :
                    tab === "acknowledged" ? "Nenhum exame com ciência declarada" :
                    tab === "in_progress" ? "Nenhum exame em execução" :
                    tab === "completed" ? "Nenhum exame concluído" :
                    "Nenhuma requisição laboratorial"}
                </p>
              </div>
            ) : (
              filteredRequests.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const items = Array.isArray(req.items) ? req.items : [];
                const timeSince = format(new Date(req.created_at), "dd/MM HH:mm", { locale: ptBR });

                return (
                  <Card
                    key={req.id}
                    className={cn(
                      "cursor-pointer hover:shadow-md transition-all border",
                      req.priority === "urgente" && req.status === "pending" && "border-critical-border bg-critical-soft/30"
                    )}
                    onClick={() => openDetail(req)}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="patient-id font-semibold text-sm text-foreground truncate">{req.patient_name}</span>
                            {req.patient_bed && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {req.patient_sector && `${getSectorLabel(req.patient_sector)} · `}Leito {req.patient_bed}
                              </Badge>
                            )}
                            {getPriorityBadge(req.priority)}
                          </div>

                          <div className="flex flex-wrap gap-1 mb-2">
                            {items.slice(0, 5).map((item: any, idx: number) => {
                              const name = item.name || item;
                              const cat = classifyLabExam(name);
                              const catConfig = LAB_CATEGORIES.find(c => c.key === cat);
                              return (
                                <Badge key={idx} variant="secondary" className="text-xs gap-1">
                                  {catConfig && <catConfig.icon className="h-2.5 w-2.5" />}
                                  {name}
                                </Badge>
                              );
                            })}
                            {items.length > 5 && (
                              <Badge variant="secondary" className="text-xs">+{items.length - 5}</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Solicitado: {timeSince}</span>
                            {req.requested_by_name && <span>por {req.requested_by_name}</span>}
                            {req.clinical_indication && (
                              <span className="truncate max-w-[200px]">IC: {req.clinical_indication}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "inline-block h-2.5 w-2.5 rounded-full",
                            statusCfg.dotColor,
                            statusCfg.pulsing && "animate-pulse-soft"
                          )} />
                          <Badge className={cn("text-xs border", statusCfg.color)}>
                            <statusCfg.icon className={cn("h-3 w-3 mr-1", req.status === "in_progress" && "animate-spin")} />
                            {statusCfg.label}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Detail / Action Dialog ── */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTubes className="h-5 w-5 text-warning-on-soft" />
              Detalhes da Requisição
            </DialogTitle>
            <DialogDescription>
              Visualize e gerencie o status do exame laboratorial
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="patient-id font-semibold text-foreground">{selectedRequest.patient_name}</span>
                  {getPriorityBadge(selectedRequest.priority)}
                </div>
                <div className="text-xs text-muted-foreground flex gap-3">
                  {selectedRequest.patient_sector && <span>Setor: {getSectorLabel(selectedRequest.patient_sector)}</span>}
                  {selectedRequest.patient_bed && <span>Leito: {selectedRequest.patient_bed}</span>}
                </div>
                {selectedRequest.clinical_indication && (
                  <div className="text-xs mt-1 p-2 rounded-md bg-warning-soft/50 border border-warning-border">
                    <strong className="text-warning-on-soft">Justificativa Clínica:</strong>{" "}
                    <span className="text-foreground">{selectedRequest.clinical_indication}</span>
                  </div>
                )}
                {selectedRequest.notes && selectedRequest.notes.includes("[PROGRAMADO:") && (
                  <div className="text-xs p-2 rounded-md bg-muted/50 border border-border">
                    <strong className="text-foreground">Agendamento:</strong>{" "}
                    <span className="text-foreground">
                      {selectedRequest.notes.match(/\[PROGRAMADO: ([^\]]+)\]/)?.[1] || ""}
                    </span>
                  </div>
                )}
                {selectedRequest.requested_by_name && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Solicitante:</strong> {selectedRequest.requested_by_name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  <strong>Data:</strong> {format(new Date(selectedRequest.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-foreground mb-2 uppercase tracking-wider">Exames Solicitados</p>
                <div className="space-y-2">
                  {(Array.isArray(selectedRequest.items) ? selectedRequest.items : []).map((item: any, idx: number) => {
                    const name = item.name || item;
                    const cat = classifyLabExam(name);
                    const catConfig = LAB_CATEGORIES.find(c => c.key === cat);
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-background border text-sm">
                        {catConfig && <catConfig.icon className="h-4 w-4 text-warning-on-soft shrink-0" />}
                        <span>{name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedRequest.notes && (
                <div className="p-3 rounded-lg bg-warning-soft/50 border border-warning-border text-xs">
                  <strong>Observações:</strong> {selectedRequest.notes}
                </div>
              )}

              {(selectedRequest.status !== "pending") && (
                <ExamResultInput
                  resultText={resultText}
                  onResultTextChange={setResultText}
                  resultFiles={resultFiles}
                  onResultFilesChange={setResultFiles}
                  readOnly={selectedRequest.status === "completed"}
                  requestId={selectedRequest.id}
                  hospitalUnitId={selectedHospitalId}
                />
              )}

              {selectedRequest.completed_by && selectedRequest.status === "completed" && (
                <p className="text-xs text-muted-foreground">
                  Concluído por: {selectedRequest.completed_by}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {selectedRequest && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs mr-auto"
                onClick={() => printRequisitionGuideWithGasometriaPrompt(selectedRequest, (s) => getSectorLabel(s))}
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir Guia
              </Button>
            )}
            {selectedRequest?.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedRequest.id, "cancelled")}
                  disabled={updatingStatus}
                  className="text-critical-on-soft border-critical-border hover:bg-critical-soft"
                >
                  <XCircle className="h-4 w-4 mr-1" /> Recusar
                </Button>
                <Button
                  onClick={() => handleUpdateStatus(selectedRequest.id, "acknowledged")}
                  disabled={updatingStatus}
                  className="bg-primary hover:bg-primary text-white"
                >
                  <Eye className="h-4 w-4 mr-1" /> Declarar Ciência
                </Button>
              </>
            )}
            {selectedRequest?.status === "acknowledged" && (
              <Button
                onClick={() => handleUpdateStatus(selectedRequest.id, "in_progress")}
                disabled={updatingStatus}
                className="bg-primary hover:bg-primary text-white"
              >
                <Loader2 className="h-4 w-4 mr-1" /> Iniciar Execução
              </Button>
            )}
            {selectedRequest?.status === "in_progress" && (
              <Button
                onClick={() => handleUpdateStatus(selectedRequest.id, "completed")}
                disabled={updatingStatus}
                className="bg-released hover:bg-released text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir Exame
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
};

export default SetorLaboratorioPage;
