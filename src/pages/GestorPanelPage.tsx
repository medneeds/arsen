import { useState, useEffect, useMemo, useRef } from "react";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { format, subDays, startOfDay, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment, DEPARTMENT_TO_SECTOR } from "@/contexts/DepartmentContext";
import {
  Bed, Activity, AlertTriangle, Users, Clock,
  Pill, BarChart3, ArrowUpDown, HeartPulse,
  RefreshCw, Download, TrendingUp, FileText,
  ShieldCheck, Loader2, LayoutGrid, Filter, Check,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart,
} from "recharts";

// ── Types ──
interface BedStats {
  total: number;
  occupied: number;
  vacant: number;
  doorPatients: number;
  bySector: Record<string, { total: number; occupied: number }>;
}

interface CriticalAlert {
  id: string;
  patientName: string;
  bed: string;
  sector: string;
  type: string;
  detail: string;
  severity: "critical" | "warning" | "info";
}

const SECTOR_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(210, 80%, 55%)",
  "hsl(142, 70%, 45%)",
  "hsl(45, 90%, 55%)",
  "hsl(280, 70%, 55%)",
];

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--muted-foreground))",
];

// ── Hierarchical sector blocks for the gestor filter ──
interface SectorBlock {
  id: string;
  label: string;
  /** Department names (matching DEPARTMENT_TO_SECTOR keys / requested_sector / department fields) */
  departments: string[];
}

const SECTOR_BLOCKS: SectorBlock[] = [
  { id: "uti", label: "UTI", departments: ["UTI 1", "UTI 2"] },
  { id: "uci", label: "UCI", departments: ["UCI 1", "UCI 2"] },
  {
    id: "enfermarias",
    label: "Enfermarias",
    departments: ["NEURO 01", "NEURO 02", "CLÍNICA CIRÚRGICA", "ENFERMARIA DE TRANSIÇÃO", "UCC"],
  },
  {
    id: "emergencia",
    label: "Urgência e Emergência",
    departments: ["UE VERTICAL", "UE HORIZONTAL", "SALA VERMELHA", "SALA LARANJA", "INTERNAÇÃO UE", "OBSERVAÇÃO CLÍNICA"],
  },
  {
    id: "vascular",
    label: "Anexo Vascular",
    departments: ["ENFERMARIA VASCULAR", "RIV"],
  },
  {
    id: "cc",
    label: "Centro Cirúrgico",
    departments: ["CC PREPARO", "CC BLOCO CIRÚRGICO", "CC RPA"],
  },
];

