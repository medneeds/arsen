import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Printer, X, Plus, Trash2, AlertTriangle, FileText, ClipboardList, Loader2, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface AntimicrobialEntry {
  id: string;
  medication: string;
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
  onConfirm?: (entries: Array<{ medication: string; dose: string; route: string; posology: string }>) => void;
  mode?: 'review' | 'prescribe';
  patientId?: string;
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

function createEmptyEntry(item?: PrescriptionItem): AntimicrobialEntry {
  return {
    id: crypto.randomUUID(),
    medication: item?.name || "",
    dose: item?.dose || "",
    route: item?.route || "",
    posology: item?.posology || "",
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

export function AntimicrobialGuideDialog({ open, onOpenChange, patient, antimicrobialItems = [], doctorName = "", doctorCrm = "", hospitalName = "", onConfirm, mode = 'review', patientId }: Props) {
  const [entries, setEntries] = useState<AntimicrobialEntry[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [loadingImport, setLoadingImport] = useState<Record<string, 'history' | 'evolution' | 'cultures' | null>>({});
  const [availableCultures, setAvailableCultures] = useState<Array<{ id: string; culture_type: string; collection_date: string | null; status: string; microorganism: string | null; antibiogram: string | null; sensitivity_profile: string | null; result_text: string | null; created_at: string }>>([]);

  useEffect(() => {
    if (open) {
      if (antimicrobialItems.length > 0) {
        setEntries(antimicrobialItems.filter(i => i.status === 'active').map(item => createEmptyEntry(item)));
      } else if (entries.length === 0) {
        setEntries([createEmptyEntry()]);
      }
    }
  }, [open, antimicrobialItems]);

  // Fetch available cultures for this patient when dialog opens
  useEffect(() => {
    if (open && patientId) {
      supabase
        .from('culture_results')
        .select('id, culture_type, collection_date, status, microorganism, antibiogram, sensitivity_profile, result_text, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setAvailableCultures(data);
        });
    }
  }, [open, patientId]);

  const updateEntry = (id: string, field: keyof AntimicrobialEntry, value: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const addEntry = () => setEntries(prev => [...prev, createEmptyEntry()]);
  const removeEntry = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  const importAdmissionHistory = async (entryId: string) => {
    if (!patientId) return;
    setLoadingImport(prev => ({ ...prev, [entryId]: 'history' }));
    try {
      // First try admission_histories table
      const { data: admHistory } = await supabase
        .from('admission_histories')
        .select('chief_complaint, clinical_history, diagnostic_hypothesis, initial_conduct')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (admHistory) {
        const parts = [
          admHistory.chief_complaint && `QUEIXA PRINCIPAL: ${admHistory.chief_complaint}`,
          admHistory.clinical_history && `HISTÓRIA CLÍNICA: ${admHistory.clinical_history}`,
          admHistory.diagnostic_hypothesis && `HIPÓTESE DIAGNÓSTICA: ${admHistory.diagnostic_hypothesis}`,
          admHistory.initial_conduct && `CONDUTA INICIAL: ${admHistory.initial_conduct}`,
        ].filter(Boolean).join('\n');
        if (parts) {
          updateEntry(entryId, 'justification', (entries.find(e => e.id === entryId)?.justification || '') + (entries.find(e => e.id === entryId)?.justification ? '\n\n' : '') + `[HISTÓRIA ADMISSIONAL]\n${parts}`);
          return;
        }
      }

      // Fallback: try patient admission_history field
      const { data: patientData } = await supabase
        .from('patients')
        .select('admission_history')
        .eq('id', patientId)
        .maybeSingle();

      if (patientData?.admission_history) {
        updateEntry(entryId, 'justification', (entries.find(e => e.id === entryId)?.justification || '') + (entries.find(e => e.id === entryId)?.justification ? '\n\n' : '') + `[HISTÓRIA ADMISSIONAL]\n${patientData.admission_history}`);
      }
    } catch (err) {
      console.error('Error importing admission history:', err);
    } finally {
      setLoadingImport(prev => ({ ...prev, [entryId]: null }));
    }
  };

  const importEvolution = async (entryId: string) => {
    if (!patientId) return;
    setLoadingImport(prev => ({ ...prev, [entryId]: 'evolution' }));
    try {
      // Get latest patient data for clinical context (diagnoses, conducts, exams)
      const { data: patientData } = await supabase
        .from('patients')
        .select('diagnoses, medical_history, relevant_exams, pendencies, uti_cultures_antibiotics, uti_current_status')
        .eq('id', patientId)
        .maybeSingle();

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
          updateEntry(entryId, 'justification', (entries.find(e => e.id === entryId)?.justification || '') + (entries.find(e => e.id === entryId)?.justification ? '\n\n' : '') + `[EVOLUÇÃO CLÍNICA]\n${parts}`);
        }
      }
    } catch (err) {
      console.error('Error importing evolution:', err);
    } finally {
      setLoadingImport(prev => ({ ...prev, [entryId]: null }));
    }
  };
  const importCultureResults = async (entryId: string) => {
    if (!patientId || availableCultures.length === 0) return;
    setLoadingImport(prev => ({ ...prev, [entryId]: 'cultures' }));
    try {
      const cultureLines = availableCultures.map(c => {
        const parts = [
          `• Tipo: ${c.culture_type || 'N/I'}`,
          c.collection_date ? `  Data coleta: ${format(new Date(c.collection_date + 'T12:00:00'), 'dd/MM/yyyy')}` : `  Solicitado em: ${format(new Date(c.created_at), 'dd/MM/yyyy')}`,
          `  Status: ${c.status === 'completed' ? 'Concluída' : c.status === 'pending' ? 'Pendente' : c.status}`,
          c.microorganism ? `  Microrganismo: ${c.microorganism}` : null,
          c.antibiogram ? `  Antibiograma: ${c.antibiogram}` : null,
          c.sensitivity_profile ? `  Perfil sensibilidade: ${c.sensitivity_profile}` : null,
          c.result_text ? `  Resultado: ${c.result_text}` : null,
        ].filter(Boolean).join('\n');
        return parts;
      }).join('\n\n');

      const currentEntry = entries.find(e => e.id === entryId);
      if (currentEntry) {
        // Update culture collected status
        const hasCompleted = availableCultures.some(c => c.status === 'completed');
        const hasPending = availableCultures.some(c => c.status === 'pending');
        updateEntry(entryId, 'cultureCollected', hasCompleted ? 'sim' : hasPending ? 'pendente' : 'sim');

        // Build culture result summary
        const completedCultures = availableCultures.filter(c => c.microorganism || c.result_text);
        const resultSummary = completedCultures.map(c => 
          [c.microorganism, c.sensitivity_profile || c.antibiogram].filter(Boolean).join(' — ')
        ).filter(Boolean).join('; ');
        if (resultSummary) {
          updateEntry(entryId, 'cultureResult', resultSummary);
        }

        // Append detailed info to justification
        const currentJust = currentEntry.justification || '';
        updateEntry(entryId, 'justification', currentJust + (currentJust ? '\n\n' : '') + `[RESULTADOS DE CULTURAS]\n${cultureLines}`);
      }
    } catch (err) {
      console.error('Error importing culture results:', err);
    } finally {
      setLoadingImport(prev => ({ ...prev, [entryId]: null }));
    }
  };


  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrinting(false), 500);
    }, 100);
  };

  const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  return (
    <>
      {/* Print portal - rendered directly on body, outside dialog */}
      {isPrinting && createPortal(
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body > *:not(#antimicrobial-print-root) { display: none !important; }
              body { overflow: visible !important; }
              #antimicrobial-print-root { display: block !important; position: fixed; top: 0; left: 0; width: 100%; height: auto; z-index: 99999; background: white; overflow: visible !important; }
              @page { size: A4 portrait; margin: 8mm 12mm; }
            }
          `}} />
          <div id="antimicrobial-print-root" style={{ display: 'none' }}>
            <PrintableAntimicrobialGuide
              patient={patient}
              entries={entries}
              doctorName={doctorName}
              doctorCrm={doctorCrm}
              hospitalName={hospitalName}
              date={today}
            />
          </div>
        </>,
        document.body
      )}

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Guia de Uso de Antimicrobianos — CCIH
          </DialogTitle>
          <DialogDescription>
            Formulário de justificativa e autorização de antimicrobianos conforme normativa ANVISA / CCIH.
          </DialogDescription>
        </DialogHeader>

        {/* === FORM CONTENT === */}
        <div className="space-y-4 print:hidden">
          {/* Patient Summary */}
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 dark:bg-orange-950/10 dark:border-orange-800/30 p-3">
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

          {/* Entries */}
          {entries.map((entry, idx) => (
            <div key={entry.id} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Badge variant="outline" className="text-orange-600 border-orange-300">ATM {idx + 1}</Badge>
                  {entry.medication || "Novo antimicrobiano"}
                </h3>
                {entries.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeEntry(entry.id)} className="h-7 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Row 1: Medication details */}
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2">
                  <Label className="text-[10px]">Antimicrobiano</Label>
                  <Input value={entry.medication} onChange={e => updateEntry(entry.id, "medication", e.target.value)} className="h-8 text-xs" />
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

              {/* Row 2: Posology, dates */}
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
                </div>
                <div>
                  <Label className="text-[10px]">Classe de Restrição</Label>
                  <Select value={entry.ccihApproval} onValueChange={v => updateEntry(entry.id, "ccihApproval", v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
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

              {/* Row 3: Infection site */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Sítio de Infecção / Indicação Clínica</Label>
                  <Select value={entry.infectionSite} onValueChange={v => updateEntry(entry.id, "infectionSite", v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
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

              {/* Row 4: Culture */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px]">Cultura Coletada?</Label>
                  <Select value={entry.cultureCollected} onValueChange={v => updateEntry(entry.id, "cultureCollected", v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
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
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => importCultureResults(entry.id)}
                        disabled={!!loadingImport[entry.id] || availableCultures.length === 0}
                        className="h-6 text-[10px] gap-1 px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        title={availableCultures.length === 0 ? 'Nenhuma cultura encontrada para este paciente' : ''}
                      >
                        {loadingImport[entry.id] === 'cultures' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
                        Importar Culturas {availableCultures.length > 0 ? `(${availableCultures.length})` : '(0)'}
                      </Button>
                    )}
                  </div>
                  <Input value={entry.cultureResult} onChange={e => updateEntry(entry.id, "cultureResult", e.target.value)} placeholder="Microrganismo / Sensibilidade" className="h-8 text-xs" />
                </div>
              </div>

              {/* Row 5: Justification with import buttons */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[10px]">Justificativa Clínica</Label>
                  {patientId && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => importAdmissionHistory(entry.id)}
                        disabled={!!loadingImport[entry.id]}
                        className="h-6 text-[10px] gap-1 px-2"
                      >
                        {loadingImport[entry.id] === 'history' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                        Importar Hx Admissional
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => importEvolution(entry.id)}
                        disabled={!!loadingImport[entry.id]}
                        className="h-6 text-[10px] gap-1 px-2"
                      >
                        {loadingImport[entry.id] === 'evolution' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
                        Importar Evolução
                      </Button>
                    </div>
                  )}
                </div>
                <Textarea value={entry.justification} onChange={e => updateEntry(entry.id, "justification", e.target.value)} placeholder="Descreva a indicação clínica para uso deste antimicrobiano..." className="text-xs min-h-[80px] resize-y" />
              </div>

              {/* Row 6: CCIH notes */}
              <div>
                <Label className="text-[10px]">Observações CCIH</Label>
                <Textarea value={entry.ccihNotes} onChange={e => updateEntry(entry.id, "ccihNotes", e.target.value)} placeholder="Observações da Comissão de Controle de Infecção Hospitalar..." className="text-xs min-h-[40px] resize-none" />
              </div>
            </div>
          ))}

          {/* Add more */}
          <Button variant="outline" size="sm" onClick={addEntry} className="gap-1.5 w-full text-xs">
            <Plus className="h-3.5 w-3.5" /> Adicionar Antimicrobiano
          </Button>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {mode === 'prescribe' ? 'Cancelar' : 'Fechar'}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Imprimir Guia
            </Button>
            {mode === 'prescribe' && onConfirm && (
              <Button
                size="sm"
                onClick={() => {
                  const validEntries = entries.filter(e => e.medication.trim());
                  if (validEntries.length === 0) {
                    return;
                  }
                  onConfirm(validEntries.map(e => ({
                    medication: e.medication,
                    dose: e.dose,
                    route: e.route,
                    posology: e.posology,
                  })));
                  onOpenChange(false);
                }}
                className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Shield className="h-3.5 w-3.5" /> Confirmar e Anexar à Prescrição
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

// === PRINTABLE LAYOUT ===
function PrintableAntimicrobialGuide({ patient, entries, doctorName, doctorCrm, hospitalName, date }: {
  patient: PatientData; entries: AntimicrobialEntry[]; doctorName: string; doctorCrm: string; hospitalName: string; date: string;
}) {
  const cellStyle: React.CSSProperties = { border: '0.5px solid #94a3b8', padding: '3px 6px', fontSize: '7.5pt', lineHeight: 1.3, verticalAlign: 'top' };
  const headerCellStyle: React.CSSProperties = { ...cellStyle, fontWeight: 700, fontSize: '6.5pt', backgroundColor: '#f1f5f9', color: '#334155', textTransform: 'uppercase' as const, letterSpacing: '0.3px' };
  const sectionStyle: React.CSSProperties = { ...cellStyle, fontWeight: 800, fontSize: '7pt', backgroundColor: '#0c4a6e', color: '#fff', textAlign: 'center', letterSpacing: '0.5px', padding: '4px 6px' };

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a', width: '186mm', margin: '0 auto', lineHeight: 1.3 }}>
      {/* Header */}
      <div style={{ borderBottom: '2px solid #0c4a6e', paddingBottom: '4px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0c4a6e' }}>{hospitalName || 'HOSPITAL MUNICIPAL'}</div>
          <div style={{ fontSize: '7pt', color: '#64748b', fontWeight: 600 }}>COMISSÃO DE CONTROLE DE INFECÇÃO HOSPITALAR — CCIH</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9pt', fontWeight: 800, color: '#ea580c' }}>GUIA DE ANTIMICROBIANOS</div>
          <div style={{ fontSize: '6.5pt', color: '#64748b' }}>Resolução ANVISA RDC nº 2.616/98</div>
        </div>
      </div>

      {/* Patient Data */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
        <tbody>
          <tr>
            <td style={headerCellStyle}>Paciente</td>
            <td style={{ ...cellStyle, fontWeight: 700, width: '35%' }}>{patient.name}</td>
            <td style={headerCellStyle}>Leito</td>
            <td style={{ ...cellStyle, fontWeight: 700 }}>{patient.bed}</td>
            <td style={headerCellStyle}>Prontuário</td>
            <td style={{ ...cellStyle, fontWeight: 700 }}>{patient.record || '—'}</td>
          </tr>
          <tr>
            <td style={headerCellStyle}>Idade</td>
            <td style={cellStyle}>{patient.age || '—'}</td>
            <td style={headerCellStyle}>Peso</td>
            <td style={cellStyle}>{patient.weight ? `${patient.weight}kg` : '—'}</td>
            <td style={headerCellStyle}>Alergias</td>
            <td style={{ ...cellStyle, fontWeight: 700, color: patient.allergies && patient.allergies !== 'NDAM' ? '#dc2626' : '#0f172a' }}>{patient.allergies || 'NDAM'}</td>
          </tr>
          <tr>
            <td style={headerCellStyle}>Data</td>
            <td style={cellStyle}>{date}</td>
            <td style={headerCellStyle}>Médico</td>
            <td style={cellStyle} colSpan={3}>{doctorName}{doctorCrm ? ` — CRM ${doctorCrm}` : ''}</td>
          </tr>
        </tbody>
      </table>

      {/* Entries */}
      {entries.map((entry, idx) => (
        <div key={entry.id} style={{ marginBottom: '8px', pageBreakInside: 'avoid' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={sectionStyle} colSpan={6}>ANTIMICROBIANO {idx + 1}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Medicamento</td>
                <td style={{ ...cellStyle, fontWeight: 700, width: '35%' }}>{entry.medication || '—'}</td>
                <td style={headerCellStyle}>Dose</td>
                <td style={cellStyle}>{entry.dose || '—'}</td>
                <td style={headerCellStyle}>Via</td>
                <td style={cellStyle}>{entry.route || '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Posologia</td>
                <td style={cellStyle}>{entry.posology || '—'}</td>
                <td style={headerCellStyle}>Início</td>
                <td style={cellStyle}>{entry.startDate ? format(new Date(entry.startDate + 'T12:00:00'), 'dd/MM/yyyy') : '—'}</td>
                <td style={headerCellStyle}>Duração</td>
                <td style={cellStyle}>{entry.plannedDuration ? `${entry.plannedDuration} dias` : '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Sítio Infecção</td>
                <td style={cellStyle} colSpan={3}>{entry.infectionSite || '—'}</td>
                <td style={headerCellStyle}>ATB Prévio</td>
                <td style={cellStyle}>{entry.previousAntibiotic || '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Cultura</td>
                <td style={cellStyle}>{entry.cultureCollected === 'sim' ? '✓ Sim' : entry.cultureCollected === 'pendente' ? '⏳ Pendente' : '✗ Não'}</td>
                <td style={headerCellStyle}>Resultado</td>
                <td style={cellStyle} colSpan={3}>{entry.cultureResult || '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Justificativa</td>
                <td style={cellStyle} colSpan={5}>{entry.justification || '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Classificação</td>
                <td style={{ ...cellStyle, fontWeight: 700, color: entry.ccihApproval === 'aprovado' ? '#16a34a' : entry.ccihApproval === 'negado' ? '#dc2626' : '#d97706' }}>
                  {RESTRICTION_CLASSES.find(r => r.value === entry.ccihApproval)?.label || 'Pendente'}
                </td>
                <td style={headerCellStyle}>Obs CCIH</td>
                <td style={cellStyle} colSpan={3}>{entry.ccihNotes || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {/* Signature */}
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #0f172a', paddingTop: '4px' }}>
          <div style={{ fontSize: '7pt', fontWeight: 700 }}>Médico Prescritor</div>
          <div style={{ fontSize: '6.5pt', color: '#64748b' }}>{doctorName || '_________________________'}</div>
          <div style={{ fontSize: '6pt', color: '#94a3b8' }}>CRM: {doctorCrm || '____________'}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #0f172a', paddingTop: '4px' }}>
          <div style={{ fontSize: '7pt', fontWeight: 700 }}>Farmacêutico</div>
          <div style={{ fontSize: '6.5pt', color: '#64748b' }}>_________________________</div>
          <div style={{ fontSize: '6pt', color: '#94a3b8' }}>CRF: ____________</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #0f172a', paddingTop: '4px' }}>
          <div style={{ fontSize: '7pt', fontWeight: 700 }}>CCIH — Aprovação</div>
          <div style={{ fontSize: '6.5pt', color: '#64748b' }}>_________________________</div>
          <div style={{ fontSize: '6pt', color: '#94a3b8' }}>Data: ___/___/______</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '10px', fontSize: '5.5pt', color: '#94a3b8', textAlign: 'center', borderTop: '0.5px solid #e2e8f0', paddingTop: '3px' }}>
        Documento gerado pelo sistema BigHelp Map — {date} — Válido quando assinado
      </div>
    </div>
  );
}
