import { useState, useEffect } from "react";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { format, subDays, startOfDay, formatDistanceToNow, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useSectorNavigation } from "@/hooks/useSectorNavigation";
import {
  Bed, Activity, AlertTriangle, Users, Clock, BarChart3, ArrowUpDown, HeartPulse,
  RefreshCw, Download, TrendingUp, TrendingDown, FileText,
  ShieldCheck, Loader2, LayoutGrid, Filter, Check, Building2,
  Hourglass, ArrowRight, Heart, Skull, LogOut, HelpCircle, Minus,
  Repeat, Trophy, Stethoscope, FlaskConical, Navigation,
} from "lucide-react";
import { PlatformHeader } from "@/components/layout/PlatformHeader";
import { GestorNotificationCenter } from "@/components/gestor/GestorNotificationCenter";
import { KpiDrillDownDialog, type DrillDownRow } from "@/components/gestor/KpiDrillDownDialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart,
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

// Normaliza o valor do filtro: "ALL" | nome real do setor. Valores legados da
// taxonomia antiga ("BLOCK:...") são degradados para "ALL".
function normalizeSectorFilter(raw: string | null | undefined): string {
  if (!raw || raw === "ALL" || raw.startsWith("BLOCK:")) return "ALL";
  return raw;
}

export default function GestorPanelPage() {
  const { currentHospital: selectedUnit } = useHospital();
  const isMobile = useIsMobile();
  const [sectorFilterOpen, setSectorFilterOpen] = useState(false);
  const { currentDepartment, setCurrentDepartment } = useDepartment();
  // Hierarquia de setores DIRETO DO BANCO (alas → setores), substitui a taxonomia
  // hardcoded (SECTOR_BLOCKS/DEPARTMENT_TO_SECTOR). Filtro e agregações "por setor"
  // passam a usar o NOME REAL do setor (setores.nome).
  const { groups: sectorGroups, loading: sectorsLoading } = useSectorNavigation();
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
  const [dischargeFilter, setDischargeFilter] = useState<DischargePreviewItem['status'] | 'all'>('all');
  // ── KPI deltas ──
  const [kpiDeltas, setKpiDeltas] = useState<Record<string, KpiDelta>>({});
  const [sectorFilter, setSectorFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "ALL";
    return normalizeSectorFilter(localStorage.getItem("gestor_sector_filter"));
  });

  // Sincroniza o filtro de setor com mudanças externas (sidebar/seletor) e
  // mantém alinhado ao currentDepartment do contexto.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("gestor_sector_filter") : null;
    setSectorFilter(normalizeSectorFilter(stored));
  }, [currentDepartment]);

  // ── Filter resolution: ALL | nome real do setor (setores.nome) ──
  const isAllSectors = sectorFilter === "ALL";
  /** Nome real do setor filtrado (setores.nome). null = sem filtro (ALL). */
  const filteredSectorName: string | null = isAllSectors ? null : sectorFilter;
  const sectorDisplayName = isAllSectors ? "Todos os setores" : sectorFilter;

  // ── Apply a new filter (ALL / nome real do setor) ──
  const applyFilter = (next: string) => {
    setSectorFilter(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("gestor_sector_filter", next);
    }
    if (next !== "ALL") {
      // Mantém alinhado ao seletor/sidebar, que usam setores.nome como department.
      try { setCurrentDepartment(next as any); } catch { /* noop */ }
    }
  };

  const fetchData = async () => {
    if (!selectedUnit) return;
    setLoading(true);

    try {
      const hospitalId = selectedUnit.id;
      const wantSector = filteredSectorName; // string | null (setores.nome)
      const inSector = (nome: string | undefined | null) =>
        !wantSector || (nome != null && nome === wantSector);

      // ── 1. Leitos + Internações ativas ──
      // MIGRAÇÃO: patients → internacoes(+leitos+setores+pacientes). Vínculo com o hospital:
      // leitos → setores → alas.hospital_id. setores.tipo guarda o código do setor.
      // Ocupação = internações ativas (data_alta IS NULL); leitos livres = leitos sem internação.
      const [{ data: leitosRaw }, { data: intRaw }] = await Promise.all([
        (supabase
          .from("leitos")
          .select("id, numero, status, tipo, setor:setores!inner ( nome, tipo, ala:alas!inner ( hospital_id ) )") as any)
          .eq("setor.ala.hospital_id", hospitalId),
        (supabase
          .from("internacoes")
          .select("id, leito_id, leito:leitos!inner ( numero, setor:setores!inner ( nome, tipo, ala:alas!inner ( hospital_id ) ) ), paciente:pacientes ( nome_completo, nome_social )") as any)
          .is("data_alta", null)
          .eq("leito.setor.ala.hospital_id", hospitalId),
      ]);

      const leitos = ((leitosRaw as any[]) || []).filter(l => inSector(l.setor?.nome));
      const activeInt = ((intRaw as any[]) || []).filter(i => inSector(i.leito?.setor?.nome));
      const occupiedLeitoIds = new Set(activeInt.map(i => i.leito_id));

      // Agregação por NOME REAL do setor (setores.nome). Total = leitos reais no
      // setor (contagem do banco); ocupados = internações ativas. Substitui a
      // capacidade fixa do bedNaming (sectorCapacity) pela contagem real.
      const bySector: Record<string, { total: number; occupied: number }> = {};
      leitos.forEach(l => {
        const nome = l.setor?.nome;
        if (!nome) return;
        if (!bySector[nome]) bySector[nome] = { total: 0, occupied: 0 };
        bySector[nome].total++;
      });
      activeInt.forEach(i => {
        const nome = i.leito?.setor?.nome;
        if (!nome) return;
        if (!bySector[nome]) bySector[nome] = { total: 0, occupied: 0 };
        bySector[nome].occupied++;
      });

      // Total de leitos = soma dos leitos reais dos setores presentes.
      const regularTotal = Object.values(bySector).reduce((sum, s) => sum + s.total, 0);

      const occupied = activeInt.map(i => ({
        id: i.id,
        name: i.paciente?.nome_social || i.paciente?.nome_completo || "",
        bed_number: i.leito?.numero || "",
        sector: i.leito?.setor?.nome || "",
        clinical_status: undefined as string | undefined, // MIGRAÇÃO: degradado
      }));
      const vacant = leitos
        .filter(l => !occupiedLeitoIds.has(l.id))
        .map(l => ({ id: l.id, bed_number: l.numero, sector: l.setor?.nome || "" }));

      // MIGRAÇÃO: is_door_patient degradado (sem coluna) → 0 pacientes porta.
      setBedStats({ total: regularTotal, occupied: occupied.length, vacant: vacant.length, doorPatients: 0, bySector });
      setOccupiedPatientsList(occupied);
      setVacantBedsList(vacant);
      setDoorPatientsList([]);

      // MIGRAÇÃO: alertas críticos dependiam de clinical_status / relevant_exams (degradados) → [].
      setCriticalAlerts([]);

      // MIGRAÇÃO: previsão de alta dependia de uti/hospital_discharge_prediction (degradados) → [].
      setDischargePreviews([]);

      // ── 2. Movimentações ──
      // MIGRAÇÃO: patient_movements não tem equivalente fiel (transferencias só modela
      // leito→leito; altas/óbitos não são eventos registrados). "Movimentações recentes" → [].
      setRecentMovements([]);

      const periodDays = period === "today" ? 1 : period === "7d" ? 7 : 30;
      const periodStart = startOfDay(subDays(new Date(), periodDays - 1));

      // Tendência: apenas ADMISSÕES são reais (internacoes.data_entrada). Altas/óbitos/
      // transferências dependiam de patient_movements → permanecem 0 (degradado).
      const trend: Record<string, { altas: number; admissoes: number; transferencias: number; obitos: number }> = {};
      for (let i = periodDays - 1; i >= 0; i--) {
        const day = format(subDays(new Date(), i), "dd/MM", { locale: ptBR });
        trend[day] = { altas: 0, admissoes: 0, transferencias: 0, obitos: 0 };
      }
      const { data: admRaw } = await (supabase
        .from("internacoes")
        .select("id, data_entrada, leito:leitos!inner ( setor:setores!inner ( nome, tipo, ala:alas!inner ( hospital_id ) ) )") as any)
        .gte("data_entrada", periodStart.toISOString())
        .eq("leito.setor.ala.hospital_id", hospitalId);
      ((admRaw as any[]) || [])
        .filter(a => inSector(a.leito?.setor?.nome))
        .forEach(a => {
          const day = format(new Date(a.data_entrada), "dd/MM", { locale: ptBR });
          if (trend[day]) trend[day].admissoes++;
        });
      setMovementTrend(Object.entries(trend).map(([day, vals]) => ({ day, ...vals })));

      // ── 3. Medication catalog count ──
      // MIGRAÇÃO: medication_catalog → catalogo_medicamentos (catálogo global, sem filtro de hospital).
      const { count } = await supabase.from("catalogo_medicamentos").select("id", { count: "exact", head: true });
      setMedicationCount(count || 0);

      // ── 4. Solicitações de leito pendentes (detalhe p/ drill-down) ──
      // MIGRAÇÃO: bed_allocation_requests → solicitacoes_leito. Sem requested_bed nem
      // requesting_doctor_name no schema novo → degradados. Setor solicitado vem de
      // setor_solicitado_id; paciente/leito de origem via internacao.
      const { data: solRaw } = await (supabase
        .from("solicitacoes_leito")
        .select("id, status, data_hora, setor_solicitado:setores!inner ( nome, tipo, ala:alas!inner ( hospital_id ) ), internacao:internacoes ( paciente:pacientes ( nome_completo, nome_social ), leito:leitos ( numero ) )") as any)
        .eq("setor_solicitado.ala.hospital_id", hospitalId)
        .order("data_hora", { ascending: false });
      const pendData = ((solRaw as any[]) || [])
        .filter(s => /pend/i.test(s.status || "") && inSector(s.setor_solicitado?.nome))
        .map(s => ({
          id: s.id,
          requested_sector: s.setor_solicitado?.nome || "",
          requested_bed: null as string | null, // MIGRAÇÃO: degradado
          requesting_doctor_name: null as string | null, // MIGRAÇÃO: degradado
          created_at: s.data_hora,
          patient: {
            name: s.internacao?.paciente?.nome_social || s.internacao?.paciente?.nome_completo || "",
            bed_number: s.internacao?.leito?.numero || "",
            sector: s.setor_solicitado?.tipo || "",
          },
        }));
      setPendingRequests(pendData.length);
      setPendingRequestsList(pendData);

      // ── 5. Prescrições & validações ──
      // MIGRAÇÃO: prescriptions → prescricoes (sem patient_name/patient_bed/department).
      // Total por hospital via internacao → leito → setor → ala. Lista de drill-down e
      // a quebra de validação (validacoes_prescricao sem hospital) foram degradadas.
      const { count: prescCount } = await (supabase
        .from("prescricoes")
        .select("id, internacao:internacoes!inner ( leito:leitos!inner ( setor:setores!inner ( ala:alas!inner ( hospital_id ) ) ) )", { count: "exact", head: true }) as any)
        .eq("internacao.leito.setor.ala.hospital_id", hospitalId);
      setPrescriptionsList([]);
      setPrescriptionStats({ total: prescCount || 0, validated: 0, pending: 0, rejected: 0 });

      // ── 6. TMP (Tempo Médio de Permanência) ──
      // MIGRAÇÃO: patient_encounters → internacoes. LOS = data_alta − data_entrada das
      // internações com alta no período. Setor via leito → setor.nome (nome real).
      const tmpStartIso = startOfDay(subDays(new Date(), periodDays - 1)).toISOString();
      const { data: dischRaw } = await (supabase
        .from("internacoes")
        .select("id, data_entrada, data_alta, leito:leitos!inner ( setor:setores!inner ( nome, tipo, ala:alas!inner ( hospital_id ) ) )") as any)
        .not("data_alta", "is", null)
        .gte("data_alta", tmpStartIso)
        .eq("leito.setor.ala.hospital_id", hospitalId);
      const encs = ((dischRaw as any[]) || []).filter(e => inSector(e.leito?.setor?.nome));
      const losDays: number[] = [];
      const bySectorLos: Record<string, number[]> = {};
      encs.forEach((e: any) => {
        if (!e.data_entrada || !e.data_alta) return;
        const ms = new Date(e.data_alta).getTime() - new Date(e.data_entrada).getTime();
        if (ms <= 0) return;
        const days = ms / (1000 * 60 * 60 * 24);
        if (days > 365) return; // descarta outlier
        losDays.push(days);
        const sec = e.leito?.setor?.nome || "—";
        if (!bySectorLos[sec]) bySectorLos[sec] = [];
        bySectorLos[sec].push(days);
      });
      const avg = losDays.length > 0 ? losDays.reduce((a, b) => a + b, 0) / losDays.length : 0;
      setTmpOverall({ avgDays: avg, samples: losDays.length });
      setTmpBySector(
        Object.entries(bySectorLos)
          .map(([sector, arr]) => ({
            sector, // nome real do setor
            avgDays: arr.reduce((a, b) => a + b, 0) / arr.length,
            samples: arr.length,
          }))
          .sort((a, b) => b.avgDays - a.avgDays),
      );

      // ── 7. Desfechos (período) ──
      // MIGRAÇÃO: dependia de patient_movements (tipo de desfecho: alta/óbito/transf/evasão),
      // que não existe. internacoes.data_alta não distingue o tipo de desfecho → tudo 0.
      setOutcomesTotal(0);
      setOutcomes([
        { key: "alta", label: "Alta", count: 0, color: "hsl(142, 70%, 45%)", icon: Heart },
        { key: "obito", label: "Óbito", count: 0, color: "hsl(var(--destructive))", icon: Skull },
        { key: "transf", label: "Transf. Externa", count: 0, color: "hsl(45, 90%, 50%)", icon: ArrowRight },
        { key: "evasao", label: "Evasão", count: 0, color: "hsl(280, 70%, 55%)", icon: LogOut },
        { key: "outros", label: "Outros", count: 0, color: "hsl(var(--muted-foreground))", icon: HelpCircle },
      ]);

      // ── 8b. Giro de Leito (internações encerradas / leitos no setor) ──
      // MIGRAÇÃO: encontros agora vêm de internacoes (encs). Leitos por setor usam o
      // bySector já calculado (leitos reais do banco), keyado por setor.nome.
      const encsBySector: Record<string, number> = {};
      encs.forEach((e: any) => {
        const nome = e.leito?.setor?.nome || "—";
        encsBySector[nome] = (encsBySector[nome] || 0) + 1;
      });
      const turnoverRows: BedTurnoverItem[] = Object.entries(encsBySector)
        .map(([nome, count]) => {
          const beds = bySector[nome]?.total || 0;
          return {
            sector: nome, // nome real do setor
            encounters: count,
            beds,
            turnover: beds > 0 ? count / beds : 0,
          };
        })
        .filter(r => r.encounters > 0)
        .sort((a, b) => b.encounters - a.encounters);
      setBedTurnover(turnoverRows);
      const totalEncsTurn = turnoverRows.reduce((acc, r) => acc + r.encounters, 0);
      const totalBedsTurn = turnoverRows.filter(r => r.beds > 0).reduce((acc, r) => acc + r.beds, 0);
      setBedTurnoverAvg(totalBedsTurn > 0 ? totalEncsTurn / totalBedsTurn : 0);

      // ── 8c. Mortalidade por setor (período) ──
      // MIGRAÇÃO: óbitos vinham de patient_movements (movement_type ÓBITO), sem equivalente
      // no schema novo (internacoes.data_alta não distingue óbito) → vazio.
      setMortalityBySector([]);
      setMortalityTotal(0);

      // ── 8d. Ranking de Produção Médica ──
      // MIGRAÇÃO: clinical_evolutions → evolucoes, que não tem created_by_name nem department
      // (só profissional_id). Ranking por nome do médico degradado → vazio.
      setMedicalProduction([]);


      // ── 8e. Pendências de Exames (categoria + por setor) ──
      // MIGRAÇÃO: exam_requests → solicitacoes_exame. category→categoria; o setor vem de
      // internacao → leito → setor (não há mais coluna department). status pendente via /pend/i.
      const { data: examRaw } = await (supabase
        .from("solicitacoes_exame")
        .select("id, categoria, status, prioridade, internacao:internacoes!inner ( leito:leitos!inner ( setor:setores!inner ( nome, tipo, ala:alas!inner ( hospital_id ) ) ) )") as any)
        .eq("internacao.leito.setor.ala.hospital_id", hospitalId);
      const examData = ((examRaw as any[]) || [])
        .filter(e => /pend/i.test(e.status || "") && inSector(e.internacao?.leito?.setor?.nome));

      const catMap: Record<string, number> = {};
      const sectorMap: Record<string, Record<string, number>> = {};
      examData.forEach((e: any) => {
        catMap[e.categoria] = (catMap[e.categoria] || 0) + 1;
        const sec = e.internacao?.leito?.setor?.nome || "—";
        if (!sectorMap[sec]) sectorMap[sec] = {};
        sectorMap[sec][e.categoria] = (sectorMap[sec][e.categoria] || 0) + 1;
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
      // MIGRAÇÃO: regulation_requests → regulacoes. Nome via internacao→paciente; origem via
      // internacao→leito→setor; destino = unidade_destino. patient_age/patient_sex e
      // destination_sector não existem no schema novo → degradados.
      const { data: regulRaw } = await (supabase
        .from("regulacoes")
        .select("id, tipo_solicitacao, status, prioridade, unidade_destino, data_hora, internacao:internacoes!inner ( paciente:pacientes ( nome_completo, nome_social ), leito:leitos!inner ( setor:setores!inner ( nome, tipo, ala:alas!inner ( hospital_id ) ) ) )") as any)
        .eq("internacao.leito.setor.ala.hospital_id", hospitalId)
        .order("data_hora", { ascending: true });
      const regulData = ((regulRaw as any[]) || [])
        .filter(r => !/(conclu|cancel|complet)/i.test(r.status || "") && inSector(r.internacao?.leito?.setor?.nome));
      setRegulatedPatients(
        regulData.map((r: any) => ({
          id: r.id,
          name: r.internacao?.paciente?.nome_social || r.internacao?.paciente?.nome_completo || "—",
          age: null, // MIGRAÇÃO: degradado (sem patient_age)
          sex: null, // MIGRAÇÃO: degradado (sem patient_sex)
          origin: r.internacao?.leito?.setor?.nome || "—",
          destination: r.unidade_destino || "—",
          priority: r.prioridade || "—",
          status: r.status || "—",
          waitHours: Math.floor((Date.now() - new Date(r.data_hora).getTime()) / 3_600_000),
          createdAt: r.data_hora,
        }))
      );




      // ── 8. KPI deltas (tendência) ──
      // MIGRAÇÃO: os deltas de ocupação/leitos/porta vinham do balanço de patient_movements
      // (admissões − altas − óbitos − transf.) das últimas 24h, e os de prescrições/solicitações
      // de contagens semanais em prescriptions/bed_allocation_requests. Sem base fiel de
      // movimentação, todos os deltas são degradados para placeholders neutros.
      setKpiDeltas({
        occupancy: { value: 0, display: "—", trend: "flat", goodIsDown: true, hint: "—" },
        vacant: { value: 0, display: "—", trend: "flat", hint: "—" },
        door: { value: 0, display: "—", trend: "flat", goodIsDown: true, hint: "—" },
        alerts: { value: 0, display: "—", trend: "flat", hint: "tempo real" },
        prescriptions: { value: 0, display: "—", trend: "flat", hint: "—" },
        requests: { value: 0, display: "—", trend: "flat", goodIsDown: true, hint: "—" },
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
    sector, // nome real do setor
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
      secondary: `LEITO ${p.bed_number} • ${p.sector}`,
      badge: p.clinical_status ? { label: String(p.clinical_status).toUpperCase(), variant: ["gravíssimo", "grave", "crítico"].includes(p.clinical_status) ? "destructive" : "secondary" } : undefined,
    })),
    vacant: vacantBedsList.map(p => ({
      id: p.id,
      primary: `LEITO ${p.bed_number}`,
      secondary: p.sector,
      badge: { label: "VAGO", variant: "outline" },
    })),
    door: doorPatientsList.map(p => ({
      id: p.id,
      primary: p.name || "(SEM NOME)",
      secondary: `LEITO PORTA ${p.bed_number} • ${p.sector}`,
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
        hideSidebarTrigger
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
        {(() => {
          const filterTrigger = (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 w-full sm:w-auto justify-start"
              onClick={() => setSectorFilterOpen(true)}
            >
              <Filter className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold truncate">{sectorDisplayName}</span>
            </Button>
          );

          const filterBody = (
            <div className="p-2.5 space-y-3">
              {/* All sectors */}
              <button
                type="button"
                onClick={() => { applyFilter("ALL"); setSectorFilterOpen(false); }}
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

              {/* Alas + setores reais (useSectorNavigation) */}
              {sectorsLoading ? (
                <p className="text-[11px] text-muted-foreground text-center py-4">
                  Carregando setores…
                </p>
              ) : sectorGroups.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-4">
                  Nenhum setor cadastrado para esta unidade.
                </p>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 px-1">
                    Setores por ala
                  </p>
                  {sectorGroups.map(group => {
                    const groupHasActiveChild = group.sectors.some(s => s.name === sectorFilter);
                    const groupTotals = group.sectors.reduce(
                      (acc, s) => {
                        const stat = bedStats.bySector[s.name];
                        if (stat) {
                          acc.total += stat.total;
                          acc.occupied += stat.occupied;
                        }
                        return acc;
                      },
                      { total: 0, occupied: 0 }
                    );
                    return (
                      <div
                        key={group.group}
                        className={cn(
                          "rounded-md border-l-2 pl-2.5 pr-1 py-1 transition-colors",
                          groupHasActiveChild
                            ? "border-primary bg-primary/5"
                            : "border-border/40 hover:border-border"
                        )}
                      >
                        <div className="w-full flex items-center justify-between gap-2 px-1.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/90">
                          <span className="flex items-center gap-1.5">
                            <span>{group.group}</span>
                            {groupTotals.total > 0 && (
                              <span className="text-[9px] font-semibold text-muted-foreground/70 tabular-nums normal-case tracking-normal">
                                · {groupTotals.occupied}/{groupTotals.total}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-0.5 pb-1">
                          {group.sectors.map(sector => {
                            const name = sector.name;
                            const isActive = sectorFilter === name;
                            const stat = bedStats.bySector[name];
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => { applyFilter(name); setSectorFilterOpen(false); }}
                                className={cn(
                                  "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all text-left border",
                                  isActive
                                    ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                                    : "text-foreground hover:bg-muted border-transparent"
                                )}
                              >
                                <span className="truncate">{name}</span>
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
              )}
            </div>
          );

          return (
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground shrink-0">Filtro:</span>
                <div className="flex-1 sm:flex-initial">
                  {isMobile ? (
                    <>
                      {filterTrigger}
                      <Sheet open={sectorFilterOpen} onOpenChange={setSectorFilterOpen}>
                        <SheetContent side="bottom" className="p-0 max-h-[85vh] flex flex-col rounded-t-2xl">
                          <div className="flex justify-center pt-2 pb-1 shrink-0">
                            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
                          </div>
                          <SheetHeader className="px-4 pb-3 border-b border-border/60 shrink-0">
                            <SheetTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-left flex items-center justify-between">
                              <span>Filtrar painel</span>
                              <span className="text-[10px] font-medium text-muted-foreground/70 tabular-nums normal-case tracking-normal">
                                {bedStats.total} leitos
                              </span>
                            </SheetTitle>
                          </SheetHeader>
                          <div className="flex-1 overflow-y-auto overscroll-contain">
                            {filterBody}
                          </div>
                        </SheetContent>
                      </Sheet>
                    </>
                  ) : (
                    <Popover open={sectorFilterOpen} onOpenChange={setSectorFilterOpen}>
                      <PopoverTrigger asChild>{filterTrigger}</PopoverTrigger>
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
                        <div className="h-[70vh] overflow-y-auto">
                          {filterBody}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
              {/* Period selector */}
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-1 w-full sm:w-auto">
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
                      "flex-1 sm:flex-initial px-3 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-all",
                      period === opt.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}


        {/* KPI Cards (clicáveis para drill-down) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3">
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
                    <CardContent className="p-2.5 md:p-3.5">
                      <div className="flex items-start justify-between mb-1.5 md:mb-2">
                        <div className={cn("h-7 w-7 md:h-8 md:w-8 rounded-lg flex items-center justify-center", kpi.bg)}>
                          <kpi.icon className={cn("h-3.5 w-3.5 md:h-4 md:w-4", kpi.color)} />
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
                      <p className="text-lg md:text-2xl font-bold text-foreground leading-tight truncate">{kpi.value}</p>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5 line-clamp-2">{kpi.title}</p>
                      <p className="text-[9px] text-muted-foreground/70 truncate">{kpi.sub}</p>
                      {delta?.hint && delta.display !== "—" && (
                        <p className="hidden md:block text-[9px] text-muted-foreground/50 mt-0.5">{delta.hint}</p>
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
                      row.beds === 0
                        ? "bg-muted text-muted-foreground border-border"
                        : row.turnover >= 2
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : row.turnover >= 1
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-muted text-muted-foreground border-border";
                    const displayTurnover = row.beds > 0
                      ? `${row.turnover.toFixed(1).replace(".", ",")}×`
                      : `${row.encounters} enc.`;
                    return (
                      <div key={row.sector} className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{row.sector}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {row.encounters} altas · {row.beds > 0 ? `${row.beds} leitos` : "sem leitos mapeados"}
                          </p>
                        </div>
                        <Badge variant={variant} className={cn("text-[10px] font-bold tabular-nums shrink-0 border", colorClass)}>
                          {displayTurnover}
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
              <Badge variant="secondary" className="text-[10px] tabular-nums">{dischargePreviews.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const statusConfig: Record<DischargePreviewItem['status'], { label: string; bg: string; border: string; text: string; dot: string; solidBg: string; solidText: string; activeBorder: string }> = {
                overdue:   { label: 'VENCIDA',    bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive',      dot: 'bg-destructive',      solidBg: 'bg-destructive',   solidText: 'text-destructive-foreground', activeBorder: 'border-destructive' },
                today:     { label: 'HOJE',       bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-600',        dot: 'bg-amber-500',        solidBg: 'bg-amber-500',     solidText: 'text-white',                  activeBorder: 'border-amber-500' },
                tomorrow:  { label: 'AMANHÃ',     bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-600',         dot: 'bg-blue-500',         solidBg: 'bg-blue-500',      solidText: 'text-white',                  activeBorder: 'border-blue-500' },
                this_week: { label: 'ESTA SEMANA',bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600',      dot: 'bg-emerald-500',      solidBg: 'bg-emerald-500',   solidText: 'text-white',                  activeBorder: 'border-emerald-500' },
                future:    { label: 'FUTURO',     bg: 'bg-muted/30',       border: 'border-border',         text: 'text-muted-foreground', dot: 'bg-muted-foreground', solidBg: 'bg-muted-foreground', solidText: 'text-background',          activeBorder: 'border-muted-foreground' },
                unknown:   { label: 'SEM DATA',   bg: 'bg-muted/30',       border: 'border-border',         text: 'text-muted-foreground', dot: 'bg-muted-foreground', solidBg: 'bg-muted-foreground', solidText: 'text-background',          activeBorder: 'border-muted-foreground' },
              };

              const counts = dischargePreviews.reduce((acc, p) => {
                acc[p.status] = (acc[p.status] || 0) + 1;
                return acc;
              }, {} as Record<DischargePreviewItem['status'], number>);

              const filterButtons: { key: DischargePreviewItem['status'] | 'all'; label: string; count: number; activeBg: string; activeText: string; idleBorder: string; idleText: string; dot?: string }[] = [
                { key: 'all',       label: 'Todos',       count: dischargePreviews.length, activeBg: 'bg-primary',     activeText: 'text-primary-foreground',      idleBorder: 'border-primary/40',     idleText: 'text-primary' },
                { key: 'overdue',   label: 'Vencida',     count: counts.overdue   || 0,    activeBg: 'bg-destructive', activeText: 'text-destructive-foreground',  idleBorder: 'border-destructive/40', idleText: 'text-destructive',   dot: 'bg-destructive' },
                { key: 'today',     label: 'Hoje',        count: counts.today     || 0,    activeBg: 'bg-amber-500',   activeText: 'text-white',                   idleBorder: 'border-amber-500/40',   idleText: 'text-amber-600',     dot: 'bg-amber-500' },
                { key: 'tomorrow',  label: 'Amanhã',      count: counts.tomorrow  || 0,    activeBg: 'bg-blue-500',    activeText: 'text-white',                   idleBorder: 'border-blue-500/40',    idleText: 'text-blue-600',      dot: 'bg-blue-500' },
                { key: 'this_week', label: 'Esta semana', count: counts.this_week || 0,    activeBg: 'bg-emerald-500', activeText: 'text-white',                   idleBorder: 'border-emerald-500/40', idleText: 'text-emerald-600',   dot: 'bg-emerald-500' },
              ];

              const filteredDischarges = dischargeFilter === 'all'
                ? dischargePreviews
                : dischargePreviews.filter(p => p.status === dischargeFilter);

              const bySector = filteredDischarges.reduce((acc, p) => {
                if (!acc[p.sectorLabel]) acc[p.sectorLabel] = [];
                acc[p.sectorLabel].push(p);
                return acc;
              }, {} as Record<string, DischargePreviewItem[]>);

              const emptyLabel =
                dischargeFilter === 'overdue'   ? 'com alta vencida' :
                dischargeFilter === 'today'     ? 'com alta prevista para hoje' :
                dischargeFilter === 'tomorrow'  ? 'com alta para amanhã' :
                dischargeFilter === 'this_week' ? 'com alta nesta semana' :
                'nessa categoria';

              return (
                <>
                  {/* Filter buttons */}
                  <div className="flex overflow-x-auto gap-2 pb-2 mb-3 -mx-1 px-1 scrollbar-thin">
                    {filterButtons.map(btn => {
                      const isActive = dischargeFilter === btn.key;
                      return (
                        <button
                          key={btn.key}
                          type="button"
                          onClick={() => setDischargeFilter(isActive && btn.key !== 'all' ? 'all' : btn.key)}
                          className={cn(
                            "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all whitespace-nowrap",
                            isActive
                              ? cn(btn.activeBg, btn.activeText, "border-transparent shadow-sm")
                              : cn("bg-transparent", btn.idleBorder, btn.idleText, "hover:bg-muted/50")
                          )}
                        >
                          {btn.dot && (
                            <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-white/90" : btn.dot)} />
                          )}
                          <span className="uppercase tracking-wide">{btn.label}</span>
                          <span className="tabular-nums font-bold">{btn.count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {dischargePreviews.length === 0 ? (
                    <div className="text-center py-8">
                      <LogOut className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-xs text-muted-foreground">Nenhuma previsão de alta registrada para os próximos dias.</p>
                    </div>
                  ) : filteredDischarges.length === 0 ? (
                    <div className="flex flex-col items-center py-10 gap-2">
                      <Check className="h-8 w-8 text-emerald-500 opacity-60" />
                      <p className="text-sm font-medium text-muted-foreground">
                        Nenhum paciente {emptyLabel}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                      {Object.entries(bySector).map(([sector, items]) => (
                        <div key={sector}>
                          <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-1 rounded-full bg-primary" />
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">{sector}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px]">{items.length} paciente{items.length > 1 ? 's' : ''}</Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {items.map(p => {
                              const cfg = statusConfig[p.status];
                              return (
                                <div
                                  key={p.id}
                                  className={cn(
                                    "rounded-xl border p-3 flex flex-col gap-1 transition-all hover:shadow-md",
                                    cfg.bg, cfg.border
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", cfg.dot)} />
                                    <p className="text-[12px] font-bold text-foreground leading-tight uppercase truncate">{p.name}</p>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground pl-4">Leito {p.bed}</p>
                                  <div className="flex items-center gap-2 pl-4 pt-0.5">
                                    <span className={cn("text-[11px] font-bold", cfg.text)}>
                                      {p.status === 'overdue'
                                        ? `⚠ ${format(p.dischargeDate!, "dd/MM", { locale: ptBR })} — VENCIDA`
                                        : p.dischargeDate
                                          ? format(p.dischargeDate, "dd/MM/yyyy", { locale: ptBR })
                                          : '—'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
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
                <>
                  {/* Mobile: numeric fallback */}
                  <div className="sm:hidden flex flex-col items-center py-4">
                    <span className="text-4xl font-bold text-primary tabular-nums">{occupancyRate}%</span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">ocupação</span>
                    <span className="text-[10px] text-muted-foreground/70 mt-2">
                      {bedStats.occupied} ocupados · {bedStats.vacant} vagos
                    </span>
                  </div>
                  {/* Desktop: donut */}
                  <div className="relative hidden sm:block">
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
                </>
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
                <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
                  <BarChart data={sectorBarData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="sector" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    {!isMobile && <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />}
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
            <ResponsiveContainer width="100%" height={isMobile ? 160 : 220}>
              <AreaChart data={movementTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Area type="monotone" dataKey="admissoes" name="Admissões" stroke="hsl(210, 80%, 55%)" fill="hsl(210, 80%, 55%)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="altas" name="Altas" stroke="hsl(142, 70%, 45%)" fill="hsl(142, 70%, 45%)" fillOpacity={0.15} strokeWidth={2} />
                {!isMobile && <Area type="monotone" dataKey="transferencias" name="Transferências" stroke="hsl(45, 90%, 50%)" fill="hsl(45, 90%, 50%)" fillOpacity={0.1} strokeWidth={2} />}
                {!isMobile && <Area type="monotone" dataKey="obitos" name="Óbitos" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} strokeWidth={2} />}
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
                        <p className="text-[10px] text-muted-foreground">{getSectorDisplayLabel(alert.sector) || alert.sector} · L{alert.bed} — {alert.detail}</p>
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
                      <Badge variant="outline" className="hidden sm:flex text-[9px] shrink-0">{getSectorDisplayLabel(mov.patient_sector)} · {mov.patient_bed}</Badge>
                      <span className="hidden sm:inline text-[9px] text-muted-foreground shrink-0">
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
