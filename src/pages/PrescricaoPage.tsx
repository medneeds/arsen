import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { format, addDays } from "date-fns";
import bighelpLogo from "@/assets/bighelp-map-logo.png";
import socorraoLogo from "@/assets/socorrao1-logo.png";
import { BigHelpLogo } from "@/components/BigHelpLogo";
import { ptBR } from "date-fns/locale";
import {
  Pill, Plus, Trash2, Copy, Printer, Save, RefreshCw,
  Search, AlertTriangle, UtensilsCrossed, Droplets, Syringe, History,
  ClipboardList, X, Check, Shield, Wind, TestTube, FileText,
  GripVertical, CheckSquare, Square, Pause, MoreHorizontal,
  Play, CopyPlus, Lock, Eye, EyeOff, ShieldCheck, Fingerprint,
  Zap, Loader2,
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
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
  CARE_OPTIONS,
  CARE_PROFILES,
  type CareProfile,
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
  // Detailed prescription fields
  quantity?: string;          // Quantidade
  action?: string;            // Fazer/Retirar
  diluent?: string;           // Diluente (SF0,9%, SG5%, AD, etc.)
  diluentVolume?: string;     // Volume do diluente (mL)
  accessType?: string;        // Acesso (Periférico, Central, etc.)
  infusionTime?: string;      // Correr em (min)
  infusionMode?: 'BIC' | 'gts'; // mL/h vs gts/min
  volumeTotal?: string;       // Volume total (mL)
  concentration?: string;     // Concentração calculada ou manual
}

// Calculate infusion rate
function calcInfusionRate(volumeStr: string, timeStr: string, mode: 'BIC' | 'gts'): string {
  const volume = parseFloat(volumeStr);
  const time = parseFloat(timeStr);
  if (!volume || !time || time <= 0) return '';
  if (mode === 'BIC') {
    const mlPerHour = (volume / time) * 60;
    return `${mlPerHour.toFixed(1)} mL/h`;
  } else {
    const gtsPerMin = (volume * 20) / (time); // 1mL = 20 gts (equipo padrão)
    return `${gtsPerMin.toFixed(1)} gts/min`;
  }
}

function isIVRoute(route: string): boolean {
  return ['Intravenosa'].includes(route);
}

function posologyToIntervals(posology: string): number {
  const map: Record<string, number> = {
    '1x/dia': 1, '2x/dia': 2, '3x/dia': 3, '4x/dia': 4,
    '6/6h': 4, '8/8h': 3, '12/12h': 2, '24/24h': 1,
    '4/4h': 6, '2/2h': 12, 'Contínuo': 1, 'Dose única': 1,
  };
  return map[posology] || 1;
}

// --- Common schedule presets ---
const SCHEDULE_PRESETS: Record<string, { label: string; options: { name: string; times: string }[] }> = {
  '24/24h': {
    label: '24/24h (1x)',
    options: [
      { name: '06h', times: '06h' },
      { name: '08h', times: '08h' },
      { name: '10h', times: '10h' },
      { name: '14h', times: '14h' },
      { name: '22h', times: '22h' },
    ],
  },
  '12/12h': {
    label: '12/12h (2x)',
    options: [
      { name: '06h–18h', times: '06h, 18h' },
      { name: '08h–20h', times: '08h, 20h' },
      { name: '10h–22h', times: '10h, 22h' },
      { name: '00h–12h', times: '00h, 12h' },
    ],
  },
  '8/8h': {
    label: '8/8h (3x)',
    options: [
      { name: '06h–14h–22h', times: '06h, 14h, 22h' },
      { name: '08h–16h–00h', times: '08h, 16h, 00h' },
      { name: '00h–08h–16h', times: '00h, 08h, 16h' },
      { name: '02h–10h–18h', times: '02h, 10h, 18h' },
    ],
  },
  '6/6h': {
    label: '6/6h (4x)',
    options: [
      { name: '06h–12h–18h–00h', times: '06h, 12h, 18h, 00h' },
      { name: '08h–14h–20h–02h', times: '08h, 14h, 20h, 02h' },
      { name: '00h–06h–12h–18h', times: '00h, 06h, 12h, 18h' },
      { name: '02h–08h–14h–20h', times: '02h, 08h, 14h, 20h' },
    ],
  },
  '4/4h': {
    label: '4/4h (6x)',
    options: [
      { name: '06h–10h–14h–18h–22h–02h', times: '06h, 10h, 14h, 18h, 22h, 02h' },
      { name: '00h–04h–08h–12h–16h–20h', times: '00h, 04h, 08h, 12h, 16h, 20h' },
      { name: '02h–06h–10h–14h–18h–22h', times: '02h, 06h, 10h, 14h, 18h, 22h' },
    ],
  },
  '3/3h': {
    label: '3/3h (8x)',
    options: [
      { name: '00–03–06–09–12–15–18–21', times: '00h, 03h, 06h, 09h, 12h, 15h, 18h, 21h' },
      { name: '01–04–07–10–13–16–19–22', times: '01h, 04h, 07h, 10h, 13h, 16h, 19h, 22h' },
    ],
  },
  '2/2h': {
    label: '2/2h (12x)',
    options: [
      { name: 'Padrão pares', times: '00h, 02h, 04h, 06h, 08h, 10h, 12h, 14h, 16h, 18h, 20h, 22h' },
      { name: 'Padrão ímpares', times: '01h, 03h, 05h, 07h, 09h, 11h, 13h, 15h, 17h, 19h, 21h, 23h' },
    ],
  },
};

function getPresetsForPosology(posology: string): typeof SCHEDULE_PRESETS[string] | null {
  return SCHEDULE_PRESETS[posology] || null;
}

