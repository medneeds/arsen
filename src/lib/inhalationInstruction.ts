/**
 * Constrói a instrução clínica humana para itens de prescrição inalatória.
 * Substitui o builder genérico de infusão IV (que não faz sentido em nebulização/puffs).
 */

import type { InhalationMode, InhalationInterface } from '@/data/inhalationCatalog';
import { INHALATION_INTERFACE_LABEL } from '@/data/inhalationCatalog';

export interface InhalationItemFields {
  name?: string;
  inhalationMode?: InhalationMode;
  nebDose?: string;
  nebDoseUnit?: 'mg' | 'gts' | 'mL' | 'mcg';
  diluent?: string;
  diluentVolume?: string;
  oxygenFlow?: string;
  stageDuration?: string;
  inhalationInterface?: InhalationInterface;
  posology?: string;
  puffs?: string;
  spacer?: boolean;
  gargle?: boolean;
  inhalationOrientation?: string;
  /** Para nebulização contínua: duração total em horas */
  continuousDuration?: string;
}

function joinDose(dose?: string, unit?: string): string {
  if (!dose) return '';
  return `${dose}${unit ? (unit === 'gts' ? ' gts' : ` ${unit}`) : ''}`;
}

function diluentLabel(d?: string): string {
  if (!d || d === 'puro' || d === 'sem_diluente') return '';
  if (d === 'SF0,9%') return 'SF 0,9%';
  if (d === 'SF3%') return 'SF 3%';
  if (d === 'AD') return 'água destilada';
  return d;
}

export function assembleInhalationInstruction(item: InhalationItemFields): string {
  const mode = item.inhalationMode || 'nebulization';
  const parts: string[] = [];

  if (mode === 'nebulization') {
    const dose = joinDose(item.nebDose, item.nebDoseUnit);
    const dil = diluentLabel(item.diluent);
    let header = '';
    if (dose) header = dose;
    if (dil) {
      const vol = item.diluentVolume ? ` ${item.diluentVolume} mL` : '';
      header += header ? ` diluído em ${dil}${vol}` : `diluir em ${dil}${vol}`;
    } else if (item.diluent === 'puro') {
      header += header ? ' (puro, sem diluição)' : 'puro, sem diluição';
    }
    if (header) parts.push(header);

    const tail: string[] = [];
    tail.push('nebulizar');
    if (item.oxygenFlow) tail.push(`com fluxo de O₂/Ar ${item.oxygenFlow} L/min`);
    if (item.stageDuration) tail.push(`por ${item.stageDuration} min`);
    if (item.inhalationInterface) tail.push(`via ${INHALATION_INTERFACE_LABEL[item.inhalationInterface].toLowerCase()}`);
    if (item.posology) tail.push(`— ${item.posology}`);
    parts.push(tail.join(' '));
  }

  if (mode === 'nebulization_continuous') {
    const dose = joinDose(item.nebDose, item.nebDoseUnit);
    const dil = diluentLabel(item.diluent);
    let header = '';
    if (dose) header = `${dose}/h`;
    if (dil) {
      const vol = item.diluentVolume ? ` ${item.diluentVolume} mL` : '';
      header += header ? ` em ${dil}${vol}` : `em ${dil}${vol}`;
    }
    if (header) parts.push(header);
    const tail: string[] = ['nebulização contínua'];
    if (item.oxygenFlow) tail.push(`fluxo O₂/Ar ${item.oxygenFlow} L/min`);
    if (item.inhalationInterface) tail.push(`via ${INHALATION_INTERFACE_LABEL[item.inhalationInterface].toLowerCase()}`);
    if (item.continuousDuration) tail.push(`por ${item.continuousDuration} h`);
    parts.push(tail.join(', '));
  }

  if (mode === 'pmdi') {
    const n = item.puffs || '1';
    let line = `${n} ${parseInt(n) > 1 ? 'puffs' : 'puff'}`;
    if (item.spacer) line += ' com espaçador';
    if (item.posology) line += ` — ${item.posology}`;
    parts.push(line);
    if (item.gargle) parts.push('Gargarejar com água após uso (corticoide).');
    if (item.inhalationOrientation) parts.push(item.inhalationOrientation);
  }

  if (mode === 'dpi') {
    const n = item.puffs || '1';
    let line = `${n} ${parseInt(n) > 1 ? 'inalações' : 'inalação'} (DPI)`;
    if (item.posology) line += ` — ${item.posology}`;
    parts.push(line);
    if (item.gargle) parts.push('Gargarejar após uso.');
    if (item.inhalationOrientation) parts.push(item.inhalationOrientation);
  }

  return parts.filter(Boolean).join('. ');
}

export function isInhalationItem(item: { category?: string }): boolean {
  return item.category === 'inhalation';
}
