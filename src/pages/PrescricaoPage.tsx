import React, { useState, useRef, useMemo, useCallback } from "react";
import { format, addDays } from "date-fns";
import bighelpLogo from "@/assets/bighelp-map-logo.png";
import socorraoLogo from "@/assets/socorrao1-logo.png";
import { ptBR } from "date-fns/locale";
import {
  Pill, Plus, Trash2, Copy, Printer, Save, RefreshCw,
  Search, AlertTriangle, UtensilsCrossed, Droplets, Syringe,
  ClipboardList, X, Check, Shield, Wind, TestTube, FileText,
  GripVertical, CheckSquare, Square, Pause, MoreHorizontal,
  Play, CopyPlus, Lock, Eye, EyeOff, ShieldCheck, Fingerprint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ALL_ITEMS_BY_CATEGORY,
  CATEGORY_CONFIG,
  PRESCRIPTION_FLAGS,
  ROUTES,
  POSOLOGIES,
  type MedicationEntry,
  type PrescriptionCategory,
  type PrescriptionFlag,
} from "@/data/medicationsDatabase";

// --- Types ---
interface DigitalSignature {
  doctorName: string;
  crm: string;
  signedAt: string;
  hash: string;
}

interface PrescriptionItem {
  id: string;
  name: string;
  presentation: string;
  dose: string;
  route: string;
  posology: string;
  schedule: string;
  instructions: string;
  category: PrescriptionCategory;
  flags: PrescriptionFlag[];
  highAlert: boolean;
  status: 'active' | 'suspended';
  suspensionReason?: string;
  suspendedAt?: string;
}

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

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  UtensilsCrossed, Droplets, Pill, Shield, AlertTriangle,
  Wind, TestTube, ClipboardList, FileText,
};

const TAB_ORDER: PrescriptionCategory[] = [
  'nutrition', 'hydration', 'medication', 'antimicrobial',
  'high_alert', 'inhalation', 'hemotherapy', 'care', 'nonstandard',
];

