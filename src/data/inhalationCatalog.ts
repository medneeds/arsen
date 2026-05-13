/**
 * Catálogo de drogas inalatórias com defaults clínicos.
 * Usado para autofill quando o item adicionado é da categoria 'inhalation'.
 */

export type InhalationMode =
  | 'nebulization'           // Nebulização jato/ultrassônica
  | 'nebulization_continuous' // Nebulização contínua (crise grave de asma)
  | 'pmdi'                   // Spray pressurizado (puffs)
  | 'dpi';                   // Pó seco (cápsula/inalação)

export type InhalationInterface =
  | 'mascara'
  | 'traqueostomia'
  | 'peca_t'
  | 'circuito_vm'
  | 'bocal';

export interface InhalationPreset {
  /** Substring (lowercase, sem acento) para casamento por nome */
  match: string[];
  mode: InhalationMode;
  nebDose?: string;
  nebDoseUnit?: 'mg' | 'gts' | 'mL' | 'mcg';
  diluent?: '' | 'SF0,9%' | 'AD' | 'SF3%' | 'puro';
  diluentVolume?: string; // mL
  oxygenFlow?: string;    // L/min
  stageDuration?: string; // min por etapa
  inhalationInterface?: InhalationInterface;
  posology?: string;      // padrão (6/6h, 8/8h, 12/12h, 1x/dia)
  puffs?: string;
  spacer?: boolean;
  gargle?: boolean;
  inhalationOrientation?: string;
}

