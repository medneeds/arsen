import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Heart, NotebookPen, Stethoscope, FileText,
  Save, Loader2, CheckCircle2,
  ShieldCheck, Printer,
  AlertCircle, Eye, ChevronDown, Stethoscope as DiagnosisIcon,
  Activity, ClipboardCopy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, richHtmlToPlainText, sanitizeRichHtml, toRichHtml } from "@/components/ui/rich-text-editor";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";
import { FieldTemplates } from "@/components/FieldTemplates";
import { useHospital } from "@/contexts/HospitalContext";
import { DevicesCulturesSection } from "@/components/evolution/DevicesCulturesSection";
import { deviceAlertTone, type EvolutionDevice } from "@/lib/devicesCatalog";
import { printEvolution } from "@/lib/printEvolution";
import { resolvePatientHeader } from "@/lib/resolvePatientHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { EvolutionRecord } from "@/hooks/useEvolutions";
import { calculateNEWS2, news2RiskLabels, parseVitalNumber } from "@/lib/news2";

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
  /** Optional compact render of the diagnostics panel inside the Revisão (review) section. */
  diagnosticsReviewSlot?: React.ReactNode;
  /** CID primário ativo — usado para gatear validação (obrigatório). */
  cidPrimary?: string | null;
  cidSecondary?: string | string[] | null;
  /** Dispositivos invasivos (lista catálogo + custom). */
  devices?: EvolutionDevice[];
  onDevicesChange?: (next: EvolutionDevice[]) => void;
  /** Resultado de culturas (HTML rico). */
  culturesHtml?: string;
  onCulturesChange?: (html: string) => void;
  /** Data de admissão no setor — base p/ presets do date picker dos dispositivos. */
  admissionDate?: string | null;
  /** Registro da evolução (usado para impressão unificada via printEvolution). */
  evo?: EvolutionRecord;
  /** UUID do paciente — chave do resolver de identidade na impressão. */
  patientId?: string | null;
  /** Prontuário fallback (usado se o resolver não encontrar). */
  patientRecord?: string | null;
  /** Callback opcional — quando definido, exibe botão "Copiar da admissão" no Exame Físico. */
  onCopyExamFromAdmission?: () => void;
  /** Callback opcional — quando definido, exibe botão "Copiar da admissão" nos Sinais Vitais. */
  onCopyVitalsFromAdmission?: () => void;
  /** When true, hides the "Plano" section entirely (used by complementary evolutions). */
  hidePlan?: boolean;
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
  diagnosticsReviewSlot,
  devices, onDevicesChange,
  culturesHtml, onCulturesChange,
  admissionDate,
  evo,
  patientId,
  patientRecord,
  cidPrimary,
  cidSecondary,
  onCopyExamFromAdmission,
  onCopyVitalsFromAdmission,
  hidePlan = false,
}) => {
  const [openSections, setOpenSections] = useState<string[]>(['diagnostics', 'devices', 'evolucao', 'complementares', 'plan']);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
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

  // NEWS2 — calculado em tempo real a partir dos sinais vitais preenchidos.
  // Exibido como badge no header da seção quando ≥ 1 campo está preenchido.
  const news2 = useMemo(() => {
    const hasAny = Object.values(vitals).some(v => (v ?? "").trim());
    if (!hasAny) return null;
    const pa = vitals.pa.split("/")[0];
    return calculateNEWS2({
      respiratoryRate: parseVitalNumber(vitals.fr),
      spo2: parseVitalNumber(vitals.spo2),
      temperature: parseVitalNumber(vitals.temp),
      systolicBp: parseVitalNumber(pa),
      heartRate: parseVitalNumber(vitals.fc),
    });
  }, [vitals]);

  // Completion status — campos opcionais e obrigatórios bem separados.
  // OBRIGATÓRIOS para validar: Diagnóstico (CID primário) + Evolução + Plano.
  // OPCIONAIS: Sinais Vitais, Exame Físico, Exames Complementares, Dispositivos/Culturas.
  const completion = useMemo(() => ({
    diagnostics: !!(cidPrimary && cidPrimary.trim()),
    vitals: Object.values(vitals).some(v => (v ?? "").trim()),
    exam: Object.values(physicalExam).some(v => (v ?? "").trim()),
    evolucao: richHtmlToPlainText(evolucaoText).length >= 10,
    complementares: richHtmlToPlainText(soap.objective).length > 0,
    plan: richHtmlToPlainText(soap.plan).length >= 10,
  }), [cidPrimary, vitals, physicalExam, soap.objective, soap.plan, evolucaoText]);

  const requiredComplete = completion.diagnostics && completion.evolucao && completion.plan;


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
        <ReadOnlyView soap={soap} vitals={vitals} physicalExam={physicalExam} devices={devices} culturesHtml={culturesHtml} />
        {isValidated && (
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={async () => {
                // Unificado com o botão de impressão da Timeline (printEvolution):
                // mesma resolução de identidade (resolvePatientHeader) + leitura
                // ao vivo de leito/setor em `patients`. Garante cabeçalho
                // sincronizado com o paciente real, sem usar snapshots vazios.
                if (!evo) {
                  toast.error("Evolução ainda não foi salva — não é possível imprimir");
                  return;
                }
                try {
                  // Fallback: garantir nome antes de resolver header
                  let fallbackName: string | null = evo.patient_name || null;
                  if ((!fallbackName || !fallbackName.trim()) && patientId) {
                    const { data: pRow } = await supabase
                      .from("patients").select("name").eq("id", patientId).maybeSingle();
                    if ((pRow as any)?.name?.trim()) fallbackName = (pRow as any).name.trim();
                  }
                  const resolved = await resolvePatientHeader(
                    patientId || null,
                    fallbackName,
                    hospitalId,
                    (evo as any).patient_registry_id || null,
                  );
                  let currentBed = evo.patient_bed || undefined;
                  let currentSector = evo.patient_sector || undefined;
                  if (patientId) {
                    const { data: pRow } = await supabase
                      .from("patients")
                      .select("bed_number, sector")
                      .eq("id", patientId)
                      .maybeSingle();
                    if (pRow?.bed_number) currentBed = pRow.bed_number;
                    if (pRow?.sector) currentSector = pRow.sector;
                  }
                  await printEvolution(evo, {
                    patientName: resolved.name || evo.patient_name,
                    patientBed: currentBed,
                    patientSector: currentSector,
                    patientRecord: resolved.prontuario || patientRecord || undefined,
                    patientAtendimento: resolved.atendimento || undefined,
                    patientSocialName: resolved.socialName || undefined,
                    patientCpf: resolved.cpf || undefined,
                    patientCns: resolved.cns || undefined,
                    cidPrimary: cidPrimary || undefined,
                    cidSecondary: (Array.isArray(cidSecondary) ? cidSecondary.filter(Boolean).join("; ") : cidSecondary) || undefined,
                  });
                } catch (err) {
                  console.error("[EvolutionForm] Falha ao imprimir evolução:", err);
                  toast.error("Não foi possível resolver os dados do paciente para impressão");
                }
              }}
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir Evolução
            </Button>
          </div>
        )}
      </div>
    );
  }

  const expandAll = () => setOpenSections(['diagnostics', 'vitals', 'exam', 'devices', 'evolucao', 'complementares', 'plan']);
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
            complete={completion.diagnostics}
            required
          >
            {diagnosticsSlot}
          </SectionItem>
        )}

        {/* Sinais Vitais — OPCIONAL. NEWS2 calculado em tempo real (badge no header). */}
        <SectionItem
          id="vitals"
          icon={Heart}
          iconColor="text-rose-500"
          label="Sinais Vitais"
          hint="PA, FC, FR, Tax, SpO₂, Glasgow, Diurese, Dor — opcional"
          complete={completion.vitals}
          required={false}
          customStatus={
            news2 && news2.score > 0 ? (
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                news2RiskLabels[news2.risk].className,
              )}>
                NEWS2 {news2.score} · {news2RiskLabels[news2.risk].label}
              </span>
            ) : undefined
          }
        >
          <div className="flex items-center justify-between mb-2">
            <Label className="text-[10px] text-muted-foreground font-semibold tracking-wider">
              SINAIS VITAIS (OPCIONAL)
            </Label>
            {onCopyVitalsFromAdmission && (
              <Button
                variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2"
                onClick={onCopyVitalsFromAdmission}
              >
                <ClipboardCopy className="h-3 w-3" /> Copiar da admissão
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {VITAL_FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  {f.label} {f.unit && <span className="text-muted-foreground/60">({f.unit})</span>}
                </Label>
                <Input
                  value={vitals[f.key]}
                  onChange={(e) => onVitalsChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
          {news2 && news2.score > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              NEWS2 calculado a partir de FR, SpO₂, T, PAS e FC. Glasgow/Diurese/Dor não compõem o escore.
            </p>
          )}
        </SectionItem>

        {/* Exame Físico — OPCIONAL. Ectoscopia + aparelhos pré-configurados. */}
        <SectionItem
          id="exam"
          icon={Stethoscope}
          iconColor="text-blue-500"
          label="Exame Físico"
          hint="Ectoscopia, cardiovascular, respiratório, abdome, neurológico, extremidades, pele — opcional"
          complete={completion.exam}
          required={false}
        >
          <div className="flex items-center justify-between mb-2">
            <Label className="text-[10px] text-muted-foreground font-semibold tracking-wider">
              EXAME FÍSICO POR APARELHOS (OPCIONAL)
            </Label>
            {onCopyExamFromAdmission && (
              <Button
                variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2"
                onClick={onCopyExamFromAdmission}
              >
                <ClipboardCopy className="h-3 w-3" /> Copiar da admissão
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {EXAM_FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                <Textarea
                  value={physicalExam[f.key]}
                  onChange={(e) => onPhysicalExamChange(f.key, e.target.value)}
                  className="text-xs min-h-[56px] resize-y"
                  placeholder={`Descrever ${f.label.toLowerCase()}...`}
                />
              </div>
            ))}
          </div>
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
            </div>
          </div>
          <RichTextEditor
            value={soap.objective}
            onChange={(html) => onSOAPChange('objective', html)}
            placeholder="Cole resultados laboratoriais ou de imagem..."
            minHeight={120}
          />
        </SectionItem>

        {onDevicesChange && onCulturesChange && (
          <SectionItem
            id="devices"
            icon={Activity}
            iconColor="text-rose-500"
            label="Dispositivos & Culturas"
            hint="Dispositivos invasivos com data de inserção (D{n} automático) + resultado de culturas — opcional"
            complete={(devices?.length ?? 0) > 0}
            required={false}
            customStatus={
              (devices && devices.length > 0) ? (
                <span className="text-[10px] text-rose-600 dark:text-rose-400">
                  {devices.length} dispositivo{devices.length > 1 ? "s" : ""}
                </span>
              ) : undefined
            }
          >
            <DevicesCulturesSection
              devices={devices || []}
              onDevicesChange={onDevicesChange}
              culturesHtml={culturesHtml || ""}
              onCulturesChange={onCulturesChange}
              admissionDate={admissionDate || undefined}
            />
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
              {richHtmlToPlainText(evolucaoText).length}/10+ caracteres
            </span>
            <FieldTemplates
              scope="evolution.subjective"
              currentValue={evolucaoText}
              onApply={(v) => handleEvolucaoChange(v)}
              hospitalUnitId={hospitalId}
            />
          </div>
          <RichTextEditor
            value={evolucaoText}
            onChange={(html) => handleEvolucaoChange(html)}
            placeholder="Relato clínico do plantão: sinais vitais relevantes, exame físico dirigido, queixas, evolução percebida, hipóteses diagnósticas, raciocínio clínico..."
            minHeight={220}
          />
        </SectionItem>

        {!hidePlan && (
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
              {richHtmlToPlainText(soap.plan).length}/10+ caracteres
            </span>
            <FieldTemplates
              scope="evolution.plan"
              currentValue={soap.plan}
              onApply={(v) => onSOAPChange('plan', v)}
              hospitalUnitId={hospitalId}
            />
          </div>
          <RichTextEditor
            value={soap.plan}
            onChange={(html) => onSOAPChange('plan', html)}
            placeholder="Condutas, solicitações, ajustes terapêuticos, metas para próximas 24h..."
            minHeight={120}
          />
        </SectionItem>
        )}

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
                {!completion.diagnostics && <li>Definir <strong>CID-10 primário</strong> em Diagnósticos</li>}
                {!completion.evolucao && <li>Preencher <strong>Evolução</strong> (mín. 10 caracteres)</li>}
                {!completion.plan && <li>Preencher <strong>Plano</strong> (mín. 10 caracteres)</li>}
              </ul>
            </div>
          )}
          {diagnosticsReviewSlot && (
            <div className="mb-3 rounded-lg border border-border bg-muted/20 p-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground tracking-wider mb-2">
                DIAGNÓSTICOS — REVISÃO
              </p>
              {diagnosticsReviewSlot}
            </div>
          )}
          <ReadOnlyView soap={soap} vitals={vitals} physicalExam={physicalExam} devices={devices} culturesHtml={culturesHtml} />

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

const ReadOnlyView: React.FC<{
  soap: SOAPData;
  vitals: VitalSigns;
  physicalExam: PhysicalExam;
  devices?: EvolutionDevice[];
  culturesHtml?: string;
}> = ({ soap, vitals, physicalExam, devices, culturesHtml }) => {
  const hasVitals = Object.values(vitals).some(v => v.trim());
  const hasExam = Object.values(physicalExam).some(v => v.trim());
  const hasDevices = Array.isArray(devices) && devices.length > 0;
  const hasCultures = !!culturesHtml && richHtmlToPlainText(culturesHtml).trim().length > 0;

  const parseInserted = (s: string): Date | null => {
    if (!s) return null;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };
  const daysSince = (s: string): number | null => {
    const d = parseInserted(s);
    if (!d) return null;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  };
  const fmtBR = (s: string): string => {
    const d = parseInserted(s);
    if (!d) return s || "";
    return d.toLocaleDateString("pt-BR");
  };

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
      {(richHtmlToPlainText(soap.subjective) || richHtmlToPlainText(soap.assessment)) && (
        <div>
          <strong className="text-blue-500">Evolução:</strong>{" "}
          <span
            className="prose prose-sm max-w-none text-foreground [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
            dangerouslySetInnerHTML={{
              __html: [soap.subjective, soap.assessment]
                .map(t => sanitizeRichHtml(toRichHtml(t)))
                .filter(Boolean).join(""),
            }}
          />
        </div>
      )}
      {(hasExam || richHtmlToPlainText(soap.objective)) && (
        <div>
          <strong className="text-emerald-500">Objetivo:</strong>
          {hasExam && (
            <ul className="ml-4 mt-0.5 text-foreground/90 list-disc">
              {EXAM_FIELDS.filter(f => physicalExam[f.key]).map(f => (
                <li key={f.key}><span className="font-medium">{f.label}:</span> {physicalExam[f.key]}</li>
              ))}
            </ul>
          )}
          {richHtmlToPlainText(soap.objective) && (
            <div
              className="prose prose-sm max-w-none mt-1 text-foreground [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(toRichHtml(soap.objective)) }}
            />
          )}
        </div>
      )}
      {hasDevices && (
        <div>
          <strong className="text-amber-600 dark:text-amber-400">Dispositivos invasivos:</strong>
          <ul className="ml-4 mt-0.5 text-foreground/90 list-disc">
            {devices!.map((d, i) => {
              const days = daysSince(d.insertedAt);
              const tone = deviceAlertTone(days);
              const toneCls = tone === "red"
                ? "text-red-600 dark:text-red-400 font-semibold"
                : tone === "amber"
                  ? "text-amber-600 dark:text-amber-400 font-semibold"
                  : "text-emerald-600 dark:text-emerald-400";
              return (
                <li key={`${d.id}-${i}`}>
                  <span className="font-medium">{d.label}</span>
                  {d.insertedAt && <span className="text-muted-foreground"> — inserido em {fmtBR(d.insertedAt)}</span>}
                  {days !== null && <span className={cn("ml-1", toneCls)}>(D{days})</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {hasCultures && (
        <div>
          <strong className="text-rose-600 dark:text-rose-400">Culturas:</strong>
          <div
            className="prose prose-sm max-w-none mt-0.5 text-foreground [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(toRichHtml(culturesHtml!)) }}
          />
        </div>
      )}
      {richHtmlToPlainText(soap.plan) && (
        <div>
          <strong className="text-purple-500">Plano:</strong>{" "}
          <span
            className="prose prose-sm max-w-none text-foreground [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(toRichHtml(soap.plan)) }}
          />
        </div>
      )}
    </div>
  );
};
