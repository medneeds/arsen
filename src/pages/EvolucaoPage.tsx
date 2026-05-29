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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
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
    // ⚠️  CRÍTICO: nunca usar dados-demo (L09/L10/L11 = "Maria das Graças")
    // quando há patientId real na URL — esse override era a causa do PDF de
    // evolução vir com cabeçalho de outro paciente em UTI 2 leito 10.
    const hasRealPatient = !!initialPatientId;
    const demoPatients: Record<string, Omit<PatientHeader, "bed" | "unit">> = {
      L09: { name: "Iglesio Ferreira da Silva", birthDate: "1953-07-14", age: "72 anos", sex: "Masculino", record: "PRN-2024-08451", admissionDate: "2026-03-15", weight: "78", allergies: "Dipirona, Sulfa" },
      L10: { name: "Maria das Graças Oliveira", birthDate: "1948-02-22", age: "78 anos", sex: "Feminino", record: "PRN-2024-09102", admissionDate: "2026-03-14", weight: "62", allergies: "NDAM" },
      L11: { name: "José Carlos Mendes", birthDate: "1960-11-03", age: "65 anos", sex: "Masculino", record: "PRN-2024-07833", admissionDate: "2026-03-16", weight: "85", allergies: "Penicilina, AAS" },
    };
    const demo = !hasRealPatient && demoPatients[initialPatientBed]
      ? demoPatients[initialPatientBed]
      : { name: "", birthDate: "", age: "", sex: "", record: "", admissionDate: "", weight: "", allergies: "" };
    return {
      ...demo,
      name: hasRealPatient ? initialPatientName : (demo.name || initialPatientName),
      bed: initialPatientBed,
      unit: sectorMap[initialPatientSector] || initialPatientSector,
    };
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
  const [newDevices, setNewDevices] = useState<import("@/lib/devicesCatalog").EvolutionDevice[]>([]);
  const [newCulturesHtml, setNewCulturesHtml] = useState("");
  const [creating, setCreating] = useState(false);
  const [diagnosticsReplicated, setDiagnosticsReplicated] = useState(false);
  const [diagnosticHypotheses, setDiagnosticHypotheses] = useState("");
  const [pendingDuplicate, setPendingDuplicate] = useState<EvolutionRecord | null>(null);

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
    setNewDevices([]);
    setNewCulturesHtml("");
    setDiagnosticsReplicated(false);
    setDiagnosticHypotheses("");
  };

  /**
   * Nova Evolução: abre SEMPRE em branco. Sem prefill de hipóteses, dispositivos,
   * culturas ou SOAP. O médico escreve do zero. Apenas marca o banner de "replicado"
   * quando o paciente já possui contexto diagnóstico vindo da admissão (CIDs,
   * previsão de alta, paliativo, isolamento) — esses campos pertencem ao paciente,
   * não à evolução, e continuam aparecendo como hoje.
   */
  const handleOpenNewEvolution = () => {
    resetNewForm();
    setShowNewForm(true);
    const hasContext = !!(cidPrimary || cidSecondary?.length || utiDischargePrediction || hospitalDischargePrediction || isPalliative || isolationPrecautions);
    if (hasContext) {
      setDiagnosticsReplicated(true);
    }
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
    // Estende soap_data com devices + culturesHtml (JSONB preserva chaves extras)
    const soapWithExtras = {
      ...newSoap,
      devices: newDevices,
      culturesHtml: newCulturesHtml,
    } as any;
    const result = await createEvolution(
      patient.name, patient.bed, patient.unit,
      soapWithExtras, newVitals, newExam,
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

  /** Aplica a duplicação real (sem confirmação). Mantém o comportamento original:
   *  copia SOAP, sinais vitais, exame físico, dispositivos, culturas e hipóteses da fonte. */
  const performDuplicate = (source: EvolutionRecord) => {
    const srcSoap: any = source.soap_data || {};
    const { devices: srcDevices, culturesHtml: srcCulturesHtml, ...soapBase } = srcSoap;
    setNewSoap({ ...soapBase });
    setNewVitals({ ...source.vital_signs });
    setNewExam({ ...source.physical_exam });
    setNewDevices(Array.isArray(srcDevices) ? srcDevices : []);
    setNewCulturesHtml(typeof srcCulturesHtml === "string" ? srcCulturesHtml : "");
    const srcHypo = (source as any).diagnostic_hypotheses;
    if (typeof srcHypo === "string") setDiagnosticHypotheses(srcHypo);
    setShowNewForm(true);
    setDiagnosticsReplicated(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Confirmação leve antes de duplicar — evita cópia acidental sobre rascunho em andamento. */
  const handleDuplicate = async (source: EvolutionRecord) => {
    setPendingDuplicate(source);
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
      diagnosticHypotheses={diagnosticHypotheses}
      onDiagnosticHypothesesChange={setDiagnosticHypotheses}
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
        {/* Page Header — title + patient identity inline */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="hidden sm:flex items-center gap-3 min-w-0 flex-1">
            {patient.bed && (
              <div className="flex flex-col items-center justify-center h-10 w-10 rounded-lg bg-primary/15 border border-primary/20 shrink-0">
                <span className="text-[7px] font-bold uppercase tracking-wide text-primary/70 leading-none">Leito</span>
                <span className="text-sm font-extrabold text-primary leading-tight mt-0.5">{patient.bed}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">EVOLUÇÃO CLÍNICA</h1>
                {patient.name && <div className="h-4 w-px bg-border/60 hidden sm:block" />}
                {patient.name && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide truncate max-w-[220px]">{patient.name}</span>
                    {patient.unit && <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">{patient.unit}</span>}
                  </div>
                )}
              </div>
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
              diagnosticsReviewSlot={diagnosticsSlot}
              cidPrimary={cidPrimary}
              cidSecondary={cidSecondary}
              devices={newDevices}
              onDevicesChange={setNewDevices}
              culturesHtml={newCulturesHtml}
              onCulturesChange={setNewCulturesHtml}
              admissionDate={
                getEffectiveAdmissionDate({
                  utiAdmissionDate: livePatient?.utiAdmissionDate,
                  admittedAt: livePatient?.admittedAt,
                  admissionDate: livePatient?.admissionDate || patient.admissionDate,
                  sector: livePatient?.sector || initialPatientSector,
                }) || patient.admissionDate
              }
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
            patientId={initialPatientId || null}
            cidPrimary={cidPrimary}
            cidSecondary={Array.isArray(cidSecondary) ? cidSecondary.join(", ") : cidSecondary}
            diagnosticsSlot={diagnosticsSlot}
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

      {/* Confirmação leve antes de duplicar uma evolução */}
      <AlertDialog open={!!pendingDuplicate} onOpenChange={(open) => { if (!open) setPendingDuplicate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>DUPLICAR ESTA EVOLUÇÃO?</AlertDialogTitle>
            <AlertDialogDescription>
              Será aberta uma nova evolução com os dados desta (S/O/A/P, sinais vitais, exame físico,
              dispositivos, culturas e hipóteses). Você poderá editar tudo antes de salvar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDuplicate) performDuplicate(pendingDuplicate);
                setPendingDuplicate(null);
              }}
            >
              Duplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EvolucaoPage;
