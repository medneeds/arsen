import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  Calculator,
  ClipboardList,
  Heart,
  Thermometer,
  Brain,
  Save,
  Plus,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── SAPS 3 Scoring Tables (simplified reference values) ───
// Based on Moreno RP et al. SAPS 3 — From evaluation of the patient to evaluation of the intensive care unit

function calculateAgeScore(age: number | null): number {
  if (!age) return 0;
  if (age < 40) return 0;
  if (age < 60) return 5;
  if (age < 70) return 9;
  if (age < 75) return 13;
  if (age < 80) return 15;
  return 18;
}

function calculateLosBeforeIcuScore(days: number | null): number {
  if (days === null || days === undefined) return 0;
  if (days < 1) return 0;
  if (days < 14) return 4;
  if (days < 28) return 6;
  return 7;
}

function calculateAdmissionSourceScore(source: string | null): number {
  if (!source) return 0;
  switch (source) {
    case "operating_room": return 0;
    case "same_hospital_floor": return 5;
    case "emergency": return 6;
    case "other_hospital": return 7;
    case "other_icu": return 8;
    default: return 0;
  }
}

function calculatePlannedScore(planned: boolean): number {
  return planned ? 0 : 3;
}

function calculateSurgicalStatusScore(status: string | null): number {
  if (!status) return 0;
  switch (status) {
    case "no_surgery": return 5;
    case "scheduled_surgery": return 0;
    case "emergency_surgery": return 6;
    default: return 0;
  }
}

function calculateInfectionScore(infection: string | null): number {
  if (!infection || infection === "none") return 0;
  if (infection === "nosocomial") return 4;
  if (infection === "respiratory") return 3;
  return 3;
}

function calculateGcsScore(gcs: number | null): number {
  if (!gcs) return 0;
  if (gcs >= 13) return 0;
  if (gcs >= 8) return 4;
  if (gcs >= 6) return 7;
  if (gcs >= 4) return 10;
  return 15;
}

function calculateHrScore(hr: number | null): number {
  if (!hr) return 0;
  if (hr < 40) return 11;
  if (hr < 70) return 2;
  if (hr < 120) return 0;
  if (hr < 160) return 4;
  return 7;
}

function calculateSbpScore(sbp: number | null): number {
  if (!sbp) return 0;
  if (sbp < 40) return 11;
  if (sbp < 70) return 8;
  if (sbp < 100) return 3;
  if (sbp < 120) return 0;
  if (sbp < 200) return 2;
  return 3;
}

function calculateBilirubinScore(bil: number | null): number {
  if (!bil) return 0;
  if (bil < 2) return 0;
  if (bil < 6) return 4;
  return 5;
}

function calculateTempScore(temp: number | null): number {
  if (!temp) return 0;
  if (temp < 35) return 7;
  return 0;
}

function calculateCreatinineScore(cr: number | null): number {
  if (!cr) return 0;
  if (cr < 1.2) return 0;
  if (cr < 2) return 4;
  if (cr < 3.5) return 7;
  return 8;
}

function calculateLeukocytesScore(leuk: number | null): number {
  if (!leuk) return 0;
  if (leuk < 1) return 5; // severe leukopenia (< 1.0 x10³/mm³)
  return 0;
}

function calculatePhScore(ph: number | null): number {
  if (!ph) return 0;
  if (ph < 7.25) return 3;
  return 0;
}

function calculatePlateletsScore(plt: number | null): number {
  if (!plt) return 0;
  if (plt < 20) return 13;
  if (plt < 50) return 8;
  if (plt < 100) return 5;
  return 0;
}

function calculateOxygenationScore(ratio: number | null, ventilated: boolean): number {
  if (!ventilated || !ratio) return 0;
  if (ratio < 100) return 11;
  if (ratio < 200) return 7;
  return 0;
}

function calculateComorbidityScore(comorbidities: string[]): number {
  let score = 0;
  const scoreMap: Record<string, number> = {
    cancer_hematologic: 10,
    cancer_metastatic: 11,
    hiv_aids: 8,
    cirrhosis: 4,
    heart_failure_nyha4: 6,
    chronic_renal: 3,
    immunosuppression: 3,
    chemotherapy: 3,
  };
  for (const c of comorbidities) {
    score += scoreMap[c] || 0;
  }
  return score;
}

