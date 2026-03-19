import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { ClinicalNavTabs } from "@/components/ClinicalNavTabs";
import {
  AlertTriangle,
  BedDouble,
  Plus,
  Save,
  Trash2,
  User,
  Clock,
  Activity,
  RefreshCw,
  Search,
  Stethoscope,
  ArrowRight,
  Heart,
  ChevronDown,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { SECTOR_BED_CONFIG, getSectorDisplayLabel } from "@/utils/bedNaming";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Emergency sectors config
const EMERGENCY_SECTORS = [
  { key: "sala_vermelha", label: "Sala Vermelha", color: "bg-red-600", description: "Choque / Estabilização" },
  { key: "sala_laranja", label: "Obs. Laranja", color: "bg-orange-500", description: "Observação clínica completa" },
  { key: "ue_vertical", label: "UE Vertical", color: "bg-purple-600", description: "Atendimento rápido" },
  { key: "ue_horizontal", label: "UE Horizontal", color: "bg-indigo-600", description: "Observação estendida" },
];

// Sectors with full clinical logic (like UTI)
const FULL_LOGIC_SECTORS = ["sala_laranja"];

interface EmergencyPatient {
  id: string;
  name: string;
  bed_number: string;
  sector: string;
  age?: string;
  diagnoses?: string;
  medical_history?: string;
  relevant_exams?: string;
  pendencies?: string;
  schedule?: string;
  admission_date?: string;
  admission_history?: string;
  clinical_status?: string;
  medical_record?: string;
  is_vacant?: boolean;
}

function EmergencyHeader({ activeSector, onSectorChange, onRefresh, isRefreshing }: {
  activeSector: string;
  onSectorChange: (s: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const sectorConfig = EMERGENCY_SECTORS.find(s => s.key === activeSector);

  return (
    <header
      className="border-b border-white/10 bg-gradient-to-r from-[#1a0a0a] via-[#2d1515] to-[#3a1c1c] backdrop-blur-xl fixed top-0 right-0 z-50 shadow-lg transition-[left] duration-200 ease-linear"
      style={{
        left: isMobile ? 0 : (state === "collapsed" ? "var(--sidebar-width-icon)" : "var(--sidebar-width)"),
      }}
    >
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <SidebarTrigger className="flex-shrink-0 text-white hover:text-white hover:bg-white/25 border-white/30 hover:border-white/50 transition-all duration-200" />
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-white/90 whitespace-nowrap">Emergência</span>
              <span className="text-white/30 text-xs">/</span>
              <Select value={activeSector} onValueChange={onSectorChange}>
                <SelectTrigger className="h-7 w-auto gap-1 bg-white/10 border-white/20 text-xs text-white font-medium px-2.5 focus:ring-0 focus:ring-offset-0 hover:bg-white/20 transition-colors [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-white/60 rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMERGENCY_SECTORS.map(s => (
                    <SelectItem key={s.key} value={s.key} className="text-xs font-medium">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-white/30 text-xs">/</span>
              <ClinicalNavTabs variant="dark" />
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40 transition-all"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>
    </header>
  );
}

// ── Simplified Patient Card (Sala Vermelha, UE Vertical, UE Horizontal) ──
function SimplifiedPatientCard({ patient, onView }: { patient: EmergencyPatient; onView: () => void }) {
  const diagnoses = patient.diagnoses?.split("\n").filter(Boolean) || [];
  const pendencies = patient.pendencies?.split("\n").filter(Boolean) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-xl bg-card hover:shadow-md transition-all duration-200"
    >
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary border-primary/30">
              {patient.bed_number}
            </Badge>
            <span className="text-xs font-semibold text-foreground truncate max-w-[180px]">
              {patient.is_vacant ? "— Vago —" : patient.name}
            </span>
          </div>
          {!patient.is_vacant && (
            <div className="flex items-center gap-1">
              {patient.age && <span className="text-[10px] text-muted-foreground">{patient.age}a</span>}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onView}>
                <Eye className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {!patient.is_vacant && (
          <>
            {diagnoses.length > 0 && (
              <div>
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Diagnósticos</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {diagnoses.slice(0, 3).map((d, i) => (
                    <Badge key={i} variant="secondary" className="text-[9px] py-0 px-1.5 font-normal">{d}</Badge>
                  ))}
                </div>
              </div>
            )}

            {patient.clinical_status && (
              <Badge
                className={cn("text-[9px] py-0 px-1.5", {
                  "bg-red-500/20 text-red-600 border-red-500/30": patient.clinical_status === "gravissimo" || patient.clinical_status === "grave",
                  "bg-yellow-500/20 text-yellow-600 border-yellow-500/30": patient.clinical_status === "grave_estavel" || patient.clinical_status === "potencialmente_grave",
                  "bg-green-500/20 text-green-600 border-green-500/30": patient.clinical_status === "regular",
                  "bg-purple-500/20 text-purple-600 border-purple-500/30": patient.clinical_status === "paliativado",
                })}
                variant="outline"
              >
                {patient.clinical_status === "gravissimo" ? "Gravíssimo" :
                 patient.clinical_status === "grave" ? "Grave" :
                 patient.clinical_status === "grave_estavel" ? "Grave/Estável" :
                 patient.clinical_status === "potencialmente_grave" ? "Pot. Grave" :
                 patient.clinical_status === "regular" ? "Regular" : "Paliativado"}
              </Badge>
            )}

            {pendencies.length > 0 && (
              <div>
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Pendências</span>
                <ul className="mt-0.5 space-y-0.5">
                  {pendencies.slice(0, 2).map((p, i) => (
                    <li key={i} className="text-[10px] text-foreground flex items-start gap-1">
                      <ArrowRight className="h-2.5 w-2.5 mt-0.5 text-primary flex-shrink-0" />
                      <span className="line-clamp-1">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {patient.admission_date && (
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {formatDistanceToNow(new Date(patient.admission_date), { locale: ptBR, addSuffix: true })}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Full Patient Card (Obs. Laranja — same detail level as UTI/UCI) ──
function FullPatientCard({ patient, onView }: { patient: EmergencyPatient; onView: () => void }) {
  const diagnoses = patient.diagnoses?.split("\n").filter(Boolean) || [];
  const history = patient.medical_history?.split("\n").filter(Boolean) || [];
  const exams = patient.relevant_exams?.split("\n").filter(Boolean) || [];
  const pendencies = patient.pendencies?.split("\n").filter(Boolean) || [];
  const schedule = patient.schedule?.split("\n").filter(Boolean) || [];
  const [isOpen, setIsOpen] = useState(true);

  if (patient.is_vacant) {
    return (
      <div className="border border-dashed border-border/50 rounded-xl bg-muted/20 p-3 flex items-center justify-center min-h-[60px]">
        <div className="flex items-center gap-2">
          <BedDouble className="h-4 w-4 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground/60 font-medium">{patient.bed_number} — Vago</span>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-border rounded-xl bg-card hover:shadow-md transition-all duration-200"
      >
        <CollapsibleTrigger className="w-full">
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-500/10 text-orange-600 border-orange-500/30">
                {patient.bed_number}
              </Badge>
              <span className="text-xs font-semibold text-foreground">{patient.name}</span>
              {patient.age && <span className="text-[10px] text-muted-foreground">({patient.age}a)</span>}
              {patient.clinical_status && (
                <Badge
                  className={cn("text-[9px] py-0 px-1.5", {
                    "bg-red-500/20 text-red-600": patient.clinical_status === "gravissimo" || patient.clinical_status === "grave",
                    "bg-yellow-500/20 text-yellow-600": patient.clinical_status === "grave_estavel",
                    "bg-green-500/20 text-green-600": patient.clinical_status === "regular",
                  })}
                  variant="outline"
                >
                  {patient.clinical_status === "gravissimo" ? "Gravíssimo" :
                   patient.clinical_status === "grave" ? "Grave" :
                   patient.clinical_status === "grave_estavel" ? "Grave/Estável" :
                   patient.clinical_status === "potencialmente_grave" ? "Pot. Grave" :
                   patient.clinical_status === "regular" ? "Regular" : "Paliativado"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onView(); }}>
                <Eye className="h-3 w-3" />
              </Button>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Diagnoses */}
              {diagnoses.length > 0 && (
                <div>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Hipóteses / Diagnósticos</span>
                  <ul className="mt-1 space-y-0.5">
                    {diagnoses.map((d, i) => (
                      <li key={i} className="text-[10px] text-foreground flex items-start gap-1">
                        <Stethoscope className="h-2.5 w-2.5 mt-0.5 text-primary flex-shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* History */}
              {history.length > 0 && (
                <div>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Antecedentes</span>
                  <ul className="mt-1 space-y-0.5">
                    {history.map((h, i) => (
                      <li key={i} className="text-[10px] text-foreground">{h}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Exams */}
              {exams.length > 0 && (
                <div>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Exames Relevantes</span>
                  <ul className="mt-1 space-y-0.5">
                    {exams.map((e, i) => (
                      <li key={i} className="text-[10px] text-foreground">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Pendencies */}
              {pendencies.length > 0 && (
                <div>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Pendências</span>
                  <ul className="mt-1 space-y-0.5">
                    {pendencies.map((p, i) => (
                      <li key={i} className="text-[10px] text-foreground flex items-start gap-1">
                        <AlertTriangle className="h-2.5 w-2.5 mt-0.5 text-amber-500 flex-shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {/* Schedule */}
            {schedule.length > 0 && (
              <div>
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Programações</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {schedule.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] py-0 px-1.5 font-normal">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {patient.admission_date && (
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground pt-1">
                <Clock className="h-2.5 w-2.5" />
                Admitido {formatDistanceToNow(new Date(patient.admission_date), { locale: ptBR, addSuffix: true })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
}

// ── Patient Detail Dialog ──
function PatientDetailDialog({ patient, open, onClose }: { patient: EmergencyPatient | null; open: boolean; onClose: () => void }) {
  if (!patient) return null;
  const diagnoses = patient.diagnoses?.split("\n").filter(Boolean) || [];
  const history = patient.medical_history?.split("\n").filter(Boolean) || [];
  const exams = patient.relevant_exams?.split("\n").filter(Boolean) || [];
  const pendencies = patient.pendencies?.split("\n").filter(Boolean) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="text-xs">{patient.bed_number}</Badge>
            {patient.name}
            {patient.age && <span className="text-muted-foreground font-normal">({patient.age}a)</span>}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-2">
            {patient.admission_history && (
              <div>
                <Label className="text-xs font-semibold">História da Admissão</Label>
                <p className="text-xs text-muted-foreground mt-1">{patient.admission_history}</p>
              </div>
            )}
            {diagnoses.length > 0 && (
              <div>
                <Label className="text-xs font-semibold">Diagnósticos</Label>
                <ul className="mt-1 space-y-1">
                  {diagnoses.map((d, i) => <li key={i} className="text-xs">{d}</li>)}
                </ul>
              </div>
            )}
            {history.length > 0 && (
              <div>
                <Label className="text-xs font-semibold">Antecedentes</Label>
                <ul className="mt-1 space-y-1">
                  {history.map((h, i) => <li key={i} className="text-xs">{h}</li>)}
                </ul>
              </div>
            )}
            {exams.length > 0 && (
              <div>
                <Label className="text-xs font-semibold">Exames Relevantes</Label>
                <ul className="mt-1 space-y-1">
                  {exams.map((e, i) => <li key={i} className="text-xs">{e}</li>)}
                </ul>
              </div>
            )}
            {pendencies.length > 0 && (
              <div>
                <Label className="text-xs font-semibold">Pendências</Label>
                <ul className="mt-1 space-y-1">
                  {pendencies.map((p, i) => <li key={i} className="text-xs">{p}</li>)}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──
export default function EmergenciaSectorPage() {
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [activeSector, setActiveSector] = useState<string>(() => {
    const stored = localStorage.getItem("selected_emergency_sector");
    return stored && EMERGENCY_SECTORS.some(s => s.key === stored) ? stored : "sala_vermelha";
  });
  const [patients, setPatients] = useState<EmergencyPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<EmergencyPatient | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState("");

  const isFullLogic = FULL_LOGIC_SECTORS.includes(activeSector);
  const sectorConfig = EMERGENCY_SECTORS.find(s => s.key === activeSector);

  const handleSectorChange = (sector: string) => {
    setActiveSector(sector);
    localStorage.setItem("selected_emergency_sector", sector);
  };

  const fetchPatients = async () => {
    if (!currentHospital || !currentState) return;
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .eq("department", "URGÊNCIA E EMERGÊNCIA ADULTO")
        .eq("sector", activeSector)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (err) {
      console.error("Error fetching emergency patients:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchPatients();
  }, [activeSector, currentHospital, currentState]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPatients();
  };

  const handleViewPatient = (patient: EmergencyPatient) => {
    setSelectedPatient(patient);
    setDetailOpen(true);
  };

  const filteredPatients = search
    ? patients.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.bed_number?.toLowerCase().includes(search.toLowerCase()) ||
        p.diagnoses?.toLowerCase().includes(search.toLowerCase())
      )
    : patients;

  const occupied = filteredPatients.filter(p => !p.is_vacant && p.name?.trim()).length;
  const total = filteredPatients.length;
  const vacant = total - occupied;

  return (
    <MainLayout>
      <EmergencyHeader
        activeSector={activeSector}
        onSectorChange={handleSectorChange}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 pt-[70px]">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-[60vh]">
              <div className="flex flex-col items-center gap-3">
                <Activity className="h-8 w-8 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">Carregando setor...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              {/* KPI Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <Card className="bg-card/80">
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Setor Ativo</p>
                    <p className="text-lg font-bold text-foreground mt-1">{sectorConfig?.label}</p>
                    <p className="text-[10px] text-muted-foreground">{sectorConfig?.description}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/80">
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ocupação</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{total > 0 ? Math.round((occupied / total) * 100) : 0}%</p>
                    <p className="text-[10px] text-muted-foreground">{occupied}/{total} leitos</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/80">
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ocupados</p>
                    <p className="text-2xl font-bold text-primary mt-1">{occupied}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/80">
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Vagos</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{vacant}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Search */}
              <div className="relative mb-4 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar paciente, leito, diagnóstico..."
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Patient Grid */}
              {filteredPatients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <BedDouble className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <h3 className="text-sm font-semibold text-muted-foreground">Nenhum paciente neste setor</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Pacientes serão exibidos aqui quando forem admitidos na {sectorConfig?.label}
                  </p>
                </div>
              ) : isFullLogic ? (
                // Full clinical cards for Obs. Laranja
                <div className="space-y-3">
                  {filteredPatients.map(patient => (
                    <FullPatientCard key={patient.id} patient={patient} onView={() => handleViewPatient(patient)} />
                  ))}
                </div>
              ) : (
                // Simplified grid for Sala Vermelha, UE Vertical/Horizontal
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredPatients.map(patient => (
                    <SimplifiedPatientCard key={patient.id} patient={patient} onView={() => handleViewPatient(patient)} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <PatientDetailDialog patient={selectedPatient} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </MainLayout>
  );
}
