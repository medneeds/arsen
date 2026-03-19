import React, { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Microscope, Search, Clock, CheckCircle2, Upload, RefreshCw,
  AlertTriangle, User, BedDouble, Plus, FileText, Loader2, Eye,
  Pill, History, FlaskConical, CalendarDays, Info, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { SECTOR_BED_CONFIG, getSectorDisplayLabel } from "@/utils/bedNaming";
import ExamResultInput, { ResultFile } from "@/components/ExamResultInput";

const SECTORS = ["red", "yellow", "blue", "outside"] as const;

const SECTOR_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  red: { border: "border-red-300", bg: "bg-red-50/50 dark:bg-red-500/5", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  yellow: { border: "border-amber-300", bg: "bg-amber-50/50 dark:bg-amber-500/5", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  blue: { border: "border-blue-300", bg: "bg-blue-50/50 dark:bg-blue-500/5", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  outside: { border: "border-emerald-300", bg: "bg-emerald-50/50 dark:bg-emerald-500/5", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
};

const CULTURE_TYPES = [
  { value: "hemocultura", label: "Hemocultura" },
  { value: "urocultura", label: "Urocultura" },
  { value: "cultura_secrecao", label: "Cultura de secreção" },
  { value: "cultura_liquor", label: "Cultura de líquor" },
  { value: "cultura_cateter", label: "Cultura de ponta de cateter" },
  { value: "cultura_escarro", label: "Cultura de escarro" },
  { value: "cultura_ferida", label: "Cultura de ferida" },
  { value: "antibiograma", label: "Antibiograma" },
  { value: "outro", label: "Outro" },
];

interface PatientBasic {
  id: string;
  name: string;
  bed_number: string;
  sector: string;
  age: string | null;
  diagnoses: string | null;
  admission_date: string | null;
  uti_cultures_antibiotics: string | null;
}

interface CultureExamRequest {
  id: string;
  items: any[];
  status: string;
  priority: string;
  created_at: string;
  requested_by_name: string | null;
  results: string | null;
}

interface AntibioticPrescription {
  id: string;
  patient_name: string;
  items: any[];
  status: string;
  created_at: string;
  version: number;
}

interface CultureResult {
  id: string;
  patient_id: string | null;
  patient_name: string;
  patient_sector: string;
  patient_bed: string | null;
  culture_type: string;
  collection_date: string | null;
  result_text: string | null;
  result_files: any;
  microorganism: string | null;
  antibiogram: string | null;
  sensitivity_profile: string | null;
  status: string;
  uploaded_by_name: string | null;
  read_by_doctor: boolean;
  created_at: string;
}

const CcihDashboardPage = () => {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const hospitalId = currentHospital?.id;
  const stateId = currentState?.id;

  const [patients, setPatients] = useState<PatientBasic[]>([]);
  const [cultureResults, setCultureResults] = useState<CultureResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeSector, setActiveSector] = useState<string>("all");

  // New culture dialog
  const [showNewCulture, setShowNewCulture] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientBasic | null>(null);
  const [cultureType, setCultureType] = useState("hemocultura");
  const [collectionDate, setCollectionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [microorganism, setMicroorganism] = useState("");
  const [antibiogram, setAntibiogram] = useState("");
  const [sensitivityProfile, setSensitivityProfile] = useState("");
  const [resultText, setResultText] = useState("");
  const [resultFiles, setResultFiles] = useState<ResultFile[]>([]);
  const [saving, setSaving] = useState(false);

  // Patient detail dialog (CCIH view)
  const [showPatientDetail, setShowPatientDetail] = useState(false);
  const [detailPatient, setDetailPatient] = useState<PatientBasic | null>(null);
  const [detailCultureRequests, setDetailCultureRequests] = useState<CultureExamRequest[]>([]);
  const [detailPrescriptions, setDetailPrescriptions] = useState<AntibioticPrescription[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // View culture dialog
  const [showViewCulture, setShowViewCulture] = useState(false);
  const [viewCulture, setViewCulture] = useState<CultureResult | null>(null);

  const fetchData = async () => {
    if (!hospitalId || !stateId) return;
    setLoading(true);
    try {
      const [patientsRes, culturesRes] = await Promise.all([
        supabase
          .from("patients")
          .select("id, name, bed_number, sector, age, diagnoses, admission_date, uti_cultures_antibiotics")
          .eq("hospital_unit_id", hospitalId)
          .eq("state_id", stateId)
          .eq("is_vacant", false)
          .neq("name", "")
          .order("sector")
          .order("bed_number"),
        supabase
          .from("culture_results")
          .select("*")
          .eq("hospital_unit_id", hospitalId)
          .eq("state_id", stateId)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (patientsRes.error) throw patientsRes.error;
      if (culturesRes.error) throw culturesRes.error;

      setPatients((patientsRes.data as PatientBasic[]) || []);
      setCultureResults((culturesRes.data as CultureResult[]) || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [hospitalId, stateId]);

  // Realtime subscription for culture_results
  useEffect(() => {
    if (!hospitalId) return;
    const channel = supabase
      .channel("ccih-cultures")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "culture_results",
        filter: `hospital_unit_id=eq.${hospitalId}`,
      }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hospitalId]);

  const patientsBySector = useMemo(() => {
    const grouped: Record<string, PatientBasic[]> = {};
    SECTORS.forEach(s => { grouped[s] = []; });
    patients.forEach(p => {
      if (grouped[p.sector]) grouped[p.sector].push(p);
    });
    return grouped;
  }, [patients]);

  const filteredPatientsBySector = useMemo(() => {
    if (!search) return patientsBySector;
    const term = search.toLowerCase();
    const filtered: Record<string, PatientBasic[]> = {};
    SECTORS.forEach(s => {
      filtered[s] = patientsBySector[s].filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.bed_number.toLowerCase().includes(term)
      );
    });
    return filtered;
  }, [patientsBySector, search]);

  const culturesForPatient = (patientId: string) =>
    cultureResults.filter(c => c.patient_id === patientId);

  const stats = useMemo(() => ({
    total: cultureResults.length,
    pending: cultureResults.filter(c => c.status === "pending").length,
    completed: cultureResults.filter(c => c.status === "completed").length,
    unread: cultureResults.filter(c => !c.read_by_doctor && c.status === "completed").length,
  }), [cultureResults]);

  const openPatientDetail = async (patient: PatientBasic) => {
    setDetailPatient(patient);
    setShowPatientDetail(true);
    setLoadingDetail(true);
    setDetailCultureRequests([]);
    setDetailPrescriptions([]);

    try {
      // Fetch culture-related exam requests and prescriptions in parallel
      const [examRes, prescRes] = await Promise.all([
        supabase
          .from("exam_requests")
          .select("id, items, status, priority, created_at, requested_by_name, results")
          .eq("hospital_unit_id", hospitalId!)
          .eq("state_id", stateId!)
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("prescriptions")
          .select("id, patient_name, items, status, created_at, version")
          .eq("hospital_unit_id", hospitalId!)
          .eq("state_id", stateId!)
          .eq("patient_name", patient.name)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      // Filter exam requests that contain culture-related items
      const cultureKeywords = ["cultura", "hemocultura", "urocultura", "antibiograma", "gram", "microbiologia"];
      const cultureExams = (examRes.data || []).filter((req: any) => {
        const items = Array.isArray(req.items) ? req.items : [];
        return items.some((item: any) => {
          const name = (item.name || item || "").toString().toLowerCase();
          return cultureKeywords.some(kw => name.includes(kw));
        });
      });
      setDetailCultureRequests(cultureExams as CultureExamRequest[]);

      // Filter prescriptions that contain antibiotic items
      const antibioticKeywords = [
        "antibiótico", "antimicrobiano", "amoxicilina", "ampicilina", "azitromicina",
        "ceftriaxona", "cefazolina", "cefepima", "ceftazidima", "ciprofloxacino",
        "clindamicina", "gentamicina", "amicacina", "levofloxacino", "meropenem",
        "imipenem", "ertapenem", "metronidazol", "oxacilina", "penicilina",
        "piperacilina", "tazobactam", "polimixina", "vancomicina", "teicoplanina",
        "linezolida", "daptomicina", "sulfametoxazol", "trimetoprima",
        "cefuroxima", "cefalexina", "doxiciclina", "claritromicina",
        "fluconazol", "anfotericina", "micafungina", "anidulafungina", "caspofungina",
        "aciclovir", "oseltamivir", "colistina", "tigeciclina", "rifampicina",
      ];
      const abxPrescriptions = (prescRes.data || []).filter((rx: any) => {
        const items = Array.isArray(rx.items) ? rx.items : [];
        return items.some((item: any) => {
          const name = (item.name || item.medication || "").toString().toLowerCase();
          return antibioticKeywords.some(kw => name.includes(kw));
        });
      });
      setDetailPrescriptions(abxPrescriptions as AntibioticPrescription[]);
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openNewCulture = (patient: PatientBasic) => {
    setSelectedPatient(patient);
    setCultureType("hemocultura");
    setCollectionDate(format(new Date(), "yyyy-MM-dd"));
    setMicroorganism("");
    setAntibiogram("");
    setSensitivityProfile("");
    setResultText("");
    setResultFiles([]);
    setShowNewCulture(true);
  };

  const handleSaveCulture = async () => {
    if (!selectedPatient || !hospitalId || !stateId) return;
    setSaving(true);
    try {
      const profileRes = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();
      const uploaderName = profileRes.data?.full_name || user?.email || "CCIH";

      const { error } = await supabase
        .from("culture_results")
        .insert({
          patient_id: selectedPatient.id,
          patient_name: selectedPatient.name,
          patient_sector: selectedPatient.sector,
          patient_bed: selectedPatient.bed_number,
          culture_type: cultureType,
          collection_date: collectionDate || null,
          result_text: resultText || null,
          result_files: resultFiles.length > 0 ? resultFiles : [],
          microorganism: microorganism || null,
          antibiogram: antibiogram || null,
          sensitivity_profile: sensitivityProfile || null,
          status: "completed",
          uploaded_by: user?.id,
          uploaded_by_name: uploaderName,
          notified_at: new Date().toISOString(),
          hospital_unit_id: hospitalId,
          state_id: stateId,
        } as any);

      if (error) throw error;

      toast.success(`Resultado de cultura registrado para ${selectedPatient.name}`);
      setShowNewCulture(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar resultado de cultura");
    } finally {
      setSaving(false);
    }
  };

  const openViewCulture = (culture: CultureResult) => {
    setViewCulture(culture);
    setShowViewCulture(true);
  };

  const sectorsToShow = activeSector === "all" ? [...SECTORS] : [activeSector as typeof SECTORS[number]];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Microscope className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Painel CCIH</h1>
            <p className="text-xs text-muted-foreground">Comissão de Controle de Infecção Hospitalar — gestão de culturas</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-violet-200 bg-violet-50/50 dark:bg-violet-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Microscope className="h-8 w-8 text-violet-500" />
            <div>
              <p className="text-2xl font-bold text-violet-700">{stats.total}</p>
              <p className="text-[10px] text-violet-600 uppercase tracking-wider font-medium">Total de culturas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
              <p className="text-[10px] text-amber-600 uppercase tracking-wider font-medium">Aguardando</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-emerald-700">{stats.completed}</p>
              <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-medium">Concluídas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.unread}</p>
              <p className="text-[10px] text-red-600 uppercase tracking-wider font-medium">Não lidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sector filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            variant={activeSector === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSector("all")}
            className={cn("text-xs shrink-0", activeSector === "all" && "bg-violet-500 hover:bg-violet-600 text-white")}
          >
            Todos os setores
          </Button>
          {SECTORS.map(s => {
            const colors = SECTOR_COLORS[s];
            return (
              <Button
                key={s}
                variant={activeSector === s ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSector(s)}
                className={cn(
                  "text-xs shrink-0 gap-1.5",
                  activeSector === s && `${colors.bg} ${colors.text} border ${colors.border}`
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", colors.dot)} />
                {getSectorDisplayLabel(s)}
              </Button>
            );
          })}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente por nome ou leito..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Sectors with patients */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {sectorsToShow.map(sector => {
            const colors = SECTOR_COLORS[sector];
            const sectorPatients = filteredPatientsBySector[sector] || [];

            return (
              <Card key={sector} className={cn("border", colors.border)}>
                <CardHeader className={cn("py-3 px-4", colors.bg)}>
                  <CardTitle className={cn("text-sm font-bold flex items-center gap-2", colors.text)}>
                    <span className={cn("h-3 w-3 rounded-full", colors.dot)} />
                    {getSectorDisplayLabel(sector)}
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      {sectorPatients.length} pacientes
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  {sectorPatients.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum paciente neste setor
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {sectorPatients.map(patient => {
                        const pCultures = culturesForPatient(patient.id);
                        const hasPending = pCultures.some(c => c.status === "pending");
                        const hasCompleted = pCultures.some(c => c.status === "completed");

                        return (
                          <Card
                            key={patient.id}
                            className={cn(
                              "border transition-all hover:shadow-md",
                              hasPending && "border-amber-300 bg-amber-50/20 dark:bg-amber-500/5"
                            )}
                          >
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-xs font-bold text-foreground truncate">
                                      {patient.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <BedDouble className="h-3 w-3" /> {patient.bed_number}
                                    </span>
                                    {patient.age && <span>· {patient.age}</span>}
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {hasCompleted && (
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" title="Com resultado" />
                                  )}
                                  {hasPending && (
                                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Pendente" />
                                  )}
                                </div>
                              </div>

                              {patient.uti_cultures_antibiotics && (
                                <p className="text-[10px] text-muted-foreground line-clamp-2 bg-muted/50 p-1.5 rounded">
                                  {patient.uti_cultures_antibiotics}
                                </p>
                              )}

                              {/* Recent cultures */}
                              {pCultures.length > 0 && (
                                <div className="space-y-1">
                                  {pCultures.slice(0, 2).map(c => (
                                    <div
                                      key={c.id}
                                      className="flex items-center gap-1.5 text-[10px] p-1.5 rounded bg-muted/30 border cursor-pointer hover:bg-muted/60 transition-colors"
                                      onClick={() => openViewCulture(c)}
                                    >
                                      <Microscope className="h-3 w-3 text-violet-500 shrink-0" />
                                      <span className="truncate flex-1">
                                        {CULTURE_TYPES.find(ct => ct.value === c.culture_type)?.label || c.culture_type}
                                      </span>
                                      {c.status === "completed" ? (
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                      ) : (
                                        <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                                      )}
                                    </div>
                                  ))}
                                  {pCultures.length > 2 && (
                                    <p className="text-[9px] text-muted-foreground text-center">
                                      +{pCultures.length - 2} culturas anteriores
                                    </p>
                                  )}
                                </div>
                              )}

                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-[10px] h-7 gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                                  onClick={() => openPatientDetail(patient)}
                                >
                                  <Info className="h-3 w-3" /> Detalhes
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-[10px] h-7 gap-1 border-violet-200 text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                                  onClick={() => openNewCulture(patient)}
                                >
                                  <Plus className="h-3 w-3" /> Cultura
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent cultures tab */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-500" />
            Culturas registradas recentemente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 space-y-1.5">
          {cultureResults.slice(0, 10).map(c => {
            const colors = SECTOR_COLORS[c.patient_sector] || SECTOR_COLORS.red;
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openViewCulture(c)}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", colors.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground truncate">{c.patient_name}</span>
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {getSectorDisplayLabel(c.patient_sector)} · {c.patient_bed}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span>{CULTURE_TYPES.find(ct => ct.value === c.culture_type)?.label || c.culture_type}</span>
                    {c.microorganism && <span>· {c.microorganism}</span>}
                    <span>· {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {c.status === "completed" ? (
                    <Badge className="text-[9px] bg-emerald-500/15 text-emerald-700 border-emerald-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Concluída
                    </Badge>
                  ) : (
                    <Badge className="text-[9px] bg-amber-500/15 text-amber-700 border-amber-300 animate-pulse">
                      <Clock className="h-3 w-3 mr-1" /> Pendente
                    </Badge>
                  )}
                  {!c.read_by_doctor && c.status === "completed" && (
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Não lido pelo médico" />
                  )}
                </div>
              </div>
            );
          })}
          {cultureResults.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhuma cultura registrada ainda
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── New Culture Dialog ── */}
      <Dialog open={showNewCulture} onOpenChange={setShowNewCulture}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Microscope className="h-5 w-5 text-violet-600" />
              Registrar resultado de cultura
            </DialogTitle>
            <DialogDescription>
              {selectedPatient && (
                <span>
                  Paciente: <strong>{selectedPatient.name}</strong> · {getSectorDisplayLabel(selectedPatient.sector)} · Leito {selectedPatient.bed_number}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de cultura</Label>
                <Select value={cultureType} onValueChange={setCultureType}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CULTURE_TYPES.map(ct => (
                      <SelectItem key={ct.value} value={ct.value} className="text-xs">
                        {ct.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data da coleta</Label>
                <Input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Microrganismo identificado</Label>
              <Input
                placeholder="Ex: Staphylococcus aureus, Klebsiella pneumoniae..."
                value={microorganism}
                onChange={(e) => setMicroorganism(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Perfil de sensibilidade / antibiograma</Label>
              <Textarea
                placeholder="Descreva o perfil de sensibilidade aos antimicrobianos..."
                value={antibiogram}
                onChange={(e) => setAntibiogram(e.target.value)}
                className="text-xs min-h-[80px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações adicionais</Label>
              <Textarea
                placeholder="Observações relevantes do resultado..."
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>

            <ExamResultInput
              resultText=""
              onResultTextChange={() => {}}
              resultFiles={resultFiles}
              onResultFilesChange={setResultFiles}
              readOnly={false}
              requestId={selectedPatient?.id || "new"}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCulture(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCulture}
              disabled={saving || !microorganism.trim()}
              className="bg-violet-500 hover:bg-violet-600 text-white gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Registrar cultura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Culture Dialog ── */}
      <Dialog open={showViewCulture} onOpenChange={setShowViewCulture}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Microscope className="h-5 w-5 text-violet-600" />
              Detalhes da cultura
            </DialogTitle>
            <DialogDescription>
              Resultado registrado pela CCIH
            </DialogDescription>
          </DialogHeader>

          {viewCulture && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{viewCulture.patient_name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {getSectorDisplayLabel(viewCulture.patient_sector)} · {viewCulture.patient_bed}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p><strong>Tipo:</strong> {CULTURE_TYPES.find(ct => ct.value === viewCulture.culture_type)?.label || viewCulture.culture_type}</p>
                  {viewCulture.collection_date && (
                    <p><strong>Data da coleta:</strong> {format(new Date(viewCulture.collection_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}</p>
                  )}
                  <p><strong>Registrado em:</strong> {format(new Date(viewCulture.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  {viewCulture.uploaded_by_name && (
                    <p><strong>Registrado por:</strong> {viewCulture.uploaded_by_name}</p>
                  )}
                </div>
              </div>

              {viewCulture.microorganism && (
                <div className="p-3 rounded-lg bg-red-50/50 border border-red-200 dark:bg-red-500/5 dark:border-red-500/20">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Microrganismo identificado</p>
                  <p className="text-sm text-foreground font-medium">{viewCulture.microorganism}</p>
                </div>
              )}

              {viewCulture.antibiogram && (
                <div className="p-3 rounded-lg bg-violet-50/50 border border-violet-200 dark:bg-violet-500/5 dark:border-violet-500/20">
                  <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1">Antibiograma / sensibilidade</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewCulture.antibiogram}</p>
                </div>
              )}

              {viewCulture.result_text && (
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs font-semibold text-foreground mb-1">Observações</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewCulture.result_text}</p>
                </div>
              )}

              {viewCulture.result_files && Array.isArray(viewCulture.result_files) && viewCulture.result_files.length > 0 && (
                <ExamResultInput
                  resultText=""
                  onResultTextChange={() => {}}
                  resultFiles={viewCulture.result_files}
                  onResultFilesChange={() => {}}
                  readOnly={true}
                  requestId={viewCulture.id}
                />
              )}

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {viewCulture.read_by_doctor ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Eye className="h-3 w-3" /> Lido pelo médico
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Clock className="h-3 w-3" /> Aguardando leitura do médico
                  </span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* ── Patient Detail Dialog (CCIH) ── */}
      <Dialog open={showPatientDetail} onOpenChange={setShowPatientDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-violet-600" />
              Perfil infeccioso — CCIH
            </DialogTitle>
            <DialogDescription>
              {detailPatient && (
                <span>
                  {detailPatient.name} · {getSectorDisplayLabel(detailPatient.sector)} · Leito {detailPatient.bed_number}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailPatient && (
            <div className="space-y-4">
              {/* Patient header */}
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{detailPatient.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {getSectorDisplayLabel(detailPatient.sector)} · {detailPatient.bed_number}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                  {detailPatient.age && <span><strong>Idade:</strong> {detailPatient.age}</span>}
                  {detailPatient.admission_date && (
                    <span><strong>Admissão:</strong> {format(new Date(detailPatient.admission_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                  )}
                  {detailPatient.diagnoses && (
                    <span className="col-span-2 sm:col-span-3"><strong>Diagnósticos:</strong> {detailPatient.diagnoses}</span>
                  )}
                </div>
              </div>

              {/* Cultures / ATB field from patient card */}
              {detailPatient.uti_cultures_antibiotics && (
                <div className="p-3 rounded-lg bg-violet-50/50 border border-violet-200 dark:bg-violet-500/5 dark:border-violet-500/20">
                  <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1 flex items-center gap-1.5">
                    <FlaskConical className="h-3.5 w-3.5" /> Culturas e antibióticos (prontuário)
                  </p>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{detailPatient.uti_cultures_antibiotics}</p>
                </div>
              )}

              {loadingDetail ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                </div>
              ) : (
                <>
                  {/* Culture exam requests (solicitations) */}
                  <div>
                    <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                      <Microscope className="h-3.5 w-3.5 text-violet-500" />
                      Solicitações de culturas
                    </p>
                    {detailCultureRequests.length === 0 ? (
                      <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center">
                        Nenhuma solicitação de cultura encontrada
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {detailCultureRequests.map(req => {
                          const items = Array.isArray(req.items) ? req.items : [];
                          const cultureItems = items.filter((item: any) => {
                            const name = (item.name || item || "").toString().toLowerCase();
                            return ["cultura", "hemocultura", "urocultura", "antibiograma", "gram", "microbiologia"]
                              .some(kw => name.includes(kw));
                          });
                          return (
                            <div key={req.id} className="p-2.5 rounded-lg border bg-muted/20 space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CalendarDays className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] font-medium text-foreground">
                                    {format(new Date(req.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                  </span>
                                  {req.requested_by_name && (
                                    <span className="text-[10px] text-muted-foreground">por {req.requested_by_name}</span>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn("text-[9px]",
                                    req.status === "completed" ? "text-emerald-600 border-emerald-300" :
                                    req.status === "pending" ? "text-amber-600 border-amber-300" :
                                    "text-blue-600 border-blue-300"
                                  )}
                                >
                                  {req.status === "completed" ? "Concluído" :
                                   req.status === "pending" ? "Pendente" :
                                   req.status === "in_progress" ? "Em execução" :
                                   req.status === "acknowledged" ? "Ciência" : req.status}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {cultureItems.map((item: any, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-[9px] gap-1">
                                    <Microscope className="h-2.5 w-2.5" />
                                    {item.name || item}
                                  </Badge>
                                ))}
                              </div>
                              {req.results && (
                                <p className="text-[10px] text-foreground bg-emerald-50/50 dark:bg-emerald-500/5 p-1.5 rounded border border-emerald-200 dark:border-emerald-500/20 mt-1">
                                  <strong className="text-emerald-700 dark:text-emerald-400">Resultado:</strong> {req.results}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* CCIH culture results */}
                  <div>
                    <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                      <FlaskConical className="h-3.5 w-3.5 text-red-500" />
                      Resultados de culturas (CCIH)
                    </p>
                    {culturesForPatient(detailPatient.id).length === 0 ? (
                      <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center">
                        Nenhum resultado de cultura registrado pela CCIH
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {culturesForPatient(detailPatient.id).map(c => (
                          <div
                            key={c.id}
                            className="p-2.5 rounded-lg border bg-muted/20 space-y-1 cursor-pointer hover:bg-muted/40 transition-colors"
                            onClick={() => { setShowPatientDetail(false); setTimeout(() => openViewCulture(c), 200); }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Microscope className="h-3 w-3 text-violet-500" />
                                <span className="text-[10px] font-medium text-foreground">
                                  {CULTURE_TYPES.find(ct => ct.value === c.culture_type)?.label || c.culture_type}
                                </span>
                                {c.collection_date && (
                                  <span className="text-[9px] text-muted-foreground">
                                    Coleta: {format(new Date(c.collection_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {c.status === "completed" ? (
                                  <Badge className="text-[9px] bg-emerald-500/15 text-emerald-700 border-emerald-300">Concluída</Badge>
                                ) : (
                                  <Badge className="text-[9px] bg-amber-500/15 text-amber-700 border-amber-300">Pendente</Badge>
                                )}
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </div>
                            {c.microorganism && (
                              <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                                🦠 {c.microorganism}
                              </p>
                            )}
                            {c.antibiogram && (
                              <p className="text-[10px] text-muted-foreground line-clamp-1">
                                Antibiograma: {c.antibiogram}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Antibiotic prescriptions history */}
                  <div>
                    <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                      <Pill className="h-3.5 w-3.5 text-amber-500" />
                      Histórico de antibióticos
                    </p>
                    {detailPrescriptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center">
                        Nenhuma prescrição com antimicrobianos encontrada
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {detailPrescriptions.map(rx => {
                          const items = Array.isArray(rx.items) ? rx.items : [];
                          const abxItems = items.filter((item: any) => {
                            const name = (item.name || item.medication || "").toString().toLowerCase();
                            return [
                              "antibiótico", "antimicrobiano", "amoxicilina", "ampicilina", "azitromicina",
                              "ceftriaxona", "cefazolina", "cefepima", "ceftazidima", "ciprofloxacino",
                              "clindamicina", "gentamicina", "amicacina", "levofloxacino", "meropenem",
                              "imipenem", "ertapenem", "metronidazol", "oxacilina", "penicilina",
                              "piperacilina", "tazobactam", "polimixina", "vancomicina", "teicoplanina",
                              "linezolida", "daptomicina", "sulfametoxazol", "trimetoprima",
                              "cefuroxima", "cefalexina", "doxiciclina", "claritromicina",
                              "fluconazol", "anfotericina", "micafungina", "anidulafungina", "caspofungina",
                              "aciclovir", "oseltamivir", "colistina", "tigeciclina", "rifampicina",
                            ].some(kw => name.includes(kw));
                          });

                          return (
                            <div key={rx.id} className="p-2.5 rounded-lg border bg-muted/20 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CalendarDays className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] font-medium text-foreground">
                                    {format(new Date(rx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                  </span>
                                  <Badge variant="outline" className="text-[9px]">v{rx.version}</Badge>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn("text-[9px]",
                                    rx.status === "active" ? "text-emerald-600 border-emerald-300" :
                                    rx.status === "draft" ? "text-amber-600 border-amber-300" :
                                    rx.status === "suspended" ? "text-red-600 border-red-300" :
                                    "text-muted-foreground"
                                  )}
                                >
                                  {rx.status === "active" ? "Ativa" :
                                   rx.status === "draft" ? "Rascunho" :
                                   rx.status === "suspended" ? "Suspensa" :
                                   rx.status === "completed" ? "Finalizada" : rx.status}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                {abxItems.map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/10">
                                    <Pill className="h-3 w-3 text-amber-600 shrink-0" />
                                    <span className="font-medium text-foreground flex-1">
                                      {item.name || item.medication}
                                    </span>
                                    {item.dose && <span className="text-muted-foreground">{item.dose}</span>}
                                    {item.route && <span className="text-muted-foreground">{item.route}</span>}
                                    {item.frequency && <span className="text-muted-foreground">{item.frequency}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs border-violet-200 text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                  onClick={() => {
                    setShowPatientDetail(false);
                    setTimeout(() => openNewCulture(detailPatient), 200);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Registrar nova cultura
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CcihDashboardPage;
