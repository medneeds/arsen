import { useState, useEffect, useMemo, useRef } from "react";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { format, subDays, startOfDay, differenceInHours, formatDistanceToNow } from "date-fns";
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
  RefreshCw, Download, TrendingUp, TrendingDown, FileText,
  ShieldCheck, Loader2, LayoutGrid, Filter, Check, Building2,
  Hourglass, ArrowRight, Heart, Skull, LogOut, HelpCircle, Minus,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PlatformHeader } from "@/components/layout/PlatformHeader";
import { GestorNotificationCenter } from "@/components/gestor/GestorNotificationCenter";
import { KpiDrillDownDialog, type DrillDownRow } from "@/components/gestor/KpiDrillDownDialog";
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

type Period = "today" | "7d" | "30d";

interface OutcomeBreakdownItem {
  key: string;
  label: string;
  count: number;
  color: string;
  icon: typeof Heart;
}

interface TmpBySectorItem {
  sector: string;
  avgDays: number;
  samples: number;
}

interface KpiDelta {
  value: number;          // numeric delta
  display: string;        // "+3" / "-2" / "—"
  trend: "up" | "down" | "flat";
  goodIsDown?: boolean;   // when true, "up" means worse
  hint?: string;          // tooltip context (e.g. "vs ontem")
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
  // ── Drill-down datasets (D-5) ──
  const [occupiedPatientsList, setOccupiedPatientsList] = useState<any[]>([]);
  const [vacantBedsList, setVacantBedsList] = useState<any[]>([]);
  const [doorPatientsList, setDoorPatientsList] = useState<any[]>([]);
  const [pendingRequestsList, setPendingRequestsList] = useState<any[]>([]);
  const [prescriptionsList, setPrescriptionsList] = useState<any[]>([]);
  const [drillDown, setDrillDown] = useState<string | null>(null);
  // ── Period filter (banner + TMP + outcomes + trend chart) ──
  const [period, setPeriod] = useState<Period>(() => {
    if (typeof window === "undefined") return "7d";
    return (localStorage.getItem("gestor_period_filter") as Period) || "7d";
  });
  // ── TMP (Tempo Médio de Permanência) ──
  const [tmpOverall, setTmpOverall] = useState<{ avgDays: number; samples: number }>({ avgDays: 0, samples: 0 });
  const [tmpBySector, setTmpBySector] = useState<TmpBySectorItem[]>([]);
  // ── Outcomes breakdown ──
  const [outcomes, setOutcomes] = useState<OutcomeBreakdownItem[]>([]);
  const [outcomesTotal, setOutcomesTotal] = useState(0);
  // ── KPI deltas ──
  const [kpiDeltas, setKpiDeltas] = useState<Record<string, KpiDelta>>({});
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

        // Total de leitos = apenas leitos regulares (sem EXTRAs)
        const regularTotal = patients.filter(p => {
          const bed = (p.bed_number || '').toString().toUpperCase();
          return !bed.startsWith('EXTRA');
        }).length;
        setBedStats({ total: regularTotal, occupied: occupied.length, vacant: vacant.length, doorPatients: doorPatients.length, bySector });
        setOccupiedPatientsList(occupied);
        setVacantBedsList(vacant);
        setDoorPatientsList(doorPatients);

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

