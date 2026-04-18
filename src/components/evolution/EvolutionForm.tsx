import React, { useState, useMemo } from "react";
import {
  Heart, User, Stethoscope, ClipboardList, FileText,
  Save, Loader2, CheckCircle2,
  ShieldCheck, Printer, Sparkles, ChevronLeft, ChevronRight,
  AlertCircle, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ExaminusAIDialog } from "@/components/ExaminusAIDialog";
import { cn } from "@/lib/utils";
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";

interface SOAPData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface VitalSigns {
  pa: string; fc: string; fr: string; temp: string;
  spo2: string; glasgow: string; diurese: string; dor: string;
}

interface PhysicalExam {
  general: string; cardiovascular: string; respiratory: string;
  abdomen: string; neurological: string; extremities: string;
  skin: string; other: string;
}

interface EvolutionFormProps {
  soap: SOAPData;
  vitals: VitalSigns;
  physicalExam: PhysicalExam;
  onSOAPChange: (key: keyof SOAPData, value: string) => void;
  onVitalsChange: (key: keyof VitalSigns, value: string) => void;
  onPhysicalExamChange: (key: keyof PhysicalExam, value: string) => void;
  onSave: () => void;
  onValidate?: () => void;
  saving: boolean;
  readOnly?: boolean;
  isValidated?: boolean;
}

type StepKey = 'vitals' | 'subjective' | 'objective' | 'assessment' | 'plan' | 'review';

const STEPS: { key: StepKey; label: string; shortLabel: string; icon: any; required: boolean; description: string }[] = [
  { key: 'vitals', label: 'Sinais Vitais', shortLabel: 'SV', icon: Heart, required: false, description: 'Aferições do paciente' },
  { key: 'subjective', label: 'Subjetivo', shortLabel: 'S', icon: User, required: true, description: 'Queixas do paciente, relato do acompanhante' },
  { key: 'objective', label: 'Objetivo', shortLabel: 'O', icon: Stethoscope, required: true, description: 'Exame físico, sinais vitais, dados laboratoriais' },
  { key: 'assessment', label: 'Avaliação', shortLabel: 'A', icon: ClipboardList, required: true, description: 'Diagnóstico diferencial, avaliação clínica' },
  { key: 'plan', label: 'Plano', shortLabel: 'P', icon: FileText, required: true, description: 'Condutas, solicitações, ajustes terapêuticos' },
  { key: 'review', label: 'Revisão', shortLabel: '✓', icon: Eye, required: false, description: 'Revisar e assinar' },
];

const VITAL_FIELDS = [
  { key: 'pa' as const, label: 'PA', placeholder: '120/80', unit: 'mmHg' },
  { key: 'fc' as const, label: 'FC', placeholder: '78', unit: 'bpm' },
  { key: 'fr' as const, label: 'FR', placeholder: '18', unit: 'irpm' },
  { key: 'temp' as const, label: 'Tax', placeholder: '36.5', unit: '°C' },
  { key: 'spo2' as const, label: 'SpO₂', placeholder: '96', unit: '%' },
  { key: 'glasgow' as const, label: 'Glasgow', placeholder: '15', unit: '' },
  { key: 'diurese' as const, label: 'Diurese', placeholder: '1200', unit: 'mL/24h' },
  { key: 'dor' as const, label: 'Dor', placeholder: '0', unit: 'EVA' },
];

const EXAM_FIELDS = [
  { key: 'general' as const, label: 'Estado Geral' },
  { key: 'cardiovascular' as const, label: 'Cardiovascular' },
  { key: 'respiratory' as const, label: 'Respiratório' },
  { key: 'abdomen' as const, label: 'Abdome' },
  { key: 'neurological' as const, label: 'Neurológico' },
  { key: 'extremities' as const, label: 'Extremidades' },
  { key: 'skin' as const, label: 'Pele / Feridas' },
  { key: 'other' as const, label: 'Outros' },
];