// Build synced preparation description from structured fields
function buildPrepDescription(item: PrescriptionItem): string {
  const parts: string[] = [];
  if (item.dose && item.dose !== '-') parts.push(item.dose);
  if (item.diluent) {
    let dilPart = `Diluir em ${item.diluent}`;
    if (item.diluentVolume) dilPart += ` ${item.diluentVolume}mL`;
    parts.push(dilPart + '.');
  }
  if (item.accessType) parts.push(`Acesso ${item.accessType.toLowerCase()}.`);
  if (item.infusionTime && item.volumeTotal) {
    const rate = calcInfusionRate(item.volumeTotal, item.infusionTime, item.infusionMode || 'BIC');
    const timeH = parseFloat(item.infusionTime) >= 60
      ? `${(parseFloat(item.infusionTime) / 60).toFixed(1)}h`
      : `${item.infusionTime}min`;
    parts.push(`Correr em ${timeH} (${rate}).`);
  } else if (item.infusionTime) {
    const timeH = parseFloat(item.infusionTime) >= 60
      ? `${(parseFloat(item.infusionTime) / 60).toFixed(1)}h`
      : `${item.infusionTime}min`;
    parts.push(`Correr em ${timeH}.`);
  }
  if (item.concentration) parts.push(`Concentração: ${item.concentration}.`);
  if (item.flags.includes('bi' as PrescriptionFlag)) parts.push('Uso em bomba de infusão.');
  return parts.join(' ');
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
  Wind, TestTube, ClipboardList, FileText, Syringe, Zap,
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
          className="pl-9 bg-background/60 border-border/50 h-7 text-xs focus:border-primary/50 transition-colors"
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
           <Badge variant="destructive" className="text-[9px] px-1.5">Suspenso</Badge>
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
        {/* Schedule - far right aligned */}
        <div className="shrink-0 flex items-center gap-1.5 pl-2 border-l border-border/30">
          <Input value={item.schedule} onChange={(e) => onUpdate(item.id, "schedule", e.target.value)} className="h-6 text-[11px] bg-muted/10 border-border/30 w-44 font-mono text-center" placeholder="06h, 12h, 18h, 00h" />
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
        {/* Left: drag + checkbox */}
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

        {/* Center: main content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Name row with flags */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-sm font-semibold text-foreground", item.status === 'suspended' && "line-through")}>
              {item.highAlert && <AlertTriangle className="inline h-3 w-3 mr-1 text-red-500" />}
              {item.name}
              {item.presentation && item.presentation !== '-' && (
                <span className="font-normal text-muted-foreground ml-1">({item.presentation})</span>
              )}
            </p>
            {item.status === 'suspended' && (
              <Badge variant="destructive" className="text-[9px] px-1.5">Suspenso</Badge>
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
              {/* Row 1: Dose + Via + Intervalo + Aprazamento (far right) */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  <Input value={item.dose} onChange={(e) => onUpdate(item.id, "dose", e.target.value)} className="h-7 text-xs bg-muted/20 border-border/30 w-24" placeholder="Dose" />
                  <span className="text-muted-foreground text-[10px]">—</span>
                  <Select value={item.route} onValueChange={(v) => {
                    onUpdate(item.id, "route", v);
                    if (isIVRoute(v) && !item.infusionMode) {
                      onUpdate(item.id, "infusionMode", 'BIC');
                    }
                  }}>
                    <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/30 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROUTES.map((r) => (<SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>))}</SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-[10px]">—</span>
                  <Select value={item.posology} onValueChange={(v) => onUpdate(item.id, "posology", v)}>
                    <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/30 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{POSOLOGIES.map((p) => (<SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                {/* Schedule - far right, with presets */}
                <div className="shrink-0 flex items-center gap-1.5 ml-auto pl-3 border-l border-border/30">
                  <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Apraz:</span>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const presets = getPresetsForPosology(item.posology);
                      if (presets) {
                        return (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 px-1.5 text-[10px] border-border/40 text-muted-foreground hover:text-foreground shrink-0">
                                <ClipboardList className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                {presets.label} — Escolha um esquema
                              </div>
                              <DropdownMenuSeparator />
                              {presets.options.map((opt) => (
                                <DropdownMenuItem
                                  key={opt.name}
                                  onClick={() => onUpdate(item.id, "schedule", opt.times)}
                                  className="text-xs gap-2 font-mono"
                                >
                                  {opt.times}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-[10px] text-muted-foreground italic" onClick={() => {}}>
                                Personalizado: edite o campo →
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      }
                      return null;
                    })()}
                    <Input value={item.schedule} onChange={(e) => onUpdate(item.id, "schedule", e.target.value)} className="h-7 text-xs bg-muted/20 border-border/30 w-52 font-mono text-center" placeholder="06h, 12h, 18h, 00h" />
                  </div>
                </div>
              </div>

              {/* Row 2: Detailed fields - Quantidade, Fazer/Retirar, Diluente, Vol Diluente, Acesso */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Qtd:</span>
                  <Input value={item.quantity || ''} onChange={(e) => onUpdate(item.id, "quantity", e.target.value)} className="h-6 text-[11px] bg-muted/10 border-border/30 w-16 text-center" placeholder="1" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Ação:</span>
                  <Select value={item.action || 'fazer'} onValueChange={(v) => onUpdate(item.id, "action", v)}>
                    <SelectTrigger className="h-6 text-[11px] bg-muted/10 border-border/30 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fazer" className="text-xs">Fazer</SelectItem>
                      <SelectItem value="retirar" className="text-xs">Retirar</SelectItem>
                      <SelectItem value="manter" className="text-xs">Manter</SelectItem>
                      <SelectItem value="suspender" className="text-xs">Suspender</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Diluente:</span>
                  <Select value={item.diluent || ''} onValueChange={(v) => onUpdate(item.id, "diluent", v)}>
                    <SelectTrigger className="h-6 text-[11px] bg-muted/10 border-border/30 w-24"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SF0,9%" className="text-xs">SF 0,9%</SelectItem>
                      <SelectItem value="SG5%" className="text-xs">SG 5%</SelectItem>
                      <SelectItem value="SG10%" className="text-xs">SG 10%</SelectItem>
                      <SelectItem value="RL" className="text-xs">Ringer Lactato</SelectItem>
                      <SelectItem value="AD" className="text-xs">Água Destilada</SelectItem>
                      <SelectItem value="SF0,45%" className="text-xs">SF 0,45%</SelectItem>
                      <SelectItem value="outro" className="text-xs">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Vol:</span>
                  <Input value={item.diluentVolume || ''} onChange={(e) => onUpdate(item.id, "diluentVolume", e.target.value)} className="h-6 text-[11px] bg-muted/10 border-border/30 w-16 text-center" placeholder="mL" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Acesso:</span>
                  <Select value={item.accessType || ''} onValueChange={(v) => onUpdate(item.id, "accessType", v)}>
                    <SelectTrigger className="h-6 text-[11px] bg-muted/10 border-border/30 w-28"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Periférico" className="text-xs">Periférico</SelectItem>
                      <SelectItem value="Central" className="text-xs">Central</SelectItem>
                      <SelectItem value="PICC" className="text-xs">PICC</SelectItem>
                      <SelectItem value="Port-a-cath" className="text-xs">Port-a-cath</SelectItem>
                      <SelectItem value="Jelco" className="text-xs">Jelco</SelectItem>
                      <SelectItem value="Intracath" className="text-xs">Intracath</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Infusion details - Correr em, Gotejamento, Concentração */}
              <div className="flex items-center gap-2 flex-wrap px-2 py-1.5 rounded-md bg-accent/30 border border-border/30">
                <Droplets className="h-3 w-3 text-primary shrink-0" />
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Correr em:</span>
                  <Input
                    value={item.infusionTime || ''}
                    onChange={(e) => onUpdate(item.id, "infusionTime", e.target.value)}
                    className="h-6 text-[11px] bg-background border-border/40 w-16 text-center"
                    placeholder="min"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Vol total:</span>
                  <Input
                    value={item.volumeTotal || ''}
                    onChange={(e) => onUpdate(item.id, "volumeTotal", e.target.value)}
                    className="h-6 text-[11px] bg-background border-border/40 w-16 text-center"
                    placeholder="mL"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Gotej:</span>
                  <Select value={item.infusionMode || 'BIC'} onValueChange={(v) => onUpdate(item.id, "infusionMode", v)}>
                    <SelectTrigger className="h-6 text-[11px] bg-background border-border/40 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BIC" className="text-xs">BIC (mL/h)</SelectItem>
                      <SelectItem value="gts" className="text-xs">gts/min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Auto-calculated rate */}
                {item.volumeTotal && item.infusionTime && (
                  <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 border-primary/30 text-primary">
                    = {calcInfusionRate(item.volumeTotal, item.infusionTime, item.infusionMode || 'BIC')}
                  </Badge>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Conc:</span>
                  <Input
                    value={item.concentration || ''}
                    onChange={(e) => onUpdate(item.id, "concentration", e.target.value)}
                    className="h-6 text-[11px] bg-background border-border/40 w-24 text-center"
                    placeholder="mg/mL"
                  />
                </div>
                {item.volumeTotal && item.posology && item.posology !== 'Contínuo' && item.posology !== 'Dose única' && (
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {posologyToIntervals(item.posology)}x/dia · {(parseFloat(item.volumeTotal || '0') * posologyToIntervals(item.posology)).toFixed(0)}mL/24h
                  </span>
                )}
                {item.posology === 'Contínuo' && item.volumeTotal && (
                  <span className="text-[10px] text-muted-foreground ml-auto">infusão contínua 24h</span>
                )}
              </div>

              {/* Auto-synced preparation description */}
              {(() => {
                const autoDesc = buildPrepDescription(item);
                return autoDesc ? (
                  <p className="text-[11px] text-muted-foreground italic px-2.5 py-1 rounded bg-muted/20 border border-border/20 leading-relaxed">
                    {autoDesc}
                  </p>
                ) : null;
              })()}
              {/* Additional manual notes */}
              <Input
                value={item.instructions}
                onChange={(e) => onUpdate(item.id, "instructions", e.target.value)}
                className="h-7 text-[11px] bg-muted/10 border-border/20 text-muted-foreground italic pl-2.5 focus:text-foreground focus:not-italic"
                placeholder="Observações adicionais..."
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

// --- Parse schedule string into time slots ---
function parseScheduleSlots(schedule: string): string[] {
  if (!schedule || schedule === '-') return [];
  return schedule
    .split(/[,;/\s]+/)
    .map(s => s.trim().replace(/[hH]$/, 'h'))
    .filter(s => /^\d{1,2}h?$/.test(s) || /^\d{1,2}:\d{2}$/.test(s));
}

// --- Print-only Item Row ---
function PrintItemRow({ item, index }: { item: PrescriptionItem; index: number }) {
  const hasPreparo = item.diluent || item.diluentVolume || item.accessType || item.infusionTime;
  const slots = parseScheduleSlots(item.schedule);
  
  return (
    <tr style={{ pageBreakInside: 'avoid' }}>
      {/* Nº */}
      <td style={{ width: '24px', border: '0.5px solid #94a3b8', padding: '2px 0', textAlign: 'center', verticalAlign: 'top', fontSize: '8pt', fontWeight: 800, color: '#0f172a' }}>
        {index + 1}
      </td>
      {/* Prescrição */}
      <td style={{ border: '0.5px solid #94a3b8', padding: '3px 6px', verticalAlign: 'top' }}>
        <div style={{ fontSize: '8.5pt', lineHeight: '1.35', color: '#0f172a' }}>
          <span style={{ fontWeight: 700 }}>{item.name}</span>
          {item.presentation && item.presentation !== '-' && (
            <span style={{ fontWeight: 400, color: '#475569' }}> ({item.presentation})</span>
          )}
          {item.dose && item.dose !== '-' && <span> — {item.dose}</span>}
          {item.route && item.route !== '-' && <span> — {item.route}</span>}
          {item.posology && item.posology !== '-' && <span> — {item.posology}</span>}
          {item.flags.length > 0 && (
            <span style={{ fontSize: '7.5pt', fontWeight: 700, marginLeft: '3px', color: '#0f172a' }}>[{item.flags.join(', ')}]</span>
          )}
          {item.status === 'suspended' && (
            <span style={{ fontSize: '7.5pt', fontWeight: 700, color: '#dc2626', marginLeft: '3px' }}>[SUSPENSO]</span>
          )}
        </div>
        {hasPreparo && (
          <div style={{ fontSize: '7pt', color: '#64748b', fontStyle: 'italic', lineHeight: '1.2', marginTop: '1px', paddingLeft: '8px' }}>
            ↳ {[
              item.action && item.action !== '-' ? item.action : null,
              item.diluent && item.diluent !== '-' ? `${item.diluent}${item.diluentVolume ? ` ${item.diluentVolume}mL` : ''}` : null,
              item.accessType && item.accessType !== '-' ? item.accessType : null,
              item.infusionTime && item.infusionTime !== '-' ? `Correr em ${item.infusionTime}min` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        )}
        {item.instructions && !hasPreparo && (
          <div style={{ fontSize: '7pt', color: '#64748b', fontStyle: 'italic', lineHeight: '1.2', marginTop: '1px', paddingLeft: '8px' }}>
            ↳ {item.instructions}
          </div>
        )}
      </td>
      {/* Aprazamento — up to 6 time slots */}
      {[0,1,2,3,4,5].map(i => (
        <td key={i} style={{ 
          width: '38px', 
          border: '0.5px solid #94a3b8', 
          textAlign: 'center', 
          verticalAlign: 'middle',
          fontSize: '7.5pt',
          fontWeight: 600,
          fontFamily: 'monospace',
          color: '#1e293b',
          padding: '2px 1px'
        }}>
          {slots[i] || ''}
        </td>
      ))}
      {/* Checagem enfermagem */}
      <td style={{ width: '28px', border: '0.5px solid #94a3b8', textAlign: 'center', verticalAlign: 'middle' }}>
        <div style={{ width: '10px', height: '10px', border: '1px solid #94a3b8', borderRadius: '2px', margin: '0 auto' }} />
      </td>
    </tr>
  );
}

function PrintSimpleRow({ item, index }: { item: PrescriptionItem; index: number }) {
  return (
    <tr style={{ pageBreakInside: 'avoid' }}>
      <td style={{ width: '24px', border: '0.5px solid #94a3b8', padding: '2px 0', textAlign: 'center', verticalAlign: 'top', fontSize: '8pt', fontWeight: 800, color: '#0f172a' }}>
        {index + 1}
      </td>
      <td colSpan={7} style={{ border: '0.5px solid #94a3b8', padding: '2px 6px', verticalAlign: 'top' }}>
        <div style={{ fontSize: '8.5pt', lineHeight: '1.35', color: '#0f172a' }}>
          {item.name}
          {item.dose && item.dose !== '-' ? ` — ${item.dose}` : ''}
          {item.posology && item.posology !== '-' ? ` — ${item.posology}` : ''}
        </div>
      </td>
      <td style={{ width: '28px', border: '0.5px solid #94a3b8', textAlign: 'center', verticalAlign: 'middle' }}>
        <div style={{ width: '10px', height: '10px', border: '1px solid #94a3b8', borderRadius: '2px', margin: '0 auto' }} />
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
    const sig: DigitalSignature = { doctorName: doctorName.trim(), crm: crm.trim(), signedAt: now, hash };
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

// --- Drug Interaction Check Dialog ---
function DrugInteractionDialog({
  open,
  onClose,
  items,
  patientContext,
}: {
  open: boolean;
  onClose: () => void;
  items: PrescriptionItem[];
  patientContext?: { age?: string; sex?: string; weight?: string; allergies?: string };
}) {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const medications = useMemo(() =>
    items
      .filter(i => i.status === 'active' && !['nutrition', 'care'].includes(i.category))
      .map(i => ({ name: i.name, dose: i.dose, route: i.route, posology: i.posology })),
    [items]
  );

  const runCheck = useCallback(async () => {
    if (medications.length < 2) {
      setError("São necessários pelo menos 2 medicamentos ativos para verificar interações.");
      return;
    }
    setLoading(true);
    setResult("");
    setError("");

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-interactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ medications, patientContext }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("Resposta vazia");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              accumulated += content;
              setResult(accumulated);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro ao verificar interações");
    } finally {
      setLoading(false);
    }
  }, [medications, patientContext]);

  useEffect(() => {
    if (open && !result && !loading && !error) {
      runCheck();
    }
  }, [open]);

  const handleClose = () => {
    setResult("");
    setError("");
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Verificação de Interações Medicamentosas
          </DialogTitle>
          <DialogDescription>
            Análise inteligente de {medications.length} medicamento{medications.length !== 1 ? 's' : ''} ativo{medications.length !== 1 ? 's' : ''} na prescrição.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && !result && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analisando interações medicamentosas...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="prose prose-sm dark:prose-invert max-w-none px-1">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          {result && (
            <Button variant="outline" size="sm" onClick={runCheck} disabled={loading} className="mr-auto gap-1.5 text-xs">
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Reanalisar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleClose} className="text-xs">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Demo prescription items for fictitious patients
function getDemoPrescriptionItems(bedNumber: string): PrescriptionItem[] {
  const demoData: Record<string, PrescriptionItem[]> = {
    "L09": [
      { id: crypto.randomUUID(), name: "Dieta branda", presentation: "-", dose: "-", route: "-", posology: "-", schedule: "-", instructions: "", category: "nutrition", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "SF 0,9% 1000ml", presentation: "Solução 0,9%", dose: "1000ml", route: "EV", posology: "8/8h", schedule: "08-16-00h", instructions: "Manter acesso venoso pérvio", category: "hydration", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Dipirona", presentation: "500mg/ml — Ampola 2ml", dose: "1g EV", route: "EV", posology: "6/6h", schedule: "06-12-18-00h", instructions: "Diluir em 100ml SF 0,9%, infundir em 15 min", category: "medication", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Tramadol", presentation: "50mg/ml — Ampola 2ml", dose: "100mg EV", route: "EV", posology: "8/8h", schedule: "08-16-00h", instructions: "Diluir em 100ml SF 0,9%, infundir em 30 min", category: "medication", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Ceftriaxona", presentation: "1g — Frasco-ampola", dose: "2g EV", route: "EV", posology: "12/12h", schedule: "08-20h", instructions: "Reconstituir em 10ml AD, diluir em 100ml SF 0,9%, infundir em 30 min", category: "antimicrobial", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Enoxaparina", presentation: "40mg/0,4ml — Seringa", dose: "40mg SC", route: "SC", posology: "1x/dia", schedule: "22h", instructions: "Aplicar no tecido subcutâneo abdominal", category: "medication", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Omeprazol", presentation: "40mg — Frasco-ampola", dose: "40mg EV", route: "EV", posology: "1x/dia", schedule: "06h", instructions: "Reconstituir em 10ml AD, infundir em bolus lento", category: "medication", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Controle de sinais vitais", presentation: "-", dose: "-", route: "-", posology: "4/4h", schedule: "-", instructions: "", category: "care", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Cabeceira elevada a 30°", presentation: "-", dose: "-", route: "-", posology: "-", schedule: "-", instructions: "", category: "care", flags: [], highAlert: false, status: "active" },
    ],
    "L10": [
      { id: crypto.randomUUID(), name: "Dieta enteral hipercalórica", presentation: "-", dose: "60ml/h", route: "SNE", posology: "Contínua", schedule: "-", instructions: "Via sonda nasoenteral", category: "nutrition", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "SF 0,9% 500ml", presentation: "Solução 0,9%", dose: "500ml", route: "EV", posology: "12/12h", schedule: "08-20h", instructions: "", category: "hydration", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Meropenem", presentation: "1g — Frasco-ampola", dose: "1g EV", route: "EV", posology: "8/8h", schedule: "06-14-22h", instructions: "Infusão estendida em 3h — diluir em 250ml SF 0,9%", category: "antimicrobial", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Vancomicina", presentation: "500mg — Frasco-ampola", dose: "1g EV", route: "EV", posology: "12/12h", schedule: "08-20h", instructions: "Diluir em 250ml SF 0,9%, infundir em 1h. Monitorar vancocinemia vale", category: "antimicrobial", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Midazolam", presentation: "5mg/ml — Ampola 10ml", dose: "5mg/h", route: "EV", posology: "Contínua", schedule: "-", instructions: "BIC: 50mg em 50ml SF 0,9% — 5ml/h", category: "high_alert", flags: ["bi"], highAlert: true, status: "active" },
      { id: crypto.randomUUID(), name: "Fentanil", presentation: "50mcg/ml — Ampola 10ml", dose: "100mcg/h", route: "EV", posology: "Contínua", schedule: "-", instructions: "BIC: 500mcg em 50ml SF 0,9% — 10ml/h", category: "high_alert", flags: ["bi"], highAlert: true, status: "active" },
      { id: crypto.randomUUID(), name: "Noradrenalina", presentation: "2mg/ml — Ampola 4ml", dose: "0.3mcg/kg/min", route: "EV", posology: "Contínua", schedule: "-", instructions: "BIC: 16mg em 234ml SG 5% — titular para PAM >65mmHg", category: "high_alert", flags: ["bi"], highAlert: true, status: "active" },
      { id: crypto.randomUUID(), name: "Gasometria arterial", presentation: "-", dose: "-", route: "-", posology: "4/4h", schedule: "-", instructions: "", category: "care", flags: [], highAlert: false, status: "active" },
    ],
    "L11": [
      { id: crypto.randomUUID(), name: "Dieta zero", presentation: "-", dose: "-", route: "-", posology: "-", schedule: "-", instructions: "Jejum — avaliação cardiológica", category: "nutrition", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "SG 5% 500ml + NaCl 20% 30ml + KCl 19,1% 10ml", presentation: "Solução", dose: "500ml", route: "EV", posology: "12/12h", schedule: "08-20h", instructions: "Infundir em 6h", category: "hydration", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Dobutamina", presentation: "12,5mg/ml — Ampola 20ml", dose: "10mcg/kg/min", route: "EV", posology: "Contínua", schedule: "-", instructions: "BIC: 250mg em 230ml SG 5% — titular conforme débito cardíaco", category: "high_alert", flags: ["bi"], highAlert: true, status: "active" },
      { id: crypto.randomUUID(), name: "Heparina não fracionada", presentation: "5.000UI/ml — Frasco 5ml", dose: "1.000UI/h", route: "EV", posology: "Contínua", schedule: "-", instructions: "BIC: 25.000UI em 250ml SF 0,9% — 10ml/h. Controle TTPa 6/6h", category: "high_alert", flags: ["bi"], highAlert: true, status: "active" },
      { id: crypto.randomUUID(), name: "AAS", presentation: "100mg — Comprimido", dose: "100mg", route: "VO/SNE", posology: "1x/dia", schedule: "12h", instructions: "Macerar se via sonda", category: "medication", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Clopidogrel", presentation: "75mg — Comprimido", dose: "75mg", route: "VO/SNE", posology: "1x/dia", schedule: "12h", instructions: "Macerar se via sonda", category: "medication", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Monitorização hemodinâmica contínua", presentation: "-", dose: "-", route: "-", posology: "-", schedule: "-", instructions: "", category: "care", flags: [], highAlert: false, status: "active" },
    ],
  };

  // For beds L12-L18, generate a basic prescription
  if (!demoData[bedNumber] && bedNumber >= "L12" && bedNumber <= "L18") {
    return [
      { id: crypto.randomUUID(), name: "Dieta branda", presentation: "-", dose: "-", route: "-", posology: "-", schedule: "-", instructions: "", category: "nutrition", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "SF 0,9% 1000ml", presentation: "Solução 0,9%", dose: "1000ml", route: "EV", posology: "8/8h", schedule: "08-16-00h", instructions: "", category: "hydration", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Dipirona", presentation: "500mg/ml — Ampola 2ml", dose: "1g EV", route: "EV", posology: "6/6h", schedule: "06-12-18-00h", instructions: "Diluir em 100ml SF 0,9%", category: "medication", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Omeprazol", presentation: "40mg — Frasco-ampola", dose: "40mg EV", route: "EV", posology: "1x/dia", schedule: "06h", instructions: "", category: "medication", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Enoxaparina", presentation: "40mg/0,4ml — Seringa", dose: "40mg SC", route: "SC", posology: "1x/dia", schedule: "22h", instructions: "", category: "medication", flags: [], highAlert: false, status: "active" },
      { id: crypto.randomUUID(), name: "Controle de sinais vitais 4/4h", presentation: "-", dose: "-", route: "-", posology: "4/4h", schedule: "-", instructions: "", category: "care", flags: [], highAlert: false, status: "active" },
    ];
  }

  return demoData[bedNumber] || [];
}


const PrescricaoPage = () => {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const [searchParams] = useSearchParams();

  // Initialize patient and items directly from URL params to avoid render delay
  const initialPatientName = searchParams.get('patientName') || '';
  const initialPatientBed = searchParams.get('patientBed') || '';
  const initialPatientSector = searchParams.get('patientSector') || '';
  const sectorMapInit: Record<string, string> = { red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2" };

  const [patient, setPatient] = useState<PatientHeader>(() => {
    const demoPatients: Record<string, Omit<PatientHeader, 'bed' | 'unit'>> = {
      'L09': { name: initialPatientName || 'Iglesio Ferreira da Silva', birthDate: '1953-07-14', age: '72 anos', sex: 'Masculino', record: 'PRN-2024-08451', admissionDate: '2026-03-15', weight: '78', allergies: 'Dipirona, Sulfa' },
      'L10': { name: 'Maria das Graças Oliveira', birthDate: '1948-02-22', age: '78 anos', sex: 'Feminino', record: 'PRN-2024-09102', admissionDate: '2026-03-14', weight: '62', allergies: 'NDAM' },
      'L11': { name: 'José Carlos Mendes', birthDate: '1960-11-03', age: '65 anos', sex: 'Masculino', record: 'PRN-2024-07833', admissionDate: '2026-03-16', weight: '85', allergies: 'Penicilina, AAS' },
    };
    const demo = demoPatients[initialPatientBed] || { name: initialPatientName, birthDate: '1970-01-15', age: '56 anos', sex: 'Masculino', record: 'PRN-2024-00000', admissionDate: '2026-03-17', weight: '70', allergies: 'NDAM' };
    return {
      ...demo,
      name: demo.name || initialPatientName,
      bed: initialPatientBed,
      unit: sectorMapInit[initialPatientSector] || initialPatientSector,
    };
  });

  const initialDemoItems = useMemo(() => initialPatientBed ? getDemoPrescriptionItems(initialPatientBed) : [], []);
  const [items, setItems] = useState<PrescriptionItem[]>(initialDemoItems);
  const [activeTab, setActiveTab] = useState<PrescriptionCategory>(initialDemoItems.length > 0 ? 'medication' : 'nutrition');
  const [nonStdName, setNonStdName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [freeRecommendation, setFreeRecommendation] = useState("");
  const [appliedCareProfiles, setAppliedCareProfiles] = useState<Set<string>>(new Set());

  // Phase 3 state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<{ id?: string; isBatch?: boolean; name?: string }>({});
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);

  // Phase 4 state — Digital Signature
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [digitalSignature, setDigitalSignature] = useState<DigitalSignature | null>(null);

  // Phase 5 state — AI Drug Interactions
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);

  // Phase 5 state — Persistence
  const [currentPrescriptionId, setCurrentPrescriptionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedPrescriptions, setSavedPrescriptions] = useState<Array<{ id: string; patient_name: string; status: string; version: number; created_at: string; digital_signature: DigitalSignature | null }>>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [versionHistory, setVersionHistory] = useState<Array<{ id: string; version: number; status: string; created_at: string; digital_signature: DigitalSignature | null }>>([]);
  const [showHistory, setShowHistory] = useState(false);

  const prescriptionDate = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });

  // (Patient header and demo items are now initialized synchronously from URL params above)

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
    infusionMode: 'BIC',
    infusionTime: '',
    volumeTotal: '',
    quantity: '1',
    action: 'fazer',
    diluent: '',
    diluentVolume: '',
    accessType: '',
    concentration: '',
  });

  const addItem = (med: MedicationEntry) => {
    setItems((prev) => [...prev, createItem(med)]);
  };

  const applyCareProfile = (profile: CareProfile) => {
    const existingNames = new Set(items.filter(i => i.category === 'care').map(i => i.name));
    const newItems: PrescriptionItem[] = [];
    // Add structured care items from IDs
    for (const careId of profile.items) {
      const careMed = CARE_OPTIONS.find(c => c.id === careId);
      if (careMed && !existingNames.has(careMed.name)) {
        newItems.push(createItem(careMed));
        existingNames.add(careMed.name);
      }
    }
    // Add extra text-based items
    for (const extraText of profile.extraItems) {
      if (!existingNames.has(extraText)) {
        newItems.push({
          id: crypto.randomUUID(),
          name: extraText,
          presentation: '-', dose: '-', route: '-',
          posology: '-', schedule: '-', instructions: '',
          category: 'care', flags: [], highAlert: false, status: 'active',
        });
        existingNames.add(extraText);
      }
    }
    if (newItems.length > 0) {
      setItems(prev => [...prev, ...newItems]);
      toast.success(`Perfil "${profile.label}" aplicado — ${newItems.length} itens adicionados`);
    } else {
      toast.info(`Todos os itens do perfil "${profile.label}" já estão na prescrição`);
    }
    setAppliedCareProfiles(prev => new Set(prev).add(profile.id));
  };

  const addFreeRecommendation = () => {
    if (!freeRecommendation.trim()) return;
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      name: freeRecommendation.trim(),
      presentation: '-', dose: '-', route: '-',
      posology: '-', schedule: '-', instructions: '',
      category: 'care', flags: [], highAlert: false, status: 'active',
    }]);
    setFreeRecommendation("");
    toast.success("Recomendação adicionada");
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

  // Fetch saved prescriptions
  const fetchPrescriptions = useCallback(async () => {
    if (!currentHospital || !currentState) return;
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('id, patient_name, status, version, created_at, digital_signature')
        .eq('hospital_unit_id', currentHospital.id)
        .eq('state_id', currentState.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setSavedPrescriptions((data || []).map(d => ({
        ...d,
        digital_signature: d.digital_signature as unknown as DigitalSignature | null,
      })));
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
    } finally {
      setLoadingList(false);
    }
  }, [currentHospital, currentState]);

  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

  // Fetch version history for a prescription (by patient_name in same hospital)
  const fetchVersionHistory = useCallback(async (prescriptionId: string) => {
    if (!currentHospital || !currentState) return;
    try {
      const { data: current } = await supabase
        .from('prescriptions')
        .select('patient_name')
        .eq('id', prescriptionId)
        .single();
      if (!current) return;
      const { data } = await supabase
        .from('prescriptions')
        .select('id, version, status, created_at, digital_signature')
        .eq('patient_name', current.patient_name)
        .eq('hospital_unit_id', currentHospital.id)
        .eq('state_id', currentState.id)
        .order('version', { ascending: true });
      setVersionHistory((data || []).map(v => ({
        ...v,
        digital_signature: v.digital_signature as unknown as DigitalSignature | null,
      })));
    } catch (err) {
      console.error('Error fetching version history:', err);
      setVersionHistory([]);
    }
  }, [currentHospital, currentState]);

  // Load a saved prescription
  const loadPrescription = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      if (data) {
        setPatient(data.patient_data as unknown as PatientHeader);
        setItems(data.items as unknown as PrescriptionItem[]);
        setDigitalSignature(data.digital_signature as unknown as DigitalSignature | null);
        setCurrentPrescriptionId(data.id);
        setSelectedIds(new Set());
        toast.success("Prescrição carregada", { description: `v${data.version} — ${data.patient_name}` });
        fetchVersionHistory(id);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar prescrição", { description: err.message });
    }
  }, [fetchVersionHistory]);

  // Save prescription to database
  const handleSave = async () => {
    if (!patient.name.trim()) { toast.error("Preencha o nome do paciente"); return; }
    if (!currentHospital || !currentState) { toast.error("Hospital/Estado não selecionado"); return; }
    setSaving(true);
    try {
      const payload = {
        patient_name: patient.name.trim(),
        patient_data: patient as any,
        items: items as any,
        digital_signature: digitalSignature as any,
        status: digitalSignature ? 'signed' : 'draft',
        department: 'URGÊNCIA E EMERGÊNCIA ADULTO',
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        created_by: user?.id || null,
      };

      if (currentPrescriptionId) {
        // Update existing
        const { error } = await supabase
          .from('prescriptions')
          .update(payload)
          .eq('id', currentPrescriptionId);
        if (error) throw error;
        toast.success("Prescrição atualizada", { description: `${totalItems} itens registrados.` });
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('prescriptions')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        if (data) setCurrentPrescriptionId(data.id);
        toast.success("Prescrição salva", { description: `${totalItems} itens registrados.` });
      }
      fetchPrescriptions();
    } catch (err: any) {
      toast.error("Erro ao salvar prescrição", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // New prescription
  const handleNewPrescription = () => {
    setPatient({ name: "", birthDate: "", age: "", sex: "", bed: "", unit: "", record: "", admissionDate: "", weight: "", allergies: "" });
    setItems([]);
    setDigitalSignature(null);
    setCurrentPrescriptionId(null);
    setSelectedIds(new Set());
    toast.info("Nova prescrição iniciada");
  };

  const handlePrint = () => window.print();

  // Sign prescription
  const handleRequestSign = () => {
    if (!canPrescribe) { toast.error("Preencha o peso e as alergias antes de assinar"); return; }
    if (!patient.name.trim()) { toast.error("Preencha o nome do paciente antes de assinar"); return; }
    if (activeItemsCount === 0) { toast.error("Nenhum item ativo para assinar"); return; }
    setSignDialogOpen(true);
  };

  const confirmSign = useCallback((sig: DigitalSignature) => {
    setDigitalSignature(sig);
    setSignDialogOpen(false);
    toast.success("Prescrição assinada digitalmente", {
      description: `Dr(a). ${sig.doctorName} — CRM ${sig.crm} — Hash: ${sig.hash}`,
      duration: 5000,
    });
  }, []);

  // Renewal with dialog
  const handleRenew = () => {
    if (items.length === 0) { toast.error("Nenhum item para renovar"); return; }
    setRenewDialogOpen(true);
  };

  const confirmRenewal = useCallback(async (includeSuspended: boolean) => {
    const sourceItems = includeSuspended ? items : items.filter(i => i.status === 'active');
    const renewedItems: PrescriptionItem[] = sourceItems.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      status: 'active' as const,
      suspensionReason: undefined,
      suspendedAt: undefined,
    }));

    const tomorrow = format(addDays(new Date(), 1), "dd/MM/yyyy", { locale: ptBR });

    if (currentHospital && currentState && patient.name.trim()) {
      setSaving(true);
      try {
        // Save current prescription first if it exists
        if (currentPrescriptionId) {
          await supabase
            .from('prescriptions')
            .update({
              patient_data: patient as any,
              items: items as any,
              digital_signature: digitalSignature as any,
              status: digitalSignature ? 'signed' : 'draft',
            })
            .eq('id', currentPrescriptionId);
        }

        // Get current version number
        let nextVersion = 1;
        if (currentPrescriptionId) {
          const { data: parentData } = await supabase
            .from('prescriptions')
            .select('version')
            .eq('id', currentPrescriptionId)
            .single();
          nextVersion = (parentData?.version || 1) + 1;
        }

        // Create new version (auto-saved)
        const { data: newData, error } = await supabase
          .from('prescriptions')
          .insert({
            patient_name: patient.name.trim(),
            patient_data: patient as any,
            items: renewedItems as any,
            digital_signature: null,
            status: 'draft',
            version: nextVersion,
            parent_id: currentPrescriptionId || undefined,
            department: 'URGÊNCIA E EMERGÊNCIA ADULTO',
            hospital_unit_id: currentHospital.id,
            state_id: currentState.id,
            created_by: user?.id || null,
          })
          .select('id')
          .single();

        if (error) throw error;
        if (newData) {
          setCurrentPrescriptionId(newData.id);
          fetchVersionHistory(newData.id);
        }
        fetchPrescriptions();
        toast.success(`Prescrição renovada e salva para ${tomorrow} (v${nextVersion})`, {
          description: `${renewedItems.length} itens renovados${includeSuspended ? ' (incluindo suspensos reativados)' : ''}.`,
        });
      } catch (err: any) {
        toast.error("Erro ao renovar prescrição", { description: err.message });
      } finally {
        setSaving(false);
      }
    } else {
      toast.success(`Prescrição renovada para ${tomorrow}`, {
        description: `${renewedItems.length} itens renovados${includeSuspended ? ' (incluindo suspensos reativados)' : ''}.`,
      });
    }

    setItems(renewedItems);
    setDigitalSignature(null);
    setRenewDialogOpen(false);
    setSelectedIds(new Set());
  }, [items, currentPrescriptionId, currentHospital, currentState, patient, digitalSignature, user, fetchPrescriptions, fetchVersionHistory]);

  const updatePatient = (field: keyof PatientHeader, value: string) => {
    setPatient((prev) => ({ ...prev, [field]: value }));
  };

  const isSimpleCategory = (cat: PrescriptionCategory) => ['nutrition', 'care'].includes(cat);
  const canPrescribe = patient.weight.trim() !== '' && patient.allergies.trim() !== '';

  // Selection helpers for current tab
  const currentCatItems = itemsByCategory[activeTab];
  const selectedInCurrentTab = currentCatItems.filter(i => selectedIds.has(i.id)).length;
  const allSelectedInTab = currentCatItems.length > 0 && selectedInCurrentTab === currentCatItems.length;

  // Show loading animation while contexts are resolving
  const isReady = !!currentHospital && !!currentState && patient.name !== '';
  
  if (!isReady) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="flex flex-col items-center gap-6">
          <div className="animate-pulse">
            <BigHelpLogo size="md" glow />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">Carregando prescrição...</span>
            </div>
            {patient.name && (
              <p className="text-xs text-muted-foreground/70">
                Paciente: {patient.name} — Leito {patient.bed}
              </p>
            )}
          </div>
          <div className="w-40 h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary/60 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"
              style={{
                animation: 'loading 1.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>
        <style>{`
          @keyframes loading {
            0% { width: 0%; margin-left: 0; }
            50% { width: 60%; margin-left: 20%; }
            100% { width: 0%; margin-left: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5 print:p-0 print:m-0 print:space-y-0 print:max-w-none print:text-black animate-fade-in">
      {/* ===== PRINT STYLES ===== */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 5mm 6mm 8mm 6mm; }
          .prescription-print-section table { border-collapse: collapse; table-layout: fixed; width: 100%; }
        }
      ` }} />

      {/* ===== PRINT-ONLY LETTERHEAD ===== */}
      <div className="hidden print:block prescription-print-section" style={{ marginBottom: '2px' }}>
        {/* Institutional header */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3px' }}>
          <tbody>
            <tr>
              <td style={{ width: '60px', verticalAlign: 'middle', padding: '0 4px 0 0' }}>
                <img src={socorraoLogo} alt="Socorrão I" style={{ height: '28px', objectFit: 'contain' }} />
              </td>
              <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                <div style={{ fontSize: '9pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a', lineHeight: 1 }}>
                  Hospital Municipal Djalma Marques — Socorrão I
                </div>
                <div style={{ fontSize: '7pt', color: '#64748b', marginTop: '1px' }}>
                  PRESCRIÇÃO MÉDICA DIÁRIA
                </div>
              </td>
              <td style={{ width: '50px', verticalAlign: 'middle', textAlign: 'right', padding: '0 0 0 4px' }}>
                <img src={bighelpLogo} alt="BigHelp Map" style={{ height: '22px', objectFit: 'contain', opacity: 0.25 }} />
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ borderTop: '2px solid #0f172a', borderBottom: '0.5px solid #94a3b8' }} />

        {/* Patient identification table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', color: '#0f172a', marginTop: '2px' }}>
          <tbody>
            <tr>
              <td style={{ border: '0.5px solid #94a3b8', padding: '2px 5px', width: '50%' }}>
                <span style={{ fontWeight: 700 }}>PACIENTE:</span> {patient.name || '___________________________________'}
              </td>
              <td style={{ border: '0.5px solid #94a3b8', padding: '2px 5px', width: '12%' }}>
                <span style={{ fontWeight: 700 }}>LEITO:</span> {patient.bed || '______'}
              </td>
              <td style={{ border: '0.5px solid #94a3b8', padding: '2px 5px', width: '18%' }}>
                <span style={{ fontWeight: 700 }}>PRONTUÁRIO:</span> {patient.record || '________'}
              </td>
              <td style={{ border: '0.5px solid #94a3b8', padding: '2px 5px', width: '20%' }}>
                <span style={{ fontWeight: 700 }}>DATA:</span> {prescriptionDate}
              </td>
            </tr>
            <tr>
              <td style={{ border: '0.5px solid #94a3b8', padding: '2px 5px' }} colSpan={2}>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>ALERGIAS:</span>{' '}
                <span style={{ color: '#dc2626', fontWeight: 700 }}>{patient.allergies || 'NDAM'}</span>
              </td>
              <td style={{ border: '0.5px solid #94a3b8', padding: '2px 5px' }}>
                <span style={{ fontWeight: 700 }}>PESO:</span> {patient.weight ? `${patient.weight} kg` : '______ kg'}
              </td>
              <td style={{ border: '0.5px solid #94a3b8', padding: '2px 5px' }}>
                <span style={{ fontWeight: 700 }}>IDADE:</span> {patient.age || '____'} | <span style={{ fontWeight: 700 }}>SEXO:</span> {patient.sex || '__'}
              </td>
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
            <p className="text-xs text-muted-foreground">
              Prescrição médica diária digital — {totalItems} itens
              {currentPrescriptionId && <span className="ml-1 text-primary">(salva)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleNewPrescription} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Nova
          </Button>
          <Button variant="outline" size="sm" onClick={handleRenew} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Renovar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const activeMeds = items.filter(i => i.status === 'active' && !['nutrition', 'care'].includes(i.category));
              if (activeMeds.length < 2) {
                toast.error("Mínimo de 2 medicamentos ativos para verificar interações");
                return;
              }
              setInteractionDialogOpen(true);
            }}
            className="gap-1.5 text-amber-600 border-amber-200 hover:border-amber-300 hover:text-amber-700"
          >
            <Zap className="h-3.5 w-3.5" /> Interações
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <span className="animate-spin h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full inline-block" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* ===== SAVED PRESCRIPTIONS ===== */}
      {savedPrescriptions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 print:hidden">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-muted-foreground tracking-wider">Prescrições salvas</h2>
            <Button variant="ghost" size="sm" onClick={fetchPrescriptions} disabled={loadingList} className="h-6 text-[10px] gap-1">
              <RefreshCw className={cn("h-3 w-3", loadingList && "animate-spin")} /> Atualizar
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {savedPrescriptions.map(p => (
              <button
                key={p.id}
                onClick={() => loadPrescription(p.id)}
                className={cn(
                  "shrink-0 text-left p-2 rounded-lg border text-xs transition-colors hover:bg-accent/50",
                  currentPrescriptionId === p.id ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <p className="font-medium truncate max-w-[160px]">{p.patient_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant={p.status === 'signed' ? 'default' : 'outline'} className="text-[9px] h-4 px-1.5">
                    {p.status === 'signed' ? '✓ Assinada' : 'Rascunho'}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground">v{p.version}</span>
                  <span className="text-[9px] text-muted-foreground">{format(new Date(p.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== VERSION HISTORY ===== */}
      {versionHistory.length > 1 && currentPrescriptionId && (
        <div className="rounded-xl border border-border bg-card p-3 print:hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-xs"
          >
            <span className="flex items-center gap-2 font-semibold text-muted-foreground tracking-wider">
              <History className="h-3.5 w-3.5" /> Histórico de versões ({versionHistory.length})
            </span>
            <span className="text-muted-foreground text-[10px]">{showHistory ? 'Ocultar' : 'Expandir'}</span>
          </button>
          {showHistory && (
            <div className="mt-3 space-y-1">
              {versionHistory.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => loadPrescription(v.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg border text-xs transition-colors hover:bg-accent/50 text-left",
                    currentPrescriptionId === v.id ? "border-primary bg-primary/5" : "border-border/50"
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border",
                      currentPrescriptionId === v.id ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground"
                    )}>
                      {v.version}
                    </div>
                    {i < versionHistory.length - 1 && <div className="w-px h-2 bg-border" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Versão {v.version}</span>
                      <Badge variant={v.status === 'signed' ? 'default' : 'outline'} className="text-[9px] h-4 px-1.5">
                        {v.status === 'signed' ? '✓ Assinada' : 'Rascunho'}
                      </Badge>
                      {currentPrescriptionId === v.id && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Atual</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(v.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {v.digital_signature && ` — Assinado por ${v.digital_signature.doctorName}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== PATIENT HEADER ===== */}
      <div className="rounded-xl border border-border bg-card overflow-hidden print:hidden">
        {/* Top bar: patient name + weight/allergies */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border/50 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">{patient.name ? patient.name.charAt(0).toUpperCase() : '?'}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground leading-tight truncate">{patient.name || 'Paciente não identificado'}</h2>
              <p className="text-[10px] text-muted-foreground">Leito {patient.bed || '—'} · {patient.unit || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Peso (kg)</Label>
              <Input
                value={patient.weight}
                onChange={(e) => updatePatient("weight", e.target.value)}
                placeholder="Ex: 72"
                className={cn(
                  "h-7 w-20 text-xs font-medium",
                  !patient.weight.trim() && "border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10"
                )}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5 whitespace-nowrap">
                <AlertTriangle className="h-3 w-3 text-destructive" /> Alergias
              </Label>
              <Input
                value={patient.allergies}
                onChange={(e) => updatePatient("allergies", e.target.value)}
                placeholder="NDAM ou listar"
                className={cn(
                  "h-7 w-40 text-xs font-medium",
                  !patient.allergies.trim()
                    ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10"
                    : "border-destructive/20"
                )}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono bg-background/60 px-2 py-0.5 rounded ml-1">{prescriptionDate}</span>
          </div>
        </div>

        {/* Info grid - read-only fields */}
        <div className="px-4 py-2.5">
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
            {[
              { label: 'Nascimento', value: patient.birthDate ? format(new Date(patient.birthDate + 'T12:00:00'), 'dd/MM/yyyy') : '—' },
              { label: 'Idade', value: patient.age || '—' },
              { label: 'Sexo', value: patient.sex || '—' },
              { label: 'Prontuário', value: patient.record || '—' },
              { label: 'Admissão', value: patient.admissionDate ? format(new Date(patient.admissionDate + 'T12:00:00'), 'dd/MM/yyyy') : '—' },
              { label: 'Unidade', value: patient.unit || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{label}:</span>
                <span className="font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>

          {/* Missing fields warning */}
          {(!patient.weight.trim() || !patient.allergies.trim()) && (
            <div className="flex items-center gap-2 px-3 py-1.5 mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <p className="text-[11px] font-medium">
                Preencha {!patient.weight.trim() && !patient.allergies.trim() ? 'o peso e as alergias' : !patient.weight.trim() ? 'o peso' : 'as alergias'} para habilitar a prescrição.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Search bars are now inline within each category section below */}

      {/* ===== FULL PRESCRIPTION VIEW (all categories) ===== */}
      <div className={cn("space-y-3 print:hidden", !canPrescribe && "opacity-50 pointer-events-none")}>
        {/* Batch action bar */}
        <BatchActionBar
          selectedCount={selectedIds.size}
          allSelected={items.length > 0 && selectedIds.size === items.length}
          onSelectAll={() => setSelectedIds(new Set(items.map(i => i.id)))}
          onDeselectAll={() => setSelectedIds(new Set())}
          onSuspendSelected={suspendSelected}
          onDeleteSelected={deleteSelected}
          onDuplicateSelected={duplicateSelected}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {TAB_ORDER.map(cat => {
              const config = CATEGORY_CONFIG[cat];
              const catItems = itemsByCategory[cat];
              const simple = isSimpleCategory(cat);
              const IconComp = CATEGORY_ICONS[config.icon] || Pill;

              return (
                <div key={cat} className="rounded-xl border border-border bg-card">
                  {/* Category header with inline search */}
                  <div className={cn("flex items-center gap-2 px-3 py-2 border-b border-border/50", config.bgColor)}>
                    <IconComp className={cn("h-3.5 w-3.5 shrink-0", config.color)} />
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">{config.label}</span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">{catItems.length}</Badge>
                    <div className="flex-1 ml-2">
                      {cat === 'nonstandard' ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={activeTab === 'nonstandard' ? nonStdName : ''}
                            onChange={(e) => { setActiveTab('nonstandard'); setNonStdName(e.target.value); }}
                            onKeyDown={(e) => { if (e.key === "Enter") addNonStandard(); }}
                            placeholder="Adicionar item não padronizado..."
                            className="bg-background/60 border-border/50 h-7 text-xs"
                          />
                          <Button variant="outline" size="sm" onClick={addNonStandard} disabled={!nonStdName.trim()} className="h-7 px-2">
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <MedicationAutocomplete
                          source={ALL_ITEMS_BY_CATEGORY[cat]}
                          onSelect={addItem}
                          placeholder={`Buscar ${config.label.toLowerCase()}...`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Care Profiles Panel — only for 'care' category */}
                  {cat === 'care' && (
                    <div className="border-b border-border/50 bg-muted/20 p-3 space-y-3">
                      {/* Profile buttons */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Perfis de Cuidados</p>
                        <div className="flex flex-wrap gap-1.5">
                          {CARE_PROFILES.map(profile => {
                            const ProfileIcon = CATEGORY_ICONS[profile.icon] || ClipboardList;
                            const applied = appliedCareProfiles.has(profile.id);
                            return (
                              <Tooltip key={profile.id}>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={applied ? "default" : "outline"}
                                    size="sm"
                                    className={cn(
                                      "h-7 text-[11px] gap-1.5 transition-all",
                                      applied && "opacity-70"
                                    )}
                                    onClick={() => applyCareProfile(profile)}
                                  >
                                    <ProfileIcon className="h-3 w-3" />
                                    {profile.label}
                                    {applied && <Check className="h-3 w-3" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs max-w-xs">
                                  <p className="font-medium">{profile.label}</p>
                                  <p className="text-muted-foreground">{profile.description}</p>
                                  <p className="text-muted-foreground mt-1">{profile.items.length + profile.extraItems.length} itens</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>

                      {/* Free recommendation input */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Recomendação Avulsa</p>
                        <div className="flex items-start gap-1.5">
                          <Textarea
                            value={freeRecommendation}
                            onChange={(e) => setFreeRecommendation(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                addFreeRecommendation();
                              }
                            }}
                            placeholder="Digitar cuidado ou recomendação personalizada... (Enter para adicionar)"
                            className="min-h-[36px] h-9 bg-background/60 border-border/50 text-xs resize-none flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addFreeRecommendation}
                            disabled={!freeRecommendation.trim()}
                            className="h-9 px-3"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">Adicionar</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Items */}
                  {catItems.length > 0 && (
                    <div className="p-2 space-y-1.5">
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
                  )}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>

        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <Pill className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum item na prescrição</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Use a barra de busca acima para adicionar itens</p>
          </div>
        )}
      </div>

      {/* ===== PRINT-ONLY PRESCRIPTION BODY ===== */}
      <div className="hidden print:block prescription-print-section" style={{ marginTop: '3px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '24px' }} />
            <col />
            <col style={{ width: '38px' }} />
            <col style={{ width: '38px' }} />
            <col style={{ width: '38px' }} />
            <col style={{ width: '38px' }} />
            <col style={{ width: '38px' }} />
            <col style={{ width: '38px' }} />
            <col style={{ width: '28px' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ backgroundColor: '#0f172a', color: '#fff', border: '0.5px solid #0f172a', padding: '3px 2px', fontSize: '6pt', fontWeight: 700, textAlign: 'center' }}>
                Nº
              </th>
              <th style={{ backgroundColor: '#0f172a', color: '#fff', border: '0.5px solid #0f172a', padding: '3px 6px', fontSize: '7pt', fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Prescrição Médica
              </th>
              {['1º','2º','3º','4º','5º','6º'].map((label, i) => (
                <th key={i} style={{ backgroundColor: '#1e293b', color: '#e2e8f0', border: '0.5px solid #334155', padding: '3px 1px', fontSize: '6pt', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase' }}>
                  {label}
                </th>
              ))}
              <th style={{ backgroundColor: '#1e293b', color: '#e2e8f0', border: '0.5px solid #334155', padding: '3px 1px', fontSize: '5pt', fontWeight: 700, textAlign: 'center' }}>
                ✓
              </th>
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
                  <tr>
                    <td colSpan={9} style={{ 
                      padding: '2px 6px', 
                      fontSize: '7pt', 
                      fontWeight: 800, 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.8px',
                      backgroundColor: '#f1f5f9', 
                      borderLeft: '3px solid #334155',
                      border: '0.5px solid #cbd5e1',
                      color: '#1e293b'
                    }}>
                      {config.label}
                    </td>
                  </tr>
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

        {/* Print footer — signature + timestamp */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: '12px', marginTop: '8px', borderTop: '1px solid #e2e8f0', pageBreakInside: 'avoid' }}>
          <div style={{ fontSize: '6pt', color: '#94a3b8', lineHeight: '1.5' }}>
            <div>{prescriptionDate}</div>
            <div>BigHelp Map • Prescrição Digital</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            {digitalSignature ? (
              <div style={{ border: '1.5px solid #0f172a', borderRadius: '4px', padding: '6px 14px', display: 'inline-block' }}>
                <div style={{ fontSize: '8pt', fontWeight: 800, color: '#0f172a' }}>✓ ASSINADO DIGITALMENTE</div>
                <div style={{ fontSize: '7.5pt', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{digitalSignature.doctorName}</div>
                <div style={{ fontSize: '6.5pt', color: '#475569' }}>CRM: {digitalSignature.crm} • {digitalSignature.signedAt}</div>
                <div style={{ fontSize: '5pt', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>Hash: {digitalSignature.hash}</div>
              </div>
            ) : (
              <>
                <div style={{ width: '180px', borderBottom: '1px solid #0f172a', marginBottom: '4px', marginLeft: 'auto', marginRight: 'auto' }} />
                <div style={{ fontSize: '7.5pt', fontWeight: 600, color: '#0f172a' }}>Assinatura / Carimbo do Médico</div>
                <div style={{ fontSize: '6.5pt', color: '#64748b', marginTop: '1px' }}>CRM: _______________</div>
              </>
            )}
          </div>
          <div style={{ fontSize: '6pt', color: '#94a3b8', textAlign: 'right', lineHeight: '1.5' }}>
            <div>Enfermagem: ___________</div>
            <div>Hora: ____:____</div>
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
          {digitalSignature && (
            <Badge variant="outline" className="gap-1 text-[10px] border-green-300 text-green-700 bg-green-50">
              <ShieldCheck className="h-3 w-3" /> Assinado — {digitalSignature.doctorName}
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
          <Button
            variant={digitalSignature ? "outline" : "default"}
            size="sm"
            onClick={handleRequestSign}
            className={cn("gap-1.5 text-xs", digitalSignature && "border-green-300 text-green-700 hover:text-green-800")}
          >
            {digitalSignature ? <><ShieldCheck className="h-3 w-3" /> Reassinar</> : <><Fingerprint className="h-3 w-3" /> Assinar</>}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
            {saving ? <span className="animate-spin h-3 w-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full inline-block" /> : <Save className="h-3 w-3" />}
            {saving ? 'Salvando...' : 'Salvar'}
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
      <SignPrescriptionDialog
        open={signDialogOpen}
        onClose={() => setSignDialogOpen(false)}
        onConfirm={confirmSign}
        totalItems={totalItems}
        activeItems={activeItemsCount}
      />
      <DrugInteractionDialog
        open={interactionDialogOpen}
        onClose={() => setInteractionDialogOpen(false)}
        items={items}
        patientContext={{
          age: patient.age,
          sex: patient.sex,
          weight: patient.weight,
          allergies: patient.allergies,
        }}
      />
    </div>
  );
};

export default PrescricaoPage;
