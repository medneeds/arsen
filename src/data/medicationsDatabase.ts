// Database de medicamentos para prescrição médica
// Categorias inspiradas no modelo Medora, adaptadas para o Socorrão I

export type PrescriptionCategory =
  | 'nutrition'       // Dietas e suplementos nutricionais
  | 'hydration'       // Soluções de hidratação
  | 'medication'      // Medicamentos gerais
  | 'antimicrobial'   // Antimicrobianos (antibióticos, antifúngicos, antivirais)
  | 'high_alert'      // Medicamentos de alta vigilância
  | 'inhalation'      // Inalatórios e nebulizações
  | 'hemotherapy'     // Hemocomponentes
  | 'care'            // Cuidados de enfermagem
  | 'nonstandard';    // Itens não padronizados

export interface MedicationEntry {
  id: string;
  name: string;
  presentation: string;
  defaultDose: string;
  defaultRoute: string;
  defaultPosology: string;
  defaultSchedule: string;
  instructions?: string;
  category: PrescriptionCategory;
  highAlert?: boolean;
  aliases?: string[]; // Nomes alternativos para busca
}

export const CATEGORY_CONFIG: Record<PrescriptionCategory, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  nutrition:     { label: 'Nutrição',          icon: 'UtensilsCrossed', color: 'text-emerald-500',  bgColor: 'bg-emerald-500/10' },
  hydration:     { label: 'Hidratação',        icon: 'Droplets',       color: 'text-blue-500',     bgColor: 'bg-blue-500/10' },
  medication:    { label: 'Medicamentos',      icon: 'Pill',           color: 'text-primary',      bgColor: 'bg-primary/10' },
  antimicrobial: { label: 'Antimicrobianos',   icon: 'Shield',         color: 'text-orange-500',   bgColor: 'bg-orange-500/10' },
  high_alert:    { label: 'Alta Vigilância',   icon: 'AlertTriangle',  color: 'text-red-500',      bgColor: 'bg-red-500/10' },
  inhalation:    { label: 'Inalação',          icon: 'Wind',           color: 'text-cyan-500',     bgColor: 'bg-cyan-500/10' },
  hemotherapy:   { label: 'Hemoterapia',       icon: 'TestTube',       color: 'text-rose-500',     bgColor: 'bg-rose-500/10' },
  care:          { label: 'Cuidados',          icon: 'ClipboardList',  color: 'text-amber-500',    bgColor: 'bg-amber-500/10' },
  nonstandard:   { label: 'Não Padronizado',   icon: 'FileText',       color: 'text-gray-500',     bgColor: 'bg-gray-500/10' },
};

export const PRESCRIPTION_FLAGS = [
  { key: 'bi',  label: 'BI',  fullLabel: 'Bomba de Infusão',    color: 'bg-blue-500/20 text-blue-700 border-blue-300' },
  { key: 'sn',  label: 'SN',  fullLabel: 'Se Necessário',       color: 'bg-yellow-500/20 text-yellow-700 border-yellow-300' },
  { key: 'acm', label: 'ACM', fullLabel: 'A Critério Médico',   color: 'bg-purple-500/20 text-purple-700 border-purple-300' },
  { key: 'cp',  label: 'CP',  fullLabel: 'Cuidados Paliativos', color: 'bg-teal-500/20 text-teal-700 border-teal-300' },
  { key: 'bu',  label: 'BU',  fullLabel: 'Bolus/Urgência',      color: 'bg-red-500/20 text-red-700 border-red-300' },
] as const;

export type PrescriptionFlag = typeof PRESCRIPTION_FLAGS[number]['key'];

export const ROUTES: string[] = [
  'Oral', 'Intravenosa', 'Intramuscular', 'Subcutânea', 'Retal',
  'Sublingual', 'Tópica', 'Inalatória', 'Nasal', 'Oftálmica',
  'Otológica', 'Transdérmica', 'Enteral (SNE/SNG)', 'Gastrostomia',
];

