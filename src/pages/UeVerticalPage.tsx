import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Search, RefreshCw, User, Clock, Activity, Stethoscope,
  FileText, FlaskConical, ImageIcon, MessageSquare, Zap,
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
import { type AttendancePreset, type PresetItem } from "@/data/quickAttendancePresets";

const RISK_COLORS: Record<string, string> = {
  vermelho: "border-l-red-600 bg-red-50 dark:bg-red-950/20",
  laranja: "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20",
  amarelo: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
  verde: "border-l-green-600 bg-green-50 dark:bg-green-950/20",
  azul: "border-l-blue-600 bg-blue-50 dark:bg-blue-950/20",
};

const RISK_LABELS: Record<string, string> = {
  vermelho: "EMERGÊNCIA",
  laranja: "MUITO URGENTE",
  amarelo: "URGENTE",
  verde: "POUCO URGENTE",
  azul: "NÃO URGENTE",
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
}

function UeVerticalHeader({ onRefresh, isRefreshing, search, onSearch }: {
  onRefresh: () => void; isRefreshing: boolean; search: string; onSearch: (s: string) => void;
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
              <Badge className="bg-purple-500/30 text-purple-200 text-[10px] border-purple-400/30">Atendimento rápido</Badge>
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

function PatientRow({ patient, onQuickAttendance, onNavigate }: {
  patient: UePatient;
  onQuickAttendance: () => void;
  onNavigate: (path: string) => void;
}) {
  const diagnoses = patient.diagnoses?.split("\n").filter(Boolean) || [];
  const pendencies = patient.pendencies?.split("\n").filter(Boolean) || [];
  const waitTime = patient.admission_date
    ? formatDistanceToNow(new Date(patient.admission_date), { locale: ptBR, addSuffix: false })
    : null;

  const params = new URLSearchParams({
    patientId: patient.id,
    patientName: patient.name,
    patientBed: patient.bed_number,
    patientSector: "ue_vertical",
  }).toString();

  if (patient.is_vacant) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border-l-4 rounded-lg border bg-card p-3 hover:shadow-md transition-all",
        patient.risk_classification ? RISK_COLORS[patient.risk_classification] : "border-l-muted"
      )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] font-bold px-1.5 bg-primary/10 text-primary border-primary/30">
              {patient.bed_number}
            </Badge>
            <span className="text-xs font-bold truncate">{patient.name}</span>
            {patient.age && <span className="text-[10px] text-muted-foreground">{patient.age}a</span>}
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
            <p className="text-[10px] text-amber-600 dark:text-amber-400 truncate">
              ⚠ {pendencies[0]}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="default" className="h-7 text-[10px] gap-1" onClick={onQuickAttendance}>
            <Zap className="h-3 w-3" /> Rápido
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
            onClick={() => onNavigate(`/evolucao?${params}`)}>
            <Stethoscope className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
            onClick={() => onNavigate(`/prescricao?${params}`)}>
            <FileText className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
            onClick={() => onNavigate(`/requisicao?${params}&category=laboratorio`)}>
            <FlaskConical className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
            onClick={() => onNavigate(`/requisicao?${params}&category=imagem`)}>
            <ImageIcon className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
            onClick={() => onNavigate(`/requisicao?${params}&category=parecer`)}>
            <MessageSquare className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function UeVerticalPage() {
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
        .eq("sector", "ue_vertical")
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
      })));
    } catch (err) {
      console.error("Fetch UE Vertical error:", err);
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
    // In a full implementation, this would create prescription, exam requests, etc.
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        <UeVerticalHeader onRefresh={fetchPatients} isRefreshing={isLoading} search={search} onSearch={setSearch} />
        <div className="pt-16 pb-8 px-2 sm:px-4 max-w-5xl mx-auto">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Card className="border-purple-200 dark:border-purple-800">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-purple-600">{activeCount}</p>
                <p className="text-[10px] text-muted-foreground">Em atendimento</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-amber-600">
                  {patients.filter(p => !p.is_vacant && p.pendencies).length}
                </p>
                <p className="text-[10px] text-muted-foreground">Com pendências</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{patients.filter(p => p.is_vacant).length}</p>
                <p className="text-[10px] text-muted-foreground">Vagos</p>
              </CardContent>
            </Card>
          </div>

          {/* Patient list */}
          <div className="space-y-2">
            {isLoading ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum paciente na UE Vertical</CardContent></Card>
            ) : (
              filtered.map(patient => (
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  onQuickAttendance={() => setQuickTarget(patient)}
                  onNavigate={navigate}
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
