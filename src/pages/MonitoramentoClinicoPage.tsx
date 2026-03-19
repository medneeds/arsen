import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import {
  Activity, Heart, Thermometer, Wind, Droplets, Brain,
  Plus, TrendingUp, AlertTriangle, Clock, Search, Stethoscope,
  TestTubes, Save, BarChart3
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from "recharts";
import { format, parseISO, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageTransition } from "@/components/PageTransition";

// ── NEWS2 Calculation ──
function calculateNEWS2(params: {
  respiratoryRate?: number;
  spo2?: number;
  supplementalOxygen?: boolean;
  temperature?: number;
  systolicBp?: number;
  heartRate?: number;
  consciousnessLevel?: string;
}) {
  let score = 0;
  const { respiratoryRate, spo2, supplementalOxygen, temperature, systolicBp, heartRate, consciousnessLevel } = params;

  // Respiratory rate
  if (respiratoryRate != null) {
    if (respiratoryRate <= 8) score += 3;
    else if (respiratoryRate <= 11) score += 1;
    else if (respiratoryRate <= 20) score += 0;
    else if (respiratoryRate <= 24) score += 2;
    else score += 3;
  }

  // SpO2 Scale 1 (no hypercapnic risk)
  if (spo2 != null) {
    if (spo2 <= 91) score += 3;
    else if (spo2 <= 93) score += 2;
    else if (spo2 <= 95) score += 1;
    else score += 0;
  }

  // Supplemental oxygen
  if (supplementalOxygen) score += 2;

  // Temperature
  if (temperature != null) {
    if (temperature <= 35.0) score += 3;
    else if (temperature <= 36.0) score += 1;
    else if (temperature <= 38.0) score += 0;
    else if (temperature <= 39.0) score += 1;
    else score += 2;
  }

  // Systolic BP
  if (systolicBp != null) {
    if (systolicBp <= 90) score += 3;
    else if (systolicBp <= 100) score += 2;
    else if (systolicBp <= 110) score += 1;
    else if (systolicBp <= 219) score += 0;
    else score += 3;
  }

  // Heart rate
  if (heartRate != null) {
    if (heartRate <= 40) score += 3;
    else if (heartRate <= 50) score += 1;
    else if (heartRate <= 90) score += 0;
    else if (heartRate <= 110) score += 1;
    else if (heartRate <= 130) score += 2;
    else score += 3;
  }

  // Consciousness (AVPU)
  if (consciousnessLevel && consciousnessLevel !== "alert") score += 3;

  // Risk level
  let risk: string;
  if (score >= 7) risk = "high";
  else if (score >= 5) risk = "medium";
  else if (score === 3 && consciousnessLevel && consciousnessLevel !== "alert") risk = "low_key";
  else if (score >= 1) risk = "low";
  else risk = "low";

  return { score, risk };
}

const riskLabels: Record<string, { label: string; className: string }> = {
  low: { label: "Baixo", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  low_key: { label: "Baixo (monitorar)", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  medium: { label: "Médio", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  high: { label: "Alto", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

interface VitalRecord {
  id: string;
  recorded_at: string;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  temperature: number | null;
  pvc: number | null;
  consciousness_level: string | null;
  supplemental_oxygen: boolean | null;
  news2_score: number | null;
  news2_risk: string | null;
  ph: number | null;
  pco2: number | null;
  po2: number | null;
  hco3: number | null;
  lactate: number | null;
  base_excess: number | null;
  fio2: number | null;
  sao2: number | null;
  hemoglobin: number | null;
  hematocrit: number | null;
  platelets: number | null;
  leukocytes: number | null;
  creatinine: number | null;
  urea: number | null;
  sodium: number | null;
  potassium: number | null;
  pcr: number | null;
  procalcitonin: number | null;
  inr: number | null;
  notes: string | null;
  recorded_by_name: string | null;
}

interface PatientOption {
  id: string;
  name: string;
  bed_number: string;
  sector: string;
}

export default function MonitoramentoClinicoPage() {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const selectedUnit = currentHospital?.id;
  const selectedState = currentState?.id;
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(urlParams.get("patientId") || "");
  const [records, setRecords] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("registro");
  const [hoursRange, setHoursRange] = useState(24);

  // ── Form state ──
  const [form, setForm] = useState({
    systolicBp: "", diastolicBp: "", heartRate: "", respiratoryRate: "",
    spo2: "", temperature: "", pvc: "", consciousnessLevel: "alert",
    supplementalOxygen: false,
    ph: "", pco2: "", po2: "", hco3: "", lactate: "", baseExcess: "", fio2: "", sao2: "",
    hemoglobin: "", hematocrit: "", platelets: "", leukocytes: "",
    creatinine: "", urea: "", sodium: "", potassium: "",
    pcr: "", procalcitonin: "", inr: "",
    notes: "",
  });

  // Load patients
  useEffect(() => {
    if (!selectedUnit || !selectedState) return;
    const load = async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, name, bed_number, sector")
        .eq("hospital_unit_id", selectedUnit)
        .eq("state_id", selectedState)
        .neq("name", "")
        .order("bed_number");
      if (data) setPatients(data);
    };
    load();
  }, [selectedUnit, selectedState]);

  // Load vital records
  useEffect(() => {
    if (!selectedPatientId) { setRecords([]); return; }
    const load = async () => {
      setLoading(true);
      const since = subHours(new Date(), hoursRange).toISOString();
      const { data } = await supabase
        .from("vital_signs")
        .select("*")
        .eq("patient_id", selectedPatientId)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true });
      if (data) setRecords(data as unknown as VitalRecord[]);
      setLoading(false);
    };
    load();

    // Realtime subscription
    const channel = supabase
      .channel(`vitals-${selectedPatientId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "vital_signs",
        filter: `patient_id=eq.${selectedPatientId}`,
      }, (payload) => {
        setRecords(prev => [...prev, payload.new as unknown as VitalRecord]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedPatientId, hoursRange]);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const computedNEWS2 = useMemo(() => {
    return calculateNEWS2({
      respiratoryRate: form.respiratoryRate ? Number(form.respiratoryRate) : undefined,
      spo2: form.spo2 ? Number(form.spo2) : undefined,
      supplementalOxygen: form.supplementalOxygen,
      temperature: form.temperature ? Number(form.temperature) : undefined,
      systolicBp: form.systolicBp ? Number(form.systolicBp) : undefined,
      heartRate: form.heartRate ? Number(form.heartRate) : undefined,
      consciousnessLevel: form.consciousnessLevel,
    });
  }, [form.respiratoryRate, form.spo2, form.supplementalOxygen, form.temperature, form.systolicBp, form.heartRate, form.consciousnessLevel]);

  const handleSave = async () => {
    if (!selectedPatientId || !selectedUnit || !selectedState) {
      toast.error("Selecione um paciente");
      return;
    }

    const toNum = (v: string) => v ? Number(v) : null;
    const { score, risk } = computedNEWS2;

    const { error } = await supabase.from("vital_signs").insert({
      patient_id: selectedPatientId,
      hospital_unit_id: selectedUnit,
      state_id: selectedState,
      recorded_by: user?.id,
      recorded_by_name: user?.email?.split("@")[0] || "—",
      systolic_bp: toNum(form.systolicBp),
      diastolic_bp: toNum(form.diastolicBp),
      heart_rate: toNum(form.heartRate),
      respiratory_rate: toNum(form.respiratoryRate),
      spo2: toNum(form.spo2),
      temperature: toNum(form.temperature),
      pvc: toNum(form.pvc),
      consciousness_level: form.consciousnessLevel,
      supplemental_oxygen: form.supplementalOxygen,
      news2_score: score > 0 ? score : null,
      news2_risk: score > 0 ? risk : null,
      ph: toNum(form.ph), pco2: toNum(form.pco2), po2: toNum(form.po2),
      hco3: toNum(form.hco3), lactate: toNum(form.lactate),
      base_excess: toNum(form.baseExcess), fio2: toNum(form.fio2), sao2: toNum(form.sao2),
      hemoglobin: toNum(form.hemoglobin), hematocrit: toNum(form.hematocrit),
      platelets: toNum(form.platelets), leukocytes: toNum(form.leukocytes),
      creatinine: toNum(form.creatinine), urea: toNum(form.urea),
      sodium: toNum(form.sodium), potassium: toNum(form.potassium),
      pcr: toNum(form.pcr), procalcitonin: toNum(form.procalcitonin), inr: toNum(form.inr),
      notes: form.notes || null,
    });

    if (error) {
      toast.error("Erro ao salvar registro");
      console.error(error);
      return;
    }

    toast.success("Registro salvo com sucesso");
    // Check for alerts
    if (risk === "high") {
      toast.warning("⚠️ NEWS2 alto — risco de deterioração clínica!", { duration: 8000 });
    } else if (risk === "medium") {
      toast.warning("Atenção: NEWS2 médio — aumentar frequência de monitoramento", { duration: 6000 });
    }
    if (form.lactate && Number(form.lactate) > 4) {
      toast.error("🚨 Lactato elevado (>4 mmol/L) — avaliar perfusão!", { duration: 8000 });
    }
    if (form.potassium && (Number(form.potassium) > 6.0 || Number(form.potassium) < 2.5)) {
      toast.error("🚨 Potássio crítico — risco de arritmia!", { duration: 8000 });
    }

    // Reset form
    setForm({
      systolicBp: "", diastolicBp: "", heartRate: "", respiratoryRate: "",
      spo2: "", temperature: "", pvc: "", consciousnessLevel: "alert",
      supplementalOxygen: false,
      ph: "", pco2: "", po2: "", hco3: "", lactate: "", baseExcess: "", fio2: "", sao2: "",
      hemoglobin: "", hematocrit: "", platelets: "", leukocytes: "",
      creatinine: "", urea: "", sodium: "", potassium: "",
      pcr: "", procalcitonin: "", inr: "",
      notes: "",
    });
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.bed_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Chart data ──
  const chartData = useMemo(() => {
    return records.map(r => ({
      time: format(parseISO(r.recorded_at), "dd/MM HH:mm", { locale: ptBR }),
      pa_s: r.systolic_bp, pa_d: r.diastolic_bp,
      fc: r.heart_rate, fr: r.respiratory_rate,
      spo2: r.spo2 ? Number(r.spo2) : null,
      temp: r.temperature ? Number(r.temperature) : null,
      pvc: r.pvc ? Number(r.pvc) : null,
      news2: r.news2_score,
      ph: r.ph ? Number(r.ph) : null,
      lactate: r.lactate ? Number(r.lactate) : null,
      pco2: r.pco2 ? Number(r.pco2) : null,
      po2: r.po2 ? Number(r.po2) : null,
      hb: r.hemoglobin ? Number(r.hemoglobin) : null,
      cr: r.creatinine ? Number(r.creatinine) : null,
      k: r.potassium ? Number(r.potassium) : null,
      na: r.sodium ? Number(r.sodium) : null,
      leuk: r.leukocytes ? Number(r.leukocytes) : null,
      pcr: r.pcr ? Number(r.pcr) : null,
      plaq: r.platelets,
    }));
  }, [records]);

  const latestRecord = records.length > 0 ? records[records.length - 1] : null;

  return (
    <PageTransition>
      <div className="space-y-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Monitoramento clínico
            </h1>
            <p className="text-sm text-muted-foreground">Sinais vitais, NEWS2, gasometria e curvas laboratoriais</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(hoursRange)} onValueChange={v => setHoursRange(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 horas</SelectItem>
                <SelectItem value="12">12 horas</SelectItem>
                <SelectItem value="24">24 horas</SelectItem>
                <SelectItem value="48">48 horas</SelectItem>
                <SelectItem value="72">72 horas</SelectItem>
                <SelectItem value="168">7 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Patient selector */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPatients.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-medium">{p.bed_number}</span> — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPatient && latestRecord?.news2_risk && (
                <Badge className={riskLabels[latestRecord.news2_risk]?.className || ""}>
                  NEWS2: {latestRecord.news2_score} — {riskLabels[latestRecord.news2_risk]?.label}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {!selectedPatientId ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Selecione um paciente para visualizar ou registrar sinais vitais</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              <TabsTrigger value="registro"><Plus className="h-3.5 w-3.5 mr-1" />Registro</TabsTrigger>
              <TabsTrigger value="tendencias"><TrendingUp className="h-3.5 w-3.5 mr-1" />Tendências</TabsTrigger>
              <TabsTrigger value="gasometria"><Droplets className="h-3.5 w-3.5 mr-1" />Gasometria</TabsTrigger>
              <TabsTrigger value="laboratorio"><TestTubes className="h-3.5 w-3.5 mr-1" />Laboratório</TabsTrigger>
            </TabsList>

            {/* ── TAB: Registro ── */}
            <TabsContent value="registro">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Vital signs */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Heart className="h-4 w-4 text-destructive" />
                      Sinais vitais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">PA sistólica (mmHg)</Label>
                        <Input type="number" value={form.systolicBp} onChange={e => setForm(f => ({ ...f, systolicBp: e.target.value }))} placeholder="120" />
                      </div>
                      <div>
                        <Label className="text-xs">PA diastólica (mmHg)</Label>
                        <Input type="number" value={form.diastolicBp} onChange={e => setForm(f => ({ ...f, diastolicBp: e.target.value }))} placeholder="80" />
                      </div>
                      <div>
                        <Label className="text-xs">FC (bpm)</Label>
                        <Input type="number" value={form.heartRate} onChange={e => setForm(f => ({ ...f, heartRate: e.target.value }))} placeholder="72" />
                      </div>
                      <div>
                        <Label className="text-xs">FR (irpm)</Label>
                        <Input type="number" value={form.respiratoryRate} onChange={e => setForm(f => ({ ...f, respiratoryRate: e.target.value }))} placeholder="16" />
                      </div>
                      <div>
                        <Label className="text-xs">SpO₂ (%)</Label>
                        <Input type="number" value={form.spo2} onChange={e => setForm(f => ({ ...f, spo2: e.target.value }))} placeholder="98" />
                      </div>
                      <div>
                        <Label className="text-xs">Temperatura (°C)</Label>
                        <Input type="number" step="0.1" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))} placeholder="36.5" />
                      </div>
                      <div>
                        <Label className="text-xs">PVC (cmH₂O)</Label>
                        <Input type="number" step="0.1" value={form.pvc} onChange={e => setForm(f => ({ ...f, pvc: e.target.value }))} placeholder="8" />
                      </div>
                      <div>
                        <Label className="text-xs">Consciência (AVPU)</Label>
                        <Select value={form.consciousnessLevel} onValueChange={v => setForm(f => ({ ...f, consciousnessLevel: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alert">Alerta (A)</SelectItem>
                            <SelectItem value="verbal">Voz (V)</SelectItem>
                            <SelectItem value="pain">Dor (P)</SelectItem>
                            <SelectItem value="unresponsive">Não responde (U)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.supplementalOxygen} onCheckedChange={v => setForm(f => ({ ...f, supplementalOxygen: v }))} />
                      <Label className="text-xs">O₂ suplementar</Label>
                    </div>

                    {/* NEWS2 preview */}
                    {computedNEWS2.score > 0 && (
                      <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${riskLabels[computedNEWS2.risk]?.className}`}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-semibold">NEWS2: {computedNEWS2.score}</span>
                        </div>
                        <span className="text-sm font-medium">Risco {riskLabels[computedNEWS2.risk]?.label}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Blood Gas + Labs */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-primary" />
                        Gasometria arterial
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">pH</Label><Input type="number" step="0.01" value={form.ph} onChange={e => setForm(f => ({ ...f, ph: e.target.value }))} placeholder="7.40" /></div>
                        <div><Label className="text-xs">pCO₂ (mmHg)</Label><Input type="number" step="0.1" value={form.pco2} onChange={e => setForm(f => ({ ...f, pco2: e.target.value }))} placeholder="40" /></div>
                        <div><Label className="text-xs">pO₂ (mmHg)</Label><Input type="number" step="0.1" value={form.po2} onChange={e => setForm(f => ({ ...f, po2: e.target.value }))} placeholder="95" /></div>
                        <div><Label className="text-xs">HCO₃ (mEq/L)</Label><Input type="number" step="0.1" value={form.hco3} onChange={e => setForm(f => ({ ...f, hco3: e.target.value }))} placeholder="24" /></div>
                        <div><Label className="text-xs">Lactato (mmol/L)</Label><Input type="number" step="0.1" value={form.lactate} onChange={e => setForm(f => ({ ...f, lactate: e.target.value }))} placeholder="1.0" /></div>
                        <div><Label className="text-xs">BE (mEq/L)</Label><Input type="number" step="0.1" value={form.baseExcess} onChange={e => setForm(f => ({ ...f, baseExcess: e.target.value }))} placeholder="0" /></div>
                        <div><Label className="text-xs">FiO₂ (%)</Label><Input type="number" step="1" value={form.fio2} onChange={e => setForm(f => ({ ...f, fio2: e.target.value }))} placeholder="21" /></div>
                        <div><Label className="text-xs">SaO₂ (%)</Label><Input type="number" step="0.1" value={form.sao2} onChange={e => setForm(f => ({ ...f, sao2: e.target.value }))} placeholder="97" /></div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TestTubes className="h-4 w-4 text-accent-foreground" />
                        Exames laboratoriais
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label className="text-xs">Hb (g/dL)</Label><Input type="number" step="0.1" value={form.hemoglobin} onChange={e => setForm(f => ({ ...f, hemoglobin: e.target.value }))} placeholder="13" /></div>
                        <div><Label className="text-xs">Ht (%)</Label><Input type="number" step="0.1" value={form.hematocrit} onChange={e => setForm(f => ({ ...f, hematocrit: e.target.value }))} placeholder="39" /></div>
                        <div><Label className="text-xs">Plaquetas</Label><Input type="number" value={form.platelets} onChange={e => setForm(f => ({ ...f, platelets: e.target.value }))} placeholder="250000" /></div>
                        <div><Label className="text-xs">Leucócitos</Label><Input type="number" step="0.1" value={form.leukocytes} onChange={e => setForm(f => ({ ...f, leukocytes: e.target.value }))} placeholder="7.5" /></div>
                        <div><Label className="text-xs">Cr (mg/dL)</Label><Input type="number" step="0.01" value={form.creatinine} onChange={e => setForm(f => ({ ...f, creatinine: e.target.value }))} placeholder="1.0" /></div>
                        <div><Label className="text-xs">Ureia (mg/dL)</Label><Input type="number" step="0.1" value={form.urea} onChange={e => setForm(f => ({ ...f, urea: e.target.value }))} placeholder="30" /></div>
                        <div><Label className="text-xs">Na (mEq/L)</Label><Input type="number" step="0.1" value={form.sodium} onChange={e => setForm(f => ({ ...f, sodium: e.target.value }))} placeholder="140" /></div>
                        <div><Label className="text-xs">K (mEq/L)</Label><Input type="number" step="0.01" value={form.potassium} onChange={e => setForm(f => ({ ...f, potassium: e.target.value }))} placeholder="4.0" /></div>
                        <div><Label className="text-xs">PCR (mg/L)</Label><Input type="number" step="0.01" value={form.pcr} onChange={e => setForm(f => ({ ...f, pcr: e.target.value }))} placeholder="5" /></div>
                        <div><Label className="text-xs">PCT (ng/mL)</Label><Input type="number" step="0.001" value={form.procalcitonin} onChange={e => setForm(f => ({ ...f, procalcitonin: e.target.value }))} placeholder="0.1" /></div>
                        <div><Label className="text-xs">INR</Label><Input type="number" step="0.01" value={form.inr} onChange={e => setForm(f => ({ ...f, inr: e.target.value }))} placeholder="1.0" /></div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Observações (opcional)"
                  rows={2}
                />
                <Button onClick={handleSave} className="w-full md:w-auto">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar registro
                </Button>
              </div>
            </TabsContent>

            {/* ── TAB: Tendências ── */}
            <TabsContent value="tendencias">
              {records.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum registro no período selecionado</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <TrendChart title="Pressão arterial" data={chartData} lines={[
                    { key: "pa_s", color: "hsl(var(--destructive))", label: "PAS" },
                    { key: "pa_d", color: "hsl(var(--primary))", label: "PAD" },
                  ]} refLines={[{ y: 90, label: "PAS ↓", color: "#ef4444" }, { y: 140, label: "PAS ↑", color: "#f97316" }]} />
                  <TrendChart title="Frequência cardíaca" data={chartData} lines={[
                    { key: "fc", color: "hsl(var(--destructive))", label: "FC" },
                  ]} refLines={[{ y: 60, label: "Bradi", color: "#3b82f6" }, { y: 100, label: "Taqui", color: "#ef4444" }]} />
                  <TrendChart title="SpO₂ (%)" data={chartData} lines={[
                    { key: "spo2", color: "#3b82f6", label: "SpO₂" },
                  ]} domain={[85, 100]} refLines={[{ y: 92, label: "Limite", color: "#ef4444" }]} />
                  <TrendChart title="Frequência respiratória" data={chartData} lines={[
                    { key: "fr", color: "#10b981", label: "FR" },
                  ]} refLines={[{ y: 12, label: "↓", color: "#3b82f6" }, { y: 20, label: "↑", color: "#f97316" }]} />
                  <TrendChart title="Temperatura (°C)" data={chartData} lines={[
                    { key: "temp", color: "#f97316", label: "T°" },
                  ]} domain={[34, 42]} refLines={[{ y: 37.8, label: "Febre", color: "#ef4444" }]} />
                  <TrendChart title="NEWS2 Score" data={chartData} lines={[
                    { key: "news2", color: "hsl(var(--primary))", label: "NEWS2" },
                  ]} refLines={[{ y: 5, label: "Médio", color: "#f97316" }, { y: 7, label: "Alto", color: "#ef4444" }]} isArea />
                </div>
              )}
            </TabsContent>

            {/* ── TAB: Gasometria ── */}
            <TabsContent value="gasometria">
              {records.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum registro no período selecionado</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <TrendChart title="pH" data={chartData} lines={[{ key: "ph", color: "#8b5cf6", label: "pH" }]} domain={[7.0, 7.6]} refLines={[{ y: 7.35, label: "↓", color: "#ef4444" }, { y: 7.45, label: "↑", color: "#f97316" }]} />
                  <TrendChart title="Lactato (mmol/L)" data={chartData} lines={[{ key: "lactate", color: "#ef4444", label: "Lactato" }]} refLines={[{ y: 2, label: "Limite", color: "#f97316" }, { y: 4, label: "Crítico", color: "#ef4444" }]} />
                  <TrendChart title="pCO₂ (mmHg)" data={chartData} lines={[{ key: "pco2", color: "#6366f1", label: "pCO₂" }]} refLines={[{ y: 35, label: "↓", color: "#3b82f6" }, { y: 45, label: "↑", color: "#f97316" }]} />
                  <TrendChart title="pO₂ (mmHg)" data={chartData} lines={[{ key: "po2", color: "#3b82f6", label: "pO₂" }]} refLines={[{ y: 80, label: "Limite", color: "#ef4444" }]} />
                </div>
              )}
            </TabsContent>

            {/* ── TAB: Laboratório ── */}
            <TabsContent value="laboratorio">
              {records.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum registro no período selecionado</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <TrendChart title="Hemoglobina (g/dL)" data={chartData} lines={[{ key: "hb", color: "#ef4444", label: "Hb" }]} refLines={[{ y: 7, label: "Transfundir", color: "#ef4444" }]} />
                  <TrendChart title="Creatinina (mg/dL)" data={chartData} lines={[{ key: "cr", color: "#f97316", label: "Cr" }]} refLines={[{ y: 1.2, label: "Limite", color: "#f97316" }]} />
                  <TrendChart title="Potássio (mEq/L)" data={chartData} lines={[{ key: "k", color: "#8b5cf6", label: "K+" }]} refLines={[{ y: 3.5, label: "↓", color: "#3b82f6" }, { y: 5.5, label: "↑", color: "#ef4444" }]} />
                  <TrendChart title="Leucócitos (×10³)" data={chartData} lines={[{ key: "leuk", color: "#10b981", label: "Leuc" }]} refLines={[{ y: 4, label: "↓", color: "#3b82f6" }, { y: 11, label: "↑", color: "#f97316" }]} />
                  <TrendChart title="PCR (mg/L)" data={chartData} lines={[{ key: "pcr", color: "#f43f5e", label: "PCR" }]} refLines={[{ y: 10, label: "Elevado", color: "#f97316" }]} />
                  <TrendChart title="Plaquetas" data={chartData} lines={[{ key: "plaq", color: "#ec4899", label: "Plaq" }]} refLines={[{ y: 150000, label: "↓", color: "#f97316" }, { y: 50000, label: "Crítico", color: "#ef4444" }]} />
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Latest records table */}
        {selectedPatientId && records.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Últimos registros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-60">
                <div className="space-y-2">
                  {[...records].reverse().slice(0, 10).map(r => (
                    <div key={r.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-28">
                          {format(parseISO(r.recorded_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                        {r.systolic_bp && <span>PA {r.systolic_bp}/{r.diastolic_bp}</span>}
                        {r.heart_rate && <span>FC {r.heart_rate}</span>}
                        {r.spo2 && <span>SpO₂ {Number(r.spo2)}%</span>}
                        {r.temperature && <span>T {Number(r.temperature)}°C</span>}
                        {r.respiratory_rate && <span>FR {r.respiratory_rate}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {r.news2_score != null && r.news2_risk && (
                          <Badge variant="outline" className={`text-xs ${riskLabels[r.news2_risk]?.className || ""}`}>
                            NEWS2: {r.news2_score}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{r.recorded_by_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}

// ── Reusable trend chart component ──
function TrendChart({ title, data, lines, refLines = [], domain, isArea }: {
  title: string;
  data: Record<string, unknown>[];
  lines: { key: string; color: string; label: string }[];
  refLines?: { y: number; label: string; color: string }[];
  domain?: [number, number];
  isArea?: boolean;
}) {
  const hasData = data.some(d => lines.some(l => d[l.key] != null));
  if (!hasData) return null;

  const ChartComponent = isArea ? AreaChart : LineChart;

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <ChartComponent data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-muted-foreground" />
            <YAxis domain={domain || ["auto", "auto"]} tick={{ fontSize: 10 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{ fontSize: 12, backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            {refLines.map((rl, i) => (
              <ReferenceLine key={i} y={rl.y} stroke={rl.color} strokeDasharray="4 4" label={{ value: rl.label, fontSize: 10, fill: rl.color }} />
            ))}
            {lines.map(l =>
              isArea ? (
                <Area key={l.key} type="monotone" dataKey={l.key} stroke={l.color} fill={l.color} fillOpacity={0.15} name={l.label} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              ) : (
                <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} name={l.label} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              )
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