export default function GestorPanelPage() {
  const { currentHospital: selectedUnit } = useHospital();
  const { currentDepartment, setCurrentDepartment } = useDepartment();
  const [bedStats, setBedStats] = useState<BedStats>({ total: 0, occupied: 0, vacant: 0, doorPatients: 0, bySector: {} });
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [medicationCount, setMedicationCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [prescriptionStats, setPrescriptionStats] = useState({ total: 0, validated: 0, pending: 0, rejected: 0 });
  const [movementTrend, setMovementTrend] = useState<{ day: string; altas: number; admissoes: number; transferencias: number; obitos: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "ALL";
    return localStorage.getItem("gestor_sector_filter") || "ALL";
  });

  // Sincroniza o filtro de setor com mudanças externas (sidebar/seletor) e
  // mantém alinhado ao currentDepartment do contexto.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("gestor_sector_filter") : null;
    setSectorFilter(stored || "ALL");
  }, [currentDepartment]);

  // ── Filter resolution: ALL | BLOCK:<id> | specific department ──
  const isAllSectors = sectorFilter === "ALL";
  const isBlockFilter = sectorFilter.startsWith("BLOCK:");
  const activeBlock = isBlockFilter
    ? SECTOR_BLOCKS.find(b => b.id === sectorFilter.slice(6)) || null
    : null;

  /** Department names this filter resolves to. null = no filter (ALL). */
  const filteredDepartments: string[] | null = isAllSectors
    ? null
    : activeBlock
      ? activeBlock.departments
      : [sectorFilter];

  /** Sector codes (red/yellow/neuro_01/...) for patients/movements queries. */
  const filteredSectorCodes: string[] | null = filteredDepartments
    ? (filteredDepartments
        .map(d => DEPARTMENT_TO_SECTOR[d as keyof typeof DEPARTMENT_TO_SECTOR])
        .filter(Boolean) as string[])
    : null;

  const sectorDisplayName = isAllSectors
    ? "Todos os setores"
    : activeBlock
      ? activeBlock.label
      : getSectorDisplayLabel(filteredSectorCodes?.[0] || sectorFilter);

  // ── Apply a new filter (ALL / BLOCK / specific department) ──
  const applyFilter = (next: string) => {
    setSectorFilter(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("gestor_sector_filter", next);
    }
    if (next !== "ALL" && !next.startsWith("BLOCK:")) {
      try { setCurrentDepartment(next as any); } catch { /* noop */ }
    }
  };

  const fetchData = async () => {
    if (!selectedUnit) return;
    setLoading(true);

    try {
      // ── 1. Patients ──
      let patientsQuery = supabase
        .from("patients")
        .select("id, name, bed_number, sector, is_vacant, is_door_patient, clinical_status, diagnoses, relevant_exams")
        .eq("hospital_unit_id", selectedUnit.id);
      if (filteredSectorCodes && filteredSectorCodes.length > 0) {
        patientsQuery = patientsQuery.in("sector", filteredSectorCodes);
      }
      const { data: patients } = await patientsQuery;

      if (patients) {
        const occupied = patients.filter(p => !p.is_vacant && p.name?.trim());
        const vacant = patients.filter(p => p.is_vacant || !p.name?.trim());
        const doorPatients = patients.filter(p => p.is_door_patient);

        const bySector: Record<string, { total: number; occupied: number }> = {};
        patients.forEach(p => {
          if (!bySector[p.sector]) bySector[p.sector] = { total: 0, occupied: 0 };
          bySector[p.sector].total++;
          if (!p.is_vacant && p.name?.trim()) bySector[p.sector].occupied++;
        });

        setBedStats({ total: patients.length, occupied: occupied.length, vacant: vacant.length, doorPatients: doorPatients.length, bySector });

        // Critical alerts
        const alerts: CriticalAlert[] = [];
        occupied.forEach(p => {
          if (p.clinical_status === "gravíssimo" || p.clinical_status === "crítico") {
            alerts.push({ id: p.id, patientName: p.name, bed: p.bed_number, sector: getSectorDisplayLabel(p.sector), type: "Estado Clínico", detail: `Paciente em estado ${p.clinical_status}`, severity: "critical" });
          }
          if (p.relevant_exams && /crítico|urgente|alerta/i.test(p.relevant_exams)) {
            alerts.push({ id: p.id + "-exam", patientName: p.name, bed: p.bed_number, sector: getSectorDisplayLabel(p.sector), type: "Exame Crítico", detail: "Resultado com valor crítico identificado", severity: "warning" });
          }
        });
        setCriticalAlerts(alerts);
      }

      // ── 2. Movements (last 7 days for trend) ──
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      let movementsQuery = supabase
        .from("patient_movements")
        .select("*")
        .eq("hospital_unit_id", selectedUnit.id)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false });
      if (filteredSectorCodes && filteredSectorCodes.length > 0) {
        movementsQuery = movementsQuery.in("patient_sector", filteredSectorCodes);
      }
      const { data: movements } = await movementsQuery;

      setRecentMovements((movements || []).slice(0, 15));

      // Build 7-day trend
      const trend: Record<string, { altas: number; admissoes: number; transferencias: number; obitos: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const day = format(subDays(new Date(), i), "dd/MM", { locale: ptBR });
        trend[day] = { altas: 0, admissoes: 0, transferencias: 0, obitos: 0 };
      }
      (movements || []).forEach(m => {
        const day = format(new Date(m.created_at), "dd/MM", { locale: ptBR });
        if (trend[day]) {
          const type = m.movement_type?.toUpperCase() || "";
          if (type.includes("ALTA")) trend[day].altas++;
          else if (type.includes("ADMISS") || type.includes("INTERN")) trend[day].admissoes++;
          else if (type.includes("TRANSF")) trend[day].transferencias++;
          else if (type.includes("ÓBITO") || type.includes("OBITO")) trend[day].obitos++;
        }
      });
      setMovementTrend(Object.entries(trend).map(([day, vals]) => ({ day, ...vals })));

      // ── 3. Medication catalog count ──
      const { count } = await supabase.from("medication_catalog").select("id", { count: "exact", head: true });
      setMedicationCount(count || 0);

      // ── 4. Pending bed allocation requests ──
      let pendingQuery = supabase
        .from("bed_allocation_requests")
        .select("id", { count: "exact", head: true })
        .eq("hospital_unit_id", selectedUnit.id)
        .eq("status", "pending");
      if (filteredDepartments && filteredDepartments.length > 0) {
        pendingQuery = pendingQuery.in("requested_sector", filteredDepartments);
      }
      const { count: pendCount } = await pendingQuery;
      setPendingRequests(pendCount || 0);

      // ── 5. Prescription & validation stats ──
      let prescriptionQuery = supabase
        .from("prescriptions")
        .select("id", { count: "exact", head: true })
        .eq("hospital_unit_id", selectedUnit.id);
      if (filteredDepartments && filteredDepartments.length > 0) {
        prescriptionQuery = prescriptionQuery.in("department", filteredDepartments);
      }
      const { count: totalPrescriptions } = await prescriptionQuery;

      let validationsQuery = supabase
        .from("prescription_validations")
        .select("status")
        .eq("hospital_unit_id", selectedUnit.id);
      if (filteredDepartments && filteredDepartments.length > 0) {
        validationsQuery = validationsQuery.in("department", filteredDepartments);
      }
      const { data: validations } = await validationsQuery;

      const valCounts = { validated: 0, pending: 0, rejected: 0 };
      (validations || []).forEach((v: any) => {
        if (v.status === "approved") valCounts.validated++;
        else if (v.status === "pending") valCounts.pending++;
        else valCounts.rejected++;
      });
      setPrescriptionStats({ total: totalPrescriptions || 0, ...valCounts });

    } catch (err) {
      console.error("Error fetching gestor data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedUnit, sectorFilter]);

  const occupancyRate = bedStats.total > 0 ? Math.round((bedStats.occupied / bedStats.total) * 100) : 0;

  // ── Export CSV ──
  const handleExport = () => {
    setExporting(true);
    try {
      const rows = [
        ["Setor", "Leitos Totais", "Ocupados", "Vagos", "Ocupação (%)"],
        ...Object.entries(bedStats.bySector).map(([sector, s]) => [
          sector, s.total, s.occupied, s.total - s.occupied, s.total > 0 ? Math.round((s.occupied / s.total) * 100) + "%" : "0%",
        ]),
        [],
        ["Alertas Críticos"],
        ["Paciente", "Leito", "Setor", "Tipo", "Detalhe"],
        ...criticalAlerts.map(a => [a.patientName, a.bed, a.sector, a.type, a.detail]),
        [],
        ["Movimentações Recentes (últimas 48h)"],
        ["Paciente", "Tipo", "Destino", "Setor", "Leito", "Data"],
        ...recentMovements.slice(0, 20).map(m => [
          m.patient_name, m.movement_type, m.destination || "", getSectorDisplayLabel(m.patient_sector) || "", m.patient_bed || "",
          format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        ]),
      ];
      const csv = rows.map(r => (Array.isArray(r) ? r.join(";") : r)).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-gestor-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado com sucesso");
    } catch {
      toast.error("Erro ao exportar relatório");
    } finally {
      setExporting(false);
    }
  };

  // ── Pie data for occupancy ──
  const occupancyPie = [
    { name: "Ocupados", value: bedStats.occupied },
    { name: "Vagos", value: bedStats.vacant },
  ];

  // ── Bar data for sectors ──
  const sectorBarData = Object.entries(bedStats.bySector).map(([sector, s]) => ({
    sector: getSectorDisplayLabel(sector),
    Ocupados: s.occupied,
    Vagos: s.total - s.occupied,
  }));

  // ── KPIs ──
  const kpiCards = [
    { title: "Taxa de Ocupação", value: `${occupancyRate}%`, sub: `${bedStats.occupied}/${bedStats.total} leitos`, icon: Bed, color: occupancyRate > 85 ? "text-destructive" : occupancyRate > 70 ? "text-amber-600" : "text-emerald-600", bg: occupancyRate > 85 ? "bg-destructive/10" : occupancyRate > 70 ? "bg-amber-500/10" : "bg-emerald-500/10" },
    { title: "Leitos Vagos", value: bedStats.vacant.toString(), sub: "Disponíveis", icon: ArrowUpDown, color: "text-primary", bg: "bg-primary/10" },
    { title: "Pacientes Porta", value: bedStats.doorPatients.toString(), sub: "Aguardando leito", icon: Users, color: bedStats.doorPatients > 0 ? "text-amber-600" : "text-muted-foreground", bg: bedStats.doorPatients > 0 ? "bg-amber-500/10" : "bg-muted/30" },
    { title: "Alertas Críticos", value: criticalAlerts.filter(a => a.severity === "critical").length.toString(), sub: `${criticalAlerts.length} totais`, icon: AlertTriangle, color: criticalAlerts.length > 0 ? "text-destructive" : "text-muted-foreground", bg: criticalAlerts.length > 0 ? "bg-destructive/10" : "bg-muted/30" },
    { title: "Prescrições", value: prescriptionStats.total.toString(), sub: `${prescriptionStats.validated} validadas`, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { title: "Solicitações", value: pendingRequests.toString(), sub: "Alocação pendente", icon: Clock, color: pendingRequests > 0 ? "text-amber-600" : "text-muted-foreground", bg: pendingRequests > 0 ? "bg-amber-500/10" : "bg-muted/30" },
  ];

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              Painel do Gestor
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span>{isAllSectors ? "Visão consolidada" : "Setor"} — {selectedUnit?.name || "Unidade"}</span>
              <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">
                {sectorDisplayName}
              </Badge>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Hierarchical sector filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{sectorDisplayName}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={6} className="w-80 p-0 border-border/60 shadow-lg">
                <div className="px-3 py-2.5 border-b border-border/60 bg-muted/40">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Filtrar dados do painel
                  </p>
                </div>
                <ScrollArea className="max-h-[60vh]">
                  <div className="p-1.5 space-y-3">
                    {/* All sectors */}
                    <button
                      type="button"
                      onClick={() => applyFilter("ALL")}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-[11px] font-semibold transition-all",
                        isAllSectors ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <LayoutGrid className={cn("h-3.5 w-3.5", isAllSectors ? "text-primary" : "text-muted-foreground")} />
                        <span className="uppercase tracking-wide">Todos os setores</span>
                      </div>
                      {isAllSectors && <Check className="h-3.5 w-3.5" />}
                    </button>

                    {/* Blocks + sectors */}
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 px-2">
                        Blocos e setores
                      </p>
                      {SECTOR_BLOCKS.map(block => {
                        const blockId = `BLOCK:${block.id}`;
                        const blockActive = sectorFilter === blockId;
                        return (
                          <div key={block.id} className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => applyFilter(blockId)}
                              className={cn(
                                "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] transition-all",
                                blockActive ? "bg-primary/10 text-primary" : "text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground"
                              )}
                            >
                              <span>📊 Bloco {block.label}</span>
                              {blockActive && <Check className="h-3 w-3" />}
                            </button>
                            <div className="grid grid-cols-1 gap-0.5 pl-3">
                              {block.departments.map(dept => {
                                const isActive = sectorFilter === dept;
                                return (
                                  <button
                                    key={dept}
                                    type="button"
                                    onClick={() => applyFilter(dept)}
                                    className={cn(
                                      "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all text-left",
                                      isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                                    )}
                                  >
                                    <span className="truncate">{dept}</span>
                                    {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => { fetchData(); toast.success("Dados atualizados"); }} disabled={loading} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((kpi, i) => (
            <motion.div key={kpi.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-3.5">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-2", kpi.bg)}>
                    <kpi.icon className={cn("h-4 w-4", kpi.color)} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{kpi.title}</p>
                  <p className="text-[9px] text-muted-foreground/70">{kpi.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Occupancy Donut */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bed className="h-4 w-4 text-primary" /> Ocupação Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center pb-4">
              {bedStats.total > 0 ? (
                <div className="relative">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={occupancyPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {occupancyPie.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val: number, name: string) => [`${val} leitos`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">{occupancyRate}%</span>
                    <span className="text-[10px] text-muted-foreground">ocupação</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* Sector Bar Chart */}
          <Card className="border-border/50 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Ocupação por Setor
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {sectorBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sectorBarData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="sector" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Bar dataKey="Ocupados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Vagos" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de setores</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Movement Trend Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Tendência de Movimentações (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={movementTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Area type="monotone" dataKey="admissoes" name="Admissões" stroke="hsl(210, 80%, 55%)" fill="hsl(210, 80%, 55%)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="altas" name="Altas" stroke="hsl(142, 70%, 45%)" fill="hsl(142, 70%, 45%)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="transferencias" name="Transferências" stroke="hsl(45, 90%, 50%)" fill="hsl(45, 90%, 50%)" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="obitos" name="Óbitos" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Prescription Validation Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Validação Farmacêutica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Aprovadas", value: prescriptionStats.validated, total: prescriptionStats.total, color: "bg-emerald-500" },
                { label: "Pendentes", value: prescriptionStats.pending, total: prescriptionStats.total, color: "bg-amber-500" },
                { label: "Rejeitadas", value: prescriptionStats.rejected, total: prescriptionStats.total, color: "bg-destructive" },
              ].map(item => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold text-foreground">{item.value}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", item.color)} style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1">{prescriptionStats.total} prescrições no total · {medicationCount} medicamentos no catálogo</p>
            </CardContent>
          </Card>

          {/* Alerts Summary */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Alertas Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {criticalAlerts.length === 0 ? (
                <div className="text-center py-6">
                  <HeartPulse className="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-50" />
                  <p className="text-xs text-muted-foreground">Nenhum alerta crítico</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {criticalAlerts.slice(0, 6).map(alert => (
                    <div key={alert.id} className={cn("flex items-center gap-3 p-2.5 rounded-lg border", alert.severity === "critical" ? "border-destructive/30 bg-destructive/5" : "border-amber-300/30 bg-amber-50/50 dark:bg-amber-950/10")}>
                      <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", alert.severity === "critical" ? "text-destructive" : "text-amber-600")} />
                      <div className="flex-1 min-w-0">
                        <p className="patient-id text-xs font-semibold text-foreground truncate">{alert.patientName}</p>
                        <p className="text-[10px] text-muted-foreground">{alert.sector} · L{alert.bed} — {alert.detail}</p>
                      </div>
                    </div>
                  ))}
                  {criticalAlerts.length > 6 && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1">+{criticalAlerts.length - 6} alertas adicionais</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Movements Timeline */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-primary" /> Movimentações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <div className="text-center py-8">
                <ArrowUpDown className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs text-muted-foreground">Nenhuma movimentação recente</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentMovements.map((mov, i) => (
                  <motion.div key={mov.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                        mov.movement_type?.toUpperCase().includes("ALTA") ? "bg-emerald-500/10" :
                        mov.movement_type?.toUpperCase().includes("ÓBITO") ? "bg-destructive/10" : "bg-primary/10"
                      )}>
                        <Activity className={cn("h-3.5 w-3.5",
                          mov.movement_type?.toUpperCase().includes("ALTA") ? "text-emerald-600" :
                          mov.movement_type?.toUpperCase().includes("ÓBITO") ? "text-destructive" : "text-primary"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="patient-id text-xs font-semibold truncate text-foreground">{mov.patient_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {mov.movement_type}{mov.destination ? ` → ${mov.destination}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0">{getSectorDisplayLabel(mov.patient_sector)} · {mov.patient_bed}</Badge>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {format(new Date(mov.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