export const EvolutionForm: React.FC<EvolutionFormProps> = ({
  soap, vitals, physicalExam,
  onSOAPChange, onVitalsChange, onPhysicalExamChange,
  onSave, onValidate, saving, readOnly = false, isValidated = false,
}) => {
  const [currentStep, setCurrentStep] = useState<StepKey>('vitals');
  const [examinusOpen, setExaminusOpen] = useState(false);

  // Calculate completion status for each step
  const completion = useMemo(() => {
    const vitalsCount = Object.values(vitals).filter(v => v.trim()).length;
    const examCount = Object.values(physicalExam).filter(v => v.trim()).length;
    return {
      vitals: vitalsCount >= 3, // at least 3 vitals
      subjective: soap.subjective.trim().length >= 10,
      objective: soap.objective.trim().length >= 10 || examCount >= 1,
      assessment: soap.assessment.trim().length >= 10,
      plan: soap.plan.trim().length >= 10,
      review: false,
    };
  }, [soap, vitals, physicalExam]);

  const requiredComplete = completion.subjective && completion.objective && completion.assessment && completion.plan;

  const handleImportExams = (newExams: string[]) => {
    const current = soap.objective?.trim() || "";
    const block = newExams.filter(Boolean).join("\n");
    const merged = current ? `${current}\n${block}` : block;
    onSOAPChange('objective', merged);
  };

  const currentIdx = STEPS.findIndex(s => s.key === currentStep);
  const goPrev = () => currentIdx > 0 && setCurrentStep(STEPS[currentIdx - 1].key);
  const goNext = () => currentIdx < STEPS.length - 1 && setCurrentStep(STEPS[currentIdx + 1].key);

  // Read-only mode shows everything stacked (no stepper)
  if (readOnly) {
    return (
      <div className="space-y-3">
        <ReadOnlyView soap={soap} vitals={vitals} physicalExam={physicalExam} />
        {isValidated && (
          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={async () => {
              const logo = await prepareLogo();
              const escape = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
              const vitalsRow = [
                vitals.pa && `PA ${vitals.pa}`, vitals.fc && `FC ${vitals.fc}`, vitals.fr && `FR ${vitals.fr}`,
                vitals.temp && `T ${vitals.temp}°C`, vitals.spo2 && `SpO₂ ${vitals.spo2}%`,
                vitals.glasgow && `Glasgow ${vitals.glasgow}`, vitals.diurese && `Diurese ${vitals.diurese} mL/24h`,
                vitals.dor && `Dor ${vitals.dor}`,
              ].filter(Boolean).join(" • ");
              const examRows = EXAM_FIELDS.filter(f => physicalExam[f.key])
                .map(f => `<tr><th style="width:130px">${f.label}</th><td>${escape(physicalExam[f.key])}</td></tr>`).join("");
              const bodyHtml = `
                <h2 class="nz-section">SOAP</h2>
                <table class="nz">
                  <tr><th style="width:60px">S</th><td>${escape(soap.subjective) || "<em>—</em>"}</td></tr>
                  <tr><th>O</th><td>${escape(soap.objective) || "<em>—</em>"}</td></tr>
                  <tr><th>A</th><td>${escape(soap.assessment) || "<em>—</em>"}</td></tr>
                  <tr><th>P</th><td>${escape(soap.plan) || "<em>—</em>"}</td></tr>
                </table>
                ${vitalsRow ? `<h2 class="nz-section">Sinais Vitais</h2><div style="padding:6pt 8pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:9pt">${vitalsRow}</div>` : ""}
                ${examRows ? `<h2 class="nz-section">Exame Físico</h2><table class="nz"><tbody>${examRows}</tbody></table>` : ""}
              `;
              const html = buildNormaZeroDocument({
                title: "Evolução Clínica", subtitle: "Registro SOAP",
                sectorLabel: "Assistência Médica", docCodePrefix: "EVOL", bodyHtml,
                logoDataUrl: logo, signatures: [{ label: "Médico Assistente", caption: "CRM e assinatura" }],
              });
              openPrintWindow(html, "Preparando evolução…");
            }}>
              <Printer className="h-3.5 w-3.5" /> Imprimir Evolução
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stepper Header */}
      <div className="rounded-xl border border-border bg-card p-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = step.key === currentStep;
            const isComplete = completion[step.key];
            const isReview = step.key === 'review';
            const reviewReady = isReview && requiredComplete;
            return (
              <React.Fragment key={step.key}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(step.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0",
                    isActive && "bg-primary text-primary-foreground shadow-sm",
                    !isActive && isComplete && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20",
                    !isActive && !isComplete && !reviewReady && "text-muted-foreground hover:bg-muted/50",
                    !isActive && reviewReady && "bg-primary/10 text-primary hover:bg-primary/20",
                  )}
                  title={step.description}
                >
                  <span className={cn(
                    "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0",
                    isActive && "bg-primary-foreground/20",
                    !isActive && isComplete && "bg-emerald-500 text-white",
                    !isActive && !isComplete && "bg-muted text-muted-foreground",
                  )}>
                    {isComplete ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </span>
                  <span className="hidden md:inline">{step.label}</span>
                  <span className="md:hidden">{step.shortLabel}</span>
                  {step.required && !isComplete && !isActive && (
                    <span className="text-amber-500 text-[10px]">*</span>
                  )}
                </button>
                {idx < STEPS.length - 1 && (
                  <div className={cn(
                    "h-px w-3 shrink-0 transition-colors",
                    completion[step.key] ? "bg-emerald-500/40" : "bg-border"
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {currentStep === 'vitals' && (
          <div>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-emerald-500/5">
              <Heart className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-semibold">Sinais Vitais</span>
              <span className="text-[10px] text-muted-foreground">— ao menos 3 aferições recomendadas</span>
            </div>
            <div className="p-3 grid grid-cols-4 md:grid-cols-8 gap-2">
              {VITAL_FIELDS.map(v => (
                <div key={v.key}>
                  <Label className="text-[9px] text-muted-foreground">{v.label}</Label>
                  <div className="relative">
                    <Input
                      value={vitals[v.key]}
                      onChange={e => onVitalsChange(v.key, e.target.value)}
                      placeholder={v.placeholder}
                      className="h-7 text-xs pr-8"
                    />
                    {v.unit && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">{v.unit}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'subjective' && (
          <StepTextarea
            label="Subjetivo"
            icon={User}
            iconColor="text-blue-500"
            bgColor="bg-blue-500/5"
            description="Queixas do paciente, relato do acompanhante, evolução percebida desde último plantão"
            value={soap.subjective}
            onChange={v => onSOAPChange('subjective', v)}
            minLength={10}
          />
        )}

        {currentStep === 'objective' && (
          <div>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-emerald-500/5">
              <Stethoscope className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-semibold">Objetivo — Exame Físico + Complementares</span>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold tracking-wider mb-2">EXAME FÍSICO POR SISTEMA</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {EXAM_FIELDS.map(exam => (
                    <div key={exam.key}>
                      <Label className="text-[10px] text-muted-foreground">{exam.label}</Label>
                      <Input
                        value={physicalExam[exam.key]}
                        onChange={e => onPhysicalExamChange(exam.key, e.target.value)}
                        placeholder={`${exam.label}...`}
                        className="h-7 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[10px] text-muted-foreground font-semibold tracking-wider">
                    EXAMES COMPLEMENTARES (laboratoriais e de imagem)
                  </Label>
                  <Button
                    type="button" size="sm" variant="outline"
                    onClick={() => setExaminusOpen(true)}
                    className="h-6 gap-1 text-[10px] border-primary/40 text-primary hover:bg-primary/10"
                    title="Importar exames com Examinus AI"
                  >
                    <Sparkles className="h-3 w-3" />
                    Examinus AI
                  </Button>
                </div>
                <Textarea
                  value={soap.objective}
                  onChange={e => onSOAPChange('objective', e.target.value)}
                  placeholder="Cole resultados laboratoriais ou de imagem, ou use o Examinus AI para extrair automaticamente..."
                  className="min-h-[120px] text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 'assessment' && (
          <StepTextarea
            label="Avaliação"
            icon={ClipboardList}
            iconColor="text-amber-500"
            bgColor="bg-amber-500/5"
            description="Diagnóstico diferencial, avaliação clínica do caso, hipóteses ativas"
            value={soap.assessment}
            onChange={v => onSOAPChange('assessment', v)}
            minLength={10}
          />
        )}

        {currentStep === 'plan' && (
          <StepTextarea
            label="Plano"
            icon={FileText}
            iconColor="text-purple-500"
            bgColor="bg-purple-500/5"
            description="Condutas, solicitações, ajustes terapêuticos, metas para próximas 24h"
            value={soap.plan}
            onChange={v => onSOAPChange('plan', v)}
            minLength={10}
          />
        )}

        {currentStep === 'review' && (
          <div>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-primary/5">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">Revisão Final</span>
              {requiredComplete ? (
                <span className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Pronto para validar
                </span>
              ) : (
                <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Seções obrigatórias incompletas
                </span>
              )}
            </div>
            <div className="p-3 space-y-3">
              {!requiredComplete && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1">
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> Pendências para validação
                  </p>
                  <ul className="text-[11px] text-amber-700/80 dark:text-amber-400/80 space-y-0.5 ml-5 list-disc">
                    {!completion.subjective && <li>Preencher <strong>Subjetivo</strong> (mín. 10 caracteres)</li>}
                    {!completion.objective && <li>Preencher <strong>Objetivo</strong> — exame físico ou complementares</li>}
                    {!completion.assessment && <li>Preencher <strong>Avaliação</strong> (mín. 10 caracteres)</li>}
                    {!completion.plan && <li>Preencher <strong>Plano</strong> (mín. 10 caracteres)</li>}
                  </ul>
                </div>
              )}
              <ReadOnlyView soap={soap} vitals={vitals} physicalExam={physicalExam} />
            </div>
          </div>
        )}
      </div>

      {/* Navigation + Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          className="gap-1 text-xs"
          onClick={goPrev}
          disabled={currentIdx === 0}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Anterior
        </Button>
        <span className="text-[10px] text-muted-foreground">
          Etapa {currentIdx + 1} de {STEPS.length}
        </span>
        <div className="flex-1" />
        <Button
          variant="outline" size="sm"
          className="gap-1.5 text-xs"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar Rascunho
        </Button>
        {currentStep === 'review' && onValidate && !isValidated ? (
          <Button
            size="sm"
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            onClick={onValidate}
            disabled={!requiredComplete}
            title={!requiredComplete ? "Preencha todas as seções obrigatórias" : "Validar e assinar evolução"}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Validar e Assinar
          </Button>
        ) : (
          <Button
            size="sm"
            className="gap-1 text-xs"
            onClick={goNext}
            disabled={currentIdx === STEPS.length - 1}
          >
            Próximo <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <ExaminusAIDialog
        open={examinusOpen}
        onOpenChange={setExaminusOpen}
        currentExams={soap.objective ? soap.objective.split("\n").filter(Boolean) : []}
        onImportExams={handleImportExams}
      />
    </div>
  );
};

// ---- Sub-components ----

const StepTextarea: React.FC<{
  label: string;
  icon: any;
  iconColor: string;
  bgColor: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  minLength: number;
}> = ({ label, icon: Icon, iconColor, bgColor, description, value, onChange, minLength }) => {
  const filled = value.trim().length >= minLength;
  return (
    <div>
      <div className={cn("flex items-center gap-2 px-3 py-2 border-b border-border/50", bgColor)}>
        <Icon className={cn("h-3.5 w-3.5", iconColor)} />
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-[10px] text-muted-foreground hidden md:inline">— {description}</span>
        <span className={cn("ml-auto text-[10px]", filled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
          {value.trim().length}/{minLength}+ caracteres
        </span>
      </div>
      <div className="p-3">
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={description + '...'}
          className="min-h-[180px] text-xs"
          autoFocus
        />
      </div>
    </div>
  );
};

const ReadOnlyView: React.FC<{ soap: SOAPData; vitals: VitalSigns; physicalExam: PhysicalExam }> = ({ soap, vitals, physicalExam }) => {
  const hasVitals = Object.values(vitals).some(v => v.trim());
  const hasExam = Object.values(physicalExam).some(v => v.trim());
  return (
    <div className="space-y-2 text-xs leading-relaxed">
      {hasVitals && (
        <div className="rounded-lg border border-border bg-muted/30 p-2">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-wider mb-1">SINAIS VITAIS</p>
          <p className="text-foreground">
            {[
              vitals.pa && `PA ${vitals.pa}`, vitals.fc && `FC ${vitals.fc}`, vitals.fr && `FR ${vitals.fr}`,
              vitals.temp && `T ${vitals.temp}°C`, vitals.spo2 && `SpO₂ ${vitals.spo2}%`,
              vitals.glasgow && `Glasgow ${vitals.glasgow}`, vitals.diurese && `Diurese ${vitals.diurese}`,
              vitals.dor && `Dor ${vitals.dor}`,
            ].filter(Boolean).join(" • ")}
          </p>
        </div>
      )}
      {soap.subjective && (
        <div><strong className="text-blue-500">S — Subjetivo:</strong> <span className="text-foreground whitespace-pre-wrap">{soap.subjective}</span></div>
      )}
      {(hasExam || soap.objective) && (
        <div>
          <strong className="text-emerald-500">O — Objetivo:</strong>
          {hasExam && (
            <ul className="ml-4 mt-0.5 text-foreground/90 list-disc">
              {EXAM_FIELDS.filter(f => physicalExam[f.key]).map(f => (
                <li key={f.key}><span className="font-medium">{f.label}:</span> {physicalExam[f.key]}</li>
              ))}
            </ul>
          )}
          {soap.objective && <p className="mt-1 text-foreground whitespace-pre-wrap">{soap.objective}</p>}
        </div>
      )}
      {soap.assessment && (
        <div><strong className="text-amber-500">A — Avaliação:</strong> <span className="text-foreground whitespace-pre-wrap">{soap.assessment}</span></div>
      )}
      {soap.plan && (
        <div><strong className="text-purple-500">P — Plano:</strong> <span className="text-foreground whitespace-pre-wrap">{soap.plan}</span></div>
      )}
    </div>
  );
};
