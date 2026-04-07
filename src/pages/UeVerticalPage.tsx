import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Search, RefreshCw, User, Clock, Activity, Stethoscope,
  FileText, FlaskConical, ImageIcon, MessageSquare, Zap, DoorOpen,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { QuickAttendanceDialog } from "@/components/QuickAttendanceDialog";
import { type AttendancePreset, type PresetItem } from "@/data/quickAttendancePresets";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UePatient {
  id: string;
  name: string;
  bed_number: string;
  age?: string;
  diagnoses?: string;
  pendencies?: string;
  admission_date?: string;
  clinical_status?: string;
  medical_record?: string;
  is_vacant?: boolean;
}

interface WaitingPatient {
  id: string;
  patient_name: string;
  risk_classification: string | null;
  chief_complaint: string | null;
  source: "pre_admission" | "encounter";
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

function getConsultorio(bedNumber: string): number {
  if (bedNumber.startsWith("C1")) return 1;
  if (bedNumber.startsWith("C2")) return 2;
  return 0;
}

function UeVerticalHeader({ onRefresh, isRefreshing, search, onSearch, c1Count, c2Count, waitingCount, onPullPatient }: {
  onRefresh: () => void; isRefreshing: boolean; search: string; onSearch: (s: string) => void;
  c1Count: number; c2Count: number; waitingCount: number; onPullPatient: () => void;
}) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <header
      className="border-b border-white/10 bg-gradient-to-r from-[#1a0a2e] via-[#2d1560] to-[#3a1c80] backdrop-blur-xl fixed top-0 right-0 z-50 shadow-lg transition-[left] duration-200 ease-linear"
      style={{ left: isMobile ? 0 : (state === "collapsed" ? "var(--sidebar-width-icon)" : "var(--sidebar-width)") }}
    >
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <SidebarTrigger className="flex-shrink-0 text-white hover:text-white hover:bg-white/25 border-white/30 transition-all" />
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-purple-300" />
              <span className="text-sm font-bold text-white">UE Vertical</span>
            </div>
            <Badge className="bg-emerald-500/30 text-emerald-200 text-[10px] border-emerald-400/30">
              <DoorOpen className="h-3 w-3 mr-0.5" /> C1: {c1Count}
            </Badge>
            <Badge className="bg-blue-500/30 text-blue-200 text-[10px] border-blue-400/30">
              <DoorOpen className="h-3 w-3 mr-0.5" /> C2: {c2Count}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onPullPatient}
              className="h-8 gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white">
              <ArrowDown className="h-3.5 w-3.5" /> Puxar Paciente
              {waitingCount > 0 && (
                <Badge className="bg-white/20 text-white text-[9px] ml-1 px-1">{waitingCount}</Badge>
              )}
            </Button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <Input value={search} onChange={e => onSearch(e.target.value)}
                placeholder="Buscar paciente..."
                className="h-8 w-40 pl-8 text-xs bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <Button variant="outline" size="icon" onClick={onRefresh} disabled={isRefreshing}
              className="h-8 w-8 bg-white/10 border-white/20 text-white hover:bg-white/20">
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function PatientRow({ patient, onQuickAttendance, onNavigate }: {
  patient: UePatient; onQuickAttendance: () => void; onNavigate: (path: string) => void;
}) {
  const diagnoses = patient.diagnoses?.split("\n").filter(Boolean) || [];
  const pendencies = patient.pendencies?.split("\n").filter(Boolean) || [];
  const waitTime = patient.admission_date
    ? formatDistanceToNow(new Date(patient.admission_date), { locale: ptBR, addSuffix: false }) : null;

  const params = new URLSearchParams({
    patientId: patient.id, patientName: patient.name,
    patientBed: patient.bed_number, patientSector: "ue_vertical",
  }).toString();

  if (patient.is_vacant) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="border-l-4 rounded-lg border bg-card p-3 hover:shadow-md transition-all border-l-muted">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] font-bold px-1.5 bg-primary/10 text-primary border-primary/30">
              {patient.bed_number}
            </Badge>
            <span className="text-xs font-bold truncate">{patient.name}</span>
            {patient.age && <span className="text-[10px] text-muted-foreground">{patient.age}a</span>}
            {waitTime && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {waitTime}
              </span>
            )}
          </div>
          {diagnoses.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {diagnoses.slice(0, 3).map((d, i) => (
                <Badge key={i} variant="secondary" className="text-[9px]">{d}</Badge>
              ))}
            </div>
          )}
          {pendencies.length > 0 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 truncate">⚠ {pendencies[0]}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="default" className="h-7 text-[10px] gap-1" onClick={onQuickAttendance}>
            <Zap className="h-3 w-3" /> Rápido
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
            onClick={() => onNavigate(`/evolucao?${params}`)}><Stethoscope className="h-3 w-3" /></Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
            onClick={() => onNavigate(`/prescricao?${params}`)}><FileText className="h-3 w-3" /></Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
            onClick={() => onNavigate(`/requisicao?${params}&category=laboratorio`)}><FlaskConical className="h-3 w-3" /></Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
            onClick={() => onNavigate(`/requisicao?${params}&category=imagem`)}><ImageIcon className="h-3 w-3" /></Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
            onClick={() => onNavigate(`/requisicao?${params}&category=parecer`)}><MessageSquare className="h-3 w-3" /></Button>
        </div>
      </div>
    </motion.div>
  );
}

