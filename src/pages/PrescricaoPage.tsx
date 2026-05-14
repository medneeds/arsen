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
  ClipboardList, X, Check, Shield, Wind, TestTube, FileText, FlaskConical,
  GripVertical, CheckSquare, Square, Pause, MoreHorizontal,
  Play, CopyPlus, Lock, Eye, EyeOff, ShieldCheck, Fingerprint,
  Zap, Loader2, CalendarDays, Circle, RotateCw, Package, Hash, Heart, List, AlignJustify, ChevronUp, Wand2,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSidebar } from "@/components/ui/sidebar";
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
import { cn, asUuidOrNull } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";
import { ShiftRenewalAlert } from "@/components/ShiftRenewalAlert";
import { PrescriptionDiffDialog } from "@/components/PrescriptionDiffDialog";
import { NewPrescriptionChoiceDialog } from "@/components/NewPrescriptionChoiceDialog";
import { ExtraPrescriptionChooserDialog } from "@/components/ExtraPrescriptionChooserDialog";
import { printExtraPrescription } from "@/lib/printExtraPrescription";
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
  routeShort,
  POSOLOGIES,
  CARE_OPTIONS,
  CARE_PROFILES,
  type CareProfile,
  type MedicationEntry,
  type PrescriptionCategory,
  type PrescriptionFlag,
} from "@/data/medicationsDatabase";
import {
  inferPresentationType,
  getRequiredFields,
  showInfusionBlock,
  showDiluentRow,
  getEvidenceSuggestion,
  type PresentationType,
} from "@/lib/prescriptionPresentation";
import { findRegulatoryInfo } from "@/data/mavPort344Catalog";
import { InhalationFields } from "@/components/prescription/InhalationFields";
import { getInhalationDefaults, type InhalationMode, type InhalationInterface } from "@/data/inhalationCatalog";
import { assembleInhalationInstruction } from "@/lib/inhalationInstruction";
import { getReconstitutionDefault } from "@/lib/ivMedicationFlags";
import { getInfusionProfile, applyInfusionProfileDefaults } from "@/lib/ivInfusionProfiles";
import { MedicationFlagChips } from "@/components/MedicationFlagChips";
import { AntimicrobialGuideDialog } from "@/components/AntimicrobialGuideDialog";
import { AtmStatusDialog } from "@/components/AtmStatusDialog";
import { useUnifiedMedicationCatalog } from "@/hooks/useUnifiedMedicationCatalog";
import { PsychotropicFormDialog, isPsychotropicMedication } from "@/components/PsychotropicFormDialog";
import { usePatientCid } from "@/hooks/usePatientCid";
import { TevProtocolDialog } from "@/components/TevProtocolDialog";
import { HighAlertGuideDialog } from "@/components/HighAlertGuideDialog";
import { InsulinTherapyDialog } from "@/components/prescription/InsulinTherapyDialog";
import { isInsulinMedication, describeInsulinPlan, type InsulinPlan } from "@/lib/insulinTherapy";
import { fuzzySearch } from "@/lib/fuzzySearch";
import { useMedicationFavorites } from "@/hooks/useMedicationFavorites";
import { useQuickPrescriptionTemplates, type QuickPrescriptionTemplate, type QuickTemplateItem } from "@/hooks/useQuickPrescriptionTemplates";
import { SaveTemplateDialog } from "@/components/SaveTemplateDialog";
import { CareCatalogDialog } from "@/components/CareCatalogDialog";
import { DoseCalculatorDialog, type DoseCalculatorResult } from "@/components/DoseCalculatorDialog";
import { PreValidationAlertDialog } from "@/components/PreValidationAlertDialog";
import { runClinicalAlertChecks, type ClinicalAlert } from "@/lib/clinicalAlertChecks";
import { Star, Calculator, Sparkles, Pencil } from "lucide-react";
import { getProtocolsFor, type PosologyProtocol } from "@/lib/posologyProtocols";
import { PosologySuggestionsBar } from "@/components/PosologySuggestionsBar";
import { useMedicationProtocols } from "@/hooks/useMedicationProtocols";
import { PatientCockpit } from "@/components/PatientCockpit";
import { AllergiesChipInput } from "@/components/AllergiesChipInput";
import { SapsPendingAlert } from "@/components/SapsPendingAlert";
import { NutritionWizard } from "@/components/NutritionWizard";
import { HydrationWizard } from "@/components/HydrationWizard";
import { ReplacementWizard } from "@/components/ReplacementWizard";
import { ItemAssistantWizard, type AssistantPatch } from "@/components/ItemAssistantWizard";
import type { Patient } from "@/types/patient";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";

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
  // === Diferenciação regulatória (MAV / Portaria 344) ===
  securityCategory?: 'MAV' | 'PORT_344' | 'MAV_PORT_344';
  controlled?: boolean;        // Portaria 344/98
  controlledList?: 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'C1' | null;
  controlledDoc?: 'Receita Amarela' | 'Receita Azul' | 'Receita Especial' | 'Controle Especial 2 vias' | null;
  doubleCheck?: boolean;       // Exige dupla checagem (MAV)
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
  // Nutrition-specific optional fields
  nutritionType?: 'diet_enteral' | 'diet_oral' | 'water' | 'npt' | 'zero';
  nutVolDay?: string;         // Volume total / dia (mL)
  nutMode?: string;           // Contínua BIC / Gravitacional intermitente / Bolus / Bomba ciclada / VO fracionada
  nutFraction?: string;       // Fracionamento / horários
  nutNightPause?: string;     // Pausa noturna / repouso digestivo
  nutProgression?: string;    // Esquema de progressão
  nutBedHead?: string;        // Cabeceira (graus)
  nutResidualCheck?: string;  // Checagem de resíduo gástrico
  // Antimicrobial-specific (Guia ATM)
  atbStartDate?: string;      // YYYY-MM-DD
  atbPlannedDays?: string;    // ex: "7"
  atbInfectionSite?: string;
  nutConsistency?: string;    // IDDSI / textura (oral)
  nutAccess?: string;         // NPT: CVC / PICC / Periférico
  nutComposition?: string;    // NPT: composição resumida
  nutMonitoring?: string;     // NPT: monitorização
  nutWaterVolPerAdmin?: string; // Água: mL por administração
  nutWaterFreq?: string;      // Água: frequência
  nutZeroReason?: string;     // Motivo do jejum
  // Inhalation-specific fields
  inhalationMode?: InhalationMode;
  nebDose?: string;
  nebDoseUnit?: 'mg' | 'gts' | 'mL' | 'mcg';
  oxygenFlow?: string;        // L/min
  stageDuration?: string;     // min por etapa
  continuousDuration?: string; // h (nebulização contínua)
  inhalationInterface?: InhalationInterface;
  puffs?: string;
  spacer?: boolean;
  gargle?: boolean;
  inhalationOrientation?: string;
  // Insulin therapy plan (full structured plan generated by InsulinTherapyDialog)
  insulinPlan?: InsulinPlan;
  // Reconstituição (pó liofilizado) — Sprint A
  reconstitutionSolvent?: string;   // Ex.: 'AD', 'SF 0,9%', 'próprio diluente'
  reconstitutionVolume?: string;    // mL adicionados ao frasco-ampola
}

// Detect nutrition subtype from wizard-generated item name
function detectNutritionType(name: string): PrescriptionItem['nutritionType'] | undefined {
  const n = name.toLowerCase();
  if (n.includes('zero') || n.includes('npo') || n.includes('jejum')) return 'zero';
  if (n.includes('npt') || n.includes('parenteral')) return 'npt';
  if (n.includes('água') || n.includes('agua') || n.includes('flush') || n.includes('hidratação enteral') || n.includes('hidratacao enteral')) return 'water';
  if (n.includes('enteral') || n.includes('sne') || n.includes('sng') || n.includes('gastrostomia') || n.includes('jejunostomia')) return 'diet_enteral';
  if (n.includes('oral') || n.includes(' vo')) return 'diet_oral';
  return undefined;
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

// Siglas hospitalares para forma/unidade (display-only; valor preservado)
const QUANTITY_UNIT_SHORT: Record<string, string> = {
  'mL': 'mL',
  'ampola': 'AMP',
  'frasco-ampola': 'FA',
  'frasco': 'FR',
  'comprimido': 'CP',
  'cápsula': 'CAP',
  'gota': 'gts',
  'mg': 'mg',
  'g': 'g',
  'mcg': 'mcg',
  'UI': 'UI',
  'bolsa': 'BOL',
  'unidade': 'UN',
  'sachê': 'SCH',
  'envelope': 'ENV',
  'adesivo': 'ADES',
  'supositório': 'SUP',
  'óvulo': 'OV',
  'bisnaga': 'BIS',
};
const quantityUnitShort = (u?: string) => (u && QUANTITY_UNIT_SHORT[u]) || u || '';

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
  // Inhalation items use a dedicated builder (nebulização / pMDI / DPI)
  if (item.category === 'inhalation') {
    return assembleInhalationInstruction(item as any);
  }
  const parts: string[] = [];

  // 0) Reconstituição (pó liofilizado) — vem antes da diluição final
  if (item.reconstitutionSolvent && item.reconstitutionVolume) {
    const qtyFA = (item.quantity && item.quantity.trim() && item.quantity.trim() !== '0') ? item.quantity.trim() : '1';
    parts.push(`Reconstituir ${qtyFA} frasco-ampola com ${item.reconstitutionVolume}mL de ${item.reconstitutionSolvent}.`);
  }

  // 1) Quantidade + forma (sigla) — quantidade implícita = 1
  if (item.quantityUnit && !(item.reconstitutionSolvent && item.reconstitutionVolume)) {
    const qty = (item.quantity && item.quantity.trim() && item.quantity.trim() !== '0') ? item.quantity.trim() : '1';
    parts.push(`${qty} ${quantityUnitShort(item.quantityUnit)}.`);
  }

  // 2) Dose
  if (item.dose && item.dose !== '-') parts.push(`${item.dose}.`);

  // 3) Diluição
  if (item.diluent && item.diluent !== 'sem_diluente') {
    let dilPart = `Diluir em ${item.diluent}`;
    if (item.diluentVolume) dilPart += ` ${item.diluentVolume}mL`;
    parts.push(dilPart + '.');
  }

  // 4) Volume total — só se preenchido E diferente do volume do diluente
  const volTotalNum = parseFloat((item.volumeTotal || '').replace(',', '.'));
  const volDilNum = parseFloat((item.diluentVolume || '').replace(',', '.'));
  const hasDistinctTotal = item.volumeTotal && (!item.diluentVolume || (volTotalNum && volTotalNum !== volDilNum));
  if (hasDistinctTotal) parts.push(`Volume total: ${item.volumeTotal}mL.`);

  // 5) Correr em / Velocidade
  if (item.infusionTime || item.infusionRate) {
    const unit = item.infusionTimeUnit || 'min';
    const modeLabel = item.infusionMode === 'gts' ? 'gts/min' : 'mL/h';
    if (item.infusionTime && item.infusionRate) {
      parts.push(`Correr em ${item.infusionTime}${unit === 'h' ? 'h' : 'min'} (${item.infusionRate} ${modeLabel}).`);
    } else if (item.infusionTime) {
      parts.push(`Correr em ${item.infusionTime}${unit === 'h' ? 'h' : 'min'}.`);
    } else if (item.infusionRate) {
      parts.push(`Velocidade ${item.infusionRate} ${modeLabel}.`);
    }
  }

  // 6) Via (sigla) + intervalo — fechamento padronizado
  const tail: string[] = [];
  if (item.route && item.route !== '-') tail.push(routeShort(item.route));
  if (item.posology && item.posology !== '-') tail.push(item.posology);
  if (tail.length) parts.push(tail.join(' · ') + '.');

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
  UtensilsCrossed, Droplets, FlaskConical, Pill, Shield, AlertTriangle,
  Wind, TestTube, ClipboardList, FileText, Syringe, Zap,
};

const TAB_ORDER: PrescriptionCategory[] = [
  'nutrition', 'hydration', 'replacement', 'medication', 'antimicrobial',
  'high_alert', 'inhalation', 'hemotherapy', 'care', 'nonstandard',
];

// Container temático harmônico por categoria de prescrição.
// Mantém a mesma estrutura visual (rounded-md + borda esquerda 3px + fundo suave)
// que adotamos em Hidratação/Medicação, sincronizando a cor com o tipo de item.
export function getCategoryContainerClass(category?: string): string {
  const base = "relative rounded-md p-2 border";
  switch (category) {
    case 'nutrition':
      return `${base} bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/50 border-l-[3px] border-l-emerald-500/70 dark:border-l-emerald-400/70`;
    case 'hydration':
      return `${base} bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/50 border-l-[3px] border-l-blue-500/70 dark:border-l-blue-400/70`;
    case 'replacement':
      return `${base} bg-sky-50/50 dark:bg-sky-950/20 border-sky-200/60 dark:border-sky-900/50 border-l-[3px] border-l-sky-500/70 dark:border-l-sky-400/70`;
    case 'antimicrobial':
      return `${base} bg-violet-50/30 dark:bg-violet-950/10 border-violet-200/40 dark:border-violet-900/30 border-l-[3px] border-l-violet-400/60 dark:border-l-violet-500/60`;
    case 'high_alert':
      return `${base} bg-red-50/50 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/50 border-l-[3px] border-l-red-500/70 dark:border-l-red-400/70`;
    case 'inhalation':
      return `${base} bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200/60 dark:border-cyan-900/50 border-l-[3px] border-l-cyan-500/70 dark:border-l-cyan-400/70`;
    case 'hemotherapy':
      return `${base} bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/50 border-l-[3px] border-l-rose-500/70 dark:border-l-rose-400/70`;
    case 'care':
      return `${base} bg-violet-50/50 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/50 border-l-[3px] border-l-violet-500/70 dark:border-l-violet-400/70`;
    case 'nonstandard':
      return `${base} bg-zinc-50/60 dark:bg-zinc-900/30 border-zinc-200/60 dark:border-zinc-800/60 border-l-[3px] border-l-zinc-400/70 dark:border-l-zinc-500/70`;
    case 'medication':
    default:
      return `${base} bg-slate-50/60 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800/60 border-l-[3px] border-l-slate-400/70 dark:border-l-slate-500/70`;
  }
}

// Acento de campo (border + focus ring) por categoria — usado no
// MedicationAutocomplete e como override descendente nos inputs/selects
// internos do container (apenas os que têm fundo branco, preservando
// campos especiais já tematizados como o pill ATB e a tarja âmbar).
export function getCategoryFieldAccent(category?: string): { border: string; ring: string; descendantOverrides: string } {
  switch (category) {
    case 'nutrition':
      return { border: 'border-emerald-300/70 focus-visible:border-emerald-400', ring: 'focus-visible:ring-emerald-400/60', descendantOverrides: '[&_input.bg-white]:border-emerald-200/70 [&_input.bg-white]:focus-visible:ring-emerald-400/60 [&_button.bg-white]:border-emerald-200/70 [&_button.bg-white]:focus-visible:ring-emerald-400/60' };
    case 'hydration':
      return { border: 'border-blue-300/70 focus-visible:border-blue-400', ring: 'focus-visible:ring-blue-400/60', descendantOverrides: '[&_input.bg-white]:border-blue-200/70 [&_input.bg-white]:focus-visible:ring-blue-400/60 [&_button.bg-white]:border-blue-200/70 [&_button.bg-white]:focus-visible:ring-blue-400/60' };
    case 'replacement':
      return { border: 'border-sky-300/70 focus-visible:border-sky-400', ring: 'focus-visible:ring-sky-400/60', descendantOverrides: '[&_input.bg-white]:border-sky-200/70 [&_input.bg-white]:focus-visible:ring-sky-400/60 [&_button.bg-white]:border-sky-200/70 [&_button.bg-white]:focus-visible:ring-sky-400/60' };
    case 'antimicrobial':
      return { border: 'border-violet-300/60 focus-visible:border-violet-400', ring: 'focus-visible:ring-violet-400/50', descendantOverrides: '[&_input.bg-white]:border-violet-200/60 [&_input.bg-white]:focus-visible:ring-violet-400/50 [&_button.bg-white]:border-violet-200/60 [&_button.bg-white]:focus-visible:ring-violet-400/50' };
    case 'high_alert':
      return { border: 'border-red-300/70 focus-visible:border-red-400', ring: 'focus-visible:ring-red-400/60', descendantOverrides: '[&_input.bg-white]:border-red-200/70 [&_input.bg-white]:focus-visible:ring-red-400/60 [&_button.bg-white]:border-red-200/70 [&_button.bg-white]:focus-visible:ring-red-400/60' };
    case 'inhalation':
      return { border: 'border-cyan-300/70 focus-visible:border-cyan-400', ring: 'focus-visible:ring-cyan-400/60', descendantOverrides: '[&_input.bg-white]:border-cyan-200/70 [&_input.bg-white]:focus-visible:ring-cyan-400/60 [&_button.bg-white]:border-cyan-200/70 [&_button.bg-white]:focus-visible:ring-cyan-400/60' };
    case 'hemotherapy':
      return { border: 'border-rose-300/70 focus-visible:border-rose-400', ring: 'focus-visible:ring-rose-400/60', descendantOverrides: '[&_input.bg-white]:border-rose-200/70 [&_input.bg-white]:focus-visible:ring-rose-400/60 [&_button.bg-white]:border-rose-200/70 [&_button.bg-white]:focus-visible:ring-rose-400/60' };
    case 'care':
      return { border: 'border-violet-300/70 focus-visible:border-violet-400', ring: 'focus-visible:ring-violet-400/60', descendantOverrides: '[&_input.bg-white]:border-violet-200/70 [&_input.bg-white]:focus-visible:ring-violet-400/60 [&_button.bg-white]:border-violet-200/70 [&_button.bg-white]:focus-visible:ring-violet-400/60' };
    case 'nonstandard':
      return { border: 'border-zinc-300/70 focus-visible:border-zinc-400', ring: 'focus-visible:ring-zinc-400/60', descendantOverrides: '[&_input.bg-white]:border-zinc-200/70 [&_input.bg-white]:focus-visible:ring-zinc-400/60 [&_button.bg-white]:border-zinc-200/70 [&_button.bg-white]:focus-visible:ring-zinc-400/60' };
    case 'medication':
    default:
      return { border: 'border-slate-300/70 focus-visible:border-slate-400', ring: 'focus-visible:ring-slate-400/60', descendantOverrides: '[&_input.bg-white]:border-slate-200/70 [&_input.bg-white]:focus-visible:ring-slate-400/60 [&_button.bg-white]:border-slate-200/70 [&_button.bg-white]:focus-visible:ring-slate-400/60' };
  }
}

