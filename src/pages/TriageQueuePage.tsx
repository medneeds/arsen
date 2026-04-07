import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { PatientRegistrationDialog } from "@/components/PatientRegistrationDialog";
import { RiskClassificationDialog } from "@/components/RiskClassificationDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bell, BedDouble, CheckCircle2, Clock, DoorOpen, Loader2, Monitor,
  Play, Shield, User, UserPlus, Users, Volume2, ArrowRight,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TriagePatient {
  id: string;
  encounter_code: string;
  patient_name: string;
  triage_status: string;
  destination_sector: string;
  called_at?: string;
  created_at: string;
  registry_id?: string;
}

interface PreAdmission {
  id: string;
  patient_name: string;
  birth_date: string | null;
  sex: string | null;
  risk_classification: string | null;
  chief_complaint: string | null;
  status: string;
  created_at: string;
}

const RISK_COLORS: Record<string, string> = {
  vermelho: "bg-red-600 text-white",
  laranja: "bg-orange-500 text-white",
  amarelo: "bg-yellow-500 text-black",
  verde: "bg-green-600 text-white",
  azul: "bg-blue-600 text-white",
};

const RISK_LABELS: Record<string, string> = {
  vermelho: "EMERGÊNCIA",
  laranja: "MUITO URGENTE",
  amarelo: "URGENTE",
  verde: "POUCO URGENTE",
  azul: "NÃO URGENTE",
};

// ─── Component ──────────────────────────────────────────────────────────────