function calculateAdmissionReasonScore(reason: string | null): number {
  if (!reason) return 0;
  const scoreMap: Record<string, number> = {
    cardiovascular: 3,
    neurological: 5,
    hepatic: 6,
    digestive: 4,
    respiratory: 0,
    other: 0,
  };
  return scoreMap[reason] || 0;
}

// Logit-based mortality prediction (SAPS 3 equation — general model)
function predictMortality(totalScore: number): number {
  const logit = -32.6659 + Math.log(totalScore + 20.5958) * 7.3068;
  const probability = Math.exp(logit) / (1 + Math.exp(logit));
  return Math.round(probability * 1000) / 10; // percentage with 1 decimal
}

interface Saps3Record {
  id: string;
  patient_name: string;
  total_score: number | null;
  predicted_mortality: number | null;
  created_at: string;
}

const COMORBIDITY_OPTIONS = [
  { id: "cancer_hematologic", label: "Neoplasia hematológica" },
  { id: "cancer_metastatic", label: "Câncer metastático" },
  { id: "hiv_aids", label: "HIV/AIDS" },
  { id: "cirrhosis", label: "Cirrose" },
  { id: "heart_failure_nyha4", label: "IC NYHA IV" },
  { id: "chronic_renal", label: "Doença renal crônica" },
  { id: "immunosuppression", label: "Imunossupressão" },
  { id: "chemotherapy", label: "Quimioterapia recente" },
];

