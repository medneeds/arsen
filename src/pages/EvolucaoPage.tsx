import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import bighelpLogo from "@/assets/bighelp-map-logo.png";
import {
  NotebookPen, Save, Printer, Clock, User, BedDouble, Calendar,
  Stethoscope, Heart, AlertTriangle, FileText, Plus, Trash2, Copy,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";

// --- Types ---
interface PatientHeader {
  name: string;
  birthDate: string;
  age: string;
  sex: string;
  bed: string;
  unit: string;
  record: string;
  admissionDate: string;
  weight: string;
  allergies: string;
}

interface SOAPData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface PhysicalExam {
  general: string;
  cardiovascular: string;
  respiratory: string;
  abdomen: string;
  neurological: string;
  extremities: string;
  skin: string;
  other: string;
}

interface VitalSigns {
  pa: string;
  fc: string;
  fr: string;
  temp: string;
  spo2: string;
  glasgow: string;
  diurese: string;
  dor: string;
}

const SOAP_SECTIONS = [
  { key: 'subjective' as const, label: 'Subjetivo', icon: User, color: 'text-blue-500', bgColor: 'bg-blue-500/10', description: 'Queixas do paciente, relato do acompanhante, sintomas referidos' },
  { key: 'objective' as const, label: 'Objetivo', icon: Stethoscope, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', description: 'Exame físico, sinais vitais, dados laboratoriais' },
  { key: 'assessment' as const, label: 'Avaliação', icon: ClipboardList, color: 'text-amber-500', bgColor: 'bg-amber-500/10', description: 'Diagnóstico diferencial, avaliação clínica, CID' },
  { key: 'plan' as const, label: 'Plano', icon: FileText, color: 'text-purple-500', bgColor: 'bg-purple-500/10', description: 'Condutas, solicitações, ajustes terapêuticos' },
];

const EvolucaoPage = () => {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const [searchParams] = useSearchParams();

  const initialPatientName = searchParams.get('patientName') || '';
  const initialPatientBed = searchParams.get('patientBed') || '';
  const initialPatientSector = searchParams.get('patientSector') || '';
  const initialPatientId = searchParams.get('patientId') || '';
  const sectorMap: Record<string, string> = { red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2" };

  const [patient] = useState<PatientHeader>(() => {
    const demoPatients: Record<string, Omit<PatientHeader, 'bed' | 'unit'>> = {
      'L09': { name: initialPatientName || 'Iglesio Ferreira da Silva', birthDate: '1953-07-14', age: '72 anos', sex: 'Masculino', record: 'PRN-2024-08451', admissionDate: '2026-03-15', weight: '78', allergies: 'Dipirona, Sulfa' },
      'L10': { name: 'Maria das Graças Oliveira', birthDate: '1948-02-22', age: '78 anos', sex: 'Feminino', record: 'PRN-2024-09102', admissionDate: '2026-03-14', weight: '62', allergies: 'NDAM' },
      'L11': { name: 'José Carlos Mendes', birthDate: '1960-11-03', age: '65 anos', sex: 'Masculino', record: 'PRN-2024-07833', admissionDate: '2026-03-16', weight: '85', allergies: 'Penicilina, AAS' },
    };
    const demo = demoPatients[initialPatientBed] || { name: initialPatientName, birthDate: '1970-01-15', age: '56 anos', sex: 'Masculino', record: 'PRN-2024-00000', admissionDate: '2026-03-17', weight: '70', allergies: 'NDAM' };
    return {
      ...demo,
      name: demo.name || initialPatientName,
      bed: initialPatientBed,
      unit: sectorMap[initialPatientSector] || initialPatientSector,
    };
  });

  const [soap, setSOAP] = useState<SOAPData>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  const [vitals, setVitals] = useState<VitalSigns>({
    pa: '', fc: '', fr: '', temp: '', spo2: '', glasgow: '', diurese: '', dor: '',
  });

  const [physicalExam, setPhysicalExam] = useState<PhysicalExam>({
    general: '', cardiovascular: '', respiratory: '', abdomen: '',
    neurological: '', extremities: '', skin: '', other: '',
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['subjective', 'objective', 'assessment', 'plan']));
  const [saving, setSaving] = useState(false);

  const evolutionDate = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const updateSOAP = (key: keyof SOAPData, value: string) => {
    setSOAP(prev => ({ ...prev, [key]: value }));
  };

  const updateVitals = (key: keyof VitalSigns, value: string) => {
    setVitals(prev => ({ ...prev, [key]: value }));
  };

  const updatePhysicalExam = (key: keyof PhysicalExam, value: string) => {
    setPhysicalExam(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    toast.success("Evolução salva com sucesso");
  };

  const hasPatient = patient.name.trim() !== '';

  if (!hasPatient) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <NotebookPen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Evolução Clínica</h1>
            <p className="text-sm text-muted-foreground">Selecione um paciente pelo mapa de leitos ou painel clínico</p>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <NotebookPen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum paciente selecionado</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Acesse pela sidebar do paciente ou painel clínico para iniciar a evolução</p>
        </div>
      </div>
    );
  }

  return (
    <div className="print:p-2">
      {/* Screen layout */}
      <div className="p-4 space-y-4 max-w-5xl mx-auto print:hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <NotebookPen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Evolução Clínica — SOAP</h1>
              <p className="text-xs text-muted-foreground">{evolutionDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
            <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Patient Identification — read-only */}
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground">Paciente</Label>
              <p className="text-sm font-semibold text-foreground truncate">{patient.name}</p>
            </div>
            <div className="flex gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Leito</Label>
                <div className="flex items-center gap-1">
                  <BedDouble className="h-3 w-3 text-muted-foreground" />
                  <p className="text-sm font-semibold">{patient.bed}</p>
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Setor</Label>
                <p className="text-sm font-medium">{patient.unit}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Idade</Label>
                <p className="text-sm font-medium">{patient.age}</p>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Sexo</Label>
                <p className="text-sm font-medium">{patient.sex}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Peso</Label>
                <p className="text-sm font-medium">{patient.weight} kg</p>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Alergias</Label>
                <Badge variant={patient.allergies === 'NDAM' ? 'secondary' : 'destructive'} className="text-[10px]">
                  {patient.allergies}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Vital Signs */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-emerald-500/5">
            <Heart className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold">Sinais Vitais</span>
          </div>
          <div className="p-3 grid grid-cols-4 md:grid-cols-8 gap-2">
            {([
              { key: 'pa' as const, label: 'PA', placeholder: '120/80', unit: 'mmHg' },
              { key: 'fc' as const, label: 'FC', placeholder: '78', unit: 'bpm' },
              { key: 'fr' as const, label: 'FR', placeholder: '18', unit: 'irpm' },
              { key: 'temp' as const, label: 'Tax', placeholder: '36.5', unit: '°C' },
              { key: 'spo2' as const, label: 'SpO₂', placeholder: '96', unit: '%' },
              { key: 'glasgow' as const, label: 'Glasgow', placeholder: '15', unit: '' },
              { key: 'diurese' as const, label: 'Diurese', placeholder: '1200', unit: 'mL/24h' },
              { key: 'dor' as const, label: 'Dor', placeholder: '0', unit: 'EVA' },
            ]).map(v => (
              <div key={v.key}>
                <Label className="text-[9px] text-muted-foreground uppercase">{v.label}</Label>
                <div className="relative">
                  <Input
                    value={vitals[v.key]}
                    onChange={e => updateVitals(v.key, e.target.value)}
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

        {/* SOAP Sections */}
        <div className="space-y-3">
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
                  <span className="text-[10px] text-muted-foreground mr-2">{section.description}</span>
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {expanded && (
                  <div className="p-3">
                    {section.key === 'objective' ? (
                      <div className="space-y-3">
                        {/* Physical Exam subsections */}
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Exame Físico</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {([
                            { key: 'general' as const, label: 'Estado Geral' },
                            { key: 'cardiovascular' as const, label: 'Cardiovascular' },
                            { key: 'respiratory' as const, label: 'Respiratório' },
                            { key: 'abdomen' as const, label: 'Abdome' },
                            { key: 'neurological' as const, label: 'Neurológico' },
                            { key: 'extremities' as const, label: 'Extremidades' },
                            { key: 'skin' as const, label: 'Pele / Feridas' },
                            { key: 'other' as const, label: 'Outros' },
                          ]).map(exam => (
                            <div key={exam.key}>
                              <Label className="text-[10px] text-muted-foreground">{exam.label}</Label>
                              <Input
                                value={physicalExam[exam.key]}
                                onChange={e => updatePhysicalExam(exam.key, e.target.value)}
                                placeholder={`${exam.label}...`}
                                className="h-7 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                        <Separator />
                        <div>
                          <Label className="text-[10px] text-muted-foreground uppercase">Dados objetivos adicionais (exames, imagem, etc.)</Label>
                          <Textarea
                            value={soap.objective}
                            onChange={e => updateSOAP('objective', e.target.value)}
                            placeholder="Resultados laboratoriais, imagens, procedimentos realizados..."
                            className="min-h-[80px] text-xs mt-1"
                          />
                        </div>
                      </div>
                    ) : (
                      <Textarea
                        value={soap[section.key]}
                        onChange={e => updateSOAP(section.key, e.target.value)}
                        placeholder={section.description + '...'}
                        className="min-h-[100px] text-xs"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Preview */}
        {(soap.subjective || soap.objective || soap.assessment || soap.plan) && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Preview da Evolução</span>
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
                      [SV: {vitals.pa && `PA ${vitals.pa}`} {vitals.fc && `FC ${vitals.fc}`} {vitals.fr && `FR ${vitals.fr}`} {vitals.temp && `T ${vitals.temp}°C`} {vitals.spo2 && `SpO₂ ${vitals.spo2}%`} {vitals.glasgow && `Glasgow ${vitals.glasgow}`}]
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

      {/* Print layout */}
      <div className="hidden print:block p-4 text-black text-[10px] leading-tight">
        <div className="flex items-center justify-between border-b border-black pb-1 mb-2">
          <div>
            <p className="font-bold text-sm">EVOLUÇÃO CLÍNICA — SOAP</p>
            <p>{evolutionDate}</p>
          </div>
          <img src={bighelpLogo} className="h-6" alt="Logo" />
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2 border border-black/30 p-1.5 rounded">
          <div><strong>Paciente:</strong> {patient.name}</div>
          <div><strong>Leito:</strong> {patient.bed} — {patient.unit}</div>
          <div><strong>Idade:</strong> {patient.age} | <strong>Sexo:</strong> {patient.sex}</div>
          <div><strong>Peso:</strong> {patient.weight}kg | <strong>Alergias:</strong> {patient.allergies}</div>
        </div>
        {Object.values(vitals).some(v => v) && (
          <div className="mb-2 border border-black/30 p-1.5 rounded">
            <strong>Sinais Vitais:</strong> {vitals.pa && `PA ${vitals.pa} mmHg`} {vitals.fc && `| FC ${vitals.fc} bpm`} {vitals.fr && `| FR ${vitals.fr} irpm`} {vitals.temp && `| Tax ${vitals.temp}°C`} {vitals.spo2 && `| SpO₂ ${vitals.spo2}%`} {vitals.glasgow && `| Glasgow ${vitals.glasgow}`} {vitals.diurese && `| Diurese ${vitals.diurese} mL/24h`} {vitals.dor && `| Dor EVA ${vitals.dor}`}
          </div>
        )}
        {soap.subjective && <p className="mb-1"><strong>SUBJETIVO:</strong> {soap.subjective}</p>}
        <p className="mb-1"><strong>OBJETIVO:</strong> {Object.entries(physicalExam).filter(([_, v]) => v).map(([_, v]) => v + '. ').join('')}{soap.objective}</p>
        {soap.assessment && <p className="mb-1"><strong>AVALIAÇÃO:</strong> {soap.assessment}</p>}
        {soap.plan && <p className="mb-1"><strong>PLANO:</strong> {soap.plan}</p>}
        <div className="mt-8 pt-4 border-t border-black text-center">
          <p>_________________________________</p>
          <p>Médico responsável — CRM</p>
        </div>
      </div>
    </div>
  );
};

export default EvolucaoPage;
