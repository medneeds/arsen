// Database de medicamentos para prescrição médica
// Categorias inspiradas no modelo Medora, adaptadas para o Socorrão I

export type PrescriptionCategory =
  | 'nutrition'       // Dietas e suplementos nutricionais
  | 'hydration'       // Soluções de hidratação
  | 'replacement'     // Reposição / correção eletrolítica
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
  hydration:     { label: 'Hidratação / Reposição', icon: 'Droplets', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  medication:    { label: 'Medicamentos',      icon: 'Pill',           color: 'text-primary',      bgColor: 'bg-primary/10' },
  antimicrobial: { label: 'Antimicrobianos',   icon: 'Shield',         color: 'text-orange-500',   bgColor: 'bg-orange-500/10' },
  high_alert:    { label: 'Alta Vigilância',   icon: 'AlertTriangle',  color: 'text-red-500',      bgColor: 'bg-red-500/10' },
  inhalation:    { label: 'Inalação',          icon: 'Wind',           color: 'text-cyan-500',     bgColor: 'bg-cyan-500/10' },
  hemotherapy:   { label: 'Hemoterapia',       icon: 'TestTube',       color: 'text-rose-500',     bgColor: 'bg-rose-500/10' },
  care:          { label: 'Cuidados',          icon: 'ClipboardList',  color: 'text-amber-500',    bgColor: 'bg-amber-500/10' },
  nonstandard:   { label: 'Não Padrão',        icon: 'FileText',       color: 'text-gray-500',     bgColor: 'bg-gray-500/10' },
};

