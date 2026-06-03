import { useState, useEffect, useMemo, useRef } from "react";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { format, subDays, startOfDay, differenceInHours, formatDistanceToNow, addDays } from "date-fns";
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
  Repeat, Trophy, Stethoscope, FlaskConical, Navigation,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PlatformHeader } from "@/components/layout/PlatformHeader";
import { GestorNotificationCenter } from "@/components/gestor/GestorNotificationCenter";
import { KpiDrillDownDialog, type DrillDownRow } from "@/components/gestor/KpiDrillDownDialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
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

interface BedTurnoverItem {
  sector: string;
  encounters: number;
  beds: number;
  turnover: number;
}

interface MortalityItem {
  sector: string;
  deaths: number;
  total: number;
  rate: number;
}

interface MedicalProductionItem {
  name: string;
  count: number;
}

interface DischargePreviewItem {
  id: string;
  name: string;
  bed: string;
  sector: string;
  sectorLabel: string;
  dischargeDate: Date | null;
  rawDate: string;
  status: 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'future' | 'unknown';
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
  const isMobile = useIsMobile();
  const [sectorFilterOpen, setSectorFilterOpen] = useState(false);
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
  // ── Bed Turnover / Mortality / Medical Production ──
  const [bedTurnover, setBedTurnover] = useState<BedTurnoverItem[]>([]);
  const [bedTurnoverAvg, setBedTurnoverAvg] = useState(0);
  const [mortalityBySector, setMortalityBySector] = useState<MortalityItem[]>([]);
  const [mortalityTotal, setMortalityTotal] = useState(0);
  const [medicalProduction, setMedicalProduction] = useState<MedicalProductionItem[]>([]);
  // ── Exam pendings + Regulated patients ──
  const [examPending, setExamPending] = useState<{ category: string; label: string; count: number; color: string }[]>([]);
  const [examPendingTotal, setExamPendingTotal] = useState(0);
  const [examPendingBySector, setExamPendingBySector] = useState<{ sector: string; total: number; breakdown: Record<string, number> }[]>([]);
  const [regulatedPatients, setRegulatedPatients] = useState<{ id: string; name: string; age: string | null; sex: string | null; origin: string; destination: string; priority: string; status: string; waitHours: number; createdAt: string }[]>([]);
  // ── Discharge predictions ──
  const [dischargePreviews, setDischargePreviews] = useState<DischargePreviewItem[]>([]);
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
        .select("id, name, bed_number, sector, is_vacant, is_door_patient, clinical_status, diagnoses, relevant_exams, uti_discharge_prediction, hospital_discharge_prediction")
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

        // ── 8g. Previsão de Alta (a partir dos patients já carregados) ──
        const _today = startOfDay(new Date());
        const _tomorrow = startOfDay(addDays(new Date(), 1));
        const _nextWeek = startOfDay(addDays(new Date(), 7));

