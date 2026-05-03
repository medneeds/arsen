import React, { useState, useEffect, useMemo } from "react";
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ScanLine, Search, Clock, CheckCircle2, XCircle, Eye, Loader2,
  Filter, RefreshCw, ImageIcon, Zap, MonitorSpeaker, Heart,
  Bone, Baby, AlertTriangle, FileText, CalendarIcon, Printer,
} from "lucide-react";
import { PlatformHeader } from "@/components/layout/PlatformHeader";
import ExamResultInput, { ResultFile } from "@/components/ExamResultInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { SECTOR_BED_CONFIG, getSectorDisplayLabel } from "@/utils/bedNaming";
import { printRequisitionGuide } from "@/components/PrintableRequisitionGuide";

const getSectorLabel = getSectorDisplayLabel;

// ── Imaging modality categories ──
const MODALITIES = [
  { key: "all", label: "Todos", icon: ScanLine },
  { key: "rx", label: "RX", icon: Bone },
  { key: "tc", label: "Tomografias", icon: MonitorSpeaker },
  { key: "usg", label: "Ultrassonografias", icon: ImageIcon },
  { key: "eco", label: "Ecocardiogramas", icon: Heart },
  { key: "rm", label: "Ressonância", icon: Zap },
  { key: "outros", label: "Outros", icon: FileText },
];

// Map exam names to modalities for filtering
const classifyExam = (examName: string): string => {
  const name = examName.toLowerCase();
  if (name.includes("rx") || name.includes("raio") || name.includes("radiografia")) return "rx";
  if (name.includes("tc") || name.includes("tomografia") || name.includes("angiotomografia")) return "tc";
  if (name.includes("usg") || name.includes("ultrassom") || name.includes("ultrassonografia") || name.includes("doppler")) return "usg";
  if (name.includes("eco") || name.includes("ecocardiograma")) return "eco";
  if (name.includes("rm") || name.includes("ressonância") || name.includes("ressonancia")) return "rm";
  return "outros";
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock; dotColor: string; pulsing: boolean }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-700 border-amber-300", icon: Clock, dotColor: "bg-amber-500", pulsing: true },
  acknowledged: { label: "Ciência", color: "bg-indigo-500/15 text-indigo-700 border-indigo-300", icon: Eye, dotColor: "bg-indigo-500", pulsing: true },
  in_progress: { label: "Em Execução", color: "bg-blue-500/15 text-blue-700 border-blue-300", icon: Loader2, dotColor: "bg-blue-500", pulsing: true },
  completed: { label: "Concluído", color: "bg-emerald-500/15 text-emerald-700 border-emerald-300", icon: CheckCircle2, dotColor: "bg-emerald-500", pulsing: false },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-700 border-red-300", icon: XCircle, dotColor: "bg-red-500", pulsing: false },
};

interface ExamRequest {
  id: string;
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
  requested_by_name: string | null;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
}

