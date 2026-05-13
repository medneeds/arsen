import React, { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Brain, Printer, Plus, Trash2, AlertTriangle, Sparkles, Search, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import { useUnifiedMedicationCatalog, type ControlledCatalogItem } from "@/hooks/useUnifiedMedicationCatalog";

export type NotificationType = 'Receita Amarela' | 'Receita Azul' | 'Controle Especial 2 vias';

interface PsychotropicEntry {
  id: string;
  catalogId?: string;
  medication: string;
  pharmaceuticalForm: string;
  concentration: string;
  quantity: string;
  quantityText: string;
  dose: string;
  route: string;
  posology: string;
  treatmentDuration: string;
  notificationType: NotificationType | null;
  cid10: string;
  clinicalIndication: string;
  /** Locked = veio da prescrição, não permite trocar o medicamento */
  locked: boolean;
  /** Quais campos foram autopreenchidos (somem do badge ao editar) */
  autoFilled: Set<keyof PsychotropicEntry>;
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
  /** print_direct = abre já em modo "imprimir guia" (chamada após window.print da prescrição) */
  mode?: 'edit' | 'print_direct';
}

const NOTIFICATION_META: Record<NotificationType, { label: string; description: string; color: string; bg: string }> = {
  'Receita Amarela': { label: 'Receita Amarela (A1/A2)', description: 'Entorpecentes — Lista A', color: '#d97706', bg: 'text-amber-700 bg-amber-50 border-amber-200' },
  'Receita Azul': { label: 'Receita Azul (B1/B2)', description: 'Psicotrópicos — Lista B', color: '#2563eb', bg: 'text-blue-700 bg-blue-50 border-blue-200' },
  'Controle Especial 2 vias': { label: 'Controle Especial (C1)', description: 'Outras substâncias controladas', color: '#6b7280', bg: 'text-slate-700 bg-slate-50 border-slate-200' },
};

// Heurística legacy mantida para compat (usada quando catálogo não responde)
const PSYCHOTROPIC_KEYWORDS = [
  "midazolam", "diazepam", "clonazepam", "lorazepam", "alprazolam", "nitrazepam", "bromazepam",
  "morfina", "fentanil", "tramadol", "codeína", "metadona", "oxicodona",
  "haloperidol", "clorpromazina", "risperidona", "quetiapina", "olanzapina",
  "amitriptilina", "fluoxetina", "sertralina", "escitalopram", "venlafaxina",
  "fenobarbital", "carbamazepina", "ácido valpróico", "valproato",
  "zolpidem", "cloral", "ketamina", "propofol",
];

export function isPsychotropicMedication(name: string): boolean {
  const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return PSYCHOTROPIC_KEYWORDS.some(k => normalized.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

function legacyDetect(name: string): NotificationType {
  const n = name.toLowerCase();
  if (["morfina", "fentanil", "metadona", "oxicodona", "codeína", "ketamina"].some(k => n.includes(k))) return 'Receita Amarela';
  if (["midazolam", "diazepam", "clonazepam", "lorazepam", "alprazolam", "nitrazepam", "bromazepam", "zolpidem", "fenobarbital"].some(k => n.includes(k))) return 'Receita Azul';
  return 'Controle Especial 2 vias';
}

function emptyEntry(): PsychotropicEntry {
  return {
    id: crypto.randomUUID(),
    medication: '', pharmaceuticalForm: '', concentration: '',
    quantity: '', quantityText: '', dose: '', route: '', posology: '',
    treatmentDuration: '', notificationType: null, cid10: '', clinicalIndication: '',
    locked: false, autoFilled: new Set(),
  };
}

function entryFromCatalog(cat: ControlledCatalogItem, opts: { locked: boolean; sourceItem?: PrescriptionItem }): PsychotropicEntry {
  const auto = new Set<keyof PsychotropicEntry>(['medication', 'pharmaceuticalForm', 'concentration', 'route', 'dose', 'notificationType']);
  return {
    id: crypto.randomUUID(),
    catalogId: cat.catalogId,
    medication: cat.label,
    pharmaceuticalForm: cat.pharmaceutical_form,
    concentration: cat.concentration,
    quantity: '', quantityText: '',
    dose: opts.sourceItem?.dose || cat.default_dose,
    route: opts.sourceItem?.route || cat.default_route,
    posology: opts.sourceItem?.posology || '',
    treatmentDuration: '',
    notificationType: cat.notification_type ?? legacyDetect(cat.generic_name),
    cid10: '', clinicalIndication: '',
    locked: opts.locked,
    autoFilled: auto,
  };
}

export function PsychotropicFormDialog({
  open, onOpenChange, patient, controlledItems = [],
  doctorName: doctorNameProp = '', doctorCrm: doctorCrmProp = '', doctorSpecialty: doctorSpecialtyProp = '',
  hospitalName = '', hospitalAddress = '', mode = 'edit',
}: Props) {
  const currentDoctor = useCurrentDoctor();
  const doctorName = doctorNameProp || currentDoctor.fullName;
  const doctorCrm = doctorCrmProp || currentDoctor.crm;
  const doctorSpecialty = doctorSpecialtyProp || currentDoctor.specialty;

  const { controlledItems: catalog, findControlledByName, loading: catalogLoading } = useUnifiedMedicationCatalog();

  const [entries, setEntries] = useState<PsychotropicEntry[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  // Carrega entries quando abre
  useEffect(() => {
    if (!open) return;
    if (controlledItems.length > 0) {
      const fromRx = controlledItems
        .filter(i => i.status === 'active')
        .map(item => {
          const cat = findControlledByName(item.name);
          if (cat) return entryFromCatalog(cat, { locked: true, sourceItem: item });
          // Fallback sem catálogo: cria entry locked com dados crus
          const e = emptyEntry();
          e.medication = item.name;
          e.dose = item.dose;
          e.route = item.route;
          e.posology = item.posology;
          e.notificationType = legacyDetect(item.name);
          e.locked = true;
          return e;
        });
      setEntries(fromRx.length ? fromRx : [emptyEntry()]);
    } else {
      setEntries([emptyEntry()]);
    }
  }, [open, controlledItems, findControlledByName]);

  const updateEntry = (id: string, field: keyof PsychotropicEntry, value: any) => {
    setEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const next = { ...e, [field]: value };
      if (e.autoFilled.has(field)) {
        const af = new Set(e.autoFilled); af.delete(field); next.autoFilled = af;
      }
      return next;
    }));
  };

  const selectFromCatalog = (id: string, cat: ControlledCatalogItem) => {
    setEntries(prev => prev.map(e => e.id === id ? entryFromCatalog(cat, { locked: false }) : e));
  };

  const addEntry = () => setEntries(prev => [...prev, emptyEntry()]);
  const removeEntry = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  // Validação: todo item precisa de notification_type
  const blockingEntries = entries.filter(e => e.medication && !e.notificationType);
  const canPrint = entries.length > 0 && entries.every(e => e.medication && e.notificationType);

  const handlePrint = () => {
    if (!canPrint) return;
    setIsPrinting(true);
    setTimeout(() => { window.print(); setTimeout(() => setIsPrinting(false), 500); }, 100);
  };

  const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  // Agrupa por tipo para impressão
  const groupedForPrint = useMemo(() => {
    const groups: Record<NotificationType, PsychotropicEntry[]> = {
      'Receita Amarela': [], 'Receita Azul': [], 'Controle Especial 2 vias': [],
    };
    for (const e of entries) {
      if (e.notificationType) groups[e.notificationType].push(e);
    }
    return groups;
  }, [entries]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-4xl max-h-[90vh] overflow-y-auto", isPrinting && "print:block")}>
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-500" />
            {mode === 'print_direct' ? 'Imprimir Guia de Psicotrópicos' : 'Ficha de Medicações Psicotrópicas / Controladas'}
          </DialogTitle>
          <DialogDescription>
            Notificação de receita especial conforme Portaria SVS/MS nº 344/98 — ANVISA. Itens agrupados por tipo de receita.
          </DialogDescription>
        </DialogHeader>

        {/* PRINT-ONLY scope */}
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
            grouped={groupedForPrint}
            doctorName={doctorName}
            doctorCrm={doctorCrm}
            doctorSpecialty={doctorSpecialty}
            hospitalName={hospitalName}
            hospitalAddress={hospitalAddress}
            date={today}
          />
        </div>

        <div className="space-y-4 print:hidden">
          {/* Patient Summary */}
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:bg-violet-950/10 dark:border-violet-800/30 p-3">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div><span className="text-muted-foreground">Paciente:</span> <strong>{patient.name}</strong></div>
              <div><span className="text-muted-foreground">Leito:</span> <strong>{patient.bed}</strong></div>
              <div><span className="text-muted-foreground">Prontuário:</span> <strong>{patient.record || '—'}</strong></div>
              <div><span className="text-muted-foreground">Idade:</span> <strong>{patient.age || '—'}</strong></div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(NOTIFICATION_META) as NotificationType[]).map(k => (
              <Badge key={k} variant="outline" className={cn("text-[10px]", NOTIFICATION_META[k].bg)}>
                {NOTIFICATION_META[k].label} — {NOTIFICATION_META[k].description}
              </Badge>
            ))}
          </div>

          {blockingEntries.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>{blockingEntries.length} medicamento(s) sem tipo de notificação definido. Selecione antes de imprimir.</span>
            </div>
          )}

          {/* Entries */}
          {entries.map((entry) => {
            const meta = entry.notificationType ? NOTIFICATION_META[entry.notificationType] : null;
            return (
              <div key={entry.id} className={cn("rounded-lg border p-4 space-y-3", meta?.bg || 'border-border')}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    {meta && (
                      <Badge variant="outline" className={cn("text-xs", meta.bg)}>{meta.label}</Badge>
                    )}
                    {entry.locked && (
                      <Badge variant="outline" className="text-[10px] bg-violet-100 text-violet-700 border-violet-300 gap-1">
                        <Lock className="h-2.5 w-2.5" /> Da prescrição
                      </Badge>
                    )}
                    <span className="truncate max-w-[280px]">{entry.medication || 'Novo medicamento'}</span>
                  </h3>
                  {entries.length > 1 && !entry.locked && (
                    <Button variant="ghost" size="sm" onClick={() => removeEntry(entry.id)} className="h-7 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Row 1: Medication combobox */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Label className="text-[10px] flex items-center gap-1">
                      Medicamento (DCB / Comercial)
                      {entry.autoFilled.has('medication') && <Sparkles className="h-2.5 w-2.5 text-violet-500" />}
                    </Label>
                    <MedicationCombobox
                      value={entry.medication}
                      readOnly={entry.locked}
                      catalog={catalog}
                      loading={catalogLoading}
                      onSelect={(cat) => selectFromCatalog(entry.id, cat)}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] flex items-center gap-1">
                      Forma Farmacêutica
                      {entry.autoFilled.has('pharmaceuticalForm') && <Sparkles className="h-2.5 w-2.5 text-violet-500" />}
                    </Label>
                    <Input value={entry.pharmaceuticalForm} onChange={e => updateEntry(entry.id, 'pharmaceuticalForm', e.target.value)} placeholder="Comprimido, Ampola..." className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] flex items-center gap-1">
                      Concentração
                      {entry.autoFilled.has('concentration') && <Sparkles className="h-2.5 w-2.5 text-violet-500" />}
                    </Label>
                    <Input value={entry.concentration} onChange={e => updateEntry(entry.id, 'concentration', e.target.value)} placeholder="5mg, 10mg/mL..." className="h-8 text-xs" />
                  </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px]">Quantidade (número)</Label>
                    <Input value={entry.quantity} onChange={e => updateEntry(entry.id, 'quantity', e.target.value)} placeholder="30" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Quantidade (extenso)</Label>
                    <Input value={entry.quantityText} onChange={e => updateEntry(entry.id, 'quantityText', e.target.value)} placeholder="trinta" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] flex items-center gap-1">
                      Tipo de Notificação
                      {entry.autoFilled.has('notificationType') && <Sparkles className="h-2.5 w-2.5 text-violet-500" />}
                    </Label>
                    <Select value={entry.notificationType ?? ''} onValueChange={v => updateEntry(entry.id, 'notificationType', v as NotificationType)}>
                      <SelectTrigger className={cn("h-8 text-xs", !entry.notificationType && "border-destructive/60")}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(NOTIFICATION_META) as NotificationType[]).map(k => (
                          <SelectItem key={k} value={k} className="text-xs">{NOTIFICATION_META[k].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">CID-10</Label>
                    <Input value={entry.cid10} onChange={e => updateEntry(entry.id, 'cid10', e.target.value)} placeholder="F32.1" className="h-8 text-xs" />
                  </div>
                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px] flex items-center gap-1">
                      Dose {entry.autoFilled.has('dose') && <Sparkles className="h-2.5 w-2.5 text-violet-500" />}
                    </Label>
                    <Input value={entry.dose} onChange={e => updateEntry(entry.id, 'dose', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] flex items-center gap-1">
                      Via {entry.autoFilled.has('route') && <Sparkles className="h-2.5 w-2.5 text-violet-500" />}
                    </Label>
                    <Input value={entry.route} onChange={e => updateEntry(entry.id, 'route', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Posologia</Label>
                    <Input value={entry.posology} onChange={e => updateEntry(entry.id, 'posology', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Duração</Label>
                    <Input value={entry.treatmentDuration} onChange={e => updateEntry(entry.id, 'treatmentDuration', e.target.value)} placeholder="30 dias" className="h-8 text-xs" />
                  </div>
                </div>

                <div>
                  <Label className="text-[10px]">Indicação Clínica / Justificativa</Label>
                  <Textarea value={entry.clinicalIndication} onChange={e => updateEntry(entry.id, 'clinicalIndication', e.target.value)} placeholder="Indicação clínica para uso desta medicação controlada..." className="text-xs min-h-[50px] resize-none" />
                </div>
              </div>
            );
          })}

          {mode !== 'print_direct' && (
            <Button variant="outline" size="sm" onClick={addEntry} className="gap-1.5 w-full text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar Medicação
            </Button>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button
              variant={mode === 'print_direct' ? 'default' : 'outline'}
              size="sm"
              onClick={handlePrint}
              disabled={!canPrint}
              className={cn("gap-1.5", mode === 'print_direct' && "bg-violet-600 hover:bg-violet-700")}
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir Guia
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// === Combobox (Input + lista absoluta para funcionar dentro do Dialog) ===
function MedicationCombobox({
  value, readOnly, catalog, loading, onSelect,
}: {
  value: string;
  readOnly: boolean;
  catalog: ControlledCatalogItem[];
  loading: boolean;
  onSelect: (cat: ControlledCatalogItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const n = query.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
    if (n.length < 2) return [];
    return catalog.filter(c => c.searchKey.includes(n)).slice(0, 50);
  }, [query, catalog]);

  if (readOnly) {
    return (
      <Input value={value} readOnly className="h-8 text-xs bg-muted/40 cursor-not-allowed" />
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        <Input
          value={open ? query : value}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
          placeholder={loading ? 'Carregando catálogo...' : 'Digite ao menos 2 letras...'}
          className="h-8 text-xs pl-7"
        />
      </div>
      {open && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-[420px] max-h-64 overflow-y-auto rounded-md border bg-popover shadow-lg">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              Medicamento não encontrado no catálogo. Contate a farmácia para cadastro.
            </div>
          ) : (
            filtered.map(c => (
              <button
                key={`${c.catalogId}-${c.presentationId ?? 'std'}`}
                type="button"
                onClick={() => { onSelect(c); setOpen(false); setQuery(''); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center justify-between gap-2"
              >
                <span className="truncate">{c.label}</span>
                {c.notification_type && (
                  <Badge variant="outline" className={cn("text-[9px] shrink-0", NOTIFICATION_META[c.notification_type].bg)}>
                    {c.notification_type === 'Receita Amarela' ? 'A' : c.notification_type === 'Receita Azul' ? 'B' : 'C1'}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// === PRINT LAYOUT ===
function PrintablePsychotropicForm({
  patient, grouped, doctorName, doctorCrm, doctorSpecialty, hospitalName, hospitalAddress, date,
}: {
  patient: PatientData;
  grouped: Record<NotificationType, PsychotropicEntry[]>;
  doctorName: string; doctorCrm: string; doctorSpecialty: string;
  hospitalName: string; hospitalAddress: string; date: string;
}) {
  const cellStyle: React.CSSProperties = { border: '0.5px solid #94a3b8', padding: '3px 6px', fontSize: '7.5pt', lineHeight: 1.3, verticalAlign: 'top' };
  const headerCellStyle: React.CSSProperties = { ...cellStyle, fontWeight: 700, fontSize: '6.5pt', backgroundColor: '#f1f5f9', color: '#334155', textTransform: 'uppercase' as const, letterSpacing: '0.3px' };

  const groupOrder: NotificationType[] = ['Receita Amarela', 'Receita Azul', 'Controle Especial 2 vias'];
  const pages: Array<{ type: NotificationType; entries: PsychotropicEntry[] }> = [];
  for (const t of groupOrder) if (grouped[t].length > 0) pages.push({ type: t, entries: grouped[t] });

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a', width: '186mm', margin: '0 auto', lineHeight: 1.3 }}>
      {pages.map((page, pageIdx) => {
        const meta = NOTIFICATION_META[page.type];
        return (
          <div key={page.type} style={{ pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto' }}>
            <div style={{ border: `2px solid ${meta.color}`, borderBottom: 'none', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: `${meta.color}10` }}>
              <div>
                <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0c4a6e' }}>{hospitalName || 'HOSPITAL MUNICIPAL'}</div>
                <div style={{ fontSize: '6.5pt', color: '#64748b' }}>{hospitalAddress || 'Endereço da unidade hospitalar'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10pt', fontWeight: 800, color: meta.color, textTransform: 'uppercase' }}>{meta.label}</div>
                <div style={{ fontSize: '6pt', color: '#64748b' }}>Portaria SVS/MS nº 344/98 — ANVISA</div>
                <div style={{ fontSize: '6pt', color: '#94a3b8' }}>1ª Via — Retenção pela Farmácia</div>
              </div>
            </div>

            {page.entries.map((entry, idx) => (
              <table key={entry.id} style={{ width: '100%', borderCollapse: 'collapse', border: `2px solid ${meta.color}`, borderTop: idx === 0 ? `2px solid ${meta.color}` : 'none', marginBottom: idx < page.entries.length - 1 ? 8 : 0 }}>
                <tbody>
                  <tr>
                    <td style={{ ...headerCellStyle, backgroundColor: '#e2e8f0', fontWeight: 800, fontSize: '7pt' }} colSpan={6}>IDENTIFICAÇÃO DO EMITENTE</td>
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

                  <tr>
                    <td style={{ ...headerCellStyle, backgroundColor: '#e2e8f0', fontWeight: 800, fontSize: '7pt' }} colSpan={6}>IDENTIFICAÇÃO DO PACIENTE</td>
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
                    <td style={{ ...headerCellStyle, backgroundColor: meta.color, color: '#fff', fontWeight: 800, fontSize: '7pt' }} colSpan={6}>MEDICAMENTO</td>
                  </tr>
                  <tr>
                    <td style={headerCellStyle}>Medicamento</td>
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
            ))}

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

            <div style={{ marginTop: '8px', padding: '4px 8px', border: '0.5px solid #e2e8f0', fontSize: '5.5pt', color: '#64748b', lineHeight: 1.4 }}>
              <strong>ATENÇÃO:</strong> Este receituário é válido por 30 dias a contar da data de emissão. A quantidade prescrita é limitada a 60 dias de tratamento. Uso exclusivo em ambiente hospitalar conforme Portaria SVS/MS nº 344/98 e RDC nº 58/2007.
            </div>

            <div style={{ marginTop: '6px', fontSize: '5.5pt', color: '#94a3b8', textAlign: 'center' }}>
              Documento gerado pelo sistema BigHelp Map — {date}
            </div>
          </div>
        );
      })}
    </div>
  );
}
