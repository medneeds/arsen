/**
 * Sector bed configuration: defines prefix, max regular beds, and naming conventions.
 * 
 * Regular beds follow the pattern: PREFIX + NUMBER (e.g., L01, L03)
 * Extra beds (beyond capacity) follow: EXTRA + NUMBER (e.g., EXTRA1, EXTRA2)
 */

export interface SectorBedConfig {
  prefix: string;
  maxRegularBeds: number;
  label: string;
  startNumber?: number; // Starting bed number (default: 1)
}

export const SECTOR_BED_CONFIG: Record<string, SectorBedConfig> = {
  // UTIs
  red: { prefix: 'L', maxRegularBeds: 8, label: 'UTI 1', startNumber: 1 },
  yellow: { prefix: 'L', maxRegularBeds: 10, label: 'UTI 2', startNumber: 9 },
  // UCIs
  blue: { prefix: 'L', maxRegularBeds: 6, label: 'UCI 1', startNumber: 1 },
  outside: { prefix: 'L', maxRegularBeds: 8, label: 'UCI 2', startNumber: 7 },
  // UCC
  ucc: { prefix: 'L', maxRegularBeds: 37, label: 'UCC', startNumber: 1 }, // 35 regulares + 2 estabilização (L36, L37)
  // Enfermarias
  neuro_01: { prefix: 'L', maxRegularBeds: 10, label: 'Neuro 01', startNumber: 1 },
  neuro_02: { prefix: 'L', maxRegularBeds: 10, label: 'Neuro 02', startNumber: 11 },
  clinica_cirurgica: { prefix: 'L', maxRegularBeds: 40, label: 'Clínica Cirúrgica', startNumber: 1 },
  enfermaria_transicao: { prefix: 'L', maxRegularBeds: 10, label: 'Enf. Transição', startNumber: 37 },
  enfermaria_vascular: { prefix: 'L', maxRegularBeds: 95, label: 'Enf. Vascular', startNumber: 1 },
  // Urgência e Emergência
  sala_vermelha: { prefix: 'SV', maxRegularBeds: 6, label: 'Sala Vermelha' },
  sala_laranja: { prefix: 'OL', maxRegularBeds: 12, label: 'Sala Laranja' },
  observacao_clinica: { prefix: 'OC', maxRegularBeds: 20, label: 'Obs. Clínica' },
  ue_vertical: { prefix: 'EV', maxRegularBeds: 20, label: 'UE Vertical' },
  ue_horizontal: { prefix: 'EH', maxRegularBeds: 20, label: 'UE Horizontal' },
  // RIV
  riv: { prefix: 'RV', maxRegularBeds: 10, label: 'RIV' },
};

/**
 * Determines the next bed number for a given sector based on existing beds.
 */
export function getNextBedNumber(
  sector: string,
  existingBedNumbers: string[],
  department?: string
): string {
  // UTI has its own fixed logic
  if (department === 'UTI') {
    const nums = existingBedNumbers
      .map(b => parseInt(b.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `U${String(max + 1).padStart(2, '0')}`;
  }

  const config = SECTOR_BED_CONFIG[sector];
  if (!config) {
    return `X${String(existingBedNumbers.length + 1).padStart(2, '0')}`;
  }

  const start = config.startNumber ?? 1;
  const end = start + config.maxRegularBeds - 1;

  const regularBedNumbers = existingBedNumbers
    .filter(b => b.startsWith(config.prefix))
    .map(b => parseInt(b.substring(config.prefix.length), 10))
    .filter(n => !isNaN(n) && n >= start && n <= end);

  if (regularBedNumbers.length < config.maxRegularBeds) {
    for (let i = start; i <= end; i++) {
      if (!regularBedNumbers.includes(i)) {
        return `${config.prefix}${String(i).padStart(2, '0')}`;
      }
    }
    return `${config.prefix}${String(end).padStart(2, '0')}`;
  }

  // All regular beds occupied → assign EXTRA bed
  const extraBedNumbers = existingBedNumbers
    .filter(b => b.startsWith('EXTRA'))
    .map(b => parseInt(b.replace('EXTRA', ''), 10))
    .filter(n => !isNaN(n));

  const nextExtra = extraBedNumbers.length > 0 ? Math.max(...extraBedNumbers) + 1 : 1;
  return `EXTRA${nextExtra}`;
}

/**
 * Checks if a bed number is an "extra" bed (beyond sector capacity).
 */
export function isExtraBed(bedNumber: string): boolean {
  return bedNumber.startsWith('EXTRA');
}

/**
 * Returns the display label for a bed number.
 */
export function formatBedDisplay(bedNumber: string): string {
  if (isExtraBed(bedNumber)) {
    const num = bedNumber.replace('EXTRA', '');
    return `EXTRA ${num}`;
  }
  return bedNumber;
}

/**
 * Central mapping from internal sector codes to display labels.
 * Re-exports from DepartmentContext to maintain a single source of truth.
 */
import { SECTOR_DISPLAY as SECTOR_DISPLAY_LABELS_SOURCE } from "@/contexts/DepartmentContext";

export const SECTOR_DISPLAY_LABELS = SECTOR_DISPLAY_LABELS_SOURCE;

/**
 * Returns the display label for a sector code.
 */
export function getSectorDisplayLabel(sector: string | null | undefined): string {
  if (!sector) return '';
  return SECTOR_DISPLAY_LABELS[sector] || SECTOR_BED_CONFIG[sector]?.label || sector;
}

/**
 * Derives the UTI/UCI sector name from a bed number (L-prefixed).
 * UTI 1: L01–L08, UTI 2: L09–L18, UCI 1: L01–L06 (context), UCI 2: L07–L14 (context)
 */
export function getSectorFromBedNumber(bedNumber: string): string | null {
  const match = bedNumber.match(/^L(\d+)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (num >= 1 && num <= 8) return 'UTI 1';
  if (num >= 9 && num <= 18) return 'UTI 2';
  return null;
}
