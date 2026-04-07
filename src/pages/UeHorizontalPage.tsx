import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Search, RefreshCw, Clock, Activity, Stethoscope,
  FileText, FlaskConical, ImageIcon, MessageSquare, Zap,
  ArrowRight, BedDouble,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { QuickAttendanceDialog } from "@/components/QuickAttendanceDialog";
import { DESTINATION_OPTIONS, type AttendancePreset, type PresetItem } from "@/data/quickAttendancePresets";

const RISK_COLORS: Record<string, string> = {
  vermelho: "border-l-red-600",
  laranja: "border-l-orange-500",
  amarelo: "border-l-yellow-500",
  verde: "border-l-green-600",
  azul: "border-l-blue-600",
};

const RISK_LABELS: Record<string, string> = {
  vermelho: "EMERGÊNCIA",
  laranja: "MUITO URGENTE",
  amarelo: "URGENTE",
  verde: "POUCO URGENTE",
  azul: "NÃO URGENTE",
};

const CLINICAL_STATUS_COLORS: Record<string, string> = {
  gravissimo: "bg-red-600 text-white",
  grave: "bg-orange-600 text-white",
  grave_estavel: "bg-amber-500 text-black",
  potencialmente_grave: "bg-yellow-500 text-black",
  regular: "bg-green-600 text-white",
  paliativado: "bg-violet-600 text-white",
};

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
  risk_classification?: string;
  medical_history?: string;
  schedule?: string;
}

function UeHorizontalHeader({ onRefresh, isRefreshing, search, onSearch }: {
  onRefresh: () => void; isRefreshing: boolean; search: string; onSearch: (s: string) => void;
}) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <header
      className="border-b border-white/10 bg-gradient-to-r from-[#0a1628] via-[#142952] to-[#1a3a6c] backdrop-blur-xl fixed top-0 right-0 z-50 shadow-lg transition-[left] duration-200 ease-linear"
      style={{ left: isMobile ? 0 : (state === "collapsed" ? "var(--sidebar-width-icon)" : "var(--sidebar-width)") }}
    >
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <SidebarTrigger className="flex-shrink-0 text-white hover:text-white hover:bg-white/25 border-white/30 transition-all" />
            <div className="flex items-center gap-1.5">
              <BedDouble className="h-4 w-4 text-indigo-300" />
              <span className="text-sm font-bold text-white">UE Horizontal</span>
              <Badge className="bg-indigo-500/30 text-indigo-200 text-[10px] border-indigo-400/30">Macas / Obs. estendida</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <Input
                value={search}
                onChange={e => onSearch(e.target.value)}
                placeholder="Buscar paciente..."
                className="h-8 w-40 pl-8 text-xs bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
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