const TriageQueuePage = () => {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const navigate = useNavigate();

  // Encounter queue state
  const [patients, setPatients] = useState<TriagePatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [directTarget, setDirectTarget] = useState<TriagePatient | null>(null);

  // Pre-admission / risk classification state
  const [preAdmissions, setPreAdmissions] = useState<PreAdmission[]>([]);
  const [showRegistration, setShowRegistration] = useState(false);
  const [classifyTarget, setClassifyTarget] = useState<PreAdmission | null>(null);
  const [routeTarget, setRouteTarget] = useState<PreAdmission | null>(null);
  const [routeDestination, setRouteDestination] = useState<"c1" | "c2" | "horizontal" | null>(null);

  // ─── Data loading ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentHospital?.id) return;
    loadQueue();
    loadPreAdmissions();

    const channel = supabase
      .channel("triage-queue-multi")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "patient_encounters",
        filter: `hospital_unit_id=eq.${currentHospital.id}`,
      }, () => loadQueue())
      .on("postgres_changes", {
        event: "*", schema: "public", table: "pre_admissions",
        filter: `hospital_unit_id=eq.${currentHospital.id}`,
      }, () => loadPreAdmissions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentHospital?.id, currentState?.id]);

  const loadQueue = async () => {
    if (!currentHospital?.id) return;
    try {
      const { data, error } = await supabase
        .from("patient_encounters")
        .select("id, encounter_code, patient_name, triage_status, destination_sector, called_at, created_at, registry_id")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("destination_sector", "triagem")
        .eq("status", "active")
        .in("triage_status", ["aguardando_chamada", "chamado", "em_triagem"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      setPatients((data as TriagePatient[]) || []);
    } catch (err) {
      console.error("Error loading triage queue:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreAdmissions = async () => {
    if (!currentHospital?.id || !currentState?.id) return;
    try {
      const { data, error } = await supabase
        .from("pre_admissions")
        .select("id, patient_name, birth_date, sex, risk_classification, chief_complaint, status, created_at")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .in("status", ["pre_admissao", "classificado", "aguardando_leito"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPreAdmissions((data as PreAdmission[]) || []);
    } catch (err) {
      console.error("Error loading pre-admissions:", err);
    }
  };

  // ─── Encounter actions ───────────────────────────────────────────────────

  const handleCall = async (patient: TriagePatient) => {
    setCallingId(patient.id);
    try {
      const { error } = await supabase.from("patient_encounters")
        .update({ triage_status: "chamado", called_at: new Date().toISOString(), called_by: user?.id } as any)
        .eq("id", patient.id);
      if (error) throw error;
      toast.success(`${patient.patient_name} chamado no painel!`);
    } catch { toast.error("Erro ao chamar paciente"); }
    finally { setCallingId(null); }
  };

  const handleStartTriage = async (patient: TriagePatient) => {
    try {
      const { error } = await supabase.from("patient_encounters")
        .update({ triage_status: "em_triagem" } as any).eq("id", patient.id);
      if (error) throw error;
      toast.success(`Triagem iniciada para ${patient.patient_name}`);
    } catch { toast.error("Erro ao iniciar triagem"); }
  };

  const handleCompleteTriage = async (patient: TriagePatient) => {
    try {
      const { error } = await supabase.from("patient_encounters")
        .update({ triage_status: "triado" } as any).eq("id", patient.id);
      if (error) throw error;
      toast.success(`Triagem concluída para ${patient.patient_name}`);
    } catch { toast.error("Erro ao concluir triagem"); }
  };

  const handleDirectHorizontal = async (patient: TriagePatient) => {
    try {
      // Create patient in UE Horizontal
      const { data: existing } = await supabase.from("patients").select("bed_number")
        .eq("hospital_unit_id", currentHospital!.id).eq("sector", "ue_horizontal")
        .like("bed_number", "M-%");
      const nextNum = (existing?.length || 0) + 1;
      const bedNumber = `M-${String(nextNum).padStart(2, "0")}`;

      const { data: newPatient, error: insertErr } = await supabase.from("patients").insert({
        name: patient.patient_name, bed_number: bedNumber, sector: "ue_horizontal",
        hospital_unit_id: currentHospital!.id, state_id: currentState!.id,
        department: "URGÊNCIA E EMERGÊNCIA ADULTO", admission_date: new Date().toISOString(),
        display_order: nextNum,
      } as any).select("id").single();
      if (insertErr) throw insertErr;

      // Update encounter as completed with link to patient
      await supabase.from("patient_encounters")
        .update({ triage_status: "triado", destination_sector: "ue_horizontal", status: "completed", patient_id: newPatient?.id } as any)
        .eq("id", patient.id);

      toast.success(`${patient.patient_name} → Maca ${bedNumber} (UE Horizontal)`);
      setDirectTarget(null);
    } catch { toast.error("Erro ao encaminhar paciente"); setDirectTarget(null); }
  };

  const handleDirectConsultorio = async (patient: TriagePatient, consultorio: number) => {
    try {
      const prefix = `C${consultorio}-`;
      const { data: existing } = await supabase.from("patients").select("bed_number")
        .eq("hospital_unit_id", currentHospital!.id).eq("sector", "ue_vertical")
        .like("bed_number", `${prefix}%`);
      const nextNum = (existing?.length || 0) + 1;
      const bedNumber = `${prefix}${String(nextNum).padStart(2, "0")}`;

      const { data: newPatient, error: insertErr } = await supabase.from("patients").insert({
        name: patient.patient_name, bed_number: bedNumber, sector: "ue_vertical",
        hospital_unit_id: currentHospital!.id, state_id: currentState!.id,
        department: "URGÊNCIA E EMERGÊNCIA ADULTO", admission_date: new Date().toISOString(),
        display_order: nextNum,
      } as any).select("id").single();
      if (insertErr) throw insertErr;

      // Update encounter as completed with link
      await supabase.from("patient_encounters")
        .update({ triage_status: "triado", destination_sector: "ue_vertical", status: "completed", patient_id: newPatient?.id } as any)
        .eq("id", patient.id);

      toast.success(`${patient.patient_name} → Consultório ${consultorio} (${bedNumber})`);
    } catch { toast.error("Erro ao alocar paciente"); }
  };

  // ─── Pre-admission routing (after risk classification) ─────────────────

  const handleRoutePreAdmission = async () => {
    if (!routeTarget || !routeDestination) return;
    try {
      if (routeDestination === "horizontal") {
        // Create patient in UE Horizontal
        const { error } = await supabase.from("patients").insert({
          name: routeTarget.patient_name, bed_number: `H${String(Math.floor(Math.random() * 90) + 10)}`,
          sector: "ue_horizontal", hospital_unit_id: currentHospital!.id,
          state_id: currentState!.id, department: "URGÊNCIA E EMERGÊNCIA ADULTO",
          admission_date: new Date().toISOString(),
          clinical_status: routeTarget.risk_classification === "vermelho" ? "gravissimo"
            : routeTarget.risk_classification === "laranja" ? "grave" : "potencialmente_grave",
          diagnoses: routeTarget.chief_complaint || null,
        } as any);
        if (error) throw error;
        toast.success(`${routeTarget.patient_name} → UE Horizontal (maca)`);
      } else {
        const consultorio = routeDestination === "c1" ? 1 : 2;
        const prefix = `C${consultorio}-`;
        const { data: existing } = await supabase.from("patients").select("bed_number")
          .eq("hospital_unit_id", currentHospital!.id).eq("sector", "ue_vertical")
          .like("bed_number", `${prefix}%`);
        const nextNum = (existing?.length || 0) + 1;
        const bedNumber = `${prefix}${String(nextNum).padStart(2, "0")}`;

        const { error } = await supabase.from("patients").insert({
          name: routeTarget.patient_name, bed_number: bedNumber, sector: "ue_vertical",
          hospital_unit_id: currentHospital!.id, state_id: currentState!.id,
          department: "URGÊNCIA E EMERGÊNCIA ADULTO", admission_date: new Date().toISOString(),
          diagnoses: routeTarget.chief_complaint || null, display_order: nextNum,
        } as any);
        if (error) throw error;
        toast.success(`${routeTarget.patient_name} → Consultório ${consultorio} (${bedNumber})`);
      }

      // Mark pre-admission as routed
      await supabase.from("pre_admissions").update({ status: "admitido" } as any).eq("id", routeTarget.id);
      loadPreAdmissions();
    } catch { toast.error("Erro ao encaminhar paciente"); }
    finally { setRouteTarget(null); setRouteDestination(null); }
  };

  // ─── Computed ────────────────────────────────────────────────────────────

  const waiting = patients.filter(p => p.triage_status === "aguardando_chamada");
  const called = patients.filter(p => p.triage_status === "chamado");
  const inTriage = patients.filter(p => p.triage_status === "em_triagem");

  const pendingClassification = preAdmissions.filter(p => !p.risk_classification);
  const classified = preAdmissions.filter(p => !!p.risk_classification);

  const getWaitMinutes = (createdAt: string) =>
    Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);

  const openTVScreen = () => window.open("/triagem-tv", "_blank", "noopener,noreferrer");

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Triagem & Classificação de Risco</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {waiting.length} fila · {preAdmissions.length} pré-admissões
            </Badge>
            <Button size="sm" onClick={() => setShowRegistration(true)} className="gap-1">
              <UserPlus className="h-4 w-4" /> Cadastrar Paciente
            </Button>
            <Button variant="outline" size="sm" onClick={openTVScreen}>
              <Monitor className="h-4 w-4 mr-1" /> Painel TV
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* ─── Section 1: Classified patients awaiting routing ─── */}
            {classified.length > 0 && (
              <Card className="border-emerald-300 dark:border-emerald-800">
                <CardHeader className="pb-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-t-lg">
                  <CardTitle className="text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <Shield className="h-4 w-4" />
                    Classificados — Aguardando Encaminhamento ({classified.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-3">
                  {classified.map(pa => (
                    <div key={pa.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3">
                        <Badge className={cn("text-[9px] px-1.5", RISK_COLORS[pa.risk_classification!])}>
                          {RISK_LABELS[pa.risk_classification!]}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{pa.patient_name}</p>
                          {pa.chief_complaint && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">
                              {pa.chief_complaint}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline"
                          className="gap-1 h-7 text-[10px] border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                          onClick={() => { setRouteTarget(pa); setRouteDestination("c1"); }}>
                          <DoorOpen className="h-3 w-3" /> Consultório 1
                        </Button>
                        <Button size="sm" variant="outline"
                          className="gap-1 h-7 text-[10px] border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
                          onClick={() => { setRouteTarget(pa); setRouteDestination("c2"); }}>
                          <DoorOpen className="h-3 w-3" /> Consultório 2
                        </Button>
                        <Button size="sm" variant="outline"
                          className="gap-1 h-7 text-[10px] border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400"
                          onClick={() => { setRouteTarget(pa); setRouteDestination("horizontal"); }}>
                          <BedDouble className="h-3 w-3" /> Horizontal
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ─── Section 2: Pending risk classification ─── */}
            {pendingClassification.length > 0 && (
              <Card className="border-orange-300 dark:border-orange-800">
                <CardHeader className="pb-2 bg-orange-50 dark:bg-orange-950/20 rounded-t-lg">
                  <CardTitle className="text-sm flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <Shield className="h-4 w-4" />
                    Aguardando Classificação de Risco ({pendingClassification.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-3">
                  {pendingClassification.map(pa => (
                    <div key={pa.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-orange-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{pa.patient_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {pa.sex && `${pa.sex} · `}
                            Cadastrado {format(new Date(pa.created_at), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <Button size="sm"
                        className="gap-1 bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => setClassifyTarget(pa)}>
                        <Shield className="h-3 w-3" /> Classificar Risco
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ─── Section 3: Called patients ─── */}
            {called.length > 0 && (
              <Card className="border-blue-300 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-600">
                    <Volume2 className="h-4 w-4 animate-pulse" /> Chamados ({called.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {called.map(patient => (
                    <div key={patient.id} className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{patient.patient_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{patient.encounter_code}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleCall(patient)}>
                          <Bell className="h-3 w-3 mr-1" /> Chamar novamente
                        </Button>
                        <Button size="sm" onClick={() => handleStartTriage(patient)}>
                          <Play className="h-3 w-3 mr-1" /> Iniciar Triagem
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ─── Section 4: In triage ─── */}
            {inTriage.length > 0 && (
              <Card className="border-purple-300 dark:border-purple-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-purple-600">
                    <Play className="h-4 w-4" /> Em Triagem ({inTriage.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {inTriage.map(patient => (
                    <div key={patient.id} className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <User className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{patient.patient_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{patient.encounter_code}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleCompleteTriage(patient)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ─── Section 5: Waiting queue ─── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Fila de Espera — Aguardando Chamada ({waiting.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {waiting.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhum paciente na fila de espera</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {waiting.map((patient, index) => {
                        const waitMin = getWaitMinutes(patient.created_at);
                        return (
                          <motion.div key={patient.id}
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-sm font-bold text-amber-600">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{patient.patient_name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="font-mono">{patient.encounter_code}</span>
                                  <span>·</span>
                                  <span>{format(new Date(patient.created_at), "HH:mm", { locale: ptBR })}</span>
                                  <Badge variant={waitMin > 30 ? "destructive" : "secondary"} className="text-[9px] px-1.5">
                                    {waitMin}min
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              <Button size="sm" onClick={() => handleCall(patient)}
                                disabled={callingId === patient.id} className="gap-1">
                                {callingId === patient.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Bell className="h-3 w-3" />}
                                Chamar no Painel
                              </Button>
                              <Button size="sm" variant="outline"
                                className="gap-1 border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                onClick={() => handleDirectConsultorio(patient, 1)}>
                                <DoorOpen className="h-3 w-3" /> C1
                              </Button>
                              <Button size="sm" variant="outline"
                                className="gap-1 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/30"
                                onClick={() => handleDirectConsultorio(patient, 2)}>
                                <DoorOpen className="h-3 w-3" /> C2
                              </Button>
                              <Button size="sm" variant="outline"
                                className="gap-1 border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                                onClick={() => setDirectTarget(patient)}>
                                <BedDouble className="h-3 w-3" /> Horizontal
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ─── Dialogs ──────────────────────────────────────────────────────── */}

      <PatientRegistrationDialog
        open={showRegistration}
        onOpenChange={setShowRegistration}
        onSuccess={loadPreAdmissions}
      />

      <RiskClassificationDialog
        open={!!classifyTarget}
        onOpenChange={(open) => !open && setClassifyTarget(null)}
        preAdmission={classifyTarget}
        onSuccess={loadPreAdmissions}
      />

      {/* Route confirmation after classification */}
      <AlertDialog open={!!routeTarget && !!routeDestination} onOpenChange={open => { if (!open) { setRouteTarget(null); setRouteDestination(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {routeDestination === "horizontal"
                ? <><BedDouble className="h-5 w-5 text-indigo-600" /> Encaminhar para UE Horizontal</>
                : <><DoorOpen className="h-5 w-5 text-emerald-600" /> Encaminhar para Consultório {routeDestination === "c1" ? "1" : "2"}</>}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p>Confirma o encaminhamento de <strong>{routeTarget?.patient_name}</strong>
                {routeTarget?.risk_classification && (
                  <> ({RISK_LABELS[routeTarget.risk_classification]})</>
                )}
                {routeDestination === "horizontal"
                  ? " para uma maca na UE Horizontal?"
                  : ` para o Consultório ${routeDestination === "c1" ? "1" : "2"} da UE Vertical?`}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoutePreAdmission} className="gap-1.5">
              <ArrowRight className="h-4 w-4" /> Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Direct horizontal confirmation for encounter queue */}
      <AlertDialog open={!!directTarget} onOpenChange={open => !open && setDirectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-indigo-600" /> Encaminhar direto para UE Horizontal?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O paciente <strong>{directTarget?.patient_name}</strong> será encaminhado diretamente para maca na UE Horizontal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => directTarget && handleDirectHorizontal(directTarget)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
              <ArrowRight className="h-4 w-4" /> Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default TriageQueuePage;
