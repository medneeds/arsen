import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import { 
  CalendarIcon, Download, Users, FileText, UserCheck, 
  UserX, ArrowRightLeft, TrendingUp, Activity, BarChart3, Filter, X, Loader2,
  AlertTriangle, Clock, Bell, ClipboardCheck, UserPlus, LogOut, Pill
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { format, subDays, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useSectorNavigation } from "@/hooks/useSectorNavigation";
import { PrintableDashboard } from "@/components/PrintableDashboard";
import { SECTOR_DISPLAY_LABELS, SECTOR_BED_CONFIG } from "@/utils/bedNaming";

interface PriorityAlert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  message: string;
  patientName?: string;
  bedNumber?: string;
  timestamp: string;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

const COLORS = ['#ef4444', '#eab308', '#3b82f6', '#6b7280', '#8b5cf6', '#ec4899'];

// Sector color mapping based on hospital identity
const SECTOR_COLORS: Record<string, string> = {
  'UTI 1': '#ef4444',
  'UTI 2': '#eab308',
  'UCI 1': '#3b82f6',
  'UCI 2': '#6b7280',
  'UCC': '#8b5cf6',
};

const DashboardPage = () => {
  const { currentDepartment } = useDepartment();
  // Setores reais do banco (alas→setores). O rótulo do setor ativo passa a vir de
  // setor.nome, casado por setor.tipo (o código guardado em localStorage), em vez
  // da taxonomia estática (SECTOR_DISPLAY_LABELS). Degrada para o fallback estático
  // enquanto carrega ou se nenhum setor tiver o `tipo` ativo.
  const { sectors: dbSectors } = useSectorNavigation();
  const [isLoading, setIsLoading] = useState(false);

  // Active sector from localStorage (synced with login/header selector)
  const [activeSector, setActiveSector] = useState<string>(() => {
    return localStorage.getItem("selected_sector") || "";
  });

  // Listen for sector changes from other pages
  useEffect(() => {
    // Limpeza idempotente (debounce 1h) de sinalizações órfãs em setores bloqueados.
    import("@/lib/lockedSectorCleanup").then((m) => m.maybeRunLockedSectorCleanup());
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "selected_sector" && e.newValue) {
        setActiveSector(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);

    // Also poll localStorage (same-tab changes don't fire StorageEvent)
    const interval = setInterval(() => {
      const stored = localStorage.getItem("selected_sector") || "";
      setActiveSector(prev => prev !== stored ? stored : prev);
    }, 1000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  const activeSectorLabel =
    dbSectors.find((s) => s.tipo === activeSector)?.nome ||
    SECTOR_DISPLAY_LABELS[activeSector] ||
    activeSector;
  
  // Date range filters
  const [tempDateRange, setTempDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [comparisonPeriod, setComparisonPeriod] = useState<string>("previous");

  const { currentHospital } = useHospital();

  // KPIs State
  const [kpis, setKpis] = useState({
    internmentRequests: 0,
    activePatients: 0,
    discharges: 0,
    deaths: 0,
    transfers: 0,
    newAdmissions24h: 0,
    pendingPrescriptions: 0,
    plannedDischarges: 0,
    occupancyRate: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    comparison: {
      internmentRequests: 0,
      activePatients: 0,
      discharges: 0,
      deaths: 0,
      transfers: 0,
      newAdmissions24h: 0,
      pendingPrescriptions: 0,
      plannedDischarges: 0,
    }
  });

  // Priority Alerts & Activities
  const [priorityAlerts, setPriorityAlerts] = useState<PriorityAlert[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  // Charts Data State
  const [movementsOverTime, setMovementsOverTime] = useState<any[]>([]);
  const [sectorDistribution, setSectorDistribution] = useState<any[]>([]);
  const [movementsByType, setMovementsByType] = useState<any[]>([]);
  const [bedOccupancy, setBedOccupancy] = useState<any[]>([]);
  const [requestsByDestination, setRequestsByDestination] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();

    let debounceId: number | null = null;
    const debouncedRefetch = () => {
      if (debounceId) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => fetchDashboardData(), 800);
    };

    // MIGRAÇÃO: realtime migrado de patient_movements/internment_requests/patients
    // para as tabelas novas internacoes e solicitacoes_leito.
    const channel = supabase
      .channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internacoes' }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_leito' }, debouncedRefetch)
      .subscribe();

    return () => {
      if (debounceId) window.clearTimeout(debounceId);
      supabase.removeChannel(channel);
    };
  }, [dateRange, activeSector, comparisonPeriod]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchKPIs(),
        fetchMovementsOverTime(),
        fetchSectorDistribution(),
        fetchMovementsByType(),
        fetchBedOccupancy(),
        fetchRequestsByDestination(),
        fetchPriorityAlerts(),
        fetchRecentActivities()
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // MIGRAÇÃO: internacoes vincula-se ao hospital por leitos → setores → alas.hospital_id.
  // setores.tipo guarda o código de setor (red/yellow/blue/...).
  const INT_JOIN = `id, data_entrada, data_alta, leito:leitos!inner ( setor:setores!inner ( tipo, ala:alas!inner ( hospital_id ) ) )`;

  const fetchKPIs = async () => {
    if (!currentHospital) return;
    const hospitalId = currentHospital.id;
    const now = new Date();
    const twentyFourHoursAgo = subHours(now, 24);

    // Sector-specific bed config
    const sectorConfig = SECTOR_BED_CONFIG[activeSector];
    const totalSectorBeds = sectorConfig?.maxRegularBeds || 0;

    // Aplica o filtro hospital + setor sobre os embeds (cast por causa dos caminhos aninhados).
    const scoped = (base: any) =>
      base.eq("leito.setor.ala.hospital_id", hospitalId).eq("leito.setor.tipo", activeSector);

    const [
      { data: activeForOcc },
      { count: internmentRequests },
      { count: newAdmissions24h },
    ] = await Promise.all([
      scoped(supabase.from("internacoes").select(INT_JOIN).is("data_alta", null)),
      scoped(
        supabase
          .from("internacoes")
          .select(INT_JOIN, { count: "exact", head: true })
          .gte("data_entrada", dateRange.from.toISOString())
          .lte("data_entrada", dateRange.to.toISOString()),
      ),
      scoped(
        supabase
          .from("internacoes")
          .select(INT_JOIN, { count: "exact", head: true })
          .is("data_alta", null)
          .gte("data_entrada", twentyFourHoursAgo.toISOString()),
      ),
    ]);

    // Ocupação = internações ativas no setor. Total = capacidade FIXA (SECTOR_BED_CONFIG).
    const occupiedCount = ((activeForOcc as any[]) || []).length;
    const occRate = totalSectorBeds > 0 ? Math.round((occupiedCount / totalSectorBeds) * 100) : 0;

    setKpis({
      // "Pedidos de internação" no período ≈ internações criadas no período (data_entrada).
      internmentRequests: internmentRequests || 0,
      activePatients: occupiedCount,
      // MIGRAÇÃO: patient_movements não tem equivalente fiel (transferencias só modela
      // leito→leito; alta/óbito não são distinguíveis). Altas/óbitos/transferências → 0.
      discharges: 0,
      deaths: 0,
      transfers: 0,
      newAdmissions24h: newAdmissions24h || 0,
      // MIGRAÇÃO: prescricoes não tem setor/departamento nem status "draft" mapeável → 0.
      pendingPrescriptions: 0,
      // MIGRAÇÃO: internment_status do paciente foi degradado → sem "altas previstas".
      plannedDischarges: 0,
      occupancyRate: occRate,
      totalBeds: totalSectorBeds,
      occupiedBeds: occupiedCount,
      // MIGRAÇÃO: comparação com período anterior dependia de patient_movements → 0.
      comparison: {
        internmentRequests: 0,
        activePatients: 0,
        discharges: 0,
        deaths: 0,
        transfers: 0,
        newAdmissions24h: 0,
        pendingPrescriptions: 0,
        plannedDischarges: 0,
      }
    });
  };

  const fetchPriorityAlerts = async () => {
    if (!currentHospital) return;
    const hospitalId = currentHospital.id;
    const alerts: PriorityAlert[] = [];

    // MIGRAÇÃO: alertas "crítico" (clinical_status degradado) e "prescrição pendente há +2h"
    // (prescriptions/prescricoes sem status/hora mapeável) foram removidos.
    // Resta: solicitacoes_leito pendentes para o setor (bed_allocation_requests → solicitacoes_leito).
    const { data: pendingAllocations } = await (supabase
      .from('solicitacoes_leito')
      .select('id, data_hora, status, setor_solicitado:setores!inner ( tipo, ala:alas!inner ( hospital_id ) )') as any)
      .eq('status', 'pendente')
      .eq('setor_solicitado.ala.hospital_id', hospitalId)
      .eq('setor_solicitado.tipo', activeSector)
      .order('data_hora', { ascending: false })
      .limit(5);

    (pendingAllocations as any[] | null)?.forEach(a => {
      alerts.push({
        id: `info-alloc-${a.id}`,
        level: 'info',
        message: `Solicitação de leito pendente para ${activeSectorLabel}`,
        timestamp: a.data_hora,
      });
    });

    const levelOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
    setPriorityAlerts(alerts);
  };

  const fetchRecentActivities = async () => {
    if (!currentHospital) return;
    const hospitalId = currentHospital.id;
    const activities: RecentActivity[] = [];

    const fortyEightHoursAgo = subHours(new Date(), 48);

    // MIGRAÇÃO: atividades de movimentação (patient_movements) e de prescrição
    // (prescriptions sem patient_name) foram removidas. Resta: novas admissões
    // (internacoes criadas nas últimas 48h), com nome via pacientes.
    const { data: newAdmissions } = await (supabase
      .from('internacoes')
      .select(`id, data_entrada, paciente:pacientes ( nome_completo, nome_social ), leito:leitos!inner ( setor:setores!inner ( tipo, ala:alas!inner ( hospital_id ) ) )`) as any)
      .eq('leito.setor.ala.hospital_id', hospitalId)
      .eq('leito.setor.tipo', activeSector)
      .gte('data_entrada', fortyEightHoursAgo.toISOString())
      .order('data_entrada', { ascending: false })
      .limit(10);

    (newAdmissions as any[] | null)?.forEach(i => {
      const nome = i.paciente?.nome_social || i.paciente?.nome_completo || '—';
      activities.push({
        id: `adm-${i.id}`,
        type: 'admission',
        description: `Admissão: ${nome}`,
        timestamp: i.data_entrada,
      });
    });

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setRecentActivities(activities.slice(0, 10));
  };

  // MIGRAÇÃO: patient_movements não tem equivalente fiel → séries de movimentação vazias.
  const fetchMovementsOverTime = async () => {
    setMovementsOverTime([]);
  };

  const fetchSectorDistribution = async () => {
    if (!currentHospital) return;
    const hospitalId = currentHospital.id;

    // Ocupados vs vagos no setor ativo — internações ativas + capacidade fixa.
    const { data } = await (supabase
      .from('internacoes')
      .select(INT_JOIN) as any)
      .is('data_alta', null)
      .eq('leito.setor.ala.hospital_id', hospitalId)
      .eq('leito.setor.tipo', activeSector);

    const occupied = ((data as any[]) || []).length;
    const sectorConfig = SECTOR_BED_CONFIG[activeSector];
    const total = sectorConfig?.maxRegularBeds || occupied;
    const vacant = total - occupied;

    setSectorDistribution([
      { name: 'Ocupados', value: occupied },
      { name: 'Vagos', value: Math.max(0, vacant) },
    ]);
  };

  // MIGRAÇÃO: patient_movements sem equivalente → distribuição por tipo vazia.
  const fetchMovementsByType = async () => {
    setMovementsByType([]);
  };

  // MIGRAÇÃO: série temporal de ocupação dependia de patient_movements/patients → vazia.
  const fetchBedOccupancy = async () => {
    setBedOccupancy([]);
  };

  // MIGRAÇÃO: transferências por destino vinham de patient_movements → vazio.
  const fetchRequestsByDestination = async () => {
    setRequestsByDestination([]);
  };

  const handleExportPDF = () => {
    toast({
      title: "GERANDO PDF",
      description: "Preparando documento para impressão...",
    });
    
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleExportExcel = () => {
    toast({
      title: "EXPORTAÇÃO EM DESENVOLVIMENTO",
      description: "Funcionalidade de exportação Excel será implementada em breve",
    });
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const handleApplyFilters = () => {
    setDateRange(tempDateRange);
    toast({
      title: "FILTROS APLICADOS COM SUCESSO",
      description: `Dashboard atualizado — ${activeSectorLabel}`,
    });
  };

  const handleClearFilters = () => {
    const defaultDateRange = {
      from: subDays(new Date(), 30),
      to: new Date()
    };
    setTempDateRange(defaultDateRange);
    setDateRange(defaultDateRange);
    toast({
      title: "FILTROS LIMPOS",
      description: "Filtros restaurados aos valores padrão",
    });
  };

  const KPICard = ({ 
    title, 
    value, 
    icon: Icon, 
    comparison 
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    comparison: number;
  }) => {
    const change = calculatePercentageChange(value, comparison);
    const isPositive = change >= 0;

    return (
      <Card className="relative overflow-hidden border-border/50 shadow-md backdrop-blur-sm bg-gradient-card hover:shadow-md transition-all duration-500 hover:scale-105 group">
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-foreground/70 group-hover:text-foreground transition-colors">
            {title}
          </CardTitle>
          <div className="rounded-lg bg-primary/10 p-2 group-hover:bg-primary/20 transition-colors duration-300">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-4xl font-semibold bg-gradient-primary bg-clip-text text-transparent mb-2">
            {value}
          </div>
          <div className={cn(
            "text-xs flex items-center gap-2 font-medium px-2 py-1 rounded-full w-fit",
            isPositive 
              ? "bg-released/10 text-released-on-soft" 
              : "bg-critical/10 text-critical-on-soft"
          )}>
            <TrendingUp className={cn("h-3.5 w-3.5", !isPositive && "rotate-180")} />
            <span>{Math.abs(change)}%</span>
            <span className="text-muted-foreground">vs anterior</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background animate-fade-in relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card shadow-md animate-scale-in">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-foreground">ATUALIZANDO DASHBOARD</p>
              <p className="text-sm text-muted-foreground">Carregando dados — {activeSectorLabel}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="container mx-auto p-6 space-y-8 dashboard-screen-content">
        {/* Header com gradiente */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-primary p-8 shadow-md animate-scale-in">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,white)]" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-white hover:bg-white/20 transition-colors" />
                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight uppercase text-white">
                  Visão Geral — {activeSectorLabel}
                </h1>
              </div>
              <p className="text-white/80 text-sm ml-[100px]">
                Dashboard segmentado por setor · Ocupação {kpis.occupiedBeds}/{kpis.totalBeds} leitos ({kpis.occupancyRate}%)
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleExportPDF} 
                variant="secondary" 
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-105"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Filters com estilo aprimorado */}
        <Card className="border-border/50 shadow-md backdrop-blur-sm bg-card/95 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium uppercase tracking-wide text-foreground/80 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    Setor Ativo
                  </label>
                  <div className="h-10 flex items-center px-3 rounded-md border border-border/50 bg-muted/30 text-sm font-medium text-foreground">
                    {activeSectorLabel}
                  </div>
                  <p className="text-xs text-muted-foreground">Altere o setor no seletor do cabeçalho</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium uppercase tracking-wide text-foreground/80 flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                    Data Inicial
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left font-normal border-border/50 hover:border-primary/50 transition-all duration-300"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {format(tempDateRange.from, "PPP", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={tempDateRange.from}
                        onSelect={(date) => date && setTempDateRange({ ...tempDateRange, from: date })}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium uppercase tracking-wide text-foreground/80 flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                    Data Final
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left font-normal border-border/50 hover:border-primary/50 transition-all duration-300"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {format(tempDateRange.to, "PPP", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={tempDateRange.to}
                        onSelect={(date) => date && setTempDateRange({ ...tempDateRange, to: date })}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Filter Action Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="uppercase tracking-wider gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all duration-300"
                >
                  <X className="h-4 w-4" />
                  Limpar Filtro
                </Button>
                <Button
                  onClick={handleApplyFilters}
                  className="uppercase tracking-wider gap-2 bg-gradient-primary hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-md"
                >
                  <Filter className="h-4 w-4" />
                  Aplicar Filtro
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs - Row 1: Existing */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <KPICard title="Pacientes Ativos" value={kpis.activePatients} icon={Users} comparison={kpis.comparison.activePatients} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
            <KPICard title="Novas Admissões (24h)" value={kpis.newAdmissions24h} icon={UserPlus} comparison={kpis.comparison.newAdmissions24h} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <KPICard title="Prescrições Pendentes" value={kpis.pendingPrescriptions} icon={Pill} comparison={kpis.comparison.pendingPrescriptions} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.35s' }}>
            <KPICard title="Altas Previstas" value={kpis.plannedDischarges} icon={LogOut} comparison={kpis.comparison.plannedDischarges} />
          </div>
        </div>

        {/* KPIs - Row 2: Movements */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <KPICard title="Pedidos de Internação" value={kpis.internmentRequests} icon={FileText} comparison={kpis.comparison.internmentRequests} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.45s' }}>
            <KPICard title="Altas" value={kpis.discharges} icon={UserCheck} comparison={kpis.comparison.discharges} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <KPICard title="Óbitos" value={kpis.deaths} icon={UserX} comparison={kpis.comparison.deaths} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.55s' }}>
            <KPICard title="Transferências" value={kpis.transfers} icon={ArrowRightLeft} comparison={kpis.comparison.transfers} />
          </div>
        </div>

        {/* Priority Alerts + Recent Activities */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Priority Alerts Panel */}
          <Card className="border-border/50 shadow-md backdrop-blur-sm bg-gradient-card animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-destructive/10 p-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle className="uppercase tracking-wider text-lg font-semibold">Alertas Prioritários</CardTitle>
                  <CardDescription className="text-sm">Situações que requerem atenção</CardDescription>
                </div>
                {priorityAlerts.length > 0 && (
                  <Badge variant="destructive" className="ml-auto">{priorityAlerts.length}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                {priorityAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                    <ClipboardCheck className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm font-medium">Nenhum alerta no momento</p>
                    <p className="text-xs">Tudo sob controle </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {priorityAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                          alert.level === 'critical' && "bg-destructive/5 border-destructive/20",
                          alert.level === 'warning' && "bg-warning/5 border-warning/20",
                          alert.level === 'info' && "bg-primary/5 border-primary/20",
                        )}
                      >
                        <div className={cn(
                          "mt-1 rounded-full p-1",
                          alert.level === 'critical' && "bg-destructive/10",
                          alert.level === 'warning' && "bg-warning/10",
                          alert.level === 'info' && "bg-primary/10",
                        )}>
                          {alert.level === 'critical' && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                          {alert.level === 'warning' && <Clock className="h-3.5 w-3.5 text-warning" />}
                          {alert.level === 'info' && <Bell className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {alert.patientName && <span className="font-medium">{alert.patientName}</span>}
                            {alert.bedNumber && <span className="text-muted-foreground ml-1">({alert.bedNumber})</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{alert.message}</p>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-xs shrink-0",
                          alert.level === 'critical' && "border-destructive/30 text-destructive",
                          alert.level === 'warning' && "border-warning/30 text-warning-on-soft",
                          alert.level === 'info' && "border-primary/30 text-primary",
                        )}>
                          {alert.level === 'critical' ? 'CRÍTICO' : alert.level === 'warning' ? 'ATENÇÃO' : 'PENDÊNCIA'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Recent Activities Timeline */}
          <Card className="border-border/50 shadow-md backdrop-blur-sm bg-gradient-card animate-fade-in" style={{ animationDelay: '0.65s' }}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="uppercase tracking-wider text-lg font-semibold">Atividades Recentes</CardTitle>
                  <CardDescription className="text-sm">Últimas 48 horas</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                {recentActivities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                    <Clock className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm font-medium">Nenhuma atividade recente</p>
                  </div>
                ) : (
                  <div className="relative space-y-0">
                    {recentActivities.map((activity, index) => (
                      <div key={activity.id} className="flex gap-3 pb-4 relative">
                        {/* Timeline line */}
                        {index < recentActivities.length - 1 && (
                          <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
                        )}
                        <div className={cn(
                          "shrink-0 rounded-full p-2 z-10",
                          activity.type === 'discharge' ? "bg-released/10" :
                          activity.type === 'prescription' ? "bg-primary/10" :
                          activity.type === 'admission' ? "bg-warning/10" :
                          "bg-muted"
                        )}>
                          {activity.type === 'discharge' && <LogOut className="h-3 w-3 text-released-on-soft" />}
                          {activity.type === 'prescription' && <Pill className="h-3 w-3 text-primary" />}
                          {activity.type === 'admission' && <UserPlus className="h-3 w-3 text-warning-on-soft" />}
                          {activity.type === 'movement' && <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{activity.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(activity.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid com estilo premium */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Movements Over Time */}
          <Card className="border-border/50 shadow-md backdrop-blur-sm bg-gradient-card hover:shadow-md transition-all duration-500 animate-fade-in" style={{ animationDelay: '0.7s' }}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="uppercase tracking-wider text-lg font-semibold">Movimentações ao Longo do Tempo</CardTitle>
              </div>
              <CardDescription className="text-sm">Altas, Óbitos e Transferências por período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={movementsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }}
                    iconType="circle"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ALTA" 
                    stroke="#22c55e" 
                    strokeWidth={3} 
                    dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ÓBITO" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="TRANSFERÊNCIA" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sector Distribution */}
          <Card className="border-border/50 shadow-md backdrop-blur-sm bg-gradient-card hover:shadow-md transition-all duration-500 animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="uppercase tracking-wider text-lg font-semibold">Ocupação — {activeSectorLabel}</CardTitle>
              </div>
              <CardDescription className="text-sm">Leitos ocupados vs vagos neste setor</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sectorDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={{
                      stroke: 'hsl(var(--muted-foreground))',
                      strokeWidth: 1
                    }}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  >
                    {sectorDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.name === 'Ocupados' ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Movements by Type */}
          <Card className="border-border/50 shadow-md backdrop-blur-sm bg-gradient-card hover:shadow-md transition-all duration-500 animate-fade-in" style={{ animationDelay: '0.9s' }}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="uppercase tracking-wider text-lg font-semibold">Movimentações por Tipo</CardTitle>
              </div>
              <CardDescription className="text-sm">Comparação de volumes entre categorias</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={movementsByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="type" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    cursor={{ fill: 'hsl(var(--accent))' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[8, 8, 0, 0]}
                    className="hover:opacity-80 transition-opacity"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bed Occupancy */}
          <Card className="border-border/50 shadow-md backdrop-blur-sm bg-gradient-card hover:shadow-md transition-all duration-500 animate-fade-in" style={{ animationDelay: '1s' }}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="uppercase tracking-wider text-lg font-semibold">Ocupação de Leitos</CardTitle>
              </div>
              <CardDescription className="text-sm">Evolução temporal da ocupação</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={bedOccupancy}>
                  <defs>
                    <linearGradient id="colorOcupacao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ocupação" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    fill="url(#colorOcupacao)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Requests by Destination - Full width */}
        <Card className="border-border/50 shadow-md backdrop-blur-sm bg-gradient-card hover:shadow-md transition-all duration-500 animate-fade-in" style={{ animationDelay: '1.1s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="uppercase tracking-wider text-lg font-semibold">Transferências por Destino</CardTitle>
            </div>
            <CardDescription className="text-sm">Principais destinos de transferência de pacientes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={requestsByDestination} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  type="number" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  dataKey="destination" 
                  type="category" 
                  width={180}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  cursor={{ fill: 'hsl(var(--accent))' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))"
                  radius={[0, 8, 8, 0]}
                  className="hover:opacity-80 transition-opacity"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Printable Dashboard - Hidden on screen, visible in print */}
      <PrintableDashboard
        department={activeSectorLabel}
        dateRange={dateRange}
        kpis={{
          requests: {
            value: kpis.internmentRequests,
            previousValue: kpis.comparison.internmentRequests,
            change: calculatePercentageChange(kpis.internmentRequests, kpis.comparison.internmentRequests)
          },
          activePatients: {
            value: kpis.activePatients,
            previousValue: kpis.comparison.activePatients,
            change: calculatePercentageChange(kpis.activePatients, kpis.comparison.activePatients)
          },
          discharges: {
            value: kpis.discharges,
            previousValue: kpis.comparison.discharges,
            change: calculatePercentageChange(kpis.discharges, kpis.comparison.discharges)
          },
          deaths: {
            value: kpis.deaths,
            previousValue: kpis.comparison.deaths,
            change: calculatePercentageChange(kpis.deaths, kpis.comparison.deaths)
          },
          transfers: {
            value: kpis.transfers,
            previousValue: kpis.comparison.transfers,
            change: calculatePercentageChange(kpis.transfers, kpis.comparison.transfers)
          }
        }}
        movementsOverTime={movementsOverTime}
        sectorDistribution={sectorDistribution}
        movementsByType={movementsByType}
        bedOccupancy={bedOccupancy}
        requestsByDestination={requestsByDestination}
      />
    </div>
  );
};

export default DashboardPage;