function HorizontalPatientCard({ patient, onQuickAttendance, onNavigate, onDestination }: {
  patient: UePatient;
  onQuickAttendance: () => void;
  onNavigate: (path: string) => void;
  onDestination: (patientId: string, dest: string) => void;
}) {
  const diagnoses = patient.diagnoses?.split("\n").filter(Boolean) || [];
  const pendencies = patient.pendencies?.split("\n").filter(Boolean) || [];
  const schedule = patient.schedule?.split("\n").filter(Boolean) || [];
  const waitTime = patient.admission_date
    ? formatDistanceToNow(new Date(patient.admission_date), { locale: ptBR, addSuffix: false })
    : null;

  const params = new URLSearchParams({
    patientId: patient.id,
    patientName: patient.name,
    patientBed: patient.bed_number,
    patientSector: "ue_horizontal",
  }).toString();

  if (patient.is_vacant) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border-l-4 rounded-xl border bg-card hover:shadow-lg transition-all",
        patient.risk_classification ? RISK_COLORS[patient.risk_classification] : "border-l-muted"
      )}>
      <div className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge variant="outline" className="text-[10px] font-bold px-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700">
              🛏 {patient.bed_number}
            </Badge>
            <span className="text-xs font-bold truncate">{patient.name}</span>
            {patient.age && <span className="text-[10px] text-muted-foreground">{patient.age}a</span>}
            {patient.medical_record && <span className="text-[10px] text-muted-foreground">Pront: {patient.medical_record}</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {patient.risk_classification && (
              <Badge className={cn("text-[9px] text-white",
                patient.risk_classification === "vermelho" && "bg-red-600",
                patient.risk_classification === "laranja" && "bg-orange-500",
                patient.risk_classification === "amarelo" && "bg-yellow-500 text-black",
                patient.risk_classification === "verde" && "bg-green-600",
                patient.risk_classification === "azul" && "bg-blue-600",
              )}>
                {RISK_LABELS[patient.risk_classification]}
              </Badge>
            )}
            {patient.clinical_status && (
              <Badge className={cn("text-[9px]", CLINICAL_STATUS_COLORS[patient.clinical_status])}>
                {patient.clinical_status.replace('_', ' ')}
              </Badge>
            )}
            {waitTime && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {waitTime}
              </span>
            )}
          </div>
        </div>

        {/* Clinical info */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {diagnoses.length > 0 && (
            <div>
              <span className="text-muted-foreground font-medium">Diagnósticos:</span>
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {diagnoses.slice(0, 3).map((d, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px]">{d}</Badge>
                ))}
              </div>
            </div>
          )}
          {pendencies.length > 0 && (
            <div>
              <span className="text-muted-foreground font-medium">Pendências:</span>
              <div className="space-y-0.5 mt-0.5">
                {pendencies.slice(0, 2).map((p, i) => (
                  <p key={i} className="text-amber-600 dark:text-amber-400 truncate">⚠ {p}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-1 pt-1 border-t border-border/50 flex-wrap">
          <Button size="sm" className="h-7 text-[10px] gap-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={onQuickAttendance}>
            <Zap className="h-3 w-3" /> Atendimento Rápido
          </Button>
          <div className="flex gap-0.5">
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-0.5" title="Evolução"
              onClick={() => onNavigate(`/evolucao?${params}`)}>
              <Stethoscope className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-0.5" title="Prescrição"
              onClick={() => onNavigate(`/prescricao?${params}`)}>
              <FileText className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-0.5" title="Laboratório"
              onClick={() => onNavigate(`/requisicao?${params}&category=laboratorio`)}>
              <FlaskConical className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-0.5" title="Imagem"
              onClick={() => onNavigate(`/requisicao?${params}&category=imagem`)}>
              <ImageIcon className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-0.5" title="Parecer"
              onClick={() => onNavigate(`/requisicao?${params}&category=parecer`)}>
              <MessageSquare className="h-3 w-3" />
            </Button>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Select onValueChange={val => onDestination(patient.id, val)}>
              <SelectTrigger className="h-7 w-[130px] text-[10px]">
                <SelectValue placeholder="Destino..." />
              </SelectTrigger>
              <SelectContent>
                {DESTINATION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function UeHorizontalPage() {
  const [patients, setPatients] = useState<UePatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [quickTarget, setQuickTarget] = useState<UePatient | null>(null);
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const navigate = useNavigate();

  const fetchPatients = async () => {
    if (!currentHospital?.id || !currentState?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .eq("department", currentDepartment)
        .eq("sector", "ue_horizontal")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setPatients((data || []).map(p => ({
        id: p.id,
        name: p.name,
        bed_number: p.bed_number,
        age: p.age || undefined,
        diagnoses: p.diagnoses || undefined,
        pendencies: p.pendencies || undefined,
        admission_date: p.admission_date || undefined,
        clinical_status: p.clinical_status || undefined,
        medical_record: p.medical_record || undefined,
        is_vacant: p.is_vacant || false,
        medical_history: p.medical_history || undefined,
        schedule: p.schedule || undefined,
      })));
    } catch (err) {
      console.error("Fetch UE Horizontal error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPatients(); }, [currentHospital?.id, currentState?.id, currentDepartment]);

  const filtered = patients.filter(p =>
    !p.is_vacant && (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.bed_number.toLowerCase().includes(search.toLowerCase()))
  );

  const activeCount = patients.filter(p => !p.is_vacant).length;

  const handleApplyPreset = (preset: AttendancePreset, items: PresetItem[], destination: string) => {
    toast.success(`Preset "${preset.label}" aplicado com ${items.length} itens → Destino: ${destination}`);
  };

  const handleDestination = (patientId: string, dest: string) => {
    const destLabel = DESTINATION_OPTIONS.find(d => d.value === dest)?.label || dest;
    toast.info(`Paciente encaminhado para: ${destLabel}`);
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        <UeHorizontalHeader onRefresh={fetchPatients} isRefreshing={isLoading} search={search} onSearch={setSearch} />
        <div className="pt-16 pb-8 px-2 sm:px-4 max-w-5xl mx-auto">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <Card className="border-indigo-200 dark:border-indigo-800">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-indigo-600">{activeCount}</p>
                <p className="text-[10px] text-muted-foreground">Em maca</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-red-600">
                  {patients.filter(p => !p.is_vacant && (p.risk_classification === 'vermelho' || p.risk_classification === 'laranja')).length}
                </p>
                <p className="text-[10px] text-muted-foreground">Críticos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-amber-600">
                  {patients.filter(p => !p.is_vacant && p.pendencies).length}
                </p>
                <p className="text-[10px] text-muted-foreground">Pendências</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{patients.filter(p => p.is_vacant).length}</p>
                <p className="text-[10px] text-muted-foreground">Macas vagas</p>
              </CardContent>
            </Card>
          </div>

          {/* Patient cards */}
          <div className="space-y-2">
            {isLoading ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum paciente na UE Horizontal</CardContent></Card>
            ) : (
              filtered.map(patient => (
                <HorizontalPatientCard
                  key={patient.id}
                  patient={patient}
                  onQuickAttendance={() => setQuickTarget(patient)}
                  onNavigate={navigate}
                  onDestination={handleDestination}
                />
              ))
            )}
          </div>
        </div>

        {quickTarget && (
          <QuickAttendanceDialog
            open={!!quickTarget}
            onOpenChange={open => !open && setQuickTarget(null)}
            patientName={quickTarget.name}
            patientBed={quickTarget.bed_number}
            onApply={handleApplyPreset}
          />
        )}
      </div>
    </MainLayout>
  );
}
