import React, { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield, AlertTriangle, Printer, Heart, Activity, Droplets, Check,
  Info, ChevronRight, RotateCw, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ──────────────────────────────────────────────
// PÁDUA SCORE (clinical patients)
// ──────────────────────────────────────────────
const PADUA_FACTORS = [
  { id: "cancer", label: "Câncer ativo", points: 3, description: "Neoplasia em tratamento (quimio/radio) nos últimos 6 meses ou metastática" },
  { id: "tev_prev", label: "TEV prévio (excluindo trombose venosa superficial)", points: 3, description: "Histórico documentado de TVP/TEP" },
  { id: "mobility", label: "Mobilidade reduzida (≥ 3 dias)", points: 3, description: "Repouso no leito com uso do banheiro por ≥ 3 dias" },
  { id: "thrombophilia", label: "Trombofilia conhecida", points: 3, description: "Fator V Leiden, mutação protrombina, deficiência proteína C/S, SAF" },
  { id: "trauma_surgery", label: "Trauma e/ou cirurgia recente (≤ 1 mês)", points: 2, description: "Procedimento cirúrgico ou trauma significativo no último mês" },
  { id: "age_70", label: "Idade ≥ 70 anos", points: 1, description: "Fator de risco independente pela idade" },
  { id: "heart_failure", label: "Insuficiência cardíaca e/ou respiratória", points: 1, description: "IC classe III-IV ou insuficiência respiratória aguda" },
  { id: "ami_stroke", label: "IAM agudo e/ou AVC isquêmico", points: 1, description: "Evento cardiovascular agudo atual" },
  { id: "infection", label: "Infecção aguda e/ou doença reumatológica", points: 1, description: "Processo infeccioso ativo ou doença autoimune em atividade" },
  { id: "obesity", label: "Obesidade (IMC ≥ 30)", points: 1, description: "Índice de massa corporal elevado" },
  { id: "hormonal", label: "Tratamento hormonal em curso", points: 1, description: "ACO, TRH ou terapia anti-androgênica" },
];

// ──────────────────────────────────────────────
// CAPRINI SCORE (surgical patients)
// ──────────────────────────────────────────────
const CAPRINI_SECTIONS = [
  {
    title: "1 ponto cada",
    points: 1,
    items: [
      { id: "c_age41_60", label: "Idade 41-60 anos" },
      { id: "c_minor_surg", label: "Cirurgia menor planejada" },
      { id: "c_obesity", label: "IMC > 25" },
      { id: "c_edema", label: "Edema de MMII" },
      { id: "c_varicose", label: "Veias varicosas" },
      { id: "c_pregnant", label: "Gravidez ou pós-parto (< 1 mês)" },
      { id: "c_miscarriage", label: "Aborto recorrente inexplicado" },
      { id: "c_aco", label: "Uso de ACO ou TRH" },
      { id: "c_sepsis", label: "Sepse (< 1 mês)" },
      { id: "c_pneumonia", label: "Doença pulmonar grave (incluindo pneumonia < 1 mês)" },
      { id: "c_pft_abnormal", label: "Função pulmonar anormal (DPOC)" },
      { id: "c_ami", label: "IAM atual" },
      { id: "c_chf", label: "ICC (atual)" },
      { id: "c_ibd", label: "Doença inflamatória intestinal" },
      { id: "c_bed_rest", label: "Repouso no leito" },
    ],
  },
  {
    title: "2 pontos cada",
    points: 2,
    items: [
      { id: "c_age61_74", label: "Idade 61-74 anos" },
      { id: "c_arthroscopy", label: "Cirurgia artroscópica" },
      { id: "c_major_surg", label: "Cirurgia aberta (> 45 min)" },
      { id: "c_laparoscopy", label: "Cirurgia laparoscópica (> 45 min)" },
      { id: "c_malignancy", label: "Neoplasia maligna" },
      { id: "c_bed72", label: "Confinamento ao leito (> 72h)" },
      { id: "c_cast", label: "Imobilização com gesso" },
      { id: "c_cvc", label: "Acesso venoso central" },
    ],
  },
  {
    title: "3 pontos cada",
    points: 3,
    items: [
      { id: "c_age75", label: "Idade ≥ 75 anos" },
      { id: "c_dvt_hx", label: "Histórico de TVP/TEP" },
      { id: "c_family", label: "Histórico familiar de TEV" },
      { id: "c_leiden", label: "Fator V Leiden positivo" },
      { id: "c_prothrombin", label: "Mutação protrombina 20210A" },
      { id: "c_lupus", label: "Anticoagulante lúpico positivo" },
      { id: "c_anticardio", label: "Anticorpos anticardiolipina" },
      { id: "c_homocyst", label: "Homocisteína sérica elevada" },
      { id: "c_hit", label: "HIT (Trombocitopenia induzida por heparina)" },
      { id: "c_thrombophilia", label: "Outra trombofilia congênita ou adquirida" },
    ],
  },
  {
    title: "5 pontos cada",
    points: 5,
    items: [
      { id: "c_stroke", label: "AVC (< 1 mês)" },
      { id: "c_arthroplasty", label: "Artroplastia eletiva de MMII" },
      { id: "c_hip_fracture", label: "Fratura de quadril, pelve ou MMII" },
      { id: "c_spinal_injury", label: "Lesão medular aguda (< 1 mês)" },
      { id: "c_polytrauma", label: "Politrauma (< 1 mês)" },
    ],
  },
];

// ──────────────────────────────────────────────
// BLEEDING RISK FACTORS (contraindications)
// ──────────────────────────────────────────────
const BLEEDING_FACTORS = [
  { id: "b_active_bleed", label: "Sangramento ativo", major: true },
  { id: "b_platelets", label: "Plaquetas < 50.000/mm³", major: true },
  { id: "b_uncontrolled_htn", label: "HAS grave não controlada (PA > 180/110)", major: true },
  { id: "b_coagulopathy", label: "Coagulopatia (INR > 1,5 ou TTPa > 2x)", major: true },
  { id: "b_intracranial", label: "Hemorragia intracraniana recente (< 3 meses)", major: true },
  { id: "b_lumbar", label: "Punção lombar/anestesia neuroaxial (< 12h)", major: true },
  { id: "b_liver_failure", label: "Insuficiência hepática grave", major: false },
  { id: "b_peptic_ulcer", label: "Úlcera péptica ativa", major: false },
  { id: "b_renal", label: "Insuficiência renal grave (ClCr < 30 mL/min)", major: false },
  { id: "b_antiplatelet", label: "Uso concomitante de antiagregantes", major: false },
  { id: "b_weight_low", label: "Peso < 40 kg", major: false },
  { id: "b_recent_surgery", label: "Cirurgia de alto risco de sangramento (< 24h)", major: false },
];

// ──────────────────────────────────────────────
// RECOMMENDATIONS
// ──────────────────────────────────────────────
function getPaduaRiskLevel(score: number) {
  if (score >= 4) return { level: "alto", label: "ALTO RISCO", color: "destructive" as const, description: "≥ 4 pontos — Profilaxia farmacológica recomendada" };
  return { level: "baixo", label: "BAIXO RISCO", color: "secondary" as const, description: "< 4 pontos — Deambulação precoce e reavaliação diária" };
}

function getCapriniRiskLevel(score: number) {
  if (score >= 5) return { level: "muito_alto", label: "MUITO ALTO", color: "destructive" as const, description: "≥ 5 pontos — Profilaxia farmacológica + mecânica" };
  if (score >= 3) return { level: "alto", label: "ALTO", color: "destructive" as const, description: "3-4 pontos — Profilaxia farmacológica recomendada" };
  if (score >= 2) return { level: "moderado", label: "MODERADO", color: "default" as const, description: "2 pontos — Profilaxia farmacológica ou mecânica" };
  return { level: "baixo", label: "BAIXO", color: "secondary" as const, description: "0-1 ponto — Deambulação precoce" };
}

function getRecommendation(scoreType: "padua" | "caprini", score: number, hasBleedingRisk: boolean, hasMajorBleedingRisk: boolean) {
  const isHighRisk = scoreType === "padua" ? score >= 4 : score >= 2;
  
  if (!isHighRisk) {
    return {
      pharmacological: null,
      mechanical: "Deambulação precoce",
      notes: "Risco trombótico baixo. Reavaliar em caso de mudança clínica.",
    };
  }

  if (hasMajorBleedingRisk) {
    return {
      pharmacological: "CONTRAINDICADA — Risco de sangramento maior",
      mechanical: "Compressão pneumática intermitente (CPI) + Meias elásticas de compressão graduada (MECG)",
      notes: "Profilaxia farmacológica contraindicada. Usar exclusivamente profilaxia mecânica. Reavaliar diariamente a possibilidade de iniciar profilaxia farmacológica.",
    };
  }

  if (hasBleedingRisk) {
    return {
      pharmacological: "Avaliar risco-benefício individualmente — considerar dose reduzida",
      mechanical: "Compressão pneumática intermitente (CPI) como adjuvante",
      notes: "Presença de fatores de risco para sangramento. Considerar início com profilaxia mecânica e transição para farmacológica quando seguro.",
    };
  }

  const meds = scoreType === "padua"
    ? "Enoxaparina 40 mg SC 1x/dia OU Heparina não fracionada 5.000 UI SC 8/8h ou 12/12h"
    : score >= 5
      ? "Enoxaparina 40 mg SC 1x/dia + CPI (profilaxia combinada)"
      : "Enoxaparina 40 mg SC 1x/dia OU Heparina não fracionada 5.000 UI SC 8/8h";

  return {
    pharmacological: meds,
    mechanical: score >= 5 ? "CPI + MECG (combinada com farmacológica)" : "Adjuvante: CPI se disponível",
    notes: scoreType === "padua"
      ? "Manter profilaxia durante período de imobilização. Ajustar dose para função renal."
      : "Manter profilaxia por 7-10 dias ou até deambulação plena. Estender para 28 dias em cirurgia oncológica abdominal/pélvica.",
  };
}

// ──────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────
interface TevProtocolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: { name: string; age?: string; bed?: string; sector?: string; weight?: string } | null;
}

