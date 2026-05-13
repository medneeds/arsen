import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BedDouble, Shield, Thermometer, Heart, Brain, Wind,
  AlertTriangle, Loader2, User, Calendar, Activity, Droplets, CalendarIcon
} from "lucide-react";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";

interface PreAdmissionFull {
  id: string;
  patient_name: string;
  social_name?: string | null;
  birth_date: string | null;
  sex: string | null;
  medical_record: string | null;
  cpf: string | null;
  cns: string | null;
  mother_name: string | null;
  phone: string | null;
  destination_sector: string | null;
  status: string;
  risk_classification: string | null;
  chief_complaint: string | null;
  vital_signs: any;
  glasgow_score: number | null;
  glasgow_detail: any;
  airway_patent: boolean | null;
  airway_obstruction: boolean | null;
  airway_intubated: boolean | null;
  allergies: string | null;
  flu_symptoms: boolean | null;
  flu_symptoms_detail: string | null;
  peripheral_perfusion: string | null;
  pulse_quality: string | null;
  pain_scale: number | null;
  oxygen_therapy: boolean | null;
  oxygen_therapy_detail: string | null;
  triage_notes: string | null;
  notes: string | null;
  created_at: string;
}

interface AdmitPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preAdmission: { id: string; patient_name: string; risk_classification?: string | null } | null;
  onSuccess: () => void;
}

const RISK_COLORS: Record<string, string> = {
  vermelho: "bg-red-600 text-white",
  laranja: "bg-orange-500 text-white",
  amarelo: "bg-yellow-500 text-black",
  verde: "bg-green-600 text-white",
  azul: "bg-blue-600 text-white",
  branca: "bg-white text-slate-900 border border-slate-400",
};

const RISK_LABELS: Record<string, string> = {
  vermelho: "EMERGÊNCIA",
  laranja: "MUITO URGENTE",
  amarelo: "URGENTE",
  verde: "POUCO URGENTE",
  azul: "NÃO URGENTE",
  branca: "FICHA BRANCA",
};

const SECTORS = [
  { value: "red", label: "UTI 1", color: "text-red-500" },
  { value: "yellow", label: "UTI 2", color: "text-yellow-500" },
  { value: "blue", label: "UCI 1", color: "text-blue-500" },
  { value: "outside", label: "UCI 2", color: "text-emerald-500" },
];

