import React, { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Shield, Printer, Plus, Trash2, AlertTriangle, FileText, ClipboardList,
  Loader2, FlaskConical, Check, ChevronsUpDown, Pill, CheckCircle2, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ANTIMICROBIAL_OPTIONS, type MedicationEntry } from "@/data/medicationsDatabase";
import { useUnifiedMedicationCatalog } from "@/hooks/useUnifiedMedicationCatalog";
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";
import { cn } from "@/lib/utils";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";

interface AntimicrobialEntry {
  id: string;
  medication: string;
  presentation: string;
  dose: string;
  route: string;
  posology: string;
  startDate: string;
  plannedDuration: string;
  justification: string;
  infectionSite: string;
  cultureCollected: "sim" | "nao" | "pendente";
  cultureResult: string;
  previousAntibiotic: string;
  ccihApproval: "pendente" | "aprovado" | "restrito" | "negado";
  ccihNotes: string;
}

interface PatientData {
  name: string;
  bed: string;
  record: string;
  age: string;
  sex: string;
  weight: string;
  allergies: string;
  unit: string;
}

interface PrescriptionItem {
  id: string;
  name: string;
  dose: string;
  route: string;
  posology: string;
  category: string;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientData;
  antimicrobialItems?: PrescriptionItem[];
  doctorName?: string;
  doctorCrm?: string;
  hospitalName?: string;
  onConfirm?: (entries: Array<{
    medication: string; dose: string; route: string; posology: string;
    startDate?: string; plannedDuration?: string; infectionSite?: string;
  }>) => void;
  mode?: 'review' | 'prescribe';
  patientId?: string;
}

function computeEndDate(startDate: string, days: string): string | null {
  const n = parseInt(days, 10);
  if (!startDate || !Number.isFinite(n) || n <= 0) return null;
  const d = new Date(startDate + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + n - 1);
  return format(d, "dd/MM/yyyy");
}

const INFECTION_SITES = [
  "Pneumonia comunitária", "Pneumonia nosocomial / PAV", "ITU complicada", "ITU não complicada",
  "Infecção de pele e partes moles", "Sepse / Choque séptico", "Meningite", "Endocardite",
  "Infecção intra-abdominal", "Infecção de corrente sanguínea", "Infecção de sítio cirúrgico",
  "Profilaxia cirúrgica", "Osteomielite", "Artrite séptica", "Neutropenia febril",
  "Infecção fúngica invasiva", "Tuberculose", "Outro",
];

const RESTRICTION_CLASSES = [
  { value: "livre", label: "Livre", color: "text-emerald-600" },
  { value: "restrito_24h", label: "Restrito (liberar em 24h)", color: "text-amber-600" },
  { value: "restrito_ccih", label: "Restrito CCIH (aguardar)", color: "text-red-600" },
  { value: "profilaxia", label: "Profilaxia (máx 24h)", color: "text-blue-600" },
];

// === Validação obrigatória para anexar à prescrição ===
// Campos exigidos pela CCIH/Norma Zero antes de o ATB entrar no corpo da prescrição.
// Se faltar qualquer um, o "Anexar" é bloqueado e a UI guia o médico.
const REQUIRED_LABELS: Record<string, string> = {
  medication: "Antimicrobiano",
  dose: "Dose",
  route: "Via",
  posology: "Posologia",
  startDate: "Data de início",
  infectionSite: "Sítio de infecção",
  justification: "Justificativa clínica",
};

function getMissingFields(e: AntimicrobialEntry): string[] {
  const missing: string[] = [];
  if (!e.medication?.trim()) missing.push(REQUIRED_LABELS.medication);
  if (!e.dose?.trim()) missing.push(REQUIRED_LABELS.dose);
  if (!e.route?.trim()) missing.push(REQUIRED_LABELS.route);
  if (!e.posology?.trim()) missing.push(REQUIRED_LABELS.posology);
  if (!e.startDate?.trim()) missing.push(REQUIRED_LABELS.startDate);
  if (!e.infectionSite?.trim()) missing.push(REQUIRED_LABELS.infectionSite);
  if (!e.justification?.trim()) missing.push(REQUIRED_LABELS.justification);
  return missing;
}

