import React, { useState, useEffect, useMemo } from "react";
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TestTubes, Search, Clock, CheckCircle2, XCircle, Eye, Loader2,
  RefreshCw, AlertTriangle, FileText, Droplets, Flame, Beaker,
  Microscope, Heart, CalendarIcon,
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
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";

const getSectorLabel = (sector: string | null) => {
  if (!sector) return "";
  return SECTOR_BED_CONFIG[sector]?.label || sector;
};

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
      const { data, error } = await supabase
        .from("exam_requests")
        .select("*")
        .eq("hospital_unit_id", selectedHospitalId)
        .eq("state_id", selectedStateId)
        .eq("category", "laboratorio")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data as ExamRequest[]) || []);
    } catch (err) {
      console.error("Erro ao carregar requisições:", err);
      toast.error("Erro ao carregar requisições laboratoriais");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedHospitalId, selectedStateId]);

  useEffect(() => {
    if (!selectedHospitalId) return;
    const channel = supabase
      .channel("lab-requests")
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

  const stats = useMemo(() => ({
    pending: requests.filter(r => r.status === "pending").length,
    acknowledged: requests.filter(r => r.status === "acknowledged").length,
    inProgress: requests.filter(r => r.status === "in_progress").length,
    completed: requests.filter(r => r.status === "completed").length,
    urgent: requests.filter(r => r.priority === "urgente" && (r.status === "pending" || r.status === "acknowledged")).length,
  }), [requests]);

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.email || "laboratorio";
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
    const existingFiles: ResultFile[] = request.result_data?.files || [];
    setResultFiles(existingFiles);
    setShowDetailDialog(true);
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === "urgente") return (
      <Badge className="bg-red-500/15 text-red-700 border-red-300 text-[10px] font-bold animate-pulse">
        <AlertTriangle className="h-3 w-3 mr-1" /> URGENTE
      </Badge>
    );
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">Rotina</Badge>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <TestTubes className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Setor Laboratorial</h1>
            <p className="text-xs text-muted-foreground">Recepção e Execução de Exames Laboratoriais</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

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

      {/* Category Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {LAB_CATEGORIES.map((cat) => (
          <Button
            key={cat.key}
            variant={selectedCategory === cat.key ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.key)}
            className={cn(
              "gap-1.5 text-xs whitespace-nowrap shrink-0",
              selectedCategory === cat.key && "bg-amber-500 hover:bg-amber-600 text-white"
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
            <TestTubes className="h-3.5 w-3.5" /> Todos
          </TabsTrigger>
        </TabsList>

        {["pending", "acknowledged", "in_progress", "completed", "all"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
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
                      req.priority === "urgente" && req.status === "pending" && "border-red-300 bg-red-50/30 dark:bg-red-500/5"
                    )}
                    onClick={() => openDetail(req)}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-bold text-sm text-foreground truncate">{req.patient_name}</span>
                            {req.patient_bed && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {req.patient_sector && `${getSectorLabel(req.patient_sector)} · `}Leito {req.patient_bed}
                              </Badge>
                            )}
                            {getPriorityBadge(req.priority)}
                          </div>

                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {items.slice(0, 5).map((item: any, idx: number) => {
                              const name = item.name || item;
                              const cat = classifyLabExam(name);
                              const catConfig = LAB_CATEGORIES.find(c => c.key === cat);
                              return (
                                <Badge key={idx} variant="secondary" className="text-[10px] gap-1">
                                  {catConfig && <catConfig.icon className="h-2.5 w-2.5" />}
                                  {name}
                                </Badge>
                              );
                            })}
                            {items.length > 5 && (
                              <Badge variant="secondary" className="text-[10px]">+{items.length - 5}</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>Solicitado: {timeSince}</span>
                            {req.requested_by_name && <span>por {req.requested_by_name}</span>}
                            {req.clinical_indication && (
                              <span className="truncate max-w-[200px]">IC: {req.clinical_indication}</span>
                            )}
                          </div>
                        </div>

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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTubes className="h-5 w-5 text-amber-600" />
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
                  <span className="font-bold text-foreground">{selectedRequest.patient_name}</span>
                  {getPriorityBadge(selectedRequest.priority)}
                </div>
                <div className="text-xs text-muted-foreground flex gap-3">
                  {selectedRequest.patient_sector && <span>Setor: {getSectorLabel(selectedRequest.patient_sector)}</span>}
                  {selectedRequest.patient_bed && <span>Leito: {selectedRequest.patient_bed}</span>}
                </div>
                {selectedRequest.clinical_indication && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Indicação clínica:</strong> {selectedRequest.clinical_indication}
                  </p>
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
                <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">Exames Solicitados</p>
                <div className="space-y-1.5">
                  {(Array.isArray(selectedRequest.items) ? selectedRequest.items : []).map((item: any, idx: number) => {
                    const name = item.name || item;
                    const cat = classifyLabExam(name);
                    const catConfig = LAB_CATEGORIES.find(c => c.key === cat);
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-background border text-sm">
                        {catConfig && <catConfig.icon className="h-4 w-4 text-amber-600 shrink-0" />}
                        <span>{name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedRequest.notes && (
                <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 text-xs">
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
                />
              )}

              {selectedRequest.completed_by && selectedRequest.status === "completed" && (
                <p className="text-[10px] text-muted-foreground">
                  Concluído por: {selectedRequest.completed_by}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
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

export default SetorLaboratorioPage;
