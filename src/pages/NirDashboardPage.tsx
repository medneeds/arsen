import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  Building2, ArrowLeftRight, Globe, BedDouble, ClipboardPlus, 
  Repeat, LogOut, Lock, FileText, BarChart3, Search, RefreshCw, AlertTriangle, Sparkles, Activity, Move, X, LayoutGrid
} from "lucide-react";
import BedMapPage from "@/pages/Index";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useBedCensusActions } from "@/hooks/useBedCensusActions";
import { ScrollArea } from "@/components/ui/scroll-area";
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

/**
 * Os tipos de solicitação — o que antes eram sete cards separados.
 *
 * "Solicitação de Vaga" vem primeiro e é o padrão: o gestor a marcou como
 * importantíssima, então quem abre o card cai nela.
 */
const REQUEST_TYPES = [
  { key: "solicitacao_vaga", label: "Vaga" },
  { key: "interna", label: "Regulação interna" },
  { key: "externa_sisreg", label: "Regulação externa" },
  { key: "transferencia_interunidade", label: "Interunidade" },
  { key: "alta_administrativa", label: "Alta administrativa" },
  { key: "bloqueio_interdicao", label: "Bloqueio" },
  { key: "parecer_regulatorio", label: "Parecer" },
  { key: "todos", label: "Todos" },
] as const;

