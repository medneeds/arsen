import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import ReactMarkdown from "react-markdown";
import { format, addDays, isAfter, setHours, setMinutes, setSeconds, startOfDay } from "date-fns";
import bighelpLogo from "@/assets/bighelp-map-logo.png";
import socorraoLogo from "@/assets/socorrao1-logo.png";
import { BigHelpLogo } from "@/components/BigHelpLogo";
import { NormaZeroPrintHeader, NormaZeroPrintFooter, generatePrintDocCode } from "@/components/NormaZeroPrintHeader";
import { ptBR } from "date-fns/locale";
import {
  Pill, Plus, Trash2, Copy, Printer, Save, RefreshCw,
  Search, AlertTriangle, UtensilsCrossed, Droplets, Syringe, History,
  ClipboardList, X, Check, Shield, Wind, TestTube, FileText,
  GripVertical, CheckSquare, Square, Pause, MoreHorizontal,
  Play, CopyPlus, Lock, Eye, EyeOff, ShieldCheck, Fingerprint,
  Zap, Loader2, CalendarDays, Circle, RotateCw, Package, Hash, Heart, List, AlignJustify, ChevronUp,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";
import { ShiftRenewalAlert } from "@/components/ShiftRenewalAlert";
import { PrescriptionDiffDialog } from "@/components/PrescriptionDiffDialog";
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
import { AntimicrobialGuideDialog } from "@/components/AntimicrobialGuideDialog";
import { PsychotropicFormDialog, isPsychotropicMedication } from "@/components/PsychotropicFormDialog";
import { TevProtocolDialog } from "@/components/TevProtocolDialog";
import { fuzzySearch } from "@/lib/fuzzySearch";
import { useMedicationFavorites } from "@/hooks/useMedicationFavorites";
import { useQuickPrescriptionTemplates, type QuickPrescriptionTemplate, type QuickTemplateItem } from "@/hooks/useQuickPrescriptionTemplates";
import { SaveTemplateDialog } from "@/components/SaveTemplateDialog";
import { DoseCalculatorDialog, type DoseCalculatorResult } from "@/components/DoseCalculatorDialog";
import { PreValidationAlertDialog } from "@/components/PreValidationAlertDialog";
import { runClinicalAlertChecks, type ClinicalAlert } from "@/lib/clinicalAlertChecks";
import { Star, Calculator } from "lucide-react";
import { getProtocolsFor, type PosologyProtocol } from "@/lib/posologyProtocols";
import { PosologySuggestionsBar } from "@/components/PosologySuggestionsBar";
import { PatientCockpit } from "@/components/PatientCockpit";
import type { Patient } from "@/types/patient";

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
  validated?: boolean;
  validatedAt?: string;
  isExtra?: boolean;          // Prescrição extra avulsa
  // Detailed prescription fields
  quantity?: string;          // Quantidade
  quantityUnit?: string;      // Unidade da quantidade (mL, ampola, frasco-ampola, comp, gota, mg, etc.)
  action?: string;            // Fazer/Retirar
  diluent?: string;           // Diluente (SF0,9%, SG5%, AD, etc.)
  diluentVolume?: string;     // Volume do diluente (mL)
  accessType?: string;        // Acesso (Periférico, Central, etc.)
  infusionTime?: string;      // Correr em (valor numérico)
  infusionTimeUnit?: 'min' | 'h'; // Unidade do tempo de infusão
  infusionMode?: 'BIC' | 'gts'; // mL/h vs gts/min
  infusionRate?: string;      // Vazão editável (mL/h ou gts/min)
  volumeTotal?: string;       // Volume total (mL)
  concentration?: string;     // Concentração calculada ou manual
}

// Normalize text for accent-insensitive search
function normalizeSearch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Quantity units for prescription items
const QUANTITY_UNITS = [
  'mL', 'ampola', 'frasco-ampola', 'comprimido', 'gota', 'mg', 'g', 'mcg',
  'UI', 'bolsa', 'unidade', 'cápsula', 'sachê', 'envelope', 'adesivo',
  'supositório', 'óvulo', 'bisnaga', 'frasco',
];

// Auto-detect quantity unit from medication presentation
function detectQuantityUnit(presentation: string, dose: string): string {
  const p = presentation.toLowerCase();
  const d = dose.toLowerCase();
  if (p.includes('ampola') && !p.includes('frasco')) return 'ampola';
  if (p.includes('frasco-ampola') || p.includes('frasco ampola')) return 'frasco-ampola';
  if (p.includes('frasco') && !p.includes('ampola')) return 'frasco';
  if (p.includes('comprimido') || p.includes('comp')) return 'comprimido';
  if (p.includes('cápsula')) return 'cápsula';
  if (p.includes('bolsa')) return 'bolsa';
  if (d.includes('gota') || d.includes('gts')) return 'gota';
  if (d.includes('ml') || p.includes('ml')) return 'mL';
  if (d.includes('ui') || p.includes('ui')) return 'UI';
  return '';
}

// Auto-detect default diluent and volume from instructions
function detectDiluentDefaults(instructions: string): { diluent: string; diluentVolume: string; infusionTime: string } {
  const result = { diluent: '', diluentVolume: '', infusionTime: '' };
  if (!instructions) return result;
  const inst = instructions.toLowerCase();
  // Detect diluent
  if (inst.includes('sf0,9%') || inst.includes('sf 0,9%') || inst.includes('soro fisiológico')) result.diluent = 'SF0,9%';
  else if (inst.includes('sg5%') || inst.includes('sg 5%') || inst.includes('soro glicosado')) result.diluent = 'SG5%';
  else if (inst.includes('água destilada') || inst.includes(' ad ')) result.diluent = 'AD';
  else if (inst.includes('ringer')) result.diluent = 'RL';
  // Detect volume
  const volMatch = inst.match(/(?:diluir em|em)\s+(\d+)\s*ml/i);
  if (volMatch) result.diluentVolume = volMatch[1];
  // Detect infusion time
  const timeMatch = inst.match(/(?:infundir em|correr em|infusão em)\s+(\d+)\s*(?:min|minutos)/i);
  if (timeMatch) result.infusionTime = timeMatch[1];
  const timeHMatch = inst.match(/(?:infundir em|correr em)\s+(\d+)\s*h/i);
  if (timeHMatch) result.infusionTime = String(parseInt(timeHMatch[1]) * 60);
  return result;
}

// Rotate schedule: shift the first time to the end
function rotateSchedule(schedule: string): string {
  const parts = schedule.split(/,\s*/).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return schedule;
  const rotated = [...parts.slice(1), parts[0]];
  return rotated.join(', ');
}

// Round gts/min to practical hospital values (multiples of 7: 7, 14, 21, 28, 35, 42...)
function roundGtsToHospital(gts: number): number {
  if (gts <= 0) return 0;
  // For very slow rates, round to nearest integer
  if (gts < 5) return Math.round(gts);
  // Round to nearest 7 (standard equipo macro 20gts/mL patterns)
  return Math.round(gts / 7) * 7 || 7;
}

// Calculate infusion rate — timeStr is raw value, timeUnit is 'min' or 'h'
function calcInfusionRate(volumeStr: string, timeStr: string, mode: 'BIC' | 'gts', timeUnit: 'min' | 'h' = 'min'): string {
  const volume = parseFloat(volumeStr);
  const rawTime = parseFloat(timeStr);
  if (!volume || !rawTime || rawTime <= 0) return '';
  const timeInMin = timeUnit === 'h' ? rawTime * 60 : rawTime;
  if (mode === 'BIC') {
    const mlPerHour = (volume / timeInMin) * 60;
    return `${mlPerHour.toFixed(1)} mL/h`;
  } else {
    const rawGts = (volume * 20) / timeInMin;
    const rounded = roundGtsToHospital(rawGts);
    return `${rounded} gts/min`;
  }
}

// Auto-calculate volume total from quantity (mL) + diluent volume
function calcVolumeTotal(item: PrescriptionItem): string {
  const dilVol = parseFloat(item.diluentVolume?.replace(',', '.') || '');
  // Get the medication volume: use quantity if unit is mL, otherwise try to extract from dose
  let medVol = 0;
  const qtyVal = parseFloat(item.quantity?.replace(',', '.') || '');
  const qtyUnit = (item.quantityUnit || '').toLowerCase();
  if (qtyVal > 0 && qtyUnit === 'ml') {
    medVol = qtyVal;
  } else {
    // Fallback: extract mL from dose string
    const doseVol = parseFloat(item.dose?.replace(/[^\d.,]/g, '').replace(',', '.') || '');
    if (doseVol > 0 && item.dose?.toLowerCase().includes('ml')) {
      medVol = doseVol;
    }
  }
  // With diluent: medication volume + diluent volume
  if (item.diluent && item.diluent !== 'sem_diluente' && dilVol > 0) {
    return String(Math.round(dilVol + medVol));
  }
  // Without diluent: use medication volume directly
  if (medVol > 0) return String(Math.round(medVol));
  return '';
}

// Calc infusion time from rate: time = volume / rate
function calcTimeFromRate(volumeTotal: string, rate: string, mode: 'BIC' | 'gts', timeUnit: 'min' | 'h'): string {
  const vol = parseFloat(volumeTotal);
  const r = parseFloat(rate);
  if (!vol || !r || r <= 0) return '';
  let timeInMin: number;
  if (mode === 'BIC') {
    // rate is mL/h → time in min = (vol / rate) * 60
    timeInMin = (vol / r) * 60;
  } else {
    // rate is gts/min → vol in drops = vol * 20, time = drops / rate
    timeInMin = (vol * 20) / r;
  }
  if (timeUnit === 'h') {
    const hours = timeInMin / 60;
    return hours % 1 === 0 ? String(hours) : hours.toFixed(1);
  }
  return String(Math.round(timeInMin));
}

// Calc rate value (numeric) from volume and time
function calcRateFromTime(volumeTotal: string, infusionTime: string, mode: 'BIC' | 'gts', timeUnit: 'min' | 'h'): string {
  const vol = parseFloat(volumeTotal);
  const rawTime = parseFloat(infusionTime);
  if (!vol || !rawTime || rawTime <= 0) return '';
  const timeInMin = timeUnit === 'h' ? rawTime * 60 : rawTime;
  if (mode === 'BIC') {
    const mlPerHour = (vol / timeInMin) * 60;
    return mlPerHour % 1 === 0 ? String(mlPerHour) : mlPerHour.toFixed(1);
  } else {
    const rawGts = (vol * 20) / timeInMin;
    return String(roundGtsToHospital(rawGts));
  }
}