const SetorImagemPage = () => {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const selectedHospitalId = currentHospital?.id;
  const selectedStateId = currentState?.id;
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedModality, setSelectedModality] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<ExamRequest | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [resultText, setResultText] = useState("");
  const [resultFiles, setResultFiles] = useState<ResultFile[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [dateStart, setDateStart] = useState<Date>(startOfDay(new Date()));
  const [dateEnd, setDateEnd] = useState<Date>(endOfDay(new Date()));

  // Fetch imaging requests
  const fetchRequests = async () => {
    if (!selectedHospitalId || !selectedStateId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("exam_requests")
        .select("*")
        .eq("hospital_unit_id", selectedHospitalId)
        .eq("state_id", selectedStateId)
        .eq("category", "imagem")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data as ExamRequest[]) || []);
    } catch (err) {
      console.error("Erro ao carregar requisições:", err);
      toast.error("Erro ao carregar requisições de imagem");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedHospitalId, selectedStateId]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedHospitalId) return;
    const channel = supabase
      .channel("imagem-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exam_requests",
          filter: `hospital_unit_id=eq.${selectedHospitalId}`,
        },
        () => fetchRequests()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedHospitalId]);

  // Filter logic
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Date range filter
      try {
        const createdDate = parseISO(r.created_at);
        if (!isWithinInterval(createdDate, { start: dateStart, end: dateEnd })) return false;
      } catch { return false; }

      // Status tab filter
      if (activeTab === "pending" && r.status !== "pending") return false;
      if (activeTab === "acknowledged" && r.status !== "acknowledged") return false;
      if (activeTab === "in_progress" && r.status !== "in_progress") return false;
      if (activeTab === "completed" && r.status !== "completed") return false;

      // Modality filter
      if (selectedModality !== "all") {
        const items = Array.isArray(r.items) ? r.items : [];
        const hasModality = items.some((item: any) => classifyExam(item.name || item) === selectedModality);
        if (!hasModality) return false;
      }

      // Search filter
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
  }, [requests, activeTab, selectedModality, search, dateStart, dateEnd]);

  // Stats
  // Date-filtered requests for stats
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

  // Update request status
  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.email || "imagem";
        if (resultText.trim()) {
          updateData.results = resultText.trim();
        }
        if (resultFiles.length > 0) {
          updateData.result_data = { files: resultFiles };
        }
      }

      const { error } = await supabase
        .from("exam_requests")
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
      toast.error("Erro ao atualizar status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openDetail = (request: ExamRequest) => {
    setSelectedRequest(request);
    setResultText(request.results || "");
    // Load existing files from result_data
    const rd = request as any;
    const existingFiles: ResultFile[] = rd.result_data?.files || [];
    setResultFiles(existingFiles);
    setShowDetailDialog(true);
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === "urgente") return (
      <Badge className="bg-red-500/15 text-red-700 border-red-300 text-[10px] font-bold animate-pulse">
        <AlertTriangle className="h-3 w-3 mr-1" /> URGENTE
      </Badge>
    );
    if (priority === "rotina") return (
      <Badge variant="outline" className="text-[10px] text-cyan-600 border-cyan-300 bg-cyan-500/10">
        <Clock className="h-3 w-3 mr-1" /> Rotina
      </Badge>
    );
    return (
      <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300 bg-blue-500/10">
        <CalendarIcon className="h-3 w-3 mr-1" /> Programado
      </Badge>
    );
  };

  return (
    <>
      <PlatformHeader
        variant="institutional"
        eyebrow="Diagnóstico · Imagem"
        title="Setor de Imagem"
        icon={ScanLine}
        subtitle={<span className="truncate">Recepção e execução de exames de imagem</span>}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            className="gap-2 h-9 bg-white/95 text-foreground border-border hover:bg-white hover:text-foreground dark:bg-background dark:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        }
      />

    <div className="p-4 sm:p-6 space-y-5">

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
              <p className="text-[10px] text-amber-600 uppercase tracking-wider font-medium">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Loader2 className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-blue-700">{stats.inProgress}</p>
              <p className="text-[10px] text-blue-600 uppercase tracking-wider font-medium">Em Execução</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-emerald-700">{stats.completed}</p>
              <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-medium">Concluídos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.urgent}</p>
              <p className="text-[10px] text-red-600 uppercase tracking-wider font-medium">Urgentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/30">
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

      {/* Modality Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {MODALITIES.map((mod) => (
          <Button
            key={mod.key}
            variant={selectedModality === mod.key ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedModality(mod.key)}
            className={cn(
              "gap-1.5 text-xs whitespace-nowrap shrink-0",
              selectedModality === mod.key && "bg-rose-500 hover:bg-rose-600 text-white"
            )}
          >
            <mod.icon className="h-3.5 w-3.5" />
            {mod.label}
          </Button>
        ))}
      </div>

      {/* Search + Status Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente, leito ou exame..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="pending" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Pendentes ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="acknowledged" className="gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" /> Ciência ({stats.acknowledged})
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-1.5 text-xs">
            <Loader2 className="h-3.5 w-3.5" /> Execução ({stats.inProgress})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluídos ({stats.completed})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5 text-xs">
            <ScanLine className="h-3.5 w-3.5" /> Todos
          </TabsTrigger>
        </TabsList>

        {/* Content for all tabs uses same list */}
        {["pending", "acknowledged", "in_progress", "completed", "all"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ScanLine className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma requisição encontrada</p>
                <p className="text-sm mt-1">
                   {tab === "pending" ? "Sem exames pendentes no momento" :
                    tab === "acknowledged" ? "Nenhum exame com ciência declarada" :
                    tab === "in_progress" ? "Nenhum exame em execução" :
                    tab === "completed" ? "Nenhum exame concluído" :
                    "Nenhuma requisição de imagem"}
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
                      req.priority === "urgente" && req.status === "pending" && "border-red-300 bg-red-50/30 dark:bg-red-500/5"
                    )}
                    onClick={() => openDetail(req)}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Patient info line */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="patient-id font-bold text-sm text-foreground truncate">{req.patient_name}</span>
                            {req.patient_bed && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {req.patient_sector && `${getSectorLabel(req.patient_sector)} · `}Leito {req.patient_bed}
                              </Badge>
                            )}
                            {getPriorityBadge(req.priority)}
                          </div>

                          {/* Exam items */}
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {items.slice(0, 5).map((item: any, idx: number) => {
                              const name = item.name || item;
                              const modality = classifyExam(name);
                              const modConfig = MODALITIES.find(m => m.key === modality);
                              return (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-[10px] gap-1"
                                >
                                  {modConfig && <modConfig.icon className="h-2.5 w-2.5" />}
                                  {name}
                                </Badge>
                              );
                            })}
                            {items.length > 5 && (
                              <Badge variant="secondary" className="text-[10px]">
                                +{items.length - 5}
                              </Badge>
                            )}
                          </div>

                          {/* Meta line */}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>Solicitado: {timeSince}</span>
                            {req.requested_by_name && <span>por {req.requested_by_name}</span>}
                            {req.clinical_indication && (
                              <span className="truncate max-w-[200px]">IC: {req.clinical_indication}</span>
                            )}
                          </div>
                        </div>

                        {/* Status badge with pulsing dot */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={cn(
                            "inline-block h-2.5 w-2.5 rounded-full",
                            statusCfg.dotColor,
                            statusCfg.pulsing && "animate-pulse-soft"
                          )} />
                          <Badge className={cn("text-[10px] border", statusCfg.color)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-rose-500" />
              Detalhes da Requisição
            </DialogTitle>
            <DialogDescription>
              Visualize e gerencie o status do exame de imagem
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Patient info */}
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="patient-id font-bold text-foreground">{selectedRequest.patient_name}</span>
                  {getPriorityBadge(selectedRequest.priority)}
                </div>
                <div className="text-xs text-muted-foreground flex gap-3">
                  {selectedRequest.patient_sector && <span>Setor: {getSectorLabel(selectedRequest.patient_sector)}</span>}
                  {selectedRequest.patient_bed && <span>Leito: {selectedRequest.patient_bed}</span>}
                </div>
                {selectedRequest.clinical_indication && (
                  <div className="text-xs mt-1 p-2 rounded-md bg-amber-50/50 border border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20">
                    <strong className="text-amber-700 dark:text-amber-400">Justificativa Clínica:</strong>{" "}
                    <span className="text-foreground">{selectedRequest.clinical_indication}</span>
                  </div>
                )}
                {selectedRequest.notes && selectedRequest.notes.includes("[PROGRAMADO:") && (
                  <div className="text-xs p-2 rounded-md bg-blue-50/50 border border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20">
                    <strong className="text-blue-700 dark:text-blue-400">📅 Agendamento:</strong>{" "}
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

              {/* Exam items */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">Exames Solicitados</p>
                <div className="space-y-1.5">
                  {(Array.isArray(selectedRequest.items) ? selectedRequest.items : []).map((item: any, idx: number) => {
                    const name = item.name || item;
                    const modality = classifyExam(name);
                    const modConfig = MODALITIES.find(m => m.key === modality);
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-background border text-sm">
                        {modConfig && <modConfig.icon className="h-4 w-4 text-rose-500 shrink-0" />}
                        <span>{name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              {selectedRequest.notes && (
                <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 text-xs">
                  <strong>Observações:</strong> {selectedRequest.notes}
                </div>
              )}

              {/* Results area (for completing or viewing) */}
              {(selectedRequest.status !== "pending") && (
                <ExamResultInput
                  resultText={resultText}
                  onResultTextChange={setResultText}
                  resultFiles={resultFiles}
                  onResultFilesChange={setResultFiles}
                  readOnly={selectedRequest.status === "completed"}
                  requestId={selectedRequest.id}
                />
              )}

              {/* Completed meta */}
              {selectedRequest.completed_by && selectedRequest.status === "completed" && (
                <p className="text-[10px] text-muted-foreground">
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
                className="gap-1.5 text-xs mr-auto"
                onClick={() => printRequisitionGuide(selectedRequest, (s) => getSectorLabel(s))}
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
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-1" /> Recusar
                </Button>
                <Button
                  onClick={() => handleUpdateStatus(selectedRequest.id, "acknowledged")}
                  disabled={updatingStatus}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  <Eye className="h-4 w-4 mr-1" /> Declarar Ciência
                </Button>
              </>
            )}
            {selectedRequest?.status === "acknowledged" && (
              <Button
                onClick={() => handleUpdateStatus(selectedRequest.id, "in_progress")}
                disabled={updatingStatus}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Loader2 className="h-4 w-4 mr-1" /> Iniciar Execução
              </Button>
            )}
            {selectedRequest?.status === "in_progress" && (
              <Button
                onClick={() => handleUpdateStatus(selectedRequest.id, "completed")}
                disabled={updatingStatus}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir Exame
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SetorImagemPage;