const NIR_MODULES = [
  /*
    CINCO cards, no lugar de dez.

    SETE deles — Regulação Interna, Regulação Externa, Solicitação de Vaga,
    Transferência Interunidade, Alta Administrativa, Bloqueio/Interdição e
    Parecer Regulatório — caíam TODOS no mesmo `default` do switch:
    renderizavam a MESMA lista, mudando apenas o `request_type`. Não eram sete
    módulos; eram sete filtros da mesma lista, vestidos de módulo.

    Agora são o que sempre foram por baixo: um card "Solicitações" com os tipos
    como filtro interno. Uma porta com sete gavetas, em vez de sete portas para
    a mesma sala.

    As cinco naturezas: VER (mapa, censo) · FAZER (solicitações) ·
    ANALISAR (relatórios) · CONFIGURAR (a construir).
  */
  { key: "mapa_leitos", label: "Mapa de Leitos", subtitle: "Visão operacional dos leitos", icon: LayoutGrid, color: "text-sky-500", bgColor: "bg-sky-500/10", borderColor: "border-sky-500/20" },
  { key: "censo_leitos", label: "Censo de Leitos", subtitle: "Panorama, ocupação e bloqueios", icon: BedDouble, color: "text-emerald-500", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" },
  { key: "solicitacoes", label: "Solicitações", subtitle: "Fila de trabalho do NIR", icon: ClipboardPlus, color: "text-amber-500", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" },
  { key: "relatorios_nir", label: "Relatórios NIR", subtitle: "Indicadores, séries e previsões", icon: BarChart3, color: "text-violet-500", bgColor: "bg-violet-500/10", borderColor: "border-violet-500/20" },
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
  const [requestType, setRequestType] = useState<string>("solicitacao_vaga");

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
      case "mapa_leitos":
        /*
          O MESMO mapa da rota /mapa, com `embedded`: sem MainLayout e sem
          BreadcrumbBar proprios, porque esta pagina ja fornece a moldura.
          Um caminho de codigo so — o que for corrigido no mapa vale aqui.
        */
        return <BedMapPage embedded />;
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
            {/*
              Ocupação por setor (semáforo) — MUDOU DE LUGAR.

              Estava na camada superior da página, competindo com os cards e
              obrigando a rolar antes de chegar neles. É detalhamento, não
              panorama: responde "onde tem vaga agora", que é exatamente a
              pergunta do Censo.

              A versão ANALÍTICA da mesma informação — taxa média, tendência,
              comparação entre períodos — fica em Relatórios. Mesmo dado, duas
              perguntas: "onde alocar agora" e "como estamos evoluindo".
            */}
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

            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-semibold text-foreground">Censo de Leitos — Tempo Real</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant={reallocMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => (reallocMode ? cancelRealloc() : setReallocMode(true))}
                >
                  {reallocMode ? <X className="h-4 w-4 mr-1" /> : <Move className="h-4 w-4 mr-1" />}
                  {reallocMode ? "Cancelar realocação" : "Realocar paciente"}
                </Button>
                <Button variant="outline" size="sm" onClick={refetch}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
                </Button>
              </div>
            </div>

            {reallocMode && (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground flex items-center gap-2">
                <Move className="h-3.5 w-3.5 text-primary" />
                {!reallocOrigin
                  ? "Passo 1: clique no leito do paciente que será movido (apenas leitos ocupados)."
                  : `Passo 2: clique no leito de destino. Origem: ${reallocOrigin.bed_number} · ${reallocOrigin.patient_name}. Destino ocupado faz permuta automática.`}
              </div>
            )}

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
                          const isOrigin = reallocOrigin?.id === bed.id;
                          const reallocDisabled =
                            reallocMode &&
                            (!reallocOrigin
                              ? bed.status !== "ocupado"
                              : !isOrigin && !isValidDest(bed.status));
                          const isSwapTarget =
                            reallocMode && !!reallocOrigin && !isOrigin && bed.status === "ocupado";
                          return (
                            <button
                              key={bed.id}
                              type="button"
                              onClick={() => handleBedClick(bed)}
                              disabled={reallocDisabled}
                              className={cn(
                                "relative rounded-lg border-2 p-2 text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary/40",
                                info.ring,
                                info.bg,
                                reallocDisabled
                                  ? "opacity-40 cursor-not-allowed"
                                  : "cursor-pointer hover:shadow-md hover:scale-[1.03]",
                                isOrigin && "ring-2 ring-primary border-primary scale-[1.05] shadow-md",
                                isSwapTarget && "ring-2 ring-amber-500/70 border-amber-500/70",
                                reallocMode && !reallocOrigin && bed.status === "ocupado" && "ring-1 ring-primary/40",
                                reallocMode && !!reallocOrigin && !isOrigin && bed.status === "vago" && "ring-1 ring-emerald-500/60",
                              )}
                              title={
                                reallocDisabled
                                  ? `${bed.bed_number} — destino inválido (${info.label})`
                                  : `${bed.bed_number} — ${info.label}${bed.patient_name ? ` — ${bed.patient_name}` : ""}`
                              }
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
            {/*
              Previsão de altas — MUDOU DE LUGAR.

              Estava na camada superior, entre os indicadores e os cards. É
              DETALHAMENTO analítico, não panorama de situação: quem entra no
              NIR para trabalhar não precisa dela antes de escolher o que fazer,
              e ela empurrava os cards (e o Mapa de Leitos) para fora da tela.
            */}
            <NirDischargeForecast hospitalUnitId={currentHospital?.id} />
          </div>
        );

      default: {
        /*
          Os sete tipos que antes eram CARDS agora sao ABAS deste card unico.
          "Solicitação de Vaga" entra PRE-SELECIONADA: o gestor a marcou como
          importantissima, entao quem abre cai no que mais usa e os demais
          ficam a um clique.
        */
        const moduleRequests = requestType === "todos"
          ? filteredRequests
          : filteredRequests.filter((r: any) => r.request_type === requestType);
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-lg font-semibold text-foreground">Solicitações</h3>
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

            {/* Tipos como filtro interno — o que antes eram sete cards */}
            <div className="flex flex-wrap gap-1.5">
              {REQUEST_TYPES.map((t) => {
                // Sem `any`: só o campo que interessa, tipado no ponto de uso.
                const qtd = t.key === "todos"
                  ? filteredRequests.length
                  : filteredRequests.filter((r: { request_type?: string }) => r.request_type === t.key).length;
                return (
                  <button
                    key={t.key}
                    onClick={() => setRequestType(t.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
                      requestType === t.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border text-muted-foreground",
                    )}
                  >
                    {t.label}
                    {qtd > 0 && <span className="ml-1.5 tabular-nums opacity-80">{qtd}</span>}
                  </button>
                );
              })}
            </div>

            <NirRequestActions
              requests={moduleRequests}
              typeFilter={requestType === "todos" ? undefined : requestType}
              defaultRequestType={requestType === "todos" ? undefined : requestType}
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
        /*
          Seletor hierarquico de setores no cabecalho institucional.

          `navigateOnSectorSelect={false}`: no painel clinico, escolher um setor
          significa IR para outro lugar; aqui significa filtrar o que ja esta na
          tela. Sair da pagina do NIR ao trocar de setor seria o oposto do
          esperado por quem regula leitos.
        */
        showSectorSelector
        navigateOnSectorSelect={false}
        actions={
          <>
            <NirNotificationCenter metrics={metrics} />
            <NirPdfExport metrics={metrics} predictions={predictions} />
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">

      {/*
        ORDEM DA PÁGINA — cards PRIMEIRO, dashboard depois.

        Antes a grade de módulos vinha depois de filtros, alertas, KPIs,
        ocupação por setor e previsão de altas: cinco blocos antes dos cards.
        O Mapa de Leitos, sendo o décimo card, ficava a meia tela de rolagem —
        o gestor relatou "não estou visualizando o mapa dentro do NIR", e era
        isso.

        O atendimento inicial do painel clínico, que serve de referência aqui,
        é uma TELA DE ESCOLHA: identidade no topo, cards, e o módulo abre. Os
        indicadores continuam na página, abaixo — quem quer o panorama rola;
        quem entrou para fazer algo escolhe de cara.
      */}
      {/* Module Grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Módulos de Acesso</h2>
        {/*
          Mesma linguagem visual do atendimento inicial do painel clínico:
          card quadrado (aspect-square), faixa fina no topo, ícone em caixa
          arredondada, rótulo em versalete e legenda abaixo.

          A grade era `grid-cols-3` FIXA nos três breakpoints — dez cards em
          três colunas viram quatro fileiras, e no celular cada card ficava com
          um terço da largura. Agora acompanha a do Hub: 2 no mobile, 3 no sm,
          5 a partir do md — dez cards em duas fileiras cheias.

          A COR SEGUE POR CATEGORIA, como o gestor pediu (escolha conservadora).
          A faixa do topo usa a cor do módulo; o card em si permanece neutro,
          como no Hub. Quando a cor passar a significar ESTADO, é aqui que a
          regra entra, sem mexer no resto.
        */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {NIR_MODULES.map(mod => {
            const ativo = activeModule === mod.key;
            return (
              <button
                key={mod.key}
                onClick={() => setActiveModule(ativo ? null : mod.key)}
                aria-pressed={ativo}
                title={mod.subtitle}
                className="relative group text-left"
              >
                <div className={cn(
                  "relative flex flex-col items-center justify-center aspect-square rounded-lg overflow-hidden",
                  "bg-card border transition-all cursor-pointer",
                  ativo
                    ? `${mod.borderColor} ${mod.bgColor} shadow-md`
                    : "border-border hover:scale-[1.02] hover:shadow-md",
                )}>
                  <span className={cn("absolute top-0 left-0 right-0 h-1", mod.bgColor.replace("/10", "/70"))} />
                  <div className={cn(
                    "p-3 rounded-xl mb-3 transition-colors",
                    ativo ? mod.bgColor : "bg-muted group-hover:bg-primary/10",
                  )}>
                    <mod.icon className={cn("w-7 h-7", ativo ? mod.color : "text-muted-foreground group-hover:text-primary")} strokeWidth={1.5} />
                  </div>
                  <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-center px-1.5 leading-tight text-foreground">
                    {mod.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground text-center px-2 mt-1 leading-tight line-clamp-2">
                    {mod.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Module Content */}
      {activeModule && (
        <Card>
          {/*
            O Mapa de Leitos traz a propria estrutura de secoes e ja tem
            respiro interno; o padding do Card somaria margem sobre margem e
            estreitaria as linhas de leito sem necessidade. Os demais modulos
            seguem com o padding de sempre.
          */}
          <CardContent className={activeModule === "mapa_leitos" ? "p-0 overflow-x-auto" : "pt-6 pb-4"}>
            {renderModuleContent()}
          </CardContent>
        </Card>
      )}


      {/* ── Panorama: indicadores abaixo dos módulos ────────────────────── */}
      {/* Filtros globais */}
      <NirGlobalFilters filters={filters} onChange={setFilters} onRefresh={refetch} isLoading={isLoading} />

      {/* Alertas inteligentes */}
      <NirAlertBar metrics={metrics} onOpenAlert={setActiveAlert} />

      {/* KPIs ricos */}
      <NirKpiStrip metrics={metrics} />


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
                    <span className="text-sm font-medium">{sectorLabelFromCode(s.sector)}</span>
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
                    <p className="text-sm font-semibold">Leito {b.bed_number} — <span>{sectorLabelFromCode(b.sector)}</span></p>
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

      {/* Confirmação de realocação / permuta */}
      <Dialog open={!!reallocDest} onOpenChange={(o) => !o && setReallocDest(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reallocDest?.status === "ocupado" ? "Confirmar permuta de pacientes" : "Confirmar realocação"}
            </DialogTitle>
            <DialogDescription>
              {reallocDest?.status === "ocupado"
                ? "Os dois pacientes trocarão de leito. Nenhum leito vai para higienização."
                : "O paciente será movido. O leito de origem irá para higienização."}
            </DialogDescription>
          </DialogHeader>
          {reallocOrigin && reallocDest && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3 bg-muted/30">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Origem</p>
                <p className="font-semibold">{reallocOrigin.patient_name}</p>
                <p className="text-xs text-muted-foreground">
                  Leito {reallocOrigin.bed_number} · {sectorLabelFromCode(reallocOrigin.sector)}
                </p>
              </div>
              <div className="flex justify-center text-muted-foreground">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
              <div className="rounded-md border p-3 bg-muted/30">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Destino</p>
                <p className="font-semibold">
                  {reallocDest.patient_name ?? <span className="italic text-muted-foreground">Leito vago</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Leito {reallocDest.bed_number} · {sectorLabelFromCode(reallocDest.sector)} · {BED_STATUS_LABELS[reallocDest.status]?.label ?? reallocDest.status}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReallocDest(null)} disabled={reallocBusy}>
              Cancelar
            </Button>
            <Button onClick={confirmRealloc} disabled={reallocBusy}>
              {reallocBusy ? "Processando..." : reallocDest?.status === "ocupado" ? "Confirmar permuta" : "Confirmar realocação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