function ConsultorioCard({ number, patients, color, onQuickAttendance, onNavigate }: {
  number: number; patients: UePatient[]; color: string;
  onQuickAttendance: (p: UePatient) => void; onNavigate: (path: string) => void;
}) {
  const colorMap: Record<string, { border: string; bg: string; text: string; icon: string }> = {
    emerald: { border: "border-emerald-300 dark:border-emerald-800", bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-300", icon: "text-emerald-600" },
    blue: { border: "border-blue-300 dark:border-blue-800", bg: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-700 dark:text-blue-300", icon: "text-blue-600" },
  };
  const c = colorMap[color];

  return (
    <Card className={cn("flex-1", c.border)}>
      <CardHeader className={cn("pb-2 rounded-t-lg", c.bg)}>
        <CardTitle className={cn("text-sm flex items-center gap-2", c.text)}>
          <DoorOpen className={cn("h-4 w-4", c.icon)} /> Consultório {number}
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {patients.length} paciente{patients.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 space-y-2">
        {patients.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <User className="h-6 w-6 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhum paciente alocado</p>
          </div>
        ) : patients.map(patient => (
          <PatientRow key={patient.id} patient={patient}
            onQuickAttendance={() => onQuickAttendance(patient)} onNavigate={onNavigate} />
        ))}
      </CardContent>
    </Card>
  );
}

function PullPatientDialog({ open, onOpenChange, waitingPatients, onPull }: {
  open: boolean; onOpenChange: (open: boolean) => void;
  waitingPatients: WaitingPatient[];
  onPull: (patient: WaitingPatient, consultorio: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDown className="h-5 w-5 text-amber-600" /> Puxar Paciente para Atendimento
          </DialogTitle>
        </DialogHeader>
        {waitingPatients.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum paciente aguardando alocação</p>
          </div>
        ) : (
          <div className="space-y-2">
            {waitingPatients.map(wp => (
              <div key={wp.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-all">
                <div className="flex items-center gap-2 min-w-0">
                  {wp.risk_classification && (
                    <Badge className={cn("text-[9px] px-1.5 shrink-0", RISK_COLORS[wp.risk_classification])}>
                      {RISK_LABELS[wp.risk_classification] || wp.risk_classification}
                    </Badge>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{wp.patient_name}</p>
                    {wp.chief_complaint && <p className="text-[10px] text-muted-foreground truncate">{wp.chief_complaint}</p>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline"
                    className="h-7 text-[10px] gap-1 border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                    onClick={() => onPull(wp, 1)}>
                    <DoorOpen className="h-3 w-3" /> C1
                  </Button>
                  <Button size="sm" variant="outline"
                    className="h-7 text-[10px] gap-1 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
                    onClick={() => onPull(wp, 2)}>
                    <DoorOpen className="h-3 w-3" /> C2
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function UeVerticalPage() {
  const [patients, setPatients] = useState<UePatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [quickTarget, setQuickTarget] = useState<UePatient | null>(null);
  const [showPull, setShowPull] = useState(false);
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { role } = useAuth();
  const navigate = useNavigate();

  const fetchPatients = async () => {
    if (!currentHospital?.id || !currentState?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("patients").select("*")
        .eq("hospital_unit_id", currentHospital.id).eq("state_id", currentState.id)
        .eq("department", currentDepartment).eq("sector", "ue_vertical")
        .order("display_order", { ascending: true });
      if (error) throw error;
      setPatients((data || []).map(p => ({
        id: p.id, name: p.name, bed_number: p.bed_number,
        age: p.age || undefined, diagnoses: p.diagnoses || undefined,
        pendencies: p.pendencies || undefined, admission_date: p.admission_date || undefined,
        clinical_status: p.clinical_status || undefined, medical_record: p.medical_record || undefined,
        is_vacant: p.is_vacant || false,
      })));
    } catch (err) { console.error("Fetch UE Vertical error:", err); }
    finally { setIsLoading(false); }
  };

  const fetchWaitingPatients = async () => {
    if (!currentHospital?.id || !currentState?.id) return;
    try {
      const { data: preAdm } = await supabase.from("pre_admissions")
        .select("id, patient_name, risk_classification, chief_complaint")
        .eq("hospital_unit_id", currentHospital.id).eq("state_id", currentState.id)
        .in("status", ["classificado", "aguardando_leito"])
        .order("created_at", { ascending: true });

      setWaitingPatients((preAdm || []).map(p => ({
        id: p.id, patient_name: p.patient_name,
        risk_classification: p.risk_classification, chief_complaint: p.chief_complaint,
        source: "pre_admission" as const,
      })));
    } catch (err) { console.error("Fetch waiting error:", err); }
  };

  useEffect(() => { fetchPatients(); fetchWaitingPatients(); },
    [currentHospital?.id, currentState?.id, currentDepartment]);

  useEffect(() => {
    if (!currentHospital?.id) return;
    const channel = supabase.channel("ue-vertical-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "patients",
        filter: `hospital_unit_id=eq.${currentHospital.id}` }, () => fetchPatients())
      .on("postgres_changes", { event: "*", schema: "public", table: "pre_admissions",
        filter: `hospital_unit_id=eq.${currentHospital.id}` }, () => fetchWaitingPatients())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentHospital?.id]);

  const handlePullPatient = async (wp: WaitingPatient, consultorio: number) => {
    try {
      const prefix = `C${consultorio}-`;
      const { data: existing } = await supabase.from("patients").select("bed_number")
        .eq("hospital_unit_id", currentHospital!.id).eq("sector", "ue_vertical")
        .like("bed_number", `${prefix}%`);
      const nextNum = (existing?.length || 0) + 1;
      const bedNumber = `${prefix}${String(nextNum).padStart(2, "0")}`;

      const { error } = await supabase.from("patients").insert({
        name: wp.patient_name, bed_number: bedNumber, sector: "ue_vertical",
        hospital_unit_id: currentHospital!.id, state_id: currentState!.id,
        department: "URGÊNCIA E EMERGÊNCIA ADULTO", admission_date: new Date().toISOString(),
        diagnoses: wp.chief_complaint || null, display_order: nextNum,
      } as any);
      if (error) throw error;

      if (wp.source === "pre_admission") {
        await supabase.from("pre_admissions").update({ status: "admitido" } as any).eq("id", wp.id);
      }

      toast.success(`${wp.patient_name} → Consultório ${consultorio} (${bedNumber})`);
      setShowPull(false);
      fetchPatients();
      fetchWaitingPatients();
    } catch { toast.error("Erro ao puxar paciente"); }
  };

  const activePatients = patients.filter(p => !p.is_vacant);
  const filtered = activePatients.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.bed_number.toLowerCase().includes(search.toLowerCase()));
  const c1Patients = filtered.filter(p => getConsultorio(p.bed_number) === 1);
  const c2Patients = filtered.filter(p => getConsultorio(p.bed_number) === 2);
  const unassigned = filtered.filter(p => getConsultorio(p.bed_number) === 0);
  const canPull = role === "medico" || role === "admin" || role === "porta";

  const handleApplyPreset = (preset: AttendancePreset, items: PresetItem[], destination: string) => {
    toast.success(`Preset "${preset.label}" aplicado com ${items.length} itens → Destino: ${destination}`);
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        <UeVerticalHeader
          onRefresh={() => { fetchPatients(); fetchWaitingPatients(); }}
          isRefreshing={isLoading} search={search} onSearch={setSearch}
          c1Count={c1Patients.length} c2Count={c2Patients.length}
          waitingCount={waitingPatients.length}
          onPullPatient={() => { fetchWaitingPatients(); setShowPull(true); }}
        />
        <div className="pt-16 pb-8 px-2 sm:px-4 max-w-7xl mx-auto">
          <div className="grid grid-cols-5 gap-2 mb-4">
            <Card className="border-purple-200 dark:border-purple-800">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-purple-600">{activePatients.length}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-emerald-600">{c1Patients.length}</p>
                <p className="text-[10px] text-muted-foreground">C1</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-blue-600">{c2Patients.length}</p>
                <p className="text-[10px] text-muted-foreground">C2</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-amber-600">{waitingPatients.length}</p>
                <p className="text-[10px] text-muted-foreground">Aguardando</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{activePatients.filter(p => p.pendencies).length}</p>
                <p className="text-[10px] text-muted-foreground">Pendências</p>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <ConsultorioCard number={1} patients={c1Patients} color="emerald"
                  onQuickAttendance={setQuickTarget} onNavigate={navigate} />
                <ConsultorioCard number={2} patients={c2Patients} color="blue"
                  onQuickAttendance={setQuickTarget} onNavigate={navigate} />
              </div>

              {unassigned.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-2 bg-amber-50 dark:bg-amber-950/20 rounded-t-lg">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
                      <Clock className="h-4 w-4" /> Aguardando alocação em consultório
                      <Badge variant="secondary" className="ml-auto text-[10px]">{unassigned.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-2">
                    {unassigned.map(patient => (
                      <PatientRow key={patient.id} patient={patient}
                        onQuickAttendance={() => setQuickTarget(patient)} onNavigate={navigate} />
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {quickTarget && (
          <QuickAttendanceDialog open={!!quickTarget} onOpenChange={open => !open && setQuickTarget(null)}
            patientName={quickTarget.name} patientBed={quickTarget.bed_number} onApply={handleApplyPreset} />
        )}

        {canPull && (
          <PullPatientDialog open={showPull} onOpenChange={setShowPull}
            waitingPatients={waitingPatients} onPull={handlePullPatient} />
        )}
      </div>
    </MainLayout>
  );
}