export const INHALATION_CATALOG: InhalationPreset[] = [
  // --- Nebulização ---
  { match: ['berotec', 'fenoterol'], mode: 'nebulization', nebDose: '10', nebDoseUnit: 'gts', diluent: 'SF0,9%', diluentVolume: '3', oxygenFlow: '6', stageDuration: '10', inhalationInterface: 'mascara', posology: '6/6h' },
  { match: ['atrovent', 'ipratropio', 'ipratrópio', 'brometo de ipratropio'], mode: 'nebulization', nebDose: '20', nebDoseUnit: 'gts', diluent: 'SF0,9%', diluentVolume: '3', oxygenFlow: '6', stageDuration: '10', inhalationInterface: 'mascara', posology: '6/6h' },
  { match: ['salbutamol nebulização', 'salbutamol neb', 'salbutamol solução', 'aerolin solução'], mode: 'nebulization', nebDose: '10', nebDoseUnit: 'gts', diluent: 'SF0,9%', diluentVolume: '3', oxygenFlow: '6', stageDuration: '10', inhalationInterface: 'mascara', posology: '6/6h' },
  { match: ['budesonida nebulização', 'budesonida 0,5', 'busonid neb', 'pulmicort'], mode: 'nebulization', nebDose: '0,5', nebDoseUnit: 'mg', diluent: 'SF0,9%', diluentVolume: '3', oxygenFlow: '6', stageDuration: '10', inhalationInterface: 'mascara', posology: '12/12h' },
  { match: ['adrenalina nebuliz', 'epinefrina nebuliz', 'adrenalina inal'], mode: 'nebulization', nebDose: '5', nebDoseUnit: 'mL', diluent: 'puro', diluentVolume: '', oxygenFlow: '6', stageDuration: '10', inhalationInterface: 'mascara', posology: 'SOS' },
  { match: ['nacl 3', 'salina hipertônica', 'soro hipertônico', 'salina 3%'], mode: 'nebulization', nebDose: '4', nebDoseUnit: 'mL', diluent: 'puro', diluentVolume: '', oxygenFlow: '6', stageDuration: '10', inhalationInterface: 'mascara', posology: '12/12h' },
  { match: ['n-acetilcisteina', 'acetilcisteina nebuliz', 'fluimucil nebuliz'], mode: 'nebulization', nebDose: '300', nebDoseUnit: 'mg', diluent: 'SF0,9%', diluentVolume: '3', oxygenFlow: '6', stageDuration: '10', inhalationInterface: 'mascara', posology: '8/8h' },
  { match: ['lidocaina nebuliz', 'xilocaína nebuliz'], mode: 'nebulization', nebDose: '40', nebDoseUnit: 'mg', diluent: 'SF0,9%', diluentVolume: '3', oxygenFlow: '6', stageDuration: '10', inhalationInterface: 'mascara', posology: 'SOS' },
  { match: ['dnase', 'pulmozyme', 'dornase'], mode: 'nebulization', nebDose: '2,5', nebDoseUnit: 'mg', diluent: 'puro', diluentVolume: '', oxygenFlow: '6', stageDuration: '15', inhalationInterface: 'mascara', posology: '1x/dia' },
  { match: ['colistina inal', 'colistimetato inal'], mode: 'nebulization', nebDose: '75', nebDoseUnit: 'mg', diluent: 'SF0,9%', diluentVolume: '4', oxygenFlow: '6', stageDuration: '15', inhalationInterface: 'mascara', posology: '12/12h' },
  { match: ['tobramicina inal', 'tobi'], mode: 'nebulization', nebDose: '300', nebDoseUnit: 'mg', diluent: 'puro', diluentVolume: '', oxygenFlow: '6', stageDuration: '15', inhalationInterface: 'mascara', posology: '12/12h' },
  { match: ['iloprost'], mode: 'nebulization', nebDose: '2,5', nebDoseUnit: 'mcg', diluent: 'puro', diluentVolume: '', oxygenFlow: '6', stageDuration: '10', inhalationInterface: 'mascara', posology: '6/6h' },

  // --- pMDI (puffs) ---
  { match: ['salbutamol spray', 'aerolin spray', 'salbutamol aerossol', 'salbutamol pmdi'], mode: 'pmdi', puffs: '2', spacer: true, posology: '6/6h', inhalationOrientation: 'Agitar antes do uso. Inspirar lentamente após o disparo, manter apneia 10s.' },
  { match: ['beclometasona', 'clenil'], mode: 'pmdi', puffs: '2', spacer: true, gargle: true, posology: '12/12h', inhalationOrientation: 'Agitar. Usar com espaçador. Gargarejar com água após o uso (prevenção de candidíase).' },
  { match: ['budesonida spray', 'pulmicort spray'], mode: 'pmdi', puffs: '2', spacer: true, gargle: true, posology: '12/12h', inhalationOrientation: 'Usar com espaçador. Gargarejar após uso.' },
  { match: ['fluticasona spray', 'flixotide'], mode: 'pmdi', puffs: '2', spacer: true, gargle: true, posology: '12/12h', inhalationOrientation: 'Usar com espaçador. Gargarejar após uso.' },
  { match: ['fluticasona/salmeterol', 'seretide spray', 'fluticasona + salmeterol'], mode: 'pmdi', puffs: '2', spacer: true, gargle: true, posology: '12/12h', inhalationOrientation: 'Usar com espaçador. Gargarejar após uso.' },

  // --- DPI ---
  { match: ['formoterol', 'foradil'], mode: 'dpi', puffs: '1', posology: '12/12h', inhalationOrientation: 'Inalação única, expiração lenta após inspiração profunda.' },
  { match: ['salmeterol dpi', 'serevent diskus'], mode: 'dpi', puffs: '1', posology: '12/12h' },
  { match: ['tiotropio', 'tiotrópio', 'spiriva'], mode: 'dpi', puffs: '1', posology: '1x/dia', inhalationOrientation: 'Cápsula inalada via dispositivo HandiHaler/Respimat — 1x/dia.' },
  { match: ['indacaterol', 'onbrize'], mode: 'dpi', puffs: '1', posology: '1x/dia' },
  { match: ['budesonida + formoterol', 'symbicort', 'vannair', 'alenia'], mode: 'dpi', puffs: '1', posology: '12/12h', gargle: true, inhalationOrientation: 'Gargarejar após uso (corticoide inalado).' },
  { match: ['fluticasona/vilanterol', 'relvar', 'breo'], mode: 'dpi', puffs: '1', posology: '1x/dia', gargle: true },
];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function getInhalationDefaults(name: string): InhalationPreset | null {
  if (!name) return null;
  const n = norm(name);
  for (const preset of INHALATION_CATALOG) {
    if (preset.match.some(m => n.includes(norm(m)))) return preset;
  }
  return null;
}

export const INHALATION_INTERFACE_LABEL: Record<InhalationInterface, string> = {
  mascara: 'Máscara facial',
  traqueostomia: 'Traqueostomia',
  peca_t: 'Peça em T',
  circuito_vm: 'Circuito de VM',
  bocal: 'Bocal',
};

export const INHALATION_MODE_LABEL: Record<InhalationMode, string> = {
  nebulization: 'Nebulização',
  nebulization_continuous: 'Nebulização contínua',
  pmdi: 'Spray (pMDI)',
  dpi: 'Pó seco (DPI)',
};