      // ── 2. Movements ──
      // Pull a wider window (30 days) so we can build the period trend +
      // previous-period comparisons without re-querying.
      const periodDays = period === "today" ? 1 : period === "7d" ? 7 : 30;
      const trendWindowDays = Math.max(periodDays, 30); // always 30 to cover deltas
      const windowStart = startOfDay(subDays(new Date(), trendWindowDays - 1)).toISOString();
      let movementsQuery = supabase
        .from("patient_movements")
        .select("*")
        .eq("hospital_unit_id", selectedUnit.id)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false });
      if (filteredSectorCodes && filteredSectorCodes.length > 0) {
        movementsQuery = movementsQuery.in("patient_sector", filteredSectorCodes);
      }
      const { data: movements } = await movementsQuery;

      setRecentMovements((movements || []).slice(0, 15));

      // Build trend for the selected period
      const trend: Record<string, { altas: number; admissoes: number; transferencias: number; obitos: number }> = {};
      for (let i = periodDays - 1; i >= 0; i--) {
        const day = format(subDays(new Date(), i), "dd/MM", { locale: ptBR });
        trend[day] = { altas: 0, admissoes: 0, transferencias: 0, obitos: 0 };
      }
      const periodStart = startOfDay(subDays(new Date(), periodDays - 1));
      (movements || []).forEach(m => {
        const d = new Date(m.created_at);
        if (d < periodStart) return;
        const day = format(d, "dd/MM", { locale: ptBR });
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

      // ── 4. Pending bed allocation requests (with detail for drill-down) ──
      let pendingQuery = supabase
        .from("bed_allocation_requests")
        .select("id, requested_sector, requested_bed, requesting_doctor_name, created_at, patient:patients(name, bed_number, sector)")
        .eq("hospital_unit_id", selectedUnit.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (filteredDepartments && filteredDepartments.length > 0) {
        pendingQuery = pendingQuery.in("requested_sector", filteredDepartments);
      }
      const { data: pendData } = await pendingQuery;
      setPendingRequests(pendData?.length || 0);
      setPendingRequestsList(pendData || []);

      // ── 5. Prescription & validation stats ──
      let prescriptionQuery = supabase
        .from("prescriptions")
        .select("id, patient_name, patient_bed, department, created_at, status")
        .eq("hospital_unit_id", selectedUnit.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (filteredDepartments && filteredDepartments.length > 0) {
        prescriptionQuery = prescriptionQuery.in("department", filteredDepartments);
      }
      const { data: prescData } = await prescriptionQuery;
      setPrescriptionsList(prescData || []);

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
      setPrescriptionStats({ total: prescData?.length || 0, ...valCounts });

      // ── 6. TMP (Tempo Médio de Permanência) ──
      // Encontros com alta no período selecionado, usando outcome_date ou discharge_date.
      const tmpStartIso = startOfDay(subDays(new Date(), periodDays - 1)).toISOString();
      let encQuery = supabase
        .from("patient_encounters")
        .select("admission_date, discharge_date, outcome_date, outcome, department")
        .eq("hospital_unit_id", selectedUnit.id)
        .or(`discharge_date.gte.${tmpStartIso},outcome_date.gte.${tmpStartIso}`);
      if (filteredDepartments && filteredDepartments.length > 0) {
        encQuery = encQuery.in("department", filteredDepartments);
      }
      const { data: encs } = await encQuery;
      const losDays: number[] = [];
      const bySectorLos: Record<string, number[]> = {};
      (encs || []).forEach((e: any) => {
        const end = e.discharge_date || e.outcome_date;
        if (!e.admission_date || !end) return;
        const ms = new Date(end).getTime() - new Date(e.admission_date).getTime();
        if (ms <= 0) return;
        const days = ms / (1000 * 60 * 60 * 24);
        if (days > 365) return; // descarta outlier
        losDays.push(days);
        const sec = e.department || "—";
        if (!bySectorLos[sec]) bySectorLos[sec] = [];
        bySectorLos[sec].push(days);
      });
      const avg = losDays.length > 0 ? losDays.reduce((a, b) => a + b, 0) / losDays.length : 0;
      setTmpOverall({ avgDays: avg, samples: losDays.length });
      setTmpBySector(
        Object.entries(bySectorLos)
          .map(([sector, arr]) => ({
            sector: getSectorDisplayLabel(sector) || sector,
            avgDays: arr.reduce((a, b) => a + b, 0) / arr.length,
            samples: arr.length,
          }))
          .sort((a, b) => b.avgDays - a.avgDays),
      );

      // ── 7. Outcomes breakdown (período) — usa patient_movements pois cobre melhor o real ──
      const outBuckets = { alta: 0, obito: 0, transf: 0, evasao: 0, outros: 0 };
      (movements || []).forEach((m: any) => {
        const d = new Date(m.created_at);
        if (d < periodStart) return;
        const t = (m.movement_type || "").toUpperCase();
        if (t.includes("ÓBITO") || t.includes("OBITO")) outBuckets.obito++;
        else if (t.includes("ALTA")) outBuckets.alta++;
        else if (t.includes("EVAS")) outBuckets.evasao++;
        else if (t.includes("TRANSF") && t.includes("EXTERN")) outBuckets.transf++;
      });
      const totalOut = outBuckets.alta + outBuckets.obito + outBuckets.transf + outBuckets.evasao + outBuckets.outros;
      setOutcomesTotal(totalOut);
      setOutcomes([
        { key: "alta", label: "Alta", count: outBuckets.alta, color: "hsl(142, 70%, 45%)", icon: Heart },
        { key: "obito", label: "Óbito", count: outBuckets.obito, color: "hsl(var(--destructive))", icon: Skull },
        { key: "transf", label: "Transf. Externa", count: outBuckets.transf, color: "hsl(45, 90%, 50%)", icon: ArrowRight },
        { key: "evasao", label: "Evasão", count: outBuckets.evasao, color: "hsl(280, 70%, 55%)", icon: LogOut },
        { key: "outros", label: "Outros", count: outBuckets.outros, color: "hsl(var(--muted-foreground))", icon: HelpCircle },
      ]);

      // ── 8. KPI deltas (tendência) ──
      // Para ocupação/leitos/porta usamos delta vs ontem via balanço de movimentações
      // (admissões - altas - óbitos - transf.externas) nas últimas 24h.
      // Para prescrições / solicitações usamos contagem desta semana vs semana passada.
      const now = new Date();
      const yesterday = subDays(now, 1);
      const last24Start = subDays(now, 1);
      const prev24Start = subDays(now, 2);
      let admit24 = 0, discharge24 = 0;
      let admitPrev24 = 0, dischargePrev24 = 0;
      (movements || []).forEach((m: any) => {
        const d = new Date(m.created_at);
        const t = (m.movement_type || "").toUpperCase();
        const isAdm = t.includes("ADMISS") || t.includes("INTERN");
        const isOut = t.includes("ALTA") || t.includes("ÓBITO") || t.includes("OBITO") || t.includes("EVAS") ||
          (t.includes("TRANSF") && t.includes("EXTERN"));
        if (d >= last24Start) {
          if (isAdm) admit24++;
          if (isOut) discharge24++;
        } else if (d >= prev24Start) {
          if (isAdm) admitPrev24++;
          if (isOut) dischargePrev24++;
        }
      });
      const occupancyDelta24 = admit24 - discharge24;        // net change in occupied beds today
      const occupancyDeltaPrev = admitPrev24 - dischargePrev24;

      // weekly comparisons for prescriptions & requests
      const weekStart = subDays(now, 7).toISOString();
      const prevWeekStart = subDays(now, 14).toISOString();
      const prevWeekEnd = subDays(now, 7).toISOString();

      let prescCurrPromise = supabase
        .from("prescriptions")
        .select("id", { count: "exact", head: true })
        .eq("hospital_unit_id", selectedUnit.id)
        .gte("created_at", weekStart);
      let prescPrevPromise = supabase
        .from("prescriptions")
        .select("id", { count: "exact", head: true })
        .eq("hospital_unit_id", selectedUnit.id)
        .gte("created_at", prevWeekStart)
        .lt("created_at", prevWeekEnd);
      if (filteredDepartments && filteredDepartments.length > 0) {
        prescCurrPromise = prescCurrPromise.in("department", filteredDepartments);
        prescPrevPromise = prescPrevPromise.in("department", filteredDepartments);
      }
      let reqCurrPromise = supabase
        .from("bed_allocation_requests")
        .select("id", { count: "exact", head: true })
        .eq("hospital_unit_id", selectedUnit.id)
        .gte("created_at", weekStart);
      let reqPrevPromise = supabase
        .from("bed_allocation_requests")
        .select("id", { count: "exact", head: true })
        .eq("hospital_unit_id", selectedUnit.id)
        .gte("created_at", prevWeekStart)
        .lt("created_at", prevWeekEnd);
      if (filteredDepartments && filteredDepartments.length > 0) {
        reqCurrPromise = reqCurrPromise.in("requested_sector", filteredDepartments);
        reqPrevPromise = reqPrevPromise.in("requested_sector", filteredDepartments);
      }
      const [prescCurr, prescPrev, reqCurr, reqPrev] = await Promise.all([
        prescCurrPromise, prescPrevPromise, reqCurrPromise, reqPrevPromise,
      ]);
      const prescDelta = (prescCurr.count || 0) - (prescPrev.count || 0);
      const reqDelta = (reqCurr.count || 0) - (reqPrev.count || 0);

      const mkDelta = (n: number, hint: string, goodIsDown = false): KpiDelta => ({
        value: n,
        display: n === 0 ? "0" : n > 0 ? `+${n}` : `${n}`,
        trend: n === 0 ? "flat" : n > 0 ? "up" : "down",
        goodIsDown,
        hint,
      });

      setKpiDeltas({
        occupancy: mkDelta(occupancyDelta24, "vs últimas 24h", true), // mais ocupação geralmente é "pior"
        vacant: mkDelta(-occupancyDelta24, "vs últimas 24h", false),  // mais vagos é melhor
        door: mkDelta(occupancyDelta24 - occupancyDeltaPrev, "vs ontem", true),
        alerts: { value: 0, display: "—", trend: "flat", hint: "tempo real" },
        prescriptions: mkDelta(prescDelta, "vs semana anterior", false),
        requests: mkDelta(reqDelta, "vs semana anterior", true),
        tmp: { value: 0, display: "—", trend: "flat", hint: "período selecionado" },
      });

    } catch (err) {
      console.error("Error fetching gestor data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedUnit, sectorFilter, period]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("gestor_period_filter", period);
  }, [period]);

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

  // ── TMP formatado ──
  const tmpDisplay = tmpOverall.samples > 0
    ? `${tmpOverall.avgDays.toFixed(1).replace(".", ",")} dias`
    : "—";

  // ── KPIs (key habilita drill-down) ──
  const kpiCards = [
    { key: "occupancy", title: "Taxa de Ocupação", value: `${occupancyRate}%`, sub: `${bedStats.occupied}/${bedStats.total} leitos`, icon: Bed, color: occupancyRate > 85 ? "text-destructive" : occupancyRate > 70 ? "text-amber-600" : "text-emerald-600", bg: occupancyRate > 85 ? "bg-destructive/10" : occupancyRate > 70 ? "bg-amber-500/10" : "bg-emerald-500/10" },
    { key: "vacant", title: "Leitos Vagos", value: bedStats.vacant.toString(), sub: "Disponíveis", icon: ArrowUpDown, color: "text-primary", bg: "bg-primary/10" },
    { key: "door", title: "Pacientes Porta", value: bedStats.doorPatients.toString(), sub: "Aguardando leito", icon: Users, color: bedStats.doorPatients > 0 ? "text-amber-600" : "text-muted-foreground", bg: bedStats.doorPatients > 0 ? "bg-amber-500/10" : "bg-muted/30" },
    { key: "alerts", title: "Alertas Críticos", value: criticalAlerts.filter(a => a.severity === "critical").length.toString(), sub: `${criticalAlerts.length} totais`, icon: AlertTriangle, color: criticalAlerts.length > 0 ? "text-destructive" : "text-muted-foreground", bg: criticalAlerts.length > 0 ? "bg-destructive/10" : "bg-muted/30" },
    { key: "prescriptions", title: "Prescrições", value: prescriptionStats.total.toString(), sub: `${prescriptionStats.validated} validadas`, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { key: "requests", title: "Solicitações", value: pendingRequests.toString(), sub: "Alocação pendente", icon: Clock, color: pendingRequests > 0 ? "text-amber-600" : "text-muted-foreground", bg: pendingRequests > 0 ? "bg-amber-500/10" : "bg-muted/30" },
    { key: "tmp", title: "Tempo Médio Perm.", value: tmpDisplay, sub: `${tmpOverall.samples} altas no período`, icon: Hourglass, color: "text-primary", bg: "bg-primary/10" },
  ];

  // ── Datasets para drill-down (D-5) ──
  const drillRows: Record<string, DrillDownRow[]> = {
    occupancy: occupiedPatientsList.map(p => ({
      id: p.id,
      primary: p.name || "(SEM NOME)",
      secondary: `LEITO ${p.bed_number} • ${getSectorDisplayLabel(p.sector)}`,
      badge: p.clinical_status ? { label: String(p.clinical_status).toUpperCase(), variant: ["gravíssimo", "grave", "crítico"].includes(p.clinical_status) ? "destructive" : "secondary" } : undefined,
    })),
    vacant: vacantBedsList.map(p => ({
      id: p.id,
      primary: `LEITO ${p.bed_number}`,
      secondary: getSectorDisplayLabel(p.sector),
      badge: { label: "VAGO", variant: "outline" },
    })),
    door: doorPatientsList.map(p => ({
      id: p.id,
      primary: p.name || "(SEM NOME)",
      secondary: `LEITO PORTA ${p.bed_number} • ${getSectorDisplayLabel(p.sector)}`,
      badge: { label: "AGUARDANDO", variant: "secondary" },
    })),
    alerts: criticalAlerts.map(a => ({
      id: a.id,
      primary: a.patientName,
      secondary: `LEITO ${a.bed} • ${a.sector}`,
      tertiary: a.detail,
      badge: { label: a.type.toUpperCase(), variant: a.severity === "critical" ? "destructive" : "outline" },
    })),
    prescriptions: prescriptionsList.slice(0, 100).map((p: any) => ({
      id: p.id,
      primary: p.patient_name || "—",
      secondary: `${p.patient_bed ? `LEITO ${p.patient_bed} • ` : ""}${p.department || ""}`,
      tertiary: format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      badge: { label: String(p.status || "ATIVA").toUpperCase(), variant: "outline" },
    })),
    requests: pendingRequestsList.map((r: any) => ({
      id: r.id,
      primary: r.patient?.name || "(PACIENTE)",
      secondary: `${r.patient?.bed_number ? `LEITO ${r.patient.bed_number} → ` : ""}${r.requested_sector}${r.requested_bed ? ` (${r.requested_bed})` : ""}`,
      tertiary: `${r.requesting_doctor_name ? r.requesting_doctor_name + " • " : ""}${formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}`,
      badge: { label: "PENDENTE", variant: "secondary" },
    })),
  };
  const activeDrill = drillDown ? kpiCards.find(k => k.key === drillDown) : null;

  return (
    <MainLayout>
      <PlatformHeader
        variant="institutional"
        eyebrow="Painel · Gestão Hospitalar"
        title="Painel do Gestor"
        icon={BarChart3}
        subtitle={
          <>
            <Building2 className="h-3 w-3" />
            <span className="truncate">{selectedUnit?.name || "Unidade"}</span>
            <span className="opacity-50">·</span>
            <span className="truncate">{isAllSectors ? "Visão consolidada" : sectorDisplayName}</span>
          </>
        }
        actions={
          <>
            <GestorNotificationCenter
              data={{ occupancyRate, bedStats, criticalAlerts, pendingRequests, prescriptionStats }}
            />
            <span className="hidden md:block w-px h-6 bg-white/20 mx-1" />
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5 h-9 bg-white/95 text-foreground border-border hover:bg-white hover:text-foreground dark:bg-background dark:text-foreground">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="hidden md:inline">Exportar</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => { fetchData(); toast.success("Dados atualizados"); }} disabled={loading} className="gap-1.5 h-9 bg-white/95 text-foreground border-border hover:bg-white hover:text-foreground dark:bg-background dark:text-foreground">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              <span className="hidden md:inline">Atualizar</span>
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* Filtro hierárquico de setores */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Filtro:</span>
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
        </div>

        {/* KPI Cards (clicáveis para drill-down) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((kpi, i) => (
            <motion.div key={kpi.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <button
                type="button"
                onClick={() => setDrillDown(kpi.key)}
                className="w-full text-left"
              >
                <Card className="border-border/50 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
                  <CardContent className="p-3.5">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-2", kpi.bg)}>
                      <kpi.icon className={cn("h-4 w-4", kpi.color)} />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{kpi.title}</p>
                    <p className="text-[9px] text-muted-foreground/70">{kpi.sub}</p>
                  </CardContent>
                </Card>
              </button>
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
      {/* D-5: Drill-down dos KPIs */}
      <KpiDrillDownDialog
        open={!!drillDown}
        onOpenChange={(v) => !v && setDrillDown(null)}
        title={activeDrill?.title || ""}
        description={activeDrill?.sub}
        icon={activeDrill?.icon}
        iconColor={activeDrill?.color}
        iconBg={activeDrill?.bg}
        rows={drillDown ? drillRows[drillDown] || [] : []}
      />
    </MainLayout>
  );
}
