import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  Building2, ArrowLeftRight, Globe, BedDouble, ClipboardPlus, 
  Repeat, LogOut, Lock, FileText, BarChart3, 
  Clock, CheckCircle2, XCircle, Search, RefreshCw, AlertTriangle, Sparkles, Activity, Move, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useBedCensusActions } from "@/hooks/useBedCensusActions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PlatformHeader } from "@/components/layout/PlatformHeader";
import { useHospital } from "@/contexts/HospitalContext";
import { cn } from "@/lib/utils";
import { useNirMetrics, type NirFilters } from "@/hooks/useNirMetrics";
import { NirGlobalFilters } from "@/components/nir/NirGlobalFilters";
import { NirKpiStrip } from "@/components/nir/NirKpiStrip";
import { NirAlertBar } from "@/components/nir/NirAlertBar";
import { NirAnalyticsPanel } from "@/components/nir/NirAnalyticsPanel";
import { NirDischargeForecast } from "@/components/nir/NirDischargeForecast";
import { NirPdfExport } from "@/components/nir/NirPdfExport";
import { NirNotificationCenter } from "@/components/nir/NirNotificationCenter";
import { useDischargePredictions } from "@/hooks/useDischargePredictions";
import { BedDetailDialog } from "@/components/nir/BedDetailDialog";
import { sectorLabelFromCode, HOSPITAL_SECTOR_GROUPS } from "@/lib/hospitalSectors";
import { SlaBadge } from "@/components/sla/SlaBadge";
import { NirRequestActions } from "@/components/nir/NirRequestActions";

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

const BED_STATUS_LABELS: Record<
  string,
  { label: string; dot: string; icon: string; ring: string; bg: string }
> = {
  vago: {
    label: "Vago",
    dot: "bg-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
    ring: "border-emerald-500/40",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/15",
  },
  ocupado: {
    label: "Ocupado",
    dot: "bg-red-500",
    icon: "text-red-600 dark:text-red-400",
    ring: "border-red-500/40",
    bg: "bg-red-500/10 hover:bg-red-500/15",
  },
  bloqueado: {
    label: "Bloqueado",
    dot: "bg-zinc-700",
    icon: "text-zinc-700 dark:text-zinc-300",
    ring: "border-zinc-500/40",
    bg: "bg-zinc-500/10 hover:bg-zinc-500/15",
  },
  higienizacao: {
    label: "Higienização",
    dot: "bg-sky-500",
    icon: "text-sky-600 dark:text-sky-400",
    ring: "border-sky-500/40",
    bg: "bg-sky-500/10 hover:bg-sky-500/15",
  },
  reservado: {
    label: "Reservado",
    dot: "bg-purple-500",
    icon: "text-purple-600 dark:text-purple-400",
    ring: "border-purple-500/40",
    bg: "bg-purple-500/10 hover:bg-purple-500/15",
  },
  manutencao: {
    label: "Manutenção",
    dot: "bg-orange-500",
    icon: "text-orange-600 dark:text-orange-400",
    ring: "border-orange-500/40",
    bg: "bg-orange-500/10 hover:bg-orange-500/15",
  },
  interditado: {
    label: "Interditado",
    dot: "bg-red-800",
    icon: "text-red-800 dark:text-red-300",
    ring: "border-red-700/40",
    bg: "bg-red-700/10 hover:bg-red-700/15",
  },
  alta_medica_dada: {
    label: "Alta Médica",
    dot: "bg-amber-500",
    icon: "text-amber-600 dark:text-amber-400",
    ring: "border-amber-500/40",
    bg: "bg-amber-500/10 hover:bg-amber-500/15",
  },
};

type AlertKind = "stuck24h" | "saturated" | "cleaning" | "sisreg" | null;

