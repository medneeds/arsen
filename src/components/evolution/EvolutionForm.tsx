import React, { useState } from "react";
import {
  Heart, User, Stethoscope, ClipboardList, FileText,
  ChevronDown, ChevronUp, Save, Loader2, CheckCircle2,
  ShieldCheck, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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

const SOAP_SECTIONS = [
  { key: 'subjective' as const, label: 'Subjetivo', icon: User, color: 'text-blue-500', bgColor: 'bg-blue-500/10', description: 'Queixas do paciente, relato do acompanhante' },
  { key: 'objective' as const, label: 'Objetivo', icon: Stethoscope, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', description: 'Exame físico, sinais vitais, dados laboratoriais' },
  { key: 'assessment' as const, label: 'Avaliação', icon: ClipboardList, color: 'text-amber-500', bgColor: 'bg-amber-500/10', description: 'Diagnóstico diferencial, avaliação clínica' },
  { key: 'plan' as const, label: 'Plano', icon: FileText, color: 'text-purple-500', bgColor: 'bg-purple-500/10', description: 'Condutas, solicitações, ajustes terapêuticos' },
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['subjective', 'objective', 'assessment', 'plan'])
  );

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  return (
    <div className="space-y-3">
      {/* Vital Signs */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-emerald-500/5">
          <Heart className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-semibold">Sinais Vitais</span>
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
                  readOnly={readOnly}
                />
                {v.unit && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">{v.unit}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SOAP Sections */}
      {SOAP_SECTIONS.map(section => {
        const Icon = section.icon;
        const expanded = expandedSections.has(section.key);
        return (
          <div key={section.key} className="rounded-xl border border-border bg-card">
            <button
              type="button"
              className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors", section.bgColor)}
              onClick={() => toggleSection(section.key)}
            >
              <Icon className={cn("h-4 w-4", section.color)} />
              <span className="text-sm font-semibold text-foreground flex-1">{section.label}</span>
              <span className="text-[10px] text-muted-foreground mr-2 hidden md:inline">{section.description}</span>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {expanded && (
              <div className="p-3">
                {section.key === 'objective' ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground font-semibold tracking-wider">Exame Físico</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {EXAM_FIELDS.map(exam => (
                        <div key={exam.key}>
                          <Label className="text-[10px] text-muted-foreground">{exam.label}</Label>
                          <Input
                            value={physicalExam[exam.key]}
                            onChange={e => onPhysicalExamChange(exam.key, e.target.value)}
                            placeholder={`${exam.label}...`}
                            className="h-7 text-xs"
                            readOnly={readOnly}
                          />
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Dados objetivos adicionais</Label>
                      <Textarea
                        value={soap.objective}
                        onChange={e => onSOAPChange('objective', e.target.value)}
                        placeholder="Resultados laboratoriais, imagens..."
                        className="min-h-[80px] text-xs mt-1"
                        readOnly={readOnly}
                      />
                    </div>
                  </div>
                ) : (
                  <Textarea
                    value={soap[section.key]}
                    onChange={e => onSOAPChange(section.key, e.target.value)}
                    placeholder={section.description + '...'}
                    className="min-h-[100px] text-xs"
                    readOnly={readOnly}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Actions */}
      {!readOnly && (
        <div className="flex items-center gap-2 justify-end">
          <Button size="sm" className="gap-1.5 text-xs" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar Rascunho
          </Button>
          {onValidate && !isValidated && (
            <Button size="sm" variant="default" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={onValidate}>
              <ShieldCheck className="h-3.5 w-3.5" /> Validar e Assinar
            </Button>
          )}
        </div>
      )}
      {readOnly && isValidated && (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Imprimir Evolução
          </Button>
        </div>
      )}

      {/* Preview */}
      {(soap.subjective || soap.objective || soap.assessment || soap.plan) && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-muted-foreground">Preview</span>
          </div>
          <div className="text-xs text-foreground space-y-1.5 leading-relaxed">
            {soap.subjective && <p><strong className="text-blue-500">S:</strong> {soap.subjective}</p>}
            {(soap.objective || Object.values(physicalExam).some(v => v)) && (
              <div>
                <strong className="text-emerald-500">O:</strong>
                {Object.entries(physicalExam).filter(([_, v]) => v).map(([k, v]) => (
                  <span key={k} className="ml-1">{v}.</span>
                ))}
                {soap.objective && <span className="ml-1">{soap.objective}</span>}
                {Object.values(vitals).some(v => v) && (
                  <span className="ml-1 text-muted-foreground">
                    [SV: {vitals.pa && `PA ${vitals.pa}`} {vitals.fc && `FC ${vitals.fc}`} {vitals.fr && `FR ${vitals.fr}`} {vitals.temp && `T ${vitals.temp}°C`} {vitals.spo2 && `SpO₂ ${vitals.spo2}%`}]
                  </span>
                )}
              </div>
            )}
            {soap.assessment && <p><strong className="text-amber-500">A:</strong> {soap.assessment}</p>}
            {soap.plan && <p><strong className="text-purple-500">P:</strong> {soap.plan}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
