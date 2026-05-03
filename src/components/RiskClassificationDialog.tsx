import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, Clock, CheckCircle, Info, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RiskClassificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preAdmission: {
    id: string;
    patient_name: string;
    birth_date?: string;
    sex?: string;
  } | null;
  onSuccess?: () => void;
}

const RISK_LEVELS = [
  {
    value: "vermelho",
    label: "EMERGÊNCIA",
    description: "Risco de morte imediato. Atendimento imediato.",
    color: "bg-red-600 hover:bg-red-700 text-white border-red-700",
    selectedColor: "ring-4 ring-red-400 bg-red-600 text-white",
    icon: AlertTriangle,
    time: "0 min",
  },
  {
    value: "laranja",
    label: "MUITO URGENTE",
    description: "Risco de deterioração rápida. Até 10 minutos.",
    color: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600",
    selectedColor: "ring-4 ring-orange-300 bg-orange-500 text-white",
    icon: AlertTriangle,
    time: "10 min",
  },
  {
    value: "amarelo",
    label: "URGENTE",
    description: "Condição grave, sem risco imediato. Até 60 minutos.",
    color: "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-600",
    selectedColor: "ring-4 ring-yellow-300 bg-yellow-500 text-black",
    icon: Clock,
    time: "60 min",
  },
  {
    value: "verde",
    label: "POUCO URGENTE",
    description: "Condição estável. Até 120 minutos.",
    color: "bg-green-600 hover:bg-green-700 text-white border-green-700",
    selectedColor: "ring-4 ring-green-300 bg-green-600 text-white",
    icon: CheckCircle,
    time: "120 min",
  },
  {
    value: "azul",
    label: "NÃO URGENTE",
    description: "Sem risco. Até 240 minutos.",
    color: "bg-blue-600 hover:bg-blue-700 text-white border-blue-700",
    selectedColor: "ring-4 ring-blue-300 bg-blue-600 text-white",
    icon: Info,
    time: "240 min",
  },
  {
    value: "branca",
    label: "FICHA BRANCA",
    description: "Eletivo — sem critério de risco imediato. Fluxo Socorrão I (atendimento por ordem de chegada, sem temporalidade Manchester).",
    color: "bg-white hover:bg-slate-50 text-slate-900 border-slate-400",
    selectedColor: "ring-4 ring-slate-400 bg-white text-slate-900 border-slate-500",
    icon: Info,
    time: "ELETIVO",
  },
] as const;

interface VitalSigns {
  pa_systolic: string;
  pa_diastolic: string;
  fc: string;
  fr: string;
  tax: string;
  spo2: string;
  hgt: string;
}

interface TriageForm {
  chief_complaint: string;
  vital_signs: VitalSigns;
  glasgow_eye: number;
  glasgow_verbal: number;
  glasgow_motor: number;
  airway_patent: boolean;
  airway_obstruction: boolean;
  airway_intubated: boolean;
  airway_notes: string;
  peripheral_perfusion: string;
  pulse_quality: string;
  allergies: string;
  flu_symptoms: boolean;
  flu_symptoms_detail: string;
  pain_scale: number;
  oxygen_therapy: boolean;
  oxygen_therapy_detail: string;
  triage_notes: string;
}

const INITIAL_FORM: TriageForm = {
  chief_complaint: "",
  vital_signs: { pa_systolic: "", pa_diastolic: "", fc: "", fr: "", tax: "", spo2: "", hgt: "" },
  glasgow_eye: 4,
  glasgow_verbal: 5,
  glasgow_motor: 6,
  airway_patent: true,
  airway_obstruction: false,
  airway_intubated: false,
  airway_notes: "",
  peripheral_perfusion: "",
  pulse_quality: "",
  allergies: "",
  flu_symptoms: false,
  flu_symptoms_detail: "",
  pain_scale: 0,
  oxygen_therapy: false,
  oxygen_therapy_detail: "",
  triage_notes: "",
};