        const parseDischargeDate = (raw: string | null): Date | null => {
          if (!raw || /sem previs/i.test(raw)) return null;
          if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(raw);
          const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`);
          return null;
        };

        const previews: DischargePreviewItem[] = (patients || [])
          .filter(p => !p.is_vacant && p.name?.trim())
          .map(p => {
            const raw = (p as any).hospital_discharge_prediction || (p as any).uti_discharge_prediction || null;
            const date = parseDischargeDate(raw);
            let status: DischargePreviewItem['status'] = 'unknown';
            if (date) {
              const d = startOfDay(date);
              if (d < _today) status = 'overdue';
              else if (d.getTime() === _today.getTime()) status = 'today';
              else if (d.getTime() === _tomorrow.getTime()) status = 'tomorrow';
              else if (d <= _nextWeek) status = 'this_week';
              else status = 'future';
            }
            return {
              id: p.id,
              name: p.name || '—',
              bed: p.bed_number || '—',
              sector: p.sector,
              sectorLabel: getSectorDisplayLabel(p.sector) || p.sector,
              dischargeDate: date,
              rawDate: raw || '',
              status,
            };
          })
          .filter(p => p.status !== 'future' && p.status !== 'unknown')
          .sort((a, b) => {
            const order: Record<string, number> = { overdue: 0, today: 1, tomorrow: 2, this_week: 3 };
            return (order[a.status] ?? 4) - (order[b.status] ?? 4);
          });

        setDischargePreviews(previews);
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

      // ── 8b. Giro de Leito (encontros encerrados / leitos no setor) ──
      // Reusa `encs` (encontros encerrados no período) e bedStats.bySector já calculado.
      const encsBySector: Record<string, number> = {};
      (encs || []).forEach((e: any) => {
        const dept = e.department || "—";
        const code = (DEPARTMENT_TO_SECTOR as any)[dept] || dept;
        encsBySector[code] = (encsBySector[code] || 0) + 1;
      });
      const turnoverRows: BedTurnoverItem[] = Object.entries(encsBySector)
        .map(([code, count]) => {
          const beds = bedStats.bySector[code]?.total || 0;
          return {
            sector: getSectorDisplayLabel(code) || code,
            encounters: count,
            beds,
            turnover: beds > 0 ? count / beds : 0,
          };
        })
        .filter(r => r.beds > 0)
        .sort((a, b) => b.turnover - a.turnover);
      setBedTurnover(turnoverRows);
      const totalEncsTurn = turnoverRows.reduce((acc, r) => acc + r.encounters, 0);
      const totalBedsTurn = turnoverRows.reduce((acc, r) => acc + r.beds, 0);
      setBedTurnoverAvg(totalBedsTurn > 0 ? totalEncsTurn / totalBedsTurn : 0);

      // ── 8c. Mortalidade por setor (período) ──
      const deathsBySector: Record<string, number> = {};
      const totalBySector: Record<string, number> = {};
      (movements || []).forEach((m: any) => {
        const d = new Date(m.created_at);
        if (d < periodStart) return;
        const sec = m.patient_sector || "—";
        totalBySector[sec] = (totalBySector[sec] || 0) + 1;
        const t = (m.movement_type || "").toUpperCase();
        if (t.includes("ÓBITO") || t.includes("OBITO")) {
          deathsBySector[sec] = (deathsBySector[sec] || 0) + 1;
        }
      });
      const mortalityRows: MortalityItem[] = Object.entries(deathsBySector)
        .map(([sec, deaths]) => {
          const total = totalBySector[sec] || deaths;
          return {
            sector: getSectorDisplayLabel(sec) || sec,
            deaths,
            total,
            rate: total > 0 ? (deaths / total) * 100 : 0,
          };
        })
        .sort((a, b) => b.deaths - a.deaths);
      setMortalityBySector(mortalityRows);
      setMortalityTotal(mortalityRows.reduce((acc, r) => acc + r.deaths, 0));

      // ── 8d. Ranking de Produção Médica (clinical_evolutions) ──
      let evolQuery = supabase
        .from("clinical_evolutions")
        .select("created_by_name, department")
        .eq("hospital_unit_id", selectedUnit.id)
        .gte("created_at", periodStart.toISOString());
      if (filteredDepartments && filteredDepartments.length > 0) {
        evolQuery = evolQuery.in("department", filteredDepartments);
      }
      const { data: evolData } = await evolQuery;
      const byDoctor: Record<string, number> = {};
      (evolData || []).forEach((row: any) => {
        const name = (row.created_by_name || "").trim();
        if (!name) return;
        byDoctor[name] = (byDoctor[name] || 0) + 1;
      });
      setMedicalProduction(
        Object.entries(byDoctor)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      );


      // ── 8e. Pendências de Exames (categoria + por setor) ──
      let examQuery = supabase
        .from("exam_requests")
        .select("category, department, priority, patient_name, patient_bed, created_at")
        .eq("hospital_unit_id", selectedUnit.id)
        .eq("status", "pending");
      if (filteredDepartments && filteredDepartments.length > 0) {
        examQuery = examQuery.in("department", filteredDepartments);
      }
      const { data: examData } = await examQuery;

      const catMap: Record<string, number> = {};
      const sectorMap: Record<string, Record<string, number>> = {};
      (examData || []).forEach((e: any) => {
        catMap[e.category] = (catMap[e.category] || 0) + 1;
        const sec = e.department || "—";
        if (!sectorMap[sec]) sectorMap[sec] = {};
        sectorMap[sec][e.category] = (sectorMap[sec][e.category] || 0) + 1;
      });

      const CAT_META: Record<string, { label: string; color: string }> = {
        laboratorio:    { label: "Laboratório",    color: "hsl(210, 80%, 55%)" },
        imagem:         { label: "Imagem",         color: "hsl(280, 70%, 55%)" },
        parecer:        { label: "Parecer",        color: "hsl(45, 90%, 50%)"  },
        cultura:        { label: "Cultura",        color: "hsl(142, 70%, 45%)" },
        hemocomponente: { label: "Hemocomponente", color: "hsl(var(--destructive))" },
        sat:            { label: "SAT",            color: "hsl(var(--muted-foreground))" },
      };

      const examRows = Object.entries(catMap)
        .map(([cat, count]) => ({
          category: cat,
          label: CAT_META[cat]?.label || cat,
          count,
          color: CAT_META[cat]?.color || "hsl(var(--primary))",
        }))
        .sort((a, b) => b.count - a.count);

      setExamPending(examRows);
      setExamPendingTotal(examRows.reduce((acc, r) => acc + r.count, 0));
      setExamPendingBySector(
        Object.entries(sectorMap)
          .map(([sector, breakdown]) => ({
            sector,
            total: Object.values(breakdown).reduce((a, b) => a + b, 0),
            breakdown,
          }))
          .sort((a, b) => b.total - a.total)
      );

      // ── 8f. Pacientes Regulados ──
      let regulQuery = supabase
        .from("regulation_requests")
        .select("id, patient_name, patient_age, patient_sex, origin_sector, destination_sector, destination_unit, priority, status, created_at")
        .eq("hospital_unit_id", selectedUnit.id)
        .not("status", "eq", "completed")
        .not("status", "eq", "canceled")
        .order("created_at", { ascending: true });
      if (filteredDepartments && filteredDepartments.length > 0) {
        regulQuery = regulQuery.in("origin_sector", filteredDepartments);
      }
      const { data: regulData } = await regulQuery;
      setRegulatedPatients(
        (regulData || []).map((r: any) => ({
          id: r.id,
          name: r.patient_name || "—",
          age: r.patient_age,
          sex: r.patient_sex,
          origin: getSectorDisplayLabel(r.origin_sector) || r.origin_sector || "—",
          destination: r.destination_unit || r.destination_sector || "—",
          priority: r.priority || "—",
          status: r.status || "—",
          waitHours: Math.floor((Date.now() - new Date(r.created_at).getTime()) / 3_600_000),
          createdAt: r.created_at,
        }))
      );




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
    tmp: tmpBySector.map(row => ({
      id: row.sector,
      primary: row.sector,
      secondary: `${row.avgDays.toFixed(1).replace(".", ",")} dias em média`,
      tertiary: `Baseado em ${row.samples} altas no período`,
      badge: { label: `${row.samples} ALTAS`, variant: "outline" as const },
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

      <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-7xl mx-auto">
        {/* Banner de Resumo Executivo */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.03] to-transparent">
          <CardContent className="p-3.5 md:p-4">
            <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-5 gap-y-2 text-xs sm:text-sm">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                {period === "today" ? "Hoje" : period === "7d" ? "Últimos 7 dias" : "Últimos 30 dias"}
              </span>
              <span className="hidden md:inline opacity-30">·</span>
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Bed className="h-3.5 w-3.5 text-primary" />
                {occupancyRate}% ocup.
              </span>
              <span className="opacity-30 sm:hidden">·</span>
              <span className="hidden md:inline opacity-30">·</span>
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <AlertTriangle className={cn("h-3.5 w-3.5", criticalAlerts.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                {criticalAlerts.filter(a => a.severity === "critical").length} críticos
              </span>
              <span className="opacity-30 sm:hidden">·</span>
              <span className="hidden md:inline opacity-30">·</span>
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Hourglass className="h-3.5 w-3.5 text-primary" />
                TMP {tmpDisplay}
              </span>
              <span className="hidden md:inline opacity-30">·</span>
              <span className="hidden sm:flex items-center gap-1.5 font-semibold text-foreground">
                <Clock className={cn("h-3.5 w-3.5", pendingRequests > 0 ? "text-amber-600" : "text-muted-foreground")} />
                {pendingRequests} solicitações pendentes
              </span>
              <span className="hidden md:inline opacity-30">·</span>
              <span className="hidden sm:flex items-center gap-1.5 font-semibold text-foreground">
                <Users className={cn("h-3.5 w-3.5", bedStats.doorPatients > 0 ? "text-amber-600" : "text-muted-foreground")} />
                {bedStats.doorPatients} pacientes porta
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Filtros: Setor + Período */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Filtro:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{sectorDisplayName}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={6}
                className="w-[min(560px,95vw)] p-0 border-border/60 shadow-xl"
              >
                <div className="px-4 py-3 border-b border-border/60 bg-muted/40 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Filtrar dados do painel
                  </p>
                  <span className="text-[10px] font-medium text-muted-foreground/70 tabular-nums">
                    {bedStats.total} leitos no hospital
                  </span>
                </div>
                <ScrollArea className="max-h-[80vh]">
                  <div className="p-2.5 space-y-3">
                    {/* All sectors */}
                    <button
                      type="button"
                      onClick={() => applyFilter("ALL")}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-[12px] font-semibold transition-all border",
                        isAllSectors
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "text-foreground hover:bg-muted border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <LayoutGrid className={cn("h-4 w-4", isAllSectors ? "text-primary" : "text-muted-foreground")} />
                        <span className="uppercase tracking-wide">Todos os setores</span>
                      </div>
                      {isAllSectors && <Check className="h-4 w-4" />}
                    </button>

                    {/* Blocks + sectors */}
                    <div className="space-y-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 px-1">
                        Blocos e setores
                      </p>
                      {SECTOR_BLOCKS.map(block => {
                        const blockId = `BLOCK:${block.id}`;
                        const blockActive = sectorFilter === blockId;
                        const blockHasActiveChild = block.departments.some(d => d === sectorFilter);
                        const isHighlighted = blockActive || blockHasActiveChild;
                        const blockTotals = block.departments.reduce(
                          (acc, dept) => {
                            const code = DEPARTMENT_TO_SECTOR[dept as keyof typeof DEPARTMENT_TO_SECTOR];
                            const s = code ? bedStats.bySector[code] : undefined;
                            if (s) {
                              acc.total += s.total;
                              acc.occupied += s.occupied;
                            }
                            return acc;
                          },
                          { total: 0, occupied: 0 }
                        );
                        return (
                          <div
                            key={block.id}
                            className={cn(
                              "rounded-md border-l-2 pl-2.5 pr-1 py-1 transition-colors",
                              isHighlighted
                                ? "border-primary bg-primary/5"
                                : "border-border/40 hover:border-border"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => applyFilter(blockId)}
                              className={cn(
                                "w-full flex items-center justify-between gap-2 px-1.5 py-1.5 rounded-md text-[10.5px] font-bold uppercase tracking-[0.14em] transition-all",
                                blockActive
                                  ? "text-primary"
                                  : "text-muted-foreground/90 hover:text-foreground"
                              )}
                            >
                              <span className="flex items-center gap-1.5">
                                <span>Bloco {block.label}</span>
                                {blockTotals.total > 0 && (
                                  <span className="text-[9px] font-semibold text-muted-foreground/70 tabular-nums normal-case tracking-normal">
                                    · {blockTotals.occupied}/{blockTotals.total}
                                  </span>
                                )}
                              </span>
                              {blockActive && <Check className="h-3.5 w-3.5" />}
                            </button>
                            <div className="grid grid-cols-2 gap-1 pt-0.5 pb-1">
                              {block.departments.map(dept => {
                                const isActive = sectorFilter === dept;
                                const code = DEPARTMENT_TO_SECTOR[dept as keyof typeof DEPARTMENT_TO_SECTOR];
                                const stat = code ? bedStats.bySector[code] : undefined;
                                return (
                                  <button
                                    key={dept}
                                    type="button"
                                    onClick={() => applyFilter(dept)}
                                    className={cn(
                                      "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all text-left border",
                                      isActive
                                        ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                                        : "text-foreground hover:bg-muted border-transparent"
                                    )}
                                  >
                                    <span className="truncate">{dept}</span>
                                    <span className="flex items-center gap-1 flex-shrink-0">
                                      {stat && (
                                        <span className={cn(
                                          "text-[9px] font-semibold tabular-nums",
                                          isActive ? "text-primary/80" : "text-muted-foreground/70"
                                        )}>
                                          {stat.occupied}/{stat.total}
                                        </span>
                                      )}
                                      {isActive && <Check className="h-3.5 w-3.5" />}
                                    </span>
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
          {/* Period selector */}
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
            {([
              { id: "today" as Period, label: "Hoje" },
              { id: "7d" as Period, label: "7 dias" },
              { id: "30d" as Period, label: "30 dias" },
            ]).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={cn(
                  "px-3 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-all",
                  period === opt.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards (clicáveis para drill-down) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {kpiCards.map((kpi, i) => {
            const delta = kpiDeltas[kpi.key];
            const isWorse = delta && delta.trend !== "flat" &&
              ((delta.goodIsDown && delta.trend === "up") || (!delta.goodIsDown && delta.trend === "down"));
            const trendColor = delta?.trend === "flat" ? "text-muted-foreground" : isWorse ? "text-destructive" : "text-emerald-600";
            const TrendIcon = delta?.trend === "flat" ? Minus : delta?.trend === "up" ? TrendingUp : TrendingDown;
            return (
              <motion.div key={kpi.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <button
                  type="button"
                  onClick={() => setDrillDown(kpi.key)}
                  className="w-full text-left"
                >
                  <Card className="border-border/50 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer h-full">
                    <CardContent className="p-3.5">
                      <div className="flex items-start justify-between mb-2">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", kpi.bg)}>
                          <kpi.icon className={cn("h-4 w-4", kpi.color)} />
                        </div>
                        {delta && delta.display !== "—" && (
                          <span
                            className={cn("flex items-center gap-0.5 text-[10px] font-bold", trendColor)}
                            title={delta.hint}
                          >
                            <TrendIcon className="h-3 w-3" />
                            {delta.display}
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-foreground leading-tight">{kpi.value}</p>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{kpi.title}</p>
                      <p className="text-[9px] text-muted-foreground/70">{kpi.sub}</p>
                      {delta?.hint && delta.display !== "—" && (
                        <p className="text-[9px] text-muted-foreground/50 mt-0.5">{delta.hint}</p>
                      )}
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* TMP por Setor + Desfechos do Período */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* TMP por Setor */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Hourglass className="h-4 w-4 text-primary" /> Tempo Médio de Permanência por Setor
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tmpBySector.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Sem altas no período selecionado para calcular TMP.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {tmpBySector.map(row => (
                    <div key={row.sector} className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
                      <span className="text-xs font-medium text-foreground truncate">{row.sector}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{row.samples} altas</span>
                        <span className="text-xs font-bold text-primary tabular-nums">
                          {row.avgDays.toFixed(1).replace(".", ",")} d
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/70 pt-2 border-t mt-2">
                Calculado a partir de admissão até alta (encontros encerrados no período).
              </p>
            </CardContent>
          </Card>

          {/* Desfechos do Período */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Desfechos do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              {outcomesTotal === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Sem desfechos registrados no período.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {outcomes.filter(o => o.count > 0).map(o => {
                    const pct = outcomesTotal > 0 ? (o.count / outcomesTotal) * 100 : 0;
                    const Icon = o.icon;
                    return (
                      <div key={o.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-medium text-foreground">
                            <Icon className="h-3.5 w-3.5" style={{ color: o.color }} />
                            {o.label}
                          </span>
                          <span className="tabular-nums">
                            <span className="font-bold text-foreground">{o.count}</span>
                            <span className="text-muted-foreground"> · {pct.toFixed(0)}%</span>
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: o.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-muted-foreground/70 pt-2 border-t mt-2">
                    Total de {outcomesTotal} desfechos no período.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Giro de Leito + Mortalidade + Produção Médica */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Giro de Leito */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" /> Giro de Leito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 pb-3 border-b mb-3">
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {bedTurnoverAvg > 0 ? `${bedTurnoverAvg.toFixed(1).replace(".", ",")}×` : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">média geral</span>
              </div>
              {bedTurnover.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Sem encontros encerrados no período.
                </p>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {bedTurnover.map(row => {
                    const variant: "default" | "secondary" | "outline" =
                      row.turnover >= 2 ? "default" : row.turnover >= 1 ? "secondary" : "outline";
                    const colorClass =
                      row.turnover >= 2
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : row.turnover >= 1
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : "bg-muted text-muted-foreground border-border";
                    return (
                      <div key={row.sector} className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{row.sector}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {row.encounters} altas · {row.beds} leitos
                          </p>
                        </div>
                        <Badge variant={variant} className={cn("text-[10px] font-bold tabular-nums shrink-0 border", colorClass)}>
                          {row.turnover.toFixed(1).replace(".", ",")}×
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/70 pt-2 border-t mt-2">
                Encontros encerrados ÷ leitos do setor no período.
              </p>
            </CardContent>
          </Card>

          {/* Mortalidade */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Skull className="h-4 w-4 text-destructive" /> Mortalidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 pb-3 border-b mb-3">
                <span className="text-2xl font-bold text-destructive tabular-nums">{mortalityTotal}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  óbito{mortalityTotal === 1 ? "" : "s"} no período
                </span>
              </div>
              {mortalityTotal === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Heart className="h-8 w-8 text-emerald-500" />
                  <p className="text-xs text-muted-foreground text-center">
                    Nenhum óbito registrado no período.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {mortalityBySector.map(row => {
                    const maxDeaths = Math.max(...mortalityBySector.map(r => r.deaths), 1);
                    const pct = (row.deaths / maxDeaths) * 100;
                    return (
                      <div key={row.sector} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground truncate">{row.sector}</span>
                          <span className="tabular-nums shrink-0">
                            <span className="font-bold text-destructive">{row.deaths}</span>
                            <span className="text-muted-foreground"> · {row.rate.toFixed(0)}%</span>
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-destructive transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/70 pt-2 border-t mt-2">
                Óbitos por setor · % sobre movimentações do setor no período.
              </p>
            </CardContent>
          </Card>

          {/* Produção Médica */}
          <Card className="border-border/50 md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary" /> Ranking de Evoluções Clínicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {medicalProduction.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Sem evoluções registradas no período.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {medicalProduction.map((row, idx) => {
                    const leader = medicalProduction[0]?.count || 1;
                    const pct = (row.count / leader) * 100;
                    const isFirst = idx === 0;
                    return (
                      <div key={row.name} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
                        <span className={cn(
                          "text-[10px] font-bold tabular-nums w-6 text-center shrink-0",
                          isFirst ? "text-amber-500" : "text-muted-foreground",
                        )}>
                          {idx + 1}º
                        </span>
                        {isFirst && (
                          <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{row.name}</p>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                isFirst ? "bg-amber-500" : "bg-primary",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-foreground tabular-nums shrink-0">
                          {row.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/70 pt-2 border-t mt-2">
                Top 10 médicos por evoluções no período · {sectorDisplayName}.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pendências de Exames + Por Setor + Pacientes Regulados */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1 — Pendências de Exames */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" /> Pendências de Exames
                </span>
                <Badge variant="secondary" className="text-[10px] tabular-nums">{examPendingTotal}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 pb-3 border-b mb-3">
                <span className="text-2xl font-bold text-primary tabular-nums">{examPendingTotal}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  pendência{examPendingTotal === 1 ? "" : "s"}
                </span>
              </div>
              {examPending.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nenhuma pendência de exames no momento.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {examPending.map(row => {
                    const max = examPending[0]?.count || 1;
                    const pct = (row.count / max) * 100;
                    return (
                      <div key={row.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground truncate">{row.label}</span>
                          <span className="font-bold tabular-nums shrink-0" style={{ color: row.color }}>{row.count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: row.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/70 pt-2 border-t mt-2">
                Exames aguardando resultado · atualizado agora.
              </p>
            </CardContent>
          </Card>

          {/* Card 2 — Pendências por Setor */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Pendências por Setor
              </CardTitle>
            </CardHeader>
            <CardContent>
              {examPendingBySector.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Nenhuma pendência no setor selecionado.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {examPendingBySector.slice(0, 8).map(row => {
                    const CAT_META: Record<string, { label: string; color: string }> = {
                      laboratorio:    { label: "Lab",   color: "hsl(210, 80%, 55%)" },
                      imagem:         { label: "Img",   color: "hsl(280, 70%, 55%)" },
                      parecer:        { label: "Par",   color: "hsl(45, 90%, 50%)"  },
                      cultura:        { label: "Cult",  color: "hsl(142, 70%, 45%)" },
                      hemocomponente: { label: "Hemo",  color: "hsl(var(--destructive))" },
                      sat:            { label: "SAT",   color: "hsl(var(--muted-foreground))" },
                    };
                    return (
                      <div key={row.sector} className="px-2.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-foreground truncate">{row.sector}</p>
                          <Badge variant="secondary" className="text-[10px] tabular-nums shrink-0">{row.total}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(row.breakdown).map(([cat, n]) => {
                            const meta = CAT_META[cat] || { label: cat, color: "hsl(var(--primary))" };
                            return (
                              <span
                                key={cat}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border"
                                style={{ borderColor: meta.color, color: meta.color }}
                              >
                                {meta.label} <span className="tabular-nums font-bold">{n}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/70 pt-2 border-t mt-2">
                Top setores com pendências · breakdown por categoria.
              </p>
            </CardContent>
          </Card>

          {/* Card 3 — Pacientes Regulados */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" /> Pacientes Regulados
                </span>
                <Badge variant="secondary" className="text-[10px] tabular-nums">{regulatedPatients.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {regulatedPatients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground text-center">Nenhum paciente regulado no momento.</p>
                  <p className="text-[10px] text-muted-foreground/60 text-center">O módulo de regulação entrará em operação em breve.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {regulatedPatients.map(p => {
                    const isUrgent = /urg/i.test(p.priority);
                    return (
                      <div key={p.id} className="px-2.5 py-2 rounded-md border border-border/40 hover:bg-muted/40 transition-colors space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                          <Badge
                            variant={isUrgent ? "destructive" : "secondary"}
                            className="text-[9px] uppercase shrink-0"
                          >
                            {p.priority}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {[p.age, p.sex].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-foreground">
                          <span className="truncate">{p.origin}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate font-medium">{p.destination}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                            <Hourglass className="h-3 w-3" /> {p.waitHours}h em espera
                          </span>
                          <Badge variant="outline" className="text-[9px] uppercase">{p.status}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/70 pt-2 border-t mt-2">
                Solicitações de regulação ativas · ordenadas por antiguidade.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Previsão de Alta por Setor */}
        <Card className="border-border/50 w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <LogOut className="h-4 w-4 text-primary" /> Previsão de Alta por Setor
              </span>
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive inline-block" /> Vencida</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Hoje</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Amanhã</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Esta semana</span>
                </div>
                <Badge variant="secondary" className="text-[10px] tabular-nums">{dischargePreviews.length}</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dischargePreviews.length === 0 ? (
              <div className="text-center py-8">
                <LogOut className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs text-muted-foreground">Nenhuma previsão de alta registrada para os próximos dias.</p>
              </div>
            ) : (
              (() => {
                const bySector = dischargePreviews.reduce((acc, p) => {
                  if (!acc[p.sectorLabel]) acc[p.sectorLabel] = [];
                  acc[p.sectorLabel].push(p);
                  return acc;
                }, {} as Record<string, DischargePreviewItem[]>);

                const statusConfig: Record<DischargePreviewItem['status'], { label: string; bg: string; border: string; text: string; dot: string }> = {
                  overdue:   { label: 'VENCIDA',      bg: 'bg-destructive/10',  border: 'border-destructive/30',  text: 'text-destructive',   dot: 'bg-destructive'  },
                  today:     { label: 'HOJE',          bg: 'bg-amber-500/10',    border: 'border-amber-500/30',    text: 'text-amber-600',     dot: 'bg-amber-500'    },
                  tomorrow:  { label: 'AMANHÃ',        bg: 'bg-blue-500/10',     border: 'border-blue-500/30',     text: 'text-blue-600',      dot: 'bg-blue-500'     },
                  this_week: { label: 'ESTA SEMANA',   bg: 'bg-emerald-500/10',  border: 'border-emerald-500/30',  text: 'text-emerald-600',   dot: 'bg-emerald-500'  },
                  future:    { label: 'FUTURO',        bg: 'bg-muted/30',        border: 'border-border',          text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
                  unknown:   { label: 'SEM DATA',      bg: 'bg-muted/30',        border: 'border-border',          text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
                };

                return (
                  <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                    {Object.entries(bySector).map(([sector, items]) => (
                      <div key={sector}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{sector}</p>
                          <span className="text-[10px] text-muted-foreground/60">({items.length} paciente{items.length > 1 ? 's' : ''})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
                          {items.map(p => {
                            const cfg = statusConfig[p.status];
                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  "flex items-start gap-2 p-2.5 rounded-lg border transition-colors hover:opacity-90",
                                  cfg.bg, cfg.border
                                )}
                              >
                                <span className={cn("h-2 w-2 rounded-full mt-1 shrink-0", cfg.dot)} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-semibold text-foreground truncate">{p.name}</p>
                                  <p className="text-[10px] text-muted-foreground">Leito {p.bed}</p>
                                  <p className={cn("text-[10px] font-bold mt-0.5", cfg.text)}>
                                    {p.status === 'overdue'
                                      ? `⚠ ${format(p.dischargeDate!, "dd/MM", { locale: ptBR })} — VENCIDA`
                                      : p.dischargeDate
                                        ? format(p.dischargeDate, "dd/MM/yyyy", { locale: ptBR })
                                        : '—'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
            <p className="text-[10px] text-muted-foreground/70 pt-3 border-t mt-3">
              Previsões de alta registradas pela equipe médica · Vencidas = paciente ainda internado após a data prevista.
            </p>
          </CardContent>
        </Card>









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
              <TrendingUp className="h-4 w-4 text-primary" /> Tendência de Movimentações ({period === "today" ? "hoje" : period === "7d" ? "7 dias" : "30 dias"})
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
