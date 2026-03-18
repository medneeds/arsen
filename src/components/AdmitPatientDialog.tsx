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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BedDouble, Shield, Thermometer, Heart, Brain, Wind,
  AlertTriangle, Loader2, User, Calendar, Activity, Droplets
} from "lucide-react";
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
};

const RISK_LABELS: Record<string, string> = {
  vermelho: "EMERGÊNCIA",
  laranja: "MUITO URGENTE",
  amarelo: "URGENTE",
  verde: "POUCO URGENTE",
  azul: "NÃO URGENTE",
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
  const [availableBeds, setAvailableBeds] = useState<string[]>([]);
  const [occupiedBeds, setOccupiedBeds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullData, setFullData] = useState<PreAdmissionFull | null>(null);

  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch full pre-admission data with triage info
  useEffect(() => {
    if (!open || !preAdmission?.id) return;
    const fetchFull = async () => {
      const { data } = await supabase
        .from("pre_admissions")
        .select("*")
        .eq("id", preAdmission.id)
        .single();
      if (data) setFullData(data as unknown as PreAdmissionFull);
    };
    fetchFull();
  }, [open, preAdmission?.id]);

  // Fetch occupied beds when sector changes
  useEffect(() => {
    if (!selectedSector || !currentHospital?.id || !currentState?.id) {
      setAvailableBeds([]);
      return;
    }
    const fetchBeds = async () => {
      const { data } = await supabase
        .from("patients")
        .select("bed_number")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .eq("department", currentDepartment)
        .eq("sector", selectedSector);

      const occupied = (data || []).map(p => p.bed_number);
      setOccupiedBeds(occupied);

      const config = SECTOR_BED_CONFIG[selectedSector];
      if (!config) return;

      const start = config.startNumber ?? 1;
      const end = start + config.maxRegularBeds - 1;
      const beds: string[] = [];
      for (let i = start; i <= end; i++) {
        const bedNum = `${config.prefix}${String(i).padStart(2, '0')}`;
        beds.push(bedNum);
      }
      beds.push("EXTRA");
      setAvailableBeds(beds);
    };
    fetchBeds();
  }, [selectedSector, currentHospital?.id, currentState?.id, currentDepartment]);

  const calcAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return Math.floor((Date.now() - new Date(birthDate + 'T12:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const isUtiAdmission = selectedSector === "red" || selectedSector === "yellow";

  const handleAdmit = async () => {
    if (!selectedSector || !fullData || !currentHospital?.id || !currentState?.id) return;
    if (!isUtiAdmission && !selectedBed) return;

    setIsSubmitting(true);
    try {
      const age = calcAge(fullData.birth_date);
      const destinationSectorLabel = SECTORS.find((sector) => sector.value === selectedSector)?.label || selectedSector;

      if (isUtiAdmission) {
        const { error: updateError } = await supabase
          .from("pre_admissions")
          .update({
            status: "aguardando_leito_uti",
            destination_sector: destinationSectorLabel,
            destination_bed: null,
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
        });

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
        navigate(`/saps3?${params.toString()}`);
        return;
      }

      let finalBed = selectedBed;
      if (selectedBed === "EXTRA") {
        const extraBeds = occupiedBeds.filter(b => b.startsWith("EXTRA")).map(b => parseInt(b.replace("EXTRA", ""), 10)).filter(n => !isNaN(n));
        const nextExtra = extraBeds.length > 0 ? Math.max(...extraBeds) + 1 : 1;
        finalBed = `EXTRA${nextExtra}`;
      }

      const { error: patientError } = await supabase.from("patients").insert({
        name: fullData.patient_name,
        age: age ? `${age}a` : null,
        bed_number: finalBed,
        sector: selectedSector,
        department: currentDepartment,
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        created_by: user?.id,
        admission_date: new Date().toISOString(),
        is_vacant: false,
        clinical_status: fullData.risk_classification === "vermelho" ? "grave" : null,
        diagnoses: fullData.chief_complaint || null,
        medical_history: fullData.allergies ? `Alergias: ${fullData.allergies}` : null,
        pendencies: admissionNotes || null,
      });

      if (patientError) throw patientError;

      const { error: updateError } = await supabase
        .from("pre_admissions")
        .update({
          status: "admitido",
          destination_sector: selectedSector,
          destination_bed: finalBed,
        })
        .eq("id", fullData.id);

      if (updateError) throw updateError;

      toast({ title: "Paciente admitido", description: `${fullData.patient_name} → Leito ${finalBed}` });
      onOpenChange(false);
      onSuccess();
      setSelectedSector("");
      setSelectedBed("");
      setAdmissionNotes("");
      setFullData(null);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" />
            Admissão em Leito
          </DialogTitle>
          <DialogDescription>
            Revise os dados da triagem e selecione o setor e leito para internação.
          </DialogDescription>
        </DialogHeader>

        {/* Patient Header */}
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/50 border">
          <div>
            <p className="font-bold text-sm">{pa.patient_name}</p>
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

        {/* Bed Selection */}
        <div className="space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <BedDouble className="h-4 w-4" /> Alocação
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Setor</Label>
              <Select value={selectedSector} onValueChange={(v) => { setSelectedSector(v); setSelectedBed(""); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className={s.color}>{s.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Leito</Label>
              <Select value={selectedBed} onValueChange={setSelectedBed} disabled={!selectedSector}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar leito" /></SelectTrigger>
                <SelectContent>
                  {availableBeds.map(bed => {
                    const isOccupied = occupiedBeds.includes(bed);
                    if (bed === "EXTRA") {
                      return (
                        <SelectItem key="EXTRA" value="EXTRA">
                          ➕ Leito Extra
                        </SelectItem>
                      );
                    }
                    return (
                      <SelectItem key={bed} value={bed} disabled={isOccupied}>
                        {bed} {isOccupied ? "(Ocupado)" : "✓"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
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
            disabled={!selectedSector || !selectedBed || isSubmitting}
            className="gap-1"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BedDouble className="h-4 w-4" />}
            Confirmar Admissão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