// --- Autocomplete Component ---
function MedicationAutocomplete({
  source,
  onSelect,
  placeholder,
  getFavoriteCount,
  onAssistantClick,
  assistantTooltip,
  category,
}: {
  source: MedicationEntry[];
  onSelect: (med: MedicationEntry) => void;
  placeholder: string;
  getFavoriteCount?: (id: string) => number;
  onAssistantClick?: () => void;
  assistantTooltip?: string;
  category?: string;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const favCount = getFavoriteCount ?? (() => 0);
  const accent = getCategoryFieldAccent(category);

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
      <div className="relative flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder={placeholder}
            className={cn(
              "pl-9 bg-background/60 h-7 text-xs transition-colors",
              category ? `${accent.border} ${accent.ring}` : "border-border/50 focus:border-primary/50",
              onAssistantClick && "pr-9"
            )}
          />
          {onAssistantClick && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onAssistantClick}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 text-primary hover:from-primary/25 hover:to-primary/10 transition-all"
                  aria-label={assistantTooltip || "Abrir assistente"}
                >
                  <Sparkles className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                {assistantTooltip || "Abrir assistente"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
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
                  <span className="text-xs text-muted-foreground block truncate">
                    {med.isStandard && (
                      <Badge variant="outline" className="mr-1 text-[9px] px-1 py-0 h-4 border-emerald-500/60 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10">
                        PADRÃO HMDM
                      </Badge>
                    )}
                    {med.presentation}
                  </span>
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
// Categorias com pop-up dedicado disparam o pop-up ao clicar no chip;
// demais categorias filtram a busca digitada (comportamento clássico).
const POPUP_CATEGORIES: ReadonlyArray<PrescriptionCategory> = ['antimicrobial', 'high_alert', 'care'];

export interface GlobalPrescriptionSearchHandle {
  focus: () => void;
}
const GlobalPrescriptionSearch = React.forwardRef<GlobalPrescriptionSearchHandle, {
  onAddItem: (med: MedicationEntry) => void;
  onAddNonStandard: (name: string) => void;
  getFavoriteCount?: (id: string) => number;
  onCategoryPopup?: (cat: PrescriptionCategory) => void;
}>(function GlobalPrescriptionSearch({
  onAddItem,
  onAddNonStandard,
  getFavoriteCount,
  onCategoryPopup,
}, ref) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  // 'all' = busca em todas; categoria normal = filtra busca; chips com pop-up disparam o pop-up sem alterar este estado
  const [selectedCat, setSelectedCat] = useState<PrescriptionCategory | 'all'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));
  const [freeText, setFreeText] = useState("");
  const favCount = getFavoriteCount ?? (() => 0);

  const { byCategory: UNIFIED_BY_CAT } = useUnifiedMedicationCatalog();
  const allItems = useMemo(() => Object.values(UNIFIED_BY_CAT).flat(), [UNIFIED_BY_CAT]);

  const filtered = useMemo(() => {
    // Restringe a busca à categoria selecionada quando o usuário escolhe uma
    // (categorias com pop-up nunca alteram selectedCat — sempre filtram global = 'all').
    const pool = selectedCat === 'all'
      ? allItems
      : allItems.filter(m => m.category === selectedCat);
    return fuzzySearch(query, pool, favCount, 15);
  }, [query, selectedCat, allItems, favCount]);

  const handleChipClick = (cat: PrescriptionCategory) => {
    if (POPUP_CATEGORIES.includes(cat) && onCategoryPopup) {
      onCategoryPopup(cat);
      return;
    }
    // Toggle: clicar de novo no chip ativo volta para "Todas"
    setSelectedCat(prev => (prev === cat ? 'all' : cat));
    inputRef.current?.focus();
  };

  const handleSelect = (med: MedicationEntry) => {
    onAddItem(med);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className="space-y-2">
      {/* Category chips — pop-up categories open dialogs; others filter the search */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* "Todas" reset chip */}
        <button
          type="button"
          onClick={() => { setSelectedCat('all'); inputRef.current?.focus(); }}
          className={cn(
            "text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all",
            selectedCat === 'all'
              ? "bg-foreground text-background border-foreground"
              : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60"
          )}
        >
          Todas
        </button>
        {TAB_ORDER.map(cat => {
          const config = CATEGORY_CONFIG[cat];
          const Icon = CATEGORY_ICONS[config.icon] || Pill;
          const isPopup = POPUP_CATEGORIES.includes(cat);
          const active = selectedCat === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleChipClick(cat)}
              title={isPopup ? `Abrir guia de ${config.label}` : `Filtrar busca por ${config.label}`}
              className={cn(
                "text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all flex items-center gap-1",
                active
                  ? cn("border-current", config.color, config.bgColor)
                  : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60",
                isPopup && "ring-1 ring-current/20"
              )}
            >
              <Icon className="h-3 w-3" />
              {config.shortLabel ?? config.label}
              {isPopup && <span className="text-[8px] opacity-60 ml-0.5">▸</span>}
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
              selectedCat === 'all'
                ? "Buscar em todas as categorias (tolera erros de digitação)..."
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
                    <span className="text-xs text-muted-foreground block truncate">
                      {med.isStandard && (
                        <Badge variant="outline" className="mr-1 text-[9px] px-1 py-0 h-4 border-emerald-500/60 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10">
                          PADRÃO HMDM
                        </Badge>
                      )}
                      {med.presentation}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {fav > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 border-amber-400/50 text-amber-700 dark:text-amber-300">
                        {fav}×
                      </Badge>
                    )}
                    {catConfig && (
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
            placeholder="Ou adicionar item não padrão..."
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

// Compute ATB day text dynamically (D{n} — DD/MM/AAAA (início … previsão …))
function buildAtbDayLine(item: PrescriptionItem): string | null {
  if (!item.atbStartDate) return null;
  const start = new Date(item.atbStartDate + 'T00:00:00');
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMid = new Date(start);
  startMid.setHours(0, 0, 0, 0);
  const dayN = Math.max(1, Math.floor((today.getTime() - startMid.getTime()) / 86400000) + 1);
  const days = parseInt(item.atbPlannedDays || '', 10);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  let endStr = '—';
  let suffix = '';
  if (Number.isFinite(days) && days > 0) {
    const end = new Date(startMid);
    end.setDate(end.getDate() + days - 1);
    endStr = fmt(end);
    suffix = `/${days}`;
  }
  return `D${dayN}${suffix} — ${fmt(today)} (início ${fmt(startMid)}, previsão ${endStr})`;
}


// --- Nutrition fields (specific structured controls per nutrition subtype) ---
// Renderizado no modo expandido para itens da categoria 'nutrition' no lugar
// dos campos de medicação. Todos os campos são OPCIONAIS.
const NutFieldLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">{children}</span>
);
const NutTinyInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <Input {...props} className={cn("h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600", props.className)} />
);
// Input com sufixo de unidade fixo à direita (ex.: "1500 mL")
const NutSuffixInput = ({
  value, onChange, suffix, width = 'w-24', placeholder, type = 'number', inputMode = 'decimal',
}: {
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  width?: string;
  placeholder?: string;
  type?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
}) => (
  <div className={cn("relative inline-flex items-center", width)}>
    <Input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 text-[12px] font-semibold pr-9 bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 focus-visible:ring-emerald-400/60"
    />
    <span className="absolute right-2 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 pointer-events-none select-none">
      {suffix}
    </span>
  </div>
);

function NutritionFields({
  item,
  onUpdate,
}: {
  item: PrescriptionItem;
  onUpdate: (id: string, field: keyof PrescriptionItem, value: string) => void;
}) {
  const subtype: NonNullable<PrescriptionItem['nutritionType']> =
    item.nutritionType ?? detectNutritionType(item.name) ?? 'diet_enteral';


  const setSubtype = (v: string) => onUpdate(item.id, 'nutritionType', v);

  // Sincronização Vol/dia ↔ Vazão para BIC contínua / Bomba ciclada
  const isContinuousMode = item.nutMode === 'Contínua BIC' || item.nutMode === 'Bomba ciclada';
  const isBolusMode = item.nutMode === 'Bolus' || item.nutMode === 'Gravitacional intermitente';
  const setVolDay = (v: string) => {
    onUpdate(item.id, 'nutVolDay', v);
    const n = parseFloat(v);
    if (isContinuousMode && !isNaN(n) && n > 0) {
      const rate = Math.round(n / 24);
      onUpdate(item.id, 'infusionRate', String(rate));
    }
  };
  const setRate = (v: string) => {
    onUpdate(item.id, 'infusionRate', v);
    const n = parseFloat(v);
    if (isContinuousMode && !isNaN(n) && n > 0) {
      onUpdate(item.id, 'nutVolDay', String(n * 24));
    }
  };

  // Vol/adm calculado para Bolus a partir de Vol/dia ÷ nº fracionamentos (parse simples "6x" ou "6")
  const bolusFractionN = (() => {
    const m = (item.nutFraction || '').match(/(\d+)\s*x?/i);
    return m ? parseInt(m[1], 10) : 0;
  })();
  const bolusVolPerAdm = (() => {
    const v = parseFloat(item.nutVolDay || '');
    if (!isNaN(v) && bolusFractionN > 0) return Math.round(v / bolusFractionN);
    return null;
  })();

  return (
    <div className={cn(getCategoryContainerClass('nutrition'), getCategoryFieldAccent('nutrition').descendantOverrides, "space-y-1.5")}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <NutFieldLabel>Tipo:</NutFieldLabel>
        <Select value={subtype} onValueChange={setSubtype}>
          <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="diet_enteral" className="text-xs">Dieta enteral</SelectItem>
            <SelectItem value="diet_oral" className="text-xs">Dieta oral</SelectItem>
            <SelectItem value="water" className="text-xs">Água / Hidratação</SelectItem>
            <SelectItem value="npt" className="text-xs">NPT (Parenteral)</SelectItem>
            <SelectItem value="zero" className="text-xs">Dieta zero (NPO)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground/70 italic ml-1">campos opcionais — preencha o que desejar detalhar</span>
      </div>

      {(subtype === 'diet_enteral' || subtype === 'diet_oral') && (
        <>
          {/* Linha ESSENCIAL — destacada em emerald */}
          <div className="flex items-center gap-2 flex-wrap px-2.5 py-2 rounded-md bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-300/60 dark:border-emerald-800/50 border-l-[3px] border-l-emerald-500/70">
            <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" />
            <NutFieldLabel>Vol/dia:</NutFieldLabel>
            <NutSuffixInput value={item.nutVolDay || ''} onChange={setVolDay} suffix="mL" placeholder="1500" />
            {subtype === 'diet_enteral' && !isBolusMode && (
              <>
                <span className="text-emerald-700/40">·</span>
                <NutFieldLabel>Vazão:</NutFieldLabel>
                <NutSuffixInput value={item.infusionRate || ''} onChange={setRate} suffix="mL/h" placeholder="62" />
                {isContinuousMode && (
                  <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 italic">
                    ÷ 24h auto
                  </span>
                )}
              </>
            )}
            {subtype === 'diet_enteral' && isBolusMode && bolusVolPerAdm !== null && (
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium px-2 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-900/30">
                ≈ {bolusVolPerAdm} mL/adm ({bolusFractionN}x)
              </span>
            )}
            <span className="text-emerald-700/40">·</span>
            <NutFieldLabel>Modo:</NutFieldLabel>
            <Select value={item.nutMode || ''} onValueChange={(v) => onUpdate(item.id, 'nutMode', v)}>
              <SelectTrigger className="h-7 text-[12px] font-semibold bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 focus-visible:ring-emerald-400/60 w-44"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {subtype === 'diet_enteral' ? (
                  <>
                    <SelectItem value="Contínua BIC" className="text-xs">Contínua (BIC)</SelectItem>
                    <SelectItem value="Gravitacional intermitente" className="text-xs">Gravitacional intermitente</SelectItem>
                    <SelectItem value="Bolus" className="text-xs">Bolus</SelectItem>
                    <SelectItem value="Bomba ciclada" className="text-xs">Bomba ciclada</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="VO livre demanda" className="text-xs">VO — livre demanda</SelectItem>
                    <SelectItem value="VO fracionada" className="text-xs">VO — fracionada</SelectItem>
                    <SelectItem value="VO assistida" className="text-xs">VO — assistida (fono)</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <div className="flex items-center gap-1">
              <NutFieldLabel>Fracionamento:</NutFieldLabel>
              <NutTinyInput value={item.nutFraction || ''} onChange={(e) => onUpdate(item.id, 'nutFraction', e.target.value)} className="flex-1" placeholder="6x/dia, 4/4h..." />
            </div>
            <div className="flex items-center gap-1">
              <NutFieldLabel>Pausa noturna:</NutFieldLabel>
              <NutTinyInput value={item.nutNightPause || ''} onChange={(e) => onUpdate(item.id, 'nutNightPause', e.target.value)} className="flex-1" placeholder="23h-6h" />
            </div>
            <div className="flex items-center gap-1">
              <NutFieldLabel>Progressão:</NutFieldLabel>
              <NutTinyInput value={item.nutProgression || ''} onChange={(e) => onUpdate(item.id, 'nutProgression', e.target.value)} className="flex-1" placeholder="↑20mL/h a cada 6h" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <div className="flex items-center gap-1">
              <NutFieldLabel>Cabeceira:</NutFieldLabel>
              <Select value={item.nutBedHead || ''} onValueChange={(v) => onUpdate(item.id, 'nutBedHead', v)}>
                <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 flex-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="≥30°" className="text-xs">≥30°</SelectItem>
                  <SelectItem value="≥45°" className="text-xs">≥45°</SelectItem>
                  <SelectItem value="Decúbito livre" className="text-xs">Decúbito livre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <NutFieldLabel>Resíduo gástrico:</NutFieldLabel>
              <NutTinyInput value={item.nutResidualCheck || ''} onChange={(e) => onUpdate(item.id, 'nutResidualCheck', e.target.value)} className="flex-1" placeholder="aspirar 6/6h, suspender se >250mL" />
            </div>
          </div>

          {subtype === 'diet_oral' && (
            <div className="flex items-center gap-1">
              <NutFieldLabel>Consistência (IDDSI):</NutFieldLabel>
              <Select value={item.nutConsistency || ''} onValueChange={(v) => onUpdate(item.id, 'nutConsistency', v)}>
                <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-56"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Líquida fina (IDDSI 0)" className="text-xs">Líquida fina (IDDSI 0)</SelectItem>
                  <SelectItem value="Levemente espessa (IDDSI 1)" className="text-xs">Levemente espessa (1)</SelectItem>
                  <SelectItem value="Néctar (IDDSI 2)" className="text-xs">Néctar (2)</SelectItem>
                  <SelectItem value="Mel (IDDSI 3)" className="text-xs">Mel (3)</SelectItem>
                  <SelectItem value="Pudim/pastosa (IDDSI 4)" className="text-xs">Pudim/pastosa (4)</SelectItem>
                  <SelectItem value="Branda (IDDSI 5/6)" className="text-xs">Branda (5/6)</SelectItem>
                  <SelectItem value="Livre (IDDSI 7)" className="text-xs">Livre (7)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      {subtype === 'water' && (
        <div className="flex items-center gap-2 flex-wrap px-2.5 py-2 rounded-md bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-300/60 dark:border-emerald-800/50 border-l-[3px] border-l-emerald-500/70">
          <Droplets className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" />
          <NutFieldLabel>Vol/adm:</NutFieldLabel>
          <NutSuffixInput value={item.nutWaterVolPerAdmin || ''} onChange={(v) => onUpdate(item.id, 'nutWaterVolPerAdmin', v)} suffix="mL" placeholder="50" />
          <span className="text-emerald-700/40">·</span>
          <NutFieldLabel>Frequência:</NutFieldLabel>
          <Input value={item.nutWaterFreq || ''} onChange={(e) => onUpdate(item.id, 'nutWaterFreq', e.target.value)} placeholder="antes/após dieta e meds" className="h-7 text-[12px] bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 focus-visible:ring-emerald-400/60 w-48" />
          <span className="text-emerald-700/40">·</span>
          <NutFieldLabel>Meta/24h:</NutFieldLabel>
          <NutSuffixInput value={item.nutVolDay || ''} onChange={(v) => onUpdate(item.id, 'nutVolDay', v)} suffix="mL" placeholder="800" />
        </div>
      )}

      {subtype === 'npt' && (
        <>
          <div className="flex items-center gap-2 flex-wrap px-2.5 py-2 rounded-md bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-300/60 dark:border-emerald-800/50 border-l-[3px] border-l-emerald-500/70">
            <Droplets className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" />
            <NutFieldLabel>Vol total:</NutFieldLabel>
            <NutSuffixInput value={item.volumeTotal || ''} onChange={(v) => onUpdate(item.id, 'volumeTotal', v)} suffix="mL" placeholder="2000" />
            <span className="text-emerald-700/40">·</span>
            <NutFieldLabel>Vazão:</NutFieldLabel>
            <NutSuffixInput value={item.infusionRate || ''} onChange={(v) => onUpdate(item.id, 'infusionRate', v)} suffix="mL/h" placeholder="83" />
            <span className="text-emerald-700/40">·</span>
            <NutFieldLabel>Correr em:</NutFieldLabel>
            <NutTinyInput value={item.infusionTime || ''} onChange={(e) => onUpdate(item.id, 'infusionTime', e.target.value)} className="w-20 text-center h-7 text-[12px] font-semibold border-emerald-300 dark:border-emerald-700" placeholder="18" />
            <Select value={item.infusionTimeUnit || 'h'} onValueChange={(v) => onUpdate(item.id, 'infusionTimeUnit', v)}>
              <SelectTrigger className="h-7 text-[11px] bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="h" className="text-xs">horas</SelectItem>
                <SelectItem value="min" className="text-xs">min</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-emerald-700/40">·</span>
            <NutFieldLabel>Acesso:</NutFieldLabel>
            <Select value={item.nutAccess || ''} onValueChange={(v) => onUpdate(item.id, 'nutAccess', v)}>
              <SelectTrigger className="h-7 text-[12px] font-semibold bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 w-36"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CVC" className="text-xs">CVC</SelectItem>
                <SelectItem value="PICC" className="text-xs">PICC</SelectItem>
                <SelectItem value="Periférico" className="text-xs">Periférico</SelectItem>
                <SelectItem value="Port-a-cath" className="text-xs">Port-a-cath</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <div className="flex items-start gap-1">
              <NutFieldLabel>Composição:</NutFieldLabel>
              <Textarea value={item.nutComposition || ''} onChange={(e) => onUpdate(item.id, 'nutComposition', e.target.value)} className="min-h-[36px] text-[11px] bg-muted/10 border-border/30 flex-1 py-1" placeholder="Glic 4 g/kg/dia · AA 1,5 g/kg/dia · Lip 1 g/kg/dia · eletrólitos" />
            </div>
            <div className="flex items-start gap-1">
              <NutFieldLabel>Monitorização:</NutFieldLabel>
              <Textarea value={item.nutMonitoring || ''} onChange={(e) => onUpdate(item.id, 'nutMonitoring', e.target.value)} className="min-h-[36px] text-[11px] bg-muted/10 border-border/30 flex-1 py-1" placeholder="Glicemia 6/6h · ionograma · TG 2x/sem · função hepática" />
            </div>
          </div>
        </>
      )}

      {subtype === 'zero' && (
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-accent/30 border border-border/30">
          <NutFieldLabel>Motivo do jejum:</NutFieldLabel>
          <NutTinyInput value={item.nutZeroReason || ''} onChange={(e) => onUpdate(item.id, 'nutZeroReason', e.target.value)} className="flex-1" placeholder="pré-operatório, broncoaspiração, íleo..." />
        </div>
      )}

      {/* Observações livres — sempre disponível */}
      <Textarea
        value={item.instructions}
        onChange={(e) => onUpdate(item.id, 'instructions', e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className="min-h-[44px] text-[11px] bg-muted/10 border-border/20 italic focus:not-italic"
        placeholder="Observações nutricionais livres (orientações à equipe, restrições, alergias, metas calóricas, conduta em caso de intolerância...)"
      />
    </div>
  );
}

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

// --- Hydration optimized fields (expanded view) ---
const HYDRATION_PHASE_OPTIONS: Array<{ phases: number; interval: string }> = [
  { phases: 1, interval: '24/24h' },
  { phases: 2, interval: '12/12h' },
  { phases: 3, interval: '8/8h' },
  { phases: 4, interval: '6/6h' },
  { phases: 6, interval: '4/4h' },
  { phases: 8, interval: '3/3h' },
  { phases: 12, interval: '2/2h' },
  { phases: 24, interval: '1/1h' },
];
const HYDRATION_DRIP_FACTOR = 20; // macrogotas/mL

function intervalToPhases(interval?: string): number {
  const m = HYDRATION_PHASE_OPTIONS.find(o => o.interval === interval);
  return m ? m.phases : 1;
}

function HydrationFields({
  item,
  onUpdate,
}: {
  item: PrescriptionItem;
  onUpdate: (id: string, field: keyof PrescriptionItem, value: string) => void;
}) {
  const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">{children}</span>
  );

  const phases = intervalToPhases(item.posology);
  const interval = item.posology || '24/24h';
  const volPhase = parseFloat(item.volumeTotal || '0') || 0;
  const tValue = parseFloat(item.infusionTime || '0') || 0;
  const tUnit: 'h' | 'min' = (item.infusionTimeUnit as 'h' | 'min') || 'h';
  const tempoMin = tValue * (tUnit === 'h' ? 60 : 1);
  const mlh = tempoMin > 0 ? volPhase / (tempoMin / 60) : 0;
  const gtt = tempoMin > 0 ? (volPhase * HYDRATION_DRIP_FACTOR) / tempoMin : 0;
  const dripMode: 'BIC' | 'gts' = (item.infusionMode as 'BIC' | 'gts') || 'BIC';
  const dripVal = dripMode === 'BIC' ? mlh : gtt;
  const volTotal24 = volPhase * phases;

  // Auto-sync calculated drip rate into infusionRate
  const calcRateStr = isFinite(dripVal) && dripVal > 0 ? dripVal.toFixed(0) : '';
  if (calcRateStr && calcRateStr !== item.infusionRate) {
    // schedule on next tick to avoid setState during render
    queueMicrotask(() => onUpdate(item.id, 'infusionRate', calcRateStr));
  }

  const handlePhasesChange = (v: string) => {
    const opt = HYDRATION_PHASE_OPTIONS.find(o => String(o.phases) === v);
    if (opt) onUpdate(item.id, 'posology', opt.interval);
  };

  return (
    <div className="space-y-1.5">
      <div className="relative flex items-center gap-x-3 gap-y-2 flex-wrap rounded-md p-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/50 border-l-[3px] border-l-blue-500/70 dark:border-l-blue-400/70">
        <NutFieldLabel>Volume / fase:</NutFieldLabel>
        <Input
          type="number"
          value={item.volumeTotal || ''}
          onChange={(e) => onUpdate(item.id, 'volumeTotal', e.target.value)}
          className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-16 text-center font-medium focus-visible:ring-1 focus-visible:ring-blue-400"
          placeholder="mL"
        />
        <span className="text-[10px] text-muted-foreground">mL</span>

        <NutFieldLabel>Fases / intervalo:</NutFieldLabel>
        <Select value={String(phases)} onValueChange={handlePhasesChange}>
          <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-36 focus:ring-1 focus:ring-blue-400"><SelectValue /></SelectTrigger>
          <SelectContent>
            {HYDRATION_PHASE_OPTIONS.map(o => (
              <SelectItem key={o.phases} value={String(o.phases)} className="text-xs">
                {o.phases} fase{o.phases > 1 ? 's' : ''} ({o.interval})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <NutFieldLabel>Tempo / fase:</NutFieldLabel>
        <Input
          type="number"
          value={item.infusionTime || ''}
          onChange={(e) => onUpdate(item.id, 'infusionTime', e.target.value)}
          className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-14 text-center focus-visible:ring-1 focus-visible:ring-blue-400"
          placeholder="—"
        />
        <Select value={tUnit} onValueChange={(v) => onUpdate(item.id, 'infusionTimeUnit', v)}>
          <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-16 focus:ring-1 focus:ring-blue-400"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="h" className="text-xs">h</SelectItem>
            <SelectItem value="min" className="text-xs">min</SelectItem>
          </SelectContent>
        </Select>

        <NutFieldLabel>Gotejamento:</NutFieldLabel>
        <div className="h-6 px-2 flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[11px] font-semibold w-16 justify-center">
          {isFinite(dripVal) && dripVal > 0 ? dripVal.toFixed(0) : '—'}
        </div>
        <Select value={dripMode} onValueChange={(v) => onUpdate(item.id, 'infusionMode', v)}>
          <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-20 focus:ring-1 focus:ring-blue-400"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="BIC" className="text-xs">mL/h</SelectItem>
            <SelectItem value="gts" className="text-xs">gts/min</SelectItem>
          </SelectContent>
        </Select>

        <NutFieldLabel>Via:</NutFieldLabel>
        <Select value={item.route || 'EV'} onValueChange={(v) => onUpdate(item.id, 'route', v)}>
          <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-20 font-semibold focus:ring-1 focus:ring-blue-400">
            <SelectValue>{routeShort(item.route || 'EV')}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {ROUTES.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                <span className="font-semibold mr-1.5">{routeShort(r)}</span>
                <span className="text-muted-foreground">— {r}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-[10px] font-medium text-blue-700 dark:text-blue-300">
          Total: {volTotal24}mL / 24h
        </span>
      </div>

      <div>
        <NutFieldLabel>Recomendações para a enfermagem:</NutFieldLabel>
        <Textarea
          value={item.instructions || ''}
          onChange={(e) => onUpdate(item.id, 'instructions', e.target.value)}
          className="min-h-[56px] text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 mt-0.5 focus-visible:ring-1 focus-visible:ring-blue-400"
          placeholder="Ex.: manter acesso pérvio; observar sinais de sobrecarga; reavaliar em 24h; trocar equipo a cada 72h..."
        />
      </div>
    </div>
  );
}


// --- Sortable Prescription Item Row ---
const SortablePrescriptionItemRow = React.memo(function SortablePrescriptionItemRow({
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
  onAssistant,
  onEditInsulin,
  onOpenAntimicrobialGuide,
  isPastRenewalTime,
  prescriptionLocked,
  missingFields = [],
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
  onAssistant?: (id: string) => void;
  onEditInsulin?: (id: string) => void;
  onOpenAntimicrobialGuide?: () => void;
  isPastRenewalTime: boolean;
  prescriptionLocked: boolean;
  missingFields?: string[];
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

  // Compute lock state for the row (mirrors ValidationDot logic).
  // Once an item is validated within the current 05h window, the row is read-only:
  // dose/route/posology/instructions/flags/deletion are blocked.
  const renewalCutoffNow = setSeconds(setMinutes(setHours(startOfDay(new Date()), 5), 0), 0);
  const validatedAfterCutoffNow = !!(item.validatedAt && new Date(item.validatedAt) > renewalCutoffNow);
  const isLocked = !!item.validated && (!isPastRenewalTime || validatedAfterCutoffNow);

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
      <DropdownMenuContent align="end" className="w-52">
        {onAssistant && ['replacement', 'hydration', 'nutrition'].includes(item.category) && (
          <>
            <DropdownMenuItem onClick={() => onAssistant(item.id)} className="text-xs gap-2 text-sky-600 focus:text-sky-700">
              <Wand2 className="h-3.5 w-3.5" /> Configurar com assistente
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
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
        <DropdownMenuItem
          onClick={() => onRemove(item.id)}
          disabled={isLocked}
          className="text-xs gap-2 text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {isLocked ? "Excluir (item validado — bloqueado)" : "Excluir item"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const ValidationDot = () => {
    // Considera validado se: marcado E (ainda não passou da renovação OU foi validado após o corte de 05:00 de hoje)
    const renewalCutoff = setSeconds(setMinutes(setHours(startOfDay(new Date()), 5), 0), 0);
    const validatedAfterCutoff = !!(item.validatedAt && new Date(item.validatedAt) > renewalCutoff);
    const isValidated = !!item.validated && (!isPastRenewalTime || validatedAfterCutoff);
    const isBlocked = !isValidated && missingFields.length > 0;

    const canClick = !isValidated && !isBlocked && prescriptionLocked;
    const tooltipMsg = isValidated
      ? "Validado — para retirar, suspenda o item"
      : isBlocked
      ? `Bloqueado — preencha: ${missingFields.join(', ')}`
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
              (isValidated || isBlocked) && "cursor-default"
            )}
          >
            <Circle className={cn(
              "h-3 w-3 fill-current",
              isValidated ? "text-emerald-500" : isBlocked ? "text-red-500 animate-pulse" : "text-amber-500"
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
        {isSimple ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={isLocked || item.status === 'suspended'}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 rounded-md border border-border/50 bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5 hover:border-primary/50 hover:bg-secondary/80 transition-colors",
                  (isLocked || item.status === 'suspended') && "opacity-60 cursor-not-allowed"
                )}
                title="Ajustar aprazamento"
              >
                {item.posology && item.posology !== '-' ? item.posology : 'Aprazar'}
                <Pencil className="h-2.5 w-2.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <p className="text-[11px] font-semibold text-muted-foreground mb-2">Aprazamento</p>
              <div className="grid grid-cols-3 gap-1.5">
                {['1/1h','2/2h','4/4h','6/6h','8/8h','12/12h','1x/dia','2x/dia','3x/dia','Única','Contínuo','S/N','ACM'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onUpdate(item.id, 'posology', opt)}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded-md border transition-colors",
                      item.posology === opt
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/50 hover:border-primary/40 hover:bg-muted"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="mt-2.5">
                <label className="text-[10px] font-medium text-muted-foreground">Personalizado</label>
                <Input
                  value={item.posology === '-' ? '' : item.posology}
                  onChange={(e) => onUpdate(item.id, 'posology', e.target.value || '-')}
                  placeholder="Ex.: Antes das refeições"
                  className="h-7 text-xs mt-1"
                />
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          item.posology !== '-' && <Badge variant="secondary" className="text-[10px]">{item.posology}</Badge>
        )}
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
        {/* Schedule removed — manual aprazamento by nursing */}
        <ItemActions />
      </div>
    );
  }

  // === INSULIN PLAN VIEW (always grouped block, even in compact mode) ===
  if (item.insulinPlan && !individualExpanded) {
    const desc = describeInsulinPlan(item.insulinPlan);
    return (
      <div
        ref={setNodeRef}
        style={style}
        id={`prescription-item-${item.id}`}
        className={cn(
          "rounded-lg border-2 transition-all overflow-hidden",
          item.status === 'suspended'
            ? "border-destructive/30 bg-destructive/5 opacity-60"
            : "border-red-300/60 bg-red-50/40 dark:bg-red-950/10 hover:border-red-400/60",
          selected && "ring-2 ring-primary/40",
        )}
      >
        <div className="flex items-start gap-2 px-2.5 py-2">
          <ValidationDot />
          <button className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0 touch-none mt-0.5" {...attributes} {...listeners}>
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(item.id)} className="shrink-0 mt-0.5" />
          <span className="text-[10px] font-mono text-muted-foreground w-5 text-right shrink-0 mt-0.5">{index + 1}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
              <span className={cn("text-xs font-bold text-foreground", item.status === 'suspended' && "line-through")}>
                INSULINOTERAPIA — {desc.headline}
              </span>
              <Badge variant="outline" className="text-[8px] px-1 bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300">MAV</Badge>
              {item.insulinPlan.scheme === 'iv_continuous' && (
                <Badge variant="outline" className="text-[8px] px-1 bg-amber-100 text-amber-700 border-amber-300">BIC</Badge>
              )}
              <button
                type="button"
                onClick={() => onEditInsulin?.(item.id)}
                className="ml-auto text-[10px] text-primary hover:underline"
              >
                EDITAR ESQUEMA
              </button>
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {desc.lines.map((l, i) => (
                <li key={i} className={cn(
                  "text-[11px] leading-snug",
                  l.startsWith('  •') ? "pl-4 text-muted-foreground" : "pl-2 border-l-2 border-red-400/40 text-foreground"
                )}>{l.replace(/^ {2}• /, '• ')}</li>
              ))}
            </ul>
          </div>
          <ItemActions />
        </div>
      </div>
    );
  }

  // === COMPACT VIEW (with individual expand) ===
  if (isCompact && !isSimple && !individualExpanded) {
    const compactParts: string[] = [];
    const isHydration = item.category === 'hydration';
    const isInhalation = item.category === 'inhalation';
    const isNutrition = item.category === 'nutrition';

    if (isInhalation) {
      const phrase = assembleInhalationInstruction(item as any);
      if (phrase) compactParts.push(phrase);
    } else if (isNutrition) {
      const sub: NonNullable<PrescriptionItem['nutritionType']> =
        item.nutritionType ?? detectNutritionType(item.name) ?? 'diet_enteral';
      const subLabel: Record<NonNullable<PrescriptionItem['nutritionType']>, string> = {
        diet_enteral: 'Enteral',
        diet_oral: 'Oral',
        water: 'Água',
        npt: 'NPT',
        zero: 'Jejum',
      };
      compactParts.push(subLabel[sub]);

      if (sub === 'diet_enteral' || sub === 'diet_oral') {
        if (item.nutVolDay) compactParts.push(`${item.nutVolDay} mL/dia`);
        if (sub === 'diet_enteral' && item.infusionRate) compactParts.push(`${item.infusionRate} mL/h`);
        if (item.nutMode) compactParts.push(item.nutMode);
        if (item.nutFraction) compactParts.push(item.nutFraction);
        if (item.nutNightPause) compactParts.push(`pausa ${item.nutNightPause}`);
        if (item.nutBedHead) compactParts.push(`cab ${item.nutBedHead}`);
        if (sub === 'diet_oral' && item.nutConsistency) {
          // Mostra só o nome da consistência, sem o sufixo IDDSI
          compactParts.push(item.nutConsistency.replace(/\s*\(IDDSI[^)]*\)/i, ''));
        }
      } else if (sub === 'water') {
        if (item.nutWaterVolPerAdmin) compactParts.push(`${item.nutWaterVolPerAdmin}/adm`);
        if (item.nutWaterFreq) compactParts.push(item.nutWaterFreq);
        if (item.nutVolDay) compactParts.push(`meta ${item.nutVolDay} mL/24h`);
      } else if (sub === 'npt') {
        if (item.volumeTotal) compactParts.push(`vol ${item.volumeTotal} mL`);
        if (item.infusionRate) compactParts.push(`${item.infusionRate} mL/h`);
        if (item.infusionTime) {
          const u = item.infusionTimeUnit === 'h' ? 'h' : 'min';
          compactParts.push(`correr em ${item.infusionTime}${u}`);
        }
        if (item.nutAccess) compactParts.push(item.nutAccess);
      } else if (sub === 'zero') {
        if (item.nutZeroReason) compactParts.push(item.nutZeroReason);
      }
    } else if (isHydration) {
      // Frase única, em corrida, orientada à enfermagem
      const phases = intervalToPhases(item.posology);
      const interval = item.posology || '24/24h';
      const vol = parseFloat(item.volumeTotal || '0') || 0;
      const total24 = vol * phases;
      const tVal = item.infusionTime || '';
      const tUnitH = item.infusionTimeUnit === 'h' ? 'h' : 'min';
      const rateLabel = item.infusionMode === 'gts' ? 'gts/min' : 'mL/h';
      const rate = item.infusionRate ? `${item.infusionRate} ${rateLabel}` : '';
      const phrase = [
        vol ? `${vol}mL/fase` : '',
        `${phases} fase${phases > 1 ? 's' : ''} (${interval})`,
        tVal ? `correr em ${tVal}${tUnitH}` : '',
        rate ? `(${rate})` : '',
        total24 ? `· total ${total24}mL/24h` : '',
      ].filter(Boolean).join(' · ');
      if (phrase) compactParts.push(phrase);
    } else {
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
    }
    // Route + posology inline (skip posology for hydration since interval já está na frase)
    const routePosology: string[] = [];
    if (item.route && item.route !== '-' && !isInhalation && !isNutrition) routePosology.push(item.route);
    if (!isHydration && !isInhalation && !isNutrition && item.posology && item.posology !== '-') routePosology.push(item.posology);


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
              <span className="text-muted-foreground/50 mx-1">|</span>
              {compactParts.join(' | ')}
            </span>
          )}
          {routePosology.length > 0 && (
            <span className="text-[10px] font-medium text-foreground/70 shrink-0">
              <span className="text-muted-foreground/50 mx-1">|</span>
              {routePosology.join(' | ')}
            </span>
          )}
          <MedicationFlagChips name={item.name} className="shrink-0" size="xs" />
          {item.isExtra && (
            <Badge variant="outline" className="text-[8px] px-1 shrink-0 bg-muted/50 text-muted-foreground border-border/50">EXTRA</Badge>
          )}
          {item.flags.length > 0 && item.flags.map(fk => {
            const f = PRESCRIPTION_FLAGS.find(pf => pf.key === fk);
            return f ? <Badge key={fk} variant="outline" className="text-[8px] px-1 shrink-0 text-muted-foreground border-border/50">{f.label}</Badge> : null;
          })}
        </div>
        {/* Aprazamento removido — feito manualmente pela enfermagem */}
        <ItemActions />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`prescription-item-${item.id}`}
      className={cn(
        "group relative rounded-lg border transition-all",
        item.status === 'suspended'
          ? "border-destructive/30 bg-destructive/5 opacity-60"
          : "border-border/50 bg-card/50 hover:border-primary/20",
        item.highAlert && item.status !== 'suspended' && "border-red-300/50 bg-red-50/30 dark:bg-red-950/10",
        selected && "ring-2 ring-primary/40 border-primary/30",
        isDragging && "shadow-lg",
      )}
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
            <MedicationFlagChips name={item.name} size="sm" />
            {(() => {
              const ev = getEvidenceSuggestion(item.name);
              if (!ev) return null;
              const apply = () => {
                const isEmpty = (v?: string) => !v || !v.trim() || v.trim() === '-';
                if (ev.defaultDose && isEmpty(item.dose)) onUpdate(item.id, 'dose', ev.defaultDose);
                if (ev.defaultRoute && isEmpty(item.route)) onUpdate(item.id, 'route', ev.defaultRoute);
                if (ev.defaultPosology && isEmpty(item.posology)) onUpdate(item.id, 'posology', ev.defaultPosology);
                if (ev.diluent && isEmpty(item.diluent)) onUpdate(item.id, 'diluent', ev.diluent);
                if (ev.volumeTotal && isEmpty(item.volumeTotal)) onUpdate(item.id, 'volumeTotal', ev.volumeTotal);
                if (ev.infusionTime && isEmpty(item.infusionTime)) onUpdate(item.id, 'infusionTime', ev.infusionTime);
                if (ev.infusionTimeUnit) onUpdate(item.id, 'infusionTimeUnit', ev.infusionTimeUnit);
                toast.success('Sugestão aplicada', { description: `Fonte: ${ev.source}` });
              };
              return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/50 border border-border/50 dark:bg-muted/20">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[10px] text-muted-foreground font-medium px-0.5 cursor-help uppercase tracking-wide">{ev.source}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      <div className="space-y-1">
                        {ev.defaultDose && <div><b>Dose:</b> {ev.defaultDose}</div>}
                        {ev.defaultRoute && <div><b>Via:</b> {ev.defaultRoute}</div>}
                        {ev.defaultPosology && <div><b>Posologia:</b> {ev.defaultPosology}</div>}
                        {ev.diluent && <div><b>Diluente:</b> {ev.diluent}</div>}
                        {ev.volumeTotal && <div><b>Vol total:</b> {ev.volumeTotal} mL</div>}
                        {ev.infusionTime && <div><b>Tempo:</b> {ev.infusionTime}{ev.infusionTimeUnit || 'min'}</div>}
                        {ev.notes && <div className="text-muted-foreground">{ev.notes}</div>}
                        <div className="text-muted-foreground italic pt-1">Fonte: {ev.source}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); apply(); }}
                    className="h-5 px-2 text-[10px] rounded border-border/60 text-foreground/80 hover:bg-muted hover:text-foreground"
                  >
                    Sugerir
                  </Button>
                </span>
              );
            })()}
            {item.isExtra && (
              <Badge variant="outline" className="text-[9px] px-1.5 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">EXTRA</Badge>
            )}
            {item.status === 'suspended' && (
              <Badge variant="destructive" className="text-[9px] px-1.5">Suspenso</Badge>
            )}
            {isLocked && item.status !== 'suspended' && (
              <Badge variant="outline" className="text-[9px] px-1.5 bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                VALIDADO · BLOQUEADO
              </Badge>
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
          <div
            {...(isLocked ? ({ inert: '' } as any) : {})}
            className={cn(isLocked && "opacity-80")}
            aria-disabled={isLocked || undefined}
          >
          {item.status === 'active' && item.category === 'nutrition' && (
            <NutritionFields item={item} onUpdate={onUpdate} />
          )}
          {item.status === 'active' && item.category === 'hydration' && (
            <HydrationFields item={item} onUpdate={onUpdate} />
          )}
          {item.status === 'active' && item.category === 'inhalation' && (
            <InhalationFields item={item as any} onUpdate={onUpdate} />
          )}
          {item.status === 'active' && item.category !== 'nutrition' && item.category !== 'hydration' && item.category !== 'inhalation' && (() => {
            const ptype = inferPresentationType(item.presentation, item.route, item.name);
            const renderInfusion = showInfusionBlock(ptype);
            const renderDiluent = showDiluentRow(ptype);
            const evidence = getEvidenceSuggestion(item.name);
            const applyEvidence = () => {
              if (!evidence) return;
              const isEmpty = (v?: string) => !v || !v.trim() || v.trim() === '-';
              if (evidence.defaultDose && isEmpty(item.dose)) onUpdate(item.id, 'dose', evidence.defaultDose);
              if (evidence.defaultRoute && isEmpty(item.route)) onUpdate(item.id, 'route', evidence.defaultRoute);
              if (evidence.defaultPosology && isEmpty(item.posology)) onUpdate(item.id, 'posology', evidence.defaultPosology);
              if (evidence.diluent && isEmpty(item.diluent)) onUpdate(item.id, 'diluent', evidence.diluent);
              if (evidence.volumeTotal && isEmpty(item.volumeTotal)) onUpdate(item.id, 'volumeTotal', evidence.volumeTotal);
              if (evidence.infusionTime && isEmpty(item.infusionTime)) onUpdate(item.id, 'infusionTime', evidence.infusionTime);
              if (evidence.infusionTimeUnit) onUpdate(item.id, 'infusionTimeUnit', evidence.infusionTimeUnit);
              toast.success('Sugestão aplicada', { description: `Fonte: ${evidence.source}` });
            };
            return (
            <>
              {/* Bulário movido para o header (próximo ao nome da medicação) */}
              {/* ===== Container integrado: 3 linhas de edição com fundo único ===== */}
              <div className={cn(getCategoryContainerClass(item.category), getCategoryFieldAccent(item.category).descendantOverrides, "space-y-2", item.category === 'antimicrobial' && "atb-themed")}>
              {/* ATB Header — campos regulatórios editáveis inline (início, duração, sítio) */}
              {item.category === 'antimicrobial' && (() => {
                const dayLine = buildAtbDayLine(item);
                return (
                  <div className="flex items-center gap-2 flex-wrap pb-2 mb-1.5 px-2 py-1.5 rounded-md bg-gradient-to-r from-violet-100/70 via-violet-50/60 to-transparent dark:from-violet-950/30 dark:via-violet-950/15 dark:to-transparent border border-violet-200/60 dark:border-violet-800/40 border-l-[3px] border-l-violet-500/80">
                    <div className="flex items-center gap-1.5 text-violet-800 dark:text-violet-200 shrink-0">
                      <div className="flex items-center justify-center h-5 w-5 rounded-md bg-violet-600 text-white shadow-sm shadow-violet-600/30">
                        <Pill className="h-3 w-3" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em]">Antibiótico</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-violet-700/80 dark:text-violet-300/80 font-medium">Início:</span>
                      <Input
                        type="date"
                        value={item.atbStartDate || ''}
                        onChange={(e) => onUpdate(item.id, 'atbStartDate' as any, e.target.value)}
                        className="h-6 text-[11px] bg-white dark:bg-slate-800 border-violet-200/70 dark:border-violet-800/60 w-[124px] px-1.5"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-violet-700/80 dark:text-violet-300/80 font-medium">Duração:</span>
                      <Input
                        type="number"
                        min="1"
                        value={item.atbPlannedDays || ''}
                        onChange={(e) => onUpdate(item.id, 'atbPlannedDays' as any, e.target.value)}
                        className="h-6 text-[11px] bg-white dark:bg-slate-800 border-violet-200/70 dark:border-violet-800/60 w-12 text-center px-1"
                        placeholder="—"
                      />
                      <span className="text-[10px] text-violet-700/70 dark:text-violet-300/70">dias</span>
                    </div>
                    <div className="flex items-center gap-1 flex-1 min-w-[160px]">
                      <span className="text-[10px] text-violet-700/80 dark:text-violet-300/80 font-medium shrink-0">Sítio:</span>
                      <Input
                        value={item.atbInfectionSite || ''}
                        onChange={(e) => onUpdate(item.id, 'atbInfectionSite' as any, e.target.value)}
                        className="h-6 text-[11px] bg-white dark:bg-slate-800 border-violet-200/70 dark:border-violet-800/60 flex-1 px-1.5"
                        placeholder="ex.: pneumonia comunitária"
                      />
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                      {dayLine && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white border border-violet-700/40 shadow-sm shadow-violet-600/20">
                          {dayLine.split(' — ')[0]} · {dayLine.match(/— (\d{2}\/\d{2})/)?.[1] || ''}
                        </span>
                      )}
                      {onOpenAntimicrobialGuide && (
                        <button
                          type="button"
                          onClick={onOpenAntimicrobialGuide}
                          className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold bg-violet-600 hover:bg-violet-700 text-white border border-violet-700/50 transition-colors"
                          title="Abrir Guia ATM (CCIH / Norma Zero)"
                        >
                          <Shield className="h-3 w-3" />
                          Abrir Guia ATM
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
              {/* Row 1 removida — Int. (intervalo) movido para o final da Row 2 */}

              {/* Row 1.5: Reconstituição (pó liofilizado) — só quando catálogo indica */}
              {renderDiluent && (() => {
                const recon = getReconstitutionDefault(item.name);
                if (!recon.required) return null;
                return (
                  <div className="flex items-center gap-1.5 flex-wrap px-2 py-1 rounded-md bg-muted/40 dark:bg-slate-900/30 border border-border/60">
                    <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wide">Reconstituir</span>
                    <span className="text-[10px] text-muted-foreground">com</span>
                    <Input
                      value={item.reconstitutionVolume ?? recon.volumeMl ?? ''}
                      onChange={(e) => onUpdate(item.id, "reconstitutionVolume", e.target.value)}
                      placeholder="mL"
                      className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-14 text-center"
                    />
                    <span className="text-[10px] text-muted-foreground">mL de</span>
                    <Select
                      value={item.reconstitutionSolvent ?? recon.solvent ?? ''}
                      onValueChange={(v) => onUpdate(item.id, "reconstitutionSolvent", v)}
                    >
                      <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-36"><SelectValue placeholder="solvente" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AD" className="text-xs">AD</SelectItem>
                        <SelectItem value="SF 0,9%" className="text-xs">SF 0,9%</SelectItem>
                        <SelectItem value="SG 5%" className="text-xs">SG 5%</SelectItem>
                        <SelectItem value="próprio diluente" className="text-xs">Próprio diluente do fabricante</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] text-muted-foreground italic ml-auto">Sugestão do catálogo · ajustável</span>
                  </div>
                );
              })()}

              {/* Row 2: Qtd → Forma → Diluente → Vol. dil → Via → Int. */}
              <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium shrink-0">Qtd:</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={item.quantity || ''}
                    onChange={(e) => {
                      onUpdate(item.id, "quantity", e.target.value);
                      const tempItem = { ...item, quantity: e.target.value };
                      const autoVol = calcVolumeTotal(tempItem);
                      if (autoVol) {
                        onUpdate(item.id, "volumeTotal", autoVol);
                        const autoConc = calcConcentration({ ...tempItem, volumeTotal: autoVol });
                        if (autoConc) onUpdate(item.id, "concentration", autoConc);
                      }
                    }}
                    className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 px-1.5 text-center focus-visible:ring-1 focus-visible:ring-primary"
                    style={{ width: `${Math.max(2.75, (String(item.quantity || '').length || 1) * 0.7 + 1.5)}ch`, minWidth: '3rem' }}
                    placeholder="1"
                    title={item.quantityUnit ? `Quantidade em ${item.quantityUnit}` : 'Quantidade'}
                  />
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium shrink-0 ml-1">Forma:</span>
                  <Select value={item.quantityUnit || ''} onValueChange={(v) => onUpdate(item.id, "quantityUnit", v)}>
                    <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-[78px] font-semibold focus:ring-1 focus:ring-primary" title={item.quantityUnit || 'Forma/unidade'}>
                      <SelectValue placeholder="—">{quantityUnitShort(item.quantityUnit)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {QUANTITY_UNITS.map(u => (
                        <SelectItem key={u} value={u} className="text-xs">
                          <span className="font-semibold mr-1.5">{quantityUnitShort(u)}</span>
                          <span className="text-muted-foreground">— {u}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {renderDiluent && <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Diluente:</span>
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
                    <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-28 focus:ring-1 focus:ring-primary"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="sem_diluente" className="text-xs font-medium">Sem diluente</SelectItem>
                      <SelectItem value="diluente_proprio" className="text-xs font-medium">Diluente próprio</SelectItem>
                      <SelectItem value="SF0,9%" className="text-xs">SF 0,9%</SelectItem>
                      <SelectItem value="SG5%" className="text-xs">SG 5%</SelectItem>
                      <SelectItem value="SG10%" className="text-xs">SG 10%</SelectItem>
                      <SelectItem value="RL" className="text-xs">Ringer Lactato</SelectItem>
                      <SelectItem value="AD" className="text-xs">AD</SelectItem>
                      <SelectItem value="SF0,45%" className="text-xs">SF 0,45%</SelectItem>
                      <SelectItem value="outro" className="text-xs">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {item.diluent && item.diluent !== 'sem_diluente' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Vol. dil:</span>
                  <Input value={item.diluentVolume || ''} onChange={(e) => {
                    onUpdate(item.id, "diluentVolume", e.target.value);
                    const tempItem = { ...item, diluentVolume: e.target.value };
                    const autoVol = calcVolumeTotal(tempItem);
                    if (autoVol) onUpdate(item.id, "volumeTotal", autoVol);
                    const tempItem2 = { ...tempItem, volumeTotal: autoVol || item.volumeTotal || '' };
                    const autoConc = calcConcentration(tempItem2);
                    if (autoConc) onUpdate(item.id, "concentration", autoConc);
                  }} className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-16 text-center focus-visible:ring-1 focus-visible:ring-primary" placeholder="mL" />
                </div>
                )}
                </>}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Via:</span>
                  <Select value={item.route} onValueChange={(v) => {
                    onUpdate(item.id, "route", v);
                    if (isIVRoute(v) && !item.infusionMode) {
                      onUpdate(item.id, "infusionMode", 'BIC');
                    }
                  }}>
                    <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-20 font-semibold focus:ring-1 focus:ring-primary">
                      <SelectValue>{routeShort(item.route)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {ROUTES.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          <span className="font-semibold mr-1.5">{routeShort(r)}</span>
                          <span className="text-muted-foreground">— {r}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Int.:</span>
                  <Select value={item.posology} onValueChange={(v) => onUpdate(item.id, "posology", v)}>
                    <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 font-semibold w-28 focus:ring-1 focus:ring-primary"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent className="max-h-72">{POSOLOGIES.map((p) => (<SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>

              {renderInfusion && (
              <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border/40">
                <Droplets className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wide">Infusão EV</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Vol. final:</span>
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
                    className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-16 text-center font-medium"
                    placeholder="opcional"
                    title="Volume final da solução (medicamento + diluente). Auto-calculado quando possível."
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
                    className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-14 text-center"
                    placeholder="—"
                  />
                  <Select value={item.infusionTimeUnit || 'min'} onValueChange={(v) => {
                    onUpdate(item.id, "infusionTimeUnit", v);
                    if (item.volumeTotal && item.infusionTime) {
                      const autoRate = calcRateFromTime(item.volumeTotal, item.infusionTime, item.infusionMode || 'BIC', v as 'min' | 'h');
                      if (autoRate) onUpdate(item.id, "infusionRate", autoRate);
                    }
                  }}>
                    <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-16">
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
                    className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-16 text-center font-medium"
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
                    <SelectTrigger className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-24">
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
                  <span className="text-[10px] text-muted-foreground font-medium">Conc. final:</span>
                  <Input
                    value={item.concentration || ''}
                    onChange={(e) => onUpdate(item.id, "concentration", e.target.value)}
                    className="h-6 text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-24 text-center"
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
              )}
              </div>
              {/* ===== Fim do container integrado ===== */}

              {/* A.1 — Chip de concentração final calculada (somente expandido) */}
              {(() => {
                const conc = calcConcentration(item);
                if (!conc) return null;
                return (
                  <div className="flex items-center gap-1.5 px-2.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/50 bg-muted/40 text-[10px] font-medium text-muted-foreground">
                      {item.category === 'antimicrobial' && <span className="atb-subchip">Concentração</span>}
                      {item.category !== 'antimicrobial' && <>Conc. final:</>}
                      <span className="text-foreground font-semibold">{conc}</span>
                    </span>
                  </div>
                );
              })()}

              {/* Auto-synced preparation description */}
              {(() => {
                const autoDesc = buildPrepDescription(item);
                return autoDesc ? (
                  <p className="text-[11px] text-muted-foreground italic px-2.5 py-1 rounded bg-muted/20 border border-border/20 leading-relaxed">
                    {autoDesc}
                  </p>
                ) : null;
              })()}
              {/* ATB day badge agora vive no header inline (acima) — faixa removida */}
              {/* Additional manual notes */}
              <Input
                value={item.instructions}
                onChange={(e) => onUpdate(item.id, "instructions", e.target.value)}
                className="h-7 text-[11px] bg-muted/10 border-border/20 text-muted-foreground italic pl-2.5 focus:text-foreground focus:not-italic"
                placeholder="Observações adicionais..."
              />
            </>
            );
          })()}
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
    </div>
  );
});

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
  initialCategory = 'all',
  patient,
  parentPrescriptionId,
  parentPrescriptionVersion,
  hospitalName,
  doctorName,
  doctorCrm,
  sectorLabel,
}: {
  open: boolean;
  onClose: () => void;
  onAddItems: (items: PrescriptionItem[]) => void;
  allMedications: MedicationEntry[];
  initialCategory?: PrescriptionCategory | 'all';
  patient?: PatientHeader;
  parentPrescriptionId?: string | null;
  parentPrescriptionVersion?: number | null;
  hospitalName?: string;
  doctorName?: string;
  doctorCrm?: string;
  sectorLabel?: string;
}) {
  const [extraItems, setExtraItems] = useState<PrescriptionItem[]>([]);
  const [freeText, setFreeText] = useState("");

  // Filter catalog by chosen category (if not "all")
  const filteredMedications = useMemo(
    () => initialCategory === 'all'
      ? allMedications
      : allMedications.filter(m => m.category === initialCategory),
    [allMedications, initialCategory],
  );

  const categoryConfigLabel = initialCategory !== 'all'
    ? CATEGORY_CONFIG[initialCategory]?.label
    : undefined;

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
    // Sprint B — perfil de infusão (apenas para EV, preenche campos vazios)
    const finalItem = isIV
      ? applyInfusionProfileDefaults(item, getInfusionProfile(med.name))
      : item;
    setExtraItems(prev => [...prev, finalItem]);
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

  const duplicateExtraItem = (id: string) => {
    setExtraItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      if (idx < 0) return prev;
      const src = prev[idx];
      const copy: PrescriptionItem = { ...src, id: crypto.randomUUID() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const reorderExtraItems = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setExtraItems(prev => {
      const oldIndex = prev.findIndex(i => i.id === active.id);
      const newIndex = prev.findIndex(i => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const extraSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const noop = () => {};

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

  const handlePrintIsolated = async () => {
    if (extraItems.length === 0) {
      toast.error("Adicione pelo menos 1 item antes de imprimir");
      return;
    }
    if (!patient) {
      toast.error("Contexto do paciente indisponível para impressão");
      return;
    }
    try {
      await printExtraPrescription({
        patient: {
          name: patient.name,
          bed: patient.bed,
          unit: patient.unit,
          age: patient.age,
          record: patient.record,
          weight: patient.weight,
          allergies: patient.allergies,
        },
        items: extraItems.map(i => ({
          id: i.id,
          name: i.name,
          presentation: i.presentation,
          dose: i.dose,
          route: i.route,
          posology: i.posology,
          schedule: i.schedule,
          instructions: i.instructions,
          flags: i.flags,
          highAlert: i.highAlert,
          category: i.category,
          // Regulatório
          securityCategory: i.securityCategory,
          controlled: i.controlled,
          controlledList: i.controlledList,
          doubleCheck: i.doubleCheck,
          // Quantidade & preparo IV
          quantity: i.quantity,
          quantityUnit: i.quantityUnit,
          diluent: i.diluent,
          diluentVolume: i.diluentVolume,
          accessType: i.accessType,
          infusionTime: i.infusionTime,
          infusionTimeUnit: i.infusionTimeUnit,
          infusionMode: i.infusionMode,
          infusionRate: i.infusionRate,
          volumeTotal: i.volumeTotal,
          concentration: i.concentration,
          // Inalação
          inhalationMode: i.inhalationMode,
          nebDose: i.nebDose,
          nebDoseUnit: i.nebDoseUnit,
          oxygenFlow: i.oxygenFlow,
          stageDuration: i.stageDuration,
          continuousDuration: i.continuousDuration,
          inhalationInterface: i.inhalationInterface,
          puffs: i.puffs,
          spacer: i.spacer,
          gargle: i.gargle,
          inhalationOrientation: i.inhalationOrientation,
          // Nutrição
          nutVolDay: i.nutVolDay,
          nutMode: i.nutMode,
          nutFraction: i.nutFraction,
          nutNightPause: i.nutNightPause,
          nutBedHead: i.nutBedHead,
          nutAccess: i.nutAccess,
          nutComposition: i.nutComposition,
          nutMonitoring: i.nutMonitoring,
          nutResidualCheck: i.nutResidualCheck,
          nutWaterVolPerAdmin: i.nutWaterVolPerAdmin,
          nutWaterFreq: i.nutWaterFreq,
          nutZeroReason: i.nutZeroReason,
          // Insulinoterapia
          insulinPlan: i.insulinPlan,
        })),
        parentPrescriptionId,
        parentPrescriptionVersion,
        hospitalName,
        sectorLabel: sectorLabel || "Prescrição Médica — Anexo Extra",
        doctorName,
        doctorCrm,
        categoryLabel: categoryConfigLabel,
      });
    } catch (err: any) {
      toast.error("Erro ao gerar PDF da prescrição extra", { description: err?.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Prescrição Extra
            {categoryConfigLabel && (
              <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800 ml-1">
                {categoryConfigLabel}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Adicione medicações avulsas durante o plantão. Itens marcados como <strong>"Agora"</strong> não serão renovados automaticamente.
            Itens com aprazamento (de horário) serão incorporados à rotina na próxima renovação.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="space-y-2">
          <MedicationAutocomplete
            source={filteredMedications}
            onSelect={addFromAutocomplete}
            placeholder={categoryConfigLabel ? `Buscar em ${categoryConfigLabel.toLowerCase()}...` : "Buscar medicação para prescrição extra..."}
            category={initialCategory !== 'all' ? initialCategory : undefined}
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

        {/* Items list — usa o MESMO row do corpo principal para respeitar campos
            específicos por categoria (nutrição, hidratação, inalação, MAV, meds IV...) */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
          {extraItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Syringe className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhum item adicionado</p>
              <p className="text-xs">Use a busca acima para adicionar medicações</p>
            </div>
          ) : (
            <DndContext
              sensors={extraSensors}
              collisionDetection={closestCenter}
              onDragEnd={reorderExtraItems}
            >
              <SortableContext
                items={extraItems.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {extraItems.map((item, idx) => (
                    <SortablePrescriptionItemRow
                      key={item.id}
                      item={item}
                      index={idx}
                      onUpdate={updateExtraItem}
                      onRemove={removeExtraItem}
                      onToggleFlag={toggleExtraFlag}
                      isSimple={false}
                      isCompact={false}
                      selected={false}
                      onToggleSelect={noop}
                      onDuplicate={duplicateExtraItem}
                      onRequestSuspend={noop}
                      onReactivate={noop}
                      onToggleValidation={noop}
                      isPastRenewalTime={false}
                      prescriptionLocked={false}
                      missingFields={[]}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintIsolated}
            disabled={extraItems.length === 0 || !patient}
            className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950/30"
            title="Imprime esta prescrição extra como anexo isolado (Norma Zero)"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir Anexo
          </Button>
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
      {/* Aprazamento manual — preenchido pela enfermagem */}
      <td style={{
        width: '220px',
        borderBottom: '0.5px solid #e2e8f0', borderRight: '0.5px solid #e2e8f0',
        verticalAlign: 'top', backgroundColor: '#fff', padding: '4px 6px',
      }}>
        <div style={{ minHeight: '36px' }} />
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
    <div className="fixed bottom-20 right-5 z-[70] flex items-center gap-2 px-3 py-2.5 rounded-xl bg-background/95 backdrop-blur-sm border border-border shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-300">
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
  const currentDoctor = useCurrentDoctor();
  const [step, setStep] = useState<1 | 2>(1);
  const [doctorName, setDoctorName] = useState("");
  const [crm, setCrm] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  // Prefill com dados do médico logado (full_name + CRM do perfil)
  useEffect(() => {
    if (!open) return;
    if (!doctorName && currentDoctor.fullName) setDoctorName(currentDoctor.fullName);
    if (!crm && currentDoctor.crm) setCrm(currentDoctor.crm.replace(/\D/g, ""));
  }, [open, currentDoctor.fullName, currentDoctor.crm]);

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
  const { getDbProtocols } = useMedicationProtocols();
  const { byCategory: UNIFIED_CATALOG, findControlledByName: findControlledCatalog } = useUnifiedMedicationCatalog();
  const { state: sidebarState, isMobile: sidebarIsMobile } = useSidebar();
  const sidebarCollapsed = sidebarState === "collapsed";

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
  // Conjunto de datas (yyyy-MM-dd) com prescrição salva — alimenta as bolinhas no calendário
  const [prescriptionDateKeys, setPrescriptionDateKeys] = useState<Set<string>>(new Set());

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
  const [extraChooserOpen, setExtraChooserOpen] = useState(false);
  const [extraInitialCategory, setExtraInitialCategory] = useState<PrescriptionCategory | 'all'>('all');

  // Pop-up de confirmação para "Nova" prescrição
  const [newRxChoiceOpen, setNewRxChoiceOpen] = useState(false);

  // Antimicrobial Guide & Psychotropic Form
  const [antimicrobialGuideOpen, setAntimicrobialGuideOpen] = useState(false);
  const [atmStatusOpen, setAtmStatusOpen] = useState(false);
  const [psychotropicFormOpen, setPsychotropicFormOpen] = useState(false);
  const [psychotropicFormMode, setPsychotropicFormMode] = useState<'edit' | 'print_direct'>('edit');
  const [tevProtocolOpen, setTevProtocolOpen] = useState(false);
  const [pendingAntimicrobialMed, setPendingAntimicrobialMed] = useState<MedicationEntry | null>(null);
  // Modo de nova ATB vindo do AtmStatusDialog ('acrescimo' | 'troca' | 'inicial' | null)
  const [pendingAtbMode, setPendingAtbMode] = useState<'acrescimo' | 'troca' | 'inicial' | null>(null);
  const [highAlertGuideOpen, setHighAlertGuideOpen] = useState(false);
  // Insulin therapy assistant
  const [insulinDialogOpen, setInsulinDialogOpen] = useState(false);
  const [pendingInsulinMed, setPendingInsulinMed] = useState<MedicationEntry | null>(null);
  const [editingInsulinItemId, setEditingInsulinItemId] = useState<string | null>(null);
  const [careCatalogOpen, setCareCatalogOpen] = useState(false);
  const [nutritionWizardOpen, setNutritionWizardOpen] = useState(false);
  const [hydrationWizardOpen, setHydrationWizardOpen] = useState(false);
  const [replacementWizardOpen, setReplacementWizardOpen] = useState(false);
  const [itemAssistantTargetId, setItemAssistantTargetId] = useState<string | null>(null);
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

  // Categorias com bloqueio próprio (não seguem dose/via/posologia padrão)
  const NON_STANDARD_CATEGORIES = useMemo(
    () => new Set(['nutrition', 'care', 'nonstandard', 'hydration', 'inhalation', 'hemotherapy']),
    []
  );

  // Calcula quais campos obrigatórios estão faltando em um item ativo.
  // Regras adaptativas POR CATEGORIA — só bloqueia o que faz sentido para aquele tipo.
  const getItemMissingFields = useCallback((item: PrescriptionItem): string[] => {
    if (item.status !== 'active') return [];
    const missing: string[] = [];
    const empty = (v?: string) => !v || !v.trim() || v.trim() === '-';

    if (item.category === 'inhalation') {
      const mode = (item as any).inhalationMode || 'nebulization';
      if (mode === 'nebulization' || mode === 'nebulization_continuous') {
        if (empty((item as any).nebDose)) missing.push('dose');
        if (empty((item as any).inhalationInterface)) missing.push('interface');
      } else if (mode === 'pmdi' || mode === 'dpi') {
        if (empty((item as any).puffs)) missing.push(mode === 'pmdi' ? 'puffs' : 'inalações');
      }
      if (empty(item.posology)) missing.push('frequência');
    } else if (item.category === 'hydration') {
      if (empty(item.volumeTotal)) missing.push('volume / fase');
      if (empty(item.posology)) missing.push('fases / intervalo');
      if (empty(item.infusionTime) && empty(item.infusionRate)) missing.push('tempo de infusão');
    } else if (item.category === 'nutrition') {
      // Nutrição enteral/parenteral exige no mínimo a frequência/meta
      if (empty(item.posology) && empty((item as any).nutVolDay) && empty(item.volumeTotal)) {
        missing.push('volume ou meta');
      }
    } else if (item.category === 'care' || item.category === 'nonstandard') {
      // Cuidados e itens não-padronizados: basta um nome/orientação não vazio (já garantido)
    } else if (item.category === 'hemotherapy') {
      if (empty(item.dose)) missing.push('produto/quantidade');
      if (empty(item.posology)) missing.push('tempo de transfusão');
    } else {
      // Padrão (medication / high_alert) — adapta por presentationType
      const ptype = inferPresentationType(item.presentation, item.route, item.name);
      const required = getRequiredFields(ptype);
      if (required.includes('dose') && empty(item.dose)) missing.push('dose');
      if (required.includes('via') && empty(item.route)) missing.push('via');
      if (required.includes('posologia') && empty(item.posology)) missing.push('posologia');
      if (required.includes('diluente') && empty(item.diluent)) missing.push('diluente');
      // Quando há diluente real, exige o volume do veículo (segurança da diluição)
      if (item.diluent && item.diluent !== 'sem_diluente' && empty(item.diluentVolume)) {
        missing.push('volume do diluente');
      }
      // Tempo/vazão só obrigatórios em infusão contínua de alto alerta (BIC vasoativa/sedação)
      const isContinuousHighAlert = ptype === 'iv_continuous' && (item.highAlert || (item.infusionMode || 'BIC') === 'BIC');
      if (isContinuousHighAlert && empty(item.infusionTime) && empty(item.infusionRate)) {
        missing.push('tempo ou vazão');
      }
    }

    // Controlado (Portaria 344) precisa de tipo de notificação resolvido — vale para qualquer categoria
    const cat = findControlledCatalog?.(item.name);
    if (cat?.controlled && !cat.notification_type) missing.push('tipo de notificação');
    return missing;
  }, [NON_STANDARD_CATEGORIES, findControlledCatalog]);

  // Mapa id → campos faltando, recomputado quando items mudam
  const itemMissingMap = useMemo(() => {
    const m = new Map<string, string[]>();
    items.forEach(i => {
      const miss = getItemMissingFields(i);
      if (miss.length > 0) m.set(i.id, miss);
    });
    return m;
  }, [items, getItemMissingFields]);

  const blockedValidationItems = useMemo(
    () => items.filter(i => itemMissingMap.has(i.id)),
    [items, itemMissingMap]
  );

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

  // Persiste o array de itens IMEDIATAMENTE no Supabase.
  // - mode 'update': atualiza a linha atual (usado para suspensão/reativação/validação intra-dia).
  // - mode 'newVersion': cria nova linha vinculada via parent_id e bump de version
  //   (usado quando o ato altera o conteúdo clínico do dia — ex.: revalidação após o corte 05h
  //   preserva o snapshot do dia anterior para auditoria/CCIH).
  const persistItems = useCallback(async (
    nextItems: PrescriptionItem[],
    opts: { mode?: 'update' | 'newVersion'; reason?: string; sigOverride?: DigitalSignature | null } = {}
  ) => {
    if (!currentHospital || !currentState || !patient.name.trim()) {
      toast.error("Não foi possível salvar a prescrição", {
        description: "Falta paciente/hospital ativo. Recarregue a página com o paciente correto antes de prosseguir.",
      });
      throw new Error('persistItems: missing patient/hospital context');
    }
    const mode = opts.mode || 'update';
    const sig = opts.sigOverride !== undefined ? opts.sigOverride : digitalSignature;
    // Departamento real do paciente (UCC, UTI, etc.) em vez do hardcoded
    const resolvedDepartment =
      (patient.unit && patient.unit.trim()) ||
      (initialPatientSector && (sectorMapInit[initialPatientSector] || initialPatientSector)) ||
      'GERAL';
    try {
      const basePayload = {
        patient_name: patient.name.trim(),
        patient_data: patient as any,
        items: nextItems as any,
        digital_signature: sig as any,
        status: sig ? 'signed' : 'draft',
        department: resolvedDepartment,
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        created_by: user?.id || null,
      };

      if (mode === 'newVersion' && currentPrescriptionId) {
        // Busca version atual para incrementar
        let nextVersion = 2;
        try {
          const { data: parentData } = await supabase
            .from('prescriptions')
            .select('version')
            .eq('id', currentPrescriptionId)
            .single();
          nextVersion = ((parentData as any)?.version || 1) + 1;
        } catch {}
        const { data, error } = await supabase
          .from('prescriptions')
          .insert({
            ...basePayload,
            version: nextVersion,
            parent_id: currentPrescriptionId,
          } as any)
          .select('id')
          .single();
        if (error) throw error;
        if (data) {
          setCurrentPrescriptionId(data.id);
        }
        return;
      }

      if (currentPrescriptionId) {
        const { error } = await supabase
          .from('prescriptions')
          .update(basePayload)
          .eq('id', currentPrescriptionId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('prescriptions')
          .insert(basePayload)
          .select('id')
          .single();
        if (error) throw error;
        if (data) setCurrentPrescriptionId(data.id);
      }
    } catch (err: any) {
      console.error('[persistItems] persist failed', err);
      toast.error("Erro ao persistir alteração", {
        description: "A alteração ficou apenas em memória. Salve manualmente para garantir.",
      });
      throw err;
    }
  }, [currentHospital, currentState, patient, digitalSignature, currentPrescriptionId, user?.id, initialPatientSector]);

  // Aplica a validação a um conjunto (sem pedir senha) — usado tanto pelo caminho rápido
  // quanto pelo executeValidation (após senha).
  // IMPORTANTE: persiste IMEDIATAMENTE no Supabase para garantir imutabilidade
  // entre sessões/setores. Validar = ato definitivo (só pode ser suspenso depois).
  // Após o corte das 05h, revalidar gera NOVA VERSÃO (parent_id) preservando o
  // snapshot do dia anterior (auditoria/CCIH).
  const applyValidation = useCallback((action: { type: 'all' } | { type: 'item'; itemId: string }) => {
    const now = new Date().toISOString();
    let nextItems: PrescriptionItem[] = [];
    let isRevalidationPostCutoff = false;
    setItems(prev => {
      // Detecta revalidação: pelo menos 1 item afetado já tinha validatedAt anterior ao corte 05h de hoje
      const cutoff = setSeconds(setMinutes(setHours(startOfDay(new Date()), 5), 0), 0);
      const isPast = isAfter(new Date(), cutoff);
      const affected = action.type === 'all'
        ? prev.filter(i => i.status === 'active')
        : prev.filter(i => i.id === action.itemId);
      isRevalidationPostCutoff = isPast && affected.some(i => i.validated && i.validatedAt && new Date(i.validatedAt) <= cutoff);

      nextItems = prev.map(item => {
        if (action.type === 'all') {
          return item.status === 'active' ? { ...item, validated: true, validatedAt: now } : item;
        }
        return item.id === action.itemId ? { ...item, validated: true, validatedAt: now } : item;
      });
      return nextItems;
    });

    // Persistência imediata — best-effort, mas crítico para imutabilidade
    persistItems(nextItems, { mode: isRevalidationPostCutoff ? 'newVersion' : 'update' });

    if (action.type === 'all') {
      toast.success(
        isRevalidationPostCutoff ? "Prescrição revalidada (nova versão)" : "Prescrição validada",
        { description: isRevalidationPostCutoff
            ? "Snapshot do dia anterior preservado no histórico."
            : "Todos os itens ativos foram validados e registrados." }
      );
    } else {
      toast.success(isRevalidationPostCutoff ? "Item revalidado (nova versão)" : "Item validado");
    }
  }, [persistItems]);

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
    const hasDiet = items.some(i => i.status === 'active' && i.category === 'nutrition');
    if (!hasDiet) {
      toast.error("Dieta obrigatória", {
        description: "Adicione um item de dieta (incluindo 'Dieta zero / jejum' se aplicável) antes de validar a prescrição.",
      });
      return;
    }
    // Bloqueia validação se houver itens com campos obrigatórios faltando
    if (blockedValidationItems.length > 0) {
      const lines = blockedValidationItems.slice(0, 4).map(i => {
        const miss = itemMissingMap.get(i.id) || [];
        return `• ${i.name}: ${miss.join(', ')}`;
      });
      const extra = blockedValidationItems.length > 4 ? `\n+ ${blockedValidationItems.length - 4} outro(s)` : '';
      toast.error("Validação bloqueada — campos obrigatórios faltando", {
        description: lines.join('\n') + extra,
        duration: 6000,
      });
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
  }, [items, patient.allergies, proceedValidation, blockedValidationItems, itemMissingMap]);

  // Solicita validação individual — checa alertas relativos ao item
  const requestValidateItem = useCallback((id: string) => {
    const miss = itemMissingMap.get(id);
    if (miss && miss.length > 0) {
      toast.error("Validação bloqueada — preencha os campos obrigatórios", {
        description: miss.join(', '),
      });
      return;
    }
    const alerts = runClinicalAlertChecks(items, patient.allergies, { onlyItemId: id });
    if (alerts.length > 0) {
      setPendingAlerts(alerts);
      setPendingValidationAction({ type: 'item', itemId: id });
      setAlertDialogOpen(true);
      return;
    }
    proceedValidation({ type: 'item', itemId: id });
  }, [items, patient.allergies, proceedValidation, itemMissingMap]);

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
          patient_id: asUuidOrNull(patientId) ?? undefined,
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
    const baseItem: PrescriptionItem = {
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
    // Sprint B — perfil de infusão para EV (preenche apenas campos vazios)
    if (isIV) {
      const profile = getInfusionProfile(med.name);
      if (profile) Object.assign(baseItem, applyInfusionProfileDefaults(baseItem, profile));
    }
    // Autofill inhalation defaults from catalog
    if (med.category === 'inhalation') {
      const preset = getInhalationDefaults(med.name);
      if (preset) {
        baseItem.inhalationMode = preset.mode;
        if (preset.nebDose !== undefined) baseItem.nebDose = preset.nebDose;
        if (preset.nebDoseUnit) baseItem.nebDoseUnit = preset.nebDoseUnit;
        if (preset.diluent !== undefined) baseItem.diluent = preset.diluent;
        if (preset.diluentVolume !== undefined) baseItem.diluentVolume = preset.diluentVolume;
        if (preset.oxygenFlow !== undefined) baseItem.oxygenFlow = preset.oxygenFlow;
        if (preset.stageDuration !== undefined) baseItem.stageDuration = preset.stageDuration;
        if (preset.inhalationInterface) baseItem.inhalationInterface = preset.inhalationInterface;
        if (preset.posology) baseItem.posology = preset.posology;
        if (preset.puffs !== undefined) baseItem.puffs = preset.puffs;
        if (preset.spacer !== undefined) baseItem.spacer = preset.spacer;
        if (preset.gargle !== undefined) baseItem.gargle = preset.gargle;
        if (preset.inhalationOrientation) baseItem.inhalationOrientation = preset.inhalationOrientation;
      } else {
        baseItem.inhalationMode = 'nebulization';
      }
    }
    return baseItem;
  };

  const addItem = (med: MedicationEntry, opts?: { fromGlobalSearch?: boolean }) => {
    const fromGlobalSearch = opts?.fromGlobalSearch === true;
    // Track usage for favorites/ranking (best-effort, non-blocking)
    if (med.id && med.category !== 'nonstandard') {
      trackMedicationUse(med.id, med.name, med.category);
    }
    // Antimicrobials ALWAYS go through the Antimicrobial Guide first
    // (único caminho que abre pop-up automático mesmo via busca "Todas")
    if (med.category === 'antimicrobial') {
      setPendingAntimicrobialMed(med);
      setAntimicrobialGuideOpen(true);
      return;
    }
    // Insulinas: abrem o Assistente de Insulinoterapia (pop-up dentro de Medicações)
    // O item só é incorporado à prescrição após o usuário concluir o wizard.
    if (isInsulinMedication(med.name)) {
      setPendingInsulinMed(med);
      setEditingInsulinItemId(null);
      setInsulinDialogOpen(true);
      return;
    }
    const newItem = createItem(med);

    // === Diferenciação regulatória (MAV / Portaria 344 / ambos) ===
    // Consulta o catálogo seed para identificar a categoria de segurança
    // e enriquece o item com as flags regulatórias correspondentes.
    const reg = findRegulatoryInfo(med.name);
    if (reg) {
      newItem.securityCategory = reg.categoria;
      newItem.highAlert = reg.high_alert || newItem.highAlert;
      newItem.controlled = reg.controlled;
      newItem.controlledList = reg.lista_portaria_344;
      newItem.controlledDoc = reg.documento_gerado;
      newItem.doubleCheck = reg.dupla_checagem;
    } else if (med.highAlert) {
      // Catálogo HMDM marcou como MAV mas não está no seed regulatório
      newItem.securityCategory = 'MAV';
      newItem.highAlert = true;
      newItem.doubleCheck = true;
    }
    setItems((prev) => [...prev, newItem]);

    const isMAV = newItem.highAlert === true;
    const isControlled = newItem.controlled === true;
    const docLabel = newItem.controlledDoc;

    // Helper: destaca visualmente o card recém-adicionado (scroll + ring pulsante)
    const highlightNewItem = (ringClass: string) => {
      setTimeout(() => {
        const el = document.getElementById(`prescription-item-${newItem.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-4', ringClass, 'ring-offset-2', 'animate-pulse');
          setTimeout(() => {
            el.classList.remove('ring-4', ringClass, 'ring-offset-2', 'animate-pulse');
          }, 2200);
        }
      }, 80);
    };

    // Sempre garante a categoria expandida no painel
    setExpandedCategories(prev => {
      const n = new Set(prev);
      n.add(med.category);
      return n;
    });

    if (isMAV && isControlled) {
      // ── MAV + Portaria 344 (opioides, midazolam, ketamina) ───────────
      toast.error(`✓ ADICIONADO — ${med.name}`, {
        description: fromGlobalSearch
          ? `ALTA VIGILÂNCIA + CONTROLADO (${newItem.controlledList ?? '344'}). ${docLabel ?? 'Receita controlada'} será gerada na impressão.`
          : `ALTA VIGILÂNCIA + CONTROLADO (${newItem.controlledList ?? '344'}). ${docLabel ?? 'Receita controlada'} será gerada na impressão. Aplicando modelo MAV...`,
        duration: 5000,
      });
      highlightNewItem('ring-red-400');
      // Auto-abre o guia MAV apenas no caminho da categoria MAV
      // (não dispara quando a medicação é selecionada via "Todas")
      if (!fromGlobalSearch) {
        setTimeout(() => setHighAlertGuideOpen(true), 1100);
      }
    } else if (isMAV) {
      // ── Apenas MAV (insulinas, anticoagulantes, eletrólitos, BNM, aminas) ──
      toast.success(`✓ ADICIONADO — ${med.name}`, {
        description: fromGlobalSearch
          ? "ALTA VIGILÂNCIA: dose, diluição e dupla checagem ficam sob sua responsabilidade."
          : "ALTA VIGILÂNCIA: aplicando modelo padronizado (diluição, dose, BIC, dupla checagem)...",
        duration: 4500,
        style: { background: 'hsl(0 84% 60%)', color: 'white' },
      });
      highlightNewItem('ring-red-400');
      if (!fromGlobalSearch) {
        setTimeout(() => setHighAlertGuideOpen(true), 1100);
      }
    } else if (isControlled) {
      // ── Apenas Portaria 344 (benzo VO, Z-drugs, metilfenidato, tramadol, etc.) ──
      toast.warning(`✓ ADICIONADO — ${med.name}`, {
        description: `CONTROLADO Lista ${newItem.controlledList ?? '344'} — ${docLabel ?? 'Receita controlada'} será gerada automaticamente ao imprimir.`,
        duration: 4500,
      });
      highlightNewItem('ring-amber-400');
    } else if (isPsychotropicMedication(med.name)) {
      // Fallback (medicação psicotrópica não mapeada no seed regulatório)
      toast.info(`Psicotrópico identificado: ${med.name}`, {
        description: "A guia de notificação será gerada automaticamente ao imprimir.",
      });
    }

    // Sugestões: combina protocolos clínicos manuais (sepse, TEV, etc.) com
    // protocolos de evidência farmacêutica do catálogo HMDM 2026 (diluição,
    // dose máx, tempo de infusão). Manuais aparecem primeiro pois costumam
    // ser mais acionáveis no contexto clínico.
    const manualProtocols = getProtocolsFor(med.name);
    const dbProtocols = getDbProtocols(med.name);
    const allProtocols = [...manualProtocols, ...dbProtocols];
    if (allProtocols.length > 0) {
      setPosologySuggestion({ itemId: newItem.id, name: med.name, protocols: allProtocols });
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
  const handleAntimicrobialConfirm = useCallback((confirmedEntries: Array<{
    medication: string; dose: string; route: string; posology: string;
    startDate?: string; plannedDuration?: string; infectionSite?: string;
  }>) => {
    const antimicrobialOptions = UNIFIED_CATALOG['antimicrobial'] || [];
    const newItems: PrescriptionItem[] = confirmedEntries.map(entry => {
      const matchedMed = antimicrobialOptions.find(m => m.name === entry.medication);
      const base: PrescriptionItem = matchedMed
        ? { ...createItem(matchedMed), instructions: '', dose: entry.dose || createItem(matchedMed).dose, route: entry.route || createItem(matchedMed).route, posology: entry.posology || createItem(matchedMed).posology }
        : {
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
      base.atbStartDate = entry.startDate || format(new Date(), 'yyyy-MM-dd');
      base.atbPlannedDays = entry.plannedDuration || '';
      base.atbInfectionSite = entry.infectionSite || '';
      return base;
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

  const addNonStandard = (overrideName?: string) => {
    const name = (overrideName ?? nonStdName).trim();
    if (!name) return;
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      name,
      presentation: '-', dose: '-', route: '-',
      posology: '-', schedule: '-', instructions: '',
      category: 'nonstandard', flags: [], highAlert: false, status: 'active',
    }]);
    setNonStdName("");
  };

  // Guarda compartilhada: itens validados (e ainda dentro da janela do dia)
  // não podem ser editados, removidos ou ter flags alteradas.
  // Para alterar, é preciso suspender e re-prescrever, ou aguardar o corte das 05h
  // que devolve o item ao estado "pendente de revalidação".
  const isItemEditLocked = useCallback((item: PrescriptionItem) => {
    return isItemValidatedToday(item);
  }, [isItemValidatedToday]);

  const updateItem = useCallback((id: string, field: keyof PrescriptionItem, value: string) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      if (isItemEditLocked(item)) {
        toast.error("Item validado", { description: "Suspenda o item para alterar ou aguarde a renovação 05h." });
        return item;
      }
      return { ...item, [field]: value };
    }));
  }, [isItemEditLocked]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find(i => i.id === id);
      if (target && isItemEditLocked(target)) {
        toast.error("Item validado não pode ser excluído", { description: "Suspenda o item para retirá-lo da prescrição ativa." });
        return prev;
      }
      return prev.filter((item) => item.id !== id);
    });
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, [isItemEditLocked]);

  const toggleFlag = useCallback((id: string, flag: PrescriptionFlag) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      if (isItemEditLocked(item)) {
        toast.error("Item validado", { description: "Flags não podem ser alteradas após validação." });
        return item;
      }
      const flags = item.flags.includes(flag)
        ? item.flags.filter(f => f !== flag)
        : [...item.flags, flag];
      return { ...item, flags };
    }));
  }, [isItemEditLocked]);


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
    let nextItems: PrescriptionItem[] = [];
    if (suspendTarget.isBatch) {
      setItems(prev => {
        nextItems = prev.map(item =>
          selectedIds.has(item.id) && item.status === 'active'
            ? { ...item, status: 'suspended' as const, suspensionReason: reason, suspendedAt: now }
            : item
        );
        return nextItems;
      });
      toast.success(`${selectedIds.size} item(ns) suspenso(s)`);
      setSelectedIds(new Set());
    } else if (suspendTarget.id) {
      setItems(prev => {
        nextItems = prev.map(item =>
          item.id === suspendTarget.id
            ? { ...item, status: 'suspended' as const, suspensionReason: reason, suspendedAt: now }
            : item
        );
        return nextItems;
      });
      toast.success("Item suspenso");
    }
    // Persiste imediatamente — suspensão é ato auditável e imutável entre sessões
    if (nextItems.length) persistItems(nextItems, { mode: 'update', reason });
    setSuspendDialogOpen(false);
    setSuspendTarget({});
  }, [suspendTarget, selectedIds, persistItems]);

  // Reactivate
  const reactivateItem = useCallback((id: string) => {
    let nextItems: PrescriptionItem[] = [];
    setItems(prev => {
      nextItems = prev.map(item =>
        item.id === id ? { ...item, status: 'active' as const, suspensionReason: undefined, suspendedAt: undefined } : item
      );
      return nextItems;
    });
    if (nextItems.length) persistItems(nextItems, { mode: 'update' });
    toast.success("Item reativado");
  }, [persistItems]);

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
      nutrition: [], hydration: [], replacement: [], medication: [], antimicrobial: [],
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

  // Auto-hidrata a última prescrição do paciente nas últimas 24h ao abrir o cockpit.
  // Garante que prescrições validadas/impressas continuem visíveis até o corte das 05h
  // mesmo se o médico fechar a aba e reabrir, e impede duplicatas.
  const autoLoadAttemptedRef = useRef(false);
  const loadPrescriptionRef = useRef<((id: string) => Promise<void>) | null>(null);
  useEffect(() => {
    if (autoLoadAttemptedRef.current) return;
    if (!currentHospital || !currentState || !patient.name.trim()) return;
    if (currentPrescriptionId) return;
    autoLoadAttemptedRef.current = true;
    (async () => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('prescriptions')
          .select('id, created_at')
          .eq('hospital_unit_id', currentHospital.id)
          .eq('state_id', currentState.id)
          .eq('patient_name', patient.name.trim())
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        const last = (data || [])[0];
        if (last?.id && loadPrescriptionRef.current) {
          await loadPrescriptionRef.current(last.id);
        }
      } catch (err) {
        console.error('[autoLoadPrescription] failed', err);
      }
    })();
  }, [currentHospital, currentState, patient.name, currentPrescriptionId]);

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

  // Mantém o ref do auto-load apontando para a versão atual de loadPrescription
  useEffect(() => { loadPrescriptionRef.current = loadPrescription; }, [loadPrescription]);

  // Busca as datas (últimos 60 dias) com prescrições do paciente — para marcar bolinhas no calendário
  useEffect(() => {
    if (!currentHospital || !currentState || !patient.name.trim()) {
      setPrescriptionDateKeys(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('prescriptions')
          .select('created_at')
          .eq('hospital_unit_id', currentHospital.id)
          .eq('state_id', currentState.id)
          .eq('patient_name', patient.name.trim())
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        if (cancelled) return;
        const keys = new Set<string>();
        (data || []).forEach(d => keys.add(format(new Date(d.created_at), 'yyyy-MM-dd')));
        setPrescriptionDateKeys(keys);
      } catch (err) {
        console.error('[prescriptionDateKeys] fetch failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentHospital, currentState, patient.name, currentPrescriptionId]);

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
    const valid: PrescriptionCategory[] = ['nutrition','hydration','replacement','medication','antimicrobial','high_alert','inhalation','hemotherapy','care','nonstandard'];
    if (valid.includes(c as PrescriptionCategory)) return c as PrescriptionCategory;
    // pt-BR aliases used in seed templates
    if (c === 'antimicrobianos') return 'antimicrobial';
    if (c === 'hidratacao' || c === 'hidratação') return 'hydration';
    if (c === 'reposicao' || c === 'reposição' || c === 'eletroliticos' || c === 'eletrolíticos') return 'replacement';
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

  // Nova prescrição (mantém identidade do paciente — apenas zera itens/assinatura/id)
  const resetPrescriptionForNewDay = useCallback(() => {
    setItems([]);
    setDigitalSignature(null);
    setCurrentPrescriptionId(null);
    setSelectedIds(new Set());
  }, []);

  const handleNewPrescription = () => {
    if (prescriptionLocked) {
      toast.error("Já existe uma prescrição validada hoje", {
        description: "Use revalidação 05h ou aguarde o corte. Não é possível iniciar nova prescrição enquanto a atual estiver validada.",
      });
      return;
    }
    resetPrescriptionForNewDay();
    toast.info("Nova prescrição iniciada — em branco");
  };

  const handleCopyPreviousFlow = useCallback(async () => {
    if (prescriptionLocked) {
      toast.error("Já existe uma prescrição validada hoje", {
        description: "Não é possível iniciar nova prescrição enquanto a atual estiver validada.",
      });
      return;
    }
    if (!patient.name.trim()) {
      toast.error("Selecione um paciente antes de copiar a prescrição anterior");
      return;
    }
    resetPrescriptionForNewDay();
    await openRepeatDialog();
  }, [prescriptionLocked, patient.name, resetPrescriptionForNewDay, openRepeatDialog]);

  const [showPrintPortal, setShowPrintPortal] = useState(false);
  const [printGuidesOpen, setPrintGuidesOpen] = useState(false);
  const [printPrescription, setPrintPrescription] = useState(true);
  const [printGuideAtm, setPrintGuideAtm] = useState(false);
  const [printGuidePsy, setPrintGuidePsy] = useState(false);

  const hasActiveAtb = items.some(i => i.status === 'active' && i.category === 'antimicrobial');
  // Guia de Psicotrópicos só dispara para itens controlled=true (catálogo). high_alert puro NÃO gera receita.
  const hasActivePsy = items.some(i => {
    if (i.status !== 'active') return false;
    const cat = findControlledCatalog?.(i.name);
    if (cat?.controlled) return true;
    // Fallback heurístico legado quando o item não está no catálogo
    return !cat && isPsychotropicMedication(i.name);
  });

  // Itens controlled sem tipo de notificação resolvido — bloqueiam impressão da guia
  const controlledWithoutType = items.filter(i => {
    if (i.status !== 'active') return false;
    const cat = findControlledCatalog?.(i.name);
    if (!cat?.controlled) return false;
    return !cat.notification_type;
  });

  const doPrintPrescription = async () => {
    // Garante snapshot persistido ANTES da impressão (assinatura, validações, etc.)
    try {
      await persistItems(items);
    } catch {
      // persistItems já mostrou toast de erro; aborta impressão para não imprimir item não rastreado
      return;
    }
    setShowPrintPortal(true);
    setTimeout(() => {
      window.print();
      setShowPrintPortal(false);
    }, 300);
  };

  const handlePrint = () => {
    if (!hasActiveAtb && !hasActivePsy) {
      doPrintPrescription();
      return;
    }
    if (hasActivePsy && controlledWithoutType.length > 0) {
      toast.error("Defina o tipo de notificação dos medicamentos controlados antes de imprimir", {
        description: controlledWithoutType.map(i => i.name).join(', '),
      });
      return;
    }
    setPrintPrescription(true);
    setPrintGuideAtm(hasActiveAtb);
    setPrintGuidePsy(hasActivePsy);
    setPrintGuidesOpen(true);
  };

  const executePrintSelection = () => {
    setPrintGuidesOpen(false);
    const openPsy = () => { setPsychotropicFormMode('print_direct'); setPsychotropicFormOpen(true); };
    const afterPrintHandler = () => {
      window.removeEventListener('afterprint', afterPrintHandler);
      if (printGuideAtm) setTimeout(() => setAntimicrobialGuideOpen(true), 200);
      if (printGuidePsy) setTimeout(openPsy, printGuideAtm ? 1000 : 200);
    };
    if (printPrescription) {
      window.addEventListener('afterprint', afterPrintHandler);
      // Fallback caso o navegador não dispare afterprint
      setTimeout(() => {
        window.removeEventListener('afterprint', afterPrintHandler);
        if (printGuideAtm && !antimicrobialGuideOpen) setAntimicrobialGuideOpen(true);
        if (printGuidePsy && !psychotropicFormOpen) openPsy();
      }, 2500);
      doPrintPrescription();
    } else {
      if (printGuideAtm) setTimeout(() => setAntimicrobialGuideOpen(true), 200);
      if (printGuidePsy) setTimeout(openPsy, printGuideAtm ? 1000 : 200);
    }
  };

  // Sign prescription
  const handleRequestSign = () => {
    if (!canPrescribe) { toast.error("Preencha o peso e as alergias antes de assinar"); return; }
    if (!patient.name.trim()) { toast.error("Preencha o nome do paciente antes de assinar"); return; }
    if (activeItemsCount === 0) { toast.error("Nenhum item ativo para assinar"); return; }
    setSignDialogOpen(true);
  };

  const confirmSign = useCallback(async (sig: DigitalSignature) => {
    setDigitalSignature(sig);
    setSignDialogOpen(false);
    // Persistência IMEDIATA da assinatura — não pode ficar só em memória
    try {
      await persistItems(items, { sigOverride: sig });
      toast.success("Prescrição assinada digitalmente", {
        description: `Dr(a). ${sig.doctorName} — CRM ${sig.crm} — Hash: ${sig.hash}`,
        duration: 5000,
      });
    } catch {
      // persistItems já reportou o erro
    }
  }, [items, persistItems]);

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
            department:
              (patient.unit && patient.unit.trim()) ||
              (initialPatientSector && (sectorMapInit[initialPatientSector] || initialPatientSector)) ||
              'GERAL',
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

  // ===== Sincroniza ALERGIAS com a Cockpit (patients.uti_allergies) — espelhamento bidirecional =====
  // Fonte única: patients.uti_allergies (lista, separada por \n). Aqui exibimos como string
  // com vírgulas para edição amigável e convertemos nos dois sentidos.
  const allergiesPatientId = searchParams.get('patientId');
  // CID-10 primário do paciente (puxado da admissão) — usado pelo receituário Portaria 344
  const { cidPrimary: admissionCidPrimary } = usePatientCid(allergiesPatientId);
  const lastSyncedAllergiesRef = useRef<string | null>(null); // formato canônico (\n)
  const allergiesHydratedRef = useRef(false);

  // Conversões canônico (\n) ↔ display (", ")
  const canonicalToDisplay = (raw: string | null | undefined) =>
    (raw ?? '')
      .toString()
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .join(', ');
  const displayToCanonical = (val: string) =>
    val
      .split(/[,\n;]/)
      .map(s => s.trim())
      .filter(Boolean)
      .join('\n');

  // 1) Hidratação inicial + realtime: DB → estado local.
  //    Aceita o remoto sempre que ele divergir do último valor que nós mesmos sincronizamos
  //    (ou seja, é uma alteração feita na Cockpit / outro módulo).
  useEffect(() => {
    if (!allergiesPatientId) return;
    let cancelled = false;
    const applyRemote = (raw: string | null | undefined) => {
      if (cancelled) return;
      const remoteCanonical = (raw ?? '').toString();
      // Se o remoto é exatamente o que acabamos de gravar, ignora (evita loop).
      if (allergiesHydratedRef.current && remoteCanonical === (lastSyncedAllergiesRef.current ?? '')) return;
      lastSyncedAllergiesRef.current = remoteCanonical;
      allergiesHydratedRef.current = true;
      const display = canonicalToDisplay(remoteCanonical);
      setPatient(prev => (prev.allergies === display ? prev : { ...prev, allergies: display }));
    };

    (async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('uti_allergies')
        .eq('id', allergiesPatientId)
        .maybeSingle();
      if (!error) applyRemote(data?.uti_allergies as string | null);
      else allergiesHydratedRef.current = true; // libera write mesmo sem registro inicial
    })();

    const channel = supabase
      .channel(`prescricao-allergies-${allergiesPatientId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'patients', filter: `id=eq.${allergiesPatientId}` },
        (payload) => applyRemote((payload.new as any)?.uti_allergies))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [allergiesPatientId]);

  // 2) Persistência local → DB (debounced 500ms). Converte para formato canônico.
  useEffect(() => {
    if (!allergiesPatientId || !allergiesHydratedRef.current) return;
    const nextCanonical = displayToCanonical(patient.allergies ?? '');
    if (nextCanonical === (lastSyncedAllergiesRef.current ?? '')) return;
    const handle = setTimeout(async () => {
      const { error } = await supabase
        .from('patients')
        .update({ uti_allergies: nextCanonical || null })
        .eq('id', allergiesPatientId);
      if (!error) {
        lastSyncedAllergiesRef.current = nextCanonical;
      } else {
        console.error('Falha ao sincronizar alergias com Cockpit:', error);
        toast.error('Não foi possível sincronizar alergias com a Cockpit', { description: error.message });
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [patient.allergies, allergiesPatientId]);


  const isSimpleCategory = (cat: PrescriptionCategory) => ['care'].includes(cat);
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
    utiAllergies: (patient.allergies ?? '')
      .split(/[,\n;]/)
      .map(s => s.trim())
      .filter(Boolean),
    clinicalStatus: 'regular',
  }), [patient, searchParams, initialPatientSector]);

  return (
    <div className="animate-fade-in">
      <ClinicalHeader moduleLabel="Prescrição Médica" />
      <div className="flex print:block">
        <div className="flex-1 min-w-0 max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-5">
        {/* SAPS pending alert removed */}
      {/* Print styles — hide everything except portal */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 5mm 12mm 8mm 12mm; }
          body > *:not(#prescription-print-root) { display: none !important; }
          #prescription-print-root { display: block !important; }
          #prescription-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      ` }} />

      {/* ===== UNIFIED HEADER — title + context (peso/alergias/data/templates) + actions ===== */}
      <div className="print:hidden rounded-xl border border-border bg-card/60">
        {/* Row 0 — Title + meta */}
        <div className="hidden sm:flex items-center justify-between gap-3 flex-wrap px-3 pt-2.5 pb-2">
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
        </div>

        {/* Row 1 — Clinical context (peso, alergias, calendário, dose/kg, templates, atalhos) */}
        <div className="flex items-center gap-1.5 flex-wrap px-2 sm:px-3 py-2 sm:border-t sm:border-border/40">
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
          {(() => {
            const isNDAM = patient.allergies.trim().toUpperCase() === "NDAM";
            return (
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5 whitespace-nowrap">
                  {isNDAM ? (
                    <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                  )}{" "}
                  Alergias
                </Label>
                <AllergiesChipInput
                  value={patient.allergies}
                  onChange={(next) => updatePatient("allergies", next)}
                  className="max-w-[340px]"
                />
              </div>
            );
          })()}
          {(!patient.weight.trim() || !patient.allergies.trim()) && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              <AlertTriangle className="h-3 w-3" />
              Preencha {!patient.weight.trim() && !patient.allergies.trim() ? 'peso e alergias' : !patient.weight.trim() ? 'o peso' : 'as alergias'}
            </span>
          )}

          <span className="h-5 w-px bg-border/60 mx-0.5" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2">
                <CalendarDays className="h-3 w-3" />
                {historyDate ? format(historyDate, "dd/MM/yyyy") : "Calendário"}
                {savedPrescriptions.length > 0 && (
                  <span className="ml-0.5 text-[9px] font-mono text-muted-foreground">({savedPrescriptions.length})</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="end">
              <Calendar
                mode="single"
                selected={historyDate}
                onSelect={(d) => { setHistoryDate(d); }}
                locale={ptBR}
                initialFocus
                className="pointer-events-auto"
                modifiers={{
                  hasPrescription: (date) => prescriptionDateKeys.has(format(date, 'yyyy-MM-dd')),
                }}
                modifiersClassNames={{
                  hasPrescription:
                    "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
                }}
              />
              <div className="px-3 pb-2 -mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                Dias com prescrição salva
              </div>
              {historyDate && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setHistoryDate(undefined)}>
                    Limpar filtro
                  </Button>
                </div>
              )}
              <div className="border-t p-2 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <h3 className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
                    Prescrições anteriores
                  </h3>
                  <span className="text-[10px] text-muted-foreground">{savedPrescriptions.length}</span>
                </div>
                {savedPrescriptions.length > 0 ? (
                  <div className="space-y-1">
                    {savedPrescriptions.map(p => (
                      <button
                        key={p.id}
                        onClick={() => loadPrescription(p.id)}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded-md border text-xs transition-colors hover:bg-accent/50",
                          currentPrescriptionId === p.id ? "border-primary bg-primary/5" : "border-border"
                        )}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={p.status === 'signed' ? 'default' : 'outline'} className="text-[9px] h-4 px-1.5">
                            {p.status === 'signed' ? '✓ Assinada' : 'Rascunho'}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground">v{p.version}</span>
                          <span className="text-[9px] text-muted-foreground ml-auto">{format(new Date(p.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic px-1 py-2">Nenhuma prescrição encontrada{historyDate ? ' nesta data' : ''}.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
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
          <div className="ml-auto flex items-center gap-1.5">
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

        {/* Row 2 — Prescription actions (Nova, Extra, Interações, ATM, TEV, Validar | Compacto | Imprimir) */}
        <div className="flex items-center gap-1 flex-wrap px-3 py-2 border-t border-border/40 bg-muted/20 rounded-b-xl">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (prescriptionLocked) {
                      toast.error("Prescrição validada hoje", {
                        description: "Não é possível iniciar uma nova enquanto houver prescrição validada do dia. Use revalidação após o corte 05h.",
                      });
                      return;
                    }
                    setNewRxChoiceOpen(true);
                  }}
                  disabled={prescriptionLocked}
                  className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> Nova
                </Button>
              </span>
            </TooltipTrigger>
            {prescriptionLocked && (
              <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                Bloqueado: já existe prescrição validada hoje. Aguarde corte 05h ou use renovação.
              </TooltipContent>
            )}
          </Tooltip>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!canPrescribe) { toast.error("Preencha o peso e as alergias antes de prescrever"); return; }
              setExtraChooserOpen(true);
            }}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2"
          >
            <Syringe className="h-3 w-3" /> Extra
          </Button>
          <span className="h-5 w-px bg-border/60 mx-0.5" />
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAtmStatusOpen(true)}
                className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2"
              >
                <Shield className="h-3 w-3" /> Guia ATM
                {hasActiveAtb && (
                  <span className="ml-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[240px]">
              Acompanhe o status dos antibióticos em curso ou inicie uma nova solicitação (acréscimo / troca).
            </TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="sm" onClick={() => setTevProtocolOpen(true)} className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2">
            <Droplets className="h-3 w-3" /> TEV
          </Button>
          <span className="h-5 w-px bg-border/60 mx-0.5" />
          {isValidationSessionActive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  Sessão validada · {sessionMinutesLeft}min
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[240px]">
                Sua senha já foi confirmada. Novas validações nos próximos {sessionMinutesLeft} minuto(s) não pedirão senha. A janela é renovada a cada validação.
              </TooltipContent>
            </Tooltip>
          )}
          <div className="ml-auto flex items-center gap-1">
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
              <TooltipContent side="top" className="text-xs">
                {compactView ? 'Alternar para visualização expandida' : 'Alternar para visualização compacta'}
              </TooltipContent>
            </Tooltip>
            {/* Validar — entre Expandido e Imprimir */}
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
              {allItemsValidated ? "Validada" : prescriptionLocked ? "Validar pendentes" : "Validar"}
            </Button>
            {/* Botão Imprimir destacado — extrema direita */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (!allItemsValidated) {
                      toast.error("Valide a prescrição antes de imprimir", { description: "Use o botão 'Validar' para validar com sua senha." });
                      return;
                    }
                    handlePrint();
                  }}
                  className="gap-1.5 text-xs h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold"
                >
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[240px]">
                Imprimir a prescrição validada e, quando aplicável, as guias regulatórias (ATM / Psicotrópicos).
              </TooltipContent>
            </Tooltip>
          </div>
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

      {/* Toolbar de ações migrada para o cabeçalho superior (acima do workbench). */}

      {/* ===== UNIFIED PRESCRIPTION WORKBENCH (itens + histórico + busca) ===== */}
      <div className="rounded-xl border border-border bg-card overflow-visible print:hidden divide-y divide-border/40">

        {/* Section 2 — Itens summary chips (clicáveis: navegam até a categoria) */}
        {items.length > 0 && (
          <div className="sticky top-0 z-10 px-3 py-2 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border/40">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase mr-1">Ir para:</span>
              {/* Grupo 1: Suporte (dieta + hidratação + reposição) */}
              {(['nutrition', 'hydration', 'replacement'] as PrescriptionCategory[]).map(cat => {
                const count = itemsByCategory[cat].length;
                if (count === 0) return null;
                const config = CATEGORY_CONFIG[cat];
                const validatedCount = itemsByCategory[cat].filter(i => i.validated && (!isPastRenewalTime || (i.validatedAt && new Date(i.validatedAt) > setSeconds(setMinutes(setHours(startOfDay(new Date()), 5), 0), 0)))).length;
                const ok = validatedCount === count;
                const hasWizard = cat === 'nutrition' || cat === 'hydration' || cat === 'replacement';
                return (
                  <button
                    key={cat}
                    type="button"
                    title={hasWizard ? `Abrir assistente de ${config.label.toLowerCase()}` : undefined}
                    onClick={() => {
                      document.getElementById(`prescription-cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      if (cat === 'nutrition') setNutritionWizardOpen(true);
                      else if (cat === 'hydration') setHydrationWizardOpen(true);
                      else if (cat === 'replacement') setReplacementWizardOpen(true);
                    }}
                    className={cn(
                      "group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all hover:shadow-sm hover:-translate-y-px",
                      ok
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                    )}
                  >
                    <Circle className={cn("h-1.5 w-1.5 fill-current", ok ? "text-emerald-500" : "text-amber-500")} />
                    {config.label.toLowerCase()}
                    <span className="ml-0.5 font-bold">{count}</span>
                    {hasWizard && <Sparkles className="h-2.5 w-2.5 ml-0.5 opacity-70" />}
                  </button>
                );
              })}
              {/* Separador entre grupos */}
              {(itemsByCategory.nutrition.length > 0 || itemsByCategory.hydration.length > 0) &&
                (itemsByCategory.medication.length > 0 || itemsByCategory.antimicrobial.length > 0 || itemsByCategory.high_alert.length > 0) && (
                <span className="w-px h-4 bg-border/60 mx-0.5" />
              )}
              {/* Grupo 2: Medicações (com ênfase em ATB e alto alerta) */}
              {(['medication', 'antimicrobial', 'high_alert', 'inhalation', 'hemotherapy'] as PrescriptionCategory[]).map(cat => {
                const count = itemsByCategory[cat].length;
                if (count === 0) return null;
                const config = CATEGORY_CONFIG[cat];
                const validatedCount = itemsByCategory[cat].filter(i => i.validated && (!isPastRenewalTime || (i.validatedAt && new Date(i.validatedAt) > setSeconds(setMinutes(setHours(startOfDay(new Date()), 5), 0), 0)))).length;
                const ok = validatedCount === count;
                const emphasis = cat === 'antimicrobial' || cat === 'high_alert';
                return (
                  <button
                    key={cat}
                    type="button"
                    title={config.label}
                    onClick={() => document.getElementById(`prescription-cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className={cn(
                      "group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all hover:shadow-sm hover:-translate-y-px",
                      emphasis && cat === 'antimicrobial' && "ring-1 ring-violet-300/60",
                      emphasis && cat === 'high_alert' && "ring-1 ring-red-300/70",
                      ok
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                    )}
                  >
                    <Circle className={cn("h-1.5 w-1.5 fill-current", ok ? "text-emerald-500" : "text-amber-500")} />
                    {config.shortLabel ?? config.label.toLowerCase()}
                    <span className="ml-0.5 font-bold">{count}</span>
                  </button>
                );
              })}
              {/* Separador antes de cuidados */}
              {(itemsByCategory.medication.length + itemsByCategory.antimicrobial.length + itemsByCategory.high_alert.length + itemsByCategory.inhalation.length + itemsByCategory.hemotherapy.length) > 0 &&
                (itemsByCategory.care.length > 0 || itemsByCategory.nonstandard.length > 0) && (
                <span className="w-px h-4 bg-border/60 mx-0.5" />
              )}
              {/* Grupo 3: Cuidados + não padrão */}
              {(['care', 'nonstandard'] as PrescriptionCategory[]).map(cat => {
                const count = itemsByCategory[cat].length;
                if (count === 0) return null;
                const config = CATEGORY_CONFIG[cat];
                const validatedCount = itemsByCategory[cat].filter(i => i.validated && (!isPastRenewalTime || (i.validatedAt && new Date(i.validatedAt) > setSeconds(setMinutes(setHours(startOfDay(new Date()), 5), 0), 0)))).length;
                const ok = validatedCount === count;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => document.getElementById(`prescription-cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className={cn(
                      "group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all hover:shadow-sm hover:-translate-y-px",
                      ok
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                    )}
                  >
                    <Circle className={cn("h-1.5 w-1.5 fill-current", ok ? "text-emerald-500" : "text-amber-500")} />
                    {config.label.toLowerCase()}
                    <span className="ml-0.5 font-bold">{count}</span>
                  </button>
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
        <div className="px-3 py-2 relative z-20">
          <GlobalPrescriptionSearch
            ref={globalSearchRef}
            onAddItem={(med) => addItem(med, { fromGlobalSearch: true })}
            onAddNonStandard={(name: string) => { addNonStandard(name); }}
            getFavoriteCount={getFavoriteCount}
            onCategoryPopup={(cat) => {
              if (cat === 'antimicrobial') {
                setPendingAntimicrobialMed(null);
                setAntimicrobialGuideOpen(true);
              } else if (cat === 'high_alert') {
                setHighAlertGuideOpen(true);
              } else if (cat === 'care') {
                setCareCatalogOpen(true);
              }
            }}
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
            {(() => {
              // Agrupamento clínico em 3 blocos para legibilidade visual:
              //  - Suporte (dieta + hidratação)
              //  - Medicações (meds, ATB, alto alerta, inalatórios, hemo)
              //  - Cuidados e orientações (care + não padrão)
              const GROUPS: { id: string; label: string; cats: PrescriptionCategory[] }[] = [
                { id: 'suporte', label: 'Suporte clínico', cats: ['nutrition', 'hydration', 'replacement'] },
                { id: 'medicacoes', label: 'Medicações', cats: ['medication', 'antimicrobial', 'high_alert', 'inhalation', 'hemotherapy'] },
                { id: 'cuidados', label: 'Cuidados e orientações', cats: ['care', 'nonstandard'] },
              ];
              return GROUPS.map(group => {
                const visibleCats = group.cats.filter(c => itemsByCategory[c].length > 0);
                if (visibleCats.length === 0) return null;
                return (
                  <div key={group.id} className="space-y-3">
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        {group.label}
                      </span>
                      <div className="flex-1 h-px bg-border/60" />
                    </div>
                    {visibleCats.map(cat => {
              const config = CATEGORY_CONFIG[cat];
              const catItems = itemsByCategory[cat];
              const simple = isSimpleCategory(cat);
              const IconComp = CATEGORY_ICONS[config.icon] || Pill;

              if (catItems.length === 0) return null;

              return (
                <div key={cat} id={`prescription-cat-${cat}`} className="rounded-xl border border-border bg-card scroll-mt-24">
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
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap" title={config.label}>{config.shortLabel ?? config.label}</span>
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
                            placeholder="Adicionar item não padrão..."
                            className="bg-background/60 border-border/50 h-7 text-xs"
                          />
                          <Button variant="outline" size="sm" onClick={() => addNonStandard()} disabled={!nonStdName.trim()} className="h-7 px-2">
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <MedicationAutocomplete
                          source={UNIFIED_CATALOG[cat]}
                          onSelect={addItem}
                          placeholder={`Buscar ${config.label.toLowerCase()}...`}
                          getFavoriteCount={getFavoriteCount}
                          category={cat}
                          onAssistantClick={
                            cat === 'nutrition' ? () => setNutritionWizardOpen(true) :
                            cat === 'hydration' ? () => setHydrationWizardOpen(true) :
                            cat === 'replacement' ? () => setReplacementWizardOpen(true) :
                            cat === 'care' ? () => setCareCatalogOpen(true) :
                            ['medication','antimicrobial','high_alert','inhalation','hemotherapy'].includes(cat)
                              ? () => toast.info('Assistente desta categoria em construção.')
                              : undefined
                          }
                          assistantTooltip={
                            cat === 'nutrition' ? 'Assistente de Terapia Nutricional' :
                            cat === 'hydration' ? 'Assistente de Hidratação' :
                            cat === 'replacement' ? 'Assistente de Reposição / Correção Eletrolítica' :
                            cat === 'care' ? 'Assistente de Cuidados (perfis clínicos)' :
                            'Assistente — em breve'
                          }
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
                          onAssistant={(id) => setItemAssistantTargetId(id)}
                          onEditInsulin={(id) => { setEditingInsulinItemId(id); setPendingInsulinMed(null); setInsulinDialogOpen(true); }}
                          onOpenAntimicrobialGuide={() => setAtmStatusOpen(true)}
                          onToggleValidation={requestValidateItem}
                          isPastRenewalTime={isPastRenewalTime}
                          prescriptionLocked={prescriptionLocked}
                          missingFields={itemMissingMap.get(item.id) || []}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
                  </div>
                );
              });
            })()}
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

      {/* Nutrition Wizard */}
      <NutritionWizard
        open={nutritionWizardOpen}
        onOpenChange={setNutritionWizardOpen}
        patientWeight={patient.weight}
        onAdd={(entries) => {
          // Substitui qualquer item de nutrição existente para evitar duplicidade conflitante
          setItems(prev => {
            const filtered = prev.filter(i => i.category !== 'nutrition');
            const newItems = entries.map(e => createItem(e));
            return [...filtered, ...newItems];
          });
          toast.success(`${entries.length} ${entries.length === 1 ? 'item nutricional adicionado' : 'itens nutricionais adicionados'}`);
        }}
      />

      <HydrationWizard
        open={hydrationWizardOpen}
        onOpenChange={setHydrationWizardOpen}
        onAdd={(entries) => {
          entries.forEach(e => addItem(e));
          toast.success(`${entries.length} item de hidratação adicionado`);
        }}
      />

      <ReplacementWizard
        open={replacementWizardOpen}
        onOpenChange={setReplacementWizardOpen}
        onAdd={(entries) => {
          entries.forEach(e => addItem(e));
          toast.success(`${entries.length} ${entries.length === 1 ? 'item de reposição adicionado' : 'itens de reposição adicionados'}`);
        }}
      />

      <ItemAssistantWizard
        open={!!itemAssistantTargetId}
        onOpenChange={(o) => { if (!o) setItemAssistantTargetId(null); }}
        item={(() => {
          const it = items.find(i => i.id === itemAssistantTargetId);
          return it ? {
            id: it.id, name: it.name, category: it.category,
            diluent: it.diluent, diluentVolume: it.diluentVolume, volumeTotal: it.volumeTotal,
            route: it.route, accessType: it.accessType,
            infusionMode: it.infusionMode, infusionRate: it.infusionRate,
            infusionTime: it.infusionTime, infusionTimeUnit: it.infusionTimeUnit,
            posology: it.posology, instructions: it.instructions,
            nutVolDay: it.nutVolDay, nutMode: it.nutMode, nutFraction: it.nutFraction,
            nutNightPause: it.nutNightPause, nutBedHead: it.nutBedHead, nutResidualCheck: it.nutResidualCheck,
          } : null;
        })()}
        onApply={(patch: AssistantPatch) => {
          if (!itemAssistantTargetId) return;
          setItems(prev => prev.map(it => it.id === itemAssistantTargetId ? { ...it, ...patch } as PrescriptionItem : it));
          toast.success("Configuração aplicada pelo assistente");
        }}
      />

        {items.length === 0 && (() => {
          const admissionTpls = quickTemplates.filter(t => t.clinical_category === 'admissao');
          return (
            <div className="rounded-xl border border-dashed border-border bg-gradient-to-br from-primary/5 via-background to-muted/20 p-6">
              <div className="text-center mb-5">
                <Pill className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Comece a prescrição em 1 clique</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aplique um modelo de admissão, abra um assistente ou use a busca acima
                </p>
              </div>

              {/* Atalhos para assistentes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setNutritionWizardOpen(true)}
                  className="text-left rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900 transition-all p-3 group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <UtensilsCrossed className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Nutrição</span>
                    <Sparkles className="h-3 w-3 text-emerald-500 ml-auto opacity-60 group-hover:opacity-100" />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">Zero · Oral · Enteral · NPT</p>
                </button>
                <button
                  type="button"
                  onClick={() => setHydrationWizardOpen(true)}
                  className="text-left rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 dark:bg-blue-950/20 dark:border-blue-900 transition-all p-3 group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Droplets className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300">Hidratação</span>
                    <Sparkles className="h-3 w-3 text-blue-500 ml-auto opacity-60 group-hover:opacity-100" />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">SF · RL · SG · Soluções preparadas</p>
                </button>
                <button
                  type="button"
                  onClick={() => setReplacementWizardOpen(true)}
                  className="text-left rounded-lg border border-sky-200 bg-sky-50/50 hover:bg-sky-50 hover:border-sky-400 dark:bg-sky-950/20 dark:border-sky-900 transition-all p-3 group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FlaskConical className="h-4 w-4 text-sky-600" />
                    <span className="text-xs font-bold text-sky-800 dark:text-sky-300">Reposição / Correção</span>
                    <Sparkles className="h-3 w-3 text-sky-500 ml-auto opacity-60 group-hover:opacity-100" />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">HipoK · HipoMg · HipoNa · HiperK</p>
                </button>
              </div>
              {admissionTpls.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Modelos de admissão
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {admissionTpls.map(tpl => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyQuickTemplate(tpl)}
                        className="group text-left rounded-lg border border-border bg-card hover:border-primary hover:shadow-md hover:-translate-y-0.5 transition-all p-3"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="text-xs font-bold text-foreground leading-tight uppercase tracking-wide line-clamp-2">
                            {tpl.name}
                          </h4>
                          <Plus className="h-3.5 w-3.5 text-primary shrink-0 opacity-60 group-hover:opacity-100" />
                        </div>
                        {tpl.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">
                            {tpl.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Pill className="h-2.5 w-2.5" />
                          <span>{tpl.items.length} itens</span>
                          {tpl.use_count > 0 && (
                            <>
                              <span>·</span>
                              <span>{tpl.use_count}x</span>
                            </>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickTemplatesDialogOpen(true)}
                    className="mt-3 w-full text-[11px] text-primary hover:underline font-medium"
                  >
                    Ver todos os templates →
                  </button>
                </div>
              )}
            </div>
          );
        })()}
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
          {/* "Renovar" e "Salvar" removidos — renovação e salvamento são automáticos. */}
          <Button
            variant={digitalSignature ? "outline" : "default"}
            size="sm"
            onClick={handleRequestSign}
            className={cn("gap-1.5 text-xs", digitalSignature && "border-green-300 text-green-700 hover:text-green-800")}
          >
            {digitalSignature ? <><ShieldCheck className="h-3 w-3" /> Reassinar</> : <><Fingerprint className="h-3 w-3" /> Assinar</>}
          </Button>
        </div>
      </div>

      {/* Spacer para evitar que a barra de ações fixa do rodapé cubra o conteúdo final */}
      <div aria-hidden className="h-14 print:hidden" />

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

      {/* Pop-up de confirmação para "Nova" prescrição */}
      <NewPrescriptionChoiceDialog
        open={newRxChoiceOpen}
        onClose={() => setNewRxChoiceOpen(false)}
        hasCurrentItems={items.length > 0}
        onStartBlank={handleNewPrescription}
        onCopyPrevious={handleCopyPreviousFlow}
      />

      {/* Seletor de tipo da prescrição extra */}
      <ExtraPrescriptionChooserDialog
        open={extraChooserOpen}
        onClose={() => setExtraChooserOpen(false)}
        onPick={(cat) => {
          setExtraInitialCategory(cat);
          setExtraPrescriptionOpen(true);
        }}
      />

      {/* Extra Prescription Dialog */}
      <ExtraPrescriptionDialog
        open={extraPrescriptionOpen}
        onClose={() => setExtraPrescriptionOpen(false)}
        initialCategory={extraInitialCategory}
        patient={patient}
        parentPrescriptionId={currentPrescriptionId}
        parentPrescriptionVersion={versionHistory.find(v => v.id === currentPrescriptionId)?.version ?? null}
        hospitalName={currentHospital?.name}
        doctorName={digitalSignature?.doctorName}
        doctorCrm={digitalSignature?.crm}
        sectorLabel={`Prescrição Médica — ${patient.unit || 'Anexo Extra'}`}
        onAddItems={(newItems) => {
          setItems(prev => [...prev, ...newItems]);
          const agoraCount = newItems.filter(i => i.flags.includes('ag' as PrescriptionFlag)).length;
          const scheduledCount = newItems.length - agoraCount;
          toast.success(`${newItems.length} item(ns) extra adicionado(s)`, {
            description: agoraCount > 0
              ? `${agoraCount} "Agora" (não renovam)${scheduledCount > 0 ? ` + ${scheduledCount} de horário (renovam)` : ''}`
              : `${scheduledCount} de horário (serão incorporados na renovação)`,
          });
          // Roteia para fluxo especializado de acordo com a categoria escolhida
          if (extraInitialCategory === 'antimicrobial') {
            setTimeout(() => setAntimicrobialGuideOpen(true), 250);
          } else if (extraInitialCategory === 'high_alert') {
            setTimeout(() => setPsychotropicFormOpen(true), 250);
          }
        }}
        allMedications={Object.values(UNIFIED_CATALOG).flat()}
      />

      {/* Antimicrobial Guide Dialog */}
      <AntimicrobialGuideDialog
        open={antimicrobialGuideOpen}
        onOpenChange={(open) => {
          setAntimicrobialGuideOpen(open);
          if (!open) { setPendingAntimicrobialMed(null); setPendingAtbMode(null); }
        }}
        patient={patient}
        antimicrobialItems={
          pendingAntimicrobialMed
            ? [{ id: 'pending', name: pendingAntimicrobialMed.name, dose: pendingAntimicrobialMed.defaultDose, route: pendingAntimicrobialMed.defaultRoute, posology: pendingAntimicrobialMed.defaultPosology, category: 'antimicrobial', status: 'active' }]
            : pendingAtbMode
              ? [] // Nova ATB do zero (acréscimo / troca / inicial)
              : items.filter(i => i.category === 'antimicrobial').map(i => ({ id: i.id, name: i.name, dose: i.dose, route: i.route, posology: i.posology, category: i.category, status: i.status }))
        }
        doctorName={digitalSignature?.doctorName}
        doctorCrm={digitalSignature?.crm}
        hospitalName={currentHospital?.name}
        onConfirm={handleAntimicrobialConfirm}
        mode={(pendingAntimicrobialMed || pendingAtbMode) ? 'prescribe' : 'review'}
        patientId={searchParams.get('patientId') || undefined}
      />

      {/* ATM Status Dialog — acompanhamento + nova solicitação */}
      <AtmStatusDialog
        open={atmStatusOpen}
        onOpenChange={setAtmStatusOpen}
        activeItems={items
          .filter(i => i.category === 'antimicrobial' && i.status === 'active')
          .map(i => ({
            id: i.id, name: i.name, dose: i.dose, route: i.route, posology: i.posology,
            status: i.status, atbStartDate: i.atbStartDate, atbPlannedDays: i.atbPlannedDays,
            atbInfectionSite: i.atbInfectionSite,
          }))
        }
        onSuspendItem={(id) => {
          setItems(prev => prev.map(it => it.id === id ? { ...it, status: 'suspended' } : it));
          toast.success("Antibiótico suspenso");
        }}
        onStartNew={(mode, suspendIds) => {
          if (mode === 'troca' && suspendIds.length > 0) {
            setItems(prev => prev.map(it => suspendIds.includes(it.id) ? { ...it, status: 'suspended' } : it));
            toast.info(`${suspendIds.length} antibiótico(s) suspenso(s) — preencha o substituto na Guia ATM.`);
          }
          setPendingAtbMode(mode);
          setPendingAntimicrobialMed(null);
          setTimeout(() => setAntimicrobialGuideOpen(true), 150);
        }}
      />

      {/* Psychotropic Form Dialog */}
      <PsychotropicFormDialog
        open={psychotropicFormOpen}
        onOpenChange={(o) => { setPsychotropicFormOpen(o); if (!o) setPsychotropicFormMode('edit'); }}
        patient={patient}
        controlledItems={items.filter(i => {
          if (i.status !== 'active') return false;
          const cat = findControlledCatalog?.(i.name);
          if (cat?.controlled) return true;
          return !cat && (i.category === 'high_alert' || isPsychotropicMedication(i.name));
        }).map(i => ({ id: i.id, name: i.name, dose: i.dose, route: i.route, posology: i.posology, category: i.category, status: i.status, highAlert: i.highAlert }))}
        doctorName={digitalSignature?.doctorName}
        doctorCrm={digitalSignature?.crm}
        hospitalName={currentHospital?.name}
        mode={psychotropicFormMode}
        cidPrimary={admissionCidPrimary}
      />

      {/* Print Guides Dialog */}
      <Dialog open={printGuidesOpen} onOpenChange={setPrintGuidesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Printer className="h-5 w-5 text-primary" />
              Imprimir prescrição
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta prescrição contém itens com guias regulatórias associadas. Selecione o que deseja imprimir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-border hover:bg-muted/30 cursor-pointer">
              <Checkbox checked={printPrescription} onCheckedChange={(v) => setPrintPrescription(!!v)} className="mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold">Prescrição médica</div>
                <div className="text-muted-foreground">Documento principal validado.</div>
              </div>
            </label>
            {hasActiveAtb && (
              <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-orange-200 dark:border-orange-800/40 bg-orange-50/40 dark:bg-orange-950/10 hover:bg-orange-50/80 cursor-pointer">
                <Checkbox checked={printGuideAtm} onCheckedChange={(v) => setPrintGuideAtm(!!v)} className="mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold text-orange-700 dark:text-orange-400">Guia de Antimicrobianos (CCIH / Norma Zero)</div>
                  <div className="text-muted-foreground">Abre a Guia ATM com seus antibióticos.</div>
                </div>
              </label>
            )}
            {hasActivePsy && (
              <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-purple-200 dark:border-purple-800/40 bg-purple-50/40 dark:bg-purple-950/10 hover:bg-purple-50/80 cursor-pointer">
                <Checkbox checked={printGuidePsy} onCheckedChange={(v) => setPrintGuidePsy(!!v)} className="mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold text-purple-700 dark:text-purple-400">Guia de Psicotrópicos (Portaria 344)</div>
                  <div className="text-muted-foreground">Abre a Guia de psicotrópicos para impressão.</div>
                </div>
              </label>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPrintGuidesOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={executePrintSelection} className="gap-1.5" disabled={!printPrescription && !printGuideAtm && !printGuidePsy}>
              <Printer className="h-3.5 w-3.5" /> Imprimir selecionados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TEV Protocol Dialog */}
      <TevProtocolDialog
        open={tevProtocolOpen}
        onOpenChange={setTevProtocolOpen}
        patient={patient ? { name: patient.name, age: patient.age, bed: patient.bed, weight: patient.weight } : null}
        onAddToPrescription={(med) => addItem(med)}
      />

      {/* MAV — High-Alert Medications Guide */}
      <HighAlertGuideDialog
        open={highAlertGuideOpen}
        onOpenChange={setHighAlertGuideOpen}
        onAddItem={(med) => { addItem(med); }}
      />

      {/* Insulinoterapia — Assistente inteligente */}
      <InsulinTherapyDialog
        open={insulinDialogOpen}
        onOpenChange={(v) => {
          setInsulinDialogOpen(v);
          if (!v) { setPendingInsulinMed(null); setEditingInsulinItemId(null); }
        }}
        medicationName={pendingInsulinMed?.name ?? (editingInsulinItemId ? (items.find(i => i.id === editingInsulinItemId)?.name ?? '') : '')}
        initialWeightKg={patient?.weight ? Number(String(patient.weight).replace(',', '.')) || undefined : undefined}
        existingPlan={editingInsulinItemId ? items.find(i => i.id === editingInsulinItemId)?.insulinPlan : undefined}
        onConfirm={(plan) => {
          const desc = describeInsulinPlan(plan);
          if (editingInsulinItemId) {
            setItems(prev => prev.map(it => it.id === editingInsulinItemId
              ? { ...it, insulinPlan: plan, instructions: [desc.headline, ...desc.lines].join(' | ') }
              : it
            ));
            toast.success('Plano de insulinoterapia atualizado');
          } else if (pendingInsulinMed) {
            const baseItem = createItem(pendingInsulinMed);
            const grouped: PrescriptionItem = {
              ...baseItem,
              name: `Insulinoterapia — ${desc.headline}`,
              dose: plan.totalDailyDose ? `${plan.totalDailyDose} U/dia` : (baseItem.dose || 'conforme esquema'),
              route: plan.scheme === 'iv_continuous' ? 'Intravenosa' : 'Subcutânea',
              posology: plan.scheme === 'iv_continuous' ? 'BIC' : (plan.hgtFrequency ?? 'conforme esquema'),
              schedule: plan.scheme === 'iv_continuous' ? 'contínuo' : 'múltiplos horários',
              instructions: [desc.headline, ...desc.lines].join(' | '),
              insulinPlan: plan,
              highAlert: true,
              securityCategory: 'MAV',
              doubleCheck: true,
              flags: plan.scheme === 'iv_continuous' ? ['bi' as PrescriptionFlag] : baseItem.flags,
            };
            setItems(prev => [...prev, grouped]);
            toast.success(`✓ ${desc.headline}`, {
              description: 'ALTA VIGILÂNCIA · esquema completo gerado para enfermagem.',
              duration: 4000,
            });
            setExpandedCategories(prev => { const n = new Set(prev); n.add('high_alert'); return n; });
          }
        }}
      />

      {/* Care Catalog Dialog — só cuidados de suporte (sinais vitais, decúbito, fisio, fono, curativos) */}
      <CareCatalogDialog
        open={careCatalogOpen}
        onOpenChange={setCareCatalogOpen}
        onAddItem={(entry) => addItem(entry)}
        onAddBulk={(structured, extras, profile) => {
          const existingNames = new Set(items.filter(i => i.category === 'care').map(i => i.name));
          const newItems: PrescriptionItem[] = [];
          for (const careMed of structured) {
            if (!existingNames.has(careMed.name)) {
              newItems.push(createItem(careMed));
              existingNames.add(careMed.name);
            }
          }
          for (const extraText of extras) {
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
            toast.success(`${newItems.length} cuidado(s) adicionado(s)${profile ? ` — ${profile.label}` : ''}`);
          } else {
            toast.info('Todos os cuidados selecionados já constam na prescrição');
          }
          if (profile) setAppliedCareProfiles(prev => new Set(prev).add(profile.id));
        }}
        appliedProfileIds={appliedCareProfiles}
        patientName={patient?.name}
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
          const isInhalation = item.category === 'inhalation';
          const hasIvPreparo = !isInhalation && (item.diluent || item.diluentVolume || item.accessType || item.infusionTime || item.infusionRate || item.volumeTotal || item.concentration);
          const inhalationLine = isInhalation ? assembleInhalationInstruction(item as any) : '';
          const insulinDesc = item.insulinPlan ? describeInsulinPlan(item.insulinPlan) : null;

          // Chip regulatório (MAV / Portaria 344)
          const sec = item.securityCategory;
          let regChip: { label: string; bg: string; fg: string; border: string } | null = null;
          if (sec === 'MAV_PORT_344') {
            regChip = { label: `MAV + PORT.344${item.controlledList ? ' · ' + item.controlledList : ''}`, bg: '#7e22ce', fg: '#fff', border: '#7e22ce' };
          } else if (sec === 'MAV') {
            regChip = { label: 'MAV', bg: '#991b1b', fg: '#fff', border: '#991b1b' };
          } else if (sec === 'PORT_344' || item.controlled) {
            regChip = { label: `PORT.344${item.controlledList ? ' · ' + item.controlledList : ''}`, bg: '#1d4ed8', fg: '#fff', border: '#1d4ed8' };
          } else if (item.highAlert) {
            regChip = { label: 'MAV', bg: '#991b1b', fg: '#fff', border: '#991b1b' };
          }

          return (
            <tr key={item.id} style={{ pageBreakInside: 'avoid' }}>
              <td style={{ ...cellStyle, width: '22px', textAlign: 'center', backgroundColor: rowBg, verticalAlign: 'top', color: '#0f172a', fontSize: '7.5pt', fontWeight: 800 }}>
                {displayIndex}
              </td>
              <td style={{ ...cellStyle, backgroundColor: rowBg }}>
                <div style={{ fontSize: '8pt', lineHeight: 1.4, color: '#0f172a' }}>
                  {regChip && (
                    <span style={{ fontSize: '6pt', fontWeight: 800, marginRight: '4px', color: regChip.fg, backgroundColor: regChip.bg, padding: '0.5px 4px', borderRadius: '2px', border: `0.5px solid ${regChip.border}`, letterSpacing: '0.3px', verticalAlign: 'middle' }}>{regChip.label}</span>
                  )}
                  {item.doubleCheck && (
                    <span style={{ fontSize: '5.5pt', fontWeight: 800, marginRight: '4px', color: '#fff', backgroundColor: '#0f172a', padding: '0.5px 3px', borderRadius: '2px', letterSpacing: '0.3px', verticalAlign: 'middle' }}>2x CHECK</span>
                  )}
                  <span style={{ fontWeight: 800 }}>{item.name}</span>
                  {item.presentation && item.presentation !== '-' && (
                    <span style={{ fontWeight: 500, color: '#334155', fontSize: '7.5pt' }}> ({item.presentation})</span>
                  )}
                  {item.quantity && item.quantityUnit && (
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '7.5pt' }}> — {item.quantity} {item.quantityUnit}</span>
                  )}
                </div>
                <div style={{ fontSize: '7.5pt', color: '#1e293b', lineHeight: 1.35, marginTop: '2px', fontWeight: 600 }}>
                  {[
                    item.dose && item.dose !== '-' ? item.dose : null,
                    item.route && item.route !== '-' ? item.route : null,
                    item.posology && item.posology !== '-' ? item.posology : null,
                  ].filter(Boolean).join(' · ')}
                  {item.flags.length > 0 && (
                    <span style={{ fontSize: '6pt', fontWeight: 700, marginLeft: '4px', color: '#fff', backgroundColor: '#334155', padding: '0.5px 4px', borderRadius: '2px', letterSpacing: '0.3px' }}>{item.flags.join(', ').toUpperCase()}</span>
                  )}
                  {item.isExtra && (
                    <span style={{ fontSize: '5.5pt', fontWeight: 700, marginLeft: '3px', color: '#9a3412', backgroundColor: '#fff7ed', padding: '0.5px 4px', borderRadius: '2px', border: '0.5px solid #fdba74' }}>EXTRA</span>
                  )}
                  {item.status === 'suspended' && (
                    <span style={{ fontSize: '6pt', fontWeight: 700, color: '#fff', backgroundColor: '#dc2626', padding: '0.5px 4px', borderRadius: '2px', marginLeft: '3px' }}>SUSPENSO</span>
                  )}
                </div>

                {/* Insulinoterapia: bloco estruturado para enfermagem */}
                {insulinDesc && (
                  <div style={{ fontSize: '7pt', color: '#1e293b', lineHeight: 1.3, marginTop: '3px', paddingLeft: '8px', borderLeft: '2px solid #991b1b', backgroundColor: '#fef2f2', padding: '3px 6px 3px 8px', borderRadius: '0 2px 2px 0' }}>
                    <div style={{ fontWeight: 800, fontSize: '7pt', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '1px' }}>{insulinDesc.headline}</div>
                    {insulinDesc.lines.map((ln, i) => (
                      <div key={i} style={{ fontWeight: ln.startsWith('  •') ? 500 : 600, paddingLeft: ln.startsWith('  •') ? '6px' : 0 }}>{ln.replace(/^  •\s*/, '• ')}</div>
                    ))}
                  </div>
                )}

                {/* Inalação: bloco específico (sem campos de infusão IV) */}
                {isInhalation && inhalationLine && (
                  <div style={{ fontSize: '7pt', color: '#1e293b', lineHeight: 1.3, marginTop: '2px', paddingLeft: '8px', borderLeft: '2px solid #0891b2', fontWeight: 500 }}>
                    <span style={{ fontSize: '5.5pt', fontWeight: 800, color: '#fff', backgroundColor: '#0891b2', padding: '0.5px 4px', borderRadius: '2px', letterSpacing: '0.3px', marginRight: '4px' }}>INALATÓRIO</span>
                    {inhalationLine}
                    {item.spacer && <span style={{ marginLeft: '4px', fontStyle: 'italic', color: '#475569' }}>· c/ espaçador</span>}
                    {item.gargle && <span style={{ marginLeft: '4px', fontStyle: 'italic', color: '#475569' }}>· gargarejo após</span>}
                  </div>
                )}

                {/* Preparo IV (medicação / hidratação) */}
                {hasIvPreparo && !insulinDesc && (
                  <div style={{ fontSize: '7pt', color: '#1e293b', lineHeight: 1.3, marginTop: '2px', paddingLeft: '8px', borderLeft: '2px solid #0c4a6e', fontWeight: 500 }}>
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

                {/* Nutrição: campos específicos */}
                {item.category === 'nutrition' && (item.nutVolDay || item.nutMode || item.nutFraction || item.nutBedHead || item.nutAccess || item.nutComposition) && (
                  <div style={{ fontSize: '7pt', color: '#1e293b', lineHeight: 1.3, marginTop: '2px', paddingLeft: '8px', borderLeft: '2px solid #16a34a', fontWeight: 500 }}>
                    {[
                      item.nutVolDay ? `Vol/dia: ${item.nutVolDay} mL` : null,
                      item.nutMode || null,
                      item.nutFraction ? `Frac: ${item.nutFraction}` : null,
                      item.nutNightPause ? `Pausa noturna: ${item.nutNightPause}` : null,
                      item.nutBedHead ? `Cabeceira: ${item.nutBedHead}°` : null,
                      item.nutAccess ? `Acesso: ${item.nutAccess}` : null,
                      item.nutComposition || null,
                      item.nutMonitoring ? `Monit: ${item.nutMonitoring}` : null,
                      item.nutResidualCheck ? `Resíduo: ${item.nutResidualCheck}` : null,
                      item.nutWaterVolPerAdmin ? `Água: ${item.nutWaterVolPerAdmin} mL` : null,
                      item.nutWaterFreq || null,
                      item.nutZeroReason ? `Motivo jejum: ${item.nutZeroReason}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}

                {/* Instruções livres (quando não há preparo/inalação/insulina) */}
                {item.instructions && !hasIvPreparo && !insulinDesc && !isInhalation && (
                  <div style={{ fontSize: '7pt', color: '#1e293b', lineHeight: 1.3, marginTop: '2px', paddingLeft: '8px', borderLeft: '2px solid #0c4a6e', fontWeight: 500 }}>
                    {item.instructions}
                  </div>
                )}
              </td>
              <td style={{ ...cellStyle, width: '230px', textAlign: 'left', verticalAlign: 'top', backgroundColor: '#fff', padding: '4px 6px' }}>
                {/* Coluna de aprazamento manual — em branco para preenchimento pela enfermagem */}
                <div style={{ minHeight: '38px' }} />
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
                      <td style={{ ...thStyle, width: '230px', textAlign: 'center', fontSize: '6.5pt' }}>Aprazamento / Checagem</td>
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
                          <td style={{ ...cellStyle, width: '22px', textAlign: 'center', backgroundColor: rowBg, color: '#0f172a', fontSize: '7.5pt', fontWeight: 800 }}>
                            {i + 1}
                          </td>
                          <td style={{ ...cellStyle, backgroundColor: rowBg }}>
                            <span style={{ fontWeight: 800, fontSize: '8pt', color: '#0f172a' }}>{item.name}</span>
                            {item.dose && item.dose !== '-' && <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '7.5pt' }}> — {item.dose}</span>}
                            {item.posology && item.posology !== '-' && <span style={{ color: '#1e293b', fontWeight: 600, fontSize: '7.5pt' }}> — {item.posology}</span>}
                            {item.instructions && (
                              <div style={{ fontSize: '7pt', color: '#1e293b', lineHeight: 1.3, marginTop: '2px', paddingLeft: '8px', borderLeft: '2px solid #0c4a6e', fontWeight: 500 }}>
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
