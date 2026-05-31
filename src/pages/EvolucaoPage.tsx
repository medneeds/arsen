import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { SectionLoader } from "@/components/SectionLoader";


import { PatientCockpit } from "@/components/PatientCockpit";
import { SapsPendingAlert } from "@/components/SapsPendingAlert";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import arsenLogo from "@/assets/arsen-logo.png";
import { NormaZeroPrintHeader, generatePrintDocCode } from "@/components/NormaZeroPrintHeader";
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

  // ─── Parâmetros da URL — reativos, atualizados a cada troca de paciente ───
  const initialPatientName   = searchParams.get("patientName")   || "";
  const initialPatientBed    = searchParams.get("patientBed")    || "";
  const initialPatientSector = searchParams.get("patientSector") || "";
  const initialPatientId     = searchParams.get("patientId")     || "";

  const sectorMap: Record<string, string> = {
    red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2",
  };

  // ─── FIX: cabeçalho dessincronizado ao alternar pacientes ──────────────────
  // ANTES: useState(() => {...}) executa UMA VEZ na montagem — ao trocar o
  //   paciente via URL, searchParams muda mas `patient` permanecia stale,
  //   causando o cabeçalho superior mostrar o novo paciente enquanto o corpo
  //   da evolução ainda exibia o anterior.
  //
  // DEPOIS: useMemo reavalia toda vez que qualquer searchParam muda, mantendo
  //   cabeçalho superior e corpo SEMPRE sincronizados com o paciente ativo.
  //
  // ⚠️  CRÍTICO: nunca usar dados-demo (L09/L10/L11 = "Maria das Graças")
  //   quando há patientId real na URL — esse override era a causa do PDF de
  //   evolução vir com cabeçalho de outro paciente em UTI 2 leito 10.
  const patient = useMemo<PatientHeader>(() => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPatientId, initialPatientName, initialPatientBed, initialPatientSector]);

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
  const [diagnosticHypotheses, setDiagnosticHypotheses] = useState<string[]>([]);
  const [antecedentes, setAntecedentes] = useState<string[]>([]);
  const [planItems, setPlanItems] = useState<string[]>([]);
  const [pendenciasItems, setPendenciasItems] = useState<string[]>([]);
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
    setDiagnosticHypotheses([]);
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
    setDiagnosticHypotheses([]);
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
    const hypoStr = Array.isArray(diagnosticHypotheses)
      ? diagnosticHypotheses.filter(Boolean).join("\n")
      : diagnosticHypotheses;
    const result = await createEvolution(
      patient.name, patient.bed, patient.unit,
      soapWithExtras, newVitals, newExam,
      hypoStr,
      cidPrimary || null,
      Array.isArray(cidSecondary) && cidSecondary.length > 0 ? cidSecondary : null,
      antecedentes.filter(Boolean),
      planItems.filter(Boolean),
      pendenciasItems.filter(Boolean),
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
    // Limpa qualquer estado sujo de interações anteriores antes de popular.
    resetNewForm();
    // Restaura snapshot de CID da evolução original no estado do paciente
    const srcCidPrimary = (source as any).cid_primary;
    const srcCidSecondary = (source as any).cid_secondary;
    if (typeof srcCidPrimary === "string" && srcCidPrimary.trim()) {
      updateCidPrimary(srcCidPrimary);
    }
    if (Array.isArray(srcCidSecondary) && srcCidSecondary.length > 0) {
      updateCidSecondary(srcCidSecondary);
    }
    const srcSoap: any = source.soap_data || {};
    const { devices: srcDevices, culturesHtml: srcCulturesHtml, ...soapBase } = srcSoap;
    setNewSoap({ ...soapBase });
    setNewVitals({ ...source.vital_signs });
    setNewExam({ ...source.physical_exam });
    setNewDevices(Array.isArray(srcDevices) ? srcDevices : []);
    setNewCulturesHtml(typeof srcCulturesHtml === "string" ? srcCulturesHtml : "");
    const srcHypo = (source as any).diagnostic_hypotheses;
    const srcAntecedentes = (source as any).antecedentes;
    setDiagnosticHypotheses(typeof srcHypo === "string" ? srcHypo.split("\n").filter(Boolean) : Array.isArray(srcHypo) ? srcHypo : []);
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
      onDiagnosticHypothesesChange={(v) => setDiagnosticHypotheses(Array.isArray(v) ? v : v.split("\n").filter(Boolean))}
      antecedentes={antecedentes}
      onAntecedentesChange={setAntecedentes}
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
          <div className="hidden sm:flex items-center justify-between gap-4 min-w-0 flex-1">
            {/* ESQUERDA: identidade do paciente */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {patient.bed && (
                <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-primary/15 border border-primary/20 shrink-0">
                  <span className="text-[7px] font-bold uppercase tracking-wide text-primary/70 leading-none">Leito</span>
                  <span className="text-base font-extrabold text-primary leading-tight mt-0.5">{patient.bed}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-base font-extrabold text-foreground uppercase tracking-wide leading-tight truncate">
                  {patient.name || "—"}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {patient.unit && <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">{patient.unit}</span>}
                  {patient.age && <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold">{patient.age}</span>}
                  {patient.birthDate && (
                    <>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {(() => { try { const d = new Date(patient.birthDate + 'T12:00:00'); return isNaN(d.getTime()) ? patient.birthDate : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return patient.birthDate; } })()}
                      </span>
                    </>
                  )}
                  {prontuarioReal && (
                    <>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="text-[10px] text-muted-foreground font-mono">Pront. {prontuarioReal}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* DIREITA: título do módulo */}
            <div className="text-right shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground leading-tight">EVOLUÇÃO CLÍNICA</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Timeline de evoluções do paciente</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs border-border text-muted-foreground hover:bg-muted hover:text-foreground flex-1 sm:flex-none min-h-9"
                  disabled={showIntercurrenceForm || showNewForm}
                >
                  Evolução complementar
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
              planItems={planItems}
              onPlanItemsChange={setPlanItems}
              pendenciasItems={pendenciasItems}
              onPendenciasItemsChange={setPendenciasItems}
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

        {/* Loading — SectionLoader cobre toda a área até evoluções estarem prontas */}
        {loading && (
          <SectionLoader
            message="Carregando evoluções"
            subMessage="Buscando registros clínicos do paciente"
          />
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
            diagnosticsSlotFactory={(evoId, onDiagHypoChange, currentDiagHypo) => (
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
                diagnosticHypotheses={currentDiagHypo}
                onDiagnosticHypothesesChange={(v) => {
                  const str = Array.isArray(v) ? v.filter(Boolean).join("\n") : v;
                  onDiagHypoChange(str);
                }}
                antecedentes={antecedentes}
                onAntecedentesChange={setAntecedentes}
                showUtiPrediction={isUtiSector}
                replicated={false}
                onClearAll={handleClearDiagnostics}
              />
            )}
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
      {/* ═══ IMPRESSÃO / PDF — Evolução Clínica ═══
           Layout idêntico ao da Prescrição: NormaZeroPrintHeader institucional
           + tabela de 3 linhas com todos os dados do paciente bem distribuídos.
           Nunca mostrado na tela (hidden print:block). */}
      <div className="hidden print:block" style={{ fontFamily: '"Helvetica Neue", "Segoe UI", Inter, Arial, sans-serif', color: '#1e293b', width: '186mm', margin: '0 auto', lineHeight: 1.3 }}>
        {(() => {
          const docCode = generatePrintDocCode('EVOL');
          const printDate = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

          const cellSt: React.CSSProperties = { border: '0.5px solid #94a3b8', padding: '3px 6px', fontSize: '7.5pt', lineHeight: 1.3, verticalAlign: 'top' };
          const labelSt: React.CSSProperties = { ...cellSt, fontWeight: 700, fontSize: '6.5pt', backgroundColor: '#f1f5f9', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3px' };

          const fmt = (d?: string) => {
            if (!d) return '—';
            try { return format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy'); } catch { return d; }
          };

          return (
            <>
              {/* Cabeçalho institucional Norma Zero */}
              <NormaZeroPrintHeader
                documentLabel="Evolução Clínica"
                documentCode={printDate}
                documentSubtitle={docCode}
                width="186mm"
                variant="compact"
              />

              {/* Tabela de dados do paciente — 3 linhas, 8 colunas */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <tbody>
                  {/* Linha 1: Nome (destaque) */}
                  <tr>
                    <td style={labelSt}>Paciente</td>
                    <td style={{ ...cellSt, fontWeight: 800, fontSize: '9pt', letterSpacing: '-0.01em' }} colSpan={7}>
                      {patient.name || '—'}
                    </td>
                  </tr>
                  {/* Linha 2: Leito / Setor / Prontuário / Atendimento */}
                  <tr>
                    <td style={labelSt}>Leito</td>
                    <td style={{ ...cellSt, fontWeight: 700 }}>{patient.bed || '—'}</td>
                    <td style={labelSt}>Setor / Unidade</td>
                    <td style={{ ...cellSt, fontWeight: 600 }}>{patient.unit || '—'}</td>
                    <td style={labelSt}>Prontuário</td>
                    <td style={{ ...cellSt, fontWeight: 700 }}>{patient.record || '—'}</td>
                    <td style={labelSt}>Nº Atendimento</td>
                    <td style={{ ...cellSt, fontWeight: 700 }}>{ids.atendimento ? `#${ids.atendimento}` : '—'}</td>
                  </tr>
                  {/* Linha 3: Idade / Nascimento / Admissão / Sexo / Peso / Alergias */}
                  <tr>
                    <td style={labelSt}>Idade</td>
                    <td style={cellSt}>{patient.age || '—'}</td>
                    <td style={labelSt}>Data de Nasc.</td>
                    <td style={cellSt}>{fmt(patient.birthDate)}</td>
                    <td style={labelSt}>Admissão</td>
                    <td style={cellSt}>{fmt(patient.admissionDate)}</td>
                    <td style={{ ...labelSt, color: '#dc2626', fontSize: '6pt' }}>⚠ ALERGIAS</td>
                    <td style={{ ...cellSt, fontWeight: 700, color: '#991b1b', backgroundColor: '#fef2f2', fontSize: '7.5pt' }}>
                      {patient.allergies || 'NDAM'}
                    </td>
                  </tr>
                  {/* Linha 4: Sexo / Peso — linha compacta complementar */}
                  <tr>
                    <td style={labelSt}>Sexo</td>
                    <td style={cellSt}>{patient.sex ? (patient.sex.toLowerCase().startsWith('m') ? 'Masculino' : 'Feminino') : '—'}</td>
                    <td style={labelSt}>Peso</td>
                    <td style={cellSt}>{patient.weight ? `${patient.weight} kg` : '—'}</td>
                    <td colSpan={4} style={{ ...cellSt, color: '#64748b', fontSize: '7pt', fontStyle: 'italic' }}>
                      Documento gerado em {printDate} · {docCode}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          );
        })()}

        {/* Rodapé de assinatura */}
        <div style={{ marginTop: '32px', paddingTop: '12px', borderTop: '0.8px solid #1e293b', display: 'flex', justifyContent: 'space-between', fontSize: '7.5pt', color: '#1e293b' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ borderTop: '0.8px solid #94a3b8', width: '160px', margin: '0 auto 4px' }}/>
            <div>Médico responsável</div>
            <div style={{ color: '#475569', fontSize: '7pt' }}>Nome · CRM</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ borderTop: '0.8px solid #94a3b8', width: '160px', margin: '0 auto 4px' }}/>
            <div>Enfermeiro(a) responsável</div>
            <div style={{ color: '#475569', fontSize: '7pt' }}>Nome · COREN</div>
          </div>
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
