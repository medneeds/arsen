import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { SapsConfirmationScreen } from "@/components/SapsConfirmationScreen";
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
import { useDepartment } from "@/contexts/DepartmentContext";
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
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  Bed,
  Clock,
  UserCheck,
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

// ─── SAPS 3 Scoring Tables ───
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
  if (leuk < 1) return 5;
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
    cancer_hematologic: 10, cancer_metastatic: 11, hiv_aids: 8,
    cirrhosis: 4, heart_failure_nyha4: 6, chronic_renal: 3,
    immunosuppression: 3, chemotherapy: 3,
  };
  for (const c of comorbidities) score += scoreMap[c] || 0;
  return score;
}

function calculateAdmissionReasonScore(reason: string | null): number {
  if (!reason) return 0;
  const m: Record<string, number> = { cardiovascular: 3, neurological: 5, hepatic: 6, digestive: 4, respiratory: 0, other: 0 };
  return m[reason] || 0;
}

function predictMortality(totalScore: number): number {
  const logit = -32.6659 + Math.log(totalScore + 20.5958) * 7.3068;
  const probability = Math.exp(logit) / (1 + Math.exp(logit));
  return Math.round(probability * 1000) / 10;
}

// ─── Types ───
interface PendingRequest {
  id: string;
  patient_name: string;
  birth_date: string | null;
  sex: string | null;
  destination_sector: string | null;
  notes: string | null;
  created_at: string;
  medical_record: string | null;
  patient_id?: string | null;
  allocation_request_id?: string | null;
}

interface Saps3Record {
  id: string;
  patient_name: string;
  total_score: number | null;
  predicted_mortality: number | null;
  created_at: string;
  status: string;
  pending_since: string | null;
}

const COMORBIDITY_OPTIONS = [
  { id: "cancer_hematologic", label: "Neoplasia hematológica", points: 10 },
  { id: "cancer_metastatic", label: "Câncer metastático", points: 11 },
  { id: "hiv_aids", label: "HIV/AIDS", points: 8 },
  { id: "cirrhosis", label: "Cirrose", points: 4 },
  { id: "heart_failure_nyha4", label: "IC NYHA IV", points: 6 },
  { id: "chronic_renal", label: "Doença renal crônica", points: 3 },
  { id: "immunosuppression", label: "Imunossupressão", points: 3 },
  { id: "chemotherapy", label: "Quimioterapia recente", points: 3 },
];

// ───── Antecedentes clínicos NÃO-SAPS (não pontuam, opcionais) ─────
const CLINICAL_HISTORY_OPTIONS = [
  { id: "has", label: "Hipertensão arterial (HAS)" },
  { id: "dm2", label: "Diabetes tipo 2" },
  { id: "dm1", label: "Diabetes tipo 1" },
  { id: "dpoc", label: "DPOC" },
  { id: "asma", label: "Asma" },
  { id: "avc_previo", label: "AVC prévio" },
  { id: "iam_previo", label: "IAM prévio" },
  { id: "fa", label: "Fibrilação atrial" },
  { id: "icc_nao_iv", label: "ICC (não NYHA IV)" },
  { id: "dislipidemia", label: "Dislipidemia" },
  { id: "obesidade", label: "Obesidade" },
  { id: "hipotireoidismo", label: "Hipotireoidismo" },
  { id: "chagas", label: "Doença de Chagas" },
  { id: "epilepsia", label: "Epilepsia" },
  { id: "depressao_ansiedade", label: "Depressão / Ansiedade" },
  { id: "hepatopatia_nao_cirrose", label: "Hepatopatia (não cirrótica)" },
  { id: "drc_nao_dialise", label: "DRC não dialítica" },
];

// ───── Drogas vasoativas (não pontuam SAPS — perfil hemodinâmico) ─────
const VASOACTIVE_OPTIONS = [
  { id: "noradrenalina", label: "Noradrenalina" },
  { id: "adrenalina", label: "Adrenalina" },
  { id: "vasopressina", label: "Vasopressina" },
  { id: "dobutamina", label: "Dobutamina" },
  { id: "dopamina", label: "Dopamina" },
  { id: "milrinona", label: "Milrinona" },
];

interface VasoactiveEntry {
  id: string;
  dose?: string; // mcg/kg/min
  hours?: string; // horas de uso
}

interface LifestyleHabits {
  tabagismo: "" | "nunca" | "ex" | "atual";
  macos_ano?: string;
  etilismo: "" | "nunca" | "social" | "abuso" | "dependencia";
  drogas: "" | "nunca" | "ex" | "atual";
  drogas_detalhe?: string;
}

interface ClinicalHistoryData {
  selected: string[];
  livre?: string; // texto livre para condições adicionais
}

const RASS_LABELS: Record<number, string> = {
  [-5]: "Não responsivo",
  [-4]: "Sedação profunda",
  [-3]: "Sedação moderada",
  [-2]: "Sedação leve",
  [-1]: "Sonolento",
  [0]: "Alerta e calmo",
  [1]: "Inquieto",
  [2]: "Agitado",
  [3]: "Muito agitado",
  [4]: "Combativo",
};

// Bed config per critical-care sector (UTI / UCI / UCC)
const UTI_SECTORS = [
  { value: "red", label: "UTI 1", prefix: "L", start: 1, max: 8, department: "UTI 1" },
  { value: "yellow", label: "UTI 2", prefix: "L", start: 9, max: 10, department: "UTI 2" },
  { value: "blue", label: "UCI 1", prefix: "L", start: 1, max: 6, department: "UCI 1" },
  { value: "outside", label: "UCI 2", prefix: "L", start: 7, max: 8, department: "UCI 2" },
  { value: "ucc", label: "UCC", prefix: "L", start: 1, max: 37, department: "UCC" },
];

// Map any incoming label/value/alias to internal sector value
function resolveSectorValue(input: string | null | undefined): string {
  if (!input) return "";
  const v = String(input).trim();
  const direct = UTI_SECTORS.find(s => s.value === v || s.label.toLowerCase() === v.toLowerCase());
  return direct?.value ?? "";
}

function resolveSectorFromContext(input: string | null | undefined, fallbackSector: string): string {
  return resolveSectorValue(input) || resolveSectorValue(fallbackSector) || "";
}