export function RiskClassificationDialog({ open, onOpenChange, preAdmission, onSuccess }: RiskClassificationDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<TriageForm>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState(0); // 0 = clinical, 1 = classification

  const glasgowTotal = form.glasgow_eye + form.glasgow_verbal + form.glasgow_motor;

  // ─── Sugestão automática Manchester (não-vinculante) ──────────
  const suggestion = (() => {
    const reasons: string[] = [];
    let level: typeof RISK_LEVELS[number]["value"] = "azul";
    const bump = (l: typeof level, reason: string) => {
      const order = ["branca", "azul", "verde", "amarelo", "laranja", "vermelho"];
      if (order.indexOf(l) > order.indexOf(level)) level = l;
      reasons.push(reason);
    };
    const fc = Number(form.vital_signs.fc);
    const fr = Number(form.vital_signs.fr);
    const sis = Number(form.vital_signs.pa_systolic);
    const spo2 = Number(form.vital_signs.spo2);
    const tax = Number(form.vital_signs.tax);
    const hgt = Number(form.vital_signs.hgt);

    if (form.airway_obstruction) bump("vermelho", "Obstrução de vias aéreas");
    if (form.airway_intubated) bump("vermelho", "Paciente intubado");
    if (glasgowTotal <= 8) bump("vermelho", `Glasgow ≤ 8 (${glasgowTotal})`);
    if (form.pulse_quality === "ausente") bump("vermelho", "Pulso ausente");
    if (spo2 && spo2 < 85) bump("vermelho", `SpO₂ < 85% (${spo2}%)`);
    if (sis && sis < 80) bump("vermelho", `PAS < 80 (${sis})`);

    if (glasgowTotal >= 9 && glasgowTotal <= 12) bump("laranja", `Glasgow 9-12 (${glasgowTotal})`);
    if (spo2 && spo2 >= 85 && spo2 < 90) bump("laranja", `SpO₂ 85-89% (${spo2}%)`);
    if (sis && sis >= 80 && sis < 90) bump("laranja", `PAS 80-89 (${sis})`);
    if (fc && (fc < 40 || fc > 140)) bump("laranja", `FC alterada (${fc})`);
    if (fr && (fr < 8 || fr > 30)) bump("laranja", `FR alterada (${fr})`);
    if (form.pain_scale >= 8) bump("laranja", `Dor severa (${form.pain_scale}/10)`);
    if (form.pulse_quality === "fraco") bump("laranja", "Pulso fraco/filiforme");

    if (spo2 && spo2 >= 90 && spo2 < 94) bump("amarelo", `SpO₂ 90-93% (${spo2}%)`);
    if (tax && tax >= 39) bump("amarelo", `Hipertermia ≥ 39°C (${tax})`);
    if (form.pain_scale >= 5 && form.pain_scale <= 7) bump("amarelo", `Dor moderada (${form.pain_scale}/10)`);
    if (form.oxygen_therapy) bump("amarelo", "Em oxigenoterapia");
    if (hgt && (hgt < 60 || hgt > 300)) bump("amarelo", `HGT alterado (${hgt})`);
    if (form.peripheral_perfusion === "muito_lenta") bump("amarelo", "Perfusão muito lenta");

    if (form.pain_scale >= 1 && form.pain_scale <= 4) bump("verde", `Dor leve (${form.pain_scale}/10)`);
    if (form.flu_symptoms) bump("verde", "Sintomas gripais");

    return { level, reasons };
  })();

  const handleSave = async () => {
    if (!selected || !preAdmission) return;

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("pre_admissions")
        .update({
          risk_classification: selected,
          risk_classified_at: new Date().toISOString(),
          risk_classified_by: userData?.user?.id || null,
          status: "classificado",
          chief_complaint: form.chief_complaint.trim() || null,
          vital_signs: form.vital_signs,
          glasgow_score: glasgowTotal,
          glasgow_detail: {
            eye: form.glasgow_eye,
            verbal: form.glasgow_verbal,
            motor: form.glasgow_motor,
          },
          airway_patent: form.airway_patent,
          airway_obstruction: form.airway_obstruction,
          airway_intubated: form.airway_intubated,
          airway_notes: form.airway_notes.trim() || null,
          peripheral_perfusion: form.peripheral_perfusion || null,
          pulse_quality: form.pulse_quality || null,
          allergies: form.allergies.trim() || null,
          flu_symptoms: form.flu_symptoms,
          flu_symptoms_detail: form.flu_symptoms_detail.trim() || null,
          pain_scale: form.pain_scale,
          oxygen_therapy: form.oxygen_therapy,
          oxygen_therapy_detail: form.oxygen_therapy_detail.trim() || null,
          triage_notes: form.triage_notes.trim() || null,
        } as any)
        .eq("id", preAdmission.id);

      if (error) throw error;

      const level = RISK_LEVELS.find(r => r.value === selected);
      toast({
        title: `✅ Classificação: ${level?.label}`,
        description: `${preAdmission.patient_name} classificado com sucesso`,
      });

      resetAndClose();
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Erro ao classificar", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const resetAndClose = () => {
    setSelected(null);
    setForm(INITIAL_FORM);
    setStep(0);
    onOpenChange(false);
  };

  const updateVitals = (key: keyof VitalSigns, value: string) => {
    setForm(prev => ({
      ...prev,
      vital_signs: { ...prev.vital_signs, [key]: value },
    }));
  };

  const age = preAdmission?.birth_date
    ? Math.floor((Date.now() - new Date(preAdmission.birth_date + "T12:00:00").getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const painColor = form.pain_scale <= 3 ? "text-green-600" : form.pain_scale <= 6 ? "text-yellow-600" : "text-red-600";

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Triagem — Classificação de Risco
          </DialogTitle>
          {preAdmission && (
            <p className="text-sm text-muted-foreground">
              {preAdmission.patient_name}
              {age !== null && ` • ${age} anos`}
              {preAdmission.sex && ` • ${preAdmission.sex === "M" ? "Masculino" : preAdmission.sex === "F" ? "Feminino" : "Outro"}`}
            </p>
          )}
          {/* Step indicator */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setStep(0)}
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-full transition-colors",
                step === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              1. Avaliação Clínica
            </button>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              onClick={() => setStep(1)}
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-full transition-colors",
                step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              2. Classificação Manchester
            </button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-6">
          {step === 0 ? (
            <div className="space-y-5 pb-4">
              {/* Chief Complaint */}
              <div>
                <Label className="text-xs font-semibold">Motivo da Entrada / Queixa Principal *</Label>
                <Textarea
                  value={form.chief_complaint}
                  onChange={e => setForm(prev => ({ ...prev, chief_complaint: e.target.value }))}
                  placeholder="Descreva a queixa principal e motivo da entrada..."
                  rows={2}
                />
              </div>

              {/* Vital Signs */}
              <div>
                <Label className="text-xs font-semibold mb-2 block">Sinais Vitais</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">PA (mmHg)</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder="SIS"
                        value={form.vital_signs.pa_systolic}
                        onChange={e => updateVitals("pa_systolic", e.target.value)}
                        className="h-8 text-xs"
                      />
                      <span className="text-muted-foreground text-xs">/</span>
                      <Input
                        type="number"
                        placeholder="DIA"
                        value={form.vital_signs.pa_diastolic}
                        onChange={e => updateVitals("pa_diastolic", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">FC (bpm)</Label>
                    <Input
                      type="number"
                      placeholder="FC"
                      value={form.vital_signs.fc}
                      onChange={e => updateVitals("fc", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">FR (irpm)</Label>
                    <Input
                      type="number"
                      placeholder="FR"
                      value={form.vital_signs.fr}
                      onChange={e => updateVitals("fr", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Tax (°C)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="36.5"
                      value={form.vital_signs.tax}
                      onChange={e => updateVitals("tax", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">SpO₂ (%)</Label>
                    <Input
                      type="number"
                      placeholder="SpO₂"
                      value={form.vital_signs.spo2}
                      onChange={e => updateVitals("spo2", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">HGT (mg/dL)</Label>
                    <Input
                      type="number"
                      placeholder="HGT"
                      value={form.vital_signs.hgt}
                      onChange={e => updateVitals("hgt", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Airway Assessment */}
              <div>
                <Label className="text-xs font-semibold mb-2 block">Avaliação das Vias Aéreas</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="airway-patent"
                      checked={form.airway_patent}
                      onCheckedChange={v => setForm(prev => ({ ...prev, airway_patent: !!v }))}
                    />
                    <Label htmlFor="airway-patent" className="text-xs cursor-pointer">Pérvias</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="airway-obstruction"
                      checked={form.airway_obstruction}
                      onCheckedChange={v => setForm(prev => ({ ...prev, airway_obstruction: !!v }))}
                    />
                    <Label htmlFor="airway-obstruction" className="text-xs cursor-pointer">Obstrução</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="airway-intubated"
                      checked={form.airway_intubated}
                      onCheckedChange={v => setForm(prev => ({ ...prev, airway_intubated: !!v }))}
                    />
                    <Label htmlFor="airway-intubated" className="text-xs cursor-pointer">IOT/Intubado</Label>
                  </div>
                </div>
                <Input
                  className="mt-2 h-8 text-xs"
                  placeholder="Observações sobre vias aéreas..."
                  value={form.airway_notes}
                  onChange={e => setForm(prev => ({ ...prev, airway_notes: e.target.value }))}
                />
              </div>

              {/* Perfusion & Pulse */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Perfusão Periférica</Label>
                  <Select
                    value={form.peripheral_perfusion}
                    onValueChange={v => setForm(prev => ({ ...prev, peripheral_perfusion: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal (&lt; 2s)</SelectItem>
                      <SelectItem value="lentificada">Lentificada (2-4s)</SelectItem>
                      <SelectItem value="muito_lenta">Muito lenta (&gt; 4s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Pulso</Label>
                  <Select
                    value={form.pulse_quality}
                    onValueChange={v => setForm(prev => ({ ...prev, pulse_quality: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cheio_regular">Cheio e regular</SelectItem>
                      <SelectItem value="fraco">Fraco / Filiforme</SelectItem>
                      <SelectItem value="irregular">Irregular</SelectItem>
                      <SelectItem value="ausente">Ausente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Glasgow */}
              <div>
                <Label className="text-xs font-semibold mb-2 block">
                  Escala de Glasgow (ECG) — Total: <span className={cn("font-bold", glasgowTotal <= 8 ? "text-red-600" : glasgowTotal <= 12 ? "text-yellow-600" : "text-green-600")}>{glasgowTotal}</span>
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Ocular (1-4)</Label>
                    <Select
                      value={String(form.glasgow_eye)}
                      onValueChange={v => setForm(prev => ({ ...prev, glasgow_eye: Number(v) }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 - Espontânea</SelectItem>
                        <SelectItem value="3">3 - Ao comando verbal</SelectItem>
                        <SelectItem value="2">2 - À dor</SelectItem>
                        <SelectItem value="1">1 - Nenhuma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Verbal (1-5)</Label>
                    <Select
                      value={String(form.glasgow_verbal)}
                      onValueChange={v => setForm(prev => ({ ...prev, glasgow_verbal: Number(v) }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 - Orientada</SelectItem>
                        <SelectItem value="4">4 - Confusa</SelectItem>
                        <SelectItem value="3">3 - Palavras inapropriadas</SelectItem>
                        <SelectItem value="2">2 - Sons incompreensíveis</SelectItem>
                        <SelectItem value="1">1 - Nenhuma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Motora (1-6)</Label>
                    <Select
                      value={String(form.glasgow_motor)}
                      onValueChange={v => setForm(prev => ({ ...prev, glasgow_motor: Number(v) }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6 - Obedece comandos</SelectItem>
                        <SelectItem value="5">5 - Localiza dor</SelectItem>
                        <SelectItem value="4">4 - Flexão normal</SelectItem>
                        <SelectItem value="3">3 - Flexão anormal</SelectItem>
                        <SelectItem value="2">2 - Extensão</SelectItem>
                        <SelectItem value="1">1 - Nenhuma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Pain Scale */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">
                  Escala de Dor: <span className={cn("font-bold", painColor)}>{form.pain_scale}/10</span>
                </Label>
                <Slider
                  value={[form.pain_scale]}
                  onValueChange={v => setForm(prev => ({ ...prev, pain_scale: v[0] }))}
                  max={10}
                  step={1}
                  className="py-2"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Sem dor</span>
                  <span>Dor máxima</span>
                </div>
              </div>

              {/* Allergies */}
              <div>
                <Label className="text-xs font-semibold">Alergias</Label>
                <Input
                  value={form.allergies}
                  onChange={e => setForm(prev => ({ ...prev, allergies: e.target.value }))}
                  placeholder="Descreva alergias conhecidas (ou 'Nega alergias')"
                  className="h-8 text-xs"
                />
              </div>

              {/* Flu Symptoms */}
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/40">
                <Checkbox
                  id="flu-symptoms"
                  checked={form.flu_symptoms}
                  onCheckedChange={v => setForm(prev => ({ ...prev, flu_symptoms: !!v }))}
                />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="flu-symptoms" className="text-xs font-semibold cursor-pointer">Sintomas Gripais / Síndrome Respiratória</Label>
                  {form.flu_symptoms && (
                    <Input
                      className="h-8 text-xs mt-1"
                      placeholder="Detalhe: febre, tosse, coriza, dispneia..."
                      value={form.flu_symptoms_detail}
                      onChange={e => setForm(prev => ({ ...prev, flu_symptoms_detail: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              {/* Oxygen Therapy */}
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/40">
                <Checkbox
                  id="oxygen-therapy"
                  checked={form.oxygen_therapy}
                  onCheckedChange={v => setForm(prev => ({ ...prev, oxygen_therapy: !!v }))}
                />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="oxygen-therapy" className="text-xs font-semibold cursor-pointer">Em uso de O₂ / Oxigenoterapia</Label>
                  {form.oxygen_therapy && (
                    <Input
                      className="h-8 text-xs mt-1"
                      placeholder="Tipo e fluxo (ex: CN 3L/min, Máscara 5L/min)"
                      value={form.oxygen_therapy_detail}
                      onChange={e => setForm(prev => ({ ...prev, oxygen_therapy_detail: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              {/* Triage Notes */}
              <div>
                <Label className="text-xs font-semibold">Observações da Triagem</Label>
                <Textarea
                  value={form.triage_notes}
                  onChange={e => setForm(prev => ({ ...prev, triage_notes: e.target.value }))}
                  placeholder="Informações adicionais relevantes..."
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {(() => {
                const sug = RISK_LEVELS.find(r => r.value === suggestion.level)!;
                return (
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Info className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                          Sugestão do sistema
                        </span>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", sug.color.split(" ").filter(c => c.startsWith("bg-") || c.startsWith("text-")).join(" "))}>
                          {sug.label}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setSelected(suggestion.level)}
                        disabled={selected === suggestion.level}
                      >
                        {selected === suggestion.level ? "Aplicada" : "Aplicar sugestão"}
                      </Button>
                    </div>
                    {suggestion.reasons.length > 0 ? (
                      <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-5 list-disc">
                        {suggestion.reasons.slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-muted-foreground pl-1">
                        Sem critérios de gravidade detectados nos sinais avaliados.
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground italic pl-1">
                      Sugestão não-vinculante. A decisão final é do profissional triador.
                    </p>
                  </div>
                );
              })()}
              {RISK_LEVELS.map(level => {
                const Icon = level.icon;
                const isSelected = selected === level.value;
                return (
                  <button
                    key={level.value}
                    onClick={() => setSelected(level.value)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                      isSelected ? level.selectedColor : level.color,
                      "cursor-pointer"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{level.label}</div>
                      <div className="text-xs opacity-90">{level.description}</div>
                    </div>
                    <div className="text-xs font-mono font-bold shrink-0">{level.time}</div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-between gap-2 px-6 pb-6 pt-2 border-t">
          {step === 0 ? (
            <>
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button onClick={() => setStep(1)} disabled={!form.chief_complaint.trim()}>
                Avançar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(0)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleSave} disabled={!selected || isSaving}>
                Classificar Paciente
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