export default function Saps3Page() {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const selectedHospital = currentHospital?.id;
  const selectedState = currentState?.id;
  
  const [records, setRecords] = useState<Saps3Record[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Box I
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState<string>("");
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [losBeforeIcu, setLosBeforeIcu] = useState<string>("");
  const [admissionSource, setAdmissionSource] = useState<string>("");
  const [plannedAdmission, setPlannedAdmission] = useState(false);

  // Box II
  const [admissionReason, setAdmissionReason] = useState<string>("");
  const [admissionReasonDetail, setAdmissionReasonDetail] = useState("");
  const [surgicalStatus, setSurgicalStatus] = useState<string>("");
  const [surgeryType, setSurgeryType] = useState<string>("");
  const [infectionAtAdmission, setInfectionAtAdmission] = useState<string>("");

  // Box III
  const [gcs, setGcs] = useState<string>("");
  const [hrHighest, setHrHighest] = useState<string>("");
  const [sbpLowest, setSbpLowest] = useState<string>("");
  const [bilirubinHighest, setBilirubinHighest] = useState<string>("");
  const [tempLowest, setTempLowest] = useState<string>("");
  const [creatinineHighest, setCreatinineHighest] = useState<string>("");
  const [leukocytes, setLeukocytes] = useState<string>("");
  const [phLowest, setPhLowest] = useState<string>("");
  const [plateletsLowest, setPlateletsLowest] = useState<string>("");
  const [pao2Fio2, setPao2Fio2] = useState<string>("");
  const [isVentilated, setIsVentilated] = useState(false);

  // Collapsible state
  const [box1Open, setBox1Open] = useState(true);
  const [box2Open, setBox2Open] = useState(true);
  const [box3Open, setBox3Open] = useState(true);

  // ─── Calculated Scores ───
  const scores = useMemo(() => {
    const ageN = age ? parseInt(age) : null;
    const losN = losBeforeIcu ? parseInt(losBeforeIcu) : null;
    const gcsN = gcs ? parseInt(gcs) : null;
    const hrN = hrHighest ? parseInt(hrHighest) : null;
    const sbpN = sbpLowest ? parseInt(sbpLowest) : null;
    const bilN = bilirubinHighest ? parseFloat(bilirubinHighest) : null;
    const tempN = tempLowest ? parseFloat(tempLowest) : null;
    const crN = creatinineHighest ? parseFloat(creatinineHighest) : null;
    const leukN = leukocytes ? parseFloat(leukocytes) : null;
    const phN = phLowest ? parseFloat(phLowest) : null;
    const pltN = plateletsLowest ? parseInt(plateletsLowest) : null;
    const oxyN = pao2Fio2 ? parseFloat(pao2Fio2) : null;

    const box1 = 16 + // base score
      calculateAgeScore(ageN) +
      calculateComorbidityScore(comorbidities) +
      calculateLosBeforeIcuScore(losN) +
      calculateAdmissionSourceScore(admissionSource) +
      calculatePlannedScore(plannedAdmission);

    const box2 =
      calculateAdmissionReasonScore(admissionReason) +
      calculateSurgicalStatusScore(surgicalStatus) +
      calculateInfectionScore(infectionAtAdmission);

    const box3 =
      calculateGcsScore(gcsN) +
      calculateHrScore(hrN) +
      calculateSbpScore(sbpN) +
      calculateBilirubinScore(bilN) +
      calculateTempScore(tempN) +
      calculateCreatinineScore(crN) +
      calculateLeukocytesScore(leukN) +
      calculatePhScore(phN) +
      calculatePlateletsScore(pltN) +
      calculateOxygenationScore(oxyN, isVentilated);

    const total = box1 + box2 + box3;
    const mortality = predictMortality(total);

    return { box1, box2, box3, total, mortality };
  }, [age, comorbidities, losBeforeIcu, admissionSource, plannedAdmission, admissionReason, surgicalStatus, infectionAtAdmission, gcs, hrHighest, sbpLowest, bilirubinHighest, tempLowest, creatinineHighest, leukocytes, phLowest, plateletsLowest, pao2Fio2, isVentilated]);

  // ─── Load records ───
  const loadRecords = async () => {
    if (!selectedHospital || !selectedState) return;
    const { data } = await supabase
      .from("saps3_assessments" as any)
      .select("id, patient_name, total_score, predicted_mortality, created_at")
      .eq("hospital_unit_id", selectedHospital)
      .eq("state_id", selectedState)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setRecords(data as any);
  };

  useEffect(() => {
    loadRecords();
  }, [selectedHospital, selectedState]);

  // ─── Save ───
  const handleSave = async () => {
    if (!patientName.trim()) {
      toast.error("Nome do paciente é obrigatório");
      return;
    }
    if (!selectedHospital || !selectedState) {
      toast.error("Hospital/Estado não selecionado");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        patient_name: patientName,
        hospital_unit_id: selectedHospital,
        state_id: selectedState,
        created_by: user?.id,
        age: age ? parseInt(age) : null,
        comorbidities: comorbidities,
        hospital_los_before_icu: losBeforeIcu ? parseInt(losBeforeIcu) : null,
        icu_admission_source: admissionSource || null,
        planned_admission: plannedAdmission,
        admission_reason: admissionReason || null,
        admission_reason_detail: admissionReasonDetail || null,
        surgical_status: surgicalStatus || null,
        surgery_type: surgeryType || null,
        infection_at_admission: infectionAtAdmission || null,
        gcs_score: gcs ? parseInt(gcs) : null,
        heart_rate_highest: hrHighest ? parseInt(hrHighest) : null,
        systolic_bp_lowest: sbpLowest ? parseInt(sbpLowest) : null,
        bilirubin_highest: bilirubinHighest ? parseFloat(bilirubinHighest) : null,
        temperature_lowest: tempLowest ? parseFloat(tempLowest) : null,
        creatinine_highest: creatinineHighest ? parseFloat(creatinineHighest) : null,
        leukocytes: leukocytes ? parseFloat(leukocytes) : null,
        ph_lowest: phLowest ? parseFloat(phLowest) : null,
        platelets_lowest: plateletsLowest ? parseInt(plateletsLowest) : null,
        oxygenation_pao2_fio2: pao2Fio2 ? parseFloat(pao2Fio2) : null,
        is_mechanically_ventilated: isVentilated,
        box1_score: scores.box1,
        box2_score: scores.box2,
        box3_score: scores.box3,
        total_score: scores.total,
        predicted_mortality: scores.mortality,
      };

      const { error } = await supabase.from("saps3_assessments" as any).insert(payload as any);
      if (error) throw error;

      toast.success("Ficha SAPS 3 salva com sucesso!");
      resetForm();
      setShowForm(false);
      loadRecords();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("saps3_assessments" as any).delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Registro excluído");
      loadRecords();
    }
    setDeleteId(null);
  };

  const resetForm = () => {
    setPatientName(""); setAge(""); setComorbidities([]); setLosBeforeIcu("");
    setAdmissionSource(""); setPlannedAdmission(false); setAdmissionReason("");
    setAdmissionReasonDetail(""); setSurgicalStatus(""); setSurgeryType("");
    setInfectionAtAdmission(""); setGcs(""); setHrHighest(""); setSbpLowest("");
    setBilirubinHighest(""); setTempLowest(""); setCreatinineHighest("");
    setLeukocytes(""); setPhLowest(""); setPlateletsLowest(""); setPao2Fio2("");
    setIsVentilated(false);
  };

  const getMortalityColor = (m: number | null) => {
    if (!m) return "text-muted-foreground";
    if (m < 10) return "text-emerald-600 dark:text-emerald-400";
    if (m < 25) return "text-yellow-600 dark:text-yellow-400";
    if (m < 50) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getMortalityBadge = (m: number) => {
    if (m < 10) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (m < 25) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    if (m < 50) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            SAPS 3 — Admissão UTI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simplified Acute Physiology Score III — Cálculo automático de score e mortalidade predita
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Avaliação
        </Button>
      </div>

      {/* ─── Score Panel (visible when form is open) ─── */}
      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Box I</p>
                <p className="text-2xl font-bold text-foreground">{scores.box1}</p>
                <p className="text-xs text-muted-foreground">Pré-admissão</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Box II</p>
                <p className="text-2xl font-bold text-foreground">{scores.box2}</p>
                <p className="text-xs text-muted-foreground">Circunstâncias</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Box III</p>
                <p className="text-2xl font-bold text-foreground">{scores.box3}</p>
                <p className="text-xs text-muted-foreground">Fisiológicas</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="text-3xl font-extrabold text-primary">{scores.total}</p>
                <p className="text-xs text-muted-foreground">Score total</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Mortalidade</p>
                <p className={`text-3xl font-extrabold ${getMortalityColor(scores.mortality)}`}>
                  {scores.mortality}%
                </p>
                <p className="text-xs text-muted-foreground">Predita (hospitalar)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Form ─── */}
      {showForm && (
        <div className="space-y-4">
          {/* Patient Name */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="patientName">Nome do Paciente *</Label>
                  <Input id="patientName" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Nome completo" />
                </div>
                <div>
                  <Label htmlFor="age">Idade (anos)</Label>
                  <Input id="age" type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Ex: 65" min={0} max={120} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Box I */}
          <Collapsible open={box1Open} onOpenChange={setBox1Open}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-blue-500" />
                      Box I — Características Pré-Admissão UTI
                      <Badge variant="outline" className="ml-2">{scores.box1} pts</Badge>
                    </span>
                    {box1Open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Tempo de internação hospitalar antes da UTI (dias)</Label>
                      <Input type="number" value={losBeforeIcu} onChange={e => setLosBeforeIcu(e.target.value)} placeholder="0" min={0} />
                    </div>
                    <div>
                      <Label>Origem da admissão na UTI</Label>
                      <Select value={admissionSource} onValueChange={setAdmissionSource}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="emergency">Pronto-Socorro</SelectItem>
                          <SelectItem value="same_hospital_floor">Enfermaria do mesmo hospital</SelectItem>
                          <SelectItem value="other_icu">Outra UTI</SelectItem>
                          <SelectItem value="other_hospital">Outro hospital</SelectItem>
                          <SelectItem value="operating_room">Centro cirúrgico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={plannedAdmission} onCheckedChange={setPlannedAdmission} />
                    <Label>Admissão planejada</Label>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Comorbidades</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {COMORBIDITY_OPTIONS.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={comorbidities.includes(c.id)}
                            onCheckedChange={(checked) => {
                              setComorbidities(prev =>
                                checked ? [...prev, c.id] : prev.filter(x => x !== c.id)
                              );
                            }}
                          />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Box II */}
          <Collapsible open={box2Open} onOpenChange={setBox2Open}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-amber-500" />
                      Box II — Circunstâncias da Admissão
                      <Badge variant="outline" className="ml-2">{scores.box2} pts</Badge>
                    </span>
                    {box2Open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Razão principal da admissão</Label>
                      <Select value={admissionReason} onValueChange={setAdmissionReason}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cardiovascular">Cardiovascular</SelectItem>
                          <SelectItem value="neurological">Neurológica</SelectItem>
                          <SelectItem value="hepatic">Hepática</SelectItem>
                          <SelectItem value="digestive">Digestiva/Gastrointestinal</SelectItem>
                          <SelectItem value="respiratory">Respiratória</SelectItem>
                          <SelectItem value="other">Outra</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Detalhamento</Label>
                      <Input value={admissionReasonDetail} onChange={e => setAdmissionReasonDetail(e.target.value)} placeholder="Especifique" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Status cirúrgico</Label>
                      <Select value={surgicalStatus} onValueChange={setSurgicalStatus}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_surgery">Sem cirurgia</SelectItem>
                          <SelectItem value="scheduled_surgery">Cirurgia eletiva</SelectItem>
                          <SelectItem value="emergency_surgery">Cirurgia de emergência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(surgicalStatus === "scheduled_surgery" || surgicalStatus === "emergency_surgery") && (
                      <div>
                        <Label>Tipo de cirurgia</Label>
                        <Select value={surgeryType} onValueChange={setSurgeryType}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transplant">Transplante</SelectItem>
                            <SelectItem value="trauma">Trauma</SelectItem>
                            <SelectItem value="cardiac">Cardíaca</SelectItem>
                            <SelectItem value="neurosurgery">Neurocirurgia</SelectItem>
                            <SelectItem value="other">Outra</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Infecção na admissão</Label>
                    <Select value={infectionAtAdmission} onValueChange={setInfectionAtAdmission}>
                      <SelectTrigger className="max-w-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem infecção</SelectItem>
                        <SelectItem value="nosocomial">Nosocomial</SelectItem>
                        <SelectItem value="respiratory">Respiratória</SelectItem>
                        <SelectItem value="other">Outra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Box III */}
          <Collapsible open={box3Open} onOpenChange={setBox3Open}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      Box III — Variáveis Fisiológicas (±1h da admissão)
                      <Badge variant="outline" className="ml-2">{scores.box3} pts</Badge>
                    </span>
                    {box3Open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div>
                      <Label className="flex items-center gap-1">
                        <Brain className="h-3.5 w-3.5" /> Glasgow (GCS)
                      </Label>
                      <Input type="number" value={gcs} onChange={e => setGcs(e.target.value)} placeholder="3-15" min={3} max={15} />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" /> FC mais alta (bpm)
                      </Label>
                      <Input type="number" value={hrHighest} onChange={e => setHrHighest(e.target.value)} placeholder="Ex: 110" />
                    </div>
                    <div>
                      <Label>PAS mais baixa (mmHg)</Label>
                      <Input type="number" value={sbpLowest} onChange={e => setSbpLowest(e.target.value)} placeholder="Ex: 90" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5" /> Temp. mais baixa (°C)
                      </Label>
                      <Input type="number" step="0.1" value={tempLowest} onChange={e => setTempLowest(e.target.value)} placeholder="Ex: 36.2" />
                    </div>
                    <div>
                      <Label>Bilirrubina mais alta (mg/dL)</Label>
                      <Input type="number" step="0.1" value={bilirubinHighest} onChange={e => setBilirubinHighest(e.target.value)} placeholder="Ex: 1.2" />
                    </div>
                    <div>
                      <Label>Creatinina mais alta (mg/dL)</Label>
                      <Input type="number" step="0.1" value={creatinineHighest} onChange={e => setCreatinineHighest(e.target.value)} placeholder="Ex: 1.5" />
                    </div>
                    <div>
                      <Label>Leucócitos (x10³/mm³)</Label>
                      <Input type="number" step="0.1" value={leukocytes} onChange={e => setLeukocytes(e.target.value)} placeholder="Ex: 12.5" />
                    </div>
                    <div>
                      <Label>pH mais baixo</Label>
                      <Input type="number" step="0.01" value={phLowest} onChange={e => setPhLowest(e.target.value)} placeholder="Ex: 7.35" />
                    </div>
                    <div>
                      <Label>Plaquetas mais baixas (x10³)</Label>
                      <Input type="number" value={plateletsLowest} onChange={e => setPlateletsLowest(e.target.value)} placeholder="Ex: 150" />
                    </div>
                    <div>
                      <Label>PaO₂/FiO₂</Label>
                      <Input type="number" value={pao2Fio2} onChange={e => setPao2Fio2(e.target.value)} placeholder="Ex: 300" disabled={!isVentilated} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Switch checked={isVentilated} onCheckedChange={setIsVentilated} />
                    <Label>Em ventilação mecânica</Label>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar Avaliação"}
            </Button>
          </div>
        </div>
      )}

      {/* ─── History ─── */}
      {!showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" /> Avaliações Registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma avaliação SAPS 3 registrada ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {records.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{r.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{r.total_score ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                      <div className="text-right">
                        <Badge className={getMortalityBadge(r.predicted_mortality ?? 0)}>
                          {r.predicted_mortality != null ? `${r.predicted_mortality}%` : "—"}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">Mortalidade</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} className="text-destructive/60 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir avaliação SAPS 3?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
