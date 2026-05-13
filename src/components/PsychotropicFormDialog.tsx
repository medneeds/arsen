import React, { useState, useEffect, useMemo, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Brain, Printer, Plus, Trash2, AlertTriangle, Sparkles, Search, Lock, ShieldAlert, X } from "lucide-react";
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
import { openPrintWindow } from "@/lib/printNormaZero";

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
  /** print_direct = abre direto em modo somente-leitura para impressão (Norma Zero + Portaria 344) */
  mode?: 'edit' | 'print_direct';
  /** CID-10 primário do paciente puxado da admissão (usado no modo print_direct) */
  cidPrimary?: string;
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

/**
 * Calcula a quantidade necessária para 24h baseado em dose × frequência diária.
 * Posologias SOS / "se necessário" caem para quantidade mínima 1.
 */
function calc24hQuantity(dose: string, posology: string): { qty: string; qtyText: string } {
  const p = (posology || '').toLowerCase();
  // SOS / se necessário → quantidade mínima 1
  if (/sos|s\/?n|se necess|se preciso|caso necess/.test(p)) {
    return { qty: '1', qtyText: 'um (mínimo, SOS)' };
  }
  let freq = 1;
  const interval = p.match(/(\d+)\s*\/\s*\d+\s*h/);
  if (interval) {
    freq = Math.max(1, Math.round(24 / parseInt(interval[1], 10)));
  } else {
    const xDay = p.match(/(\d+)\s*x\s*(?:\/|ao|por)?\s*dia/);
    if (xDay) freq = parseInt(xDay[1], 10);
    else if (/24\s*\/\s*24h|1x|uma vez|noite|manh[ãa]|dormir/.test(p)) freq = 1;
  }
  const numMatch = (dose || '').replace(',', '.').match(/[\d.]+/);
  const num = numMatch ? parseFloat(numMatch[0]) : 0;
  if (!num) return { qty: String(freq), qtyText: `${freq}× em 24h` };
  const total = +(num * freq).toFixed(2);
  const unit = (dose || '').replace(/[\d.,\s]/g, '').slice(0, 10) || '';
  return { qty: `${total}${unit ? ' ' + unit : ''}`, qtyText: `${freq}× em 24h` };
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

function entryFromCatalog(cat: ControlledCatalogItem, opts: { locked: boolean; sourceItem?: PrescriptionItem; cidPrimary?: string }): PsychotropicEntry {
  const auto = new Set<keyof PsychotropicEntry>(['medication', 'pharmaceuticalForm', 'concentration', 'route', 'dose', 'notificationType']);
  const dose = opts.sourceItem?.dose || cat.default_dose;
  const posology = opts.sourceItem?.posology || '';
  const calc = calc24hQuantity(dose, posology);
  return {
    id: crypto.randomUUID(),
    catalogId: cat.catalogId,
    medication: cat.label,
    pharmaceuticalForm: cat.pharmaceutical_form,
    concentration: cat.concentration,
    quantity: calc.qty,
    quantityText: calc.qtyText,
    dose,
    route: opts.sourceItem?.route || cat.default_route,
    posology,
    treatmentDuration: '24h',
    notificationType: cat.notification_type ?? legacyDetect(cat.generic_name),
    cid10: opts.cidPrimary || '',
    clinicalIndication: '',
    locked: opts.locked,
    autoFilled: auto,
  };
}

export function PsychotropicFormDialog({
  open, onOpenChange, patient, controlledItems = [],
  doctorName: doctorNameProp = '', doctorCrm: doctorCrmProp = '', doctorSpecialty: doctorSpecialtyProp = '',
  hospitalName = '', hospitalAddress = '', mode = 'edit', cidPrimary = '',
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
          if (cat) return entryFromCatalog(cat, { locked: true, sourceItem: item, cidPrimary });
          // Fallback sem catálogo: cria entry locked com dados crus
          const e = emptyEntry();
          e.medication = item.name;
          e.dose = item.dose;
          e.route = item.route;
          e.posology = item.posology;
          e.notificationType = legacyDetect(item.name);
          e.cid10 = cidPrimary || '';
          e.treatmentDuration = '24h';
          const calc = calc24hQuantity(item.dose, item.posology);
          e.quantity = calc.qty;
          e.quantityText = calc.qtyText;
          e.locked = true;
          return e;
        });
      setEntries(fromRx.length ? fromRx : [emptyEntry()]);
    } else {
      setEntries([emptyEntry()]);
    }
  }, [open, controlledItems, findControlledByName, cidPrimary]);

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
    setEntries(prev => prev.map(e => e.id === id ? entryFromCatalog(cat, { locked: false, cidPrimary }) : e));
  };

  const addEntry = () => setEntries(prev => [...prev, emptyEntry()]);
  const removeEntry = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  // Validação: todo item precisa de notification_type
  const blockingEntries = entries.filter(e => e.medication && !e.notificationType);
  const canPrint = entries.length > 0 && entries.every(e => e.medication && e.notificationType);

  const handlePrint = () => {
    if (!canPrint) return;
    const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
    const docCode = `PORT344-${format(new Date(), "yyyyMMdd-HHmm")}`;
    const formMarkup = renderToStaticMarkup(
      <PrintablePsychotropicForm
        patient={patient}
        grouped={groupedForPrint}
        doctorName={doctorName}
        doctorCrm={doctorCrm}
        doctorSpecialty={doctorSpecialty}
        hospitalName={hospitalName}
        hospitalAddress={hospitalAddress}
        date={today}
        docCode={docCode}
      />
    );
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Receituário Portaria 344 — ${docCode}</title>
<style>
  @page { size: A4 portrait; margin: 8mm 12mm; }
  :root { color-scheme: light only; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
  @media print {
    html, body { width: 210mm; }
  }
</style>
</head><body>${formMarkup}
<script>window.onload = () => { setTimeout(() => { window.focus(); window.print(); }, 350); };</script>
</body></html>`;
    openPrintWindow(html, "Preparando receituário Portaria 344…");
    // Dispara afterprint na janela atual para o orquestrador (PrescricaoPage) seguir o fluxo
    setTimeout(() => window.dispatchEvent(new Event('afterprint')), 800);
  };

  const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
  const docCode = useMemo(() => `PORT344-${format(new Date(), "yyyyMMdd-HHmm")}`, [open]);

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

  const isPrintDirect = mode === 'print_direct';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-500" />
            {isPrintDirect ? 'Receituário Portaria 344 — Impressão' : 'Ficha de Medicações Psicotrópicas / Controladas'}
          </DialogTitle>
          <DialogDescription>
            {isPrintDirect
              ? 'Documento gerado automaticamente em formato Norma Zero (MAN.05-001) conforme Portaria SVS/MS nº 344/98 — ANVISA. Edições devem ser feitas no corpo da prescrição.'
              : 'Notificação de receita especial conforme Portaria SVS/MS nº 344/98 — ANVISA. Itens agrupados por tipo de receita.'}
          </DialogDescription>
        </DialogHeader>

        {/* === MODO PRINT-ONLY (Norma Zero + 344) === */}
        {isPrintDirect ? (
          <div className="space-y-3 print:hidden">
            {/* Aviso de modo somente-leitura */}
            <div className="rounded-md border border-violet-200 bg-violet-50/60 dark:bg-violet-950/20 dark:border-violet-800/40 p-3 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
              <div className="text-xs text-violet-900 dark:text-violet-200">
                <strong>Modo somente-impressão.</strong> CID puxado da admissão · Quantidade calculada para 24h ·
                Indicação clínica e duração não se aplicam (validade fixa de 24h). Para ajustes, edite o item no corpo da prescrição.
              </div>
            </div>

            {blockingEntries.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>{blockingEntries.length} medicamento(s) sem tipo de notificação resolvido — não podem ser impressos.</span>
              </div>
            )}

            {/* Preview cards agrupados por tipo de receita */}
            <ReadOnlyPreview
              grouped={groupedForPrint}
              cidPrimary={cidPrimary}
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Fechar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handlePrint}
                disabled={!canPrint}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700"
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir Receituário
              </Button>
            </div>
          </div>
        ) : (
          /* === MODO EDIÇÃO COMPLETO (legado, aberto manualmente) === */
          <div className="space-y-4 print:hidden">
            <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:bg-violet-950/10 dark:border-violet-800/30 p-3">
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><span className="text-muted-foreground">Paciente:</span> <strong>{patient.name}</strong></div>
                <div><span className="text-muted-foreground">Leito:</span> <strong>{patient.bed}</strong></div>
                <div><span className="text-muted-foreground">Prontuário:</span> <strong>{patient.record || '—'}</strong></div>
                <div><span className="text-muted-foreground">Idade:</span> <strong>{patient.age || '—'}</strong></div>
              </div>
            </div>

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
                      <Label className="text-[10px]">Forma Farmacêutica</Label>
                      <Input value={entry.pharmaceuticalForm} onChange={e => updateEntry(entry.id, 'pharmaceuticalForm', e.target.value)} placeholder="Comprimido, Ampola..." className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Concentração</Label>
                      <Input value={entry.concentration} onChange={e => updateEntry(entry.id, 'concentration', e.target.value)} placeholder="5mg, 10mg/mL..." className="h-8 text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[10px]">Quantidade</Label>
                      <Input value={entry.quantity} onChange={e => updateEntry(entry.id, 'quantity', e.target.value)} placeholder="30" className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Quantidade (extenso)</Label>
                      <Input value={entry.quantityText} onChange={e => updateEntry(entry.id, 'quantityText', e.target.value)} placeholder="trinta" className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Tipo de Notificação</Label>
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

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[10px]">Dose</Label>
                      <Input value={entry.dose} onChange={e => updateEntry(entry.id, 'dose', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Via</Label>
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

            <Button variant="outline" size="sm" onClick={addEntry} className="gap-1.5 w-full text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar Medicação
            </Button>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={!canPrint}
                className="gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir Guia
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// === Preview somente-leitura agrupado por tipo (modo print_direct) ===
function ReadOnlyPreview({
  grouped, cidPrimary,
}: {
  grouped: Record<NotificationType, PsychotropicEntry[]>;
  cidPrimary?: string;
}) {
  const groupOrder: NotificationType[] = ['Receita Amarela', 'Receita Azul', 'Controle Especial 2 vias'];
  const hasAny = groupOrder.some(t => grouped[t].length > 0);
  if (!hasAny) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        Nenhum item controlado/psicotrópico ativo na prescrição.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {groupOrder.map(type => {
        const list = grouped[type];
        if (!list.length) return null;
        const meta = NOTIFICATION_META[type];
        return (
          <div key={type} className={cn("rounded-md border", meta.bg)}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-current/10">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{list.length} item(s)</span>
            </div>
            <div className="divide-y divide-current/10">
              {list.map(e => (
                <div key={e.id} className="px-3 py-2 grid grid-cols-12 gap-2 text-[11px]">
                  <div className="col-span-4 font-semibold truncate" title={e.medication}>{e.medication}</div>
                  <div className="col-span-2 text-muted-foreground">{e.concentration || '—'}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Dose: </span>{e.dose || '—'}</div>
                  <div className="col-span-1"><span className="text-muted-foreground">Via: </span>{e.route || '—'}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Posol.: </span>{e.posology || '—'}</div>
                  <div className="col-span-1 text-right"><span className="text-muted-foreground">24h: </span><strong>{e.quantity || '—'}</strong></div>
                  <div className="col-span-12 text-[10px] text-muted-foreground flex gap-3">
                    <span>CID-10: <strong className="text-foreground">{e.cid10 || (cidPrimary ? cidPrimary : '⚠ não definido na admissão')}</strong></span>
                    <span>Validade: <strong className="text-foreground">24h</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
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

// === PRINT LAYOUT (Norma Zero + Portaria 344) ===
function PrintablePsychotropicForm({
  patient, grouped, doctorName, doctorCrm, doctorSpecialty, hospitalName, hospitalAddress, date, docCode,
}: {
  patient: PatientData;
  grouped: Record<NotificationType, PsychotropicEntry[]>;
  doctorName: string; doctorCrm: string; doctorSpecialty: string;
  hospitalName: string; hospitalAddress: string; date: string; docCode: string;
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
            {/* === Norma Zero institutional header === */}
            <div style={{ borderBottom: '1px solid #0f172a', paddingBottom: '4px', marginBottom: '4px', textAlign: 'center' }}>
              <div style={{ fontSize: '6.5pt', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prefeitura Municipal · Secretaria Municipal de Saúde</div>
              <div style={{ fontSize: '10pt', fontWeight: 800, color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{hospitalName || 'HOSPITAL MUNICIPAL'}</div>
              <div style={{ fontSize: '6pt', color: '#64748b' }}>{hospitalAddress || 'Endereço da unidade hospitalar'}</div>
              {/* Faixa cruz colorida institucional */}
              <div style={{ display: 'flex', height: '3px', marginTop: '4px' }}>
                <div style={{ flex: 1, backgroundColor: '#dc2626' }} />
                <div style={{ flex: 1, backgroundColor: '#ea580c' }} />
                <div style={{ flex: 1, backgroundColor: '#facc15' }} />
                <div style={{ flex: 1, backgroundColor: '#16a34a' }} />
                <div style={{ flex: 1, backgroundColor: '#0054a6' }} />
              </div>
            </div>

            {/* Doc-bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '6pt', color: '#64748b', marginBottom: '6px', padding: '2px 4px', backgroundColor: '#f1f5f9' }}>
              <span><strong>Doc:</strong> {docCode}</span>
              <span><strong>Setor:</strong> {patient.unit || '—'}</span>
              <span><strong>Emissão:</strong> {date}</span>
            </div>

            {/* Faixa do tipo de receita */}
            <div style={{ border: `2px solid ${meta.color}`, borderBottom: 'none', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: `${meta.color}10` }}>
              <div style={{ fontSize: '10pt', fontWeight: 800, color: meta.color, textTransform: 'uppercase' }}>{meta.label}</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '6.5pt', color: '#64748b' }}>Portaria SVS/MS nº 344/98 — ANVISA</div>
                <div style={{ fontSize: '6pt', color: '#94a3b8' }}>Validade: 24h · 1ª Via — Retenção pela Farmácia</div>
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
                    <td style={cellStyle} colSpan={3}>{entry.posology || '—'}</td>
                  </tr>
                  <tr>
                    <td style={headerCellStyle}>Quantidade (24h)</td>
                    <td style={{ ...cellStyle, fontWeight: 700 }}>{entry.quantity || '—'}</td>
                    <td style={headerCellStyle}>CID-10</td>
                    <td style={cellStyle}>{entry.cid10 || '—'}</td>
                    <td style={headerCellStyle}>Validade</td>
                    <td style={cellStyle}>24 horas</td>
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
              <strong>ATENÇÃO:</strong> Receituário hospitalar emitido conforme Portaria SVS/MS nº 344/98 e RDC nº 58/2007 — uso restrito ao ambiente hospitalar. Validade desta prescrição: <strong>24 horas</strong> (renovação diária no corpo da prescrição médica). CID-10 puxado da admissão do paciente; quantidade calculada para 24h baseada em dose × posologia.
            </div>

            <div style={{ marginTop: '6px', fontSize: '5.5pt', color: '#94a3b8', textAlign: 'center', borderTop: '0.5px solid #e2e8f0', paddingTop: '3px' }}>
              {hospitalName || 'HMDM'} · Arsen 1.0 · MAN.05-001 v05 · Conformidade LGPD/CFM · {date} · {docCode}
            </div>
          </div>
        );
      })}
    </div>
  );
}