export default function NirDashboardPage() {
  const { currentHospital } = useHospital();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeModule, setActiveModule] = useState<string | null>(searchParams.get("modulo"));

  useEffect(() => {
    const m = searchParams.get("modulo");
    if (m !== activeModule) setActiveModule(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get("modulo");
    if (activeModule && activeModule !== current) {
      const next = new URLSearchParams(searchParams);
      next.set("modulo", activeModule);
      setSearchParams(next, { replace: true });
    } else if (!activeModule && current) {
      const next = new URLSearchParams(searchParams);
      next.delete("modulo");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeAlert, setActiveAlert] = useState<AlertKind>(null);
  const [filters, setFilters] = useState<NirFilters>({ period: "today", sectorScope: "all", priority: "all" });
  const [selectedBed, setSelectedBed] = useState<any | null>(null);
  const [censusGroup, setCensusGroup] = useState<string>("Todos");
  const [reallocMode, setReallocMode] = useState(false);
  const [reallocOrigin, setReallocOrigin] = useState<any | null>(null);
  const [reallocDest, setReallocDest] = useState<any | null>(null);
  const [reallocBusy, setReallocBusy] = useState(false);
  const { transferBed, swapBeds } = useBedCensusActions();

  const { isLoading, refetch, beds, requests, metrics, historical, heatmap, flow } = useNirMetrics(currentHospital?.id, filters);
  const { data: predictions = [] } = useDischargePredictions(currentHospital?.id);

  // Status válidos como destino na realocação
  const VALID_DEST = new Set(["vago", "reservado", "ocupado"]);
  const isValidDest = (s: string) => VALID_DEST.has(s);

  const handleBedClick = (bed: any) => {
    if (!reallocMode) {
      setSelectedBed(bed);
      return;
    }
    if (!reallocOrigin) {
      if (bed.status !== "ocupado") return;
      setReallocOrigin(bed);
      return;
    }
    if (bed.id === reallocOrigin.id) {
      setReallocOrigin(null);
      return;
    }
    if (!isValidDest(bed.status)) return;
    setReallocDest(bed);
  };

  const cancelRealloc = () => {
    setReallocMode(false);
    setReallocOrigin(null);
    setReallocDest(null);
  };

  const confirmRealloc = async () => {
    if (!reallocOrigin || !reallocDest) return;
    setReallocBusy(true);
    const ok = reallocDest.status === "ocupado"
      ? await swapBeds(reallocOrigin.id, reallocDest.id)
      : await transferBed(reallocOrigin.id, reallocDest.id);
    setReallocBusy(false);
    if (ok) {
      setReallocDest(null);
      setReallocOrigin(null);
      setReallocMode(false);
      refetch();
    }
  };

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
      case "censo_leitos": {
        // Agrupa setores conforme HOSPITAL_SECTOR_GROUPS para reduzir o ruído
        // de filtros e dar uma visão hierárquica institucional.
        const SECTOR_GROUPS = [
          { title: "Todos", codes: null as string[] | null },
          ...HOSPITAL_SECTOR_GROUPS.map((g) => ({ title: g.title, codes: g.items.map((i) => i.key) })),
        ];
        const activeGroup = SECTOR_GROUPS.find((g) => g.title === censusGroup) ?? SECTOR_GROUPS[0];
        const visibleBedsBySector = Object.fromEntries(
          Object.entries(bedsBySector).filter(([sector]) =>
            !activeGroup.codes || activeGroup.codes.includes(sector),
          ),
        );

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-semibold text-foreground">Censo de Leitos — Tempo Real</h3>
              <Button variant="outline" size="sm" onClick={refetch}>
                <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
              </Button>
            </div>

            {/* Tabs de grupo de setores (substitui filtro plano) */}
            <div className="flex flex-wrap gap-1.5">
              {SECTOR_GROUPS.map((g) => (
                <Button
                  key={g.title}
                  variant={censusGroup === g.title ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCensusGroup(g.title)}
                >
                  {g.title}
                </Button>
              ))}
            </div>

            {/* Legenda de status */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(BED_STATUS_LABELS).map(([key, info]) => {
                const count = beds.filter((b: any) => b.status === key).length;
                return (
                  <Badge key={key} variant="outline" className="gap-1.5 text-xs">
                    <span className={cn("h-2.5 w-2.5 rounded-full", info.dot)} />
                    {info.label}: {count}
                  </Badge>
                );
              })}
            </div>

            {Object.keys(visibleBedsBySector).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BedDouble className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum leito neste grupo</p>
                  <p className="text-sm mt-1">Selecione outro grupo de setores acima.</p>
                </CardContent>
              </Card>
            ) : (
              Object.entries(visibleBedsBySector).map(([sector, sectorBeds]) => {
                const occupiedCount = sectorBeds.filter((b: any) => b.status === "ocupado").length;
                const sectorLabel = sectorLabelFromCode(sector);
                return (
                  <Card key={sector}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        {sectorLabel}
                        <Badge variant="secondary" className="text-[10px]">{occupiedCount}/{sectorBeds.length} ocupados</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-2">
                        {sectorBeds.map((bed: any) => {
                          const info = BED_STATUS_LABELS[bed.status] || {
                            label: bed.status,
                            dot: "bg-muted",
                            icon: "text-muted-foreground",
                            ring: "border-border",
                            bg: "bg-muted/30",
                          };
                          return (
                            <button
                              key={bed.id}
                              type="button"
                              onClick={() => setSelectedBed(bed)}
                              className={cn(
                                "relative rounded-lg border-2 p-2 text-center cursor-pointer transition-all hover:shadow-md hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary/40",
                                info.ring,
                                info.bg,
                              )}
                              title={`${bed.bed_number} — ${info.label}${bed.patient_name ? ` — ${bed.patient_name}` : ""}`}
                            >
                              <span
                                className={cn(
                                  "absolute top-1 right-1 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                                  info.dot,
                                )}
                              />
                              <BedDouble className={cn("h-6 w-6 mx-auto mb-1", info.icon)} />
                              <span className="text-xs font-bold block leading-none">{bed.bed_number}</span>
                              <span className={cn("text-[9px] block mt-0.5 font-medium", info.icon)}>
                                {info.label}
                              </span>
                              {bed.patient_name && (
                                <p className="patient-id text-[9px] text-muted-foreground truncate mt-0.5">
                                  {bed.patient_name}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        );
      }


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
            <div className="flex items-center justify-between gap-3 flex-wrap">
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

            <NirRequestActions
              requests={moduleRequests}
              typeFilter={typeFilter}
              defaultRequestType={typeFilter}
            />
          </div>
        );
      }
    }
  };

  return (
    <>
      <PlatformHeader
        variant="institutional"
        eyebrow="Regulação · NIR"
        title="Núcleo Interno de Regulação"
        icon={Building2}
        subtitle={
          <>
            <Building2 className="h-3 w-3" />
            <span className="truncate">{currentHospital?.name || "Unidade"}</span>
            <span className="opacity-50">·</span>
            <span className="truncate">Gestão de leitos e fluxo de pacientes</span>
          </>
        }
        actions={
          <>
            <NirNotificationCenter metrics={metrics} />
            <NirPdfExport metrics={metrics} predictions={predictions} />
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">

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
                      <span className="text-xs font-medium truncate">{sectorLabelFromCode(s.sector)}</span>
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
                {(alertList.items as any[]).map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="patient-id text-sm font-semibold truncate">{r.patient_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.origin_sector || "—"} → {r.destination_sector || "—"} · {r.priority || "s/ prioridade"}
                      </p>
                    </div>
                    <SlaBadge startAt={r.created_at} thresholds={[60, 120, 180]} compact />
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Detalhes do leito (linha do tempo + tempos do ciclo) */}
      <BedDetailDialog
        bed={selectedBed}
        open={!!selectedBed}
        onOpenChange={(o) => !o && setSelectedBed(null)}
      />
      </div>
    </>
  );
}
