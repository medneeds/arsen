import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, startOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity, BedDouble, Clock, FileText, Users, AlertTriangle,
  PhoneOutgoing, RefreshCw, ArrowRight, Loader2, ListTodo, History,
  CheckCircle2, XCircle, UserPlus, Play,
} from "lucide-react";
import { toast } from "sonner";

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
}

interface Props {
  /** Quando usuário clica em "Reatender" / "Selecionar paciente" */
  onPickRegistry: (registryId: string, patientName: string) => void;
  /** Quando usuário clica em "Triagem Express" */
  onTriageExpress: () => void;
  /** Abre cadastro de novo prontuário */
  onNewRegistration: () => void;
  /** Sub-tab inicial: "dia" | "aguardando" | "minhas" */
  defaultSubTab?: "dia" | "aguardando" | "minhas";
  /** Esconde botões de ação rápida (quando o pai já tem) */
  hideQuickActions?: boolean;
}

/**
 * Painel diário da recepção — exibido na aba "Início" antes da busca.
 * - 4 KPIs do balcão hoje
 * - Atendimentos do Dia (abertos pela recepção)
 * - Aguardando Admissão (pacientes direcionados ainda sem leito)
 * - Histórico de ações do recepcionista logado (24h)
 */
export function ReceptionDailyDashboard({ onPickRegistry, onTriageExpress, onNewRegistration, defaultSubTab = "dia", hideQuickActions = false }: Props) {
  const { currentHospital } = useHospital();
  const { user } = useAuth();
  const hospitalId = currentHospital?.id;

  const [loading, setLoading] = useState(false);
  const [todayEncounters, setTodayEncounters] = useState<DailyEncounter[]>([]);
  const [pendingAdmissions, setPendingAdmissions] = useState<PendingAdmission[]>([]);
  const [myActions, setMyActions] = useState<ReceptionAction[]>([]);
  const [monthRegistrations, setMonthRegistrations] = useState(0);

  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const monthStart = useMemo(() => startOfMonth(new Date()).toISOString(), []);

  const fetchAll = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const [encRes, paRes, regRes, auditRes] = await Promise.all([
        supabase
          .from("patient_encounters")
          .select("id, encounter_code, patient_name, registry_id, destination_sector, triage_status, status, created_at, created_by")
          .eq("hospital_unit_id", hospitalId)
          .gte("created_at", todayStart)
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
              .select("table_name, action, record_id, created_at, new_data")
              .eq("user_id", user.id)
              .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
              .in("table_name", ["patient_registry", "patient_encounters", "pre_admissions"])
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (encRes.error) throw encRes.error;
      setTodayEncounters((encRes.data as DailyEncounter[]) || []);
      // pre_admissions pode não estar tipada — tratamento defensivo
      setPendingAdmissions((paRes.data as any[]) || []);
      setMonthRegistrations(regRes.count || 0);
      setMyActions((auditRes.data as ReceptionAction[]) || []);
    } catch (err: any) {
      console.error("Erro ao carregar painel diário:", err);
      toast.error("Erro ao carregar painel da recepção", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [hospitalId, todayStart, monthStart, user?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // KPIs derivados
  const kpis = useMemo(() => {
    const totalToday = todayEncounters.length;
    const waitingTriage = todayEncounters.filter(
      (e) => e.destination_sector === "triagem" && e.triage_status === "aguardando_chamada"
    ).length;
    const waitingAdmission = pendingAdmissions.length;
    const myToday = myActions.filter(
      (a) => a.table_name === "patient_registry" && a.action === "INSERT"
    ).length;
    return { totalToday, waitingTriage, waitingAdmission, myToday };
  }, [todayEncounters, pendingAdmissions, myActions]);

  const actionLabel = (a: ReceptionAction) => {
    const op = a.action === "INSERT" ? "Criou" : a.action === "UPDATE" ? "Atualizou" : a.action === "DELETE" ? "Removeu" : a.action;
    const tab = a.table_name === "patient_registry" ? "prontuário" : a.table_name === "patient_encounters" ? "atendimento" : "pré-admissão";
    const name = a.new_data?.patient_name || a.new_data?.full_name || a.new_data?.encounter_code || "";
    return `${op} ${tab}${name ? ` — ${name}` : ""}`;
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={ListTodo}
          label="Atendimentos hoje"
          value={kpis.totalToday}
          hint="Abertos no balcão"
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
          icon={UserPlus}
          label="Cadastros no mês"
          value={monthRegistrations.toLocaleString("pt-BR")}
          hint="Novos prontuários"
          tone="success"
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
              <CardTitle className="text-sm">Atendimentos abertos hoje pela recepção</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {todayEncounters.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum atendimento aberto hoje</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <div className="divide-y">
                    {todayEncounters.map((e) => (
                      <div key={e.id} className="p-3 hover:bg-accent/40 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">{e.patient_name}</span>
                              <Badge variant="outline" className="text-[10px] font-mono h-4">{e.encounter_code}</Badge>
                              {e.status === "active" ? (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[9px] h-4">
                                  ativo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] h-4">{e.status}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                              <span>{format(new Date(e.created_at), "HH:mm", { locale: ptBR })}</span>
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
                          {e.registry_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] shrink-0"
                              onClick={() => onPickRegistry(e.registry_id!, e.patient_name)}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Reatender
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
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
    </div>
  );
}
