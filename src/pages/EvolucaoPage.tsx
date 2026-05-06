import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";


import { PatientCockpit } from "@/components/PatientCockpit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import bighelpLogo from "@/assets/bighelp-map-logo.png";
import {
  NotebookPen, Plus, Loader2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useEvolutions, EvolutionRecord } from "@/hooks/useEvolutions";
import { usePatientCid } from "@/hooks/usePatientCid";
import { usePatientLive } from "@/hooks/usePatientLive";
import { usePatientDiagnosticContext } from "@/hooks/usePatientDiagnosticContext";
import { EvolutionForm } from "@/components/evolution/EvolutionForm";
import { EvolutionTimeline } from "@/components/evolution/EvolutionTimeline";
import { DiagnosticsPanel } from "@/components/evolution/DiagnosticsPanel";
import type { Patient } from "@/types/patient";

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

  // New evolution form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [showIntercurrenceForm, setShowIntercurrenceForm] = useState(false);
  const [intercurrenceText, setIntercurrenceText] = useState("");
  const [savingIntercurrence, setSavingIntercurrence] = useState(false);
  const [newSoap, setNewSoap] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [newVitals, setNewVitals] = useState({ pa: "", fc: "", fr: "", temp: "", spo2: "", glasgow: "", diurese: "", dor: "" });
  const [newExam, setNewExam] = useState({ general: "", cardiovascular: "", respiratory: "", abdomen: "", neurological: "", extremities: "", skin: "", other: "" });
  const [creating, setCreating] = useState(false);
  const [diagnosticsReplicated, setDiagnosticsReplicated] = useState(false);

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
  };

  const handleClearDiagnostics = () => {
    if (cidPrimary) updateCidPrimary("");
    if (cidSecondary?.length) updateCidSecondary([]);
    if (utiDischargePrediction) updateUtiDischargePrediction("");
    if (hospitalDischargePrediction) updateHospitalDischargePrediction("");
    if (isPalliative) updateIsPalliative(false);
    if (isolationPrecautions) updateIsolationPrecautions("");
    setDiagnosticsReplicated(false);
  };

  const handleCreateEvolution = async () => {
    setCreating(true);
    const result = await createEvolution(
      patient.name, patient.bed, patient.unit,
      newSoap, newVitals, newExam
    );
    setCreating(false);
    if (result) {
      setShowNewForm(false);
      resetNewForm();
    }
  };

  const handleCreateIntercurrence = async () => {
    const text = intercurrenceText.trim();
    if (!text) return;
    setSavingIntercurrence(true);
    const result = await createEvolution(
      patient.name, patient.bed, patient.unit,
      { subjective: text, objective: "", assessment: "", plan: "", type: "intercurrence" } as any,
      undefined,
      undefined
    );
    setSavingIntercurrence(false);
    if (result) {
      setIntercurrenceText("");
      setShowIntercurrenceForm(false);
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
      utiAllergies: patient.allergies && patient.allergies !== "NDAM" ? [patient.allergies] : [],
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
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 flex-1 sm:flex-none min-h-9"
              onClick={() => { setShowIntercurrenceForm(true); setIntercurrenceText(""); }}
              disabled={showIntercurrenceForm || showNewForm}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Intercorrência
            </Button>
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

        {/* Intercurrence Form (compact, single field) */}
        {showIntercurrenceForm && (
          <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-foreground">Intercorrência</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => { setShowIntercurrenceForm(false); setIntercurrenceText(""); }}
              >
                Cancelar
              </Button>
            </div>
            <Textarea
              value={intercurrenceText}
              onChange={e => setIntercurrenceText(e.target.value)}
              placeholder="Descreva a intercorrência (ex.: queda da própria altura às 14h, sem perda de consciência; novo episódio de hipotensão, PA 80x40 às 03h; dessaturação após mobilização...)"
              className="min-h-[140px] text-sm resize-y"
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
                disabled={savingIntercurrence || !intercurrenceText.trim()}
              >
                {savingIntercurrence ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
                ) : (
                  <><AlertTriangle className="h-3.5 w-3.5" /> Registrar Intercorrência</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* New Evolution Form (with Diagnósticos as 1st collapsible section) */}
        {showNewForm && (
          <div className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-3">
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
            admissionDate={patient.admissionDate}
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