export function TevProtocolDialog({ open, onOpenChange, patient }: TevProtocolDialogProps) {
  const [scoreType, setScoreType] = useState<"padua" | "caprini">("padua");
  const [selectedFactors, setSelectedFactors] = useState<Set<string>>(new Set());
  const [bleedingFactors, setBleedingFactors] = useState<Set<string>>(new Set());
  const [observations, setObservations] = useState("");
  const [step, setStep] = useState<"score" | "bleeding" | "result">("score");

  const toggleFactor = (id: string, set: "risk" | "bleeding") => {
    const target = set === "risk" ? selectedFactors : bleedingFactors;
    const setter = set === "risk" ? setSelectedFactors : setBleedingFactors;
    const next = new Set(target);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  // Pádua Score
  const paduaScore = useMemo(() => {
    return PADUA_FACTORS.reduce((sum, f) => sum + (selectedFactors.has(f.id) ? f.points : 0), 0);
  }, [selectedFactors]);

  // Caprini Score
  const capriniScore = useMemo(() => {
    return CAPRINI_SECTIONS.reduce((sum, section) => {
      return sum + section.items.reduce((s, item) => s + (selectedFactors.has(item.id) ? section.points : 0), 0);
    }, 0);
  }, [selectedFactors]);

  const currentScore = scoreType === "padua" ? paduaScore : capriniScore;
  const riskLevel = scoreType === "padua" ? getPaduaRiskLevel(paduaScore) : getCapriniRiskLevel(capriniScore);

  const hasMajorBleedingRisk = useMemo(() => {
    return BLEEDING_FACTORS.some(f => f.major && bleedingFactors.has(f.id));
  }, [bleedingFactors]);

  const hasAnyBleedingRisk = bleedingFactors.size > 0;

  const recommendation = useMemo(() => {
    return getRecommendation(scoreType, currentScore, hasAnyBleedingRisk, hasMajorBleedingRisk);
  }, [scoreType, currentScore, hasAnyBleedingRisk, hasMajorBleedingRisk]);

  const handleReset = () => {
    setSelectedFactors(new Set());
    setBleedingFactors(new Set());
    setObservations("");
    setStep("score");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const selectedRiskFactors = scoreType === "padua"
      ? PADUA_FACTORS.filter(f => selectedFactors.has(f.id))
      : CAPRINI_SECTIONS.flatMap(s => s.items.filter(i => selectedFactors.has(i.id)).map(i => ({ ...i, points: s.points })));

    const selectedBleedingFactors = BLEEDING_FACTORS.filter(f => bleedingFactors.has(f.id));

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Protocolo TEV</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { font-size: 9pt; color: #1a1a1a; padding: 8mm; }
        .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 6px; margin-bottom: 10px; }
        .header h1 { font-size: 14pt; color: #1e40af; }
        .header p { font-size: 8pt; color: #666; }
        .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f1f5f9; padding: 8px; border-radius: 4px; margin-bottom: 10px; font-size: 8.5pt; }
        .patient-info span { font-weight: bold; }
        .section { margin-bottom: 10px; }
        .section h2 { font-size: 10pt; color: #1e40af; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 6px; }
        .score-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 11pt; color: white; }
        .score-high { background: #dc2626; }
        .score-moderate { background: #f59e0b; }
        .score-low { background: #22c55e; }
        .factors-list { list-style: none; padding: 0; }
        .factors-list li { padding: 2px 0; font-size: 8.5pt; display: flex; align-items: center; gap: 4px; }
        .factors-list li::before { content: "✓"; color: #1e40af; font-weight: bold; }
        .bleeding li::before { content: "⚠"; color: #dc2626; }
        .recommendation-box { border: 2px solid #1e40af; border-radius: 6px; padding: 10px; margin-top: 8px; }
        .rec-row { display: flex; gap: 6px; margin-bottom: 4px; font-size: 8.5pt; }
        .rec-label { font-weight: bold; min-width: 120px; color: #1e40af; }
        .contra { color: #dc2626; font-weight: bold; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; padding-top: 10px; }
        .sig-line { border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 8pt; }
        .obs { border: 1px solid #ddd; padding: 6px; border-radius: 4px; min-height: 40px; font-size: 8.5pt; white-space: pre-wrap; }
        .date-line { text-align: right; font-size: 8pt; color: #666; margin-top: 6px; }
      </style></head><body>
      <div class="header">
        <h1>PROTOCOLO DE PREVENÇÃO DE TROMBOEMBOLISMO VENOSO (TEV)</h1>
        <p>Escala: ${scoreType === "padua" ? "Escore de Pádua (Pacientes Clínicos)" : "Escore de Caprini (Pacientes Cirúrgicos)"}</p>
      </div>

      <div class="patient-info">
        <div><span>Paciente:</span> ${patient?.name || "—"}</div>
        <div><span>Idade:</span> ${patient?.age || "—"}</div>
        <div><span>Leito:</span> ${patient?.bed || "—"}</div>
        <div><span>Peso:</span> ${patient?.weight || "—"} kg</div>
      </div>

      <div class="section">
        <h2>Classificação de Risco Trombótico</h2>
        <p>Pontuação: <span class="score-badge ${riskLevel.level === "baixo" ? "score-low" : riskLevel.level === "moderado" ? "score-moderate" : "score-high"}">${currentScore} pts — ${riskLevel.label}</span></p>
        <p style="font-size:8pt;color:#666;margin-top:3px;">${riskLevel.description}</p>
      </div>

      <div class="section">
        <h2>Fatores de Risco Identificados</h2>
        <ul class="factors-list">
          ${selectedRiskFactors.map((f: any) => `<li>${f.label} (${f.points || ""}pt${(f.points || 0) > 1 ? "s" : ""})</li>`).join("")}
          ${selectedRiskFactors.length === 0 ? "<li style='color:#999'>Nenhum fator identificado</li>" : ""}
        </ul>
      </div>

      ${selectedBleedingFactors.length > 0 ? `
      <div class="section">
        <h2>Fatores de Risco de Sangramento</h2>
        <ul class="factors-list bleeding">
          ${selectedBleedingFactors.map(f => `<li>${f.label}${f.major ? " (MAIOR)" : ""}</li>`).join("")}
        </ul>
      </div>` : ""}

      <div class="section">
        <h2>Recomendação de Profilaxia</h2>
        <div class="recommendation-box">
          <div class="rec-row"><span class="rec-label">Farmacológica:</span> <span class="${hasMajorBleedingRisk ? "contra" : ""}">${recommendation.pharmacological || "Não indicada"}</span></div>
          <div class="rec-row"><span class="rec-label">Mecânica:</span> ${recommendation.mechanical}</div>
          <div class="rec-row"><span class="rec-label">Observações:</span> ${recommendation.notes}</div>
        </div>
      </div>

      ${observations ? `
      <div class="section">
        <h2>Observações Adicionais</h2>
        <div class="obs">${observations}</div>
      </div>` : ""}

      <div class="date-line">Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>

      <div class="signatures">
        <div class="sig-line">Médico Prescritor<br/><small>CRM / Assinatura</small></div>
        <div class="sig-line">Enfermeiro Responsável<br/><small>COREN / Assinatura</small></div>
      </div>

      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-blue-600" />
            Protocolo TEV — Prevenção de Tromboembolismo Venoso
          </DialogTitle>
          <DialogDescription className="text-xs">
            {patient?.name && (
              <span className="font-medium text-foreground">
                {patient.name} {patient.age && `· ${patient.age}`} {patient.bed && `· Leito ${patient.bed}`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Score type selector */}
        <div className="px-6 pb-2">
          <Tabs value={scoreType} onValueChange={(v) => { setScoreType(v as "padua" | "caprini"); setSelectedFactors(new Set()); setStep("score"); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="padua" className="text-xs">
                <Heart className="h-3.5 w-3.5 mr-1.5" /> Pádua (Clínico)
              </TabsTrigger>
              <TabsTrigger value="caprini" className="text-xs">
                <Activity className="h-3.5 w-3.5 mr-1.5" /> Caprini (Cirúrgico)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Progress indicator */}
        <div className="px-6 pb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <button onClick={() => setStep("score")} className={cn("flex items-center gap-1 px-2 py-1 rounded", step === "score" ? "bg-blue-100 text-blue-700 font-medium" : "hover:text-foreground")}>
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
            Risco Trombótico
          </button>
          <ChevronRight className="h-3 w-3" />
          <button onClick={() => setStep("bleeding")} className={cn("flex items-center gap-1 px-2 py-1 rounded", step === "bleeding" ? "bg-orange-100 text-orange-700 font-medium" : "hover:text-foreground")}>
            <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[10px]", step !== "score" ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground")}>2</span>
            Risco Sangramento
          </button>
          <ChevronRight className="h-3 w-3" />
          <button onClick={() => setStep("result")} className={cn("flex items-center gap-1 px-2 py-1 rounded", step === "result" ? "bg-green-100 text-green-700 font-medium" : "hover:text-foreground")}>
            <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[10px]", step === "result" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground")}>3</span>
            Conduta
          </button>

          {/* Live score */}
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={riskLevel.color} className="text-[10px]">
              {currentScore} pts — {riskLevel.label}
            </Badge>
          </div>
        </div>

        <Separator />

        <ScrollArea className="flex-1 max-h-[55vh]">
          <div className="px-6 py-4 space-y-4">

            {/* ── STEP 1: Risk score ── */}
            {step === "score" && scoreType === "padua" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Selecione todos os fatores de risco presentes. Escore ≥ 4 = Alto risco.
                </p>
                {PADUA_FACTORS.map((factor) => (
                  <label
                    key={factor.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedFactors.has(factor.id)
                        ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30"
                        : "border-border hover:bg-accent/50"
                    )}
                  >
                    <Checkbox
                      checked={selectedFactors.has(factor.id)}
                      onCheckedChange={() => toggleFactor(factor.id, "risk")}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{factor.label}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{factor.points} pt{factor.points > 1 ? "s" : ""}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{factor.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {step === "score" && scoreType === "caprini" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Selecione todos os fatores aplicáveis. O escore total determina o nível de risco.
                </p>
                {CAPRINI_SECTIONS.map((section) => (
                  <div key={section.title} className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      {section.title}
                      <Badge variant="outline" className="text-[10px]">{section.points} pt{section.points > 1 ? "s" : ""} cada</Badge>
                    </h3>
                    <div className="grid gap-1.5">
                      {section.items.map((item) => (
                        <label
                          key={item.id}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors",
                            selectedFactors.has(item.id)
                              ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30"
                              : "border-border hover:bg-accent/50"
                          )}
                        >
                          <Checkbox
                            checked={selectedFactors.has(item.id)}
                            onCheckedChange={() => toggleFactor(item.id, "risk")}
                          />
                          <span className="text-sm">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── STEP 2: Bleeding risk ── */}
            {step === "bleeding" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  Avalie contraindic ações à profilaxia farmacológica. Fatores "maiores" contraindicam o uso de anticoagulantes.
                </p>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider">Contraindicações Maiores</h3>
                  {BLEEDING_FACTORS.filter(f => f.major).map((factor) => (
                    <label
                      key={factor.id}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors",
                        bleedingFactors.has(factor.id)
                          ? "border-red-300 bg-red-50 dark:bg-red-950/30"
                          : "border-border hover:bg-accent/50"
                      )}
                    >
                      <Checkbox
                        checked={bleedingFactors.has(factor.id)}
                        onCheckedChange={() => toggleFactor(factor.id, "bleeding")}
                      />
                      <span className="text-sm">{factor.label}</span>
                      <Badge variant="destructive" className="text-[10px] ml-auto">MAIOR</Badge>
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Fatores de Risco Adicionais</h3>
                  {BLEEDING_FACTORS.filter(f => !f.major).map((factor) => (
                    <label
                      key={factor.id}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors",
                        bleedingFactors.has(factor.id)
                          ? "border-orange-300 bg-orange-50 dark:bg-orange-950/30"
                          : "border-border hover:bg-accent/50"
                      )}
                    >
                      <Checkbox
                        checked={bleedingFactors.has(factor.id)}
                        onCheckedChange={() => toggleFactor(factor.id, "bleeding")}
                      />
                      <span className="text-sm">{factor.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 3: Result ── */}
            {step === "result" && (
              <div className="space-y-4">
                {/* Score summary */}
                <div className={cn(
                  "p-4 rounded-lg border-2",
                  riskLevel.level === "baixo" ? "border-green-200 bg-green-50 dark:bg-green-950/20" :
                  riskLevel.level === "moderado" ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20" :
                  "border-red-200 bg-red-50 dark:bg-red-950/20"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">
                      {scoreType === "padua" ? "Escore de Pádua" : "Escore de Caprini"}
                    </span>
                    <Badge variant={riskLevel.color} className="text-sm px-3">
                      {currentScore} pontos — {riskLevel.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{riskLevel.description}</p>
                </div>

                {/* Bleeding alert */}
                {hasMajorBleedingRisk && (
                  <div className="p-3 rounded-lg bg-red-100 border border-red-300 flex items-start gap-2 dark:bg-red-950/40">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Profilaxia farmacológica CONTRAINDICADA</p>
                      <p className="text-xs text-red-600 mt-0.5">Presença de contraindicação maior ao uso de anticoagulantes. Utilizar exclusivamente profilaxia mecânica.</p>
                    </div>
                  </div>
                )}

                {hasAnyBleedingRisk && !hasMajorBleedingRisk && (
                  <div className="p-3 rounded-lg bg-orange-100 border border-orange-300 flex items-start gap-2 dark:bg-orange-950/40">
                    <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-orange-700">Atenção: Fatores de risco de sangramento presentes</p>
                      <p className="text-xs text-orange-600 mt-0.5">Avaliar risco-benefício individualmente antes de iniciar profilaxia farmacológica.</p>
                    </div>
                  </div>
                )}

                {/* Recommendation */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Conduta Recomendada
                  </h3>

                  <div className="grid gap-3">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20">
                      <Label className="text-xs text-blue-700 font-semibold">Profilaxia Farmacológica</Label>
                      <p className={cn("text-sm mt-1", hasMajorBleedingRisk ? "text-red-600 font-semibold" : "text-foreground")}>
                        {recommendation.pharmacological || "Não indicada para este nível de risco"}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/20">
                      <Label className="text-xs text-green-700 font-semibold">Profilaxia Mecânica</Label>
                      <p className="text-sm mt-1">{recommendation.mechanical}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted border">
                      <Label className="text-xs text-muted-foreground font-semibold">Notas Clínicas</Label>
                      <p className="text-sm mt-1">{recommendation.notes}</p>
                    </div>
                  </div>
                </div>

                {/* Observations */}
                <div>
                  <Label className="text-xs font-semibold">Observações Adicionais</Label>
                  <Textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Observações clínicas adicionais..."
                    className="mt-1 text-sm min-h-[60px]"
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <div className="px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs gap-1.5">
            <RotateCw className="h-3.5 w-3.5" /> Limpar
          </Button>

          <div className="flex items-center gap-2">
            {step === "score" && (
              <Button size="sm" onClick={() => setStep("bleeding")} className="text-xs gap-1.5">
                Avaliar Sangramento <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === "bleeding" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setStep("score")} className="text-xs">Voltar</Button>
                <Button size="sm" onClick={() => setStep("result")} className="text-xs gap-1.5">
                  Ver Conduta <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {step === "result" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setStep("bleeding")} className="text-xs">Voltar</Button>
                <Button size="sm" onClick={handlePrint} className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700">
                  <Printer className="h-3.5 w-3.5" /> Imprimir Protocolo
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