export const POSOLOGIES: string[] = [
  '1x/dia', '2x/dia', '3x/dia', '4x/dia',
  '6/6h', '8/8h', '12/12h', '24/24h', '4/4h', '2/2h',
  'ACM', 'SOS', 'Dose única', 'Contínuo',
];

export const COMMON_SCHEDULES: string[] = [
  '06h', '08h', '10h', '12h', '14h', '16h',
  '18h', '20h', '22h', '00h', '02h', '04h', 'ACM',
];

// ========== NUTRIÇÃO ==========
export const DIET_OPTIONS: MedicationEntry[] = [
  { id: 'd1', name: 'Dieta zero', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '-', defaultSchedule: '-', category: 'nutrition' },
  { id: 'd2', name: 'Dieta via oral livre', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'nutrition' },
  { id: 'd3', name: 'Dieta via oral para DM', presentation: '-', defaultDose: 'TN', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'nutrition' },
  { id: 'd4', name: 'Dieta via oral para DM2', presentation: '-', defaultDose: 'TN', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'nutrition' },
  { id: 'd5', name: 'Dieta via oral hipossódica', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'nutrition' },
  { id: 'd6', name: 'Dieta via oral pastosa', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'nutrition' },
  { id: 'd7', name: 'Dieta via oral branda', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'nutrition' },
  { id: 'd8', name: 'Dieta via oral líquida', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'nutrition' },
  { id: 'd9', name: 'Dieta enteral via SNE', presentation: '-', defaultDose: '-', defaultRoute: 'Enteral (SNE/SNG)', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'nutrition' },
  { id: 'd10', name: 'Água oral livre', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'nutrition' },
  { id: 'd11', name: 'Dieta hipercalórica e hiperproteica', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'nutrition' },
];