export default function Saps3Page() {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment, currentSectorCode } = useDepartment();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hospitalId = currentHospital?.id;
  const stateId = currentState?.id;

  // ─── State ───
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [records, setRecords] = useState<Saps3Record[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [occupiedBeds, setOccupiedBeds] = useState<string[]>([]);
  const [confirmationData, setConfirmationData] = useState<{
    patientName: string;
    bedNumber: string;
    sectorLabel: string;
    totalScore: number;
    predictedMortality: number;
    patientId?: string | null;
    sectorCode?: string;
    age?: string | null;
    mode?: "admission" | "validation";
  } | null>(null);

  // Allocation
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [selectedBed, setSelectedBed] = useState<string>("");

  // Modo "completar SAPS pendente" (paciente já admitido) — carregado via URL
  const [completingSapsId, setCompletingSapsId] = useState<string | null>(null);
  const [completingPatientId, setCompletingPatientId] = useState<string | null>(null);

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

  // Box III — Avaliação de consciência guiada
  // sedationStatus: "" (não respondido) | "no" | "sedated" | "intubated_no_sedation"
  const [sedationStatus, setSedationStatus] = useState<"" | "no" | "sedated" | "intubated_no_sedation">("");
  const [gcsO, setGcsO] = useState<string>("");
  const [gcsV, setGcsV] = useState<string>("");
  const [gcsM, setGcsM] = useState<string>("");
  const [rassScore, setRassScore] = useState<string>("");
  const [consciousnessReason, setConsciousnessReason] = useState<string>("");
  const [gcsPreSedation, setGcsPreSedation] = useState<string>("");

  // Derived GCS total ("8T" if intubated_no_sedation, numeric otherwise, "" if RASS)
  const gcsTotal = useMemo(() => {
    if (sedationStatus === "sedated") return "";
    const o = parseInt(gcsO) || 0;
    const m = parseInt(gcsM) || 0;
    if (sedationStatus === "intubated_no_sedation") {
      const sum = o + 1 + m;
      return o && m ? `${sum}T` : "";
    }
    const v = parseInt(gcsV) || 0;
    return o && v && m ? String(o + v + m) : "";
  }, [sedationStatus, gcsO, gcsV, gcsM]);
  const gcs = gcsTotal; // legacy var name kept for downstream use

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

  const [box1Open, setBox1Open] = useState(true);
  const [box2Open, setBox2Open] = useState(true);
  const [box3Open, setBox3Open] = useState(true);

  // ─── Calculated Scores ───
  const scores = useMemo(() => {
    const ageN = age ? parseInt(age) : null;
    const losN = losBeforeIcu ? parseInt(losBeforeIcu) : null;
    // Numeric GCS for SAPS pontuação:
    //  - sedoanalgesia → usa GCS pré-sedação se informado, senão 15 (sem penalidade)
    //  - GCS-T (intubado sem sedação) → usa o numérico (parte antes do "T")
    //  - GCS normal → usa direto
    let gcsN: number | null = null;
    if (sedationStatus === "sedated") {
      gcsN = gcsPreSedation ? parseInt(gcsPreSedation) : 15;
    } else if (gcs) {
      gcsN = parseInt(gcs); // parseInt ignora sufixo "T"
    }
    const hrN = hrHighest ? parseInt(hrHighest) : null;
    const sbpN = sbpLowest ? parseInt(sbpLowest) : null;
    const bilN = bilirubinHighest ? parseFloat(bilirubinHighest) : null;
    const tempN = tempLowest ? parseFloat(tempLowest) : null;
    const crN = creatinineHighest ? parseFloat(creatinineHighest) : null;
    const leukN = leukocytes ? parseFloat(leukocytes) : null;
    const phN = phLowest ? parseFloat(phLowest) : null;
    const pltN = plateletsLowest ? parseInt(plateletsLowest) : null;
    const oxyN = pao2Fio2 ? parseFloat(pao2Fio2) : null;

    const box1 = 16 +
      calculateAgeScore(ageN) + calculateComorbidityScore(comorbidities) +
      calculateLosBeforeIcuScore(losN) + calculateAdmissionSourceScore(admissionSource) +
      calculatePlannedScore(plannedAdmission);

    const box2 = calculateAdmissionReasonScore(admissionReason) +
      calculateSurgicalStatusScore(surgicalStatus) + calculateInfectionScore(infectionAtAdmission);

    const box3 = calculateGcsScore(gcsN) + calculateHrScore(hrN) + calculateSbpScore(sbpN) +
      calculateBilirubinScore(bilN) + calculateTempScore(tempN) + calculateCreatinineScore(crN) +
      calculateLeukocytesScore(leukN) + calculatePhScore(phN) + calculatePlateletsScore(pltN) +
      calculateOxygenationScore(oxyN, isVentilated);

    const total = box1 + box2 + box3;
    return { box1, box2, box3, total, mortality: predictMortality(total) };
  }, [age, comorbidities, losBeforeIcu, admissionSource, plannedAdmission, admissionReason,
    surgicalStatus, infectionAtAdmission, gcs, sedationStatus, gcsPreSedation,
    hrHighest, sbpLowest, bilirubinHighest,
    tempLowest, creatinineHighest, leukocytes, phLowest, plateletsLowest, pao2Fio2, isVentilated]);

  // ─── Available beds for selected sector ───
  const availableBeds = useMemo(() => {
    const sector = UTI_SECTORS.find(s => s.value === selectedSector);
    if (!sector) return [];
    const beds: { value: string; label: string; occupied: boolean }[] = [];
    for (let i = sector.start; i < sector.start + sector.max; i++) {
      const bedNum = `${sector.prefix}${String(i).padStart(2, "0")}`;
      beds.push({ value: bedNum, label: bedNum, occupied: occupiedBeds.includes(bedNum) });
    }
    return beds;
  }, [selectedSector, occupiedBeds]);

  // ─── Data Loading ───
  const loadPendingRequests = async () => {
    if (!hospitalId || !stateId) return;
    const { data } = await supabase
      .from("pre_admissions")
      .select("id, patient_name, birth_date, sex, destination_sector, notes, created_at, medical_record")
      .eq("hospital_unit_id", hospitalId)
      .eq("state_id", stateId)
      .eq("status", "aguardando_leito_uti")
      .order("created_at", { ascending: true });
    if (data) setPendingRequests(data);
  };

  const loadRecords = async () => {
    if (!hospitalId || !stateId) return;
    const { data } = await supabase
      .from("saps3_assessments" as any)
      .select("id, patient_name, total_score, predicted_mortality, created_at, status, pending_since")
      .eq("hospital_unit_id", hospitalId)
      .eq("state_id", stateId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setRecords(data as any);
  };

  const loadOccupiedBeds = async () => {
    if (!hospitalId || !stateId || !selectedSector) { setOccupiedBeds([]); return; }
    const { data } = await supabase
      .from("patients")
      .select("bed_number")
      .eq("hospital_unit_id", hospitalId)
      .eq("state_id", stateId)
      .eq("sector", selectedSector)
      .eq("is_vacant", false);
    if (data) setOccupiedBeds(data.map(p => p.bed_number));
  };

  useEffect(() => {
    loadPendingRequests();
    loadRecords();
  }, [hospitalId, stateId]);

  useEffect(() => { loadOccupiedBeds(); }, [hospitalId, stateId, selectedSector]);

  // ─── Pre-fill from allocation navigation / URL ───
  useEffect(() => {
    const state = location.state as any;
    const completeSapsIdParam = state?.completeSapsId || searchParams.get("completeSapsId");
    const fromAllocation = Boolean(state?.fromAllocation || searchParams.get("fromAllocation") === "true");
    const patientNameFromContext = state?.patientName || searchParams.get("patientName");

    // Não dispara se não há contexto algum
    if (!completeSapsIdParam && !fromAllocation && !patientNameFromContext) return;

    const patientAgeFromContext = state?.patientAge || searchParams.get("patientAge");
    const destinationSectorFromContext = state?.destinationSector || searchParams.get("destinationSector");
    const preAdmissionId = state?.preAdmissionId || searchParams.get("preAdmissionId");
    const allocationRequestId = state?.allocationRequestId || searchParams.get("allocationRequestId");
    const patientIdParam = state?.patientId || searchParams.get("patientId");
    const patientBedParam = state?.patientBed || searchParams.get("patientBed") || searchParams.get("selectedBed");
    const patientSectorParam = state?.patientSector || searchParams.get("patientSector") || searchParams.get("selectedSector");

    // Caminho A — Completar SAPS pendente de paciente JÁ ADMITIDO.
    // Carrega o registro SAPS existente e hidrata o formulário; não passa pelo fluxo de alocação.
    if (completeSapsIdParam) {
      setCompletingSapsId(completeSapsIdParam);
      setCompletingPatientId(patientIdParam || null);

      (async () => {
        const { data: sapsRow, error } = await supabase
          .from("saps3_assessments" as any)
          .select("*")
          .eq("id", completeSapsIdParam)
          .maybeSingle();

        if (error || !sapsRow) {
          toast.error("Não foi possível carregar a ficha SAPS pendente.");
          return;
        }

        const r: any = sapsRow;
        const namePref = patientNameFromContext || r.patient_name || "";
        setSelectedRequest({
          id: completeSapsIdParam,
          patient_name: namePref,
          birth_date: null,
          sex: null,
          destination_sector: destinationSectorFromContext || patientSectorParam || null,
          notes: null,
          created_at: r.created_at || new Date().toISOString(),
          medical_record: null,
          patient_id: patientIdParam || null,
          allocation_request_id: null,
        });

        setPatientName(namePref);
        setAge(r.age != null ? String(r.age) : (patientAgeFromContext ? String(patientAgeFromContext).replace(/\D/g, "") : ""));
        setComorbidities(Array.isArray(r.comorbidities) ? r.comorbidities : []);
        setLosBeforeIcu(r.hospital_los_before_icu != null ? String(r.hospital_los_before_icu) : "");
        setAdmissionSource(r.icu_admission_source || "");
        setPlannedAdmission(!!r.planned_admission);
        setAdmissionReason(r.admission_reason || "");
        setAdmissionReasonDetail(r.admission_reason_detail || "");
        setSurgicalStatus(r.surgical_status || "");
        setSurgeryType(r.surgery_type || "");
        setInfectionAtAdmission(r.infection_at_admission || "");

        // Hidrata avaliação de consciência a partir de escala_consciencia se disponível
        const ec = r.escala_consciencia || {};
        if (ec?.tipo === "RASS") {
          setSedationStatus("sedated");
          setRassScore(ec.rass_score != null ? String(ec.rass_score) : "");
          setConsciousnessReason(ec.motivo || "");
          setGcsPreSedation(ec.gcs_pre_sedacao != null ? String(ec.gcs_pre_sedacao) : "");
        } else if (ec?.tipo === "GCS-T") {
          setSedationStatus("intubated_no_sedation");
          setGcsO(ec.glasgow_parciais?.O != null ? String(ec.glasgow_parciais.O) : "");
          setGcsM(ec.glasgow_parciais?.M != null ? String(ec.glasgow_parciais.M) : "");
        } else if (ec?.tipo === "GCS") {
          setSedationStatus("no");
          setGcsO(ec.glasgow_parciais?.O != null ? String(ec.glasgow_parciais.O) : "");
          setGcsV(ec.glasgow_parciais?.V != null ? String(ec.glasgow_parciais.V) : "");
          setGcsM(ec.glasgow_parciais?.M != null ? String(ec.glasgow_parciais.M) : "");
        }

        setHrHighest(r.heart_rate_highest != null ? String(r.heart_rate_highest) : "");
        setSbpLowest(r.systolic_bp_lowest != null ? String(r.systolic_bp_lowest) : "");
        setBilirubinHighest(r.bilirubin_highest != null ? String(r.bilirubin_highest) : "");
        setTempLowest(r.temperature_lowest != null ? String(r.temperature_lowest) : "");
        setCreatinineHighest(r.creatinine_highest != null ? String(r.creatinine_highest) : "");
        setLeukocytes(r.leukocytes != null ? String(r.leukocytes) : "");
        setPhLowest(r.ph_lowest != null ? String(r.ph_lowest) : "");
        setPlateletsLowest(r.platelets_lowest != null ? String(r.platelets_lowest) : "");
        setPao2Fio2(r.oxygenation_pao2_fio2 != null ? String(r.oxygenation_pao2_fio2) : "");
        setIsVentilated(!!r.is_mechanically_ventilated);

        setSelectedSector(resolveSectorFromContext(patientSectorParam, currentSectorCode || currentDepartment));
        setSelectedBed(patientBedParam || "");
        setBox1Open(true); setBox2Open(true); setBox3Open(true);
        toast.info(`Complete a ficha SAPS 3 de ${namePref}`);
      })();
      return;
    }

    // Caminho B — Fluxo de alocação tradicional (admissão nova vinda de pré-admissão/leito)
    if (!fromAllocation || !patientNameFromContext) return;

    setCompletingSapsId(null);
    setCompletingPatientId(null);
    setSelectedRequest({
      id: preAdmissionId || allocationRequestId || patientIdParam || patientNameFromContext,
      patient_name: patientNameFromContext,
      birth_date: null,
      sex: null,
      destination_sector: destinationSectorFromContext,
      notes: null,
      created_at: new Date().toISOString(),
      medical_record: null,
      patient_id: patientIdParam,
      allocation_request_id: allocationRequestId,
    });

    setPatientName(patientNameFromContext);
    if (patientAgeFromContext) {
      const ageStr = String(patientAgeFromContext).replace(/\D/g, "");
      if (ageStr) setAge(ageStr);
    }

    const sectorFromUrl = state?.selectedSector || searchParams.get("selectedSector");
    const bedFromUrl = state?.selectedBed || searchParams.get("selectedBed");
    setSelectedSector(sectorFromUrl || resolveSectorFromContext(destinationSectorFromContext, currentSectorCode || currentDepartment));
    setSelectedBed(bedFromUrl || "");
    setComorbidities([]); setLosBeforeIcu(""); setAdmissionSource(""); setPlannedAdmission(false);
    setAdmissionReason(""); setAdmissionReasonDetail(""); setSurgicalStatus(""); setSurgeryType("");
    setInfectionAtAdmission(""); setSedationStatus(""); setGcsO(""); setGcsV(""); setGcsM(""); setRassScore(""); setConsciousnessReason(""); setGcsPreSedation(""); setHrHighest(""); setSbpLowest(""); setBilirubinHighest("");
    setTempLowest(""); setCreatinineHighest(""); setLeukocytes(""); setPhLowest(""); setPlateletsLowest("");
    setPao2Fio2(""); setIsVentilated(false);
    setBox1Open(true); setBox2Open(true); setBox3Open(true);
    toast.info(`Preencha o SAPS 3 para ${patientNameFromContext}`);
  }, [location.state, searchParams, currentDepartment, currentSectorCode]);

  // ─── Start admission from pending request ───
  const startAdmission = (req: PendingRequest) => {
    setSelectedRequest(req);
    setPatientName(req.patient_name);
    // Calculate age from birth_date
    if (req.birth_date) {
      const birth = new Date(req.birth_date + "T12:00:00");
      const ageYears = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      setAge(String(ageYears));
    }
    // Pre-select sector based on destination (supports UTI/UCI/UCC labels)
    setSelectedSector(resolveSectorFromContext(req.destination_sector, currentSectorCode || currentDepartment));
    // Reset rest
    setSelectedBed("");
    setComorbidities([]); setLosBeforeIcu(""); setAdmissionSource(""); setPlannedAdmission(false);
    setAdmissionReason(""); setAdmissionReasonDetail(""); setSurgicalStatus(""); setSurgeryType("");
    setInfectionAtAdmission(""); setSedationStatus(""); setGcsO(""); setGcsV(""); setGcsM(""); setRassScore(""); setConsciousnessReason(""); setGcsPreSedation(""); setHrHighest(""); setSbpLowest(""); setBilirubinHighest("");
    setTempLowest(""); setCreatinineHighest(""); setLeukocytes(""); setPhLowest(""); setPlateletsLowest("");
    setPao2Fio2(""); setIsVentilated(false);
    setBox1Open(true); setBox2Open(true); setBox3Open(true);
  };

  // ─── Build escala_consciencia (estrutura obrigatória) ───
  const buildEscalaConsciencia = () => {
    if (sedationStatus === "no") {
      const O = parseInt(gcsO) || null;
      const V = parseInt(gcsV) || null;
      const M = parseInt(gcsM) || null;
      const total = O && V && M ? O + V + M : null;
      return {
        tipo: "GCS" as const,
        glasgow_score: total,
        glasgow_parciais: O && V && M ? { O, V, M } : null,
        rass_score: null,
        glasgow_nao_aplicavel: false,
        motivo: null,
        gcs_pre_sedacao: null,
      };
    }
    if (sedationStatus === "intubated_no_sedation") {
      const O = parseInt(gcsO) || null;
      const M = parseInt(gcsM) || null;
      const total = O && M ? O + 1 + M : null;
      return {
        tipo: "GCS-T" as const,
        glasgow_score: total,
        glasgow_parciais: O && M ? { O, V: 1, M } : null,
        rass_score: null,
        glasgow_nao_aplicavel: false,
        motivo: "Via aérea artificial — Verbal = 1T",
        gcs_pre_sedacao: null,
      };
    }
    if (sedationStatus === "sedated") {
      return {
        tipo: "RASS" as const,
        glasgow_score: null,
        glasgow_parciais: null,
        rass_score: rassScore !== "" ? parseInt(rassScore) : null,
        glasgow_nao_aplicavel: true,
        motivo: consciousnessReason || "Não aplicável – Sedoanalgesia contínua",
        gcs_pre_sedacao: gcsPreSedation ? parseInt(gcsPreSedation) : null,
      };
    }
    return null;
  };

  // ─── Build SAPS payload ───
  const buildSapsPayload = (statusVal: 'completed' | 'pending') => ({
    patient_name: patientName,
    hospital_unit_id: hospitalId,
    state_id: stateId,
    created_by: user?.id,
    age: age ? parseInt(age) : null,
    comorbidities,
    hospital_los_before_icu: losBeforeIcu ? parseInt(losBeforeIcu) : null,
    icu_admission_source: admissionSource || null,
    planned_admission: plannedAdmission,
    admission_reason: admissionReason || null,
    admission_reason_detail: admissionReasonDetail || null,
    surgical_status: surgicalStatus || null,
    surgery_type: surgeryType || null,
    infection_at_admission: infectionAtAdmission || null,
    gcs_score: gcs ? parseInt(gcs) : (sedationStatus === "sedated" && gcsPreSedation ? parseInt(gcsPreSedation) : null),
    escala_consciencia: buildEscalaConsciencia(),
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
    status: statusVal,
    pending_since: statusVal === 'pending' ? new Date().toISOString() : null,
  });

  // ─── Save: SAPS3 + finalize allocation/admission ───
  const handleSave = async (asPending = false) => {
    if (!patientName.trim()) { toast.error("Nome do paciente é obrigatório"); return; }
    // No fluxo "completar SAPS pendente" o paciente já está no leito — não exigimos seleção de setor/leito.
    if (!completingSapsId) {
      if (!selectedSector) { toast.error("Selecione o setor da UTI"); return; }
      if (!selectedBed) { toast.error("Selecione o leito"); return; }
    }
    if (!hospitalId || !stateId) { toast.error("Hospital/Estado não selecionado"); return; }
    if (!asPending) {
      if (!sedationStatus) { toast.error("Responda a avaliação de consciência (sedoanalgesia/VM)"); return; }
      if (sedationStatus === "no" && (!gcsO || !gcsV || !gcsM)) { toast.error("Preencha O, V e M do Glasgow"); return; }
      if (sedationStatus === "intubated_no_sedation" && (!gcsO || !gcsM)) { toast.error("Preencha Ocular e Motor do Glasgow (Verbal = 1T)"); return; }
      if (sedationStatus === "sedated" && rassScore === "") { toast.error("Selecione a pontuação RASS (-5 a +4)"); return; }
    }

    // ─── Caminho "Completar SAPS pendente" — apenas atualiza a ficha existente ───
    if (completingSapsId) {
      setSaving(true);
      try {
        const sapsPayload = buildSapsPayload(asPending ? 'pending' : 'completed');
        // Em update preservamos created_at original
        delete (sapsPayload as any).created_by;
        const { error: updErr } = await supabase
          .from("saps3_assessments" as any)
          .update(sapsPayload as any)
          .eq("id", completingSapsId);
        if (updErr) throw updErr;

        if (!asPending && completingPatientId) {
          await supabase
            .from("patients")
            .update({
              saps_pending: false,
              saps_completed_at: new Date().toISOString(),
            } as any)
            .eq("id", completingPatientId);
        }

        const sectorLabel = UTI_SECTORS.find(s => s.value === selectedSector)?.label || selectedSector || "—";

        if (asPending) {
          // Manter pendente: NÃO mostra animação de validação. Apenas atualiza e volta para a lista.
          setSelectedRequest(null);
          setCompletingSapsId(null);
          setCompletingPatientId(null);
          loadRecords();
          toast.success("Ficha SAPS 3 mantida como pendente. Cronômetro segue ativo até a validação.");
          // Redireciona de volta para o painel clínico do paciente preservando contexto
          if (completingPatientId) {
            navigate(`/paciente?patientId=${completingPatientId}`);
          }
          return;
        }

        setConfirmationData({
          patientName,
          bedNumber: selectedBed || "—",
          sectorLabel,
          totalScore: scores.total,
          predictedMortality: scores.mortality,
          patientId: completingPatientId,
          sectorCode: selectedSector,
          age: age ? `${age} anos` : null,
          mode: "validation",
        });
        setSelectedRequest(null);
        setCompletingSapsId(null);
        setCompletingPatientId(null);
        loadRecords();
        toast.success("Ficha SAPS 3 validada com sucesso.");
      } catch (err: any) {
        toast.error("Erro ao salvar: " + err.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    let createdSapsId: string | null = null;
    try {
      const sapsPayload = buildSapsPayload(asPending ? 'pending' : 'completed');
      const { data: sapsRecord, error: sapsError } = await supabase
        .from("saps3_assessments" as any)
        .insert(sapsPayload as any)
        .select("id")
        .single();
      if (sapsError) throw sapsError;
      createdSapsId = (sapsRecord as any)?.id || null;

      const sectorMeta = UTI_SECTORS.find((sector) => sector.value === selectedSector);
      const destinationSectorLabel = sectorMeta?.label || selectedSector;
      const destinationDepartment = sectorMeta?.department || "UTI";

      // Carrega dados clínicos da pré-admissão (queixa/alergias) quando aplicável
      let diagnoses: string | null = null;
      let medicalHistory: string | null = null;
      if (selectedRequest?.id && !selectedRequest.allocation_request_id) {
        const { data: preAdmissionData } = await supabase
          .from("pre_admissions")
          .select("chief_complaint, allergies")
          .eq("id", selectedRequest.id)
          .maybeSingle();
        diagnoses = preAdmissionData?.chief_complaint || null;
        medicalHistory = preAdmissionData?.allergies ? `Alergias: ${preAdmissionData.allergies}` : null;
      }

      // Modelo de leitos fixos: o leito alvo já existe como linha "vaga" em patients.
      // Buscamos por setor+leito e normalizamos o department canônico no UPDATE.
      const { data: bedRows, error: bedLookupError } = await supabase
        .from("patients")
        .select("id, department, is_vacant, name")
        .eq("hospital_unit_id", hospitalId)
        .eq("state_id", stateId)
        .eq("sector", selectedSector)
        .eq("bed_number", selectedBed);

      if (bedLookupError) throw bedLookupError;

      const existingBedRow = bedRows?.find((row) => row.department === destinationDepartment) ||
        bedRows?.find((row) => row.is_vacant !== false) ||
        bedRows?.[0] ||
        null;

      if (existingBedRow && existingBedRow.is_vacant === false) {
        throw new Error(`Leito ${selectedBed} já está ocupado. Atualize o mapa e selecione outro leito.`);
      }

      const patientPayload: Record<string, any> = {
        name: patientName,
        bed_number: selectedBed,
        sector: selectedSector,
        department: destinationDepartment,
        age: age ? `${age} anos` : null,
        hospital_unit_id: hospitalId,
        state_id: stateId,
        created_by: user?.id,
        admission_date: new Date().toISOString(),
        uti_admission_date: new Date().toISOString(),
        clinical_status: "grave",
        is_vacant: false,
        is_door_patient: false,
        allocation_status: "approved",
        diagnoses,
        medical_history: medicalHistory,
        // Fluxo Pré-admissão → Admissão Hospitalar:
        // SAPS3 finalizado aloca o paciente no leito UTI/UCI mas a admissão clínica
        // (HDA, exame físico, plano) ainda é feita pelo Painel Clínico.
        admission_status: 'pre_admitido',
        admitted_at: null,
      };

      let admittedPatientId: string | null = null;
      if (existingBedRow?.id) {
        const { error: updateBedError } = await supabase
          .from("patients")
          .update(patientPayload)
          .eq("id", existingBedRow.id);
        if (updateBedError) throw updateBedError;
        admittedPatientId = existingBedRow.id;
      } else {
        const { data: insertedRow, error: insertBedError } = await supabase
          .from("patients")
          .insert(patientPayload as any)
          .select("id")
          .single();
        if (insertBedError) throw insertBedError;
        admittedPatientId = (insertedRow as any)?.id ?? null;
      }

      // Origem 1: solicitação de leito (door patient) → marca aprovada e remove a linha "porta"
      if (selectedRequest?.allocation_request_id) {
        await supabase
          .from("bed_allocation_requests")
          .update({
            status: "approved",
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", selectedRequest.allocation_request_id);

        if (selectedRequest.patient_id && selectedRequest.patient_id !== existingBedRow?.id) {
          await supabase.from("patients").delete().eq("id", selectedRequest.patient_id);
        }
      }

      // Origem 2: pré-admissão → marca como admitida
      if (selectedRequest?.id && !selectedRequest.allocation_request_id) {
        const { error: updatePreAdmissionError } = await supabase
          .from("pre_admissions")
          .update({
            status: "admitido",
            destination_bed: selectedBed,
            destination_sector: destinationSectorLabel,
          })
          .eq("id", selectedRequest.id);
        if (updatePreAdmissionError) throw updatePreAdmissionError;
      }

      // Caso paciente já admitido com SAPS pendente: libera o gate clínico
      if (!asPending) {
        const targetPatientId =
          admittedPatientId ||
          (selectedRequest as any)?.patient_id ||
          searchParams.get("patientId");
        if (targetPatientId) {
          await supabase
            .from("patients")
            .update({
              saps_pending: false,
              saps_completed_at: new Date().toISOString(),
            } as any)
            .eq("id", targetPatientId);
        }
      }

      if (asPending) {
        toast.success(`Paciente pré-admitido no leito ${selectedBed}. SAPS 3 ficou como pendente — aguardando resultados laboratoriais.`);
      }

      const sectorLabel = UTI_SECTORS.find(s => s.value === selectedSector)?.label || selectedSector;
      setConfirmationData({
        patientName,
        bedNumber: selectedBed,
        sectorLabel,
        totalScore: asPending ? 0 : scores.total,
        predictedMortality: asPending ? 0 : scores.mortality,
        patientId: admittedPatientId,
        sectorCode: selectedSector,
        age: age ? `${age} anos` : null,
      });
      setSelectedRequest(null);
      loadPendingRequests();
      loadRecords();
      loadOccupiedBeds();
    } catch (err: any) {
      if (createdSapsId) {
        await supabase.from("saps3_assessments" as any).delete().eq("id", createdSapsId);
      }
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("saps3_assessments" as any).delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Registro excluído"); loadRecords(); }
    setDeleteId(null);
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

  const isFormMode = !!selectedRequest;

  const currentSectorLabel = UTI_SECTORS.find(s => s.value === selectedSector)?.label;
  const headerSectorLabel = currentSectorLabel || selectedRequest?.destination_sector || "UTI";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-8 lg:px-10 py-6 space-y-6">
      {confirmationData && (
        <SapsConfirmationScreen
          patientName={confirmationData.patientName}
          bedNumber={confirmationData.bedNumber}
          sectorLabel={confirmationData.sectorLabel}
          totalScore={confirmationData.totalScore}
          predictedMortality={confirmationData.predictedMortality}
          patientId={confirmationData.patientId}
          sectorCode={confirmationData.sectorCode}
          age={confirmationData.age}
          mode={confirmationData.mode}
          onComplete={() => setConfirmationData(null)}
        />
      )}
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Admissão {headerSectorLabel} — SAPS 3
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fluxo admissional: Solicitação → Avaliação médica → Alocação de leito + SAPS 3
        </p>
      </div>

      {/* ─── Step 1: Pending UTI Bed Requests ─── */}
      {!isFormMode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Solicitações de Leito UTI Pendentes
                {pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{pendingRequests.length}</Badge>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma solicitação de leito UTI pendente.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="patient-id font-semibold text-foreground truncate">{req.patient_name}</p>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {req.destination_sector}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {req.birth_date && (
                          <span>Nasc: {new Date(req.birth_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                        )}
                        {req.sex && <span>Sexo: {req.sex === "M" ? "Masc" : "Fem"}</span>}
                        {req.medical_record && <span>Prontuário: {req.medical_record}</span>}
                        <span>Solicitado: {format(new Date(req.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                      </div>
                      {req.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">Obs: {req.notes}</p>
                      )}
                    </div>
                    <Button size="sm" onClick={() => startAdmission(req)} className="gap-1.5 ml-3 shrink-0">
                      <UserCheck className="h-4 w-4" /> Pré-admitir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Step 2: Admission Form (Bed Selection + SAPS 3) ─── */}
      {isFormMode && (
        <div className="space-y-4">
          {/* Patient info banner */}
          <Card className={completingSapsId ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-900/15" : "border-primary/30 bg-primary/5"}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {completingSapsId ? "Validando ficha SAPS — paciente já alocado" : "Admitindo paciente"}
                  </p>
                  <p className="patient-id text-lg font-bold text-foreground">{patientName}</p>
                  {completingSapsId ? (
                    <p className="text-xs text-muted-foreground">
                      Leito {selectedBed || "—"} · {currentSectorLabel || "Setor —"} · aguardando validação dos exames
                    </p>
                  ) : (
                    selectedRequest?.destination_sector && (
                      <p className="text-xs text-muted-foreground">
                        Pedido: {selectedRequest.destination_sector}
                      </p>
                    )
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedRequest(null)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bed Selection / Allocation Confirmation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bed className="h-5 w-5 text-primary" />
                {completingSapsId ? "Leito já alocado" : "Alocação de Leito"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {completingSapsId
                  ? "Paciente já está no leito. Esta seção é apenas informativa — a validação atualizará a ficha SAPS sem mover o paciente."
                  : "Setor pré-configurado pela origem do pedido. Selecione apenas o leito de destino."}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Setor (auto)</Label>
                  <div className="mt-1.5 flex items-center justify-between gap-2 h-10 px-3 rounded-md border border-dashed border-primary/40 bg-primary/5">
                    <span className="text-sm font-semibold text-foreground">
                      {currentSectorLabel || "—"}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {completingSapsId ? "Atual" : "Sincronizado"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>{completingSapsId ? "Leito atual" : "Leito de destino"}</Label>
                  {completingSapsId ? (
                    <div className="mt-1.5 flex items-center justify-between gap-2 h-10 px-3 rounded-md border border-dashed border-emerald-400/60 bg-emerald-50 dark:bg-emerald-900/20">
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        {selectedBed || "—"}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase border-emerald-300 text-emerald-700 dark:text-emerald-300">Ocupado</Badge>
                    </div>
                  ) : (
                    <Select value={selectedBed} onValueChange={setSelectedBed} disabled={!selectedSector}>
                      <SelectTrigger><SelectValue placeholder={selectedSector ? "Selecione o leito" : "Setor não definido"} /></SelectTrigger>
                      <SelectContent>
                        {availableBeds.map(b => (
                          <SelectItem key={b.value} value={b.value} disabled={b.occupied}>
                            {b.label} {b.occupied ? " (ocupado)" : " ✓ livre"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              {selectedBed && !completingSapsId && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <Bed className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Leito selecionado: {selectedBed} — {currentSectorLabel}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score Panel */}
          <Card className="border-primary/20">
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
                  <p className="text-xs text-muted-foreground">Predita</p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label>Idade (anos)</Label>
                      <Input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Ex: 65" min={0} max={120} />
                    </div>
                    <div>
                      <Label>Dias no hospital antes da UTI</Label>
                      <Input type="number" value={losBeforeIcu} onChange={e => setLosBeforeIcu(e.target.value)} placeholder="0" min={0} />
                    </div>
                    <div>
                      <Label>Origem da admissão</Label>
                      <Select value={admissionSource} onValueChange={setAdmissionSource}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="emergency">Pronto-Socorro</SelectItem>
                          <SelectItem value="same_hospital_floor">Enfermaria</SelectItem>
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
                              setComorbidities(prev => checked ? [...prev, c.id] : prev.filter(x => x !== c.id));
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
                          <SelectItem value="digestive">Digestiva/GI</SelectItem>
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
                  {/* ── Avaliação de consciência guiada (GCS / GCS-T / RASS) ── */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
                    <div className="flex items-start gap-2">
                      <Brain className="h-4 w-4 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">Avaliação de consciência</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          O paciente está sob sedoanalgesia contínua e/ou ventilação mecânica?
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([
                        { v: "no", label: "Não", hint: "Aplicar GCS completo" },
                        { v: "sedated", label: "Sim — sedoanalgesia ± VM", hint: "Aplicar RASS" },
                        { v: "intubated_no_sedation", label: "Intubado sem sedação", hint: "GCS com V = 1T" },
                      ] as const).map(opt => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setSedationStatus(opt.v)}
                          className={`text-left p-3 rounded-md border transition-all ${
                            sedationStatus === opt.v
                              ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                              : "border-border bg-card hover:bg-muted/50"
                          }`}
                        >
                          <p className="text-sm font-medium text-foreground">{opt.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{opt.hint}</p>
                        </button>
                      ))}
                    </div>

                    {/* Caminho 1: GCS completo */}
                    {sedationStatus === "no" && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2 border-t border-primary/20">
                        <div>
                          <Label className="text-xs">Ocular (1-4)</Label>
                          <Input type="number" value={gcsO} onChange={e => setGcsO(e.target.value)} min={1} max={4} placeholder="O" />
                        </div>
                        <div>
                          <Label className="text-xs">Verbal (1-5)</Label>
                          <Input type="number" value={gcsV} onChange={e => setGcsV(e.target.value)} min={1} max={5} placeholder="V" />
                        </div>
                        <div>
                          <Label className="text-xs">Motor (1-6)</Label>
                          <Input type="number" value={gcsM} onChange={e => setGcsM(e.target.value)} min={1} max={6} placeholder="M" />
                        </div>
                        <div>
                          <Label className="text-xs">GCS total</Label>
                          <div className="h-10 px-3 rounded-md border bg-background flex items-center justify-center text-lg font-bold text-primary">
                            {gcsTotal || "—"}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Caminho 2: Sedoanalgesia → RASS */}
                    {sedationStatus === "sedated" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-primary/20">
                        <div>
                          <Label className="text-xs">RASS (-5 a +4)</Label>
                          <Select value={rassScore} onValueChange={setRassScore}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {[-5,-4,-3,-2,-1,0,1,2,3,4].map(n => (
                                <SelectItem key={n} value={String(n)}>
                                  {n >= 0 ? `+${n}` : n} — {RASS_LABELS[n]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">GCS pré-sedação (opcional)</Label>
                          <Input type="number" value={gcsPreSedation} onChange={e => setGcsPreSedation(e.target.value)} min={3} max={15} placeholder="3-15" />
                        </div>
                        <div className="sm:col-span-1">
                          <Label className="text-xs">Motivo</Label>
                          <Input value={consciousnessReason} onChange={e => setConsciousnessReason(e.target.value)} placeholder="Não aplicável – Sedoanalgesia contínua" />
                        </div>
                        <p className="sm:col-span-3 text-[11px] text-muted-foreground">
                          GCS não será aplicado. Pontuação SAPS usa o GCS pré-sedação se informado; caso contrário assume 15.
                        </p>
                      </div>
                    )}

                    {/* Caminho 3: Intubado sem sedação → GCS-T */}
                    {sedationStatus === "intubated_no_sedation" && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2 border-t border-primary/20">
                        <div>
                          <Label className="text-xs">Ocular (1-4)</Label>
                          <Input type="number" value={gcsO} onChange={e => setGcsO(e.target.value)} min={1} max={4} placeholder="O" />
                        </div>
                        <div>
                          <Label className="text-xs">Verbal</Label>
                          <div className="h-10 px-3 rounded-md border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-sm font-bold text-amber-700 dark:text-amber-300">
                            1T
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Motor (1-6)</Label>
                          <Input type="number" value={gcsM} onChange={e => setGcsM(e.target.value)} min={1} max={6} placeholder="M" />
                        </div>
                        <div>
                          <Label className="text-xs">GCS total</Label>
                          <div className="h-10 px-3 rounded-md border bg-background flex items-center justify-center text-lg font-bold text-primary">
                            {gcsTotal || "—"}
                          </div>
                        </div>
                        <p className="col-span-3 sm:col-span-4 text-[11px] text-muted-foreground">
                          Verbal travado em 1T (via aérea artificial). Score exibido com sufixo T.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div>
                      <Label className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> FC mais alta (bpm)</Label>
                      <Input type="number" value={hrHighest} onChange={e => setHrHighest(e.target.value)} placeholder="Ex: 110" />
                    </div>
                    <div>
                      <Label>PAS mais baixa (mmHg)</Label>
                      <Input type="number" value={sbpLowest} onChange={e => setSbpLowest(e.target.value)} placeholder="Ex: 90" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1"><Thermometer className="h-3.5 w-3.5" /> Temp. mais baixa (°C)</Label>
                      <Input type="number" step="0.1" value={tempLowest} onChange={e => setTempLowest(e.target.value)} placeholder="Ex: 36.2" />
                    </div>
                    <div>
                      <Label>Bilirrubina (mg/dL)</Label>
                      <Input type="number" step="0.1" value={bilirubinHighest} onChange={e => setBilirubinHighest(e.target.value)} placeholder="Ex: 1.2" />
                    </div>
                    <div>
                      <Label>Creatinina (mg/dL)</Label>
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
                      <Label>Plaquetas (x10³)</Label>
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

          {/* Save */}
          <div className="flex gap-3 justify-end flex-wrap">
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Cancelar</Button>
            <Button
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={saving || (!completingSapsId && !selectedBed)}
              className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20"
            >
              <Clock className="h-4 w-4" />
              {saving
                ? (completingSapsId ? "Salvando..." : "Pré-admitindo...")
                : (completingSapsId ? "Manter como pendente" : "Pré-admitir com SAPS pendente")}
            </Button>
            <Button onClick={() => handleSave(false)} disabled={saving || (!completingSapsId && !selectedBed)} className="gap-2">
              <Save className="h-4 w-4" />
              {saving
                ? (completingSapsId ? "Validando..." : "Pré-admitindo...")
                : (completingSapsId ? "Validar ficha SAPS" : `Pré-admitir no ${selectedBed || "leito"}`)}
            </Button>
          </div>
          <div className={`${completingSapsId ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"} border rounded-lg p-3 text-sm`}>
            <p className="font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              {completingSapsId ? "Validação atualiza a ficha e libera o gate clínico" : "Exames laboratoriais ainda pendentes?"}
            </p>
            <p className={`text-xs mt-1 ${completingSapsId ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
              {completingSapsId
                ? "Ao validar, o cálculo SAPS 3 é recalculado com os valores atuais, a flag de pendência é removida do paciente e você é redirecionado para o painel clínico do leito correspondente para seguir com HDA, exame físico e plano."
                : "Utilize \"Pré-admitir com SAPS pendente\" para alocar o paciente no leito agora e completar a ficha SAPS 3 quando os resultados de gasometria, hemograma, função renal e demais exames admissionais estiverem disponíveis. Um cronômetro será ativado para rastrear o tempo de pendência."}
            </p>
          </div>
        </div>
      )}

      {/* ─── Pending SAPS ─── */}
      {!isFormMode && records.some(r => r.status === 'pending') && (
        <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300">
              <Clock className="h-5 w-5 animate-pulse" />
              SAPS 3 Pendentes — Aguardando Exames Laboratoriais
              <Badge variant="destructive" className="ml-1">
                {records.filter(r => r.status === 'pending').length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {records.filter(r => r.status === 'pending').map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{r.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Admitido: {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <SapsPendingTimer pendingSince={r.pending_since} />
                    <Button 
                      size="sm" 
                      className="gap-1.5"
                      onClick={() => navigate(`/saps3?completeSapsId=${r.id}&patientName=${encodeURIComponent(r.patient_name)}`)}
                    >
                      <ClipboardList className="h-3.5 w-3.5" /> Completar SAPS
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} className="text-destructive/60 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── History ─── */}
      {!isFormMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" /> Admissões Realizadas (SAPS 3)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {records.filter(r => r.status !== 'pending').length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma admissão com SAPS 3 completada.
              </p>
            ) : (
              <div className="space-y-2">
                {records.filter(r => r.status !== 'pending').map(r => (
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
            <AlertDialogTitle>Excluir registro SAPS 3?</AlertDialogTitle>
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

// Timer component for pending SAPS
function SapsPendingTimer({ pendingSince }: { pendingSince: string | null }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!pendingSince) return;
    const update = () => {
      const diff = Date.now() - new Date(pendingSince).getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [pendingSince]);

  if (!pendingSince) return null;

  return (
    <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-700">
      <Clock className="h-3.5 w-3.5 animate-pulse" />
      <span className="font-mono font-bold text-sm">{elapsed}</span>
    </div>
  );
}

export { SapsPendingTimer };
