import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Heart, NotebookPen, Stethoscope, FileText,
  Save, Loader2, CheckCircle2,
  ShieldCheck, Printer, Sparkles,
  AlertCircle, Eye, ChevronDown, Stethoscope as DiagnosisIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ExaminusAIDialog } from "@/components/ExaminusAIDialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";
import { FieldTemplates } from "@/components/FieldTemplates";
import { useHospital } from "@/contexts/HospitalContext";

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
  /** When true, the form auto-saves drafts (debounced) instead of relying on manual click. */
  autoSave?: boolean;
  /** Indicates a pending unsaved change (used to show "Não salvo" pill). */
  hasUnsaved?: boolean;
  /** Render slot for the Diagnostics panel — placed as 1st collapsible section. */
  diagnosticsSlot?: React.ReactNode;
}

type SectionKey = 'vitals' | 'evolucao' | 'objective' | 'plan' | 'review';

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
  autoSave = false, hasUnsaved = false,
  diagnosticsSlot,
}) => {
  const [examinusOpen, setExaminusOpen] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(['diagnostics', 'evolucao', 'complementares', 'plan']);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);
  const { currentHospital } = useHospital();
  const hospitalId = currentHospital?.id ?? null;

  // Texto unificado da Evolução = Subjetivo + Avaliação (concatenados para registros antigos).
  const evolucaoText = useMemo(() => {
    const s = (soap.subjective || "").trim();
    const a = (soap.assessment || "").trim();
    if (s && a) return `${s}\n\n${a}`;
    return s || a;
  }, [soap.subjective, soap.assessment]);

  const handleEvolucaoChange = (value: string) => {
    onSOAPChange('subjective', value);
    if (soap.assessment) onSOAPChange('assessment', '');
  };

  // Calculate completion status — apenas Evolução e Plano são obrigatórios.
  // Sinais vitais e exame físico foram removidos do formulário (médico relata dentro
  // do corpo da Evolução). Exames complementares permanecem como campo opcional.
  const completion = useMemo(() => ({
    evolucao: evolucaoText.trim().length >= 10,
    complementares: soap.objective.trim().length > 0,
    plan: soap.plan.trim().length >= 10,
  }), [soap.objective, soap.plan, evolucaoText]);

  const requiredComplete = completion.evolucao && completion.plan;

  const handleImportExams = (newExams: string[]) => {
    const current = soap.objective?.trim() || "";
    const block = newExams.filter(Boolean).join("\n");
    const merged = current ? `${current}\n${block}` : block;
    onSOAPChange('objective', merged);
  };

  // Autosave (debounced 2s) for editing existing drafts in Timeline
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!autoSave || readOnly || !hasUnsaved) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      onSave();
      setAutoSavedAt(new Date());
    }, 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [soap, vitals, physicalExam, autoSave, readOnly, hasUnsaved, onSave]);

  // Read-only mode shows everything stacked (no accordion)
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
              const evolucaoTxt = [soap.subjective, soap.assessment].map(t => (t || "").trim()).filter(Boolean).join("\n\n");
              const bodyHtml = `
                ${vitalsRow ? `<h2 class="nz-section">Sinais Vitais</h2><div style="padding:6pt 8pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:9pt">${vitalsRow}</div>` : ""}
                <h2 class="nz-section">Evolução</h2>
                <div style="padding:8pt 10pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:10pt;line-height:1.5">${escape(evolucaoTxt) || "<em>—</em>"}</div>
                ${examRows ? `<h2 class="nz-section">Exame Físico</h2><table class="nz"><tbody>${examRows}</tbody></table>` : ""}
                ${soap.objective?.trim() ? `<h2 class="nz-section">Exames Complementares</h2><div style="padding:8pt 10pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:10pt;line-height:1.5">${escape(soap.objective)}</div>` : ""}
                <h2 class="nz-section">Plano</h2>
                <div style="padding:8pt 10pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:10pt;line-height:1.5">${escape(soap.plan) || "<em>—</em>"}</div>
              `;
              const html = buildNormaZeroDocument({
                title: "Evolução Clínica", subtitle: "Registro de evolução",
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

  const expandAll = () => setOpenSections(['diagnostics', 'evolucao', 'complementares', 'plan', 'review']);
  const collapseAll = () => setOpenSections([]);

  return (
    <div className="space-y-3">
      {/* Toolbar: status + expand/collapse */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {requiredComplete ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3 w-3" /> Pronto para validar
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" /> Seções obrigatórias incompletas
            </span>
          )}
          {autoSave && hasUnsaved && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
              Salvando…
            </Badge>
          )}
          {autoSave && !hasUnsaved && autoSavedAt && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
              ✓ Salvo {autoSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={expandAll}>
            Expandir tudo
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={collapseAll}>
            Recolher tudo
          </Button>
        </div>
      </div>

      {/* Collapsible sections */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="rounded-xl border border-border bg-card divide-y divide-border"
      >
        {diagnosticsSlot && (
          <SectionItem
            id="diagnostics"
            icon={DiagnosisIcon}
            iconColor="text-primary"
            label="Diagnósticos"
            hint="CID-10, previsão de alta, paliativo, isolamento"
            complete={false}
            required={false}
          >
            {diagnosticsSlot}
          </SectionItem>
        )}
        <SectionItem
          id="evolucao"
          icon={NotebookPen}
          iconColor="text-blue-500"
          label="Evolução"
          hint="Relato clínico completo: sinais vitais, exame físico, queixas, hipóteses e avaliação"
          complete={completion.evolucao}
          required
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">
              {evolucaoText.trim().length}/10+ caracteres
            </span>
            <FieldTemplates
              scope="evolution.subjective"
              currentValue={evolucaoText}
              onApply={(v) => handleEvolucaoChange(v)}
              hospitalUnitId={hospitalId}
            />
          </div>
          <Textarea
            value={evolucaoText}
            onChange={e => handleEvolucaoChange(e.target.value)}
            placeholder="Relato clínico do plantão: sinais vitais relevantes, exame físico dirigido, queixas, evolução percebida, hipóteses diagnósticas, raciocínio clínico..."
            className="min-h-[220px] text-xs"
          />
        </SectionItem>

        <SectionItem
          id="complementares"
          icon={Stethoscope}
          iconColor="text-emerald-500"
          label="Exames Complementares"
          hint="Laboratoriais e de imagem (opcional)"
          complete={completion.complementares}
          required={false}
        >
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[10px] text-muted-foreground font-semibold tracking-wider">
              RESULTADOS LABORATORIAIS E DE IMAGEM
            </Label>
            <div className="flex items-center gap-1">
              <FieldTemplates
                scope="evolution.objective.complementares"
                currentValue={soap.objective}
                onApply={(v) => onSOAPChange('objective', v)}
                hospitalUnitId={hospitalId}
              />
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
          </div>
          <Textarea
            value={soap.objective}
            onChange={e => onSOAPChange('objective', e.target.value)}
            placeholder="Cole resultados laboratoriais ou de imagem, ou use o Examinus AI para extrair automaticamente..."
            className="min-h-[120px] text-xs"
          />
        </SectionItem>

        <SectionItem
          id="plan"
          icon={FileText}
          iconColor="text-purple-500"
          label="Plano"
          hint="Condutas, solicitações, ajustes terapêuticos"
          complete={completion.plan}
          required
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">
              {soap.plan.trim().length}/10+ caracteres
            </span>
            <FieldTemplates
              scope="evolution.plan"
              currentValue={soap.plan}
              onApply={(v) => onSOAPChange('plan', v)}
              hospitalUnitId={hospitalId}
            />
          </div>
          <Textarea
            value={soap.plan}
            onChange={e => onSOAPChange('plan', e.target.value)}
            placeholder="Condutas, solicitações, ajustes terapêuticos, metas para próximas 24h..."
            className="min-h-[120px] text-xs"
          />
        </SectionItem>

        <SectionItem
          id="review"
          icon={Eye}
          iconColor="text-primary"
          label="Revisão"
          hint="Pré-visualização final antes de validar"
          complete={false}
          required={false}
          customStatus={requiredComplete ? (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Pronto
            </span>
          ) : (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Pendente
            </span>
          )}
        >
          {!requiredComplete && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1 mb-3">
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Pendências para validação
              </p>
              <ul className="text-[11px] text-amber-700/80 dark:text-amber-400/80 space-y-0.5 ml-5 list-disc">
                {!completion.evolucao && <li>Preencher <strong>Evolução</strong> (mín. 10 caracteres)</li>}
                {!completion.plan && <li>Preencher <strong>Plano</strong> (mín. 10 caracteres)</li>}
              </ul>
            </div>
          )}
          <ReadOnlyView soap={soap} vitals={vitals} physicalExam={physicalExam} />
        </SectionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {!autoSave && (
          <Button
            variant="outline" size="sm"
            className="gap-1.5 text-xs"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar Rascunho
          </Button>
        )}
        {autoSave && (
          <Button
            variant="ghost" size="sm"
            className="gap-1.5 text-xs"
            onClick={() => { onSave(); setAutoSavedAt(new Date()); }}
            disabled={saving || !hasUnsaved}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar agora
          </Button>
        )}
        <div className="flex-1" />
        {onValidate && !isValidated && (
          <Button
            size="sm"
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            onClick={onValidate}
            disabled={!requiredComplete}
            title={!requiredComplete ? "Preencha todas as seções obrigatórias" : "Validar e assinar evolução"}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Validar e Assinar
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

const SectionItem: React.FC<{
  id: string;
  icon: any;
  iconColor: string;
  label: string;
  hint?: string;
  complete: boolean;
  required: boolean;
  customStatus?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, icon: Icon, iconColor, label, hint, complete, required, customStatus, children }) => {
  return (
    <AccordionItem value={id} className="border-0">
      <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-muted/30 [&>svg]:hidden group">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full shrink-0",
            complete ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
          )}>
            {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className={cn("h-3.5 w-3.5", !complete && iconColor)} />}
          </span>
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {required && !complete && (
            <span className="text-amber-500 text-[10px] font-bold">*</span>
          )}
          {hint && (
            <span className="text-[10px] text-muted-foreground hidden md:inline">— {hint}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {customStatus}
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-3 pt-0">
        {children}
      </AccordionContent>
    </AccordionItem>
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
      {(soap.subjective || soap.assessment) && (
        <div>
          <strong className="text-blue-500">Evolução:</strong>{" "}
          <span className="text-foreground whitespace-pre-wrap">
            {[soap.subjective, soap.assessment].map(t => (t || "").trim()).filter(Boolean).join("\n\n")}
          </span>
        </div>
      )}
      {(hasExam || soap.objective) && (
        <div>
          <strong className="text-emerald-500">Objetivo:</strong>
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
      {soap.plan && (
        <div><strong className="text-purple-500">Plano:</strong> <span className="text-foreground whitespace-pre-wrap">{soap.plan}</span></div>
      )}
    </div>
  );
};