// ========== HIDRATAÇÃO ==========
export const SOLUTION_OPTIONS: MedicationEntry[] = [
  { id: 's1', name: 'Soro Fisiológico 0,9%', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's2', name: 'Soro Fisiológico 0,9%', presentation: '250mL', defaultDose: '250mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's3', name: 'Soro Fisiológico 0,9%', presentation: '100mL', defaultDose: '100mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's4', name: 'Soro Glicosado 5%', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's5', name: 'Soro Glicosado 5%', presentation: '250mL', defaultDose: '250mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's6', name: 'Ringer Lactato', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's7', name: 'Soro Glicofisiológico', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
];

// ========== ANTIMICROBIANOS ==========
export const ANTIMICROBIAL_OPTIONS: MedicationEntry[] = [
  { id: 'atm1', name: 'Ceftriaxona', presentation: '1g - Frasco-ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'antimicrobial' },
  { id: 'atm2', name: 'Ceftriaxona', presentation: '2g - Frasco-ampola', defaultDose: '2g', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'antimicrobial' },
  { id: 'atm3', name: 'Amoxicilina + Clavulanato', presentation: '1g - Frasco-ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'antimicrobial' },
  { id: 'atm4', name: 'Piperacilina + Tazobactam', presentation: '4,5g - Frasco-ampola', defaultDose: '4,5g', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'antimicrobial' },
  { id: 'atm5', name: 'Meropenem', presentation: '1g - Frasco-ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min a 3h.', category: 'antimicrobial' },
  { id: 'atm6', name: 'Vancomicina', presentation: '500mg - Frasco-ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Diluir em 250mL de SF0,9%. Infundir em 60 min. NUNCA em bolus.', category: 'antimicrobial' },
  { id: 'atm7', name: 'Metronidazol', presentation: '500mg/100mL - Bolsa', defaultDose: '500mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Infundir em 30-60 min.', category: 'antimicrobial' },
  { id: 'atm8', name: 'Ciprofloxacino', presentation: '200mg/100mL - Bolsa', defaultDose: '400mg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Infundir em 60 min.', category: 'antimicrobial' },
  { id: 'atm9', name: 'Azitromicina', presentation: '500mg - Frasco-ampola', defaultDose: '500mg', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', category: 'antimicrobial' },
  { id: 'atm10', name: 'Fluconazol', presentation: '200mg/100mL - Bolsa', defaultDose: '200mg', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', instructions: 'Infundir em 60-120 min.', category: 'antimicrobial' },
  { id: 'atm11', name: 'Aciclovir', presentation: '250mg - Frasco-ampola', defaultDose: '250mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 60 min.', category: 'antimicrobial' },
  { id: 'atm12', name: 'Oxacilina', presentation: '500mg - Frasco-ampola', defaultDose: '2g', defaultRoute: 'Intravenosa', defaultPosology: '4/4h', defaultSchedule: '06h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'antimicrobial' },
  { id: 'atm13', name: 'Polimixina B', presentation: '500.000 UI - Frasco-ampola', defaultDose: '25.000 UI/kg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Diluir em 250mL de SG5%. Infundir em 60 min.', category: 'antimicrobial' },
  { id: 'atm14', name: 'Linezolida', presentation: '600mg/300mL - Bolsa', defaultDose: '600mg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Infundir em 30-120 min.', category: 'antimicrobial' },
];

// ========== ALTA VIGILÂNCIA ==========
export const HIGH_ALERT_OPTIONS: MedicationEntry[] = [
  { id: 'ha1', name: 'Noradrenalina', presentation: '1mg/mL - Ampola 4mL', defaultDose: '8mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Diluir 8mL em 92mL SG5%. Uso em bomba de infusão. Vesicante.', category: 'high_alert', highAlert: true },
  { id: 'ha2', name: 'Dobutamina', presentation: '250mg - Ampola 20mL', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Diluir em 230mL de SG5%. Uso em bomba de infusão.', category: 'high_alert', highAlert: true },
  { id: 'ha3', name: 'Insulina Regular', presentation: '100UI/mL - Frasco', defaultDose: 'Conforme esquema', defaultRoute: 'Subcutânea', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Conforme protocolo de controle glicêmico.', category: 'high_alert', highAlert: true },
  { id: 'ha4', name: 'Insulina NPH', presentation: '100UI/mL - Frasco', defaultDose: 'Conforme esquema', defaultRoute: 'Subcutânea', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'high_alert', highAlert: true },
  { id: 'ha5', name: 'KCl 19,1%', presentation: '10mL - Ampola', defaultDose: '10mL', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'NUNCA em bolus. Diluir em 500mL de SF0,9%. Infundir em 4-6h.', category: 'high_alert', highAlert: true },
  { id: 'ha6', name: 'Heparina Sódica', presentation: '5.000UI/0,25mL - Ampola', defaultDose: '5.000UI', defaultRoute: 'Subcutânea', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'high_alert', highAlert: true },
  { id: 'ha7', name: 'Midazolam', presentation: '5mg/mL - Ampola 3mL', defaultDose: '15mg', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Uso em bomba de infusão conforme protocolo de sedação.', category: 'high_alert', highAlert: true },
  { id: 'ha8', name: 'Fentanil', presentation: '50mcg/mL - Ampola 10mL', defaultDose: '500mcg', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Uso em bomba de infusão conforme protocolo de sedação.', category: 'high_alert', highAlert: true },
  { id: 'ha9', name: 'Propofol', presentation: '10mg/mL - Frasco 20mL', defaultDose: '200mg', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Uso em bomba de infusão. Não misturar com outras drogas.', category: 'high_alert', highAlert: true },
  { id: 'ha10', name: 'Nitroprussiato de Sódio', presentation: '50mg - Ampola', defaultDose: '50mg', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Diluir em 250mL de SG5%. Fotossensível. Bomba de infusão.', category: 'high_alert', highAlert: true },
  { id: 'ha11', name: 'Nitroglicerina', presentation: '50mg/10mL - Ampola', defaultDose: '50mg', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Diluir em 240mL de SG5%. Bomba de infusão.', category: 'high_alert', highAlert: true },
  { id: 'ha12', name: 'Morfina', presentation: '10mg/mL - Ampola 1mL', defaultDose: '1-5mg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Diluir 1mL em 9mL de SF0,9% (1mg/mL). Aplicar lentamente.', category: 'high_alert', highAlert: true },
  { id: 'ha13', name: 'Cetamina (Ketamina)', presentation: '50mg/mL - Frasco 10mL', defaultDose: '1-2mg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', category: 'high_alert', highAlert: true },
  { id: 'ha14', name: 'Amiodarona', presentation: '150mg/3mL - Ampola', defaultDose: '300mg', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SG5%.', category: 'high_alert', highAlert: true },
  { id: 'ha15', name: 'Terlipressina', presentation: '1mg - Frasco-ampola', defaultDose: '1mg', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 10mL de SF0,9%. Infundir em bolus lento.', category: 'high_alert', highAlert: true },
  { id: 'ha16', name: 'Glicose 50%', presentation: '20mL - Ampola', defaultDose: '40mL', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Se glicemia menor que 70mg/dL.', category: 'high_alert', highAlert: true },
];

// ========== INALAÇÃO ==========
export const INHALATION_OPTIONS: MedicationEntry[] = [
  { id: 'inh1', name: 'Salbutamol (Aerolin)', presentation: '5mg/mL - Frasco', defaultDose: '10 gotas', defaultRoute: 'Inalatória', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 3mL de SF0,9%. Nebulização.', category: 'inhalation' },
  { id: 'inh2', name: 'Ipratrópio (Atrovent)', presentation: '0,25mg/mL - Frasco', defaultDose: '20 gotas', defaultRoute: 'Inalatória', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Nebulização associada ao salbutamol.', category: 'inhalation' },
  { id: 'inh3', name: 'Salbutamol + Ipratrópio', presentation: 'Nebulização combinada', defaultDose: '10gts + 20gts', defaultRoute: 'Inalatória', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 3mL de SF0,9%. Nebulização.', category: 'inhalation' },
  { id: 'inh4', name: 'Budesonida', presentation: '0,25mg/mL - Frasco', defaultDose: '2mL', defaultRoute: 'Inalatória', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Nebulização.', category: 'inhalation' },
  { id: 'inh5', name: 'Adrenalina (NBZ)', presentation: '1mg/mL - Ampola', defaultDose: '3-5mL', defaultRoute: 'Inalatória', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Diluir em 3mL de SF0,9%. Nebulização para laringite/estridor.', category: 'inhalation' },
];

// ========== HEMOTERAPIA ==========
export const HEMOTHERAPY_OPTIONS: MedicationEntry[] = [
  { id: 'hem1', name: 'Concentrado de Hemácias', presentation: 'Bolsa', defaultDose: '1 unidade', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Transfundir em 2-4h. Tipagem ABO/Rh obrigatória.', category: 'hemotherapy' },
  { id: 'hem2', name: 'Concentrado de Hemácias Lavadas', presentation: 'Bolsa', defaultDose: '1 unidade', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Transfundir em 2-4h. Tipagem ABO/Rh obrigatória.', category: 'hemotherapy' },
  { id: 'hem3', name: 'Plasma Fresco Congelado', presentation: 'Bolsa', defaultDose: '1 unidade', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Descongelar antes. Transfundir em até 30 min após descongelamento.', category: 'hemotherapy' },
  { id: 'hem4', name: 'Concentrado de Plaquetas', presentation: 'Bolsa', defaultDose: '1 unidade/10kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Transfundir em 30-60 min.', category: 'hemotherapy' },
  { id: 'hem5', name: 'Crioprecipitado', presentation: 'Bolsa', defaultDose: '1 unidade/10kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Transfundir em 30-60 min.', category: 'hemotherapy' },
];

// ========== CUIDADOS ==========
export const CARE_OPTIONS: MedicationEntry[] = [
  { id: 'c1', name: 'Cabeceira elevada 30-45°', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
  { id: 'c2', name: 'Oximetria de pulso contínua', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
  { id: 'c3', name: 'Monitorização cardíaca contínua', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
  { id: 'c4', name: 'Fisioterapia motora e respiratória', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '3x/dia', defaultSchedule: '-', category: 'care' },
  { id: 'c5', name: 'Mudança de decúbito', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '2/2h', defaultSchedule: '-', category: 'care' },
  { id: 'c6', name: 'Aspiração traqueal', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'SOS', defaultSchedule: '-', category: 'care' },
  { id: 'c7', name: 'Controle glicêmico', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'care' },
  { id: 'c8', name: 'Balanço hídrico', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '6/6h', defaultSchedule: '-', category: 'care' },
  { id: 'c9', name: 'Sinais vitais e neurocheck', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '2/2h', defaultSchedule: '-', category: 'care' },
  { id: 'c10', name: 'Compressor pneumático intermitente MMII', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
  { id: 'c11', name: 'Ventilação Mecânica', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
  { id: 'c12', name: 'Cuidados com acessos venosos centrais', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
  { id: 'c13', name: 'Cuidados com SVD', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
  { id: 'c14', name: 'Cuidados com SNE', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
  { id: 'c15', name: 'Profilaxia de TVP conforme protocolo', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '-', defaultSchedule: '-', category: 'care' },
  { id: 'c16', name: 'Acompanhamento com fonoaudiologia', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '-', defaultSchedule: '-', category: 'care' },
  { id: 'c17', name: 'Acompanhamento com psicologia', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '-', defaultSchedule: '-', category: 'care' },
  { id: 'c18', name: 'Comunicar plantonista se instabilidade', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '-', defaultSchedule: '-', category: 'care' },
  { id: 'c19', name: 'Manter PAM > 65mmHg', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
  { id: 'c20', name: 'Restrição hídrica', presentation: '-', defaultDose: '____mL/dia', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
];

// ========== MEDICAMENTOS GERAIS ==========
export const MEDICATIONS_DATABASE: MedicationEntry[] = [
  // Analgésicos e Antipiréticos
  { id: 'm1', name: 'Dipirona', presentation: '500mg/mL - Ampola 2mL', defaultDose: '1g (2mL)', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 18mL de SF0,9%. Infundir lentamente.', category: 'medication', aliases: ['Metamizol'] },
  { id: 'm2', name: 'Dipirona', presentation: '500mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medication' },
  { id: 'm3', name: 'Paracetamol', presentation: '500mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medication' },
  { id: 'm4', name: 'Paracetamol', presentation: '750mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medication' },
  { id: 'm5', name: 'Tramadol', presentation: '50mg/mL - Ampola 2mL', defaultDose: '100mg (2mL)', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'medication' },

  // Cardiovascular
  { id: 'm20', name: 'AAS', presentation: '100mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '13h', category: 'medication' },
  { id: 'm21', name: 'Clopidogrel', presentation: '75mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication' },
  { id: 'm22', name: 'Sinvastatina', presentation: '40mg comprimido', defaultDose: '2 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '22h', category: 'medication' },
  { id: 'm23', name: 'Enalapril', presentation: '10mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm24', name: 'Losartana', presentation: '50mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm25', name: 'Anlodipino', presentation: '5mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication' },
  { id: 'm26', name: 'Enoxaparina (Clexane)', presentation: '40mg/0,4mL - Seringa', defaultDose: '40mg', defaultRoute: 'Subcutânea', defaultPosology: '24/24h', defaultSchedule: '22h', instructions: 'Administrar 1 seringa.', category: 'medication' },
  { id: 'm27', name: 'Enoxaparina (Clexane)', presentation: '60mg/0,6mL - Seringa', defaultDose: '60mg', defaultRoute: 'Subcutânea', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm28', name: 'Furosemida', presentation: '20mg/2mL - Ampola', defaultDose: '20mg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm29', name: 'Furosemida', presentation: '40mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication' },

  // Gastrointestinal
  { id: 'm30', name: 'Omeprazol', presentation: '40mg - Frasco-ampola', defaultDose: '1 frasco', defaultRoute: 'Intravenosa', defaultPosology: '1x/dia', defaultSchedule: '06h', instructions: 'Diluir 01 frasco em diluente próprio. Via Intravenosa.', category: 'medication' },
  { id: 'm31', name: 'Omeprazol', presentation: '40mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '24/24h', defaultSchedule: '06h', instructions: 'NA AUSÊNCIA DO ITEM EV.', category: 'medication' },
  { id: 'm32', name: 'Pantoprazol', presentation: '40mg - Frasco-ampola', defaultDose: '1 frasco', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '06h', category: 'medication' },
  { id: 'm33', name: 'Metoclopramida (Plasil)', presentation: '10mg/2mL - Ampola', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm34', name: 'Ondansetrona', presentation: '4mg/2mL - Ampola', defaultDose: '4mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm35', name: 'Bromoprida', presentation: '10mg/2mL - Ampola', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm36', name: 'Lactulose', presentation: '667mg/mL - Frasco', defaultDose: '15-30mL', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication' },

  // Corticosteróides
  { id: 'm42', name: 'Hidrocortisona', presentation: '100mg - Frasco-ampola', defaultDose: '100mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm43', name: 'Dexametasona', presentation: '4mg/mL - Ampola 2,5mL', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm44', name: 'Prednisona', presentation: '20mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication' },

  // Anticonvulsivantes
  { id: 'm47', name: 'Fenitoína', presentation: '250mg/5mL - Ampola', defaultDose: '250mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 250mL de SF0,9%. Infundir lentamente (máx 50mg/min).', category: 'medication' },
  { id: 'm48', name: 'Diazepam', presentation: '10mg/2mL - Ampola', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Aplicar lentamente. Não diluir.', category: 'medication' },

  // Eletrólitos
  { id: 'm50', name: 'Sulfato de Magnésio 50%', presentation: '10mL - Ampola', defaultDose: '2g', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'medication' },
  { id: 'm51', name: 'Gluconato de Cálcio 10%', presentation: '10mL - Ampola', defaultDose: '10mL', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Infundir lentamente em 10-20 min. Monitorar FC.', category: 'medication' },

  // Outros
  { id: 'm56', name: 'Tiamina (Vitamina B1)', presentation: '100mg/mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm57', name: 'Ácido Tranexâmico', presentation: '250mg/5mL - Ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 10 min.', category: 'medication' },
];

// ========== TODOS OS ITENS POR CATEGORIA ==========
export const ALL_ITEMS_BY_CATEGORY: Record<PrescriptionCategory, MedicationEntry[]> = {
  nutrition: DIET_OPTIONS,
  hydration: SOLUTION_OPTIONS,
  medication: MEDICATIONS_DATABASE,
  antimicrobial: ANTIMICROBIAL_OPTIONS,
  high_alert: HIGH_ALERT_OPTIONS,
  inhalation: INHALATION_OPTIONS,
  hemotherapy: HEMOTHERAPY_OPTIONS,
  care: CARE_OPTIONS,
  nonstandard: [],
};

// ========== RECOMENDAÇÕES (mantidas como estavam) ==========
export const RECOMMENDATION_TEMPLATES: string[] = [
  'Insulina regular SC conforme esquema: 150-200: 2 unidades | 201-250: 4 unidades | 251-300: 6 unidades | >300: Chamar',
  'Jejum para procedimento',
  'Centralização cefálica e colar cervical',
  'Neurocheck 4/4h',
  'Comunicar médico plantonista se instabilidade hemodinâmica',
];
