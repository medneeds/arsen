import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Brain, Printer, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";

interface PsychotropicEntry {
  id: string;
  medication: string;
  pharmaceuticalForm: string;
  concentration: string;
  quantity: string;
  quantityText: string;
  dose: string;
  route: string;
  posology: string;
  treatmentDuration: string;
  notificationType: "B" | "B2" | "A" | "C1";
  cid10: string;
  clinicalIndication: string;
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
  address?: string;
  city?: string;
  motherName?: string;
  birthDate?: string;
}

interface PrescriptionItem {
  id: string;
  name: string;
  dose: string;
  route: string;
  posology: string;
  category: string;
  status: string;
  highAlert?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientData;
  controlledItems?: PrescriptionItem[];
  doctorName?: string;
  doctorCrm?: string;
  doctorSpecialty?: string;
  hospitalName?: string;
  hospitalAddress?: string;
}

const NOTIFICATION_TYPES = [
  { value: "B", label: "Receita B (Azul)", description: "Psicotrópicos (Benzodiazepínicos, etc.)", color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "B2", label: "Receita B2 (Azul)", description: "Psicotrópicos anorexígenos", color: "text-blue-700 bg-blue-100 border-blue-300" },
  { value: "A", label: "Receita A (Amarela)", description: "Entorpecentes (Morfina, Fentanil, etc.)", color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "C1", label: "Receita C1 (Branca)", description: "Outras substâncias controladas", color: "text-gray-600 bg-gray-50 border-gray-200" },
];

// Common psychotropic medications for detection
const PSYCHOTROPIC_KEYWORDS = [
  "midazolam", "diazepam", "clonazepam", "lorazepam", "alprazolam", "nitrazepam", "bromazepam",
  "morfina", "fentanil", "tramadol", "codeína", "metadona", "oxicodona",
  "haloperidol", "clorpromazina", "risperidona", "quetiapina", "olanzapina",
  "amitriptilina", "fluoxetina", "sertralina", "escitalopram", "venlafaxina",
  "fenobarbital", "carbamazepina", "ácido valpróico", "valproato",
  "zolpidem", "cloral", "ketamina", "propofol",
];

function detectNotificationType(medName: string): "B" | "B2" | "A" | "C1" {
  const name = medName.toLowerCase();
  if (["morfina", "fentanil", "metadona", "oxicodona", "codeína", "ketamina"].some(k => name.includes(k))) return "A";
  if (["midazolam", "diazepam", "clonazepam", "lorazepam", "alprazolam", "nitrazepam", "bromazepam", "zolpidem", "fenobarbital"].some(k => name.includes(k))) return "B";
  return "C1";
}

