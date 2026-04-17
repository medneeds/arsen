import { useMemo, useState } from "react";
import { 
  Building2, ArrowLeftRight, Globe, BedDouble, ClipboardPlus, 
  Repeat, LogOut, Lock, FileText, BarChart3, 
  Clock, CheckCircle2, XCircle, Search, RefreshCw, AlertTriangle, Sparkles, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useHospital } from "@/contexts/HospitalContext";
import { cn } from "@/lib/utils";
import { useNirMetrics, type NirFilters } from "@/hooks/useNirMetrics";
import { NirGlobalFilters } from "@/components/nir/NirGlobalFilters";
import { NirKpiStrip } from "@/components/nir/NirKpiStrip";
import { NirAlertBar } from "@/components/nir/NirAlertBar";
import { NirAnalyticsPanel } from "@/components/nir/NirAnalyticsPanel";
import { NirDischargeForecast } from "@/components/nir/NirDischargeForecast";
import { NirPdfExport } from "@/components/nir/NirPdfExport";
import { useDischargePredictions } from "@/hooks/useDischargePredictions";

const NIR_MODULES = [
  { key: "regulacao_interna", label: "Regulação Interna", subtitle: "Transferências entre setores", icon: ArrowLeftRight, color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" },
  { key: "regulacao_externa", label: "Regulação Externa", subtitle: "SISREG / Central de Regulação", icon: Globe, color: "text-purple-500", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20" },
  { key: "censo_leitos", label: "Censo de Leitos", subtitle: "Ocupação em tempo real", icon: BedDouble, color: "text-emerald-500", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" },
  { key: "solicitacao_vaga", label: "Solicitação de Vaga", subtitle: "Pedidos de internação", icon: ClipboardPlus, color: "text-amber-500", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" },
  { key: "transferencia_interunidade", label: "Transferência Interunidade", subtitle: "Movimentação entre hospitais", icon: Repeat, color: "text-cyan-500", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/20" },
  { key: "alta_administrativa", label: "Alta Administrativa", subtitle: "Liberação e desfecho", icon: LogOut, color: "text-rose-500", bgColor: "bg-rose-500/10", borderColor: "border-rose-500/20" },
  { key: "bloqueio_interdicao", label: "Bloqueio / Interdição", subtitle: "Gestão de leitos bloqueados", icon: Lock, color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500/20" },
  { key: "parecer_regulatorio", label: "Parecer Regulatório", subtitle: "Avaliações e laudos", icon: FileText, color: "text-indigo-500", bgColor: "bg-indigo-500/10", borderColor: "border-indigo-500/20" },
  { key: "relatorios_nir", label: "Relatórios NIR", subtitle: "Indicadores e métricas", icon: BarChart3, color: "text-teal-500", bgColor: "bg-teal-500/10", borderColor: "border-teal-500/20" },
];

const BED_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  vago: { label: "Vago", color: "bg-emerald-500" },
  ocupado: { label: "Ocupado", color: "bg-blue-500" },
  bloqueado: { label: "Bloqueado", color: "bg-red-500" },
  higienizacao: { label: "Higienização", color: "bg-amber-500" },
  reservado: { label: "Reservado", color: "bg-purple-500" },
  manutencao: { label: "Manutenção", color: "bg-orange-500" },
  interditado: { label: "Interditado", color: "bg-red-700" },
  alta_medica_dada: { label: "Alta Médica Dada", color: "bg-cyan-500" },
};

type AlertKind = "stuck24h" | "saturated" | "cleaning" | "sisreg" | null;

export default function NirDashboardPage() {
  const { currentHospital } = useHospital();
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeAlert, setActiveAlert] = useState<AlertKind>(null);
  const [filters, setFilters] = useState<NirFilters>({ period: "today", sectorScope: "all", priority: "all" });

  const { isLoading, refetch, beds, requests, metrics, historical, heatmap, flow } = useNirMetrics(currentHospital?.id, filters);
  const { data: predictions = [] } = useDischargePredictions(currentHospital?.id);

  const bedsBySector = useMemo(
    () =>
      beds.reduce((acc: Record<string, any[]>, bed: any) => {
        if (!acc[bed.sector]) acc[bed.sector] = [];
        acc[bed.sector].push(bed);
        return acc;
      }, {}),
    [beds],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (r: any) =>
          !searchTerm ||
          r.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.request_type?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [requests, searchTerm],
  );

  const alertList = useMemo(() => {
    switch (activeAlert) {
      case "stuck24h": return { title: "Pacientes aguardando vaga há +24h", items: metrics.stuck24h, kind: "patient" as const };
      case "saturated": {
        const saturated = metrics.occupancyBySector.filter((s) => s.rate >= 80);
        return { title: "Setores com ocupação ≥80%", items: saturated, kind: "sector" as const };
      }
      case "cleaning": return { title: "Leitos em higienização há +4h", items: metrics.longCleaning, kind: "bed" as const };
      case "sisreg": return { title: "SISREG sem resposta há +12h", items: metrics.sisregStuck, kind: "patient" as const };
      default: return null;
    }
  }, [activeAlert, metrics]);

  const renderModuleContent = () => {
    if (!activeModule) return null;

    switch (activeModule) {
      case "censo_leitos":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Censo de Leitos — Tempo Real</h3>
              <Button variant="outline" size="sm" onClick={refetch}>
                <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(BED_STATUS_LABELS).map(([key, { label, color }]) => {
                const count = beds.filter((b: any) => b.status === key).length;
                return (
                  <Badge key={key} variant="outline" className="gap-1.5 text-xs">
                    <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
                    {label}: {count}
                  </Badge>
                );
              })}
            </div>

            {Object.keys(bedsBySector).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BedDouble className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum leito cadastrado no censo</p>
                  <p className="text-sm mt-1">Os leitos serão exibidos aqui conforme forem registrados no sistema.</p>
                </CardContent>
              </Card>
            ) : (
              Object.entries(bedsBySector).map(([sector, sectorBeds]) => (
                <Card key={sector}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {sector}
                      <Badge variant="secondary" className="text-[10px]">{sectorBeds.length} leitos</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {sectorBeds.map((bed: any) => {
                        const statusInfo = BED_STATUS_LABELS[bed.status] || { label: bed.status, color: "bg-muted" };
                        return (
                          <div
                            key={bed.id}
                            className={cn(
                              "rounded-lg border p-2 text-center cursor-pointer hover:shadow-md transition-shadow",
                              bed.status === "vago" ? "border-emerald-500/30 bg-emerald-500/5" :
                              bed.status === "ocupado" ? "border-blue-500/30 bg-blue-500/5" :
                              "border-red-500/30 bg-red-500/5"
                            )}
                            title={`${bed.bed_number} — ${statusInfo.label}${bed.patient_name ? ` — ${bed.patient_name}` : ""}`}
                          >
                            <span className="text-xs font-bold block">{bed.bed_number}</span>
                            <span className={cn("h-2 w-2 rounded-full inline-block mt-1", statusInfo.color)} />
                            {bed.patient_name && (
                              <p className="patient-id text-[9px] text-muted-foreground truncate mt-0.5">{bed.patient_name}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case "relatorios_nir":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Relatórios e Indicadores NIR</h3>
            <NirAnalyticsPanel metrics={metrics} historical={historical} heatmap={heatmap} flow={flow} />
          </div>
        );

      default: {
        const typeMap: Record<string, string> = {
          regulacao_interna: "interna",
          regulacao_externa: "externa_sisreg",
          solicitacao_vaga: "solicitacao_vaga",
          transferencia_interunidade: "transferencia_interunidade",
          alta_administrativa: "alta_administrativa",
          bloqueio_interdicao: "bloqueio_interdicao",
          parecer_regulatorio: "parecer_regulatorio",
        };
        const moduleConfig = NIR_MODULES.find(m => m.key === activeModule);
        const typeFilter = typeMap[activeModule];
        const moduleRequests = typeFilter ? filteredRequests.filter((r: any) => r.request_type === typeFilter) : filteredRequests;

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">{moduleConfig?.label}</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar paciente..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 w-48"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={refetch}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {moduleRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {moduleConfig && <moduleConfig.icon className="h-12 w-12 mx-auto mb-3 opacity-30" />}
                  <p className="font-medium">Nenhuma solicitação encontrada</p>
                  <p className="text-sm mt-1">As solicitações de {moduleConfig?.label.toLowerCase()} aparecerão aqui.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {moduleRequests.map((req: any) => (
                  <Card key={req.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="patient-id text-sm font-medium text-foreground truncate">{req.patient_name}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {req.origin_sector && <span>De: {req.origin_sector}</span>}
                            {req.destination_sector && <span>→ {req.destination_sector}</span>}
                          </div>
                          {req.reason && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{req.reason}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={
                              req.status === "pendente" ? "secondary" :
                              req.status === "aprovada" || req.status === "concluida" ? "default" :
                              req.status === "negada" || req.status === "cancelada" ? "destructive" :
                              "outline"
                            }
                            className="text-[10px]"
                          >
                            {req.status === "pendente" && <Clock className="h-3 w-3 mr-1" />}
                            {req.status === "aprovada" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {req.status === "negada" && <XCircle className="h-3 w-3 mr-1" />}
                            {req.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{req.priority}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Núcleo Interno de Regulação (NIR)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão centralizada de leitos, regulações e fluxo de pacientes
          </p>
        </div>
        <NirPdfExport metrics={metrics} predictions={predictions} />
      </div>

      {/* Filtros globais */}
      <NirGlobalFilters filters={filters} onChange={setFilters} onRefresh={refetch} isLoading={isLoading} />

      {/* Alertas inteligentes */}
      <NirAlertBar metrics={metrics} onOpenAlert={setActiveAlert} />

      {/* KPIs ricos */}
      <NirKpiStrip metrics={metrics} />

      {/* Ocupação por setor (semáforo) */}
      {metrics.occupancyBySector.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Ocupação por setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {metrics.occupancyBySector.map((s) => {
                const tone = s.rate >= 95 ? "danger" : s.rate >= 80 ? "warning" : "success";
                const colorBar = tone === "danger" ? "bg-red-500" : tone === "warning" ? "bg-amber-500" : "bg-emerald-500";
                const colorText = tone === "danger" ? "text-red-600 dark:text-red-400" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
                return (
                  <div key={s.sector} className="rounded-lg border p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium truncate capitalize">{s.sector}</span>
                      <span className={cn("text-xs font-bold", colorText)}>{s.rate}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", colorBar)} style={{ width: `${s.rate}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{s.occupied}/{s.total} ocupados</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previsão de altas */}
      <NirDischargeForecast hospitalUnitId={currentHospital?.id} />

      {/* Module Grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Módulos de Acesso</h2>
        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-3">
          {NIR_MODULES.map(mod => (
            <Card
              key={mod.key}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md border",
                activeModule === mod.key
                  ? `${mod.borderColor} ${mod.bgColor} ring-1 ring-offset-1`
                  : "hover:border-border/80"
              )}
              onClick={() => setActiveModule(activeModule === mod.key ? null : mod.key)}
            >
              <CardContent className="py-4 px-4 flex flex-col items-center text-center gap-2">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", mod.bgColor)}>
                  <mod.icon className={cn("h-5 w-5", mod.color)} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">{mod.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{mod.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Active Module Content */}
      {activeModule && (
        <Card>
          <CardContent className="pt-6 pb-4">
            {renderModuleContent()}
          </CardContent>
        </Card>
      )}

      {/* Alert detail dialog */}
      <Dialog open={!!activeAlert} onOpenChange={(o) => !o && setActiveAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeAlert === "stuck24h" && <AlertTriangle className="h-5 w-5 text-red-500" />}
              {activeAlert === "saturated" && <Activity className="h-5 w-5 text-amber-500" />}
              {activeAlert === "cleaning" && <Sparkles className="h-5 w-5 text-orange-500" />}
              {activeAlert === "sisreg" && <Globe className="h-5 w-5 text-purple-500" />}
              {alertList?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {!alertList || alertList.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nada a exibir.</p>
            ) : alertList.kind === "sector" ? (
              <ul className="divide-y">
                {(alertList.items as any[]).map((s, i) => (
                  <li key={i} className="py-2 flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{s.sector}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{s.occupied}/{s.total}</span>
                      <Badge variant={s.rate >= 95 ? "destructive" : "outline"} className="text-[10px]">{s.rate}%</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : alertList.kind === "bed" ? (
              <ul className="divide-y">
                {(alertList.items as any[]).map((b) => (
                  <li key={b.id} className="py-2">
                    <p className="text-sm font-semibold">Leito {b.bed_number} — <span className="capitalize">{b.sector}</span></p>
                    <p className="text-xs text-muted-foreground">{b.block_reason || "Aguardando higienização"}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="divide-y">
                {(alertList.items as any[]).map((r) => {
                  const hours = Math.round((Date.now() - new Date(r.created_at).getTime()) / 3_600_000);
                  return (
                    <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="patient-id text-sm font-semibold truncate">{r.patient_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.origin_sector || "—"} → {r.destination_sector || "—"} · {r.priority || "s/ prioridade"}
                        </p>
                      </div>
                      <Badge variant={hours > 48 ? "destructive" : "outline"} className="text-[10px] shrink-0">{hours}h</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
