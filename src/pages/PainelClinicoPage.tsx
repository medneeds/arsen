import { useState, useMemo, useEffect, useCallback } from "react";
import { usePatients } from "@/hooks/usePatients";
import { useDepartment } from "@/contexts/DepartmentContext";
import { Patient } from "@/types/patient";
import { differenceInDays, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Filter, FileText, Pill, Activity, ClipboardList, FolderOpen, User, Calendar, Clock, Stethoscope, Heart, TrendingUp, AlertTriangle, TestTubes, Syringe, Shield, Thermometer, Pencil, Check, X, ClipboardCheck, Plus, LogOut, History } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ClinicalNavTabs } from "@/components/ClinicalNavTabs";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PatientCockpit } from "@/components/PatientCockpit";

const parseTextArray = (input: string | string[] | undefined | null): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(item => item && item.trim());
  return input.split('\n').filter(item => item && item.trim());
};

const clinicalStatusLabels: Record<string, { label: string; color: string }> = {
  gravissimo: { label: "Gravíssimo", color: "bg-red-600 text-white" },
  grave: { label: "Grave", color: "bg-red-500 text-white" },
  grave_estavel: { label: "Grave estável", color: "bg-orange-500 text-white" },
  potencialmente_grave: { label: "Potencialmente grave", color: "bg-amber-500 text-white" },
  regular: { label: "Regular", color: "bg-blue-500 text-white" },
  paliativado: { label: "Paliativado", color: "bg-purple-500 text-white" },
};

const formatStayDuration = (admissionDate: string): string => {
  if (!admissionDate) return "—";
  try {
    const date = parseISO(admissionDate);
    if (isNaN(date.getTime())) return "—";
    return formatDistanceToNow(date, { locale: ptBR, addSuffix: false });
  } catch {
    return "—";
  }
};

// Helpers
const calcDaysInternment = (admissionDate: string): number | null => {
  if (!admissionDate) return null;
  try {
    const date = parseISO(admissionDate);
    if (isNaN(date.getTime())) return null;
    return differenceInDays(new Date(), date);
  } catch {
    return null;
  }
};