export function isPsychotropicMedication(name: string): boolean {
  const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return PSYCHOTROPIC_KEYWORDS.some(k => normalized.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

function createEmptyPsychEntry(item?: PrescriptionItem): PsychotropicEntry {
  return {
    id: crypto.randomUUID(),
    medication: item?.name || "",
    pharmaceuticalForm: "",
    concentration: "",
    quantity: "",
    quantityText: "",
    dose: item?.dose || "",
    route: item?.route || "",
    posology: item?.posology || "",
    treatmentDuration: "",
    notificationType: item ? detectNotificationType(item.name) : "B",
    cid10: "",
    clinicalIndication: "",
  };
}

export function PsychotropicFormDialog({ open, onOpenChange, patient, controlledItems = [], doctorName: doctorNameProp = "", doctorCrm: doctorCrmProp = "", doctorSpecialty: doctorSpecialtyProp = "", hospitalName = "", hospitalAddress = "" }: Props) {
  const currentDoctor = useCurrentDoctor();
  // Sincroniza com perfil do médico logado quando não há assinatura digital prévia
  const doctorName = doctorNameProp || currentDoctor.fullName;
  const doctorCrm = doctorCrmProp || currentDoctor.crm;
  const doctorSpecialty = doctorSpecialtyProp || currentDoctor.specialty;
  const [entries, setEntries] = useState<PsychotropicEntry[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (open) {
      if (controlledItems.length > 0) {
        setEntries(controlledItems.filter(i => i.status === 'active').map(item => createEmptyPsychEntry(item)));
      } else if (entries.length === 0) {
        setEntries([createEmptyPsychEntry()]);
      }
    }
  }, [open, controlledItems]);

  const updateEntry = (id: string, field: keyof PsychotropicEntry, value: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const addEntry = () => setEntries(prev => [...prev, createEmptyPsychEntry()]);
  const removeEntry = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => { window.print(); setTimeout(() => setIsPrinting(false), 500); }, 100);
  };

  const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-4xl max-h-[90vh] overflow-y-auto", isPrinting && "print:block")}>
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-500" />
            Ficha de Medicações Psicotrópicas / Controladas
          </DialogTitle>
          <DialogDescription>
            Notificação de receita especial conforme Portaria SVS/MS nº 344/98 — ANVISA.
          </DialogDescription>
        </DialogHeader>

        {/* === PRINT LAYOUT === */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body > * { display: none !important; }
            [data-psychotropic-print] { display: block !important; position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; }
            @page { size: A4 portrait; margin: 8mm 12mm; }
          }
        `}} />

        <div data-psychotropic-print className={cn(!isPrinting && "hidden print:hidden")}>
          <PrintablePsychotropicForm
            patient={patient}
            entries={entries}
            doctorName={doctorName}
            doctorCrm={doctorCrm}
            doctorSpecialty={doctorSpecialty}
            hospitalName={hospitalName}
            hospitalAddress={hospitalAddress}
            date={today}
          />
        </div>

        {/* === FORM CONTENT === */}
        <div className="space-y-4 print:hidden">
          {/* Patient Summary */}
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:bg-violet-950/10 dark:border-violet-800/30 p-3">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div><span className="text-muted-foreground">Paciente:</span> <strong>{patient.name}</strong></div>
              <div><span className="text-muted-foreground">Leito:</span> <strong>{patient.bed}</strong></div>
              <div><span className="text-muted-foreground">Prontuário:</span> <strong>{patient.record || "—"}</strong></div>
              <div><span className="text-muted-foreground">Idade:</span> <strong>{patient.age || "—"}</strong></div>
            </div>
          </div>

          {/* Notification type legend */}
          <div className="flex flex-wrap gap-2">
            {NOTIFICATION_TYPES.map(nt => (
              <Badge key={nt.value} variant="outline" className={cn("text-[10px]", nt.color)}>
                {nt.label} — {nt.description}
              </Badge>
            ))}
          </div>

          {/* Entries */}
          {entries.map((entry, idx) => {
            const notifType = NOTIFICATION_TYPES.find(n => n.value === entry.notificationType);
            return (
              <div key={entry.id} className={cn("rounded-lg border p-4 space-y-3", notifType?.color || "border-border")}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", notifType?.color)}>
                      {notifType?.label || "Receita B"}
                    </Badge>
                    {entry.medication || "Novo medicamento"}
                  </h3>
                  {entries.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeEntry(entry.id)} className="h-7 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Row 1: Medication */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Label className="text-[10px]">Medicamento (DCB / Nome Genérico)</Label>
                    <Input value={entry.medication} onChange={e => updateEntry(entry.id, "medication", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Forma Farmacêutica</Label>
                    <Input value={entry.pharmaceuticalForm} onChange={e => updateEntry(entry.id, "pharmaceuticalForm", e.target.value)} placeholder="Comprimido, Ampola..." className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Concentração</Label>
                    <Input value={entry.concentration} onChange={e => updateEntry(entry.id, "concentration", e.target.value)} placeholder="5mg, 10mg/mL..." className="h-8 text-xs" />
                  </div>
                </div>

                {/* Row 2: Quantity and Type */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px]">Quantidade (número)</Label>
                    <Input value={entry.quantity} onChange={e => updateEntry(entry.id, "quantity", e.target.value)} placeholder="30" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Quantidade (extenso)</Label>
                    <Input value={entry.quantityText} onChange={e => updateEntry(entry.id, "quantityText", e.target.value)} placeholder="trinta" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Tipo de Notificação</Label>
                    <Select value={entry.notificationType} onValueChange={v => updateEntry(entry.id, "notificationType", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTIFICATION_TYPES.map(nt => (
                          <SelectItem key={nt.value} value={nt.value} className="text-xs">
                            <span className={nt.color.split(' ')[0]}>{nt.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">CID-10</Label>
                    <Input value={entry.cid10} onChange={e => updateEntry(entry.id, "cid10", e.target.value)} placeholder="F32.1" className="h-8 text-xs" />
                  </div>
                </div>

                {/* Row 3: Posology */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px]">Dose</Label>
                    <Input value={entry.dose} onChange={e => updateEntry(entry.id, "dose", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Via</Label>
                    <Input value={entry.route} onChange={e => updateEntry(entry.id, "route", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Posologia</Label>
                    <Input value={entry.posology} onChange={e => updateEntry(entry.id, "posology", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Duração Tratamento</Label>
                    <Input value={entry.treatmentDuration} onChange={e => updateEntry(entry.id, "treatmentDuration", e.target.value)} placeholder="30 dias" className="h-8 text-xs" />
                  </div>
                </div>

                {/* Row 4: Clinical indication */}
                <div>
                  <Label className="text-[10px]">Indicação Clínica / Justificativa</Label>
                  <Textarea value={entry.clinicalIndication} onChange={e => updateEntry(entry.id, "clinicalIndication", e.target.value)} placeholder="Indicação clínica para uso desta medicação controlada..." className="text-xs min-h-[50px] resize-none" />
                </div>
              </div>
            );
          })}

          <Button variant="outline" size="sm" onClick={addEntry} className="gap-1.5 w-full text-xs">
            <Plus className="h-3.5 w-3.5" /> Adicionar Medicação
          </Button>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Imprimir Ficha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// === PRINTABLE LAYOUT ===
function PrintablePsychotropicForm({ patient, entries, doctorName, doctorCrm, doctorSpecialty, hospitalName, hospitalAddress, date }: {
  patient: PatientData; entries: PsychotropicEntry[]; doctorName: string; doctorCrm: string; doctorSpecialty: string; hospitalName: string; hospitalAddress: string; date: string;
}) {
  const cellStyle: React.CSSProperties = { border: '0.5px solid #94a3b8', padding: '3px 6px', fontSize: '7.5pt', lineHeight: 1.3, verticalAlign: 'top' };
  const headerCellStyle: React.CSSProperties = { ...cellStyle, fontWeight: 700, fontSize: '6.5pt', backgroundColor: '#f1f5f9', color: '#334155', textTransform: 'uppercase' as const, letterSpacing: '0.3px' };

  const getTypeColor = (type: string) => {
    if (type === 'A') return '#d97706';
    if (type === 'B' || type === 'B2') return '#2563eb';
    return '#6b7280';
  };

  const getTypeLabel = (type: string) => {
    const found = NOTIFICATION_TYPES.find(n => n.value === type);
    return found?.label || 'Receita Especial';
  };

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a', width: '186mm', margin: '0 auto', lineHeight: 1.3 }}>
      {entries.map((entry, idx) => (
        <div key={entry.id} style={{ marginBottom: idx < entries.length - 1 ? '20px' : '0', pageBreakAfter: idx < entries.length - 1 ? 'always' : 'auto' }}>
          {/* Header bar with notification type color */}
          <div style={{
            border: `2px solid ${getTypeColor(entry.notificationType)}`,
            borderBottom: 'none',
            padding: '6px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: `${getTypeColor(entry.notificationType)}10`,
          }}>
            <div>
              <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0c4a6e' }}>{hospitalName || 'HOSPITAL MUNICIPAL'}</div>
              <div style={{ fontSize: '6.5pt', color: '#64748b' }}>{hospitalAddress || 'Endereço da unidade hospitalar'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10pt', fontWeight: 800, color: getTypeColor(entry.notificationType), textTransform: 'uppercase' }}>
                {getTypeLabel(entry.notificationType)}
              </div>
              <div style={{ fontSize: '6pt', color: '#64748b' }}>Portaria SVS/MS nº 344/98 — ANVISA</div>
              <div style={{ fontSize: '6pt', color: '#94a3b8' }}>1ª Via — Retenção pela Farmácia</div>
            </div>
          </div>

          {/* Content */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: `2px solid ${getTypeColor(entry.notificationType)}` }}>
            <tbody>
              {/* Prescriber block */}
              <tr>
                <td style={{ ...headerCellStyle, backgroundColor: '#e2e8f0', fontWeight: 800, fontSize: '7pt' }} colSpan={6}>
                  IDENTIFICAÇÃO DO EMITENTE
                </td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Instituição</td>
                <td style={cellStyle} colSpan={3}>{hospitalName || '—'}</td>
                <td style={headerCellStyle}>Data</td>
                <td style={cellStyle}>{date}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Médico</td>
                <td style={{ ...cellStyle, fontWeight: 700 }} colSpan={3}>{doctorName || '—'}</td>
                <td style={headerCellStyle}>CRM</td>
                <td style={cellStyle}>{doctorCrm || '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Especialidade</td>
                <td style={cellStyle} colSpan={5}>{doctorSpecialty || '—'}</td>
              </tr>

              {/* Patient block */}
              <tr>
                <td style={{ ...headerCellStyle, backgroundColor: '#e2e8f0', fontWeight: 800, fontSize: '7pt' }} colSpan={6}>
                  IDENTIFICAÇÃO DO PACIENTE
                </td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Paciente</td>
                <td style={{ ...cellStyle, fontWeight: 700 }} colSpan={3}>{patient.name}</td>
                <td style={headerCellStyle}>Leito</td>
                <td style={cellStyle}>{patient.bed}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Prontuário</td>
                <td style={cellStyle}>{patient.record || '—'}</td>
                <td style={headerCellStyle}>Idade</td>
                <td style={cellStyle}>{patient.age || '—'}</td>
                <td style={headerCellStyle}>Sexo</td>
                <td style={cellStyle}>{patient.sex || '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Endereço</td>
                <td style={cellStyle} colSpan={3}>{patient.address || '—'}{patient.city ? ` — ${patient.city}` : ''}</td>
                <td style={headerCellStyle}>Nome da Mãe</td>
                <td style={cellStyle}>{patient.motherName || '—'}</td>
              </tr>

              {/* Medication block */}
              <tr>
                <td style={{ ...headerCellStyle, backgroundColor: getTypeColor(entry.notificationType), color: '#fff', fontWeight: 800, fontSize: '7pt' }} colSpan={6}>
                  MEDICAMENTO — {getTypeLabel(entry.notificationType).toUpperCase()}
                </td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Medicamento (DCB)</td>
                <td style={{ ...cellStyle, fontWeight: 700 }} colSpan={5}>{entry.medication || '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Forma Farm.</td>
                <td style={cellStyle}>{entry.pharmaceuticalForm || '—'}</td>
                <td style={headerCellStyle}>Concentração</td>
                <td style={cellStyle}>{entry.concentration || '—'}</td>
                <td style={headerCellStyle}>Via</td>
                <td style={cellStyle}>{entry.route || '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Dose</td>
                <td style={cellStyle}>{entry.dose || '—'}</td>
                <td style={headerCellStyle}>Posologia</td>
                <td style={cellStyle}>{entry.posology || '—'}</td>
                <td style={headerCellStyle}>Duração</td>
                <td style={cellStyle}>{entry.treatmentDuration || '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Quantidade</td>
                <td style={cellStyle}>{entry.quantity || '—'} ({entry.quantityText || 'por extenso'})</td>
                <td style={headerCellStyle}>CID-10</td>
                <td style={cellStyle} colSpan={3}>{entry.cid10 || '—'}</td>
              </tr>
              <tr>
                <td style={headerCellStyle}>Indicação Clínica</td>
                <td style={cellStyle} colSpan={5}>{entry.clinicalIndication || '—'}</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
            <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #0f172a', paddingTop: '4px' }}>
              <div style={{ fontSize: '7pt', fontWeight: 700 }}>Assinatura e Carimbo do Prescritor</div>
              <div style={{ fontSize: '6.5pt', color: '#64748b' }}>{doctorName || '_________________________'}</div>
              <div style={{ fontSize: '6pt', color: '#94a3b8' }}>CRM: {doctorCrm || '____________'}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #0f172a', paddingTop: '4px' }}>
              <div style={{ fontSize: '7pt', fontWeight: 700 }}>Farmacêutico Dispensador</div>
              <div style={{ fontSize: '6.5pt', color: '#64748b' }}>_________________________</div>
              <div style={{ fontSize: '6pt', color: '#94a3b8' }}>CRF: ____________ Data: ___/___/______</div>
            </div>
          </div>

          {/* Legal notice */}
          <div style={{ marginTop: '8px', padding: '4px 8px', border: '0.5px solid #e2e8f0', fontSize: '5.5pt', color: '#64748b', lineHeight: 1.4 }}>
            <strong>ATENÇÃO:</strong> Este receituário é válido por 30 dias a contar da data de emissão. A quantidade prescrita de medicamento é limitada a 60 dias de tratamento.
            Uso exclusivo em ambiente hospitalar conforme Portaria SVS/MS nº 344/98 e RDC nº 58/2007.
          </div>

          {/* Footer */}
          <div style={{ marginTop: '6px', fontSize: '5.5pt', color: '#94a3b8', textAlign: 'center' }}>
            Documento gerado pelo sistema BigHelp Map — {date}
          </div>
        </div>
      ))}
    </div>
  );
}