export const PRESCRIPTION_FLAGS = [
  { key: 'bi',  label: 'BI',  fullLabel: 'Bomba de Infusão',    color: 'bg-blue-500/20 text-blue-700 border-blue-300' },
  { key: 'sn',  label: 'SN',  fullLabel: 'Se Necessário',       color: 'bg-yellow-500/20 text-yellow-700 border-yellow-300' },
  { key: 'acm', label: 'ACM', fullLabel: 'A Critério Médico',   color: 'bg-purple-500/20 text-purple-700 border-purple-300' },
  { key: 'cp',  label: 'CP',  fullLabel: 'Carro de Parada',      color: 'bg-teal-500/20 text-teal-700 border-teal-300' },
  { key: 'bu',  label: 'AG',  fullLabel: 'Agora',      color: 'bg-red-500/20 text-red-700 border-red-300' },
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

// ========== HIDRATAÇÃO / REPOSIÇÃO ==========
export const SOLUTION_OPTIONS: MedicationEntry[] = [
  // Soluções de hidratação
  { id: 's1', name: 'Soro Fisiológico 0,9%', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's2', name: 'Soro Fisiológico 0,9%', presentation: '250mL', defaultDose: '250mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's3', name: 'Soro Fisiológico 0,9%', presentation: '100mL', defaultDose: '100mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's4', name: 'Soro Glicosado 5%', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's5', name: 'Soro Glicosado 5%', presentation: '250mL', defaultDose: '250mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's6', name: 'Ringer Lactato', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  { id: 's7', name: 'Soro Glicofisiológico', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'hydration' },
  // Reposições eletrolíticas
  { id: 'rep1', name: 'Cloreto de Potássio (KCl) 19,1%', presentation: '10mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 1-2h. NUNCA em bolus.', category: 'hydration' },
  { id: 'rep2', name: 'Cloreto de Potássio (KCl) 10%', presentation: '10mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 1-2h. NUNCA em bolus.', category: 'hydration' },
  { id: 'rep3', name: 'Sulfato de Magnésio 50%', presentation: '10mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 1h.', category: 'hydration' },
  { id: 'rep4', name: 'Sulfato de Magnésio 10%', presentation: '10mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 1h.', category: 'hydration' },
  { id: 'rep5', name: 'Gluconato de Cálcio 10%', presentation: '10mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SG5%. Infundir em 30-60 min. Incompatível com bicarbonato.', category: 'hydration' },
  { id: 'rep6', name: 'Cloreto de Cálcio 10%', presentation: '10mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: 'ACM', instructions: 'Acesso central preferencial. Infundir lentamente. Vesicante.', category: 'hydration' },
  { id: 'rep7', name: 'Fosfato de Potássio 2mEq/mL', presentation: '10mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: 'ACM', instructions: 'Diluir em 250mL de SF0,9%. Infundir em 4-6h.', category: 'hydration' },
  { id: 'rep8', name: 'Cloreto de Sódio 20%', presentation: '10mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: 'ACM', instructions: 'Diluir em solução de hidratação. Acesso central para concentrações >3%.', category: 'hydration' },
  { id: 'rep9', name: 'Bicarbonato de Sódio 8,4%', presentation: '250mL - Frasco', defaultDose: '250mL', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Infundir conforme gasometria. Incompatível com cálcio.', category: 'hydration' },
  { id: 'rep10', name: 'Bicarbonato de Sódio 8,4%', presentation: '10mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Diluir em SF0,9% ou SG5%. Incompatível com cálcio.', category: 'hydration' },
  { id: 'rep11', name: 'Glicose 50%', presentation: '10mL - Ampola', defaultDose: '4 amp', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Aplicação lenta (3-5 min). Para hipoglicemia.', category: 'hydration' },
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
// CUIDADOS = SUPORTE ASSISTENCIAL (sinais vitais, decúbito, fisio, fono, curativos,
// prevenção de LPP, comunicação). NÃO inclui medicação, ATB, exames laboratoriais
// ou de imagem — esses pertencem às suas próprias categorias.
// Lista enxuta (10 itens) para uso rápido. Perfis especializados abaixo.
export const CARE_OPTIONS: MedicationEntry[] = [
  { id: 'c1',  name: 'Sinais vitais',                          presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '4/4h',     defaultSchedule: '-', category: 'care' },
  { id: 'c2',  name: 'Cabeceira elevada 30-45°',                presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'Contínuo', defaultSchedule: '-', category: 'care' },
  { id: 'c3',  name: 'Mudança de decúbito',                     presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '2/2h',     defaultSchedule: '-', category: 'care' },
  { id: 'c4',  name: 'Fisioterapia motora e respiratória',      presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '3x/dia',   defaultSchedule: '-', category: 'care' },
  { id: 'c5',  name: 'Avaliação fonoaudiológica',               presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '1x/dia',   defaultSchedule: '-', category: 'care' },
  { id: 'c6',  name: 'Curativo de prevenção de LPP',            presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '1x/dia',   defaultSchedule: '-', category: 'care' },
  { id: 'c7',  name: 'Higiene oral com clorexidina 0,12%',      presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '3x/dia',   defaultSchedule: '-', category: 'care' },
  { id: 'c8',  name: 'Aspiração de vias aéreas',                presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: 'SOS',      defaultSchedule: '-', category: 'care' },
  { id: 'c9',  name: 'Balanço hídrico',                         presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '6/6h',     defaultSchedule: '-', category: 'care' },
  { id: 'c10', name: 'Comunicar plantonista se instabilidade',  presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '-',         defaultSchedule: '-', category: 'care' },
];

// ========== MEDICAMENTOS GERAIS ==========
export const MEDICATIONS_DATABASE: MedicationEntry[] = [
  // ===== Analgésicos e Antipiréticos =====
  { id: 'm1', name: 'Dipirona', presentation: '500mg/mL - Ampola 2mL', defaultDose: '1g (2mL)', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 18mL de SF0,9%. Infundir lentamente.', category: 'medication', aliases: ['Metamizol', 'Novalgina'] },
  { id: 'm2', name: 'Dipirona', presentation: '500mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medication', aliases: ['Metamizol', 'Novalgina'] },
  { id: 'm3', name: 'Paracetamol', presentation: '500mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medication', aliases: ['Tylenol', 'Acetaminofeno'] },
  { id: 'm4', name: 'Paracetamol', presentation: '750mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medication', aliases: ['Tylenol', 'Acetaminofeno'] },
  { id: 'm5', name: 'Tramadol', presentation: '50mg/mL - Ampola 2mL', defaultDose: '100mg (2mL)', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'medication', aliases: ['Tramal'] },
  { id: 'm6', name: 'Tramadol', presentation: '50mg cápsula', defaultDose: '1 cáps', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm7', name: 'Codeína', presentation: '30mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medication' },
  { id: 'm8', name: 'Cetoprofeno', presentation: '100mg - Frasco-ampola', defaultDose: '100mg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 20 min.', category: 'medication', aliases: ['Profenid'] },
  { id: 'm9', name: 'Ibuprofeno', presentation: '600mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Alivium', 'Advil'] },
  { id: 'm10', name: 'Tenoxicam', presentation: '20mg/2mL - Ampola', defaultDose: '20mg', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', category: 'medication', aliases: ['Tilatil'] },
  { id: 'm11', name: 'Cetorolaco', presentation: '30mg/mL - Ampola', defaultDose: '30mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Toragesic'] },
  { id: 'm12', name: 'Nimesulida', presentation: '100mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication' },

  // ===== Cardiovascular =====
  { id: 'm20', name: 'AAS', presentation: '100mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '13h', category: 'medication', aliases: ['Aspirina', 'Ácido Acetilsalicílico'] },
  { id: 'm20b', name: 'AAS', presentation: '300mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '13h', category: 'medication', aliases: ['Aspirina'] },
  { id: 'm21', name: 'Clopidogrel', presentation: '75mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['Plavix'] },
  { id: 'm22', name: 'Sinvastatina', presentation: '40mg comprimido', defaultDose: '2 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '22h', category: 'medication', aliases: ['Zocor'] },
  { id: 'm22b', name: 'Atorvastatina', presentation: '40mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '22h', category: 'medication', aliases: ['Lipitor', 'Citalor'] },
  { id: 'm22c', name: 'Rosuvastatina', presentation: '20mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '22h', category: 'medication', aliases: ['Crestor'] },
  { id: 'm23', name: 'Enalapril', presentation: '10mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Renitec'] },
  { id: 'm23b', name: 'Captopril', presentation: '25mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm24', name: 'Losartana', presentation: '50mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Cozaar', 'Losartan'] },
  { id: 'm24b', name: 'Valsartana', presentation: '160mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['Diovan'] },
  { id: 'm25', name: 'Anlodipino', presentation: '5mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['Norvasc', 'Amlodipino'] },
  { id: 'm25b', name: 'Anlodipino', presentation: '10mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication' },
  { id: 'm25c', name: 'Hidralazina', presentation: '20mg/mL - Ampola', defaultDose: '20mg', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 10mL SF0,9%. Aplicar lentamente.', category: 'medication', aliases: ['Apresolina'] },
  { id: 'm25d', name: 'Metoprolol', presentation: '5mg/5mL - Ampola', defaultDose: '5mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Seloken'] },
  { id: 'm25e', name: 'Metoprolol', presentation: '50mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm25f', name: 'Carvedilol', presentation: '6,25mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Coreg'] },
  { id: 'm25g', name: 'Atenolol', presentation: '25mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication' },
  { id: 'm25h', name: 'Propranolol', presentation: '40mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm25i', name: 'Digoxina', presentation: '0,25mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication' },
  { id: 'm25j', name: 'Espironolactona', presentation: '25mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['Aldactone'] },
  { id: 'm25k', name: 'Hidroclorotiazida', presentation: '25mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['HCTZ'] },
  { id: 'm25l', name: 'Isossorbida (Mononitrato)', presentation: '40mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Monocordil'] },
  { id: 'm25m', name: 'Isossorbida (Dinitrato) Sublingual', presentation: '5mg comprimido', defaultDose: '1 comp', defaultRoute: 'Sublingual', defaultPosology: 'SOS', defaultSchedule: 'ACM', category: 'medication', aliases: ['Isordil'] },

  // ===== Anticoagulantes =====
  { id: 'm26', name: 'Enoxaparina (Clexane)', presentation: '40mg/0,4mL - Seringa', defaultDose: '40mg', defaultRoute: 'Subcutânea', defaultPosology: '24/24h', defaultSchedule: '22h', instructions: 'Profilaxia TEV.', category: 'medication', aliases: ['Clexane', 'Enoxa'] },
  { id: 'm27', name: 'Enoxaparina (Clexane)', presentation: '60mg/0,6mL - Seringa', defaultDose: '60mg', defaultRoute: 'Subcutânea', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Clexane'] },
  { id: 'm27b', name: 'Enoxaparina (Clexane)', presentation: '80mg/0,8mL - Seringa', defaultDose: '80mg', defaultRoute: 'Subcutânea', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Clexane'] },
  { id: 'm27c', name: 'Varfarina', presentation: '5mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '18h', instructions: 'Monitorar INR.', category: 'medication', aliases: ['Marevan', 'Warfarin'] },
  { id: 'm27d', name: 'Rivaroxabana', presentation: '20mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['Xarelto'] },
  { id: 'm27e', name: 'Apixabana', presentation: '5mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Eliquis'] },

  // ===== Diuréticos =====
  { id: 'm28', name: 'Furosemida', presentation: '20mg/2mL - Ampola', defaultDose: '20mg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Lasix'] },
  { id: 'm29', name: 'Furosemida', presentation: '40mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['Lasix'] },
  { id: 'm29b', name: 'Manitol 20%', presentation: '250mL - Frasco', defaultDose: '125mL', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Infundir em 30 min. Filtro de linha recomendado.', category: 'medication' },

  // ===== Gastrointestinal =====
  { id: 'm30', name: 'Omeprazol', presentation: '40mg - Frasco-ampola', defaultDose: '1 frasco', defaultRoute: 'Intravenosa', defaultPosology: '1x/dia', defaultSchedule: '06h', instructions: 'Diluir 01 frasco em diluente próprio. Via Intravenosa.', category: 'medication', aliases: ['Losec'] },
  { id: 'm31', name: 'Omeprazol', presentation: '40mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '24/24h', defaultSchedule: '06h', category: 'medication', aliases: ['Losec'] },
  { id: 'm31b', name: 'Omeprazol', presentation: '20mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '24/24h', defaultSchedule: '06h', category: 'medication' },
  { id: 'm32', name: 'Pantoprazol', presentation: '40mg - Frasco-ampola', defaultDose: '1 frasco', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '06h', category: 'medication', aliases: ['Pantozol'] },
  { id: 'm32b', name: 'Esomeprazol', presentation: '40mg - Frasco-ampola', defaultDose: '1 frasco', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '06h', category: 'medication', aliases: ['Nexium'] },
  { id: 'm32c', name: 'Ranitidina', presentation: '50mg/2mL - Ampola', defaultDose: '50mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm33', name: 'Metoclopramida (Plasil)', presentation: '10mg/2mL - Ampola', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Plasil'] },
  { id: 'm34', name: 'Ondansetrona', presentation: '4mg/2mL - Ampola', defaultDose: '4mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Zofran', 'Vonau'] },
  { id: 'm34b', name: 'Ondansetrona', presentation: '8mg/4mL - Ampola', defaultDose: '8mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Zofran'] },
  { id: 'm35', name: 'Bromoprida', presentation: '10mg/2mL - Ampola', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Digesan'] },
  { id: 'm36', name: 'Lactulose', presentation: '667mg/mL - Frasco', defaultDose: '15-30mL', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Lactopurga'] },
  { id: 'm36b', name: 'Bisacodil', presentation: '5mg comprimido', defaultDose: '2 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '20h', category: 'medication', aliases: ['Dulcolax'] },
  { id: 'm36c', name: 'Hioscina (Buscopan) Composto', presentation: '20mg/2,5g - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 100mL SF0,9%. Infundir em 30 min.', category: 'medication', aliases: ['Buscopan Composto', 'Buscofem'] },
  { id: 'm36d', name: 'Hioscina (Buscopan) Simples', presentation: '20mg/mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Buscopan'] },
  { id: 'm36e', name: 'Loperamida', presentation: '2mg comprimido', defaultDose: '2 comp', defaultRoute: 'Oral', defaultPosology: 'SOS', defaultSchedule: 'ACM', category: 'medication', aliases: ['Imosec'] },
  { id: 'm36f', name: 'Simeticona', presentation: '40mg/mL - Frasco', defaultDose: '40 gotas', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Luftal'] },
  { id: 'm36g', name: 'Sulfato Ferroso', presentation: '40mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication' },

  // ===== Corticosteróides =====
  { id: 'm42', name: 'Hidrocortisona', presentation: '100mg - Frasco-ampola', defaultDose: '100mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Solu-Cortef'] },
  { id: 'm42b', name: 'Hidrocortisona', presentation: '500mg - Frasco-ampola', defaultDose: '500mg', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medication' },
  { id: 'm43', name: 'Dexametasona', presentation: '4mg/mL - Ampola 2,5mL', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', category: 'medication', aliases: ['Decadron'] },
  { id: 'm43b', name: 'Metilprednisolona', presentation: '500mg - Frasco-ampola', defaultDose: '500mg', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', instructions: 'Pulsoterapia.', category: 'medication', aliases: ['Solu-Medrol'] },
  { id: 'm44', name: 'Prednisona', presentation: '20mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['Meticorten'] },
  { id: 'm44b', name: 'Prednisona', presentation: '5mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication' },

  // ===== Anticonvulsivantes / Neurológicos =====
  { id: 'm47', name: 'Fenitoína', presentation: '250mg/5mL - Ampola', defaultDose: '250mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 250mL de SF0,9%. Infundir lentamente (máx 50mg/min).', category: 'medication', aliases: ['Hidantal'] },
  { id: 'm48', name: 'Diazepam', presentation: '10mg/2mL - Ampola', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Aplicar lentamente. Não diluir.', category: 'medication', aliases: ['Valium'] },
  { id: 'm48b', name: 'Clonazepam', presentation: '2mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Rivotril'] },
  { id: 'm48c', name: 'Lorazepam', presentation: '2mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: 'SOS', defaultSchedule: 'ACM', category: 'medication', aliases: ['Lorax'] },
  { id: 'm48d', name: 'Ácido Valproico', presentation: '500mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Depakene', 'Valpakine'] },
  { id: 'm48e', name: 'Carbamazepina', presentation: '200mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Tegretol'] },
  { id: 'm48f', name: 'Levetiracetam', presentation: '500mg/5mL - Frasco-ampola', defaultDose: '500mg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Diluir em 100mL SF0,9%. Infundir em 15 min.', category: 'medication', aliases: ['Keppra'] },
  { id: 'm48g', name: 'Haloperidol', presentation: '5mg/mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intramuscular', defaultPosology: 'SOS', defaultSchedule: 'ACM', category: 'medication', aliases: ['Haldol'] },
  { id: 'm48h', name: 'Quetiapina', presentation: '25mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Seroquel'] },
  { id: 'm48i', name: 'Risperidona', presentation: '2mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Risperdal'] },
  { id: 'm48j', name: 'Sertralina', presentation: '50mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['Zoloft'] },
  { id: 'm48k', name: 'Amitriptilina', presentation: '25mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '22h', category: 'medication', aliases: ['Tryptanol'] },

  // ===== Eletrólitos / Reposições adicionais =====
  { id: 'm50', name: 'Sulfato de Magnésio 50%', presentation: '10mL - Ampola', defaultDose: '2g', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'medication' },
  { id: 'm51', name: 'Gluconato de Cálcio 10%', presentation: '10mL - Ampola', defaultDose: '10mL', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Infundir lentamente em 10-20 min. Monitorar FC.', category: 'medication' },

  // ===== Antialérgicos =====
  { id: 'm52', name: 'Prometazina', presentation: '50mg/2mL - Ampola', defaultDose: '25-50mg', defaultRoute: 'Intramuscular', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Fenergan'] },
  { id: 'm53', name: 'Difenidramina', presentation: '50mg/mL - Ampola', defaultDose: '50mg', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medication', aliases: ['Difenidrin'] },
  { id: 'm54', name: 'Loratadina', presentation: '10mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['Claritin'] },
  { id: 'm55', name: 'Dexclorfeniramina', presentation: '2mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Polaramine'] },

  // ===== Endócrino =====
  { id: 'm60', name: 'Levotiroxina', presentation: '50mcg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '06h', instructions: 'Em jejum, 30 min antes do desjejum.', category: 'medication', aliases: ['Puran T4', 'Synthroid'] },
  { id: 'm61', name: 'Levotiroxina', presentation: '100mcg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '06h', category: 'medication', aliases: ['Puran T4'] },
  { id: 'm62', name: 'Metformina', presentation: '850mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication', aliases: ['Glifage', 'Glucoformin'] },
  { id: 'm63', name: 'Glibenclamida', presentation: '5mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Daonil'] },
  { id: 'm64', name: 'Glimepirida', presentation: '2mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medication', aliases: ['Amaryl'] },

  // ===== Antimicrobianos extras (orais) =====
  { id: 'm70', name: 'Amoxicilina', presentation: '500mg cápsula', defaultDose: '1 cáps', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm71', name: 'Amoxicilina + Clavulanato', presentation: '875+125mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Clavulin'] },
  { id: 'm72', name: 'Cefalexina', presentation: '500mg cápsula', defaultDose: '1 cáps', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medication', aliases: ['Keflex'] },
  { id: 'm73', name: 'Sulfametoxazol + Trimetoprima', presentation: '800+160mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medication', aliases: ['Bactrim'] },

  // ===== Outros =====
  { id: 'm56', name: 'Tiamina (Vitamina B1)', presentation: '100mg/mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', category: 'medication' },
  { id: 'm57', name: 'Ácido Tranexâmico', presentation: '250mg/5mL - Ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 10 min.', category: 'medication', aliases: ['Transamin'] },
  { id: 'm58', name: 'Vitamina K (Fitomenadiona)', presentation: '10mg/mL - Ampola', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', category: 'medication', aliases: ['Kanakion'] },
  { id: 'm59', name: 'Naloxona', presentation: '0,4mg/mL - Ampola', defaultDose: '0,4mg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Antagonista opioide.', category: 'medication', aliases: ['Narcan'] },
  { id: 'm65', name: 'Flumazenil', presentation: '0,5mg/5mL - Ampola', defaultDose: '0,2mg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Antagonista benzodiazepínico.', category: 'medication', aliases: ['Lanexat'] },
  { id: 'm66', name: 'Adenosina', presentation: '6mg/2mL - Ampola', defaultDose: '6mg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Bolus rápido + flush 20mL SF0,9%.', category: 'medication' },
  { id: 'm67', name: 'Atropina', presentation: '0,25mg/mL - Ampola', defaultDose: '0,5-1mg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', category: 'medication' },
  { id: 'm68', name: 'Adrenalina (Epinefrina)', presentation: '1mg/mL - Ampola', defaultDose: '1mg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'PCR conforme ACLS.', category: 'medication', aliases: ['Epinefrina'] },
  { id: 'm69', name: 'Gluconato de Cálcio para Hipercalemia', presentation: '10mL - Ampola', defaultDose: '20mL', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', category: 'medication' },
  { id: 'm75', name: 'Insulina Regular SOS Hipercalemia', presentation: '100UI/mL - Frasco', defaultDose: '10UI', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Com 50mL de Glicose 50%. Hipercalemia.', category: 'medication' },
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

// ========== PERFIS DE CUIDADOS ==========
export interface CareProfile {
  id: string;
  label: string;
  icon: string;
  description: string;
  items: string[]; // IDs dos CARE_OPTIONS a incluir
  extraItems: string[]; // Cuidados adicionais como texto livre
}

export const CARE_PROFILES: CareProfile[] = [
  {
    id: 'geral',
    label: 'Padrão Geral',
    icon: 'Shield',
    description: 'Cuidados gerais de enfermaria clínica',
    items: ['c1', 'c2', 'c3', 'c6', 'c9', 'c10'],
    extraItems: [
      'Higiene corporal diária no leito',
      'Higiene oral 3x/dia',
      'Manter grades do leito elevadas',
      'Hidratação da pele com creme barreira em proeminências ósseas',
      'Estimular ingesta hídrica conforme tolerância (se VO liberada)',
      'Acompanhante orientado quanto às rotinas do setor',
    ],
  },
  {
    id: 'neurocritico',
    label: 'Neurocrítico',
    icon: 'Zap',
    description: 'AVC, TCE, pós-operatório de neurocirurgia',
    items: ['c1', 'c2', 'c3', 'c4', 'c6', 'c7', 'c8', 'c9', 'c10'],
    extraItems: [
      'Cabeceira elevada 30° rigorosamente (manter alinhamento)',
      'Centralização cefálica e colar cervical conforme indicação',
      'Neurocheck (Glasgow, pupilas, déficit motor) 2/2h',
      'Comunicar imediatamente se queda de Glasgow ≥ 2 pontos ou anisocoria',
      'Comunicar se PAS < 100 mmHg ou crise hipertensiva',
      'Manter normotermia com medidas físicas (compressas, controle ambiente)',
      'Curativo de incisão cirúrgica conforme protocolo neurocirúrgico',
      'Mudança de decúbito com proteção cervical (em bloco)',
      'Estimulação cognitiva e orientação têmporo-espacial a cada turno',
      'Restringir estímulos luminosos e sonoros (ambiente calmo)',
      'Acompanhamento de fonoaudiologia para avaliação de deglutição antes da reintrodução de dieta VO',
    ],
  },
  {
    id: 'pos-op-medio-grande',
    label: 'Pós-Op Médio/Grande Porte',
    icon: 'Syringe',
    description: 'Pós-operatório de cirurgias de médio a grande porte',
    items: ['c1', 'c2', 'c3', 'c4', 'c6', 'c7', 'c8', 'c9', 'c10'],
    extraItems: [
      'Sinais vitais de hora em hora nas primeiras 6h, depois 2/2h até 24h',
      'Inspeção do sítio cirúrgico e curativo a cada 6h (sangramento, deiscência, hiperemia)',
      'Quantificar débito de drenos (volume, aspecto) a cada turno',
      'Avaliar dor pela escala EVA a cada 2h e antes de mobilização',
      'Mobilização precoce conforme liberação da equipe cirúrgica',
      'Estimular tosse assistida e exercícios respiratórios (incentivador inspiratório)',
      'Compressor pneumático intermitente em MMII enquanto restrito ao leito',
      'Cuidados com sonda vesical de demora (higiene perineal, fixação, sistema fechado)',
      'Reavaliar necessidade de SVD diariamente — retirar precoce',
      'Inspecionar acessos venosos a cada turno (sinais flogísticos)',
      'Comunicar se dor refratária, sangramento ativo, distensão abdominal ou náuseas/vômitos persistentes',
      'Posicionamento confortável evitando tração de drenos e cateteres',
    ],
  },
  {
    id: 'choque-septico',
    label: 'Sepse / Choque Séptico',
    icon: 'AlertTriangle',
    description: 'Suporte assistencial ao paciente séptico',
    items: ['c1', 'c2', 'c3', 'c4', 'c6', 'c7', 'c8', 'c9', 'c10'],
    extraItems: [
      'Sinais vitais com PA invasiva ou MAPI a cada 1h',
      'Diurese horária quantificada em coletor graduado (alvo ≥ 0,5 mL/kg/h)',
      'Avaliar perfusão periférica (TEC, temperatura de extremidades, marmoreio) a cada 2h',
      'Avaliar nível de consciência e padrão respiratório a cada 2h',
      'Curativo de inserção de acessos (CVC, PAi) com técnica estéril e troca conforme protocolo',
      'Higiene corporal com clorexidina degermante diária',
      'Mudança de decúbito com proteção de proeminências ósseas (alto risco de LPP)',
      'Comunicar imediatamente: PAM < 65, queda de diurese, alteração de consciência ou piora respiratória',
      'Aspiração de vias aéreas conforme necessidade (técnica estéril)',
      'Posicionamento prono assistido pela fisioterapia se indicado',
      'Avaliar diariamente necessidade de manutenção de cateteres invasivos',
    ],
  },
  {
    id: 'ventilacao-mecanica',
    label: 'Ventilação Mecânica',
    icon: 'Wind',
    description: 'Bundle de prevenção de PAV e cuidados em VM',
    items: ['c1', 'c2', 'c3', 'c4', 'c6', 'c7', 'c8', 'c10'],
    extraItems: [
      'Cabeceira 30-45° rigorosamente (bundle PAV)',
      'Higiene oral com clorexidina 0,12% 3x/dia',
      'Verificar pressão do cuff 20-30 cmH₂O a cada 12h',
      'Aspiração traqueal e orofaringe conforme necessidade (técnica estéril)',
      'Fixação adequada do TOT/TQT — anotar nível na rima labial',
      'Trocar circuitos do ventilador conforme rotina institucional',
      'Fisioterapia respiratória e motora 3x/dia (mínimo)',
      'Avaliar diariamente prontidão para despertar e teste de respiração espontânea',
      'Posicionamento adequado (evitar extensão cervical)',
      'Comunicar dessincronia com VM, queda de SpO₂ ou aumento de pressão de pico',
    ],
  },
  {
    id: 'cuidados-paliativos',
    label: 'Cuidados Paliativos',
    icon: 'ClipboardList',
    description: 'Conforto e qualidade de vida — paciente paliativo',
    items: ['c2', 'c3', 'c5', 'c6', 'c7'],
    extraItems: [
      'Priorizar conforto — evitar procedimentos invasivos fúteis',
      'Avaliar dor pela escala EVA ou ESAS a cada 4h',
      'Manter mucosa oral hidratada (gaze úmida, gel hidratante)',
      'Cuidados com pele e prevenção de LPP com colchão pneumático',
      'Permitir acompanhante em período integral',
      'Avaliação multiprofissional (psicologia, capelania, serviço social)',
      'Comunicar equipe de cuidados paliativos sobre intercorrências',
      'Respeitar diretivas antecipadas de vontade',
      'Evitar despertar para coleta ou procedimentos não essenciais',
      'Ambiente calmo, iluminação suave, presença familiar incentivada',
    ],
  },
];

