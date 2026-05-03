import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, startOfDay, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity, BedDouble, Clock, FileText, Users, AlertTriangle,
  PhoneOutgoing, RefreshCw, ArrowRight, Loader2, ListTodo, History,
  CheckCircle2, XCircle, UserPlus, Play, FileWarning, UserX,
  Footprints, Ambulance, Trophy, Timer, UserCheck, Printer, MoreVertical,
  CalendarRange, Siren, Volume2,
} from "lucide-react";
import { toast } from "sonner";
import type { ReceptionPoint } from "@/hooks/useReceptionPost";
import { RECEPTION_POINT_SHORT } from "@/hooks/useReceptionPost";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { printWristband } from "./PatientWristband";
import { CompletePatientDataDialog } from "./CompletePatientDataDialog";
import { PromoteNiDialog } from "./PromoteNiDialog";
import { UserStatsPanel } from "./UserStatsPanel";
import { SlaBadge } from "@/components/sla/SlaBadge";

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "warn" | "success" | "info";
}

const toneMap = {
  default: "bg-primary/10 text-primary",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

function KpiCard({ icon: Icon, label, value, hint, tone = "default" }: KpiCardProps) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", toneMap[tone])}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-bold leading-tight">{value}</p>
            {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DailyEncounter {
  id: string;
  encounter_code: string;
  patient_name: string;
  registry_id: string | null;
  destination_sector: string | null;
  triage_status: string | null;
  status: string;
  created_at: string;
  created_by: string | null;
  reception_point: ReceptionPoint | null;
  // Enriquecido a partir de patient_registry
  documents_pending?: boolean;
  partial_identification?: boolean;
  is_unidentified?: boolean;
}

interface PendingAdmission {
  id: string;
  patient_name: string;
  destination_sector: string;
  status: string;
  created_at: string;
  notes: string | null;
}

interface ReceptionAction {
  table_name: string;
  action: string;
  record_id: string | null;
  created_at: string;
  new_data: any;
  user_id: string | null;
}

interface DeskSession {
  id: string;
  user_id: string;
  user_name: string | null;
  reception_point: ReceptionPoint;
  started_at: string;
  ended_at: string | null;
  last_heartbeat_at: string;
}

interface UserStats {
  userId: string;
  userName: string;
  point: ReceptionPoint | null;
  totalEncounters: number;
  expressCount: number;
  pendingDocsCount: number;
  destinationCounts: Record<string, number>;
  avgRegistrationSec: number | null;
  activeMinutes: number;
  isOnline: boolean;
}

interface Props {
  /** Quando usuário clica em "Reatender" / "Selecionar paciente" */
  onPickRegistry: (registryId: string, patientName: string) => void;
  /** Quando usuário clica em "Triagem Express" */
  onTriageExpress: () => void;
  /** Abre cadastro de novo prontuário */
  onNewRegistration: () => void;
  /** Sub-tab inicial: "dia" | "aguardando" | "minhas" | "equipe" */
  defaultSubTab?: "dia" | "aguardando" | "minhas" | "equipe";
  /** Esconde botões de ação rápida (quando o pai já tem) */
  hideQuickActions?: boolean;
  /** Posto atual do recepcionista logado (para destacar suas ações) */
  currentPoint?: ReceptionPoint | null;
}

/**
 * Painel diário da recepção — exibido na aba "Início" antes da busca.
 * - 4 KPIs do balcão hoje
 * - Atendimentos do Dia (abertos pela recepção)
 * - Aguardando Admissão (pacientes direcionados ainda sem leito)
 * - Histórico de ações do recepcionista logado (24h)
 */
export function ReceptionDailyDashboard({
  onPickRegistry,
  onTriageExpress,
  onNewRegistration,
  defaultSubTab = "dia",
  hideQuickActions = false,
  currentPoint = null,
}: Props) {
  const { currentHospital } = useHospital();
  const { user } = useAuth();
  const hospitalId = currentHospital?.id;

  const [loading, setLoading] = useState(false);
  const [todayEncounters, setTodayEncounters] = useState<DailyEncounter[]>([]);
  const [pendingAdmissions, setPendingAdmissions] = useState<PendingAdmission[]>([]);
  const [myActions, setMyActions] = useState<ReceptionAction[]>([]);
  const [allActionsToday, setAllActionsToday] = useState<ReceptionAction[]>([]);
  const [deskSessions, setDeskSessions] = useState<DeskSession[]>([]);
  const [monthRegistrations, setMonthRegistrations] = useState(0);

  // Filtro por posto: "all" | "vertical" | "horizontal"
  const [pointFilter, setPointFilter] = useState<"all" | ReceptionPoint>("all");
  // Filtro de período
  const [periodFilter, setPeriodFilter] = useState<"today" | "7d" | "30d">("today");

  // Dialogs auxiliares
  const [completeTarget, setCompleteTarget] = useState<{ registryId: string; name: string } | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<{ registryId: string; code: string | null; name: string } | null>(null);

  // Tracking de Sala Vermelha — para tocar som ao chegar paciente novo
  const { playNotificationSound } = useNotificationSound();
  const seenRedRoomIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  const periodStart = useMemo(() => {
    if (periodFilter === "today") return startOfDay(new Date()).toISOString();
    if (periodFilter === "7d") return startOfDay(subDays(new Date(), 6)).toISOString();
    return startOfDay(subDays(new Date(), 29)).toISOString();
  }, [periodFilter]);

  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const monthStart = useMemo(() => startOfMonth(new Date()).toISOString(), []);

  const fetchAll = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const [encRes, paRes, regRes, auditRes, allAuditRes, sessRes] = await Promise.all([
        supabase
          .from("patient_encounters")
          .select("id, encounter_code, patient_name, registry_id, destination_sector, triage_status, status, created_at, created_by, reception_point")
          .eq("hospital_unit_id", hospitalId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: false }),
        supabase
          .from("pre_admissions" as any)
          .select("id, patient_name, destination_sector, status, created_at, notes")
          .eq("hospital_unit_id", hospitalId)
          .eq("status", "aguardando_leito")
          .gte("created_at", todayStart)
          .order("created_at", { ascending: false }),
        supabase
          .from("patient_registry")
          .select("id", { count: "exact", head: true })
          .eq("hospital_unit_id", hospitalId)
          .gte("created_at", monthStart)
          .is("merged_into_registry_id", null),
        user?.id
          ? supabase
              .from("audit_logs")
              .select("table_name, action, record_id, created_at, new_data, user_id")
              .eq("user_id", user.id)
              .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
              .in("table_name", ["patient_registry", "patient_encounters", "pre_admissions"])
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [], error: null } as any),
        // Todas ações da equipe HOJE (para painel "Por usuário")
        supabase
          .from("audit_logs")
          .select("table_name, action, record_id, created_at, new_data, user_id, user_email")
          .eq("hospital_unit_id", hospitalId)
          .gte("created_at", todayStart)
          .in("table_name", ["patient_registry", "patient_encounters"])
          .order("created_at", { ascending: false })
          .limit(500),
        // Sessões de posto da equipe (hoje)
        supabase
          .from("reception_desk_sessions" as any)
          .select("id, user_id, user_name, reception_point, started_at, ended_at, last_heartbeat_at")
          .eq("hospital_unit_id", hospitalId)
          .gte("started_at", todayStart)
          .order("started_at", { ascending: false }),
      ]);

      if (encRes.error) throw encRes.error;
      const baseEncounters = (encRes.data as DailyEncounter[]) || [];

      // Enriquece com features de pendência via patient_registry
      const registryIds = Array.from(new Set(baseEncounters.map((e) => e.registry_id).filter(Boolean))) as string[];
      let regMap: Record<string, { documents_pending?: boolean; partial_identification?: boolean; is_unidentified?: boolean }> = {};
      if (registryIds.length > 0) {
        const { data: regs } = await supabase
          .from("patient_registry")
          .select("id, is_unidentified, unidentified_features")
          .in("id", registryIds);
        (regs as any[] | null)?.forEach((r) => {
          const feats = (r.unidentified_features as any) || {};
          regMap[r.id] = {
            is_unidentified: r.is_unidentified,
            documents_pending: Boolean(feats.documents_pending),
            partial_identification: Boolean(feats.partial_identification),
          };
        });
      }
      const enriched = baseEncounters.map((e) => ({
        ...e,
        ...(e.registry_id ? regMap[e.registry_id] || {} : {}),
      }));
      setTodayEncounters(enriched);
      setPendingAdmissions((paRes.data as any[]) || []);
      setMonthRegistrations(regRes.count || 0);
      setMyActions((auditRes.data as ReceptionAction[]) || []);
      setAllActionsToday((allAuditRes.data as ReceptionAction[]) || []);
      setDeskSessions((sessRes.data as any[]) || []);
    } catch (err: any) {
      console.error("Erro ao carregar painel diário:", err);
      toast.error("Erro ao carregar painel da recepção", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [hospitalId, periodStart, todayStart, monthStart, user?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: detecta novo encounter direcionado a Sala Vermelha → toca som
  useEffect(() => {
    if (!hospitalId) return;
    const channel = supabase
      .channel(`reception-dash-${hospitalId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "patient_encounters",
          filter: `hospital_unit_id=eq.${hospitalId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row?.destination_sector === "sala_vermelha") {
            // Toca beep urgente (3 vezes)
            playNotificationSound();
            setTimeout(() => playNotificationSound(), 350);
            setTimeout(() => playNotificationSound(), 700);
            toast.error(`🚨 SALA VERMELHA — ${row.patient_name}`, {
              description: `Novo paciente direcionado · ${row.encounter_code}`,
              duration: 8000,
            });
            seenRedRoomIds.current.add(row.id);
          }
          fetchAll();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hospitalId, playNotificationSound, fetchAll]);

  // Marca os encounters de sala vermelha já existentes como "vistos" no primeiro load
  // para não tocar som retroativo
  useEffect(() => {
    if (isFirstLoad.current && todayEncounters.length > 0) {
      todayEncounters
        .filter((e) => e.destination_sector === "sala_vermelha")
        .forEach((e) => seenRedRoomIds.current.add(e.id));
      isFirstLoad.current = false;
    }
  }, [todayEncounters]);

  /** Chama o paciente no painel — atualiza triage_status para "chamado" */
  const handleCallNext = async (encounterId: string, patientName: string) => {
    try {
      const { error } = await supabase
        .from("patient_encounters")
        .update({
          triage_status: "chamado",
          called_at: new Date().toISOString(),
          called_by: user?.id,
        } as any)
        .eq("id", encounterId);
      if (error) throw error;
      toast.success(`📢 ${patientName} chamado no painel da TV`);
      fetchAll();
    } catch (err: any) {
      toast.error("Erro ao chamar paciente", { description: err?.message });
    }
  };

  /** Imprime pulseira buscando dados completos do registry */
  const handlePrintWristband = async (registryId: string | null, encounterCode: string) => {
    if (!registryId) {
      toast.error("Sem prontuário vinculado para imprimir pulseira");
      return;
    }
    try {
      const { data } = await supabase
        .from("patient_registry")
        .select("full_name, medical_record, birth_date, sex, mother_name")
        .eq("id", registryId)
        .maybeSingle();
      if (!data) return;
      printWristband({
        patientName: (data as any).full_name,
        medicalRecord: (data as any).medical_record,
        birthDate: (data as any).birth_date,
        sex: (data as any).sex,
        motherName: (data as any).mother_name,
        encounterCode,
      });
    } catch (err: any) {
      toast.error("Erro ao imprimir", { description: err?.message });
    }
  };

  // Mapa userId → posto ATUAL (sessão aberta mais recente)
  const userPointMap = useMemo(() => {
    const map = new Map<string, ReceptionPoint>();
    for (const s of deskSessions) {
      if (!s.ended_at && !map.has(s.user_id)) {
        map.set(s.user_id, s.reception_point);
      }
    }
    return map;
  }, [deskSessions]);

  // Encounters filtrados pelo posto selecionado
  const filteredEncounters = useMemo(() => {
    if (pointFilter === "all") return todayEncounters;
    return todayEncounters.filter((e) => {
      const point = e.reception_point || (e.created_by ? userPointMap.get(e.created_by) : null);
      return point === pointFilter;
    });
  }, [todayEncounters, pointFilter, userPointMap]);

  // KPIs (segmentados pelo filtro) + split comparativo
  const kpis = useMemo(() => {
    const totalToday = filteredEncounters.length;
    const waitingTriage = filteredEncounters.filter(
      (e) => e.destination_sector === "triagem" && e.triage_status === "aguardando_chamada"
    ).length;
    const waitingAdmission = pendingAdmissions.length;
    const docsPending = filteredEncounters.filter(
      (e) => e.documents_pending || e.partial_identification || e.is_unidentified
    ).length;
    const myToday = myActions.filter(
      (a) => a.table_name === "patient_registry" && a.action === "INSERT"
    ).length;

    const splitByPoint = todayEncounters.reduce(
      (acc, e) => {
        const point = e.reception_point || (e.created_by ? userPointMap.get(e.created_by) : null);
        if (point === "vertical") acc.vertical += 1;
        else if (point === "horizontal") acc.horizontal += 1;
        else acc.unassigned += 1;
        return acc;
      },
      { vertical: 0, horizontal: 0, unassigned: 0 },
    );

    return { totalToday, waitingTriage, waitingAdmission, docsPending, myToday, splitByPoint };
  }, [filteredEncounters, todayEncounters, pendingAdmissions, myActions, userPointMap]);

  // Stats por usuário (recepcionistas com sessão hoje OU que abriram encounters)
  const userStats = useMemo<UserStats[]>(() => {
    const userIds = new Set<string>();
    deskSessions.forEach((s) => userIds.add(s.user_id));
    todayEncounters.forEach((e) => e.created_by && userIds.add(e.created_by));

    return Array.from(userIds)
      .map((uid) => {
        const sessions = deskSessions.filter((s) => s.user_id === uid);
        const userEncounters = todayEncounters.filter((e) => e.created_by === uid);
        const userName =
          sessions[0]?.user_name ||
          allActionsToday.find((a) => a.user_id === uid)?.new_data?.created_by_name ||
          `Usuário ${uid.slice(0, 8)}`;

        const activeMs = sessions.reduce((acc, s) => {
          const start = new Date(s.started_at).getTime();
          const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
          return acc + Math.max(0, end - start);
        }, 0);

        // Tempo médio de cadastro: intervalos entre INSERTs consecutivos
        const inserts = allActionsToday
          .filter((a) => a.user_id === uid && a.table_name === "patient_registry" && a.action === "INSERT")
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        let avgRegSec: number | null = null;
        if (inserts.length >= 2) {
          const diffs: number[] = [];
          for (let i = 1; i < inserts.length; i++) {
            const d = (new Date(inserts[i].created_at).getTime() - new Date(inserts[i - 1].created_at).getTime()) / 1000;
            if (d < 60 * 30) diffs.push(d);
          }
          if (diffs.length > 0) avgRegSec = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
        }

        const expressCount = userEncounters.filter((e) => e.is_unidentified || e.partial_identification).length;
        const pendingDocsCount = userEncounters.filter((e) => e.documents_pending).length;

        const destinationCounts: Record<string, number> = {};
        userEncounters.forEach((e) => {
          const k = e.destination_sector || "—";
          destinationCounts[k] = (destinationCounts[k] || 0) + 1;
        });

        return {
          userId: uid,
          userName,
          point: userPointMap.get(uid) || sessions[0]?.reception_point || null,
          totalEncounters: userEncounters.length,
          expressCount,
          pendingDocsCount,
          destinationCounts,
          avgRegistrationSec: avgRegSec,
          activeMinutes: Math.round(activeMs / 60000),
          isOnline: sessions.some((s) => !s.ended_at),
        };
      })
      .sort((a, b) => b.totalEncounters - a.totalEncounters);
  }, [deskSessions, todayEncounters, allActionsToday, userPointMap]);

  const actionLabel = (a: ReceptionAction) => {
    const op = a.action === "INSERT" ? "Criou" : a.action === "UPDATE" ? "Atualizou" : a.action === "DELETE" ? "Removeu" : a.action;
    const tab = a.table_name === "patient_registry" ? "prontuário" : a.table_name === "patient_encounters" ? "atendimento" : "pré-admissão";
    const name = a.new_data?.patient_name || a.new_data?.full_name || a.new_data?.encounter_code || "";
    return `${op} ${tab}${name ? ` — ${name}` : ""}`;
  };

  const formatActiveTime = (min: number) => {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  };

  const pointBadgeClasses = (p: ReceptionPoint | null) =>
    p === "vertical"
      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
      : p === "horizontal"
      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
      : "bg-muted text-muted-foreground";

  // Próximo paciente da fila de triagem (mais antigo aguardando)
  const nextInQueue = useMemo(() => {
    return filteredEncounters
      .filter((e) => e.destination_sector === "triagem" && e.triage_status === "aguardando_chamada")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  }, [filteredEncounters]);

  return (
    <div className="space-y-4">
      {/* Filtro de período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/40 w-fit">
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground ml-2 mr-1" />
          {([
            { v: "today", label: "Hoje" },
            { v: "7d", label: "7 dias" },
            { v: "30d", label: "30 dias" },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setPeriodFilter(opt.v)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                periodFilter === opt.v
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Atalho "Chamar próximo da fila" */}
        {nextInQueue && (
          <Button
            size="sm"
            onClick={() => handleCallNext(nextInQueue.id, nextInQueue.patient_name)}
            className="bg-primary text-primary-foreground gap-2"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Chamar próximo: <strong>{nextInQueue.patient_name}</strong>
          </Button>
        )}
      </div>

      {/* Filtro segmentado por posto */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-muted/40 w-fit">
        <button
          onClick={() => setPointFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
            pointFilter === "all"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Visão geral
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{todayEncounters.length}</Badge>
        </button>
        <button
          onClick={() => setPointFilter("vertical")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
            pointFilter === "vertical"
              ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Footprints className="h-3.5 w-3.5" />
          Vertical
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{kpis.splitByPoint.vertical}</Badge>
        </button>
        <button
          onClick={() => setPointFilter("horizontal")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
            pointFilter === "horizontal"
              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Ambulance className="h-3.5 w-3.5" />
          Horizontal
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{kpis.splitByPoint.horizontal}</Badge>
        </button>
        {kpis.splitByPoint.unassigned > 0 && (
          <span className="text-[10px] text-muted-foreground ml-2 italic">
            {kpis.splitByPoint.unassigned} sem posto
          </span>
        )}
      </div>

      {/* KPIs (segmentados pelo filtro) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={ListTodo}
          label={
            pointFilter === "all"
              ? `Atendimentos ${periodFilter === "today" ? "hoje" : periodFilter === "7d" ? "(7 dias)" : "(30 dias)"}`
              : `Atendimentos ${RECEPTION_POINT_SHORT[pointFilter]}`
          }
          value={kpis.totalToday}
          hint={periodFilter === "today" ? "Abertos no balcão" : `Período: ${periodFilter === "7d" ? "últimos 7 dias" : "últimos 30 dias"}`}
          tone="default"
        />
        <KpiCard
          icon={Clock}
          label="Aguardando triagem"
          value={kpis.waitingTriage}
          hint="Manchester pendente"
          tone="warn"
        />
        <KpiCard
          icon={BedDouble}
          label="Aguardando admissão"
          value={kpis.waitingAdmission}
          hint="Direcionados sem leito"
          tone="info"
        />
        <KpiCard
          icon={FileWarning}
          label="Documentação pendente"
          value={kpis.docsPending}
          hint="Express / sem documentos"
          tone="warn"
        />
        <KpiCard
          icon={UserPlus}
          label="Cadastros no mês"
          value={monthRegistrations.toLocaleString("pt-BR")}
          hint="Novos prontuários"
          tone="success"
        />
        <KpiCard
          icon={UserCheck}
          label="Equipe ativa agora"
          value={userStats.filter((u) => u.isOnline).length}
          hint={`${userStats.length} no dia`}
          tone="info"
        />
      </div>

      {/* Botões de ação rápida — Triagem Express */}
      {!hideQuickActions && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onTriageExpress}
            className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
            size="sm"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Triagem Express (NI + Triagem em 1 clique)
          </Button>
          <Button onClick={onNewRegistration} variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Novo cadastro completo
          </Button>
          <Button onClick={fetchAll} variant="ghost" size="sm" disabled={loading} className="ml-auto">
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      )}

      {/* Tabs internas */}
      <Tabs defaultValue={defaultSubTab} className="w-full">
        <TabsList>
          <TabsTrigger value="dia" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Atendimentos do Dia
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{kpis.totalToday}</Badge>
          </TabsTrigger>
          <TabsTrigger value="aguardando" className="gap-1.5">
            <BedDouble className="h-3.5 w-3.5" />
            Aguardando Admissão
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{kpis.waitingAdmission}</Badge>
          </TabsTrigger>
          <TabsTrigger value="equipe" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            Por usuário
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{userStats.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="minhas" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Minhas Ações (24h)
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{myActions.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Atendimentos do dia */}
        <TabsContent value="dia" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Atendimentos {periodFilter === "today" ? "abertos hoje" : periodFilter === "7d" ? "(últimos 7 dias)" : "(últimos 30 dias)"} pela recepção
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredEncounters.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum atendimento {pointFilter !== "all" ? `na recepção ${RECEPTION_POINT_SHORT[pointFilter]}` : "no período"}</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[420px]">
                  <div className="divide-y">
                    {filteredEncounters.map((e) => {
                      const waitMin = Math.round((Date.now() - new Date(e.created_at).getTime()) / 60000);
                      const isWaitingTriage =
                        e.destination_sector === "triagem" && e.triage_status === "aguardando_chamada";
                      const slaTone =
                        !isWaitingTriage ? null : waitMin > 30 ? "danger" : waitMin > 15 ? "warn" : "ok";
                      const isRedRoom = e.destination_sector === "sala_vermelha";
                      return (
                        <div
                          key={e.id}
                          className={cn(
                            "p-3 hover:bg-accent/40 transition-colors",
                            isRedRoom && "bg-red-500/5 border-l-2 border-l-red-600",
                            slaTone === "danger" && "bg-rose-500/5",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isRedRoom && <Siren className="h-3.5 w-3.5 text-red-600 animate-pulse shrink-0" />}
                                <span className="font-medium text-sm truncate">{e.patient_name}</span>
                                <Badge variant="outline" className="text-[10px] font-mono h-4">{e.encounter_code}</Badge>
                                {e.status === "active" ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[9px] h-4">
                                    ativo
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] h-4">{e.status}</Badge>
                                )}
                                {e.is_unidentified && (
                                  <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 text-[9px] h-4 gap-1">
                                    <UserX className="h-2.5 w-2.5" /> NI
                                  </Badge>
                                )}
                                {e.documents_pending && (
                                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] h-4 gap-1" title="Documentação pendente">
                                    <FileWarning className="h-2.5 w-2.5" /> docs pendentes
                                  </Badge>
                                )}
                                {e.partial_identification && !e.is_unidentified && (
                                  <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30 text-[9px] h-4">
                                    identificação parcial
                                  </Badge>
                                )}
                                {(() => {
                                  const point = e.reception_point || (e.created_by ? userPointMap.get(e.created_by) : null);
                                  if (!point) return null;
                                  const Icon = point === "vertical" ? Footprints : Ambulance;
                                  return (
                                    <Badge variant="outline" className={cn("text-[9px] h-4 gap-1 border", pointBadgeClasses(point))}>
                                      <Icon className="h-2.5 w-2.5" />
                                      {RECEPTION_POINT_SHORT[point]}
                                    </Badge>
                                  );
                                })()}
                                {/* SLA: chegada → chamada de triagem (15/30/60min) */}
                                {isWaitingTriage && (
                                  <SlaBadge
                                    startAt={e.created_at}
                                    thresholds={[15, 30, 60]}
                                    label="triagem"
                                    compact
                                  />
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                                <span>{format(new Date(e.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                                <span>•</span>
                                <span className="capitalize">→ {e.destination_sector?.replace(/_/g, " ") || "—"}</span>
                                {e.triage_status && (
                                  <>
                                    <span>•</span>
                                    <span className="capitalize">{e.triage_status.replace(/_/g, " ")}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isWaitingTriage && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-[10px] gap-1"
                                  onClick={() => handleCallNext(e.id, e.patient_name)}
                                  title="Chamar paciente no painel da TV"
                                >
                                  <Volume2 className="h-3 w-3" />
                                  Chamar
                                </Button>
                              )}
                              {e.registry_id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px]"
                                  onClick={() => onPickRegistry(e.registry_id!, e.patient_name)}
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  Reatender
                                </Button>
                              )}
                              {e.registry_id && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel className="text-[10px]">Ações rápidas</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => handlePrintWristband(e.registry_id, e.encounter_code)}>
                                      <Printer className="h-3.5 w-3.5 mr-2" />
                                      Reimprimir pulseira
                                    </DropdownMenuItem>
                                    {(e.documents_pending || e.partial_identification) && !e.is_unidentified && (
                                      <DropdownMenuItem
                                        onClick={() => setCompleteTarget({ registryId: e.registry_id!, name: e.patient_name })}
                                      >
                                        <FileWarning className="h-3.5 w-3.5 mr-2 text-amber-600" />
                                        Completar pendências
                                      </DropdownMenuItem>
                                    )}
                                    {e.is_unidentified && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setPromoteTarget({
                                            registryId: e.registry_id!,
                                            code: null,
                                            name: e.patient_name,
                                          })
                                        }
                                      >
                                        <UserCheck className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                                        Identificar paciente (NI → real)
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => onPickRegistry(e.registry_id!, e.patient_name)}>
                                      <Play className="h-3.5 w-3.5 mr-2" />
                                      Abrir prontuário
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Por usuário (ranking) */}
        <TabsContent value="equipe" className="mt-3">
          <UserStatsPanel stats={userStats} currentUserId={user?.id} />
        </TabsContent>

        {/* Aguardando admissão */}
        <TabsContent value="aguardando" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                Pacientes direcionados aguardando admissão no setor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingAdmissions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum paciente aguardando admissão</p>
                  <p className="text-[11px] mt-1">Todos os direcionamentos foram processados pelos setores</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <div className="divide-y">
                    {pendingAdmissions.map((p) => {
                      const waitMin = Math.round((Date.now() - new Date(p.created_at).getTime()) / 60000);
                      const slow = waitMin > 60;
                      return (
                        <div key={p.id} className={cn("p-3 hover:bg-accent/40", slow && "bg-amber-500/5")}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{p.patient_name}</span>
                                <Badge variant="outline" className="text-[10px] h-4">{p.destination_sector}</Badge>
                                {slow && (
                                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] h-4">
                                    {waitMin}min
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                <span>aguardando há {formatDistanceToNow(new Date(p.created_at), { locale: ptBR })}</span>
                              </div>
                              {p.notes && (
                                <p className="text-[10px] text-muted-foreground mt-1 italic truncate">{p.notes}</p>
                              )}
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Minhas ações */}
        <TabsContent value="minhas" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                Histórico de ações do usuário logado (últimas 24h)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {myActions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma ação registrada nas últimas 24h</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <div className="divide-y">
                    {myActions.map((a, idx) => (
                      <div key={`${a.record_id}-${idx}`} className="p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate">{actionLabel(a)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {format(new Date(a.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] h-4 shrink-0",
                              a.action === "INSERT" && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
                              a.action === "UPDATE" && "border-sky-500/40 text-sky-700 dark:text-sky-400",
                              a.action === "DELETE" && "border-rose-500/40 text-rose-700 dark:text-rose-400",
                            )}
                          >
                            {a.action}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: completar pendências de cadastro */}
      <CompletePatientDataDialog
        open={!!completeTarget}
        onOpenChange={(v) => !v && setCompleteTarget(null)}
        registryId={completeTarget?.registryId ?? null}
        onSaved={fetchAll}
      />

      {/* Dialog: promover NI → identificado */}
      <PromoteNiDialog
        open={!!promoteTarget}
        onOpenChange={(v) => !v && setPromoteTarget(null)}
        niRegistryId={promoteTarget?.registryId ?? null}
        niCode={promoteTarget?.code ?? null}
        niName={promoteTarget?.name ?? null}
        onPromoted={fetchAll}
      />
    </div>
  );
}