// --- Autocomplete Component ---
function MedicationAutocomplete({
  source,
  onSelect,
  placeholder,
}: {
  source: MedicationEntry[];
  onSelect: (med: MedicationEntry) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return source.slice(0, 8);
    const q = query.toLowerCase();
    return source.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.presentation.toLowerCase().includes(q) ||
        (m.aliases && m.aliases.some(a => a.toLowerCase().includes(q)))
    ).slice(0, 10);
  }, [query, source]);

  const handleSelect = (med: MedicationEntry) => {
    onSelect(med);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder}
          className="pl-9 bg-muted/30 border-border/50 focus:border-primary/50 transition-colors"
        />
      </div>
      {focused && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {filtered.map((med) => (
            <button
              key={med.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(med)}
              className="w-full px-3 py-2.5 text-left hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 border-b border-border/30 last:border-0"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground block truncate">
                  {med.name}
                  {med.highAlert && <AlertTriangle className="inline h-3 w-3 ml-1 text-red-500" />}
                </span>
                <span className="text-xs text-muted-foreground block truncate">{med.presentation}</span>
              </div>
              {med.defaultRoute !== '-' && (
                <Badge variant="outline" className="text-[10px] shrink-0">{med.defaultRoute}</Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Flag Toggle ---
function FlagToggle({ flag, active, onToggle }: {
  flag: typeof PRESCRIPTION_FLAGS[number];
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all",
            active ? flag.color : "bg-muted/30 text-muted-foreground/50 border-border/30"
          )}
        >
          {flag.label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{flag.fullLabel}</TooltipContent>
    </Tooltip>
  );
}

// --- Sortable Prescription Item Row ---
function SortablePrescriptionItemRow({
  item,
  index,
  onUpdate,
  onRemove,
  onToggleFlag,
  isSimple,
  selected,
  onToggleSelect,
  onDuplicate,
  onRequestSuspend,
  onReactivate,
}: {
  item: PrescriptionItem;
  index: number;
  onUpdate: (id: string, field: keyof PrescriptionItem, value: string) => void;
  onRemove: (id: string) => void;
  onToggleFlag: (id: string, flag: PrescriptionFlag) => void;
  isSimple?: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRequestSuspend: (id: string) => void;
  onReactivate: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  const ItemActions = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onDuplicate(item.id)} className="text-xs gap-2">
          <CopyPlus className="h-3.5 w-3.5" /> Duplicar item
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {item.status === 'active' ? (
          <DropdownMenuItem onClick={() => onRequestSuspend(item.id)} className="text-xs gap-2 text-yellow-600">
            <Pause className="h-3.5 w-3.5" /> Suspender item
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onReactivate(item.id)} className="text-xs gap-2 text-green-600">
            <Play className="h-3.5 w-3.5" /> Reativar item
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onRemove(item.id)} className="text-xs gap-2 text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Excluir item
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isSimple) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-2 px-2.5 py-2 rounded-lg border group transition-all",
          item.status === 'suspended'
            ? "border-destructive/30 bg-destructive/5 opacity-60"
            : "border-border/40 bg-muted/20",
          selected && "ring-2 ring-primary/40 border-primary/30",
          isDragging && "shadow-lg"
        )}
      >
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(item.id)}
          className="shrink-0"
        />
        <span className="text-xs font-mono text-muted-foreground w-5">{index + 1}.</span>
        <div className="flex-1 min-w-0">
          <span className={cn("text-sm font-medium", item.status === 'suspended' && "line-through")}>
            {item.name}
          </span>
          {item.status === 'suspended' && item.suspensionReason && (
            <p className="text-[10px] text-destructive/70 italic truncate">Motivo: {item.suspensionReason}</p>
          )}
        </div>
        {item.dose !== '-' && <Badge variant="outline" className="text-[10px]">{item.dose}</Badge>}
        {item.posology !== '-' && <Badge variant="secondary" className="text-[10px]">{item.posology}</Badge>}
        {item.status === 'suspended' && (
          <Badge variant="destructive" className="text-[9px] px-1.5">SUSPENSO</Badge>
        )}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {PRESCRIPTION_FLAGS.map(f => (
            <FlagToggle
              key={f.key}
              flag={f}
              active={item.flags.includes(f.key)}
              onToggle={() => onToggleFlag(item.id, f.key)}
            />
          ))}
        </div>
        <ItemActions />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border transition-all",
        item.status === 'suspended'
          ? "border-destructive/30 bg-destructive/5 opacity-60"
          : "border-border/50 bg-card/50 hover:border-primary/20",
        item.highAlert && item.status !== 'suspended' && "border-red-300/50 bg-red-50/30 dark:bg-red-950/10",
        selected && "ring-2 ring-primary/40 border-primary/30",
        isDragging && "shadow-lg"
      )}
    >
      <div className="flex items-start gap-2 p-2.5">
        <div className="flex flex-col items-center gap-1.5 shrink-0 pt-1">
          <button
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(item.id)}
          />
        </div>
        <span className="text-xs font-mono text-muted-foreground w-6 text-center shrink-0 pt-1.5">
          {index + 1}.
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-sm font-semibold text-foreground", item.status === 'suspended' && "line-through")}>
              {item.highAlert && <AlertTriangle className="inline h-3 w-3 mr-1 text-red-500" />}
              {item.name}
              {item.presentation && item.presentation !== '-' && (
                <span className="font-normal text-muted-foreground ml-1">({item.presentation})</span>
              )}
            </p>
            {item.status === 'suspended' && (
              <Badge variant="destructive" className="text-[9px] px-1.5">SUSPENSO</Badge>
            )}
            <div className="flex gap-0.5 ml-auto">
              {PRESCRIPTION_FLAGS.map(f => (
                <FlagToggle
                  key={f.key}
                  flag={f}
                  active={item.flags.includes(f.key)}
                  onToggle={() => onToggleFlag(item.id, f.key)}
                />
              ))}
              <ItemActions />
            </div>
          </div>
          {item.status === 'suspended' && item.suspensionReason && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-destructive/10 border border-destructive/20">
              <Pause className="h-3 w-3 text-destructive/70 shrink-0" />
              <p className="text-[10px] text-destructive/80 italic">
                Motivo: {item.suspensionReason}
                {item.suspendedAt && <span className="ml-1 text-destructive/50">({item.suspendedAt})</span>}
              </p>
            </div>
          )}
          {item.status === 'active' && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Input value={item.dose} onChange={(e) => onUpdate(item.id, "dose", e.target.value)} className="h-7 text-xs bg-muted/20 border-border/30 w-24" placeholder="Dose" />
                <span className="text-muted-foreground text-[10px]">—</span>
                <Select value={item.route} onValueChange={(v) => onUpdate(item.id, "route", v)}>
                  <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/30 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROUTES.map((r) => (<SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>))}</SelectContent>
                </Select>
                <span className="text-muted-foreground text-[10px]">—</span>
                <Select value={item.posology} onValueChange={(v) => onUpdate(item.id, "posology", v)}>
                  <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/30 w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{POSOLOGIES.map((p) => (<SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>))}</SelectContent>
                </Select>
                <span className="text-muted-foreground text-[10px]">—</span>
                <Input value={item.schedule} onChange={(e) => onUpdate(item.id, "schedule", e.target.value)} className="h-7 text-xs bg-muted/20 border-border/30 w-20" placeholder="Horário" />
              </div>
              <Input
                value={item.instructions}
                onChange={(e) => onUpdate(item.id, "instructions", e.target.value)}
                className="h-7 text-[11px] bg-muted/10 border-border/20 text-muted-foreground italic pl-2.5 focus:text-foreground focus:not-italic"
                placeholder="Preparo, diluição, tempo de infusão, gotas/min, mL/h..."
              />
            </>
          )}
          {item.flags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {item.flags.map(fk => {
                const f = PRESCRIPTION_FLAGS.find(pf => pf.key === fk);
                return f ? (
                  <Badge key={fk} variant="outline" className={cn("text-[9px] px-1.5", f.color)}>
                    {f.fullLabel}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Suspension Dialog ---
function SuspensionDialog({
  open,
  onClose,
  onConfirm,
  itemName,
  isBatch,
  batchCount,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  itemName?: string;
  isBatch?: boolean;
  batchCount?: number;
}) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) {
      toast.error("Motivo obrigatório para suspensão");
      return;
    }
    onConfirm(reason.trim());
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-600">
            <Pause className="h-5 w-5" />
            Suspender {isBatch ? `${batchCount} itens` : 'Item'}
          </DialogTitle>
          <DialogDescription>
            {isBatch
              ? `Informe o motivo para suspender ${batchCount} itens selecionados.`
              : <>Informe o motivo para suspender: <strong>{itemName}</strong></>
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs font-medium">Motivo da suspensão *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Paciente apresentou reação adversa, substituição por outro medicamento..."
            className="min-h-[80px] text-sm"
            autoFocus
          />
          <div className="flex gap-1.5 flex-wrap">
            {['Reação adversa', 'Alta médica', 'Substituição terapêutica', 'Suspensão temporária', 'Erro de prescrição'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted/50 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!reason.trim()} className="gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white">
            <Pause className="h-3.5 w-3.5" /> Confirmar Suspensão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Renewal Dialog ---
function RenewalDialog({
  open,
  onClose,
  onConfirm,
  activeCount,
  suspendedCount,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (includeSuspended: boolean) => void;
  activeCount: number;
  suspendedCount: number;
}) {
  const [includeSuspended, setIncludeSuspended] = useState(false);
  const tomorrow = format(addDays(new Date(), 1), "dd/MM/yyyy", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Renovar Prescrição
          </DialogTitle>
          <DialogDescription>
            Renovar prescrição para <strong>{tomorrow}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span>Itens ativos</span>
              <Badge variant="secondary">{activeCount}</Badge>
            </div>
            {suspendedCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Itens suspensos</span>
                <Badge variant="destructive" className="text-[10px]">{suspendedCount}</Badge>
              </div>
            )}
          </div>
          {suspendedCount > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={includeSuspended}
                onCheckedChange={(v) => setIncludeSuspended(!!v)}
              />
              Incluir itens suspensos (reativados)
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Os itens serão duplicados para a nova prescrição. Itens suspensos{!includeSuspended && ' NÃO'} serão incluídos.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => onConfirm(includeSuspended)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Renovar para {tomorrow}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Print-only Item Row ---
function PrintItemRow({ item, index }: { item: PrescriptionItem; index: number }) {
  return (
    <tr style={{ pageBreakInside: 'avoid' }}>
      <td className="border border-black/25 px-1 py-[2px] align-top" style={{ width: '75%' }}>
        <p className="text-[9px] leading-[1.3]">
          <span className="font-bold">{index + 1}. {item.name}</span>
          {item.presentation && item.presentation !== '-' && <span className="font-normal"> ({item.presentation})</span>}
          {item.dose && item.dose !== '-' && <span> — {item.dose}</span>}
          {item.route && item.route !== '-' && <span> — {item.route}</span>}
          {item.posology && item.posology !== '-' && <span> — {item.posology}</span>}
          {item.schedule && item.schedule !== '-' && <span> — <span className="font-semibold">{item.schedule}</span></span>}
          {item.flags.length > 0 && (
            <span className="font-bold text-[8px]"> [{item.flags.map(f => f.toUpperCase()).join(', ')}]</span>
          )}
          {item.status === 'suspended' && <span className="text-red-600 font-bold"> [SUSPENSO]</span>}
        </p>
        {item.instructions && (
          <p className="text-[8px] italic text-gray-600 ml-2 leading-[1.2]">↳ {item.instructions}</p>
        )}
      </td>
      {[0,1,2,3,4,5].map(i => (
        <td key={i} className="border border-black/25 text-center align-middle" style={{ width: '4.16%', minWidth: '24px' }}>
          <div className="h-[18px]" />
        </td>
      ))}
    </tr>
  );
}

function PrintSimpleRow({ item, index }: { item: PrescriptionItem; index: number }) {
  return (
    <tr style={{ pageBreakInside: 'avoid' }}>
      <td className="border border-black/25 px-1 py-[2px] align-top" colSpan={7}>
        <p className="text-[9px] leading-[1.3]">
          <span className="font-bold">{index + 1}.</span> {item.name}
          {item.dose && item.dose !== '-' ? ` — ${item.dose}` : ''}
          {item.posology && item.posology !== '-' ? ` — ${item.posology}` : ''}
        </p>
      </td>
    </tr>
  );
}

// --- Batch Action Bar ---
function BatchActionBar({
  selectedCount,
  onSelectAll,
  onDeselectAll,
  allSelected,
  onSuspendSelected,
  onDeleteSelected,
  onDuplicateSelected,
}: {
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  allSelected: boolean;
  onSuspendSelected: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-1 duration-200">
      <Checkbox
        checked={allSelected}
        onCheckedChange={() => allSelected ? onDeselectAll() : onSelectAll()}
      />
      <span className="text-xs font-medium text-primary">
        {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
      </span>
      <div className="flex-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onDuplicateSelected}>
            <Copy className="h-3 w-3" /> Duplicar
          </Button>
        </TooltipTrigger>
        <TooltipContent>Duplicar itens selecionados</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs text-yellow-600 hover:text-yellow-700 border-yellow-200 hover:border-yellow-300" onClick={onSuspendSelected}>
            <Pause className="h-3 w-3" /> Suspender
          </Button>
        </TooltipTrigger>
        <TooltipContent>Suspender itens selecionados</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50" onClick={onDeleteSelected}>
            <Trash2 className="h-3 w-3" /> Excluir
          </Button>
        </TooltipTrigger>
        <TooltipContent>Excluir itens selecionados</TooltipContent>
      </Tooltip>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onDeselectAll}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// --- Sign Prescription Dialog (Dual Verification) ---
function SignPrescriptionDialog({
  open, onClose, onConfirm, totalItems, activeItems,
}: {
  open: boolean; onClose: () => void; onConfirm: (sig: DigitalSignature) => void;
  totalItems: number; activeItems: number;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [doctorName, setDoctorName] = useState("");
  const [crm, setCrm] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setStep(1); setDoctorName(""); setCrm(""); setPassword(""); setConfirmPassword(""); setShowPassword(false); setShowConfirm(false); setVerifying(false); setError(""); };
  const handleClose = () => { reset(); onClose(); };
  const isStep1Valid = doctorName.trim().length >= 3 && /^\d{4,8}$/.test(crm.trim());

  const handleStep1 = () => { if (!isStep1Valid) return; setError(""); setStep(2); };

  const handleSign = async () => {
    setError("");
    if (password.length < 4) { setError("Senha deve ter no mínimo 4 caracteres"); return; }
    if (password !== confirmPassword) { setError("As senhas não coincidem"); return; }
    setVerifying(true);
    await new Promise(r => setTimeout(r, 1200));
    const now = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    const raw = `${doctorName}|${crm}|${now}|${activeItems}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16).toUpperCase();
    const sig: DigitalSignature = { doctorName: doctorName.trim().toUpperCase(), crm: crm.trim(), signedAt: now, hash };
    setVerifying(false);
    reset();
    onConfirm(sig);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" /> Assinatura Digital da Prescrição
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? "Etapa 1/2 — Identificação do prescritor" : "Etapa 2/2 — Dupla verificação de credenciais"}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Itens ativos</span><span className="font-medium">{activeItems}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Total de itens</span><span className="font-medium">{totalItems}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Data/Hora</span><span className="font-medium">{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span></div>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors", step >= 1 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground")}>1</div>
          <div className={cn("w-12 h-0.5 transition-colors", step >= 2 ? "bg-primary" : "bg-muted-foreground/20")} />
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors", step >= 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground")}>2</div>
        </div>
        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sig-name" className="text-xs font-medium">Nome completo do médico</Label>
              <Input id="sig-name" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr(a). Nome Completo" className="bg-muted/30" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sig-crm" className="text-xs font-medium">Número do CRM</Label>
              <Input id="sig-crm" value={crm} onChange={(e) => setCrm(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 12345" maxLength={8} className="bg-muted/30" />
              {crm && !/^\d{4,8}$/.test(crm) && <p className="text-[10px] text-destructive">CRM deve conter entre 4 e 8 dígitos</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Confirme sua identidade digitando sua senha duas vezes para validar a assinatura.</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sig-pwd" className="text-xs font-medium">Senha</Label>
              <div className="relative">
                <Input id="sig-pwd" type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="Digite sua senha" className="bg-muted/30 pr-9" autoFocus />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sig-pwd2" className="text-xs font-medium">Confirmar senha</Label>
              <div className="relative">
                <Input id="sig-pwd2" type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} placeholder="Confirme sua senha" className="bg-muted/30 pr-9" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && confirmPassword && password === confirmPassword && <p className="text-[10px] text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Senhas coincidem</p>}
            </div>
            {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {error}</p>}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          {step === 2 && <Button variant="ghost" size="sm" onClick={() => setStep(1)} disabled={verifying} className="mr-auto text-xs">Voltar</Button>}
          <Button variant="outline" size="sm" onClick={handleClose} disabled={verifying} className="text-xs">Cancelar</Button>
          {step === 1 ? (
            <Button size="sm" onClick={handleStep1} disabled={!isStep1Valid} className="gap-1.5 text-xs">Próximo <Check className="h-3 w-3" /></Button>
          ) : (
            <Button size="sm" onClick={handleSign} disabled={verifying || !password || !confirmPassword} className="gap-1.5 text-xs">
              {verifying ? (<><span className="animate-spin h-3 w-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full inline-block" /> Verificando...</>) : (<><ShieldCheck className="h-3.5 w-3.5" /> Assinar Prescrição</>)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== MAIN COMPONENT =====================
const PrescricaoPage = () => {
  const [patient, setPatient] = useState<PatientHeader>({
    name: "", birthDate: "", age: "", sex: "", bed: "",
    unit: "", record: "", admissionDate: "", weight: "", allergies: "",
  });

  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [activeTab, setActiveTab] = useState<PrescriptionCategory>('nutrition');
  const [nonStdName, setNonStdName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Phase 3 state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<{ id?: string; isBatch?: boolean; name?: string }>({});
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);

  // Phase 4 state — Digital Signature
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [digitalSignature, setDigitalSignature] = useState<DigitalSignature | null>(null);

  const prescriptionDate = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // --- Handlers ---
  const createItem = (med: MedicationEntry): PrescriptionItem => ({
    id: crypto.randomUUID(),
    name: med.name,
    presentation: med.presentation,
    dose: med.defaultDose,
    route: med.defaultRoute,
    posology: med.defaultPosology,
    schedule: med.defaultSchedule,
    instructions: med.instructions || "",
    category: med.category,
    flags: [],
    highAlert: med.highAlert || false,
    status: 'active',
  });

  const addItem = (med: MedicationEntry) => {
    setItems((prev) => [...prev, createItem(med)]);
  };

  const addNonStandard = () => {
    if (!nonStdName.trim()) return;
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      name: nonStdName.trim(),
      presentation: '-', dose: '-', route: '-',
      posology: '-', schedule: '-', instructions: '',
      category: 'nonstandard', flags: [], highAlert: false, status: 'active',
    }]);
    setNonStdName("");
  };

  const updateItem = useCallback((id: string, field: keyof PrescriptionItem, value: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  const toggleFlag = useCallback((id: string, flag: PrescriptionFlag) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const flags = item.flags.includes(flag)
        ? item.flags.filter(f => f !== flag)
        : [...item.flags, flag];
      return { ...item, flags };
    }));
  }, []);

  // Individual duplicate
  const duplicateItem = useCallback((id: string) => {
    setItems(prev => {
      const source = prev.find(i => i.id === id);
      if (!source) return prev;
      const idx = prev.findIndex(i => i.id === id);
      const clone: PrescriptionItem = { ...source, id: crypto.randomUUID(), status: 'active', suspensionReason: undefined, suspendedAt: undefined };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    toast.success("Item duplicado");
  }, []);

  // Suspend with reason (individual)
  const requestSuspendItem = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setSuspendTarget({ id, name: item.name });
    setSuspendDialogOpen(true);
  }, [items]);

  const confirmSuspend = useCallback((reason: string) => {
    const now = format(new Date(), "dd/MM HH:mm", { locale: ptBR });
    if (suspendTarget.isBatch) {
      setItems(prev => prev.map(item =>
        selectedIds.has(item.id) && item.status === 'active'
          ? { ...item, status: 'suspended' as const, suspensionReason: reason, suspendedAt: now }
          : item
      ));
      toast.success(`${selectedIds.size} item(ns) suspenso(s)`);
      setSelectedIds(new Set());
    } else if (suspendTarget.id) {
      setItems(prev => prev.map(item =>
        item.id === suspendTarget.id
          ? { ...item, status: 'suspended' as const, suspensionReason: reason, suspendedAt: now }
          : item
      ));
      toast.success("Item suspenso");
    }
    setSuspendDialogOpen(false);
    setSuspendTarget({});
  }, [suspendTarget, selectedIds]);

  // Reactivate
  const reactivateItem = useCallback((id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'active' as const, suspensionReason: undefined, suspendedAt: undefined } : item
    ));
    toast.success("Item reativado");
  }, []);

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const selectAllInCategory = useCallback((cat: PrescriptionCategory) => {
    const catIds = items.filter(i => i.category === cat).map(i => i.id);
    setSelectedIds(prev => {
      const n = new Set(prev);
      catIds.forEach(id => n.add(id));
      return n;
    });
  }, [items]);

  const deselectAllInCategory = useCallback((cat: PrescriptionCategory) => {
    const catIds = new Set(items.filter(i => i.category === cat).map(i => i.id));
    setSelectedIds(prev => {
      const n = new Set(prev);
      catIds.forEach(id => n.delete(id));
      return n;
    });
  }, [items]);

  // Batch actions (suspend now opens dialog)
  const suspendSelected = useCallback(() => {
    setSuspendTarget({ isBatch: true });
    setSuspendDialogOpen(true);
  }, []);

  const deleteSelected = useCallback(() => {
    setItems(prev => prev.filter(item => !selectedIds.has(item.id)));
    toast.success(`${selectedIds.size} item(ns) excluído(s)`);
    setSelectedIds(new Set());
  }, [selectedIds]);

  const duplicateSelected = useCallback(() => {
    setItems(prev => {
      const duplicates = prev
        .filter(item => selectedIds.has(item.id))
        .map(item => ({ ...item, id: crypto.randomUUID(), status: 'active' as const, suspensionReason: undefined, suspendedAt: undefined }));
      return [...prev, ...duplicates];
    });
    toast.success(`${selectedIds.size} item(ns) duplicado(s)`);
    setSelectedIds(new Set());
  }, [selectedIds]);

  // Drag & drop
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems(prev => {
      const oldIndex = prev.findIndex(i => i.id === active.id);
      const newIndex = prev.findIndex(i => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const itemsByCategory = useMemo(() => {
    const map: Record<PrescriptionCategory, PrescriptionItem[]> = {
      nutrition: [], hydration: [], medication: [], antimicrobial: [],
      high_alert: [], inhalation: [], hemotherapy: [], care: [], nonstandard: [],
    };
    items.forEach(item => { map[item.category].push(item); });
    return map;
  }, [items]);

  const totalItems = items.length;
  const activeItemsCount = items.filter(i => i.status === 'active').length;
  const suspendedItemsCount = items.filter(i => i.status === 'suspended').length;

  const handleSave = () => {
    if (!patient.name.trim()) { toast.error("Preencha o nome do paciente"); return; }
    toast.success("Prescrição salva com sucesso", { description: `${totalItems} itens registrados.` });
  };

  const handlePrint = () => window.print();

  // Renewal with dialog
  const handleRenew = () => {
    if (items.length === 0) { toast.error("Nenhum item para renovar"); return; }
    setRenewDialogOpen(true);
  };

  const confirmRenewal = useCallback((includeSuspended: boolean) => {
    const sourceItems = includeSuspended ? items : items.filter(i => i.status === 'active');
    const renewedItems: PrescriptionItem[] = sourceItems.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      status: 'active',
      suspensionReason: undefined,
      suspendedAt: undefined,
    }));
    setItems(renewedItems);
    const tomorrow = format(addDays(new Date(), 1), "dd/MM/yyyy", { locale: ptBR });
    toast.success(`Prescrição renovada para ${tomorrow}`, {
      description: `${renewedItems.length} itens renovados${includeSuspended ? ' (incluindo suspensos reativados)' : ''}.`,
    });
    setRenewDialogOpen(false);
    setSelectedIds(new Set());
  }, [items]);

  const updatePatient = (field: keyof PatientHeader, value: string) => {
    setPatient((prev) => ({ ...prev, [field]: value }));
  };

  const isSimpleCategory = (cat: PrescriptionCategory) => ['nutrition', 'care'].includes(cat);

  // Selection helpers for current tab
  const currentCatItems = itemsByCategory[activeTab];
  const selectedInCurrentTab = currentCatItems.filter(i => selectedIds.has(i.id)).length;
  const allSelectedInTab = currentCatItems.length > 0 && selectedInCurrentTab === currentCatItems.length;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5 print:p-2 print:space-y-1 print:max-w-none print:text-black">
      {/* ===== PRINT-ONLY LETTERHEAD ===== */}
      <div className="hidden print:block prescription-print-section mb-1">
        <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-1">
          <img src={socorraoLogo} alt="Socorrão I" className="h-8 object-contain" />
          <div className="text-center flex-1 px-2">
            <p className="text-[10px] font-bold uppercase tracking-wide leading-tight text-black">Hospital Municipal Djalma Marques — Socorrão I</p>
            <p className="text-[8px] text-gray-500 leading-tight">Prescrição Médica Diária</p>
          </div>
          <img src={bighelpLogo} alt="BigHelp Map" className="h-7 object-contain" />
        </div>
        <table className="w-full border-collapse border border-black/30 text-[9px] text-black">
          <tbody>
            <tr>
              <td className="border border-black/20 px-1 py-[2px]" colSpan={3}><span className="font-bold">Paciente:</span> {patient.name || '___________________________________'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Leito:</span> {patient.bed || '______'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Prontuário:</span> {patient.record || '________'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Data:</span> {prescriptionDate}</td>
            </tr>
            <tr>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Idade:</span> {patient.age || '____'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Sexo:</span> {patient.sex || '____'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Peso:</span> {patient.weight ? `${patient.weight}kg` : '____'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Admissão:</span> {patient.admissionDate || '__/__/____'}</td>
              <td className="border border-black/20 px-1 py-[2px]" colSpan={2}><span className="font-bold text-red-600">Alergias:</span> <span className="text-red-600 font-semibold">{patient.allergies || 'NDAM'}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Page Title */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
            <Pill className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Prescrição Médica</h1>
            <p className="text-xs text-muted-foreground">Prescrição médica diária digital — {totalItems} itens</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRenew} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Renovar
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Salvar
          </Button>
        </div>
      </div>

      {/* ===== PATIENT HEADER ===== */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificação do Paciente</h2>
          <span className="text-xs text-muted-foreground font-mono">{prescriptionDate}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground">Paciente</Label>
            <Input value={patient.name} onChange={(e) => updatePatient("name", e.target.value)} placeholder="Nome completo" className="mt-0.5 h-8 text-sm font-medium" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Nascimento</Label>
            <Input type="date" value={patient.birthDate} onChange={(e) => updatePatient("birthDate", e.target.value)} className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Idade</Label>
            <Input value={patient.age} onChange={(e) => updatePatient("age", e.target.value)} placeholder="Ex: 71 anos" className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Sexo</Label>
            <Select value={patient.sex} onValueChange={(v) => updatePatient("sex", v)}>
              <SelectTrigger className="mt-0.5 h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Feminino">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Leito</Label>
            <Input value={patient.bed} onChange={(e) => updatePatient("bed", e.target.value)} placeholder="Ex: L11" className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Prontuário</Label>
            <Input value={patient.record} onChange={(e) => updatePatient("record", e.target.value)} placeholder="Nº prontuário" className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Admissão</Label>
            <Input type="date" value={patient.admissionDate} onChange={(e) => updatePatient("admissionDate", e.target.value)} className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Unidade</Label>
            <Input value={patient.unit} onChange={(e) => updatePatient("unit", e.target.value)} placeholder="Ex: UTI 2" className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Peso (kg)</Label>
            <Input value={patient.weight} onChange={(e) => updatePatient("weight", e.target.value)} placeholder="Ex: 72" className="mt-0.5 h-8 text-xs" />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-destructive" /> Alergias
            </Label>
            <Input
              value={patient.allergies}
              onChange={(e) => updatePatient("allergies", e.target.value)}
              placeholder="Informe alergias medicamentosas"
              className="mt-0.5 h-8 text-xs border-destructive/20 focus:border-destructive/50"
            />
          </div>
        </div>
      </div>

      {/* ===== PRESCRIPTION TABS ===== */}
      <div className="rounded-xl border border-border bg-card print:hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PrescriptionCategory)} className="w-full">
          <div className="border-b border-border px-2 pt-2">
            <TabsList className="h-auto flex-wrap gap-1 bg-transparent justify-start p-0 pb-2">
              {TAB_ORDER.map(cat => {
                const config = CATEGORY_CONFIG[cat];
                const IconComp = CATEGORY_ICONS[config.icon] || Pill;
                const count = itemsByCategory[cat].length;
                return (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className={cn(
                      "gap-1.5 text-xs px-3 py-1.5 rounded-lg data-[state=active]:shadow-sm transition-all",
                      "data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border"
                    )}
                  >
                    <IconComp className={cn("h-3.5 w-3.5", config.color)} />
                    <span className="hidden sm:inline">{config.label}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1 min-w-[16px]">{count}</Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {TAB_ORDER.map(cat => {
            const config = CATEGORY_CONFIG[cat];
            const catItems = itemsByCategory[cat];
            const source = ALL_ITEMS_BY_CATEGORY[cat];
            const simple = isSimpleCategory(cat);

            return (
              <TabsContent key={cat} value={cat} className="p-4 space-y-3 mt-0">
                {/* Section header */}
                <div className="flex items-center gap-2.5">
                  <div className={cn("p-1.5 rounded-md", config.bgColor, config.color)}>
                    {(() => { const I = CATEGORY_ICONS[config.icon] || Pill; return <I className="h-4 w-4" />; })()}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{config.label}</h3>
                  {catItems.length > 0 && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{catItems.length}</Badge>}
                </div>

                {/* Batch action bar */}
                {cat === activeTab && (
                  <BatchActionBar
                    selectedCount={selectedInCurrentTab}
                    allSelected={allSelectedInTab}
                    onSelectAll={() => selectAllInCategory(cat)}
                    onDeselectAll={() => deselectAllInCategory(cat)}
                    onSuspendSelected={suspendSelected}
                    onDeleteSelected={deleteSelected}
                    onDuplicateSelected={duplicateSelected}
                  />
                )}

                {/* Items list with drag & drop */}
                {catItems.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={catItems.map(i => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1.5">
                        {catItems.map((item, i) => (
                          <SortablePrescriptionItemRow
                            key={item.id}
                            item={item}
                            index={i}
                            onUpdate={updateItem}
                            onRemove={removeItem}
                            onToggleFlag={toggleFlag}
                            isSimple={simple}
                            selected={selectedIds.has(item.id)}
                            onToggleSelect={toggleSelect}
                            onDuplicate={duplicateItem}
                            onRequestSuspend={requestSuspendItem}
                            onReactivate={reactivateItem}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

                {/* Add item */}
                {cat === 'nonstandard' ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nonStdName}
                      onChange={(e) => setNonStdName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addNonStandard(); }}
                      placeholder="Nome do item não padronizado..."
                      className="bg-muted/30 border-border/50"
                    />
                    <Button variant="outline" size="sm" onClick={addNonStandard} disabled={!nonStdName.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <MedicationAutocomplete
                    source={source}
                    onSelect={addItem}
                    placeholder={`Buscar ${config.label.toLowerCase()}...`}
                  />
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* ===== PRINT-ONLY PRESCRIPTION BODY ===== */}
      <div className="hidden print:block prescription-print-section">
        <table className="w-full border-collapse text-black">
          <thead>
            <tr>
              <th className="border border-black/30 px-1 py-[2px] text-left text-[8px] font-bold uppercase tracking-wider bg-gray-100" style={{ width: '75%' }}>
                Prescrição
              </th>
              {['','','','','',''].map((_, i) => (
                <th key={i} className="border border-black/30 px-0 py-[2px] text-center text-[7px] font-bold bg-gray-100 uppercase" style={{ width: '4.16%' }}>
                  {i === 0 ? 'Apraz.' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TAB_ORDER.map(cat => {
              const catItems = itemsByCategory[cat].filter(i => i.status === 'active');
              if (catItems.length === 0) return null;
              const config = CATEGORY_CONFIG[cat];
              const simple = isSimpleCategory(cat);
              return (
                <React.Fragment key={cat}>
                  <tr><td colSpan={7} className="border border-black/30 px-1 py-[1px] text-[8px] font-bold uppercase tracking-wider bg-gray-50">{config.label}</td></tr>
                  {catItems.map((item, i) => (
                    simple
                      ? <PrintSimpleRow key={item.id} item={item} index={i} />
                      : <PrintItemRow key={item.id} item={item} index={i} />
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Print footer */}
        <div className="pt-4 mt-2 border-t border-black/20 flex items-end justify-between" style={{ pageBreakInside: 'avoid' }}>
          <div className="text-[7px] text-gray-500">
            <p>Gerado em: {prescriptionDate}</p>
            <p>BigHelp Map — Prescrição Digital</p>
          </div>
          <div className="text-center">
            <div className="w-44 border-b border-black mb-1" />
            <p className="text-[8px] text-black font-medium">Assinatura / Carimbo do Médico</p>
            <p className="text-[7px] text-gray-500">CRM: _______________</p>
          </div>
        </div>
      </div>

      {/* ===== FOOTER SUMMARY ===== */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant="outline" className="gap-1 text-xs">
            <Pill className="h-3 w-3" /> {totalItems} itens
          </Badge>
          {suspendedItemsCount > 0 && (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <Pause className="h-3 w-3" /> {suspendedItemsCount} suspenso{suspendedItemsCount > 1 ? 's' : ''}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {TAB_ORDER.map(cat => {
              const count = itemsByCategory[cat].length;
              if (count === 0) return null;
              return `${count} ${CATEGORY_CONFIG[cat].label.toLowerCase()}`;
            }).filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRenew} className="gap-1.5 text-xs">
            <RefreshCw className="h-3 w-3" /> Renovar
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5 text-xs">
            <Save className="h-3 w-3" /> Salvar
          </Button>
        </div>
      </div>

      {/* ===== DIALOGS ===== */}
      <SuspensionDialog
        open={suspendDialogOpen}
        onClose={() => { setSuspendDialogOpen(false); setSuspendTarget({}); }}
        onConfirm={confirmSuspend}
        itemName={suspendTarget.name}
        isBatch={suspendTarget.isBatch}
        batchCount={selectedIds.size}
      />
      <RenewalDialog
        open={renewDialogOpen}
        onClose={() => setRenewDialogOpen(false)}
        onConfirm={confirmRenewal}
        activeCount={activeItemsCount}
        suspendedCount={suspendedItemsCount}
      />
    </div>
  );
};

export default PrescricaoPage;