// Auto-calculate concentration from dose and volume total
function calcConcentration(item: PrescriptionItem): string {
  const doseMatch = item.dose?.match(/([\d.,]+)\s*(mg|g|mcg|UI)/i);
  if (!doseMatch) return '';
  let doseVal = parseFloat(doseMatch[1].replace(',', '.'));
  const doseUnit = doseMatch[2].toLowerCase();
  if (doseUnit === 'g') doseVal *= 1000; // convert to mg
  const volTotal = parseFloat(item.volumeTotal || '');
  if (!doseVal || !volTotal || volTotal <= 0) return '';
  const conc = doseVal / volTotal;
  if (doseUnit === 'ui') return `${conc.toFixed(1)} UI/mL`;
  if (doseUnit === 'mcg') return `${conc.toFixed(1)} mcg/mL`;
  return `${conc.toFixed(2)} mg/mL`;
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
  if (item.quantity && item.quantity !== '1' && item.quantityUnit) {
    parts.push(`${item.quantity} ${item.quantityUnit}.`);
  } else if (item.quantityUnit) {
    parts.push(`1 ${item.quantityUnit}.`);
  }
  if (item.dose && item.dose !== '-') parts.push(item.dose);
  if (item.diluent && item.diluent !== 'sem_diluente') {
    let dilPart = `Diluir em ${item.diluent}`;
    if (item.diluentVolume) dilPart += ` ${item.diluentVolume}mL`;
    parts.push(dilPart + '.');
  } else if (item.diluent === 'sem_diluente') {
    parts.push('Sem diluição.');
  }
  if (item.accessType) parts.push(`Acesso ${item.accessType.toLowerCase()}.`);
  if (item.volumeTotal) parts.push(`Volume total: ${item.volumeTotal}mL.`);
  if (item.infusionTime || item.infusionRate) {
    const unit = item.infusionTimeUnit || 'min';
    const modeLabel = item.infusionMode === 'gts' ? 'gts/min' : 'mL/h';
    if (item.infusionTime && item.infusionRate) {
      const timeLabel = `${item.infusionTime}${unit === 'h' ? 'h' : 'min'}`;
      parts.push(`Correr em ${timeLabel} — ${item.infusionRate} ${modeLabel}.`);
    } else if (item.infusionTime) {
      const timeLabel = `${item.infusionTime}${unit === 'h' ? 'h' : 'min'}`;
      parts.push(`Correr em ${timeLabel}.`);
    } else if (item.infusionRate) {
      parts.push(`Vazão: ${item.infusionRate} ${modeLabel}.`);
    }
  }
  if (item.concentration) parts.push(`Concentração: ${item.concentration}.`);
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
  utiAdmissionDate: string;
  weight: string;
  allergies: string;
  motherName: string;
  address: string;
  city: string;
  encounterCode?: string;
  chiefComplaint?: string;
  vitalSigns?: string;
  riskClassification?: string;
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
  getFavoriteCount,
}: {
  source: MedicationEntry[];
  onSelect: (med: MedicationEntry) => void;
  placeholder: string;
  getFavoriteCount?: (id: string) => number;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const favCount = getFavoriteCount ?? (() => 0);

  const filtered = useMemo(() => {
    return fuzzySearch(query, source, favCount, 10);
  }, [query, source, favCount]);

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
          {filtered.map((med) => {
            const fav = favCount(med.id);
            return (
              <button
                key={med.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(med)}
                className="w-full px-3 py-2.5 text-left hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 border-b border-border/30 last:border-0"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground block truncate">
                    {fav > 0 && <Star className="inline h-3 w-3 mr-1 fill-amber-400 text-amber-400" />}
                    {med.name}
                    {med.highAlert && <AlertTriangle className="inline h-3 w-3 ml-1 text-red-500" />}
                  </span>
                  <span className="text-xs text-muted-foreground block truncate">{med.presentation}</span>
                </div>
                {med.defaultRoute !== '-' && (
                  <Badge variant="outline" className="text-[10px] shrink-0">{med.defaultRoute}</Badge>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Global Prescription Search with Category Filters ---
export interface GlobalPrescriptionSearchHandle {
  focus: () => void;
}
const GlobalPrescriptionSearch = React.forwardRef<GlobalPrescriptionSearchHandle, {
  onAddItem: (med: MedicationEntry) => void;
  onAddNonStandard: (name: string) => void;
  getFavoriteCount?: (id: string) => number;
}>(function GlobalPrescriptionSearch({
  onAddItem,
  onAddNonStandard,
  getFavoriteCount,
}, ref) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedCat, setSelectedCat] = useState<PrescriptionCategory | 'all' | 'favorites'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }), []);
  const [freeText, setFreeText] = useState("");
  const favCount = getFavoriteCount ?? (() => 0);

  const allItems = useMemo(() => Object.values(ALL_ITEMS_BY_CATEGORY).flat(), []);

  const filtered = useMemo(() => {
    let source: MedicationEntry[];
    if (selectedCat === 'favorites') {
      source = allItems.filter(m => favCount(m.id) > 0);
    } else if (selectedCat === 'all') {
      source = allItems;
    } else {
      source = ALL_ITEMS_BY_CATEGORY[selectedCat] || [];
    }
    return fuzzySearch(query, source, favCount, 15);
  }, [query, selectedCat, allItems, favCount]);

  const favTotal = useMemo(() => allItems.filter(m => favCount(m.id) > 0).length, [allItems, favCount]);

  const handleSelect = (med: MedicationEntry) => {
    onAddItem(med);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className="space-y-2">
      {/* Category filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setSelectedCat('all')}
          className={cn(
            "text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all",
            selectedCat === 'all'
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60"
          )}
        >
          Todos
        </button>
        {favTotal > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCat('favorites')}
            className={cn(
              "text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all flex items-center gap-1",
              selectedCat === 'favorites'
                ? "bg-amber-400/20 text-amber-700 border-amber-400 dark:text-amber-300"
                : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60"
            )}
          >
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            Favoritos ({favTotal})
          </button>
        )}
        {TAB_ORDER.map(cat => {
          const config = CATEGORY_CONFIG[cat];
          const Icon = CATEGORY_ICONS[config.icon] || Pill;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCat(cat)}
              className={cn(
                "text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all flex items-center gap-1",
                selectedCat === cat
                  ? cn("border-current", config.color, config.bgColor)
                  : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60"
              )}
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder={
              selectedCat === 'all' ? "Buscar em todas as categorias (tolera erros de digitação)..."
              : selectedCat === 'favorites' ? "Buscar nos seus favoritos..."
              : `Buscar em ${CATEGORY_CONFIG[selectedCat]?.label.toLowerCase()}...`
            }
            className="pl-9 bg-background/60 border-border/50 h-9 text-sm focus:border-primary/50 transition-colors"
          />
        </div>
        {focused && filtered.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-72 overflow-y-auto">
            {filtered.map((med) => {
              const catConfig = CATEGORY_CONFIG[med.category];
              const fav = favCount(med.id);
              return (
                <button
                  key={med.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(med)}
                  className="w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 border-b border-border/30 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground block truncate">
                      {fav > 0 && <Star className="inline h-3 w-3 mr-1 fill-amber-400 text-amber-400" />}
                      {med.name}
                      {med.highAlert && <AlertTriangle className="inline h-3 w-3 ml-1 text-destructive" />}
                    </span>
                    <span className="text-xs text-muted-foreground block truncate">{med.presentation}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {fav > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 border-amber-400/50 text-amber-700 dark:text-amber-300">
                        {fav}×
                      </Badge>
                    )}
                    {(selectedCat === 'all' || selectedCat === 'favorites') && catConfig && (
                      <Badge variant="outline" className={cn("text-[9px] px-1.5", catConfig.color)}>{catConfig.label}</Badge>
                    )}
                    {med.defaultRoute !== '-' && (
                      <Badge variant="outline" className="text-[9px]">{med.defaultRoute}</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Free text for nonstandard */}
      {selectedCat === 'nonstandard' && (
        <div className="flex items-center gap-1.5">
          <Input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && freeText.trim()) { onAddNonStandard(freeText.trim()); setFreeText(''); } }}
            placeholder="Ou adicionar item não padronizado..."
            className="bg-background/60 border-border/50 h-8 text-xs flex-1"
          />
          <Button variant="outline" size="sm" onClick={() => { if (freeText.trim()) { onAddNonStandard(freeText.trim()); setFreeText(''); } }} disabled={!freeText.trim()} className="h-8 px-2">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
});


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
  isCompact,
  selected,
  onToggleSelect,
  onDuplicate,
  onRequestSuspend,
  onReactivate,
  onToggleValidation,
  isPastRenewalTime,
  prescriptionLocked,
}: {
  item: PrescriptionItem;
  index: number;
  onUpdate: (id: string, field: keyof PrescriptionItem, value: string) => void;
  onRemove: (id: string) => void;
  onToggleFlag: (id: string, flag: PrescriptionFlag) => void;
  isSimple?: boolean;
  isCompact?: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRequestSuspend: (id: string) => void;
  onReactivate: (id: string) => void;
  onToggleValidation: (id: string) => void;
  isPastRenewalTime: boolean;
  prescriptionLocked: boolean;
}) {
  const [individualExpanded, setIndividualExpanded] = useState(false);
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

  const ValidationDot = () => {
    // Considera validado se: marcado E (ainda não passou da renovação OU foi validado após o corte de 05:00 de hoje)
    const renewalCutoff = setSeconds(setMinutes(setHours(startOfDay(new Date()), 5), 0), 0);
    const validatedAfterCutoff = !!(item.validatedAt && new Date(item.validatedAt) > renewalCutoff);
    const isValidated = !!item.validated && (!isPastRenewalTime || validatedAfterCutoff);

    // Regras: prescrição ainda não validada como um todo → desabilita clique individual
    // (validação só pode ocorrer em bloco). Item já validado → não pode ser desvalidado.
    // Item novo (pendente) em prescrição já validada → pode validar individualmente (com senha).
    const canClick = !isValidated && prescriptionLocked;
    const tooltipMsg = isValidated
      ? "Validado — para retirar, suspenda o item"
      : prescriptionLocked
      ? "Pendente — clique para validar com senha"
      : "Use 'Validar prescrição' para validar todos os itens";

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => canClick && onToggleValidation(item.id)}
            disabled={!canClick}
            className={cn(
              "shrink-0 transition-transform",
              canClick ? "hover:scale-125 cursor-pointer" : "cursor-not-allowed",
              isValidated && "cursor-default"
            )}
          >
            <Circle className={cn(
              "h-3 w-3 fill-current",
              isValidated ? "text-emerald-500" : "text-amber-500"
            )} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipMsg}
        </TooltipContent>
      </Tooltip>
    );
  };

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
        <ValidationDot />
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
        {item.isExtra && (
          <Badge variant="outline" className="text-[9px] px-1.5 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">EXTRA</Badge>
        )}
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
          {(() => {
            const presets = getPresetsForPosology(item.posology);
            if (presets) {
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] border-border/40 text-muted-foreground hover:text-foreground shrink-0">
                      <ClipboardList className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground tracking-wider">
                      {presets.label}
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
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }
            return null;
          })()}
          <Input value={item.schedule} onChange={(e) => onUpdate(item.id, "schedule", e.target.value)} className="h-6 text-[11px] bg-muted/10 border-border/30 w-44 font-mono text-center" placeholder="06h, 12h, 18h, 00h" />
          {item.schedule && item.schedule.includes(',') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0 border-border/40 text-muted-foreground hover:text-primary shrink-0"
                  onClick={() => onUpdate(item.id, "schedule", rotateSchedule(item.schedule))}
                >
                  <RotateCw className="h-2.5 w-2.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Rotacionar aprazamento</TooltipContent>
            </Tooltip>
          )}
        </div>
        <ItemActions />
      </div>
    );
  }

  // === COMPACT VIEW (with individual expand) ===
  if (isCompact && !isSimple && !individualExpanded) {
    const compactParts: string[] = [];
    if (item.dose && item.dose !== '-') compactParts.push(item.dose);
    if (item.diluent && item.diluent !== 'sem_diluente') {
      let dil = `diluir em ${item.diluent}`;
      if (item.diluentVolume) dil += ` ${item.diluentVolume}mL`;
      compactParts.push(dil);
    }
    if (item.volumeTotal) compactParts.push(`vol ${item.volumeTotal}mL`);
    if (item.infusionTime) {
      const tUnit = item.infusionTimeUnit === 'h' ? 'h' : 'min';
      let inf = `correr em ${item.infusionTime}${tUnit}`;
      if (item.infusionRate) {
        const rLabel = item.infusionMode === 'gts' ? 'gts/min' : 'mL/h';
        inf += ` (${item.infusionRate} ${rLabel})`;
      }
      compactParts.push(inf);
    } else if (item.infusionRate) {
      const rLabel = item.infusionMode === 'gts' ? 'gts/min' : 'mL/h';
      compactParts.push(`${item.infusionRate} ${rLabel}`);
    }
    // Route + posology inline
    const routePosology: string[] = [];
    if (item.route && item.route !== '-') routePosology.push(item.route);
    if (item.posology && item.posology !== '-') routePosology.push(item.posology);

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border group transition-all cursor-pointer",
          item.status === 'suspended'
            ? "border-destructive/30 bg-destructive/5 opacity-60"
            : "border-border/40 bg-card/50 hover:border-primary/20",
          item.highAlert && item.status !== 'suspended' && "border-red-300/40",
          selected && "ring-2 ring-primary/40 border-primary/30",
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button, input, [role="checkbox"], [data-radix-collection-item]')) return;
          setIndividualExpanded(true);
        }}
      >
        <ValidationDot />
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(item.id)}
          className="shrink-0"
        />
        <span className="text-[10px] font-mono text-muted-foreground w-5 text-right shrink-0">{index + 1}.</span>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className={cn("text-xs font-semibold text-foreground shrink-0", item.status === 'suspended' && "line-through")}>
            {item.highAlert && <AlertTriangle className="inline h-2.5 w-2.5 mr-0.5 text-red-500" />}
            {item.name}
            {item.presentation && item.presentation !== '-' && (
              <span className="font-normal text-muted-foreground"> ({item.presentation})</span>
            )}
          </span>
          {compactParts.length > 0 && (
            <span className="text-[10px] text-muted-foreground truncate">
              · {compactParts.join(' · ')}
            </span>
          )}
          {routePosology.length > 0 && (
            <span className="text-[10px] font-medium text-foreground/70 shrink-0">
              · {routePosology.join(' · ')}
            </span>
          )}
          {item.isExtra && (
            <Badge variant="outline" className="text-[8px] px-1 shrink-0 bg-muted/50 text-muted-foreground border-border/50">EXTRA</Badge>
          )}
          {item.flags.length > 0 && item.flags.map(fk => {
            const f = PRESCRIPTION_FLAGS.find(pf => pf.key === fk);
            return f ? <Badge key={fk} variant="outline" className="text-[8px] px-1 shrink-0 text-muted-foreground border-border/50">{f.label}</Badge> : null;
          })}
        </div>
        {/* Schedule compact — far right */}
        <div className="shrink-0 flex items-center gap-1 pl-2 border-l border-border/30">
          {item.schedule && (
            <span className="text-[10px] font-mono text-primary/80">{item.schedule}</span>
          )}
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
        isDragging && "shadow-lg",
        isCompact && individualExpanded && "cursor-pointer"
      )}
      onClick={(e) => {
        // Only handle collapse click when individually expanded in compact mode
        if (!isCompact || !individualExpanded) return;
        if ((e.target as HTMLElement).closest('button, input, select, textarea, [role="checkbox"], [role="combobox"], [data-radix-collection-item], [data-radix-select-trigger]')) return;
        setIndividualExpanded(false);
      }}
    >
      <div className="flex items-start gap-2 p-2.5">
        {/* Left: validation dot + drag + checkbox */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 pt-1">
          <ValidationDot />
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
            {isCompact && individualExpanded && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIndividualExpanded(false); }}
                className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Compactar"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            )}
            <p className={cn("text-sm font-semibold text-foreground", item.status === 'suspended' && "line-through")}>
              {item.highAlert && <AlertTriangle className="inline h-3 w-3 mr-1 text-red-500" />}
              {item.name}
              {item.presentation && item.presentation !== '-' && (
                <span className="font-normal text-muted-foreground ml-1">({item.presentation})</span>
              )}
            </p>
            {item.isExtra && (
              <Badge variant="outline" className="text-[9px] px-1.5 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">EXTRA</Badge>
            )}
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
                              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground tracking-wider">
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
                    <Input value={item.schedule} onChange={(e) => onUpdate(item.id, "schedule", e.target.value)} className="h-7 text-xs bg-muted/20 border-border/30 w-48 font-mono text-center" placeholder="06h, 12h, 18h, 00h" />
                    {item.schedule && item.schedule.includes(',') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 border-border/40 text-muted-foreground hover:text-primary shrink-0"
                            onClick={() => onUpdate(item.id, "schedule", rotateSchedule(item.schedule))}
                          >
                            <RotateCw className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Rotacionar aprazamento</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Quantidade, Diluente, Vol Diluente, Acesso */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Qtd:</span>
                  <Input value={item.quantity || ''} onChange={(e) => onUpdate(item.id, "quantity", e.target.value)} className="h-6 text-[11px] bg-muted/10 border-border/30 w-12 text-center" placeholder="1" />
                  <Select value={item.quantityUnit || ''} onValueChange={(v) => onUpdate(item.id, "quantityUnit", v)}>
                    <SelectTrigger className="h-6 text-[11px] bg-muted/10 border-border/30 w-[110px]"><SelectValue placeholder="unidade" /></SelectTrigger>
                    <SelectContent>
                      {QUANTITY_UNITS.map(u => (
                        <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Diluente:</span>
                  <Select value={item.diluent || ''} onValueChange={(v) => {
                    onUpdate(item.id, "diluent", v);
                    const tempItem = { ...item, diluent: v };
                    const autoVol = calcVolumeTotal(tempItem);
                    if (autoVol) {
                      onUpdate(item.id, "volumeTotal", autoVol);
                      const autoConc = calcConcentration({ ...tempItem, volumeTotal: autoVol });
                      if (autoConc) onUpdate(item.id, "concentration", autoConc);
                    }
                    if (v === 'sem_diluente') {
                      onUpdate(item.id, "diluentVolume", '');
                    }
                  }}>
                    <SelectTrigger className="h-6 text-[11px] bg-muted/10 border-border/30 w-28"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem_diluente" className="text-xs font-medium">Sem diluente</SelectItem>
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
                {item.diluent && item.diluent !== 'sem_diluente' && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Vol dil:</span>
                  <Input value={item.diluentVolume || ''} onChange={(e) => {
                    onUpdate(item.id, "diluentVolume", e.target.value);
                    // Auto-recalculate volume total
                    const tempItem = { ...item, diluentVolume: e.target.value };
                    const autoVol = calcVolumeTotal(tempItem);
                    if (autoVol) onUpdate(item.id, "volumeTotal", autoVol);
                    // Auto-recalculate concentration
                    const tempItem2 = { ...tempItem, volumeTotal: autoVol || item.volumeTotal || '' };
                    const autoConc = calcConcentration(tempItem2);
                    if (autoConc) onUpdate(item.id, "concentration", autoConc);
                  }} className="h-6 text-[11px] bg-muted/10 border-border/30 w-16 text-center" placeholder="mL" />
                </div>
                )}
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

              {/* Row 3: Infusion — Vol total → Correr em (com unidade) → Gotejamento + Rate | Concentração */}
              <div className="flex items-center gap-2 flex-wrap px-2 py-1.5 rounded-md bg-accent/30 border border-border/30">
                <Droplets className="h-3 w-3 text-primary shrink-0" />
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Vol total:</span>
                  <Input
                    value={item.volumeTotal || ''}
                    onChange={(e) => {
                      const newVol = e.target.value;
                      onUpdate(item.id, "volumeTotal", newVol);
                      // Auto-recalculate concentration
                      const tempItem = { ...item, volumeTotal: newVol };
                      const autoConc = calcConcentration(tempItem);
                      if (autoConc) onUpdate(item.id, "concentration", autoConc);
                      // Auto-recalculate rate from time when volume changes
                      if (newVol && item.infusionTime) {
                        const autoRate = calcRateFromTime(newVol, item.infusionTime, item.infusionMode || 'BIC', item.infusionTimeUnit || 'min');
                        if (autoRate) onUpdate(item.id, "infusionRate", autoRate);
                      }
                    }}
                    className="h-6 text-[11px] bg-background border-border/40 w-16 text-center font-medium"
                    placeholder="mL"
                  />
                  <span className="text-[10px] text-muted-foreground">mL</span>
                </div>
                <span className="text-muted-foreground/40">│</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Correr em:</span>
                  <Input
                    value={item.infusionTime || ''}
                    onChange={(e) => {
                      const newTime = e.target.value;
                      onUpdate(item.id, "infusionTime", newTime);
                      // Auto-calc rate from time
                      if (item.volumeTotal && newTime) {
                        const autoRate = calcRateFromTime(item.volumeTotal, newTime, item.infusionMode || 'BIC', item.infusionTimeUnit || 'min');
                        if (autoRate) onUpdate(item.id, "infusionRate", autoRate);
                      }
                    }}
                    className="h-6 text-[11px] bg-background border-border/40 w-14 text-center"
                    placeholder="—"
                  />
                  <Select value={item.infusionTimeUnit || 'min'} onValueChange={(v) => {
                    onUpdate(item.id, "infusionTimeUnit", v);
                    if (item.volumeTotal && item.infusionTime) {
                      const autoRate = calcRateFromTime(item.volumeTotal, item.infusionTime, item.infusionMode || 'BIC', v as 'min' | 'h');
                      if (autoRate) onUpdate(item.id, "infusionRate", autoRate);
                    }
                  }}>
                    <SelectTrigger className="h-6 text-[11px] bg-background border-border/40 w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="min" className="text-xs">min</SelectItem>
                      <SelectItem value="h" className="text-xs">horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-muted-foreground/40">⇄</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Vazão:</span>
                  <Input
                    value={item.infusionRate || ''}
                    onChange={(e) => {
                      const newRate = e.target.value;
                      onUpdate(item.id, "infusionRate", newRate);
                      // Auto-calc time from rate (bidirectional)
                      if (item.volumeTotal && newRate) {
                        const autoTime = calcTimeFromRate(item.volumeTotal, newRate, item.infusionMode || 'BIC', item.infusionTimeUnit || 'min');
                        if (autoTime) onUpdate(item.id, "infusionTime", autoTime);
                      }
                    }}
                    className="h-6 text-[11px] bg-background border-border/40 w-16 text-center font-medium"
                    placeholder="—"
                  />
                  <Select value={item.infusionMode || 'BIC'} onValueChange={(v) => {
                    onUpdate(item.id, "infusionMode", v);
                    // Recalc rate with new mode
                    if (item.volumeTotal && item.infusionTime) {
                      const autoRate = calcRateFromTime(item.volumeTotal, item.infusionTime, v as 'BIC' | 'gts', item.infusionTimeUnit || 'min');
                      if (autoRate) onUpdate(item.id, "infusionRate", autoRate);
                    }
                  }}>
                    <SelectTrigger className="h-6 text-[11px] bg-background border-border/40 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BIC" className="text-xs">BIC (mL/h)</SelectItem>
                      <SelectItem value="gts" className="text-xs">gts/min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-muted-foreground/40">│</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Conc:</span>
                  <Input
                    value={item.concentration || ''}
                    onChange={(e) => onUpdate(item.id, "concentration", e.target.value)}
                    className="h-6 text-[11px] bg-background border-border/40 w-24 text-center"
                    placeholder="auto"
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

// --- Extra Prescription Dialog ---
function ExtraPrescriptionDialog({
  open,
  onClose,
  onAddItems,
  allMedications,
}: {
  open: boolean;
  onClose: () => void;
  onAddItems: (items: PrescriptionItem[]) => void;
  allMedications: MedicationEntry[];
}) {
  const [extraItems, setExtraItems] = useState<PrescriptionItem[]>([]);
  const [freeText, setFreeText] = useState("");

  const handleClose = () => {
    setExtraItems([]);
    setFreeText("");
    onClose();
  };

  const addFromAutocomplete = (med: MedicationEntry) => {
    const autoUnit = detectQuantityUnit(med.presentation, med.defaultDose);
    const autoDefaults = detectDiluentDefaults(med.instructions || '');
    const isIV = isIVRoute(med.defaultRoute);
    const item: PrescriptionItem = {
      id: crypto.randomUUID(),
      name: med.name,
      presentation: med.presentation,
      dose: med.defaultDose,
      route: med.defaultRoute,
      posology: med.defaultPosology,
      schedule: med.defaultSchedule,
      instructions: med.instructions || "",
      category: med.category,
      flags: ['ag' as PrescriptionFlag], // Default to "Agora"
      highAlert: med.highAlert || false,
      status: 'active',
      isExtra: true,
      infusionMode: 'BIC',
      infusionTime: autoDefaults.infusionTime,
      infusionTimeUnit: 'min' as const,
      volumeTotal: autoDefaults.diluentVolume,
      quantity: '1',
      quantityUnit: autoUnit,
      diluent: isIV ? autoDefaults.diluent : '',
      diluentVolume: isIV ? autoDefaults.diluentVolume : '',
      accessType: '',
      concentration: '',
    };
    setExtraItems(prev => [...prev, item]);
  };

  const addFreeItem = () => {
    if (!freeText.trim()) return;
    setExtraItems(prev => [...prev, {
      id: crypto.randomUUID(),
      name: freeText.trim(),
      presentation: '-', dose: '-', route: '-',
      posology: '-', schedule: '-', instructions: '',
      category: 'medication', flags: ['ag' as PrescriptionFlag],
      highAlert: false, status: 'active', isExtra: true,
    }]);
    setFreeText("");
  };

  const updateExtraItem = (id: string, field: keyof PrescriptionItem, value: string) => {
    setExtraItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const toggleExtraFlag = (id: string, flag: PrescriptionFlag) => {
    setExtraItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const flags = i.flags.includes(flag) ? i.flags.filter(f => f !== flag) : [...i.flags, flag];
      return { ...i, flags };
    }));
  };

  const removeExtraItem = (id: string) => {
    setExtraItems(prev => prev.filter(i => i.id !== id));
  };

  const handleConfirm = () => {
    if (extraItems.length === 0) {
      toast.error("Adicione pelo menos 1 item à prescrição extra");
      return;
    }
    onAddItems(extraItems);
    handleClose();
  };

  const agoraCount = extraItems.filter(i => i.flags.includes('ag' as PrescriptionFlag)).length;
  const scheduledCount = extraItems.length - agoraCount;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Prescrição Extra
          </DialogTitle>
          <DialogDescription>
            Adicione medicações avulsas durante o plantão. Itens marcados como <strong>"Agora"</strong> não serão renovados automaticamente.
            Itens com aprazamento (de horário) serão incorporados à rotina na próxima renovação.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="space-y-2">
          <MedicationAutocomplete
            source={allMedications}
            onSelect={addFromAutocomplete}
            placeholder="Buscar medicação para prescrição extra..."
          />
          <div className="flex gap-2">
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFreeItem()}
              placeholder="Ou digite item livre..."
              className="flex-1 h-8 text-xs"
            />
            <Button variant="outline" size="sm" onClick={addFreeItem} disabled={!freeText.trim()} className="h-8 gap-1 text-xs">
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
          {extraItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Syringe className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhum item adicionado</p>
              <p className="text-xs">Use a busca acima para adicionar medicações</p>
            </div>
          ) : (
            extraItems.map((item, idx) => (
              <div key={item.id} className="rounded-lg border border-border/50 bg-card/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {item.highAlert && <AlertTriangle className="inline h-3 w-3 mr-1 text-red-500" />}
                      {item.name}
                      {item.presentation !== '-' && <span className="font-normal text-muted-foreground ml-1">({item.presentation})</span>}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800 shrink-0">
                    EXTRA
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeExtraItem(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {/* Row: Dose, Via, Posologia, Flags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Input value={item.dose} onChange={(e) => updateExtraItem(item.id, "dose", e.target.value)} className="h-7 text-xs bg-muted/20 border-border/30 w-24" placeholder="Dose" />
                  <Select value={item.route} onValueChange={(v) => updateExtraItem(item.id, "route", v)}>
                    <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/30 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROUTES.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={item.posology} onValueChange={(v) => updateExtraItem(item.id, "posology", v)}>
                    <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/30 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{POSOLOGIES.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex gap-0.5 ml-auto">
                    {PRESCRIPTION_FLAGS.map(f => (
                      <FlagToggle
                        key={f.key}
                        flag={f}
                        active={item.flags.includes(f.key)}
                        onToggle={() => toggleExtraFlag(item.id, f.key)}
                      />
                    ))}
                  </div>
                </div>
                {/* Row: Schedule */}
                <div className="flex items-center gap-1.5">
                  <Input value={item.schedule} onChange={(e) => updateExtraItem(item.id, "schedule", e.target.value)} className="h-7 text-xs bg-muted/10 border-border/30 w-44 font-mono" placeholder="Aprazamento (ex: 14h, 22h)" />
                  <Input value={item.instructions} onChange={(e) => updateExtraItem(item.id, "instructions", e.target.value)} className="h-7 text-[11px] bg-muted/10 border-border/20 flex-1 text-muted-foreground italic" placeholder="Observações..." />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary footer */}
        {extraItems.length > 0 && (
          <div className="p-2.5 rounded-lg bg-muted/50 border border-border text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total de itens</span>
              <span className="font-semibold">{extraItems.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Itens "Agora" <span className="text-orange-500">(não renovam)</span></span>
              <span className="font-semibold text-orange-600">{agoraCount}</span>
            </div>
            {scheduledCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Itens com horário <span className="text-primary">(entram na rotina)</span></span>
                <span className="font-semibold text-primary">{scheduledCount}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirm} disabled={extraItems.length === 0} className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white">
            <Zap className="h-3.5 w-3.5" /> Adicionar {extraItems.length} item{extraItems.length !== 1 ? 's' : ''} à prescrição
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
            Itens extras marcados como "Agora" serão excluídos automaticamente da renovação.
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

// --- Print-only Item Row (dynamic schedule slots) ---
function PrintItemRow({ item, index }: { item: PrescriptionItem; index: number }) {
  const hasPreparo = item.diluent || item.diluentVolume || item.accessType || item.infusionTime;
  const slots = parseScheduleSlots(item.schedule);
  const isEven = index % 2 === 0;
  const rowBg = isEven ? '#ffffff' : '#f8fafc';
  
  return (
    <tr style={{ pageBreakInside: 'avoid' }} className={isEven ? '' : 'print-row-alt'}>
      {/* Nº — pill style */}
      <td style={{ width: '26px', borderBottom: '0.5px solid #e2e8f0', borderLeft: '0.5px solid #e2e8f0', padding: '3px 0', textAlign: 'center', verticalAlign: 'top', backgroundColor: rowBg }}>
        <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#fff', fontSize: '7pt', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', lineHeight: 1 }} className="print-num-pill">
          {index + 1}
        </div>
      </td>
      {/* Descrição do item */}
      <td style={{ borderBottom: '0.5px solid #e2e8f0', padding: '3px 8px', verticalAlign: 'top', backgroundColor: rowBg }}>
        <div style={{ fontSize: '8pt', lineHeight: '1.4', color: '#0f172a' }}>
          <span style={{ fontWeight: 800, letterSpacing: '-0.1px' }}>{item.name}</span>
          {item.presentation && item.presentation !== '-' && (
            <span style={{ fontWeight: 400, color: '#64748b', fontSize: '7.5pt' }}> ({item.presentation})</span>
          )}
          {item.quantity && item.quantityUnit && (
            <span style={{ fontWeight: 600, color: '#334155', fontSize: '7.5pt' }}> — {item.quantity} {item.quantityUnit}</span>
          )}
        </div>
        <div style={{ fontSize: '7.5pt', color: '#334155', lineHeight: '1.3', marginTop: '1px' }}>
          {[
            item.dose && item.dose !== '-' ? item.dose : null,
            item.route && item.route !== '-' ? item.route : null,
            item.posology && item.posology !== '-' ? item.posology : null,
          ].filter(Boolean).join(' · ')}
          {item.flags.length > 0 && (
            <span style={{ fontSize: '6.5pt', fontWeight: 700, marginLeft: '4px', color: '#fff', backgroundColor: '#0f172a', padding: '0.5px 4px', borderRadius: '2px', letterSpacing: '0.3px' }} className="print-flag-chip">{item.flags.join(', ').toUpperCase()}</span>
          )}
          {item.isExtra && (
            <span style={{ fontSize: '6pt', fontWeight: 700, marginLeft: '3px', color: '#ea580c', backgroundColor: '#fff7ed', padding: '0.5px 4px', borderRadius: '2px', border: '0.5px solid #fed7aa', letterSpacing: '0.3px' }}>EXTRA</span>
          )}
          {item.status === 'suspended' && (
            <span style={{ fontSize: '6.5pt', fontWeight: 700, color: '#fff', backgroundColor: '#dc2626', padding: '0.5px 4px', borderRadius: '2px', marginLeft: '3px' }} className="print-suspended-chip">SUSPENSO</span>
          )}
        </div>
        {hasPreparo && (
          <div style={{ fontSize: '6.5pt', color: '#64748b', lineHeight: '1.2', marginTop: '2px', paddingLeft: '10px', borderLeft: '1.5px solid #cbd5e1' }}>
            {[
              item.diluent && item.diluent !== '-' && item.diluent !== 'sem_diluente' ? `${item.diluent}${item.diluentVolume ? ` ${item.diluentVolume}mL` : ''}` : item.diluent === 'sem_diluente' ? 'Sem diluição' : null,
              item.accessType && item.accessType !== '-' ? item.accessType : null,
              item.volumeTotal ? `Vol total: ${item.volumeTotal}mL` : null,
              item.infusionTime ? `Correr em ${item.infusionTime}${(item.infusionTimeUnit || 'min') === 'h' ? 'h' : 'min'}` : null,
              item.infusionRate ? `${item.infusionRate} ${item.infusionMode === 'gts' ? 'gts/min' : 'mL/h'}` : null,
              item.concentration ? `Conc: ${item.concentration}` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        )}
        {item.instructions && !hasPreparo && (
          <div style={{ fontSize: '6.5pt', color: '#64748b', lineHeight: '1.2', marginTop: '2px', paddingLeft: '10px', borderLeft: '1.5px solid #cbd5e1' }}>
            {item.instructions}
          </div>
        )}
      </td>
      {/* Aprazamento */}
      <td style={{ 
        borderBottom: '0.5px solid #e2e8f0',
        textAlign: 'center', verticalAlign: 'middle',
        fontSize: '7pt', fontWeight: 700, fontFamily: 'monospace',
        color: '#0c4a6e', padding: '2px 4px', backgroundColor: rowBg,
        whiteSpace: 'nowrap', letterSpacing: '0.5px',
      }}>
        {slots.length > 0 ? slots.join('  ') : '—'}
      </td>
      {/* Checagem enfermagem */}
      <td style={{ width: '28px', borderBottom: '0.5px solid #e2e8f0', borderRight: '0.5px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle', backgroundColor: rowBg }}>
        <div style={{ width: '12px', height: '12px', border: '1.5px solid #94a3b8', borderRadius: '3px', margin: '0 auto' }} />
      </td>
    </tr>
  );
}

function PrintSimpleRow({ item, index }: { item: PrescriptionItem; index: number }) {
  const isEven = index % 2 === 0;
  const rowBg = isEven ? '#ffffff' : '#f8fafc';
  return (
    <tr style={{ pageBreakInside: 'avoid' }} className={isEven ? '' : 'print-row-alt'}>
      <td style={{ width: '26px', borderBottom: '0.5px solid #e2e8f0', borderLeft: '0.5px solid #e2e8f0', padding: '3px 0', textAlign: 'center', verticalAlign: 'top', backgroundColor: rowBg }}>
        <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#fff', fontSize: '7pt', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', lineHeight: 1 }} className="print-num-pill">
          {index + 1}
        </div>
      </td>
      <td colSpan={2} style={{ borderBottom: '0.5px solid #e2e8f0', padding: '3px 8px', verticalAlign: 'top', backgroundColor: rowBg }}>
        <div style={{ fontSize: '8pt', lineHeight: '1.4', color: '#0f172a' }}>
          <span style={{ fontWeight: 800 }}>{item.name}</span>
          {item.dose && item.dose !== '-' ? <span style={{ color: '#334155', fontWeight: 500 }}> — {item.dose}</span> : ''}
          {item.posology && item.posology !== '-' ? <span style={{ color: '#64748b', fontWeight: 500 }}> — {item.posology}</span> : ''}
        </div>
      </td>
      <td style={{ width: '28px', borderBottom: '0.5px solid #e2e8f0', borderRight: '0.5px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle', backgroundColor: rowBg }}>
        <div style={{ width: '12px', height: '12px', border: '1.5px solid #94a3b8', borderRadius: '3px', margin: '0 auto' }} />
      </td>
    </tr>
  );
}

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
  if (selectedCount === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed bottom-5 right-5 z-[999] flex items-center gap-2 px-3 py-2.5 rounded-xl bg-background/95 backdrop-blur-sm border border-border shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-300">
      <Checkbox
        checked={allSelected}
        onCheckedChange={() => allSelected ? onDeselectAll() : onSelectAll()}
      />
      <span className="text-xs font-medium text-primary">
        {selectedCount} item{selectedCount > 1 ? 'ns' : ''}
      </span>
      <div className="w-px h-5 bg-border mx-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicateSelected}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Duplicar</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-warning hover:text-warning" onClick={onSuspendSelected}>
            <Pause className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Suspender</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDeleteSelected}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Excluir</TooltipContent>
      </Tooltip>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onDeselectAll}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>,
    document.body
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
  const { getCount: getFavoriteCount, trackUse: trackMedicationUse } = useMedicationFavorites();

  // Initialize patient and items directly from URL params to avoid render delay
  const initialPatientName = searchParams.get('patientName') || '';
  const initialPatientBed = searchParams.get('patientBed') || '';
  const initialPatientSector = searchParams.get('patientSector') || '';
  const sectorMapInit: Record<string, string> = { red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2" };

  const [patient, setPatient] = useState<PatientHeader>(() => {
    const demoPatients: Record<string, Omit<PatientHeader, 'bed' | 'unit'>> = {
      'L09': { name: initialPatientName || 'Iglesio Ferreira da Silva', birthDate: '1953-07-14', age: '72 anos', sex: 'Masculino', record: 'PRN-2024-08451', admissionDate: '2026-03-15', utiAdmissionDate: '2026-03-15', weight: '78', allergies: 'Dipirona, Sulfa', motherName: 'Maria José da Silva', address: 'Rua das Palmeiras, 456', city: 'São Luís - MA' },
      'L10': { name: 'Maria das Graças Oliveira', birthDate: '1948-02-22', age: '78 anos', sex: 'Feminino', record: 'PRN-2024-09102', admissionDate: '2026-03-14', utiAdmissionDate: '2026-03-14', weight: '62', allergies: 'NDAM', motherName: 'Ana Maria Oliveira', address: 'Av. dos Holandeses, 1200', city: 'São Luís - MA' },
      'L11': { name: 'José Carlos Mendes', birthDate: '1960-11-03', age: '65 anos', sex: 'Masculino', record: 'PRN-2024-07833', admissionDate: '2026-03-16', utiAdmissionDate: '2026-03-16', weight: '85', allergies: 'Penicilina, AAS', motherName: 'Francisca Mendes', address: 'Rua do Sol, 89', city: 'São Luís - MA' },
    };
    const demo = demoPatients[initialPatientBed] || { name: initialPatientName, birthDate: '1970-01-15', age: '56 anos', sex: 'Masculino', record: 'PRN-2024-00000', admissionDate: '2026-03-17', utiAdmissionDate: '2026-03-17', weight: '70', allergies: 'NDAM', motherName: '', address: '', city: '' };
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
  // Sugestões de posologia para o último item adicionado
  const [posologySuggestion, setPosologySuggestion] = useState<{
    itemId: string;
    name: string;
    protocols: PosologyProtocol[];
  } | null>(null);
  const [nonStdName, setNonStdName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [freeRecommendation, setFreeRecommendation] = useState("");
  const [appliedCareProfiles, setAppliedCareProfiles] = useState<Set<string>>(new Set());
  const [historyDate, setHistoryDate] = useState<Date | undefined>(undefined);

  // Phase 3 state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<{ id?: string; isBatch?: boolean; name?: string }>({});
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);

  // Phase 4 state — Digital Signature
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [digitalSignature, setDigitalSignature] = useState<DigitalSignature | null>(null);

  // Phase 5 state — AI Drug Interactions
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);

  // Phase 7 state — Extra Prescription
  const [extraPrescriptionOpen, setExtraPrescriptionOpen] = useState(false);

  // Antimicrobial Guide & Psychotropic Form
  const [antimicrobialGuideOpen, setAntimicrobialGuideOpen] = useState(false);
  const [psychotropicFormOpen, setPsychotropicFormOpen] = useState(false);
  const [tevProtocolOpen, setTevProtocolOpen] = useState(false);
  const [pendingAntimicrobialMed, setPendingAntimicrobialMed] = useState<MedicationEntry | null>(null);
  const [compactView, setCompactView] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<PrescriptionCategory>>(new Set());

  const [dispensationDialogOpen, setDispensationDialogOpen] = useState(false);
  const [dispensations, setDispensations] = useState<Array<{ id: string; dispensation_code: string; dispensed_at: string; dispensed_by_name: string | null }>>([]);
  const [dispensationSlip, setDispensationSlip] = useState<{ code: string; items: PrescriptionItem[]; patientName: string; bed: string; date: string } | null>(null);

  // Phase 5 state — Persistence
  const [currentPrescriptionId, setCurrentPrescriptionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Repeat previous prescription
  const [repeatDialogOpen, setRepeatDialogOpen] = useState(false);
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [repeatSourceItems, setRepeatSourceItems] = useState<PrescriptionItem[]>([]);
  const [repeatSourceMeta, setRepeatSourceMeta] = useState<{ date: string; version: number } | null>(null);
  const [repeatSelectedIds, setRepeatSelectedIds] = useState<Set<string>>(new Set());
  const [savedPrescriptions, setSavedPrescriptions] = useState<Array<{ id: string; patient_name: string; status: string; version: number; created_at: string; digital_signature: DigitalSignature | null }>>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [versionHistory, setVersionHistory] = useState<Array<{ id: string; version: number; status: string; created_at: string; digital_signature: DigitalSignature | null }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);

  // Keyboard shortcuts
  const globalSearchRef = useRef<GlobalPrescriptionSearchHandle | null>(null);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  // Quick templates (combos clínicos 1-clique)
  const { templates: quickTemplates, loading: quickTemplatesLoading, saveTemplate: saveQuickTemplate, deleteTemplate: deleteQuickTemplate, bumpUseCount: bumpQuickTemplateUse } = useQuickPrescriptionTemplates();
  const [quickTemplatesDialogOpen, setQuickTemplatesDialogOpen] = useState(false);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [templateScopeFilter, setTemplateScopeFilter] = useState<"all" | "personal" | "shared">("all");
  // Dose calculator (peso/SC)
  const [doseCalcOpen, setDoseCalcOpen] = useState(false);
  const [doseCalcInitialMed, setDoseCalcInitialMed] = useState<string | undefined>(undefined);

  const applyDoseCalculatorResult = useCallback((r: DoseCalculatorResult) => {
    const instructions = [
      r.diluent && r.diluentVolume ? `Diluir em ${r.diluentVolume} mL ${r.diluent}` : null,
      r.infusionTime ? `Infundir em ${r.infusionTime}` : null,
      r.rate ? `Vazão: ${r.rate}` : null,
      r.notes ? `Nota: ${r.notes}` : null,
    ].filter(Boolean).join(" · ");
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      name: r.medication,
      presentation: r.diluent && r.diluentVolume ? `${r.diluentVolume} mL ${r.diluent}` : "-",
      dose: r.dose,
      route: r.route || "EV",
      posology: r.schedule,
      schedule: r.schedule,
      instructions,
      category: "antimicrobial" as PrescriptionCategory,
      flags: [],
      highAlert: false,
      status: "active",
      diluent: r.diluent,
      diluentVolume: r.diluentVolume,
      infusionTime: r.infusionTime,
    } as any]);
    toast.success("Item adicionado pela calculadora", { description: `${r.medication} — ${r.dose} ${r.schedule}` });
  }, []);

  // Validation: check if past 05:00 renewal time
  const isPastRenewalTime = useMemo(() => {
    const now = new Date();
    const renewalTime = setSeconds(setMinutes(setHours(startOfDay(now), 5), 0), 0);
    return isAfter(now, renewalTime);
  }, []);

  // Helper: item considerado validado para o dia atual
  const isItemValidatedToday = useCallback((item: PrescriptionItem) => {
    if (!item.validated) return false;
    if (!isPastRenewalTime) return true;
    const cutoff = setSeconds(setMinutes(setHours(startOfDay(new Date()), 5), 0), 0);
    return !!(item.validatedAt && new Date(item.validatedAt) > cutoff);
  }, [isPastRenewalTime]);

  // Prescrição está "travada" (já validada hoje) quando há ao menos 1 item ativo validado.
  // Nesse estado, novos itens podem ser validados individualmente (com senha).
  // Caso contrário, validação só pode ocorrer em bloco.
  const prescriptionLocked = useMemo(() => {
    return items.some(i => i.status === 'active' && isItemValidatedToday(i));
  }, [items, isItemValidatedToday]);

  // All items validated check (todos os ativos validados hoje)
  const allItemsValidated = useMemo(() => {
    const activeItems = items.filter(i => i.status === 'active');
    return activeItems.length > 0 && activeItems.every(isItemValidatedToday);
  }, [items, isItemValidatedToday]);

  // Itens ativos que NÃO foram revalidados após o corte 05:00 de hoje
  const renewalPendingCount = useMemo(() => {
    const activeItems = items.filter(i => i.status === 'active');
    return activeItems.filter(i => !isItemValidatedToday(i)).length;
  }, [items, isItemValidatedToday]);

  // Password confirmation dialog state
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);
  const [pendingValidationAction, setPendingValidationAction] = useState<
    | { type: 'all' }
    | { type: 'item'; itemId: string }
    | null
  >(null);

  // Janela de sessão validada (20min) — após validar com senha,
  // novas validações nesse intervalo dispensam nova digitação de senha.
  const VALIDATION_SESSION_MS = 20 * 60 * 1000; // 20 minutos
  const [validationSessionExpiresAt, setValidationSessionExpiresAt] = useState<number | null>(null);
  const [sessionTick, setSessionTick] = useState(0); // força re-render para countdown

  // Tick a cada 30s enquanto a sessão estiver ativa (suficiente p/ countdown em min)
  useEffect(() => {
    if (!validationSessionExpiresAt) return;
    const interval = setInterval(() => {
      if (Date.now() >= validationSessionExpiresAt) {
        setValidationSessionExpiresAt(null);
      } else {
        setSessionTick(t => t + 1);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [validationSessionExpiresAt]);

  const isValidationSessionActive = useMemo(() => {
    void sessionTick; // dependência implícita p/ recomputar a cada tick
    return !!(validationSessionExpiresAt && Date.now() < validationSessionExpiresAt);
  }, [validationSessionExpiresAt, sessionTick]);

  const sessionMinutesLeft = useMemo(() => {
    if (!isValidationSessionActive || !validationSessionExpiresAt) return 0;
    return Math.max(1, Math.ceil((validationSessionExpiresAt - Date.now()) / 60_000));
  }, [isValidationSessionActive, validationSessionExpiresAt, sessionTick]);

  // Aplica a validação a um conjunto (sem pedir senha) — usado tanto pelo caminho rápido
  // quanto pelo executeValidation (após senha).
  const applyValidation = useCallback((action: { type: 'all' } | { type: 'item'; itemId: string }) => {
    const now = new Date().toISOString();
    if (action.type === 'all') {
      setItems(prev => prev.map(item =>
        item.status === 'active' ? { ...item, validated: true, validatedAt: now } : item
      ));
      toast.success("Prescrição validada", { description: "Todos os itens ativos foram validados." });
    } else {
      setItems(prev => prev.map(item =>
        item.id === action.itemId ? { ...item, validated: true, validatedAt: now } : item
      ));
      toast.success("Item validado");
    }
  }, []);

  // === Pré-validação clínica: alertas (alergia / interações graves / duplicidade) ===
  // O médico é alertado mas NÃO bloqueado: pode confirmar ciência e prosseguir.
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState<ClinicalAlert[]>([]);

  // Continua o fluxo de validação após (eventual) checagem de alertas:
  // se sessão ativa → aplica direto; senão → pede senha.
  const proceedValidation = useCallback((action: { type: 'all' } | { type: 'item'; itemId: string }) => {
    if (isValidationSessionActive) {
      applyValidation(action);
      setValidationSessionExpiresAt(Date.now() + VALIDATION_SESSION_MS);
      return;
    }
    setPendingValidationAction(action);
    setPasswordConfirmOpen(true);
  }, [isValidationSessionActive, applyValidation, VALIDATION_SESSION_MS]);

  // Solicita validação em bloco — checa alertas antes; pode pular senha se sessão ativa
  const requestValidateAll = useCallback(() => {
    const activeItems = items.filter(i => i.status === 'active');
    if (activeItems.length === 0) {
      toast.error("Nenhum item ativo para validar");
      return;
    }
    const alerts = runClinicalAlertChecks(items, patient.allergies);
    if (alerts.length > 0) {
      setPendingAlerts(alerts);
      setPendingValidationAction({ type: 'all' });
      setAlertDialogOpen(true);
      return;
    }
    proceedValidation({ type: 'all' });
  }, [items, patient.allergies, proceedValidation]);

  // Solicita validação individual — checa alertas relativos ao item
  const requestValidateItem = useCallback((id: string) => {
    const alerts = runClinicalAlertChecks(items, patient.allergies, { onlyItemId: id });
    if (alerts.length > 0) {
      setPendingAlerts(alerts);
      setPendingValidationAction({ type: 'item', itemId: id });
      setAlertDialogOpen(true);
      return;
    }
    proceedValidation({ type: 'item', itemId: id });
  }, [items, patient.allergies, proceedValidation]);

  // Após o médico confirmar ciência dos alertas → continua o fluxo
  const handleAlertAcknowledged = useCallback(() => {
    setAlertDialogOpen(false);
    setPendingAlerts([]);
    if (pendingValidationAction) proceedValidation(pendingValidationAction);
  }, [pendingValidationAction, proceedValidation]);

  const handleAlertCancelled = useCallback(() => {
    setAlertDialogOpen(false);
    setPendingAlerts([]);
    setPendingValidationAction(null);
  }, []);

  // Executa a validação após confirmação de senha — abre/renova a sessão de 20min
  const executeValidation = useCallback(() => {
    const action = pendingValidationAction;
    if (!action) return;
    applyValidation(action);
    setValidationSessionExpiresAt(Date.now() + VALIDATION_SESSION_MS);
    setPendingValidationAction(null);
  }, [pendingValidationAction, applyValidation, VALIDATION_SESSION_MS]);

  // Mantido por compatibilidade — não é mais chamado diretamente
  const toggleValidation = requestValidateItem;
  const validateAllItems = requestValidateAll;

  const prescriptionDate = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });

  // Auto-create encounter code for patient if not yet assigned
  const ensureEncounterCode = useCallback(async () => {
    if (!currentHospital || !currentState || !patient.name.trim() || patient.encounterCode) return;
    try {
      // Check if patient already has an active encounter
      const patientId = searchParams.get('patientId');
      const { data: existing } = await supabase
        .from('patient_encounters')
        .select('encounter_code')
        .eq('hospital_unit_id', currentHospital.id)
        .eq('state_id', currentState.id)
        .eq('patient_name', patient.name.trim())
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (existing && existing.length > 0) {
        setPatient(prev => ({ ...prev, encounterCode: existing[0].encounter_code }));
        return;
      }

      // Create new encounter
      const { data: newEnc, error } = await supabase
        .from('patient_encounters')
        .insert({
          patient_name: patient.name.trim(),
          patient_id: patientId || undefined,
          hospital_unit_id: currentHospital.id,
          state_id: currentState.id,
          created_by: user?.id || undefined,
          encounter_code: '', // trigger will generate
        })
        .select('encounter_code')
        .single();
      
      if (!error && newEnc) {
        setPatient(prev => ({ ...prev, encounterCode: newEnc.encounter_code }));
      }
    } catch (err) {
      console.error('Error ensuring encounter code:', err);
    }
  }, [currentHospital, currentState, patient.name, patient.encounterCode, user, searchParams]);

  useEffect(() => { ensureEncounterCode(); }, [ensureEncounterCode]);

  // Fetch pre-admission data for risk classification on print
  useEffect(() => {
    const fetchPreAdmission = async () => {
      if (!currentHospital || !currentState || !patient.name.trim()) return;
      try {
        const { data } = await supabase
          .from('pre_admissions')
          .select('chief_complaint, vital_signs, risk_classification')
          .eq('hospital_unit_id', currentHospital.id)
          .eq('state_id', currentState.id)
          .eq('patient_name', patient.name.trim())
          .order('created_at', { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          const pa = data[0];
          const vs = pa.vital_signs as Record<string, string> | null;
          const vitalsStr = vs ? [
            vs.pa ? `PA: ${vs.pa} mmHg` : null,
            vs.fc ? `FC: ${vs.fc} bpm` : null,
            vs.fr ? `FR: ${vs.fr} irpm` : null,
            vs.tax ? `Tax: ${vs.tax} °C` : null,
            vs.sato2 ? `SatO2: ${vs.sato2}%` : null,
            vs.peso ? `Peso: ${vs.peso} kg` : null,
            vs.glicemia ? `Glicemia: ${vs.glicemia} mg/dL` : null,
          ].filter(Boolean).join(' | ') : '';
          setPatient(prev => ({
            ...prev,
            chiefComplaint: pa.chief_complaint || undefined,
            vitalSigns: vitalsStr || undefined,
            riskClassification: pa.risk_classification || undefined,
          }));
        }
      } catch (err) {
        console.error('Error fetching pre-admission:', err);
      }
    };
    fetchPreAdmission();
  }, [currentHospital, currentState, patient.name]);

  // Fetch dispensations for current prescription
  const fetchDispensations = useCallback(async () => {
    if (!currentPrescriptionId) { setDispensations([]); return; }
    try {
      const { data } = await supabase
        .from('dispensations')
        .select('id, dispensation_code, dispensed_at, dispensed_by_name')
        .eq('prescription_id', currentPrescriptionId)
        .order('dispensed_at', { ascending: false });
      setDispensations(data || []);
    } catch (err) {
      console.error('Error fetching dispensations:', err);
    }
  }, [currentPrescriptionId]);

  useEffect(() => { fetchDispensations(); }, [fetchDispensations]);

  // Dispense prescription (pharmacy action)
  const handleDispense = useCallback(async () => {
    if (!currentPrescriptionId || !currentHospital || !currentState) {
      toast.error("Salve a prescrição antes de dispensar");
      return;
    }
    const activeItems = items.filter(i => i.status === 'active');
    if (activeItems.length === 0) { toast.error("Nenhum item ativo para dispensar"); return; }

    try {
      const { data, error } = await supabase
        .from('dispensations')
        .insert({
          prescription_id: currentPrescriptionId,
          patient_name: patient.name.trim(),
          encounter_code: patient.encounterCode || null,
          dispensed_items: activeItems.map(i => ({
            name: i.name,
            presentation: i.presentation,
            dose: i.dose,
            route: i.route,
            posology: i.posology,
            quantity: i.quantity || '1',
            quantityUnit: i.quantityUnit || '',
          })) as any,
          dispensed_by: user?.id || null,
          dispensed_by_name: user?.email?.split('@')[0] || 'Farmácia',
          hospital_unit_id: currentHospital.id,
          state_id: currentState.id,
          dispensation_code: '', // trigger generates
        })
        .select('dispensation_code')
        .single();

      if (error) throw error;
      
      toast.success(`Dispensação registrada: ${data.dispensation_code}`);
      setDispensationSlip({
        code: data.dispensation_code,
        items: activeItems,
        patientName: patient.name,
        bed: patient.bed,
        date: format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      });
      fetchDispensations();
    } catch (err: any) {
      toast.error("Erro ao registrar dispensação", { description: err.message });
    }
  }, [currentPrescriptionId, currentHospital, currentState, items, patient, user, fetchDispensations]);

  // (Patient header and demo items are now initialized synchronously from URL params above)

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // --- Handlers ---
  const createItem = (med: MedicationEntry): PrescriptionItem => {
    const autoUnit = detectQuantityUnit(med.presentation, med.defaultDose);
    const autoDefaults = detectDiluentDefaults(med.instructions || '');
    const isIV = isIVRoute(med.defaultRoute);
    return {
      id: crypto.randomUUID(),
      name: med.name,
      presentation: med.presentation,
      dose: med.defaultDose,
      route: med.defaultRoute,
      posology: med.defaultPosology,
      schedule: med.defaultSchedule,
      instructions: med.instructions || "",
      category: med.category,
      flags: med.instructions?.toLowerCase().includes('bomba de infusão') ? ['bi' as PrescriptionFlag] : [],
      highAlert: med.highAlert || false,
      status: 'active',
      infusionMode: 'BIC',
      infusionTime: autoDefaults.infusionTime,
      infusionTimeUnit: 'min' as const,
      volumeTotal: autoDefaults.diluentVolume,
      quantity: '1',
      quantityUnit: autoUnit,
      diluent: isIV ? autoDefaults.diluent : '',
      diluentVolume: isIV ? autoDefaults.diluentVolume : '',
      accessType: '',
      concentration: '',
    };
  };

  const addItem = (med: MedicationEntry) => {
    // Track usage for favorites/ranking (best-effort, non-blocking)
    if (med.id && med.category !== 'nonstandard') {
      trackMedicationUse(med.id, med.name, med.category);
    }
    // Antimicrobials must go through the Antimicrobial Guide first
    if (med.category === 'antimicrobial') {
      setPendingAntimicrobialMed(med);
      setAntimicrobialGuideOpen(true);
      return;
    }
    const newItem = createItem(med);
    setItems((prev) => [...prev, newItem]);
    // Sugerir protocolos de posologia, se houver
    const protocols = getProtocolsFor(med.name);
    if (protocols.length > 0) {
      setPosologySuggestion({ itemId: newItem.id, name: med.name, protocols });
    } else {
      setPosologySuggestion(null);
    }
  };

  // Aplica um protocolo de posologia ao item-alvo, sobrescrevendo dose/via/etc.
  const applyPosologyProtocol = (itemId: string, p: PosologyProtocol) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        dose: p.dose || it.dose,
        route: p.route || it.route,
        posology: p.posology || it.posology,
        schedule: p.schedule || it.schedule,
        instructions: p.instructions || it.instructions,
        diluent: p.diluent ?? it.diluent,
        diluentVolume: p.diluentVolume ?? it.diluentVolume,
        infusionTime: p.infusionTime ?? it.infusionTime,
      };
    }));
    toast.success(`Protocolo "${p.label}" aplicado`);
    setPosologySuggestion(null);
  };

  // Callback when antimicrobial guide is confirmed — add both guide entry data and the prescription item
  const handleAntimicrobialConfirm = useCallback((confirmedEntries: Array<{ medication: string; dose: string; route: string; posology: string }>) => {
    // Find matching MedicationEntry from the database for each confirmed entry
    const antimicrobialOptions = ALL_ITEMS_BY_CATEGORY['antimicrobial'] || [];
    const newItems: PrescriptionItem[] = confirmedEntries.map(entry => {
      const matchedMed = antimicrobialOptions.find(m => m.name === entry.medication);
      if (matchedMed) {
        const item = createItem(matchedMed);
        // Override with values from the guide form
        item.dose = entry.dose || item.dose;
        item.route = entry.route || item.route;
        item.posology = entry.posology || item.posology;
        return item;
      }
      // Fallback: create item from entry data
      return {
        id: crypto.randomUUID(),
        name: entry.medication,
        presentation: '',
        dose: entry.dose,
        route: entry.route,
        posology: entry.posology,
        schedule: '',
        instructions: '',
        category: 'antimicrobial' as PrescriptionCategory,
        flags: [] as PrescriptionFlag[],
        highAlert: false,
        status: 'active' as const,
      };
    });
    setItems(prev => [...prev, ...newItems]);
    setPendingAntimicrobialMed(null);
    toast.success(`${newItems.length} antimicrobiano(s) adicionado(s) à prescrição via Guia ATM`);
  }, []);

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

  // ===== Keyboard shortcuts =====
  // Ctrl/⌘+K or "/" → focus search · Ctrl/⌘+D → duplicate selected
  // Ctrl/⌘+Enter → validate prescription · Ctrl/⌘+Y → repeat yesterday
  // ? → show help
  const shortcutHandlersRef = useRef<{
    duplicate: () => void;
    repeat: () => void;
    validate: () => void;
  }>({ duplicate: () => {}, repeat: () => {}, validate: () => {} });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target && (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        );
      const mod = e.ctrlKey || e.metaKey;

      // Focus search: Ctrl/⌘+K (works even while typing) or "/" (only when not typing)
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        globalSearchRef.current?.focus();
        return;
      }
      if (!isTyping && e.key === "/") {
        e.preventDefault();
        globalSearchRef.current?.focus();
        return;
      }

      if (isTyping) return;

      // Help: ?
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcutsHelpOpen(true);
        return;
      }

      // Duplicate selected: Ctrl/⌘+D
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        shortcutHandlersRef.current.duplicate();
        return;
      }

      // Repeat yesterday: Ctrl/⌘+Y
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        shortcutHandlersRef.current.repeat();
        return;
      }

      // Validate all: Ctrl/⌘+Enter
      if (mod && e.key === "Enter") {
        e.preventDefault();
        shortcutHandlersRef.current.validate();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    items.forEach(item => {
      const cat = item.category in map ? item.category : 'nonstandard' as PrescriptionCategory;
      map[cat].push(item);
    });
    return map;
  }, [items]);

  const totalItems = items.length;
  const activeItemsCount = items.filter(i => i.status === 'active').length;
  const suspendedItemsCount = items.filter(i => i.status === 'suspended').length;

  // Fetch saved prescriptions — filtered by current patient
  const fetchPrescriptions = useCallback(async () => {
    if (!currentHospital || !currentState || !patient.name.trim()) return;
    setLoadingList(true);
    try {
      let query = supabase
        .from('prescriptions')
        .select('id, patient_name, status, version, created_at, digital_signature')
        .eq('hospital_unit_id', currentHospital.id)
        .eq('state_id', currentState.id)
        .eq('patient_name', patient.name.trim())
        .order('created_at', { ascending: false })
        .limit(30);

      if (historyDate) {
        const dayStart = startOfDay(historyDate).toISOString();
        const dayEnd = startOfDay(addDays(historyDate, 1)).toISOString();
        query = query.gte('created_at', dayStart).lt('created_at', dayEnd);
      }

      const { data, error } = await query;
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
  }, [currentHospital, currentState, patient.name, historyDate]);

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

  // ===== Repeat previous prescription =====
  const openRepeatDialog = useCallback(async () => {
    if (!currentHospital || !currentState || !patient.name.trim()) {
      toast.error("Preencha o nome do paciente para buscar prescrições anteriores");
      return;
    }
    setRepeatLoading(true);
    setRepeatDialogOpen(true);
    try {
      // Buscar última prescrição do paciente, excluindo a atual
      let query = supabase
        .from('prescriptions')
        .select('id, items, version, created_at')
        .eq('hospital_unit_id', currentHospital.id)
        .eq('state_id', currentState.id)
        .eq('patient_name', patient.name.trim())
        .order('created_at', { ascending: false })
        .limit(5);
      if (currentPrescriptionId) {
        query = query.neq('id', currentPrescriptionId);
      }
      const { data, error } = await query;
      if (error) throw error;
      const previous = (data || []).find(d => Array.isArray(d.items) && (d.items as unknown[]).length > 0);
      if (!previous) {
        setRepeatSourceItems([]);
        setRepeatSourceMeta(null);
        setRepeatSelectedIds(new Set());
        return;
      }
      const sourceItems = (previous.items as unknown as PrescriptionItem[]).filter(
        i => i.status === 'active' && !i.isExtra
      );
      setRepeatSourceItems(sourceItems);
      setRepeatSourceMeta({
        date: format(new Date(previous.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        version: previous.version,
      });
      // Pré-seleciona todos
      setRepeatSelectedIds(new Set(sourceItems.map(i => i.id)));
    } catch (err: any) {
      toast.error("Erro ao buscar prescrição anterior", { description: err.message });
      setRepeatDialogOpen(false);
    } finally {
      setRepeatLoading(false);
    }
  }, [currentHospital, currentState, patient.name, currentPrescriptionId]);

  const applyRepeatedItems = useCallback(() => {
    if (repeatSelectedIds.size === 0) {
      toast.error("Selecione ao menos um item para repetir");
      return;
    }
    const cloned: PrescriptionItem[] = repeatSourceItems
      .filter(i => repeatSelectedIds.has(i.id))
      .map(i => ({
        ...i,
        id: crypto.randomUUID(),
        status: 'active',
        suspensionReason: undefined,
        suspendedAt: undefined,
        validated: false,
        validatedAt: undefined,
        isExtra: false,
      }));
    setItems(prev => [...prev, ...cloned]);
    toast.success(`${cloned.length} item(ns) repetido(s) da prescrição anterior`);
    setRepeatDialogOpen(false);
    setRepeatSourceItems([]);
    setRepeatSelectedIds(new Set());
    setRepeatSourceMeta(null);
  }, [repeatSelectedIds, repeatSourceItems]);

  // Keep keyboard-shortcut handlers in sync with latest closures
  useEffect(() => {
    shortcutHandlersRef.current = {
      duplicate: () => {
        if (selectedIds.size > 0) duplicateSelected();
        else toast.info("Selecione um ou mais itens para duplicar");
      },
      repeat: () => openRepeatDialog(),
      validate: () => requestValidateAll(),
    };
  }, [selectedIds, duplicateSelected, openRepeatDialog, requestValidateAll]);

  // ===== Quick templates: apply + save =====
  const mapTemplateCategory = useCallback((cat: string): PrescriptionCategory => {
    const c = (cat || "").toLowerCase().trim();
    const valid: PrescriptionCategory[] = ['nutrition','hydration','medication','antimicrobial','high_alert','inhalation','hemotherapy','care','nonstandard'];
    if (valid.includes(c as PrescriptionCategory)) return c as PrescriptionCategory;
    // pt-BR aliases used in seed templates
    if (c === 'antimicrobianos') return 'antimicrobial';
    if (c === 'hidratacao' || c === 'hidratação') return 'hydration';
    if (c === 'dieta' || c === 'dietas') return 'nutrition';
    if (c === 'sintomaticos' || c === 'sintomáticos' || c === 'medicacoes' || c === 'medicações' || c === 'antiagregantes' || c === 'profilaxia') return 'medication';
    if (c === 'cuidados') return 'care';
    if (c === 'inalatorios' || c === 'inalatórios') return 'inhalation';
    return 'medication';
  }, []);

  const applyQuickTemplate = useCallback((tpl: QuickPrescriptionTemplate) => {
    if (!tpl.items?.length) {
      toast.error("Template vazio");
      return;
    }
    const cloned: PrescriptionItem[] = tpl.items.map((it: QuickTemplateItem) => ({
      id: crypto.randomUUID(),
      name: it.name,
      presentation: it.presentation || "",
      dose: it.dose || "",
      route: it.route || "",
      posology: it.posology || "",
      schedule: it.schedule || "",
      instructions: it.instructions || "",
      category: mapTemplateCategory(it.category),
      flags: (it.flags || []) as PrescriptionFlag[],
      highAlert: !!it.highAlert,
      status: "active" as const,
      validated: false,
      diluent: it.diluent,
      diluentVolume: it.diluentVolume,
      infusionTime: it.infusionTime,
      quantity: it.quantity,
      quantityUnit: it.quantityUnit,
    }));
    setItems((prev) => [...prev, ...cloned]);
    bumpQuickTemplateUse(tpl.id);
    toast.success(`Template aplicado: ${tpl.name}`, {
      description: `${cloned.length} item(ns) adicionado(s) à prescrição`,
    });
    setQuickTemplatesDialogOpen(false);
  }, [bumpQuickTemplateUse, mapTemplateCategory]);

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
    setPatient({ name: "", birthDate: "", age: "", sex: "", bed: "", unit: "", record: "", admissionDate: "", utiAdmissionDate: "", weight: "", allergies: "", motherName: "", address: "", city: "", encounterCode: "" });
    setItems([]);
    setDigitalSignature(null);
    setCurrentPrescriptionId(null);
    setSelectedIds(new Set());
    toast.info("Nova prescrição iniciada");
  };

  const [showPrintPortal, setShowPrintPortal] = useState(false);
  const handlePrint = () => {
    setShowPrintPortal(true);
    setTimeout(() => {
      window.print();
      setShowPrintPortal(false);
    }, 300);
  };

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
    const sourceItems = (includeSuspended ? items : items.filter(i => i.status === 'active'))
      // Exclude extra "Agora" items — they are one-time and should NOT renew
      .filter(i => !(i.isExtra && i.flags.includes('ag' as PrescriptionFlag)));
    const renewedItems: PrescriptionItem[] = sourceItems.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      status: 'active' as const,
      suspensionReason: undefined,
      suspendedAt: undefined,
      // Extra items with scheduled times become routine items on renewal
      isExtra: false,
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

  const cockpitPatient: Patient = useMemo(() => ({
    id: searchParams.get('patientId') || 'prescricao-stub',
    bedNumber: patient.bed,
    name: patient.name,
    age: typeof patient.age === 'string' ? patient.age.replace(/\s*anos?$/i, '') : patient.age,
    sector: (initialPatientSector as Patient['sector']) || 'outside',
    diagnoses: [],
    medicalHistory: [],
    relevantExams: [],
    pendencies: [],
    schedule: [],
    admissionHistory: '',
    admissionDate: patient.admissionDate,
    utiAllergies: patient.allergies && patient.allergies !== 'NDAM' ? [patient.allergies] : [],
    clinicalStatus: 'regular',
  }), [patient, searchParams, initialPatientSector]);

  return (
    <div className="animate-fade-in">
      <ClinicalHeader moduleLabel="Prescrição Médica" />
      <div className="flex print:block">
        <div className="flex-1 min-w-0 max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Print styles — hide everything except portal */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 5mm 12mm 8mm 12mm; }
          body > *:not(#prescription-print-root) { display: none !important; }
          #prescription-print-root { display: block !important; }
          #prescription-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      ` }} />

      {/* Page Title + Inline Requirements + Action toolbar */}
      <div className="print:hidden flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 shrink-0">
            <Pill className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground leading-tight">Prescrição médica diária</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {currentPrescriptionId && <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-primary border-primary/30">Salva</Badge>}
              {patient.encounterCode && <span className="font-mono text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded"><Hash className="inline h-3 w-3 mr-0.5" />{patient.encounterCode}</span>}
              <span className="text-[10px] text-muted-foreground font-mono">{prescriptionDate}</span>
            </div>
          </div>
        </div>

        {/* Action toolbar — Peso, Alergias, Calendário, Dose/kg, Templates... na mesma linha */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end ml-auto">
          {/* Inline requirements: Peso + Alergias */}
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Peso (kg)</Label>
            <Input
              value={patient.weight}
              onChange={(e) => updatePatient("weight", e.target.value)}
              placeholder="72"
              className={cn(
                "h-7 w-14 text-xs font-medium",
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
                "h-7 w-36 text-xs font-medium",
                !patient.allergies.trim()
                  ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10"
                  : "border-destructive/20"
              )}
            />
          </div>
          {(!patient.weight.trim() || !patient.allergies.trim()) && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              <AlertTriangle className="h-3 w-3" />
              Preencha {!patient.weight.trim() && !patient.allergies.trim() ? 'peso e alergias' : !patient.weight.trim() ? 'o peso' : 'as alergias'}
            </span>
          )}

          {/* Divider */}
          <span className="h-5 w-px bg-border/60 mx-0.5" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2">
                <CalendarDays className="h-3 w-3" />
                {historyDate ? format(historyDate, "dd/MM/yyyy") : "Calendário"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={historyDate}
                onSelect={(d) => { setHistoryDate(d); }}
                locale={ptBR}
                initialFocus
              />
              {historyDate && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setHistoryDate(undefined)}>
                    Limpar filtro
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          {/* "Repetir de ontem" removido — agora ocorre automaticamente ao Renovar dia. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setDoseCalcInitialMed(undefined); setDoseCalcOpen(true); }}
            className="h-7 text-[10px] gap-1 px-2 border-blue-400/40 hover:bg-blue-50 dark:hover:bg-blue-950/20"
            title="Calculadora de dose por peso/superfície corporal"
          >
            <Calculator className="h-3 w-3 text-blue-500" /> Dose/kg
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickTemplatesDialogOpen(true)}
            className="h-7 text-[10px] gap-1 px-2 border-amber-400/40 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            title="Templates clínicos prontos (Sepse, Pós-op, DPOC...)"
          >
            <Zap className="h-3 w-3 text-amber-500" /> Templates
            {quickTemplates.length > 0 && (
              <span className="ml-0.5 text-[9px] font-mono text-muted-foreground">
                ({quickTemplates.length})
              </span>
            )}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => setShortcutsHelpOpen(true)} className="h-7 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground">
                <kbd className="px-1 py-0 rounded border border-border bg-muted text-[9px] font-mono">?</kbd>
                <span className="hidden md:inline">Atalhos</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Atalhos de teclado (?)</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="sm" onClick={fetchPrescriptions} disabled={loadingList} className="h-7 text-[10px] gap-1 px-2">
            <RefreshCw className={cn("h-3 w-3", loadingList && "animate-spin")} /> Atualizar
          </Button>
        </div>
      </div>

      {/* Requisitos (peso/alergias) integrados ao cabeçalho acima. */}

      {/* "Prescrições anteriores" foi integrado ao workbench unificado abaixo. */}
      {/* ===== VERSION HISTORY ===== */}
      {versionHistory.length > 1 && currentPrescriptionId && (
        <div className="rounded-xl border border-border bg-card p-3 print:hidden">
          <div className="w-full flex items-center justify-between text-xs gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 font-semibold text-muted-foreground tracking-wider hover:text-foreground transition-colors"
            >
              <History className="h-3.5 w-3.5" /> Histórico de versões ({versionHistory.length})
              <span className="text-muted-foreground/70 text-[10px] font-normal">
                {showHistory ? '— ocultar' : '— expandir'}
              </span>
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDiffDialogOpen(true)}
              disabled={versionHistory.length < 2}
              className="h-6 text-[10px] gap-1 px-2"
            >
              <RefreshCw className="h-3 w-3" />
              Comparar versões
            </Button>
          </div>
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

      {/* ===== ACTION TOOLBAR ===== */}
      <div className="flex items-center gap-1 flex-wrap rounded-lg border border-border bg-card/80 px-2 py-1.5 print:hidden">
        <Button variant="ghost" size="sm" onClick={handleNewPrescription} className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2">
          <Plus className="h-3 w-3" /> Nova
        </Button>
        <Button variant="ghost" size="sm" onClick={handleRenew} className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2">
          <RefreshCw className="h-3 w-3" /> Renovar
        </Button>
        <span className="w-px h-4 bg-border/60" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!canPrescribe) { toast.error("Preencha o peso e as alergias antes de prescrever"); return; }
            setExtraPrescriptionOpen(true);
          }}
          className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2"
        >
          <Syringe className="h-3 w-3" /> Extra
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const activeMeds = items.filter(i => i.status === 'active' && !['nutrition', 'care'].includes(i.category));
            if (activeMeds.length < 2) {
              toast.error("Mínimo de 2 medicamentos ativos para verificar interações");
              return;
            }
            setInteractionDialogOpen(true);
          }}
          className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2"
        >
          <Zap className="h-3 w-3" /> Interações
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setAntimicrobialGuideOpen(true)} className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2">
          <Shield className="h-3 w-3" /> Guia ATM
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPsychotropicFormOpen(true)} className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2">
          <FileText className="h-3 w-3" /> Psicotrópicos
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setTevProtocolOpen(true)} className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2">
          <Droplets className="h-3 w-3" /> TEV
        </Button>
        <span className="w-px h-4 bg-border/60" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!allItemsValidated) {
              toast.error("Valide a prescrição antes de imprimir", { description: "Use o botão 'Validar prescrição' para validar com sua senha." });
              return;
            }
            handlePrint();
          }}
          className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2"
        >
          <Printer className="h-3 w-3" /> Imprimir
        </Button>
        <Button
          variant={prescriptionLocked ? "ghost" : "default"}
          size="sm"
          onClick={requestValidateAll}
          disabled={allItemsValidated}
          className={cn(
            "gap-1 text-xs h-7 px-2",
            prescriptionLocked
              ? "text-muted-foreground hover:text-foreground"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
        >
          <ShieldCheck className="h-3 w-3" />
          {allItemsValidated ? "Prescrição validada" : prescriptionLocked ? "Validar pendentes" : "Validar prescrição"}
        </Button>
        {isValidationSessionActive && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Sessão validada · {sessionMinutesLeft}min
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[240px]">
              Sua senha já foi confirmada. Novas validações nos próximos {sessionMinutesLeft} minuto(s) não pedirão senha. A janela é renovada a cada validação.
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCompactView(!compactView)}
              className={cn("gap-1 text-xs h-7 px-2", compactView ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              {compactView ? <AlignJustify className="h-3 w-3" /> : <List className="h-3 w-3" />}
              {compactView ? 'Expandido' : 'Compacto'}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {compactView ? 'Alternar para visualização expandida' : 'Alternar para visualização compacta'}
          </TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="sm" onClick={handleDispense} disabled={!currentPrescriptionId} className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2">
          <Package className="h-3 w-3" /> Dispensar
        </Button>
        <div className="ml-auto">
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 h-7 px-3 text-xs">
            {saving ? <span className="animate-spin h-3 w-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full inline-block" /> : <Save className="h-3 w-3" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* ===== UNIFIED PRESCRIPTION WORKBENCH (itens + histórico + busca) ===== */}
      <div className="rounded-xl border border-border bg-card overflow-hidden print:hidden divide-y divide-border/40">

        {/* Section 2 — Itens summary chips */}
        {items.length > 0 && (
          <div className="px-3 py-2 bg-muted/20">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">Itens:</span>
              {TAB_ORDER.map(cat => {
                const count = itemsByCategory[cat].length;
                if (count === 0) return null;
                const config = CATEGORY_CONFIG[cat];
                const validatedCount = itemsByCategory[cat].filter(i => i.validated && (!isPastRenewalTime || (i.validatedAt && new Date(i.validatedAt) > setSeconds(setMinutes(setHours(startOfDay(new Date()), 5), 0), 0)))).length;
                return (
                  <div key={cat} className="flex items-center gap-1">
                    <Circle className={cn("h-2 w-2 fill-current", validatedCount === count ? "text-emerald-500" : "text-amber-500")} />
                    <span className="text-[10px] text-foreground font-medium">{count} {config.label.toLowerCase()}</span>
                  </div>
                );
              })}
              {!allItemsValidated && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20 ml-auto">
                  Pendente validação
                </Badge>
              )}
              {allItemsValidated && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 ml-auto">
                  ✓ Validada
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Prescrições anteriores agora acessíveis via popup do Calendário no cabeçalho. */}

        {/* Section 4 — Busca global (sem rótulo redundante) */}
        <div className="px-3 py-2">
          <GlobalPrescriptionSearch
            ref={globalSearchRef}
            onAddItem={addItem}
            onAddNonStandard={(name: string) => { setNonStdName(name); addNonStandard(); }}
            getFavoriteCount={getFavoriteCount}
          />
        </div>
      </div>

      {/* ===== SHIFT RENEWAL ALERT (05:00 turnover) ===== */}
      {canPrescribe && (
        <ShiftRenewalAlert
          pendingCount={renewalPendingCount}
          activeCount={activeItemsCount}
          isPastRenewal={isPastRenewalTime}
          onRenewAll={requestValidateAll}
          disabled={!canPrescribe}
        />
      )}

      {/* ===== DISPENSATION HISTORY ===== */}
      {dispensations.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 print:hidden">
          <h2 className="text-xs font-semibold text-muted-foreground tracking-wider mb-2 flex items-center gap-2">
            <Package className="h-3.5 w-3.5" /> Dispensações ({dispensations.length})
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dispensations.map(d => (
              <div key={d.id} className="shrink-0 p-2 rounded-lg border border-border text-xs">
                <div className="font-mono font-bold text-primary">{d.dispensation_code}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(d.dispensed_at), "dd/MM HH:mm", { locale: ptBR })}
                  {d.dispensed_by_name && ` — ${d.dispensed_by_name}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== FULL PRESCRIPTION VIEW (all categories) ===== */}
      <div className={cn("space-y-3 print:hidden", !canPrescribe && "opacity-50 pointer-events-none")}>
        {/* Busca global movida para o workbench unificado acima. */}


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
                    {catItems.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              const allSelected = catItems.every(i => selectedIds.has(i.id));
                              if (allSelected) deselectAllInCategory(cat);
                              else selectAllInCategory(cat);
                            }}
                            className="shrink-0 flex items-center justify-center"
                          >
                            {catItems.every(i => selectedIds.has(i.id)) ? (
                              <CheckSquare className="h-3.5 w-3.5 text-primary" />
                            ) : catItems.some(i => selectedIds.has(i.id)) ? (
                              <Square className="h-3.5 w-3.5 text-primary/60" />
                            ) : (
                              <Square className="h-3.5 w-3.5 text-muted-foreground/50" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {catItems.every(i => selectedIds.has(i.id)) ? 'Desmarcar todos' : `Selecionar todos (${catItems.length})`}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <IconComp className={cn("h-3.5 w-3.5 shrink-0", config.color)} />
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">{config.label}</span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">{catItems.length}</Badge>
                    {compactView && catItems.length > 0 && !isSimpleCategory(cat) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setExpandedCategories(prev => {
                              const n = new Set(prev);
                              if (n.has(cat)) n.delete(cat); else n.add(cat);
                              return n;
                            })}
                            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                          >
                            {expandedCategories.has(cat) ? (
                              <List className="h-3.5 w-3.5" />
                            ) : (
                              <AlignJustify className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {expandedCategories.has(cat) ? 'Compactar categoria' : 'Expandir categoria'}
                        </TooltipContent>
                      </Tooltip>
                    )}
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
                          getFavoriteCount={getFavoriteCount}
                        />
                      )}
                    </div>
                  </div>

                  {/* Care Profiles Panel — only for 'care' category */}
                  {cat === 'care' && (
                    <div className="border-b border-border/50 bg-muted/20 p-3 space-y-3">
                      {/* Profile buttons */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground tracking-wider mb-2">Perfis de Cuidados</p>
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
                        <p className="text-[10px] font-semibold text-muted-foreground tracking-wider mb-1.5">Recomendação Avulsa</p>
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
                          isCompact={compactView && !expandedCategories.has(cat)}
                          selected={selectedIds.has(item.id)}
                          onToggleSelect={toggleSelect}
                          onDuplicate={duplicateItem}
                          onRequestSuspend={requestSuspendItem}
                          onReactivate={reactivateItem}
                          onToggleValidation={requestValidateItem}
                          isPastRenewalTime={isPastRenewalTime}
                          prescriptionLocked={prescriptionLocked}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>

        {posologySuggestion && items.some(i => i.id === posologySuggestion.itemId) && (
          <PosologySuggestionsBar
            medicationName={posologySuggestion.name}
            protocols={posologySuggestion.protocols}
            onApply={(p) => applyPosologyProtocol(posologySuggestion.itemId, p)}
            onDismiss={() => setPosologySuggestion(null)}
          />
        )}

        <BatchActionBar
          selectedCount={selectedIds.size}
          allSelected={items.length > 0 && selectedIds.size === items.length}
          onSelectAll={() => setSelectedIds(new Set(items.map(i => i.id)))}
          onDeselectAll={() => setSelectedIds(new Set())}
          onSuspendSelected={suspendSelected}
          onDeleteSelected={deleteSelected}
          onDuplicateSelected={duplicateSelected}
        />


        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <Pill className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum item na prescrição</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Use a barra de busca acima para adicionar itens</p>
          </div>
        )}
      </div>

      {/* ===== PRINT PORTAL ===== */}
      {showPrintPortal && createPortal(
        <div id="prescription-print-root" style={{ display: 'none' }}>
          <PrintablePrescription
            patient={patient}
            items={items}
            itemsByCategory={itemsByCategory}
            digitalSignature={digitalSignature}
            prescriptionDate={prescriptionDate}
            hospitalName={currentHospital?.name || 'HOSPITAL MUNICIPAL'}
          />
        </div>,
        document.body
      )}

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

      {/* ===== DISPENSATION SLIP DIALOG ===== */}
      <Dialog open={!!dispensationSlip} onOpenChange={(o) => !o && setDispensationSlip(null)}>
        <DialogContent className="max-w-md print:max-w-none print:border-0 print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Guia de Dispensação
            </DialogTitle>
            <DialogDescription>
              Dispensação registrada com sucesso. Imprima a guia abaixo.
            </DialogDescription>
          </DialogHeader>
          {dispensationSlip && (
            <div className="border border-border rounded-lg p-4 space-y-3" id="dispensation-slip">
              <div className="text-center border-b border-border pb-2">
                <div className="text-xs font-bold tracking-wider uppercase text-foreground">Guia de Dispensação Farmacêutica</div>
                <div className="font-mono text-lg font-extrabold text-primary mt-1">{dispensationSlip.code}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-muted-foreground">Paciente:</span> <span className="font-semibold text-foreground">{dispensationSlip.patientName}</span></div>
                <div><span className="text-muted-foreground">Leito:</span> <span className="font-semibold text-foreground">{dispensationSlip.bed}</span></div>
                <div><span className="text-muted-foreground">Data/Hora:</span> <span className="font-medium text-foreground">{dispensationSlip.date}</span></div>
                {patient.encounterCode && <div><span className="text-muted-foreground">Atendimento:</span> <span className="font-mono font-medium text-foreground">{patient.encounterCode}</span></div>}
              </div>
              <div className="border-t border-border pt-2">
                <div className="text-[10px] font-semibold text-muted-foreground tracking-wider mb-1.5">ITENS DISPENSADOS ({dispensationSlip.items.length})</div>
                <div className="space-y-1">
                  {dispensationSlip.items.map((item, i) => (
                    <div key={item.id} className="flex items-start gap-2 text-xs py-0.5 border-b border-border/30 last:border-0">
                      <span className="font-mono text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">{item.name}</span>
                        {item.presentation && item.presentation !== '-' && (
                          <span className="text-muted-foreground ml-1">({item.presentation})</span>
                        )}
                        <span className="text-muted-foreground ml-1">
                          — {item.quantity || '1'} {item.quantityUnit || 'un'}
                          {item.dose && item.dose !== '-' ? ` · ${item.dose}` : ''}
                          {item.route && item.route !== '-' ? ` · ${item.route}` : ''}
                          {item.posology && item.posology !== '-' ? ` · ${item.posology}` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border text-[10px] text-muted-foreground">
                <span>Dispensado por: {user?.email?.split('@')[0] || '—'}</span>
                <span>BigHelp Map · Dispensação Digital</span>
              </div>
            </div>
          )}
          <DialogFooter className="print:hidden">
            <Button variant="outline" size="sm" onClick={() => setDispensationSlip(null)}>Fechar</Button>
            <Button size="sm" onClick={() => {
              const el = document.getElementById('dispensation-slip');
              if (el) {
                const printW = window.open('', '_blank', 'width=400,height=600');
                if (printW) {
                  printW.document.write(`<html><head><title>Guia ${dispensationSlip?.code}</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:12px;font-size:11px;color:#0f172a}*{margin:0;padding:0;box-sizing:border-box}.slip{border:1px solid #cbd5e1;border-radius:6px;padding:12px}.center{text-align:center}.mono{font-family:monospace}.bold{font-weight:700}.code{font-size:18px;font-weight:800;margin:4px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px}.sep{border-top:1px solid #e2e8f0;padding-top:6px;margin-top:6px}.item{display:flex;gap:6px;padding:2px 0;border-bottom:1px solid #f1f5f9}.muted{color:#64748b}.footer{display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}</style></head><body>`);
                  printW.document.write('<div class="slip">');
                  printW.document.write(`<div class="center"><div class="bold" style="text-transform:uppercase;letter-spacing:1px;font-size:9px">Guia de Dispensação Farmacêutica</div><div class="mono code">${dispensationSlip?.code}</div></div>`);
                  printW.document.write('<div class="sep grid">');
                  printW.document.write(`<div><span class="muted">Paciente:</span> <strong>${dispensationSlip?.patientName}</strong></div>`);
                  printW.document.write(`<div><span class="muted">Leito:</span> <strong>${dispensationSlip?.bed}</strong></div>`);
                  printW.document.write(`<div><span class="muted">Data:</span> ${dispensationSlip?.date}</div>`);
                  if (patient.encounterCode) printW.document.write(`<div><span class="muted">Atend:</span> <span class="mono">${patient.encounterCode}</span></div>`);
                  printW.document.write('</div>');
                  printW.document.write('<div class="sep"><div class="bold" style="font-size:9px;letter-spacing:1px;margin-bottom:4px">ITENS DISPENSADOS</div>');
                  dispensationSlip?.items.forEach((item, i) => {
                    printW.document.write(`<div class="item"><span class="mono muted" style="width:16px;text-align:right">${i+1}.</span><div><strong>${item.name}</strong>${item.presentation && item.presentation !== '-' ? ` (${item.presentation})` : ''} — ${item.quantity||'1'} ${item.quantityUnit||'un'}${item.dose && item.dose !== '-' ? ` · ${item.dose}` : ''}${item.route && item.route !== '-' ? ` · ${item.route}` : ''}</div></div>`);
                  });
                  printW.document.write('</div>');
                  printW.document.write(`<div class="sep footer"><span>Dispensado por: ${user?.email?.split('@')[0] || '—'}</span><span>BigHelp Map</span></div>`);
                  printW.document.write('</div></body></html>');
                  printW.document.close();
                  printW.print();
                }
              }
            }} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Imprimir Guia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extra Prescription Dialog */}
      <ExtraPrescriptionDialog
        open={extraPrescriptionOpen}
        onClose={() => setExtraPrescriptionOpen(false)}
        onAddItems={(newItems) => {
          setItems(prev => [...prev, ...newItems]);
          const agoraCount = newItems.filter(i => i.flags.includes('ag' as PrescriptionFlag)).length;
          const scheduledCount = newItems.length - agoraCount;
          toast.success(`${newItems.length} item(ns) extra adicionado(s)`, {
            description: agoraCount > 0
              ? `${agoraCount} "Agora" (não renovam)${scheduledCount > 0 ? ` + ${scheduledCount} de horário (renovam)` : ''}`
              : `${scheduledCount} de horário (serão incorporados na renovação)`,
          });
        }}
        allMedications={Object.values(ALL_ITEMS_BY_CATEGORY).flat()}
      />

      {/* Antimicrobial Guide Dialog */}
      <AntimicrobialGuideDialog
        open={antimicrobialGuideOpen}
        onOpenChange={(open) => {
          setAntimicrobialGuideOpen(open);
          if (!open) setPendingAntimicrobialMed(null);
        }}
        patient={patient}
        antimicrobialItems={
          pendingAntimicrobialMed
            ? [{ id: 'pending', name: pendingAntimicrobialMed.name, dose: pendingAntimicrobialMed.defaultDose, route: pendingAntimicrobialMed.defaultRoute, posology: pendingAntimicrobialMed.defaultPosology, category: 'antimicrobial', status: 'active' }]
            : items.filter(i => i.category === 'antimicrobial').map(i => ({ id: i.id, name: i.name, dose: i.dose, route: i.route, posology: i.posology, category: i.category, status: i.status }))
        }
        doctorName={digitalSignature?.doctorName}
        doctorCrm={digitalSignature?.crm}
        hospitalName={currentHospital?.name}
        onConfirm={handleAntimicrobialConfirm}
        mode={pendingAntimicrobialMed ? 'prescribe' : 'review'}
        patientId={searchParams.get('patientId') || undefined}
      />

      {/* Psychotropic Form Dialog */}
      <PsychotropicFormDialog
        open={psychotropicFormOpen}
        onOpenChange={setPsychotropicFormOpen}
        patient={patient}
        controlledItems={items.filter(i => i.status === 'active' && (i.category === 'high_alert' || isPsychotropicMedication(i.name))).map(i => ({ id: i.id, name: i.name, dose: i.dose, route: i.route, posology: i.posology, category: i.category, status: i.status, highAlert: i.highAlert }))}
        doctorName={digitalSignature?.doctorName}
        doctorCrm={digitalSignature?.crm}
        hospitalName={currentHospital?.name}
      />

      {/* TEV Protocol Dialog */}
      <TevProtocolDialog
        open={tevProtocolOpen}
        onOpenChange={setTevProtocolOpen}
        patient={patient ? { name: patient.name, age: patient.age, bed: patient.bed, weight: patient.weight } : null}
      />

      {/* Quick Templates Dialog */}
      <Dialog open={quickTemplatesDialogOpen} onOpenChange={setQuickTemplatesDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-amber-500" />
              Templates de Prescrição Rápida
            </DialogTitle>
            <DialogDescription className="text-xs">
              Aplique combinações clínicas pré-definidas com 1 clique. Templates compartilhados ficam disponíveis para todo o hospital.
            </DialogDescription>
          </DialogHeader>

          {/* Filters + actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={templateSearchQuery}
                onChange={(e) => setTemplateSearchQuery(e.target.value)}
                placeholder="Buscar template (sepse, pós-op, DPOC...)"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["all", "shared", "personal"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTemplateScopeFilter(s)}
                  className={cn(
                    "text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all",
                    templateScopeFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60"
                  )}
                >
                  {s === "all" ? "Todos" : s === "shared" ? "Compartilhados" : "Meus"}
                </button>
              ))}
            </div>
            <Button
              variant="default"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => {
                if (items.length === 0) {
                  toast.error("Adicione itens à prescrição antes de salvar como template");
                  return;
                }
                setSaveTemplateDialogOpen(true);
              }}
            >
              <Save className="h-3.5 w-3.5" />
              Salvar atual como template
            </Button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-2 mt-1">
            {quickTemplatesLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Carregando templates...
              </div>
            ) : (() => {
              const q = templateSearchQuery.toLowerCase().trim();
              const filtered = quickTemplates.filter((t) => {
                if (templateScopeFilter !== "all" && t.scope !== templateScopeFilter) return false;
                if (!q) return true;
                return (
                  t.name.toLowerCase().includes(q) ||
                  (t.description || "").toLowerCase().includes(q) ||
                  t.clinical_category.toLowerCase().includes(q) ||
                  t.items.some((i) => (i.name || "").toLowerCase().includes(q))
                );
              });
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhum template encontrado.
                  </div>
                );
              }
              return filtered.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-foreground">{tpl.name}</h4>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                          {tpl.clinical_category}
                        </Badge>
                        <Badge
                          variant={tpl.scope === "shared" ? "secondary" : "outline"}
                          className="text-[9px] px-1.5 py-0 h-4"
                        >
                          {tpl.scope === "shared" ? "Hospital" : "Pessoal"}
                        </Badge>
                        {tpl.use_count > 0 && (
                          <span className="text-[9px] text-muted-foreground">
                            usado {tpl.use_count}x
                          </span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {tpl.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {tpl.items.slice(0, 6).map((it, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-foreground border border-border/50"
                          >
                            {it.name}
                            {it.dose ? ` · ${it.dose}` : ""}
                          </span>
                        ))}
                        {tpl.items.length > 6 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">
                            +{tpl.items.length - 6}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => applyQuickTemplate(tpl)}
                      >
                        <Plus className="h-3 w-3" /> Aplicar
                      </Button>
                      {tpl.created_by === user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-destructive hover:text-destructive"
                          onClick={() => deleteQuickTemplate(tpl.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Current as Template Dialog */}
      <SaveTemplateDialog
        open={saveTemplateDialogOpen}
        onOpenChange={setSaveTemplateDialogOpen}
        currentItems={items}
        hospitalUnitId={currentHospital?.id || null}
        stateId={currentState?.id || null}
        onSave={async (input) => {
          const ok = await saveQuickTemplate(input);
          if (ok) setSaveTemplateDialogOpen(false);
        }}
      />

      {/* Dose Calculator Dialog (peso/SC) */}
      <DoseCalculatorDialog
        open={doseCalcOpen}
        onClose={() => setDoseCalcOpen(false)}
        initialMedication={doseCalcInitialMed}
        initialWeight={patient.weight}
        onApply={applyDoseCalculatorResult}
      />

      {/* Keyboard Shortcuts Help Dialog */}
      <Dialog open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" />
              Atalhos de teclado · Prescrição
            </DialogTitle>
            <DialogDescription className="text-xs">
              Use atalhos para agilizar o fluxo. Funcionam em qualquer lugar da página.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              { keys: ["Ctrl/⌘", "K"], desc: "Focar na busca de itens" },
              { keys: ["/"], desc: "Focar na busca (alternativa)" },
              { keys: ["Ctrl/⌘", "D"], desc: "Duplicar itens selecionados" },
              { keys: ["Ctrl/⌘", "Y"], desc: "Repetir prescrição anterior" },
              { keys: ["Ctrl/⌘", "Enter"], desc: "Validar prescrição" },
              { keys: ["Esc"], desc: "Fechar diálogos" },
              { keys: ["?"], desc: "Mostrar este painel" },
            ].map((s) => (
              <div key={s.desc} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-accent/40 transition-colors">
                <span className="text-sm text-foreground">{s.desc}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded border border-border bg-muted text-[11px] font-mono font-medium text-muted-foreground shadow-sm">
                        {k}
                      </kbd>
                      {i < s.keys.length - 1 && <span className="text-muted-foreground text-xs">+</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-1">
            Atalhos não disparam enquanto você digita em campos de texto (exceto <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Ctrl/⌘+K</kbd>).
          </p>
        </DialogContent>
      </Dialog>

      {/* Repeat Previous Prescription Dialog */}
      <Dialog open={repeatDialogOpen} onOpenChange={setRepeatDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CopyPlus className="h-5 w-5 text-primary" />
              Repetir prescrição anterior
            </DialogTitle>
            <DialogDescription>
              {repeatLoading
                ? "Buscando última prescrição do paciente..."
                : repeatSourceMeta
                  ? `Última prescrição encontrada: v${repeatSourceMeta.version} — ${repeatSourceMeta.date}. Selecione os itens que deseja repetir.`
                  : "Nenhuma prescrição anterior encontrada para este paciente."}
            </DialogDescription>
          </DialogHeader>

          {repeatLoading ? (
            <div className="flex-1 flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : repeatSourceItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Não há itens ativos em prescrições anteriores deste paciente.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="repeat-select-all"
                    checked={repeatSelectedIds.size === repeatSourceItems.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setRepeatSelectedIds(new Set(repeatSourceItems.map(i => i.id)));
                      } else {
                        setRepeatSelectedIds(new Set());
                      }
                    }}
                  />
                  <label htmlFor="repeat-select-all" className="text-xs font-medium cursor-pointer">
                    Selecionar todos ({repeatSelectedIds.size}/{repeatSourceItems.length})
                  </label>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Itens copiados sem validação — você revalida no fluxo padrão
                </span>
              </div>

              <div className="flex-1 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {repeatSourceItems.map(item => {
                  const checked = repeatSelectedIds.has(item.id);
                  const catConfig = CATEGORY_CONFIG[item.category];
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/40 transition-colors",
                        checked && "bg-primary/5"
                      )}
                      onClick={() => {
                        setRepeatSelectedIds(prev => {
                          const n = new Set(prev);
                          if (n.has(item.id)) n.delete(item.id);
                          else n.add(item.id);
                          return n;
                        });
                      }}
                    >
                      <Checkbox checked={checked} className="mt-0.5" onClick={(e) => e.stopPropagation()} onCheckedChange={() => {
                        setRepeatSelectedIds(prev => {
                          const n = new Set(prev);
                          if (n.has(item.id)) n.delete(item.id);
                          else n.add(item.id);
                          return n;
                        });
                      }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {catConfig && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                              {catConfig.label}
                            </Badge>
                          )}
                          <span className="text-sm font-semibold text-foreground">{item.name}</span>
                          {item.highAlert && (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1.5 gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" /> Alta vigilância
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          {item.presentation && <span>{item.presentation}</span>}
                          {item.dose && <span>· {item.dose}</span>}
                          {item.route && <span>· {item.route}</span>}
                          {item.posology && <span>· {item.posology}</span>}
                        </div>
                        {item.instructions && (
                          <div className="text-[10px] text-muted-foreground/80 mt-1 italic line-clamp-2">
                            {item.instructions}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRepeatDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={applyRepeatedItems}
              disabled={repeatLoading || repeatSelectedIds.size === 0}
              className="gap-2"
            >
              <CopyPlus className="h-4 w-4" />
              Adicionar {repeatSelectedIds.size > 0 ? `${repeatSelectedIds.size} item(ns)` : ''} à prescrição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Confirmation Dialog (validação) */}
      <PasswordConfirmDialog
        open={passwordConfirmOpen}
        onOpenChange={(open) => {
          setPasswordConfirmOpen(open);
          if (!open) setPendingValidationAction(null);
        }}
        title={pendingValidationAction?.type === 'all' ? "Validar prescrição" : "Validar item"}
        description={
          pendingValidationAction?.type === 'all'
            ? "Confirme sua senha para validar todos os itens ativos da prescrição."
            : "Este item foi adicionado após a validação. Confirme sua senha para validá-lo."
        }
        actionLabel="Validar"
        onConfirmed={executeValidation}
      />

      {/* Pre-Validation Clinical Alerts (alergia, interação grave, duplicidade) */}
      <PreValidationAlertDialog
        open={alertDialogOpen}
        alerts={pendingAlerts}
        scopeLabel={pendingValidationAction?.type === 'all' ? 'na prescrição' : 'neste item'}
        onCancel={handleAlertCancelled}
        onConfirm={handleAlertAcknowledged}
      />

      {/* Diff visual entre versões da prescrição */}
      <PrescriptionDiffDialog
        open={diffDialogOpen}
        onOpenChange={setDiffDialogOpen}
        versions={versionHistory}
        defaultRightId={currentPrescriptionId ?? undefined}
      />
      </div>
        <PatientCockpit patient={cockpitPatient} className="print:hidden" />
      </div>
    </div>
  );
};

// === PRINTABLE PRESCRIPTION (portal-based, ATM guide aesthetic) ===
function PrintablePrescription({ patient, items, itemsByCategory, digitalSignature, prescriptionDate, hospitalName }: {
  patient: PatientHeader;
  items: PrescriptionItem[];
  itemsByCategory: Record<PrescriptionCategory, PrescriptionItem[]>;
  digitalSignature: DigitalSignature | null;
  prescriptionDate: string;
  hospitalName: string;
}) {
  const cellStyle: React.CSSProperties = { border: '0.5px solid #94a3b8', padding: '3px 6px', fontSize: '7.5pt', lineHeight: 1.3, verticalAlign: 'top' };
  const headerCellStyle: React.CSSProperties = { ...cellStyle, fontWeight: 700, fontSize: '6.5pt', backgroundColor: '#f1f5f9', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3px' };
  const sectionStyle: React.CSSProperties = { fontWeight: 800, fontSize: '7pt', backgroundColor: '#0c4a6e', color: '#fff', textAlign: 'center', letterSpacing: '0.5px', padding: '4px 6px', border: '0.5px solid #0c4a6e' };
  const thStyle: React.CSSProperties = { backgroundColor: '#0c4a6e', color: '#fff', padding: '5px 6px', fontSize: '7pt', fontWeight: 700, textAlign: 'left', letterSpacing: '0.5px', border: '0.5px solid #0c4a6e' };

  const isSimple = (cat: PrescriptionCategory) => ['nutrition', 'care'].includes(cat);

  const docCode = generatePrintDocCode("PRESC");

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#1e293b', width: '186mm', margin: '0 auto', lineHeight: 1.3 }}>
      {/* Cabeçalho institucional Norma Zero (MAN.05-001) */}
      <NormaZeroPrintHeader
        documentLabel="Prescrição Médica Diária"
        documentCode={docCode}
        documentSubtitle={prescriptionDate}
        width="186mm"
      />

      {/* Patient Data — compact with allergy inline */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5px' }}>
        <tbody>
          <tr>
            <td style={headerCellStyle}>Paciente</td>
            <td style={{ ...cellStyle, fontWeight: 800, fontSize: '8.5pt' }} colSpan={3}>{patient.name || '—'}</td>
            <td style={headerCellStyle}>Leito</td>
            <td style={{ ...cellStyle, fontWeight: 700 }}>{patient.bed || '—'}</td>
            <td style={headerCellStyle}>Prontuário</td>
            <td style={{ ...cellStyle, fontWeight: 700 }}>{patient.record || '—'}</td>
          </tr>
          <tr>
            <td style={headerCellStyle}>Idade</td>
            <td style={cellStyle}>{patient.age || '—'}</td>
            <td style={headerCellStyle}>Peso</td>
            <td style={cellStyle}>{patient.weight ? `${patient.weight}kg` : '—'}</td>
            <td style={headerCellStyle}>Sexo</td>
            <td style={cellStyle}>{patient.sex ? (patient.sex.toLowerCase().startsWith('m') ? 'M' : 'F') : '—'}</td>
            <td style={headerCellStyle}>Admissão</td>
            <td style={cellStyle}>{patient.admissionDate ? format(new Date(patient.admissionDate + 'T12:00:00'), 'dd/MM/yyyy') : '—'}</td>
          </tr>
          <tr>
            <td style={headerCellStyle}>Nascimento</td>
            <td style={cellStyle}>{patient.birthDate ? format(new Date(patient.birthDate + 'T12:00:00'), 'dd/MM/yyyy') : '—'}</td>
            <td style={headerCellStyle}>Unidade</td>
            <td style={cellStyle}>{patient.unit || '—'}</td>
            <td style={headerCellStyle}>Atendimento</td>
            <td style={cellStyle}>{patient.encounterCode ? `#${patient.encounterCode}` : '—'}</td>
            <td style={{ ...headerCellStyle, color: '#dc2626', fontSize: '6pt' }}>⚠ ALERGIAS</td>
            <td style={{ ...cellStyle, fontWeight: 700, color: '#991b1b', fontSize: '7.5pt', backgroundColor: '#fef2f2' }}>{patient.allergies || 'NDAM'}</td>
          </tr>
          {patient.motherName && (
            <tr>
              <td style={headerCellStyle}>Mãe</td>
              <td style={cellStyle} colSpan={7}>{patient.motherName || '—'}</td>
            </tr>
          )}
          {patient.address && (
            <tr>
              <td style={headerCellStyle}>Endereço</td>
              <td style={{ ...cellStyle, fontSize: '7pt', lineHeight: 1.4 }} colSpan={7}>
                {patient.address}{patient.city ? ` — ${patient.city}` : ''}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Risk Classification Summary */}
      {(patient.chiefComplaint || patient.vitalSigns) && (
        <div style={{ padding: '3px 8px', backgroundColor: '#f8fafc', border: '0.5px solid #e2e8f0', marginBottom: '5px', borderLeft: '2px solid #0c4a6e' }}>
          <div style={{ fontSize: '6pt', fontWeight: 800, color: '#0c4a6e', letterSpacing: '0.5px', marginBottom: '1px' }}>
            CLASSIFICAÇÃO DE RISCO{patient.riskClassification ? ` — ${patient.riskClassification.toUpperCase()}` : ''}
          </div>
          {patient.chiefComplaint && (
            <div style={{ fontSize: '7pt', color: '#1e293b', lineHeight: 1.3 }}>
              <span style={{ fontWeight: 700 }}>QP:</span> {patient.chiefComplaint}
            </div>
          )}
          {patient.vitalSigns && (
            <div style={{ fontSize: '6.5pt', color: '#475569', lineHeight: 1.3, marginTop: '1px' }}>
              <span style={{ fontWeight: 700 }}>Sinais Vitais:</span> {patient.vitalSigns}
            </div>
          )}
        </div>
      )}

      {/* Prescription Items — Lista contínua sem subtítulos de categoria (Cuidados separados ao final) */}
      {(() => {
        // Itens contínuos seguindo TAB_ORDER, EXCETO 'care' (vai à parte ao final)
        const continuousItems: PrescriptionItem[] = TAB_ORDER
          .filter(cat => cat !== 'care')
          .flatMap(cat => itemsByCategory[cat].filter(i => i.status === 'active'));
        const careItems = itemsByCategory['care'].filter(i => i.status === 'active');

        const renderItemRow = (item: PrescriptionItem, displayIndex: number, rowBg: string) => {
          const hasPreparo = item.diluent || item.diluentVolume || item.accessType || item.infusionTime;
          const slots = parseScheduleSlots(item.schedule);
          return (
            <tr key={item.id} style={{ pageBreakInside: 'avoid' }}>
              <td style={{ ...cellStyle, width: '22px', textAlign: 'center', backgroundColor: rowBg, verticalAlign: 'top', color: '#64748b', fontSize: '7pt', fontWeight: 700 }}>
                {displayIndex}
              </td>
              <td style={{ ...cellStyle, backgroundColor: rowBg }}>
                <div style={{ fontSize: '7.5pt', lineHeight: 1.4, color: '#1e293b' }}>
                  <span style={{ fontWeight: 800 }}>{item.name}</span>
                  {item.presentation && item.presentation !== '-' && (
                    <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '7pt' }}> ({item.presentation})</span>
                  )}
                  {item.quantity && item.quantityUnit && (
                    <span style={{ fontWeight: 600, color: '#475569', fontSize: '7pt' }}> — {item.quantity} {item.quantityUnit}</span>
                  )}
                </div>
                <div style={{ fontSize: '7pt', color: '#475569', lineHeight: 1.3, marginTop: '1px' }}>
                  {[
                    item.dose && item.dose !== '-' ? item.dose : null,
                    item.route && item.route !== '-' ? item.route : null,
                    item.posology && item.posology !== '-' ? item.posology : null,
                  ].filter(Boolean).join(' · ')}
                  {item.flags.length > 0 && (
                    <span style={{ fontSize: '6pt', fontWeight: 700, marginLeft: '4px', color: '#fff', backgroundColor: '#334155', padding: '0.5px 4px', borderRadius: '2px', letterSpacing: '0.3px' }}>{item.flags.join(', ').toUpperCase()}</span>
                  )}
                  {item.isExtra && (
                    <span style={{ fontSize: '5.5pt', fontWeight: 700, marginLeft: '3px', color: '#ea580c', backgroundColor: '#fff7ed', padding: '0.5px 4px', borderRadius: '2px', border: '0.5px solid #fed7aa' }}>EXTRA</span>
                  )}
                  {item.status === 'suspended' && (
                    <span style={{ fontSize: '6pt', fontWeight: 700, color: '#fff', backgroundColor: '#dc2626', padding: '0.5px 4px', borderRadius: '2px', marginLeft: '3px' }}>SUSPENSO</span>
                  )}
                </div>
                {hasPreparo && (
                  <div style={{ fontSize: '6.5pt', color: '#94a3b8', lineHeight: 1.2, marginTop: '2px', paddingLeft: '8px', borderLeft: '1.5px solid #e2e8f0' }}>
                    {[
                      item.diluent && item.diluent !== '-' && item.diluent !== 'sem_diluente' ? `${item.diluent}${item.diluentVolume ? ` ${item.diluentVolume}mL` : ''}` : item.diluent === 'sem_diluente' ? 'Sem diluição' : null,
                      item.accessType && item.accessType !== '-' ? item.accessType : null,
                      item.volumeTotal ? `Vol total: ${item.volumeTotal}mL` : null,
                      item.infusionTime ? `Correr em ${item.infusionTime}${(item.infusionTimeUnit || 'min') === 'h' ? 'h' : 'min'}` : null,
                      item.infusionRate ? `${item.infusionRate} ${item.infusionMode === 'gts' ? 'gts/min' : 'mL/h'}` : null,
                      item.concentration ? `Conc: ${item.concentration}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
                {item.instructions && !hasPreparo && (
                  <div style={{ fontSize: '6.5pt', color: '#94a3b8', lineHeight: 1.2, marginTop: '2px', paddingLeft: '8px', borderLeft: '1.5px solid #e2e8f0' }}>
                    {item.instructions}
                  </div>
                )}
              </td>
              <td style={{ ...cellStyle, width: '140px', textAlign: 'center', verticalAlign: 'middle', fontFamily: 'monospace', fontSize: '7pt', fontWeight: 700, color: '#0c4a6e', backgroundColor: rowBg, whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>
                {slots.length > 0 ? slots.join('  ') : '—'}
              </td>
            </tr>
          );
        };

        return (
          <>
            {continuousItems.length > 0 && (
              <div style={{ marginBottom: '3px', pageBreakInside: 'avoid' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <td style={{ ...thStyle, width: '22px', textAlign: 'center', fontSize: '6pt' }}>Nº</td>
                      <td style={thStyle}>Descrição</td>
                      <td style={{ ...thStyle, width: '140px', textAlign: 'center', fontSize: '6.5pt' }}>Aprazamento</td>
                    </tr>
                  </thead>
                  <tbody>
                    {continuousItems.map((item, idx) => renderItemRow(item, idx + 1, idx % 2 === 0 ? '#ffffff' : '#fafbfc'))}
                  </tbody>
                </table>
              </div>
            )}

            {careItems.length > 0 && (
              <div style={{ marginTop: '8px', marginBottom: '3px', pageBreakInside: 'avoid' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <td style={sectionStyle} colSpan={2}>
                        CUIDADOS ({careItems.length})
                      </td>
                    </tr>
                  </thead>
                  <tbody>
                    {careItems.map((item, i) => {
                      const rowBg = i % 2 === 0 ? '#ffffff' : '#fafbfc';
                      return (
                        <tr key={item.id} style={{ pageBreakInside: 'avoid' }}>
                          <td style={{ ...cellStyle, width: '22px', textAlign: 'center', backgroundColor: rowBg, color: '#64748b', fontSize: '7pt', fontWeight: 700 }}>
                            {i + 1}
                          </td>
                          <td style={{ ...cellStyle, backgroundColor: rowBg }}>
                            <span style={{ fontWeight: 700, fontSize: '7.5pt' }}>{item.name}</span>
                            {item.dose && item.dose !== '-' && <span style={{ color: '#475569', fontWeight: 500, fontSize: '7pt' }}> — {item.dose}</span>}
                            {item.posology && item.posology !== '-' && <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '7pt' }}> — {item.posology}</span>}
                            {item.instructions && (
                              <div style={{ fontSize: '6.5pt', color: '#94a3b8', lineHeight: 1.2, marginTop: '2px', paddingLeft: '8px', borderLeft: '1.5px solid #e2e8f0' }}>
                                {item.instructions}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      })()}

      {/* Signature */}
      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', gap: '20px', pageBreakInside: 'avoid' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          {digitalSignature ? (
            <div style={{ border: '1.5px solid #0c4a6e', borderRadius: '6px', padding: '8px 16px', display: 'inline-block', backgroundColor: '#f0f9ff' }}>
              <div style={{ fontSize: '7pt', fontWeight: 800, color: '#0c4a6e', letterSpacing: '1px' }}>✓ ASSINADO DIGITALMENTE</div>
              <div style={{ fontSize: '8pt', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>{digitalSignature.doctorName}</div>
              <div style={{ fontSize: '6.5pt', color: '#475569', marginTop: '1px' }}>CRM: {digitalSignature.crm} · {digitalSignature.signedAt}</div>
              <div style={{ fontSize: '5pt', color: '#94a3b8', fontFamily: 'monospace', marginTop: '3px', borderTop: '0.5px solid #e2e8f0', paddingTop: '2px' }}>Hash: {digitalSignature.hash}</div>
            </div>
          ) : (
            <div style={{ paddingTop: '14px' }}>
              <div style={{ width: '200px', borderBottom: '1.5px solid #0f172a', margin: '0 auto 4px auto' }} />
              <div style={{ fontSize: '7pt', fontWeight: 700 }}>Assinatura / Carimbo do Médico</div>
              <div style={{ fontSize: '6.5pt', color: '#64748b' }}>CRM: _______________</div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, textAlign: 'center', paddingTop: '14px' }}>
          <div style={{ width: '200px', borderBottom: '1.5px solid #0f172a', margin: '0 auto 4px auto' }} />
          <div style={{ fontSize: '7pt', fontWeight: 700 }}>Enfermeiro(a) Responsável</div>
          <div style={{ fontSize: '6.5pt', color: '#64748b' }}>COREN: _______________</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', paddingTop: '14px' }}>
          <div style={{ width: '200px', borderBottom: '1.5px solid #0f172a', margin: '0 auto 4px auto' }} />
          <div style={{ fontSize: '7pt', fontWeight: 700 }}>Farmacêutico</div>
          <div style={{ fontSize: '6.5pt', color: '#64748b' }}>CRF: _______________</div>
        </div>
      </div>

      {/* Rodapé Norma Zero (MAN.05-001) */}
      <NormaZeroPrintFooter width="186mm" />
    </div>
  );
}

export default PrescricaoPage;