export function AdmitPatientDialog({ open, onOpenChange, preAdmission, onSuccess }: AdmitPatientDialogProps) {
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedBed, setSelectedBed] = useState("");
  const [admissionNotes, setAdmissionNotes] = useState("");
  const [dischargeDays, setDischargeDays] = useState<string>("");
  const [dischargeDate, setDischargeDate] = useState<Date | undefined>(undefined);
  const [noDischargePrediction, setNoDischargePrediction] = useState(false);
  const [availableBeds, setAvailableBeds] = useState<string[]>([]);
  const [occupiedBeds, setOccupiedBeds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullData, setFullData] = useState<PreAdmissionFull | null>(null);
  const [sectorFullAlert, setSectorFullAlert] = useState(false);
  const [extraBedRequested, setExtraBedRequested] = useState(false);
  const [bedsLoaded, setBedsLoaded] = useState(false);

  const { currentHospital, currentState } = useHospital();
  const { currentDepartment, currentSectorCode } = useDepartment();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch everything in parallel on open
  useEffect(() => {
    if (!open) return;
    const storedSector = currentSectorCode || localStorage.getItem("selected_sector") || "red";
    setSelectedSector(storedSector);
    setSelectedBed("");
    setExtraBedRequested(false);
    setSectorFullAlert(false);
    setBedsLoaded(false);
    setDischargeDays("");
    setDischargeDate(undefined);
    setNoDischargePrediction(false);

    if (!currentHospital?.id || !currentState?.id || !preAdmission?.id) return;

    const fetchAll = async () => {
      // Parallel: fetch pre-admission data + occupied beds
      const [preAdmRes, bedsRes] = await Promise.all([
        supabase
          .from("pre_admissions")
          .select("*")
          .eq("id", preAdmission.id)
          .single(),
        supabase
          .from("patients")
          .select("bed_number")
          .eq("hospital_unit_id", currentHospital.id)
          .eq("state_id", currentState.id)
          .eq("department", currentDepartment)
          .eq("sector", storedSector)
          .or("is_vacant.is.null,is_vacant.eq.false"),
      ]);

      if (preAdmRes.data) setFullData(preAdmRes.data as unknown as PreAdmissionFull);

      const occupied = (bedsRes.data || []).map(p => p.bed_number);
      setOccupiedBeds(occupied);

      const config = SECTOR_BED_CONFIG[storedSector];
      if (config) {
        const start = config.startNumber ?? 1;
        const end = start + config.maxRegularBeds - 1;
        const beds: string[] = [];
        let freeCount = 0;
        for (let i = start; i <= end; i++) {
          const bedNum = `${config.prefix}${String(i).padStart(2, '0')}`;
          beds.push(bedNum);
          if (!occupied.includes(bedNum)) freeCount++;
        }
        beds.push("EXTRA");
        setAvailableBeds(beds);
        setSectorFullAlert(freeCount === 0);
      }
      setBedsLoaded(true);
    };
    fetchAll();
  }, [open, preAdmission?.id, currentHospital?.id, currentState?.id, currentDepartment, currentSectorCode]);

  // Re-fetch beds when sector changes manually (from the full-alert dropdown)
  const handleSectorChange = async (newSector: string) => {
    setSelectedSector(newSector);
    setSelectedBed("");
    setExtraBedRequested(false);
    setBedsLoaded(false);

    if (!currentHospital?.id || !currentState?.id) return;

    const { data } = await supabase
      .from("patients")
      .select("bed_number")
      .eq("hospital_unit_id", currentHospital.id)
      .eq("state_id", currentState.id)
      .eq("department", currentDepartment)
      .eq("sector", newSector)
      .or("is_vacant.is.null,is_vacant.eq.false");

    const occupied = (data || []).map(p => p.bed_number);
    setOccupiedBeds(occupied);

    const config = SECTOR_BED_CONFIG[newSector];
    if (config) {
      const start = config.startNumber ?? 1;
      const end = start + config.maxRegularBeds - 1;
      const beds: string[] = [];
      let freeCount = 0;
      for (let i = start; i <= end; i++) {
        const bedNum = `${config.prefix}${String(i).padStart(2, '0')}`;
        beds.push(bedNum);
        if (!occupied.includes(bedNum)) freeCount++;
      }
      beds.push("EXTRA");
      setAvailableBeds(beds);
      setSectorFullAlert(freeCount === 0);
    }
    setBedsLoaded(true);
  };

  const calcAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return Math.floor((Date.now() - new Date(birthDate + 'T12:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  // SAPS 3 é exclusivo para UTI e UCI (todas as 4 opções do diálogo são críticas).
  const isUtiAdmission =
    selectedSector === "red" ||
    selectedSector === "yellow" ||
    selectedSector === "blue" ||
    selectedSector === "outside";

  const handleAdmit = async () => {
    if (!selectedSector || !fullData || !currentHospital?.id || !currentState?.id) return;
    if (!isUtiAdmission && !selectedBed) return;

    setIsSubmitting(true);
    try {
      const age = calcAge(fullData.birth_date);
      const destinationSectorLabel = SECTORS.find((sector) => sector.value === selectedSector)?.label || selectedSector;

      if (isUtiAdmission) {
        // Calcula o leito final (incluindo EXTRA dinâmico) já neste pop-up
        let finalBedUti = selectedBed;
        if (selectedBed === "EXTRA" || extraBedRequested) {
          const extraBeds = occupiedBeds
            .filter(b => b.startsWith("EXTRA"))
            .map(b => parseInt(b.replace("EXTRA", ""), 10))
            .filter(n => !isNaN(n));
          const nextExtra = extraBeds.length > 0 ? Math.max(...extraBeds) + 1 : 1;
          finalBedUti = `EXTRA${nextExtra}`;
        }
        if (!finalBedUti) {
          toast({ title: "Selecione um leito", description: "Escolha o leito antes de continuar para o SAPS 3.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }

        const { error: updateError } = await supabase
          .from("pre_admissions")
          .update({
            status: "aguardando_leito_uti",
            destination_sector: destinationSectorLabel,
            destination_bed: finalBedUti,
            notes: admissionNotes || fullData.notes || null,
          })
          .eq("id", fullData.id);

        if (updateError) throw updateError;

        const params = new URLSearchParams({
          fromAllocation: "true",
          preAdmissionId: fullData.id,
          patientName: fullData.patient_name,
          patientAge: age ? String(age) : "",
          destinationSector: destinationSectorLabel,
          selectedBed: finalBedUti,
          selectedSector,
        });
        if (extraBedRequested || selectedBed === "EXTRA") params.set("extraBed", "true");

        toast({
          title: "Encaminhado para admissão UTI",
          description: "Preencha o SAPS 3 antes de definir o leito.",
        });

        onOpenChange(false);
        onSuccess();
        setSelectedSector("");
        setSelectedBed("");
        setAdmissionNotes("");
        setFullData(null);
        setExtraBedRequested(false);
        setSectorFullAlert(false);
        navigate(`/saps3?${params.toString()}`);
        return;
      }

      let finalBed = selectedBed;
      if (selectedBed === "EXTRA") {
        const extraBeds = occupiedBeds.filter(b => b.startsWith("EXTRA")).map(b => parseInt(b.replace("EXTRA", ""), 10)).filter(n => !isNaN(n));
        const nextExtra = extraBeds.length > 0 ? Math.max(...extraBeds) + 1 : 1;
        finalBed = `EXTRA${nextExtra}`;
      }

      // Modelo de leitos fixos: cada leito já existe como linha "vaga" em patients.
      // Procuramos a linha existente do leito e atualizamos (ocupando-a).
      // Se não existir (ex.: leitos EXTRA dinâmicos), fazemos INSERT.
      const { data: existingBedRow } = await supabase
        .from("patients")
        .select("id, is_vacant")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .eq("department", currentDepartment)
        .eq("sector", selectedSector)
        .eq("bed_number", finalBed)
        .maybeSingle();

      if (existingBedRow && existingBedRow.is_vacant === false) {
        throw new Error(`Leito ${finalBed} já está ocupado. Atualize o mapa e selecione outro leito.`);
      }

      const patientPayload = {
        name: fullData.patient_name,
        age: age ? `${age}a` : null,
        bed_number: finalBed,
        sector: selectedSector,
        department: currentDepartment,
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        created_by: user?.id,
        admission_date: new Date().toISOString(),
        // Sincroniza automaticamente a data de admissão exibida no card (DD/MM/AAAA)
        uti_admission_date: new Date().toISOString(),
        is_vacant: false,
        clinical_status: fullData.risk_classification === "vermelho" ? "grave" : null,
        diagnoses: fullData.chief_complaint || null,
        medical_history: fullData.allergies ? `Alergias: ${fullData.allergies}` : null,
        pendencies: admissionNotes || null,
        medical_record: (fullData as any).medical_record ?? null,
        patient_registry_id: (fullData as any).patient_registry_id ?? null,
        // Previsão de alta: somente a data, sem sufixo "(N dias)"
        uti_discharge_prediction: noDischargePrediction
          ? "Sem previsão"
          : dischargeDate
          ? format(dischargeDate, "dd/MM/yyyy")
          : null,
        // Fluxo Pré-admissão: paciente fica em pre_admitido até a admissão hospitalar
        // ser concluída pelo Painel Clínico (formulário de admissão).
        admission_status: 'pre_admitido',
        admitted_at: null,
      };

      let insertedPatient: { id: string } | null = null;
      let patientError: any = null;
      if (existingBedRow?.id) {
        const { data, error } = await supabase
          .from("patients")
          .update(patientPayload)
          .eq("id", existingBedRow.id)
          .select("id")
          .single();
        insertedPatient = data as any;
        patientError = error;
      } else {
        const { data, error } = await supabase
          .from("patients")
          .insert(patientPayload)
          .select("id")
          .single();
        insertedPatient = data as any;
        patientError = error;
      }

      if (patientError) throw patientError;

      // Vincula medical_records (prontuário legado/PIS) ao patients.id recém-admitido
      const newPatientId = insertedPatient?.id;
      const registryId = (fullData as any).patient_registry_id ?? null;
      const recordNumber = (fullData as any).medical_record ?? null;
      if (newPatientId && (registryId || recordNumber)) {
        const mrQuery = supabase.from("medical_records").update({ patient_id: newPatientId });
        if (registryId) {
          await mrQuery.eq("patient_registry_id", registryId).is("patient_id", null);
        } else if (recordNumber) {
          await mrQuery.eq("numero_prontuario", recordNumber).is("patient_id", null);
        }
      }

      const { error: updateError } = await supabase
        .from("pre_admissions")
        .update({
          status: "admitido",
          destination_sector: selectedSector,
          destination_bed: finalBed,
        })
        .eq("id", fullData.id);

      if (updateError) throw updateError;

      toast({ title: "Paciente PRÉ-ADMITIDO", description: `${fullData.patient_name} → Leito ${finalBed}. Conclua a admissão hospitalar pelo Painel Clínico.` });
      onOpenChange(false);
      onSuccess();
      setSelectedSector("");
      setSelectedBed("");
      setAdmissionNotes("");
      setFullData(null);
      setExtraBedRequested(false);
      setSectorFullAlert(false);
    } catch (err: any) {
      toast({ title: "Erro na admissão", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!preAdmission) return null;
  
  if (!fullData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const pa = fullData;
  const vs = pa.vital_signs || {};
  const gd = pa.glasgow_detail || {};
  const age = calcAge(pa.birth_date);

  const airwayStatus = pa.airway_intubated ? "IOT/Intubado" : pa.airway_obstruction ? "Obstruída" : pa.airway_patent ? "Pérvias" : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" />
            Pré-admissão em Leito
          </DialogTitle>
          <DialogDescription>
            Aloca o paciente no leito e prepara o SAPS 3 quando indicado. A admissão hospitalar (HDA, exame físico, plano) é feita depois pelo Painel Clínico.
          </DialogDescription>
        </DialogHeader>

        {/* Patient Header */}
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/50 border">
          <div>
            <p className="patient-id font-bold text-sm">{pa.patient_name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {age !== null && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{age} anos</span>}
              {pa.sex && <span>• {pa.sex}</span>}
              {pa.medical_record && <span>• Pront: {pa.medical_record}</span>}
            </div>
            {pa.chief_complaint && (
              <p className="text-xs mt-1"><span className="font-medium">Queixa:</span> {pa.chief_complaint}</p>
            )}
          </div>
          {pa.risk_classification && (
            <Badge className={cn("shrink-0", RISK_COLORS[pa.risk_classification])}>
              {RISK_LABELS[pa.risk_classification]}
            </Badge>
          )}
        </div>

        {/* Triage Summary */}
        <div className="grid grid-cols-2 gap-2">
          {/* Vital Signs */}
          {(vs.pa_sistolica || vs.fc || vs.fr || vs.tax || vs.spo2) && (
            <Card className="col-span-2">
              <CardContent className="p-3">
                <p className="text-xs font-semibold flex items-center gap-1 mb-2">
                  <Activity className="h-3.5 w-3.5 text-primary" /> Sinais Vitais
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                  {vs.pa_sistolica && <div><span className="text-muted-foreground">PA:</span> {vs.pa_sistolica}/{vs.pa_diastolica}</div>}
                  {vs.fc && <div><span className="text-muted-foreground">FC:</span> {vs.fc}</div>}
                  {vs.fr && <div><span className="text-muted-foreground">FR:</span> {vs.fr}</div>}
                  {vs.tax && <div><span className="text-muted-foreground">Tax:</span> {vs.tax}°C</div>}
                  {vs.spo2 && <div><span className="text-muted-foreground">SpO₂:</span> {vs.spo2}%</div>}
                  {vs.hgt && <div><span className="text-muted-foreground">HGT:</span> {vs.hgt}</div>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Glasgow */}
          {pa.glasgow_score && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs font-semibold flex items-center gap-1 mb-1">
                  <Brain className="h-3.5 w-3.5 text-purple-500" /> Glasgow
                </p>
                <p className="text-lg font-bold">{pa.glasgow_score}<span className="text-xs font-normal text-muted-foreground">/15</span></p>
                <div className="text-[10px] text-muted-foreground">
                  {gd.ocular && <span>O:{gd.ocular} </span>}
                  {gd.verbal && <span>V:{gd.verbal} </span>}
                  {gd.motor && <span>M:{gd.motor}</span>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Airway & Circulation */}
          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-semibold flex items-center gap-1 mb-1">
                <Wind className="h-3.5 w-3.5 text-sky-500" /> Via Aérea / Circulação
              </p>
              <div className="text-[11px] space-y-0.5">
                <p><span className="text-muted-foreground">VA:</span> {airwayStatus}</p>
                {pa.peripheral_perfusion && <p><span className="text-muted-foreground">Perfusão:</span> {pa.peripheral_perfusion}</p>}
                {pa.pulse_quality && <p><span className="text-muted-foreground">Pulso:</span> {pa.pulse_quality}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Extras */}
          {(pa.allergies || pa.flu_symptoms || pa.oxygen_therapy || pa.pain_scale !== null) && (
            <Card className="col-span-2">
              <CardContent className="p-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  {pa.pain_scale !== null && pa.pain_scale !== undefined && (
                    <div><span className="text-muted-foreground">Dor:</span> <span className="font-semibold">{pa.pain_scale}/10</span></div>
                  )}
                  {pa.allergies && <div><span className="text-muted-foreground">Alergias:</span> {pa.allergies}</div>}
                  {pa.flu_symptoms && <div className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-orange-500" /> Sintomas gripais{pa.flu_symptoms_detail ? `: ${pa.flu_symptoms_detail}` : ""}</div>}
                  {pa.oxygen_therapy && <div><span className="text-muted-foreground">O₂:</span> {pa.oxygen_therapy_detail || "Sim"}</div>}
                </div>
              </CardContent>
            </Card>
          )}

          {pa.triage_notes && (
            <Card className="col-span-2">
              <CardContent className="p-3 text-[11px]">
                <span className="font-semibold">Obs. Triagem:</span> {pa.triage_notes}
              </CardContent>
            </Card>
          )}
        </div>

        <Separator />

        {/* Allocation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <BedDouble className="h-4 w-4" /> Alocação
            </p>
            <div className="flex items-center gap-2">
              {bedsLoaded && (() => {
                const freeCount = availableBeds.filter(b => b !== "EXTRA" && !occupiedBeds.includes(b)).length;
                return freeCount > 0 ? (
                  <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
                    {freeCount} {freeCount === 1 ? "leito livre" : "leitos livres"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/10">
                    Lotado
                  </Badge>
                );
              })()}
              <Badge variant="outline" className="text-xs font-medium">
                {SECTORS.find(s => s.value === selectedSector)?.label || "—"}
              </Badge>
            </div>
          </div>

          {/* Sector full alert */}
          {bedsLoaded && sectorFullAlert && !extraBedRequested && (
            <Card className="border-destructive/40 bg-destructive/10">
              <CardContent className="p-3 flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-destructive">Setor lotado — Admissão bloqueada</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Todos os leitos regulares de <span className="font-medium">{SECTORS.find(s => s.value === selectedSector)?.label}</span> estão ocupados. 
                    Solicite uma maca extra para alocação provisória ou altere o setor.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                      onClick={() => {
                        setExtraBedRequested(true);
                        setSelectedBed("EXTRA");
                      }}
                    >
                      <BedDouble className="h-3.5 w-3.5" />
                      Solicitar Maca Extra
                    </Button>
                    <Select value={selectedSector} onValueChange={handleSectorChange}>
                      <SelectTrigger className="h-7 w-auto text-xs px-2">
                        <SelectValue placeholder="Alterar setor" />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTORS.map(s => (
                          <SelectItem key={s.value} value={s.value}>
                            <span className={s.color}>{s.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extra bed confirmed */}
          {bedsLoaded && sectorFullAlert && extraBedRequested && (
            <Card className="border-amber-500/40 bg-amber-500/10">
              <CardContent className="p-3 flex items-start gap-2.5">
                <BedDouble className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Maca extra solicitada</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    O paciente será alocado provisoriamente em maca extra no setor <span className="font-medium">{SECTORS.find(s => s.value === selectedSector)?.label}</span>.
                    Transfira para leito regular assim que houver disponibilidade.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-6 text-[10px] text-muted-foreground px-1"
                    onClick={() => { setExtraBedRequested(false); setSelectedBed(""); }}
                  >
                    Cancelar maca extra
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bed grid (UTI + non-UTI unificado) */}
          {bedsLoaded && !sectorFullAlert && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Selecione o leito</Label>
                {selectedBed && selectedBed !== "EXTRA" && (
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/10">
                    {selectedBed}
                  </Badge>
                )}
              </div>
              <div className="rounded-md border bg-muted/30 p-2 max-h-[180px] overflow-y-auto">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {availableBeds.map(bed => {
                    if (bed === "EXTRA") {
                      const isSel = selectedBed === "EXTRA";
                      return (
                        <button
                          key="EXTRA"
                          type="button"
                          onClick={() => setSelectedBed("EXTRA")}
                          className={cn(
                            "rounded-md border px-1.5 py-1.5 text-[10px] font-semibold transition-all flex flex-col items-center gap-0.5",
                            isSel
                              ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/30"
                              : "border-dashed border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                          )}
                        >
                          <BedDouble className="h-3 w-3" />
                          EXTRA
                        </button>
                      );
                    }
                    const isOccupied = occupiedBeds.includes(bed);
                    const isSel = selectedBed === bed;
                    return (
                      <button
                        key={bed}
                        type="button"
                        disabled={isOccupied}
                        onClick={() => setSelectedBed(bed)}
                        className={cn(
                          "rounded-md border px-1.5 py-1.5 text-[11px] font-semibold transition-all flex flex-col items-center gap-0.5 leading-tight",
                          isOccupied
                            ? "border-destructive/30 bg-destructive/10 text-destructive/70 cursor-not-allowed"
                            : isSel
                              ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/30"
                              : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15"
                        )}
                      >
                        <BedDouble className="h-3 w-3" />
                        {bed}
                        <span className="text-[9px] font-normal opacity-80">
                          {isOccupied ? "Ocupado" : "Livre"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {isUtiAdmission && (
                <p className="text-[10px] text-muted-foreground">
                  O leito escolhido será reservado e aparecerá pré-selecionado no SAPS 3.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Previsão de alta</Label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noDischargePrediction}
                  onChange={(e) => {
                    setNoDischargePrediction(e.target.checked);
                    if (e.target.checked) {
                      setDischargeDays("");
                      setDischargeDate(undefined);
                    }
                  }}
                  className="h-3.5 w-3.5 cursor-pointer"
                />
                Sem previsão
              </label>
            </div>
            <div className={cn("flex gap-2", noDischargePrediction && "opacity-50 pointer-events-none")}>

              <div className="relative w-32">
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={dischargeDays}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setDischargeDays(v);
                    if (v === "") {
                      setDischargeDate(undefined);
                    } else {
                      const n = parseInt(v, 10);
                      if (!isNaN(n)) setDischargeDate(addDays(startOfDay(new Date()), n));
                    }
                  }}
                  placeholder="Dias"
                  className="h-9 text-xs pr-10"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">dias</span>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-9 flex-1 justify-start text-left font-normal text-xs",
                      !dischargeDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dischargeDate
                      ? format(dischargeDate, "dd/MM/yyyy (EEE)", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI
                    mode="single"
                    selected={dischargeDate}
                    onSelect={(d) => {
                      setDischargeDate(d);
                      if (d) {
                        const diff = differenceInCalendarDays(startOfDay(d), startOfDay(new Date()));
                        setDischargeDays(diff >= 0 ? String(diff) : "");
                      } else {
                        setDischargeDays("");
                      }
                    }}
                    disabled={(date) => date < startOfDay(new Date())}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Digite os dias para ver a data, ou escolha a data para calcular os dias automaticamente.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações da admissão (opcional)</Label>
            <Textarea
              value={admissionNotes}
              onChange={(e) => setAdmissionNotes(e.target.value)}
              placeholder="Pendências, condutas iniciais..."
              className="h-16 text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleAdmit}
            disabled={!selectedSector || !selectedBed || isSubmitting || (sectorFullAlert && !extraBedRequested)}
            className="gap-1"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BedDouble className="h-4 w-4" />}
            {isUtiAdmission ? "Continuar para SAPS 3" : "Pré-admitir em Leito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
