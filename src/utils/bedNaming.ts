/**
 * Sector bed configuration: defines prefix, max regular beds, and naming conventions.
 * 
 * Regular beds follow the pattern: PREFIX + NUMBER (e.g., V01, A03, Z06)
 * Extra beds (beyond capacity) follow: EXTRA + NUMBER (e.g., EXTRA1, EXTRA2)
 */

export interface SectorBedConfig {
  prefix: string;
  maxRegularBeds: number;
  label: string;
  startNumber?: number; // Starting bed number (default: 1)
}

export const SECTOR_BED_CONFIG: Record<string, SectorBedConfig> = {
  red: { prefix: 'L', maxRegularBeds: 8, label: 'UTI 1', startNumber: 1 },
  yellow: { prefix: 'L', maxRegularBeds: 10, label: 'UTI 2', startNumber: 9 },
  blue: { prefix: 'L', maxRegularBeds: 8, label: 'UCI 1', startNumber: 19 },
  outside: { prefix: 'L', maxRegularBeds: 8, label: 'UCI 2', startNumber: 27 },
};

/**
 * Determines the next bed number for a given sector based on existing beds.
 * 
 * Logic:
 * 1. If there are available regular slots (V01-V02, A01-A06, Z01-Z06),
 *    assigns the next sequential regular bed.
 * 2. If all regular slots are filled, assigns an EXTRA bed (EXTRA1, EXTRA2, ...).
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
    // Fallback for unknown sectors
    return `X${String(existingBedNumbers.length + 1).padStart(2, '0')}`;
  }

  const start = config.startNumber ?? 1;
  const end = start + config.maxRegularBeds - 1;

  // Count how many regular beds (with the sector prefix in this range) exist
  const regularBedNumbers = existingBedNumbers
    .filter(b => b.startsWith(config.prefix))
    .map(b => parseInt(b.substring(config.prefix.length), 10))
    .filter(n => !isNaN(n) && n >= start && n <= end);

  if (regularBedNumbers.length < config.maxRegularBeds) {
    // Find the first available slot in range
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
 * Regular beds: "V01", "A03", etc.
 * Extra beds: "EXTRA 1", "EXTRA 2", etc.
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
 * Use this everywhere instead of local mappings.
 */
export const SECTOR_DISPLAY_LABELS: Record<string, string> = {
  red: 'UTI 1',
  yellow: 'UTI 2',
  blue: 'UCI 1',
  outside: 'UCI 2',
};

/**
 * Returns the display label for a sector code.
 * Falls back to the raw code if unknown.
 */
export function getSectorDisplayLabel(sector: string | null | undefined): string {
  if (!sector) return '';
  return SECTOR_DISPLAY_LABELS[sector] || SECTOR_BED_CONFIG[sector]?.label || sector;
}

/**
 * Derives the UTI/UCI sector name from a bed number (L-prefixed).
 * UTI 1: L01–L08, UTI 2: L09–L18, UCI 1: L19–L26, UCI 2: L27–L34
 */
export function getSectorFromBedNumber(bedNumber: string): string | null {
  const match = bedNumber.match(/^L(\d+)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (num >= 1 && num <= 8) return 'UTI 1';
  if (num >= 9 && num <= 18) return 'UTI 2';
  if (num >= 19 && num <= 26) return 'UCI 1';
  if (num >= 27 && num <= 34) return 'UCI 2';
  return null;
}