const getSectorLabel = (sector: string) => {
  const map: Record<string, string> = { red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2", ucc: "UCC" };
  return map[sector] || sector;
};

const getSectorColor = (sector: string) => {
  const map: Record<string, string> = {
    red: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200",
    yellow: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200",
    outside: "bg-muted text-muted-foreground border-border",
    ucc: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200",
  };
  return map[sector] || "";
};

const getResponsibleDoctor = (patient: Patient): string => {
  const mr = patient.medicalResponsibility;
  if (!mr) return "—";
  if (mr.leaderNames) return mr.leaderNames;
  if (mr.portaNames) return mr.portaNames;
  if (mr.type) {
    const types: Record<string, string> = {
      lider: "Líder", porta: "Porta", conjunto: "Conjunto",
      obstetra: "Obstetra", cirurgiao_geral: "Cirurgião Geral", traumatologista: "Traumatologista",
    };
    return types[mr.type] || mr.type;
  }
  return "—";
};

const getPrescriptionStatus = (patient: Patient): { label: string; variant: "default" | "secondary" | "outline" | "destructive"; dotColor: string; pulsing: boolean } => {
  const scheduleItems = parseTextArray(patient.schedule);
  if (scheduleItems.length > 0) {
    return { label: "Validada", variant: "default", dotColor: "bg-emerald-500", pulsing: false };
  }
  return { label: "Pendente", variant: "secondary", dotColor: "bg-amber-500", pulsing: true };
};

const getDischargeText = (patient: Patient): string => {
  const predictions = parseTextArray(patient.utiDischargePrediction);
  if (predictions.length > 0) {
    return predictions[0];
  }
  return "Sem previsão";
};

// Documents list
const DOCUMENTS = [
  { group: "Hemoderivados", items: [
    { name: "Ato Transfusional", path: "/documents/hemoderivados/hemoc-ato-sadt.pdf" },
    { name: "Hemoconcentrados SADT", path: "/documents/hemoderivados/hemoc-concentrados-sadt.pdf" },
    { name: "Exames SADT", path: "/documents/hemoderivados/hemoc-exames-sadt.pdf" },
    { name: "Solicitação Hemoconcentrados", path: "/documents/hemoderivados/solicitacao-hemoconcentrados.pdf" },
    { name: "Termo Hemotransfusão", path: "/documents/hemoderivados/termo-esclarecimento-hemotransfusao.pdf" },
  ]},
  { group: "Tomografias", items: [
    { name: "Ficha Acompanhamento TC", path: "/documents/tomografias/ficha-acompanhamento-tc.pdf" },
    { name: "Termo Consentimento TC", path: "/documents/tomografias/termo-consentimento-tc.pdf" },
    { name: "Termo Gestante", path: "/documents/tomografias/termo-consentimento-gestante.pdf" },
  ]},
  { group: "Protocolos", items: [
    { name: "Protocolo Sepse Adulto", path: "/documents/protocolo-sepse-adulto.pdf" },
    { name: "Controle Glicêmico", path: "/documents/protocolo-controle-glicemico.pdf" },
    { name: "Termo Cuidados Paliativos", path: "/documents/termo-cuidados-paliativos.docx" },
  ]},
  { group: "Regulações SUS", items: [
    { name: "Modelo Anamnese Regulação", path: "/documents/regulacoes-sus/modelo-anamnese-regulacao.pdf" },
  ]},
];

export default function PainelClinicoPage() {
  const { currentDepartment, currentSectorCode } = useDepartment();
  const scopedDepartment = currentSectorCode ? undefined : currentDepartment;
  const scopedSector = currentSectorCode || undefined;
  const { patients: dbPatients, isLoading, updatePatient } = usePatients(scopedDepartment, scopedSector);
  const navigate = useNavigate();

  // Gestor não acessa o Painel Clínico — redireciona para o Mapa de Leitos
  const accessProfile = typeof window !== "undefined" ? localStorage.getItem("access_profile") : null;
  useEffect(() => {
    if (accessProfile === "gestor") {
      navigate("/mapa", { replace: true });
    }
  }, [accessProfile, navigate]);

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>(() => {
    return currentSectorCode || localStorage.getItem("selected_sector") || "all";
  });
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [sidebarTab, setSidebarTab] = useState("resumo");
  const [sapsScores, setSapsScores] = useState<Record<string, { score: number; mortality: number; status: string; pending_since: string | null }>>({});

  useEffect(() => {
    if (currentSectorCode) setSectorFilter(currentSectorCode);
  }, [currentSectorCode]);

  // Fetch SAPS 3 scores for all patients
  useEffect(() => {
    const fetchSaps = async () => {
      const { data } = await supabase
        .from("saps3_assessments" as any)
        .select("patient_name, total_score, predicted_mortality, status, pending_since")
        .order("created_at", { ascending: false });
      if (data) {
        const map: Record<string, { score: number; mortality: number; status: string; pending_since: string | null }> = {};
        (data as any[]).forEach((r: any) => {
          if (!map[r.patient_name]) {
            map[r.patient_name] = { score: r.total_score ?? 0, mortality: r.predicted_mortality ?? 0, status: r.status ?? 'completed', pending_since: r.pending_since ?? null };
          }
        });
        setSapsScores(map);
      }
    };
    fetchSaps();
  }, []);

  // Painel clínico deve refletir exclusivamente o banco sincronizado com o mapa de leitos.
  const patients = dbPatients;

  // Filter out vacant beds and apply search/sector filter
  const filteredPatients = useMemo(() => {
    return patients
      .filter(p => !p.isVacant && p.name && p.name.trim() !== "")
      .filter(p => sectorFilter === "all" || p.sector === sectorFilter)
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        const diagArr = parseTextArray(p.diagnoses);
        return (
          p.name.toLowerCase().includes(q) ||
          p.bedNumber.toLowerCase().includes(q) ||
          diagArr.some(d => d.toLowerCase().includes(q))
        );
      });
  }, [patients, search, sectorFilter]);

  const handleInlineSave = useCallback(async (patientId: string, field: string, items: string[]) => {
    await updatePatient(patientId, { [field]: items } as Partial<Patient>);
    // Update local selectedPatient state
    setSelectedPatient(prev => prev ? { ...prev, [field]: items } : prev);
  }, [updatePatient]);

  const openPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSidebarTab("resumo");
  };

  // Clique no nome → entra direto no painel clínico individual (prescrição com contexto)
  const goToPatientPanel = (patient: Patient) => {
    const params = new URLSearchParams({
      patientId: patient.id,
      patientName: patient.name,
      patientBed: patient.bedNumber,
      patientSector: patient.sector,
    });
    if (patient.age) params.set("patientAge", patient.age.toString());
    navigate(`/paciente?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header — barra institucional padronizada (mesmo padrão do Mapa de Leitos) */}
      <div className="px-2 sm:px-4 pt-3">
        <BreadcrumbBar
          variant="institutional"
          actions={
            <Badge variant="outline" className="text-xs bg-white/95 text-foreground border-white/40 shadow-sm">
              {filteredPatients.length} paciente{filteredPatients.length !== 1 ? "s" : ""}
            </Badge>
          }
        />
      </div>

      {/* Search bar below header */}
      <div className="px-4 py-2">
        <div className="flex gap-2 items-center">
          <Select value={sectorFilter} onValueChange={(val) => { setSectorFilter(val); if (val !== "all") localStorage.setItem("selected_sector", val); }}>
            <SelectTrigger className="h-8 w-auto gap-1 text-xs font-medium px-2.5 [&>svg]:h-3 [&>svg]:w-3 rounded-md">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              <SelectItem value="red">UTI 1</SelectItem>
              <SelectItem value="yellow">UTI 2</SelectItem>
              <SelectItem value="blue">UCI 1</SelectItem>
              <SelectItem value="outside">UCI 2</SelectItem>
              <SelectItem value="ucc">UCC</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Buscar por nome, leito ou diagnóstico..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="p-2 sm:p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Carregando pacientes...
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <ClipboardList className="h-10 w-10 opacity-30" />
              <p>Nenhum paciente encontrado</p>
            </div>
          ) : (
            <>
            {/* Mobile: card list */}
            <div className="md:hidden flex flex-col gap-2">
              {filteredPatients.map(patient => {
                const days = calcDaysInternment(patient.admissionDate);
                const prescStatus = getPrescriptionStatus(patient);
                const pendencies = parseTextArray(patient.pendencies);
                const saps = sapsScores[patient.name];
                return (
                  <button
                    key={patient.id}
                    onClick={() => goToPatientPanel(patient)}
                    className="text-left rounded-xl border border-border bg-card p-3 active:scale-[0.99] transition-transform shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-foreground">{patient.bedNumber}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getSectorColor(patient.sector))}>
                            {getSectorLabel(patient.sector)}
                          </Badge>
                          <span className={cn("inline-block h-2 w-2 rounded-full", prescStatus.dotColor, prescStatus.pulsing && "animate-pulse-soft")} />
                          <span className="text-[10px] text-muted-foreground">{prescStatus.label}</span>
                        </div>
                        <p className="font-medium text-sm text-foreground mt-1.5 leading-tight line-clamp-2">{patient.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {patient.age ? `${patient.age} anos` : "—"}
                          {days !== null && <span className={cn("ml-2", days > 7 && "text-destructive font-semibold")}>{days}d int.</span>}
                          {saps && saps.status !== 'pending' && <span className="ml-2">SAPS {saps.score}</span>}
                        </p>
                        {parseTextArray(patient.diagnoses)[0] && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{parseTextArray(patient.diagnoses)[0]}</p>
                        )}
                        {pendencies.length > 0 && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 line-clamp-1">⚠ {pendencies[0]}{pendencies.length > 1 && ` +${pendencies.length - 1}`}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={(e) => { e.stopPropagation(); openPatient(patient); }}
                        aria-label="Pré-visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Desktop / tablet: table */}
            <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24">Leito</TableHead>
                   <TableHead>Paciente</TableHead>
                  <TableHead className="w-24 text-center">SAPS 3</TableHead>
                  <TableHead className="w-48">Pendências</TableHead>
                  <TableHead className="w-28 text-center">Prescrição</TableHead>
                  <TableHead className="w-24 text-center">Dias Int.</TableHead>
                  <TableHead className="w-36">Previsão Alta</TableHead>
                  <TableHead className="w-40">Médico Resp.</TableHead>
                  <TableHead className="w-20 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map(patient => {
                  const days = calcDaysInternment(patient.admissionDate);
                  const prescStatus = getPrescriptionStatus(patient);
                  const pendencies = parseTextArray(patient.pendencies);
                  
                  return (
                    <TableRow
                      key={patient.id}
                      className="cursor-pointer group hover:bg-accent/50 transition-colors"
                      onClick={() => goToPatientPanel(patient)}
                      title="Clique para abrir o atendimento • Use o olho para pré-visualizar"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="patient-id font-mono font-bold text-foreground">{patient.bedNumber}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 whitespace-nowrap", getSectorColor(patient.sector))}>
                            {getSectorLabel(patient.sector)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground leading-tight hover:text-primary transition-colors">{patient.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {patient.age ? `${patient.age} anos` : "—"}
                          </p>
                          {parseTextArray(patient.diagnoses).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1 max-w-[200px]">
                              {parseTextArray(patient.diagnoses)[0]}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {sapsScores[patient.name] ? (
                          sapsScores[patient.name].status === 'pending' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Clock className="h-3.5 w-3.5 animate-pulse" />
                                <span className="text-[10px] font-semibold">Pendente</span>
                              </div>
                              <SapsPendingMiniTimer pendingSince={sapsScores[patient.name].pending_since} />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-mono font-bold text-sm text-foreground">{sapsScores[patient.name].score}</span>
                              <Badge variant="outline" className={cn("text-[10px] px-1.5",
                                sapsScores[patient.name].mortality < 10 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400" :
                                sapsScores[patient.name].mortality < 25 ? "text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400" :
                                sapsScores[patient.name].mortality < 50 ? "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400" :
                                "text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
                              )}>
                                {sapsScores[patient.name].mortality}%
                              </Badge>
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {pendencies.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {pendencies.slice(0, 2).map((p, i) => (
                              <span key={i} className="text-xs text-muted-foreground line-clamp-1">{p}</span>
                            ))}
                            {pendencies.length > 2 && (
                              <span className="text-[10px] text-primary">+{pendencies.length - 2} mais</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={cn(
                            "inline-block h-2.5 w-2.5 rounded-full shrink-0",
                            prescStatus.dotColor,
                            prescStatus.pulsing && "animate-pulse-soft"
                          )} />
                          <Badge variant={prescStatus.variant} className="text-[11px]">
                            {prescStatus.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("font-mono font-bold text-sm", days !== null && days > 7 ? "text-destructive" : "text-foreground")}>
                          {days !== null ? days : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{getDischargeText(patient)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-foreground">{getResponsibleDoctor(patient)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-70 hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); openPatient(patient); }}
                          title="Visualização rápida (preview)"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Patient Sidebar Sheet — usa o PatientCockpit padronizado dos demais módulos clínicos */}
      <Sheet open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col gap-0 h-[100dvh]" side="right">
          {selectedPatient && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <PatientCockpit patient={selectedPatient} variant="inline" className="h-full border-0 rounded-none" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// EditableInfoSection component - click to edit inline, syncs with map
function EditableInfoSection({ icon: Icon, title, items, onSave }: { icon: React.ElementType; title: string; items: string[]; onSave: (items: string[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEntries(items.length > 0 ? [...items] : [""]);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEntries([]);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const newItems = entries.filter(l => l.trim());
      await onSave(newItems);
      setEditing(false);
    } catch {
      // error handled by updatePatient
    } finally {
      setSaving(false);
    }
  };

  const handleEntryChange = (index: number, value: string) => {
    const updated = [...entries];
    updated[index] = value;
    setEntries(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    }
  };

  const addEntry = () => {
    setEntries([...entries, ""]);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5 group/section">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-muted-foreground tracking-wide flex-1">{title}</h4>
        {!editing && (
          <button
            onClick={startEdit}
            className="opacity-0 group-hover/section:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent"
            title="Editar"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="pl-5 space-y-1.5">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={entry}
                onChange={(e) => handleEntryChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                className="text-sm h-8 flex-1"
                placeholder={`Item ${i + 1}...`}
                autoFocus={i === entries.length - 1}
              />
              {entries.length > 1 && (
                <button onClick={() => removeEntry(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={addEntry} className="h-7 text-xs gap-1 text-muted-foreground">
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="default" onClick={saveEdit} disabled={saving} className="h-7 text-xs gap-1">
              <Check className="h-3 w-3" /> Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving} className="h-7 text-xs gap-1">
              <X className="h-3 w-3" /> Cancelar
            </Button>
          </div>
        </div>
      ) : items.length > 0 ? (
        <ul className="space-y-0.5 list-disc list-inside pl-5 cursor-pointer" onClick={startEdit}>
          {items.map((item, i) => (
            <li key={i} className="text-sm text-foreground">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground italic pl-5 cursor-pointer" onClick={startEdit}>Nenhum registro — clique para adicionar</p>
      )}
    </div>
  );
}

// Editable text block component - for free-form text like admission history
function EditableTextBlock({ icon: Icon, title, value, onSave }: { icon: React.ElementType; title: string; value: string; onSave: (val: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5 group/section">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-muted-foreground tracking-wide flex-1">{title}</h4>
        {!editing && (
          <button onClick={startEdit} className="opacity-0 group-hover/section:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent" title="Editar">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="pl-5 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-sm min-h-[80px] resize-y"
            placeholder="História admissional..."
            autoFocus
            style={{ minHeight: "80px" }}
          />
          <div className="flex gap-1.5">
            <Button size="sm" variant="default" onClick={saveEdit} disabled={saving} className="h-7 text-xs gap-1">
              <Check className="h-3 w-3" /> Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving} className="h-7 text-xs gap-1">
              <X className="h-3 w-3" /> Cancelar
            </Button>
          </div>
        </div>
      ) : value ? (
        <p className="text-sm text-foreground pl-5 leading-relaxed whitespace-pre-line cursor-pointer" onClick={startEdit}>{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic pl-5 cursor-pointer" onClick={startEdit}>Nenhum registro — clique para adicionar</p>
      )}
    </div>
  );
}

// Mini timer for pending SAPS in table
function SapsPendingMiniTimer({ pendingSince }: { pendingSince: string | null }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!pendingSince) return;
    const update = () => {
      const diff = Date.now() - new Date(pendingSince).getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      setElapsed(`${hours}h${String(minutes).padStart(2, "0")}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [pendingSince]);

  if (!pendingSince) return null;

  return (
    <span className="font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
      ⏱ {elapsed}
    </span>
  );
}
