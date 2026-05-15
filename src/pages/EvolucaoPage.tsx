import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";


import { PatientCockpit } from "@/components/PatientCockpit";
import { SapsPendingAlert } from "@/components/SapsPendingAlert";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import bighelpLogo from "@/assets/bighelp-map-logo.png";
import {
  NotebookPen, Plus, Loader2, AlertTriangle, ChevronDown, Sun, Moon, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RichTextEditor, richHtmlToPlainText } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useEvolutions, EvolutionRecord } from "@/hooks/useEvolutions";
import { usePatientCid } from "@/hooks/usePatientCid";
import { usePatientLive } from "@/hooks/usePatientLive";
import { usePatientIdentifiers } from "@/hooks/usePatientIdentifiers";
import { usePatientDiagnosticContext } from "@/hooks/usePatientDiagnosticContext";
import { EvolutionForm } from "@/components/evolution/EvolutionForm";
import { EvolutionTimeline } from "@/components/evolution/EvolutionTimeline";
import { DiagnosticsPanel } from "@/components/evolution/DiagnosticsPanel";
import type { Patient } from "@/types/patient";
import { getEffectiveAdmissionDate } from "@/lib/dihCalc";
import { parseDiagnosesText, diagnosesArrayToText } from "@/lib/diagnosesText";
import { supabase } from "@/integrations/supabase/client";

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