const Req = () => <span className="text-red-500 ml-0.5" aria-label="obrigatório">*</span>;

function createEmptyEntry(item?: PrescriptionItem | MedicationEntry): AntimicrobialEntry {
  const isMed = item && 'defaultDose' in item;
  return {
    id: crypto.randomUUID(),
    medication: item ? (isMed ? (item as MedicationEntry).name : (item as PrescriptionItem).name) : "",
    presentation: item && isMed ? (item as MedicationEntry).presentation || "" : "",
    dose: item ? (isMed ? (item as MedicationEntry).defaultDose : (item as PrescriptionItem).dose) : "",
    route: item ? (isMed ? (item as MedicationEntry).defaultRoute : (item as PrescriptionItem).route) : "",
    posology: item ? (isMed ? (item as MedicationEntry).defaultPosology : (item as PrescriptionItem).posology) : "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    plannedDuration: "",
    justification: "",
    infectionSite: "",
    cultureCollected: "nao",
    cultureResult: "",
    previousAntibiotic: "",
    ccihApproval: "pendente",
    ccihNotes: "",
  };
}

// === Searchable antimicrobial combobox (allows free text + selectable presets) ===
function AntimicrobialCombobox({
  value, onSelectMed, onChangeText, options,
}: {
  value: string;
  onSelectMed: (med: MedicationEntry) => void;
  onChangeText: (text: string) => void;
  options: MedicationEntry[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-8 text-xs font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Selecionar antimicrobiano ou digitar..."}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar ou digitar nome livre..."
            className="h-9 text-xs"
            value={value}
            onValueChange={onChangeText}
          />
          <CommandList className="max-h-[280px]">
            <CommandEmpty className="py-3 px-3 text-xs text-muted-foreground">
              Nenhum antimicrobiano padrão. O texto digitado será usado.
            </CommandEmpty>
            <CommandGroup heading="Padronizados">
              {options.map(med => (
                <CommandItem
                  key={med.id}
                  value={`${med.name} ${med.presentation || ''}`}
                  onSelect={() => { onSelectMed(med); setOpen(false); }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === med.name ? "opacity-100 text-violet-600" : "opacity-0")} />
                  <Pill className="mr-1.5 h-3 w-3 text-violet-500 shrink-0" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium truncate">{med.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {med.presentation} · {med.defaultDose} {med.defaultPosology} {med.defaultRoute}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AntimicrobialGuideDialog({
  open, onOpenChange, patient, antimicrobialItems = [],
  doctorName: doctorNameProp = "", doctorCrm: doctorCrmProp = "", hospitalName = "",
  onConfirm, mode = 'review', patientId,
}: Props) {
  const currentDoctor = useCurrentDoctor();
  // Sincroniza com o usuário logado quando a prescrição não estiver assinada digitalmente
  const doctorName = doctorNameProp || currentDoctor.fullName;
  const doctorCrm = doctorCrmProp || currentDoctor.crm;
  const { antimicrobials: unifiedAntimicrobials } = useUnifiedMedicationCatalog();
  const antimicrobialOptions = unifiedAntimicrobials.length > 0 ? unifiedAntimicrobials : ANTIMICROBIAL_OPTIONS;
  const [entries, setEntries] = useState<AntimicrobialEntry[]>([]);
  const [loadingImport, setLoadingImport] = useState<Record<string, 'history' | 'evolution' | 'cultures' | null>>({});
  const [availableCultures, setAvailableCultures] = useState<Array<{ id: string; culture_type: string; collection_date: string | null; status: string; microorganism: string | null; antibiogram: string | null; sensitivity_profile: string | null; result_text: string | null; created_at: string }>>([]);
  const draftKey = patientId ? `atb-draft-${patientId}` : null;
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Mapa de erros por entrada (sempre calculado, mas só exibido após tentativa de anexar
  // ou quando o item já tem alguma coisa preenchida — evita poluir a tela inicial).
  const missingByEntry = useMemo(() => {
    const map: Record<string, string[]> = {};
    entries.forEach(e => { map[e.id] = getMissingFields(e); });
    return map;
  }, [entries]);
  const allValid = entries.length > 0 && entries.every(e => missingByEntry[e.id].length === 0);
  const validCount = entries.filter(e => missingByEntry[e.id].length === 0).length;

  useEffect(() => {
    if (!open) return;
    // Modo "prescribe" (busca de ATB ou nova solicitação via AtmStatusDialog):
    // SEMPRE seed limpo a partir do parent — nunca usar rascunho antigo do
    // localStorage, que provocaria anexar o medicamento errado.
    if (mode === 'prescribe') {
      if (antimicrobialItems.length > 0) {
        setEntries(antimicrobialItems.filter(i => i.status === 'active').map(item => createEmptyEntry(item)));
      } else {
        setEntries([createEmptyEntry()]);
      }
      return;
    }
    // Modo "review": restaura rascunho salvo se existir
    if (draftKey) {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw) as AntimicrobialEntry[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEntries(parsed);
            return;
          }
        }
      } catch {/* ignore */}
    }
    if (antimicrobialItems.length > 0) {
      setEntries(antimicrobialItems.filter(i => i.status === 'active').map(item => createEmptyEntry(item)));
    } else {
      setEntries([createEmptyEntry()]);
    }
  }, [open, antimicrobialItems, draftKey, mode]);

  useEffect(() => {
    if (open && patientId) {
      supabase
        .from('culture_results')
        .select('id, culture_type, collection_date, status, microorganism, antibiogram, sensitivity_profile, result_text, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setAvailableCultures(data); });
    }
  }, [open, patientId]);

  const updateEntry = (id: string, field: keyof AntimicrobialEntry, value: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const updateEntryFromMed = (id: string, med: MedicationEntry) => {
    setEntries(prev => prev.map(e => e.id === id ? {
      ...e,
      medication: med.name,
      presentation: med.presentation || '',
      dose: med.defaultDose || e.dose,
      route: med.defaultRoute || e.route,
      posology: med.defaultPosology || e.posology,
    } : e));
  };

  const addEntry = () => setEntries(prev => [...prev, createEmptyEntry()]);
  const removeEntry = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  const importAdmissionHistory = async (entryId: string) => {
    if (!patientId) return;
    setLoadingImport(prev => ({ ...prev, [entryId]: 'history' }));
    try {
      const { data: admHistory } = await supabase
        .from('admission_histories')
        .select('chief_complaint, clinical_history, diagnostic_hypothesis, initial_conduct')
        .eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (admHistory) {
        const parts = [
          admHistory.chief_complaint && `QUEIXA PRINCIPAL: ${admHistory.chief_complaint}`,
          admHistory.clinical_history && `HISTÓRIA CLÍNICA: ${admHistory.clinical_history}`,
          admHistory.diagnostic_hypothesis && `HIPÓTESE DIAGNÓSTICA: ${admHistory.diagnostic_hypothesis}`,
          admHistory.initial_conduct && `CONDUTA INICIAL: ${admHistory.initial_conduct}`,
        ].filter(Boolean).join('\n');
        if (parts) {
          const cur = entries.find(e => e.id === entryId)?.justification || '';
          updateEntry(entryId, 'justification', cur + (cur ? '\n\n' : '') + `[HISTÓRIA ADMISSIONAL]\n${parts}`);
          return;
        }
      }
      const { data: patientData } = await supabase.from('patients').select('admission_history').eq('id', patientId).maybeSingle();
      if (patientData?.admission_history) {
        const cur = entries.find(e => e.id === entryId)?.justification || '';
        updateEntry(entryId, 'justification', cur + (cur ? '\n\n' : '') + `[HISTÓRIA ADMISSIONAL]\n${patientData.admission_history}`);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingImport(prev => ({ ...prev, [entryId]: null })); }
  };

  const importEvolution = async (entryId: string) => {
    if (!patientId) return;
    setLoadingImport(prev => ({ ...prev, [entryId]: 'evolution' }));
    try {
      const { data: patientData } = await supabase
        .from('patients')
        .select('diagnoses, medical_history, relevant_exams, pendencies, uti_cultures_antibiotics, uti_current_status')
        .eq('id', patientId).maybeSingle();
      if (patientData) {
        const parts = [
          patientData.diagnoses && `DIAGNÓSTICOS: ${patientData.diagnoses}`,
          patientData.medical_history && `ANTECEDENTES: ${patientData.medical_history}`,
          patientData.relevant_exams && `EXAMES RELEVANTES: ${patientData.relevant_exams}`,
          patientData.uti_cultures_antibiotics && `CULTURAS/ATB: ${patientData.uti_cultures_antibiotics}`,
          patientData.uti_current_status && `STATUS ATUAL: ${patientData.uti_current_status}`,
          patientData.pendencies && `PENDÊNCIAS/PROGRAMAÇÕES: ${patientData.pendencies}`,
        ].filter(Boolean).join('\n');
        if (parts) {
          const cur = entries.find(e => e.id === entryId)?.justification || '';
          updateEntry(entryId, 'justification', cur + (cur ? '\n\n' : '') + `[EVOLUÇÃO CLÍNICA]\n${parts}`);
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoadingImport(prev => ({ ...prev, [entryId]: null })); }
  };

  const importCultureResults = async (entryId: string) => {
    if (!patientId || availableCultures.length === 0) return;
    setLoadingImport(prev => ({ ...prev, [entryId]: 'cultures' }));
    try {
      const cultureLines = availableCultures.map(c => [
        `• Tipo: ${c.culture_type || 'N/I'}`,
        c.collection_date ? `  Data coleta: ${format(new Date(c.collection_date + 'T12:00:00'), 'dd/MM/yyyy')}` : `  Solicitado em: ${format(new Date(c.created_at), 'dd/MM/yyyy')}`,
        `  Status: ${c.status === 'completed' ? 'Concluída' : c.status === 'pending' ? 'Pendente' : c.status}`,
        c.microorganism ? `  Microrganismo: ${c.microorganism}` : null,
        c.antibiogram ? `  Antibiograma: ${c.antibiogram}` : null,
        c.sensitivity_profile ? `  Perfil sensibilidade: ${c.sensitivity_profile}` : null,
        c.result_text ? `  Resultado: ${c.result_text}` : null,
      ].filter(Boolean).join('\n')).join('\n\n');
      const currentEntry = entries.find(e => e.id === entryId);
      if (currentEntry) {
        const hasCompleted = availableCultures.some(c => c.status === 'completed');
        const hasPending = availableCultures.some(c => c.status === 'pending');
        updateEntry(entryId, 'cultureCollected', hasCompleted ? 'sim' : hasPending ? 'pendente' : 'sim');
        const completedCultures = availableCultures.filter(c => c.microorganism || c.result_text);
        const resultSummary = completedCultures.map(c =>
          [c.microorganism, c.sensitivity_profile || c.antibiogram].filter(Boolean).join(' — ')
        ).filter(Boolean).join('; ');
        if (resultSummary) updateEntry(entryId, 'cultureResult', resultSummary);
        const cur = currentEntry.justification || '';
        updateEntry(entryId, 'justification', cur + (cur ? '\n\n' : '') + `[RESULTADOS DE CULTURAS]\n${cultureLines}`);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingImport(prev => ({ ...prev, [entryId]: null })); }
  };

  const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  // === PRINT (Norma Zero) ===
  const handlePrint = async (sourceEntries: AntimicrobialEntry[] = entries) => {
    const valid = sourceEntries.filter(e => e.medication.trim());
    if (valid.length === 0) return;
    const logoData = await prepareLogo();
    const html = buildNormaZeroDocument({
      title: "GUIA DE USO DE ANTIMICROBIANOS",
      subtitle: hospitalName ? `${hospitalName} — Comissão de Controle de Infecção Hospitalar (CCIH)` : "Comissão de Controle de Infecção Hospitalar (CCIH)",
      sectorLabel: `CCIH · ${patient.unit || 'Unidade'}`,
      hospitalName,
      docCodePrefix: "ATM",
      bodyHtml: buildAtmBodyHtml({ patient, entries: valid, doctorName, doctorCrm, today }),
      signatures: [
        { label: "Médico Prescritor", caption: doctorName ? `${doctorName} — CRM ${doctorCrm || '____'}` : undefined },
        { label: "Farmacêutico Clínico", caption: "CRF: ____________" },
        { label: "CCIH — Aprovação", caption: "Data: ___/___/______" },
      ],
      logoDataUrl: logoData,
      orientation: "portrait",
      extraStyles: `
        .atm-block { margin-bottom: 8px; page-break-inside: avoid; }
        .atm-section { background:#ea580c; color:#fff; font-weight:800; font-size:7.5pt; padding:4px 6px; text-transform:uppercase; letter-spacing:0.5px; }
        .atm-warn { color:#dc2626; font-weight:700; }
      `,
    });
    openPrintWindow(html, "Preparando Guia ATM…");
  };

  const validEntries = () => entries.filter(e => getMissingFields(e).length === 0);

  // Centraliza e destaca a primeira entrada incompleta
  const focusFirstInvalid = (): boolean => {
    const firstInvalid = entries.find(e => missingByEntry[e.id]?.length > 0);
    if (!firstInvalid) return false;
    setHighlightId(firstInvalid.id);
    setTimeout(() => {
      entryRefs.current[firstInvalid.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    setTimeout(() => setHighlightId(null), 2500);
    return true;
  };

  const doAttach = (close: boolean): boolean => {
    if (!onConfirm) return false;
    setShowErrors(true);
    if (entries.length === 0) {
      toast.error("Adicione pelo menos um antimicrobiano antes de anexar.");
      return false;
    }
    const valid = validEntries();
    if (valid.length !== entries.length) {
      const firstMissing = entries.find(e => missingByEntry[e.id]?.length > 0);
      const fields = firstMissing ? missingByEntry[firstMissing.id].join(', ') : '';
      toast.error("Não é possível anexar: campos obrigatórios em aberto.", {
        description: fields ? `Faltando: ${fields}` : undefined,
      });
      focusFirstInvalid();
      return false;
    }
    onConfirm(valid.map(e => ({
      medication: e.medication, dose: e.dose, route: e.route, posology: e.posology,
      startDate: e.startDate, plannedDuration: e.plannedDuration, infectionSite: e.infectionSite,
    })));
    if (draftKey) localStorage.removeItem(draftKey);
    if (close) onOpenChange(false);
    return true;
  };

  const handleAttachOnly = () => doAttach(true);
  const handlePrintOnly = async () => { await handlePrint(); };
  const handleAttachAndPrint = async () => {
    // Valida primeiro; só imprime se o anexo for válido — evita imprimir Guia
    // com campos vazios que não vão entrar na prescrição.
    setShowErrors(true);
    const valid = entries.length > 0 && entries.every(e => getMissingFields(e).length === 0);
    if (!valid) {
      toast.error("Complete os campos obrigatórios antes de imprimir + anexar.");
      focusFirstInvalid();
      return;
    }
    await handlePrint();
    doAttach(true);
  };
  const handleSaveDraft = () => {
    if (!draftKey) { toast.error("Sem paciente vinculado para salvar rascunho"); return; }
    try {
      localStorage.setItem(draftKey, JSON.stringify(entries));
      toast.success("Rascunho da Guia ATM salvo");
      onOpenChange(false);
    } catch { toast.error("Falha ao salvar rascunho"); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-[96vw] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-3 border-b shrink-0 bg-violet-50/50 dark:bg-violet-950/15">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-violet-500" />
              GUIA DE USO DE ANTIMICROBIANOS — CCIH
            </DialogTitle>
            <DialogDescription className="text-xs">
              Formulário de justificativa e autorização conforme normativa ANVISA / CCIH. Selecione antimicrobianos padronizados ou digite livremente.
            </DialogDescription>
          </DialogHeader>

          {/* === SCROLLABLE BODY === */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-4 space-y-4">
              {/* Patient Summary */}
              <div className="rounded-lg border border-violet-200/70 bg-violet-50/50 dark:bg-violet-950/15 dark:border-violet-800/30 p-3">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Paciente:</span> <strong>{patient.name}</strong></div>
                  <div><span className="text-muted-foreground">Leito:</span> <strong>{patient.bed}</strong></div>
                  <div><span className="text-muted-foreground">Prontuário:</span> <strong>{patient.record || "—"}</strong></div>
                  <div><span className="text-muted-foreground">Peso:</span> <strong>{patient.weight ? `${patient.weight}kg` : "—"}</strong></div>
                </div>
                {patient.allergies && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" /> Alergias: <strong>{patient.allergies}</strong>
                  </div>
                )}
              </div>

              {/* Checklist obrigatória — só no modo prescribe (anexar à prescrição) */}
              {mode === 'prescribe' && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/15 p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                        Para anexar à prescrição é obrigatório preencher:
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                        {Object.values(REQUIRED_LABELS).map(l => (
                          <span key={l} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-300 bg-white dark:bg-amber-950/30">
                            <Req />{l}
                          </span>
                        ))}
                      </div>
                      <div className="text-[10.5px] text-amber-700 dark:text-amber-400 mt-1.5">
                        Itens marcados com <Req /> são exigidos pela CCIH/ANVISA. O botão "Anexar" só libera quando todos estiverem preenchidos em <strong>cada</strong> antimicrobiano.
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {entries.map((entry, idx) => {
                const missing = missingByEntry[entry.id] || [];
                const isComplete = missing.length === 0;
                const showThisError = mode === 'prescribe' && (showErrors || highlightId === entry.id);
                const cardCls = cn(
                  "rounded-lg border p-4 space-y-3 transition-all",
                  highlightId === entry.id ? "border-red-400 ring-2 ring-red-200 dark:ring-red-900/40" :
                    showThisError && !isComplete ? "border-amber-300 dark:border-amber-700/60" :
                    isComplete && mode === 'prescribe' ? "border-emerald-200 dark:border-emerald-800/40" :
                    "border-border"
                );
                return (
                <div
                  key={entry.id}
                  ref={(el) => { entryRefs.current[entry.id] = el; }}
                  className={cardCls}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-violet-600 border-violet-300 shrink-0">ATM {idx + 1}</Badge>
                      <span className="truncate">{entry.medication || "Novo antimicrobiano"}</span>
                      {mode === 'prescribe' && (
                        isComplete ? (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 gap-1 text-[10px] font-normal">
                            <CheckCircle2 className="h-3 w-3" /> Pronto p/ anexar
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/20 gap-1 text-[10px] font-normal">
                            <AlertCircle className="h-3 w-3" /> Faltam {missing.length} campo(s)
                          </Badge>
                        )
                      )}
                    </h3>
                    {entries.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeEntry(entry.id)} className="h-7 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {showThisError && !isComplete && (
                    <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-800/40 rounded px-2 py-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div>
                        <strong>Para anexar este antimicrobiano, preencha:</strong> {missing.join(', ')}.
                      </div>
                    </div>
                  )}
                  {/* Antimicrobial picker (combobox) */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <Label className="text-[10px]">Antimicrobiano (selecionar ou digitar)</Label>
                      <AntimicrobialCombobox
                        value={entry.medication}
                        onSelectMed={(med) => updateEntryFromMed(entry.id, med)}
                        onChangeText={(text) => updateEntry(entry.id, "medication", text)}
                        options={antimicrobialOptions}
                      />
                      {entry.presentation && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">📦 {entry.presentation}</div>
                      )}
                    </div>
                    <div>
                      <Label className="text-[10px]">Dose</Label>
                      <Input value={entry.dose} onChange={e => updateEntry(entry.id, "dose", e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Via</Label>
                      <Input value={entry.route} onChange={e => updateEntry(entry.id, "route", e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[10px]">Posologia</Label>
                      <Input value={entry.posology} onChange={e => updateEntry(entry.id, "posology", e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Data de Início</Label>
                      <Input type="date" value={entry.startDate} onChange={e => updateEntry(entry.id, "startDate", e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Duração Prevista (dias)</Label>
                      <Input value={entry.plannedDuration} onChange={e => updateEntry(entry.id, "plannedDuration", e.target.value)} placeholder="Ex: 7" className="h-8 text-xs" />
                      {(() => {
                        const end = computeEndDate(entry.startDate, entry.plannedDuration);
                        return end ? (
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                            Previsão de fim: <strong>{end}</strong>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div>
                      <Label className="text-[10px]">Classe de Restrição</Label>
                      <Select value={entry.ccihApproval} onValueChange={v => updateEntry(entry.id, "ccihApproval", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RESTRICTION_CLASSES.map(rc => (
                            <SelectItem key={rc.value} value={rc.value} className="text-xs">
                              <span className={rc.color}>{rc.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Sítio de Infecção / Indicação Clínica</Label>
                      <Select value={entry.infectionSite} onValueChange={v => updateEntry(entry.id, "infectionSite", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {INFECTION_SITES.map(site => (
                            <SelectItem key={site} value={site} className="text-xs">{site}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Antibiótico Prévio (se troca)</Label>
                      <Input value={entry.previousAntibiotic} onChange={e => updateEntry(entry.id, "previousAntibiotic", e.target.value)} placeholder="Medicamento anterior" className="h-8 text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Cultura Coletada?</Label>
                      <Select value={entry.cultureCollected} onValueChange={v => updateEntry(entry.id, "cultureCollected", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim" className="text-xs">Sim</SelectItem>
                          <SelectItem value="nao" className="text-xs">Não</SelectItem>
                          <SelectItem value="pendente" className="text-xs">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <Label className="text-[10px]">Resultado da Cultura / Antibiograma</Label>
                        {patientId && (
                          <Button
                            type="button" variant="outline" size="sm"
                            onClick={() => importCultureResults(entry.id)}
                            disabled={!!loadingImport[entry.id] || availableCultures.length === 0}
                            className="h-6 text-[10px] gap-1 px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                          >
                            {loadingImport[entry.id] === 'cultures' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
                            Importar Culturas ({availableCultures.length})
                          </Button>
                        )}
                      </div>
                      <Input value={entry.cultureResult} onChange={e => updateEntry(entry.id, "cultureResult", e.target.value)} placeholder="Microrganismo / Sensibilidade" className="h-8 text-xs" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[10px]">Justificativa Clínica</Label>
                      {patientId && (
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="outline" size="sm" onClick={() => importAdmissionHistory(entry.id)} disabled={!!loadingImport[entry.id]} className="h-6 text-[10px] gap-1 px-2">
                            {loadingImport[entry.id] === 'history' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                            Importar Hx Admissional
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => importEvolution(entry.id)} disabled={!!loadingImport[entry.id]} className="h-6 text-[10px] gap-1 px-2">
                            {loadingImport[entry.id] === 'evolution' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
                            Importar Evolução
                          </Button>
                        </div>
                      )}
                    </div>
                    <Textarea value={entry.justification} onChange={e => updateEntry(entry.id, "justification", e.target.value)} placeholder="Descreva a indicação clínica para uso deste antimicrobiano..." className="text-xs min-h-[80px] resize-y" />
                  </div>

                  <div>
                    <Label className="text-[10px]">Observações CCIH</Label>
                    <Textarea value={entry.ccihNotes} onChange={e => updateEntry(entry.id, "ccihNotes", e.target.value)} placeholder="Observações da Comissão de Controle de Infecção Hospitalar..." className="text-xs min-h-[40px] resize-none" />
                  </div>
                </div>
                );
              })}

              <Button variant="outline" size="sm" onClick={addEntry} className="gap-1.5 w-full text-xs">
                <Plus className="h-3.5 w-3.5" /> Adicionar Antimicrobiano
              </Button>
            </div>
          </ScrollArea>

          {/* === STICKY FOOTER === */}
          <DialogFooter className="px-6 py-3 border-t bg-background shrink-0 flex-row sm:justify-between gap-2">
            <div className="text-[11px] text-muted-foreground self-center">
              {entries.filter(e => e.medication.trim()).length} antimicrobiano(s) preenchido(s)
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                {mode === 'prescribe' ? 'Cancelar' : 'Fechar'}
              </Button>
              {mode === 'prescribe' && draftKey && (
                <Button variant="ghost" size="sm" onClick={handleSaveDraft} className="gap-1.5 text-xs">
                  Salvar rascunho
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrintOnly} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Imprimir somente a Guia
              </Button>
              {mode === 'prescribe' && onConfirm && (
                <>
                  <Button variant="outline" size="sm" onClick={handleAttachOnly} className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400">
                    <Shield className="h-3.5 w-3.5" /> Anexar antibióticos à prescrição
                  </Button>
                  <Button size="sm" onClick={handleAttachAndPrint} className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
                    <Printer className="h-3.5 w-3.5" /> Anexar + Imprimir Guia
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}

// === Build HTML body for Norma Zero print ===
function buildAtmBodyHtml({
  patient, entries, doctorName, doctorCrm, today,
}: {
  patient: PatientData; entries: AntimicrobialEntry[]; doctorName: string; doctorCrm: string; today: string;
}) {
  const esc = (s: string | undefined | null) => (s ?? '—').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const restrictionLabel = (v: string) => RESTRICTION_CLASSES.find(r => r.value === v)?.label || 'Pendente';

  return `
    <h2 class="nz-section">1. IDENTIFICAÇÃO DO PACIENTE</h2>
    <table class="nz">
      <tbody>
        <tr>
          <th style="width:14%">Paciente</th><td style="width:36%"><strong>${esc(patient.name)}</strong></td>
          <th style="width:10%">Leito</th><td style="width:14%"><strong>${esc(patient.bed)}</strong></td>
          <th style="width:12%">Prontuário</th><td><strong>${esc(patient.record)}</strong></td>
        </tr>
        <tr>
          <th>Idade</th><td>${esc(patient.age)}</td>
          <th>Peso</th><td>${patient.weight ? esc(patient.weight) + 'kg' : '—'}</td>
          <th>Alergias</th>
          <td><strong style="color:${patient.allergies && patient.allergies !== 'NDAM' ? '#dc2626' : 'inherit'}">${esc(patient.allergies || 'NDAM')}</strong></td>
        </tr>
        <tr>
          <th>Data emissão</th><td>${esc(today)}</td>
          <th>Médico</th><td colspan="3">${esc(doctorName)}${doctorCrm ? ` — CRM ${esc(doctorCrm)}` : ''}</td>
        </tr>
      </tbody>
    </table>

    <h2 class="nz-section">2. ANTIMICROBIANOS PRESCRITOS</h2>
    ${entries.map((e, idx) => `
      <div class="atm-block">
        <div class="atm-section">ATM ${idx + 1} · ${esc(e.medication)}</div>
        <table class="nz">
          <tbody>
            <tr>
              <th style="width:14%">Apresentação</th><td colspan="5">${esc(e.presentation)}</td>
            </tr>
            <tr>
              <th>Dose</th><td>${esc(e.dose)}</td>
              <th>Via</th><td>${esc(e.route)}</td>
              <th>Posologia</th><td>${esc(e.posology)}</td>
            </tr>
            <tr>
              <th>Início</th><td>${e.startDate ? format(new Date(e.startDate + 'T12:00:00'), 'dd/MM/yyyy') : '—'}</td>
              <th>Duração prev.</th><td>${e.plannedDuration ? esc(e.plannedDuration) + ' dias' : '—'}</td>
              <th>Classe</th><td>${esc(restrictionLabel(e.ccihApproval))}</td>
            </tr>
            <tr>
              <th>Sítio Infecção</th><td colspan="3">${esc(e.infectionSite)}</td>
              <th>ATB Prévio</th><td>${esc(e.previousAntibiotic)}</td>
            </tr>
            <tr>
              <th>Cultura</th>
              <td>${e.cultureCollected === 'sim' ? '✓ Sim' : e.cultureCollected === 'pendente' ? '⏳ Pendente' : '✗ Não'}</td>
              <th>Resultado</th><td colspan="3">${esc(e.cultureResult)}</td>
            </tr>
            <tr>
              <th>Justificativa</th>
              <td colspan="5" style="white-space:pre-wrap">${esc(e.justification)}</td>
            </tr>
            ${e.ccihNotes ? `<tr><th>Obs CCIH</th><td colspan="5" style="white-space:pre-wrap">${esc(e.ccihNotes)}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `).join('')}
  `;
}