const EvolucaoPage = () => {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const [searchParams] = useSearchParams();

  const initialPatientName = searchParams.get("patientName") || "";
  const initialPatientBed = searchParams.get("patientBed") || "";
  const initialPatientSector = searchParams.get("patientSector") || "";
  const initialPatientId = searchParams.get("patientId") || "";
  const sectorMap: Record<string, string> = { red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2" };

  const [patient] = useState<PatientHeader>(() => {
    const demoPatients: Record<string, Omit<PatientHeader, "bed" | "unit">> = {
      L09: { name: initialPatientName || "Iglesio Ferreira da Silva", birthDate: "1953-07-14", age: "72 anos", sex: "Masculino", record: "PRN-2024-08451", admissionDate: "2026-03-15", weight: "78", allergies: "Dipirona, Sulfa" },
      L10: { name: "Maria das Graças Oliveira", birthDate: "1948-02-22", age: "78 anos", sex: "Feminino", record: "PRN-2024-09102", admissionDate: "2026-03-14", weight: "62", allergies: "NDAM" },
      L11: { name: "José Carlos Mendes", birthDate: "1960-11-03", age: "65 anos", sex: "Masculino", record: "PRN-2024-07833", admissionDate: "2026-03-16", weight: "85", allergies: "Penicilina, AAS" },
    };
    const demo = demoPatients[initialPatientBed] || { name: initialPatientName, birthDate: "1970-01-15", age: "56 anos", sex: "Masculino", record: "PRN-2024-00000", admissionDate: "2026-03-17", weight: "70", allergies: "NDAM" };
    return { ...demo, name: demo.name || initialPatientName, bed: initialPatientBed, unit: sectorMap[initialPatientSector] || initialPatientSector };
  });

  const {
    evolutions, loading,
    createEvolution, updateEvolution, validateEvolution,
    suspendEvolution, deleteEvolution, duplicateEvolution,
  } = useEvolutions(initialPatientId || null, {
    patientName: patient.name,
    patientBed: patient.bed,
    patientSector: patient.unit,
  });

  const ids = usePatientIdentifiers(initialPatientId || null, patient.name || null, currentHospital?.id || null);
  const prontuarioReal = ids.prontuario || patient.record;

  // New evolution form state
  const [showNewForm, setShowNewForm] = useState(false);
  // Evoluções complementares (campo único): intercorrência | vespertina | noturna
  type ComplementaryKind = 'intercurrence' | 'vespertina' | 'noturna';
  const [complementaryKind, setComplementaryKind] = useState<ComplementaryKind | null>(null);
  const [intercurrenceText, setIntercurrenceText] = useState("");
  const [savingIntercurrence, setSavingIntercurrence] = useState(false);
  const showIntercurrenceForm = complementaryKind !== null;
  const COMPLEMENTARY_META: Record<ComplementaryKind, {
    label: string; shortLabel: string; placeholder: string;
    Icon: React.ComponentType<{ className?: string }>;
    badgeClass: string; borderClass: string; bgClass: string; iconColor: string;
  }> = {
    intercurrence: {
      label: 'Intercorrência', shortLabel: 'Intercorrência', Icon: AlertTriangle,
      placeholder: 'Descreva a intercorrência (ex.: queda da própria altura às 14h, sem perda de consciência; novo episódio de hipotensão, PA 80x40 às 03h; dessaturação após mobilização...)',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/40',
      borderClass: 'border-amber-500/40', bgClass: 'bg-amber-500/5', iconColor: 'text-amber-600',
    },
    vespertina: {
      label: 'Evolução Vespertina', shortLabel: 'Vespertina', Icon: Sun,
      placeholder: 'Evolução vespertina — registre o que mudou desde a manhã (sinais vitais, condutas, exames recebidos, intercorrências leves, plano para a noite...)',
      badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/40',
      borderClass: 'border-orange-500/40', bgClass: 'bg-orange-500/5', iconColor: 'text-orange-600',
    },
    noturna: {
      label: 'Evolução Noturna', shortLabel: 'Noturna', Icon: Moon,
      placeholder: 'Evolução noturna — descreva o estado clínico do plantão noturno (sono, dor, sinais vitais, intercorrências, condutas executadas, transmissão para a manhã...)',
      badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/40',
      borderClass: 'border-indigo-500/40', bgClass: 'bg-indigo-500/5', iconColor: 'text-indigo-600',
    },
  };
  const currentComplementary = complementaryKind ? COMPLEMENTARY_META[complementaryKind] : null;
  const CompIcon = currentComplementary?.Icon ?? AlertTriangle;
  const [newSoap, setNewSoap] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [newVitals, setNewVitals] = useState({ pa: "", fc: "", fr: "", temp: "", spo2: "", glasgow: "", diurese: "", dor: "" });
  const [newExam, setNewExam] = useState({ general: "", cardiovascular: "", respiratory: "", abdomen: "", neurological: "", extremities: "", skin: "", other: "" });
  const [creating, setCreating] = useState(false);
  const [diagnosticsReplicated, setDiagnosticsReplicated] = useState(false);
  const [diagnosticHypotheses, setDiagnosticHypotheses] = useState("");

  // CID state — persisted to admission_histories via usePatientCid
  const {
    cidPrimary, cidSecondary,
    updatePrimary: updateCidPrimary,
    updateSecondary: updateCidSecondary,
  } = usePatientCid(initialPatientId || null);

  // Discharge prediction (UTI + Hospitalar) + palliative + isolation — synced with admission
  const {
    utiDischargePrediction, hospitalDischargePrediction,
    isPalliative, isolationPrecautions,
    updateUtiDischargePrediction, updateHospitalDischargePrediction,
    updateIsPalliative, updateIsolationPrecautions,
  } = usePatientDiagnosticContext(initialPatientId || null);

  // Live patient row (realtime sync with Painel Clínico)
  const { patient: livePatient } = usePatientLive(initialPatientId || null);

  const hasPatient = patient.name.trim() !== "";

  // Setor é UTI/UCI? Mostra previsão de alta da UTI também.
  const isUtiSector = useMemo(() => {
    const u = (patient.unit || "").toUpperCase();
    return u.includes("UTI") || u.includes("UCI");
  }, [patient.unit]);

  const resetNewForm = () => {
    setNewSoap({ subjective: "", objective: "", assessment: "", plan: "" });
    setNewVitals({ pa: "", fc: "", fr: "", temp: "", spo2: "", glasgow: "", diurese: "", dor: "" });
    setNewExam({ general: "", cardiovascular: "", respiratory: "", abdomen: "", neurological: "", extremities: "", skin: "", other: "" });
    setDiagnosticsReplicated(false);
    setDiagnosticHypotheses("");
  };

  /** Prefill hipóteses ao abrir Nova Evolução: prioriza última evolução com hipóteses,
   *  senão usa o array atual de patients.diagnoses (vindo da admissão). */
  const computePrefillHypotheses = (): string => {
    const lastWithHypo = evolutions.find(e => (e as any).diagnostic_hypotheses);
    if (lastWithHypo) return (lastWithHypo as any).diagnostic_hypotheses || "";
    if (livePatient?.diagnoses?.length) return diagnosesArrayToText(livePatient.diagnoses);
    return "";
  };

  // Replicação automática: ao abrir Nova Evolução, se houver evolução anterior,
  // assume-se que CIDs/previsões/paliativo/isolamento já estão preservados na admissão
  // (foi assim que foram persistidos por evolução anterior). Marcamos o banner de replicado.
  const handleOpenNewEvolution = () => {
    resetNewForm();
    setShowNewForm(true);
    // Considera replicado se há ao menos um diagnóstico/contexto preenchido vindo da última evolução
    const hasContext = !!(cidPrimary || cidSecondary?.length || utiDischargePrediction || hospitalDischargePrediction || isPalliative || isolationPrecautions);
    if (hasContext && evolutions.length > 0) {
      setDiagnosticsReplicated(true);
    }
    // Prefill hipóteses (vindas da última evolução com hipóteses ou da admissão)
    setDiagnosticHypotheses(computePrefillHypotheses());
  };

  const handleClearDiagnostics = () => {
    if (cidPrimary) updateCidPrimary("");
    if (cidSecondary?.length) updateCidSecondary([]);
    if (utiDischargePrediction) updateUtiDischargePrediction("");
    if (hospitalDischargePrediction) updateHospitalDischargePrediction("");
    if (isPalliative) updateIsPalliative(false);
    if (isolationPrecautions) updateIsolationPrecautions("");
    setDiagnosticHypotheses("");
    setDiagnosticsReplicated(false);
  };

  const handleCreateEvolution = async () => {
    setCreating(true);
    const result = await createEvolution(
      patient.name, patient.bed, patient.unit,
      newSoap, newVitals, newExam,
      diagnosticHypotheses
    );
    setCreating(false);
    if (result) {
      setShowNewForm(false);
      resetNewForm();
    }
  };

  const handleCreateIntercurrence = async () => {
    const text = intercurrenceText;
    if (!richHtmlToPlainText(text) || !complementaryKind) return;
    setSavingIntercurrence(true);
    const result = await createEvolution(
      patient.name, patient.bed, patient.unit,
      { subjective: text, objective: "", assessment: "", plan: "", type: complementaryKind } as any,
      undefined,
      undefined
    );
    setSavingIntercurrence(false);
    if (result) {
      setIntercurrenceText("");
      setComplementaryKind(null);
    }
  };

  const handleDuplicate = async (source: EvolutionRecord) => {
    setNewSoap({ ...source.soap_data });
    setNewVitals({ ...source.vital_signs });
    setNewExam({ ...source.physical_exam });
    setShowNewForm(true);
    setDiagnosticsReplicated(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Adapt PatientHeader → minimal Patient for cockpit (must run before any early return)
  const cockpitPatient: Patient = useMemo(() => {
    const cidDiagnoses: string[] = [];
    if (cidPrimary) cidDiagnoses.push(`[Primário] ${cidPrimary}`);
    cidSecondary.forEach(c => c && cidDiagnoses.push(c));

    if (livePatient) {
      const stored = livePatient.diagnoses || [];
      const merged = [...cidDiagnoses, ...stored.filter(d => !cidDiagnoses.includes(d))];
      return { ...livePatient, diagnoses: merged };
    }

    return {
      id: initialPatientId || "evolucao-stub",
      bedNumber: patient.bed,
      name: patient.name,
      age: typeof patient.age === "string" ? patient.age.replace(/\s*anos?$/i, "") : patient.age,
      sector: (initialPatientSector as Patient["sector"]) || "outside",
      diagnoses: cidDiagnoses,
      medicalHistory: [],
      relevantExams: [],
      pendencies: [],
      schedule: [],
      admissionHistory: "",
      admissionDate: patient.admissionDate,
      utiAllergies: (patient.allergies ?? "").split(/[,\n;]/).map(s => s.trim()).filter(Boolean),
      clinicalStatus: "regular",
    };
  }, [livePatient, patient, initialPatientId, initialPatientSector, cidPrimary, cidSecondary]);

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
          <p className="text-sm text-muted-foreground/70 mt-1">Acesse pela sidebar do paciente ou painel clínico</p>
        </div>
      </div>
    );
  }

  // Slot do painel Diagnósticos — injetado como 1ª seção colapsável dentro do form
  const diagnosticsSlot = (
    <DiagnosticsPanel
      cidPrimary={cidPrimary}
      cidSecondary={cidSecondary}
      onCidPrimaryChange={updateCidPrimary}
      onCidSecondaryChange={updateCidSecondary}
      utiDischargePrediction={utiDischargePrediction}
      onUtiDischargePredictionChange={updateUtiDischargePrediction}
      hospitalDischargePrediction={hospitalDischargePrediction}
      onHospitalDischargePredictionChange={updateHospitalDischargePrediction}
      isPalliative={isPalliative}
      onPalliativeChange={updateIsPalliative}
      isolationPrecautions={isolationPrecautions}
      onIsolationChange={updateIsolationPrecautions}
      showUtiPrediction={isUtiSector}
      replicated={diagnosticsReplicated}
      onClearAll={handleClearDiagnostics}
    />
  );

  return (
    <div className="print:p-2">
      <ClinicalHeader moduleLabel="Evolução Clínica" />

      <div className="flex print:hidden">
        <div className="flex-1 min-w-0 p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* SAPS pending alert removed */}
        {/* Page Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="hidden sm:flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <NotebookPen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Evolução Clínica</h1>
              <p className="text-xs text-muted-foreground">Timeline de evoluções do paciente</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 flex-1 sm:flex-none min-h-9"
                  disabled={showIntercurrenceForm || showNewForm}
                >
                  <Zap className="h-3.5 w-3.5" /> Evolução complementar
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Registro rápido — campo único
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['intercurrence', 'vespertina', 'noturna'] as const).map(kind => {
                  const meta = COMPLEMENTARY_META[kind];
                  const Icon = meta.Icon;
                  return (
                    <DropdownMenuItem
                      key={kind}
                      onClick={() => { setComplementaryKind(kind); setIntercurrenceText(""); }}
                      className="gap-2 text-xs"
                    >
                      <Icon className={cn("h-3.5 w-3.5", meta.iconColor)} />
                      {meta.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              className="gap-1.5 text-xs flex-1 sm:flex-none min-h-9"
              onClick={handleOpenNewEvolution}
              disabled={showNewForm || showIntercurrenceForm}
            >
              <Plus className="h-3.5 w-3.5" /> Nova Evolução
            </Button>
          </div>
        </div>

        {/* Complementary evolution form (compact, single field) — Intercorrência | Vespertina | Noturna */}
        {showIntercurrenceForm && currentComplementary && (
          <div className={cn("rounded-xl border-2 p-3 sm:p-4 space-y-3", currentComplementary.borderClass, currentComplementary.bgClass)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CompIcon className={cn("h-4 w-4", currentComplementary.iconColor)} />
                <span className="text-sm font-semibold text-foreground">{currentComplementary.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => { setComplementaryKind(null); setIntercurrenceText(""); }}
              >
                Cancelar
              </Button>
            </div>
            <RichTextEditor
              value={intercurrenceText}
              onChange={setIntercurrenceText}
              placeholder={currentComplementary.placeholder}
              minHeight={140}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                Registro rápido — fica no prontuário como rascunho até validação.
              </p>
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleCreateIntercurrence}
                disabled={savingIntercurrence || !richHtmlToPlainText(intercurrenceText)}
              >
                {savingIntercurrence ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
                ) : (
                  <><CompIcon className="h-3.5 w-3.5" /> Registrar {currentComplementary.shortLabel}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* New Evolution Form (with Diagnósticos as 1st collapsible section) */}
        {showNewForm && (
          <div className="rounded-xl border-2 border-primary/30 bg-card p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Nova Evolução</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setShowNewForm(false); resetNewForm(); }}>
                Cancelar
              </Button>
            </div>
            <EvolutionForm
              soap={newSoap}
              vitals={newVitals}
              physicalExam={newExam}
              onSOAPChange={(k, v) => setNewSoap(prev => ({ ...prev, [k]: v }))}
              onVitalsChange={(k, v) => setNewVitals(prev => ({ ...prev, [k]: v }))}
              onPhysicalExamChange={(k, v) => setNewExam(prev => ({ ...prev, [k]: v }))}
              onSave={handleCreateEvolution}
              saving={creating}
              diagnosticsSlot={diagnosticsSlot}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando evoluções...</span>
          </div>
        )}

        {/* Timeline */}
        {!loading && (
          <EvolutionTimeline
            evolutions={evolutions}
            admissionDate={getEffectiveAdmissionDate({
              utiAdmissionDate: livePatient?.utiAdmissionDate,
              admittedAt: livePatient?.admittedAt,
              admissionDate: livePatient?.admissionDate || patient.admissionDate,
              sector: livePatient?.sector || initialPatientSector,
            }) || patient.admissionDate}
            patientRecord={prontuarioReal}
            onUpdate={updateEvolution}
            onValidate={validateEvolution}
            onSuspend={suspendEvolution}
            onDelete={deleteEvolution}
            onDuplicate={handleDuplicate}
          />
        )}

        {/* Empty state */}
        {!loading && evolutions.length === 0 && !showNewForm && (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <NotebookPen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma evolução registrada</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Clique em "Nova Evolução" para criar a primeira</p>
          </div>
        )}
        </div>

        {/* Patient Cockpit — fixed right sidebar */}
        <PatientCockpit patient={cockpitPatient} />
      </div>

      {/* Print layout */}
      <div className="hidden print:block p-4 text-black text-[10px] leading-tight">
        <div className="flex items-center justify-between border-b border-black pb-1 mb-2">
          <div>
            <p className="font-bold text-sm">EVOLUÇÃO CLÍNICA</p>
            <p>{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
          </div>
          <img src={bighelpLogo} className="h-6" alt="Logo" />
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2 border border-black/30 p-1.5 rounded">
          <div><strong>Paciente:</strong> {patient.name}</div>
          <div><strong>Leito:</strong> {patient.bed} — {patient.unit}</div>
          <div><strong>Idade:</strong> {patient.age} | <strong>Sexo:</strong> {patient.sex}</div>
          <div><strong>Peso:</strong> {patient.weight}kg | <strong>Alergias:</strong> {patient.allergies}</div>
        </div>
        <div className="mt-8 pt-4 border-t border-black text-center">
          <p>_________________________________</p>
          <p>Médico responsável — CRM</p>
        </div>
      </div>
    </div>
  );
};

export default EvolucaoPage;
