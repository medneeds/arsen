// Database de medicamentos comuns para autocomplete na prescrição
// Baseado em medicamentos mais utilizados em emergência e UTI

export interface MedicationEntry {
  id: string;
  name: string;
  presentation: string;
  defaultDose: string;
  defaultRoute: string;
  defaultPosology: string;
  defaultSchedule: string;
  instructions?: string;
  category: 'medicamento' | 'solucao' | 'dieta';
}

export const ROUTES: string[] = [
  'Oral',
  'Intravenosa',
  'Intramuscular',
  'Subcutânea',
  'Retal',
  'Sublingual',
  'Tópica',
  'Inalatória',
  'Nasal',
  'Oftálmica',
  'Otológica',
  'Transdérmica',
  'Enteral (SNE/SNG)',
  'Gastrostomia',
];

export const POSOLOGIES: string[] = [
  '1x/dia',
  '2x/dia',
  '3x/dia',
  '4x/dia',
  '6/6h',
  '8/8h',
  '12/12h',
  '24/24h',
  '4/4h',
  '2/2h',
  'ACM',
  'SOS',
  'Dose única',
  'Contínuo',
];

export const COMMON_SCHEDULES: string[] = [
  '06h',
  '08h',
  '10h',
  '12h',
  '14h',
  '16h',
  '18h',
  '20h',
  '22h',
  '00h',
  '02h',
  '04h',
  'ACM',
];

export const DIET_OPTIONS: MedicationEntry[] = [
  { id: 'd1', name: 'Dieta zero', presentation: '-', defaultDose: '-', defaultRoute: '-', defaultPosology: '-', defaultSchedule: '-', category: 'dieta' },
  { id: 'd2', name: 'Dieta via oral livre', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'dieta' },
  { id: 'd3', name: 'Dieta via oral para DM', presentation: '-', defaultDose: 'TN', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'dieta' },
  { id: 'd4', name: 'Dieta via oral para DM2', presentation: '-', defaultDose: 'TN', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'dieta' },
  { id: 'd5', name: 'Dieta via oral hipossódica', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'dieta' },
  { id: 'd6', name: 'Dieta via oral pastosa', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'dieta' },
  { id: 'd7', name: 'Dieta via oral branda', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'dieta' },
  { id: 'd8', name: 'Dieta via oral líquida', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'dieta' },
  { id: 'd9', name: 'Dieta enteral via SNE', presentation: '-', defaultDose: '-', defaultRoute: 'Enteral (SNE/SNG)', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'dieta' },
  { id: 'd10', name: 'Água oral livre', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'dieta' },
  { id: 'd11', name: 'Dieta hipercalórica e hiperproteica', presentation: '-', defaultDose: '-', defaultRoute: 'Oral', defaultPosology: '-', defaultSchedule: '-', category: 'dieta' },
];

export const SOLUTION_OPTIONS: MedicationEntry[] = [
  { id: 's1', name: 'Soro Fisiológico 0,9%', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'solucao' },
  { id: 's2', name: 'Soro Fisiológico 0,9%', presentation: '250mL', defaultDose: '250mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'solucao' },
  { id: 's3', name: 'Soro Fisiológico 0,9%', presentation: '100mL', defaultDose: '100mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'solucao' },
  { id: 's4', name: 'Soro Glicosado 5%', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'solucao' },
  { id: 's5', name: 'Soro Glicosado 5%', presentation: '250mL', defaultDose: '250mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'solucao' },
  { id: 's6', name: 'Ringer Lactato', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'solucao' },
  { id: 's7', name: 'Soro Glicofisiológico', presentation: '500mL', defaultDose: '500mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', category: 'solucao' },
];

export const MEDICATIONS_DATABASE: MedicationEntry[] = [
  // Analgésicos e Antipiréticos
  { id: 'm1', name: 'Dipirona', presentation: '500mg/mL - Ampola 2mL', defaultDose: '1g (2mL)', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 18mL de SF0,9%. Infundir lentamente.', category: 'medicamento' },
  { id: 'm2', name: 'Dipirona', presentation: '500mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medicamento' },
  { id: 'm3', name: 'Paracetamol', presentation: '500mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medicamento' },
  { id: 'm4', name: 'Paracetamol', presentation: '750mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '6/6h', defaultSchedule: '06h', category: 'medicamento' },
  { id: 'm5', name: 'Tramadol', presentation: '50mg/mL - Ampola 2mL', defaultDose: '100mg (2mL)', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'medicamento' },
  { id: 'm6', name: 'Morfina', presentation: '10mg/mL - Ampola 1mL', defaultDose: '1-5mg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Diluir 1mL em 9mL de SF0,9% (1mg/mL). Aplicar lentamente.', category: 'medicamento' },

  // Antibióticos
  { id: 'm7', name: 'Ceftriaxona', presentation: '1g - Frasco-ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'medicamento' },
  { id: 'm8', name: 'Ceftriaxona', presentation: '2g - Frasco-ampola', defaultDose: '2g', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'medicamento' },
  { id: 'm9', name: 'Amoxicilina + Clavulanato', presentation: '1g - Frasco-ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm10', name: 'Piperacilina + Tazobactam', presentation: '4,5g - Frasco-ampola', defaultDose: '4,5g', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'medicamento' },
  { id: 'm11', name: 'Meropenem', presentation: '1g - Frasco-ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min a 3h.', category: 'medicamento' },
  { id: 'm12', name: 'Vancomicina', presentation: '500mg - Frasco-ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Diluir em 250mL de SF0,9%. Infundir em 60 min. NUNCA em bolus.', category: 'medicamento' },
  { id: 'm13', name: 'Metronidazol', presentation: '500mg/100mL - Bolsa', defaultDose: '500mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Infundir em 30-60 min.', category: 'medicamento' },
  { id: 'm14', name: 'Ciprofloxacino', presentation: '200mg/100mL - Bolsa', defaultDose: '400mg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Infundir em 60 min.', category: 'medicamento' },
  { id: 'm15', name: 'Azitromicina', presentation: '500mg - Frasco-ampola', defaultDose: '500mg', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', category: 'medicamento' },

  // Cardiovascular
  { id: 'm16', name: 'Noradrenalina', presentation: '1mg/mL - Ampola 4mL', defaultDose: '8mL', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Diluir 8mL em 92mL SG5%. Uso em bomba de infusão. Vesicante.', category: 'medicamento' },
  { id: 'm17', name: 'Dobutamina', presentation: '250mg - Ampola 20mL', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Diluir em 230mL de SG5%. Uso em bomba de infusão.', category: 'medicamento' },
  { id: 'm18', name: 'Enoxaparina (Clexane)', presentation: '40mg/0,4mL - Seringa', defaultDose: '40mg', defaultRoute: 'Subcutânea', defaultPosology: '24/24h', defaultSchedule: '22h', instructions: 'Administrar 1 seringa.', category: 'medicamento' },
  { id: 'm19', name: 'Enoxaparina (Clexane)', presentation: '60mg/0,6mL - Seringa', defaultDose: '60mg', defaultRoute: 'Subcutânea', defaultPosology: '12/12h', defaultSchedule: '08h', instructions: 'Administrar 1 seringa.', category: 'medicamento' },
  { id: 'm20', name: 'AAS', presentation: '100mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '13h', category: 'medicamento' },
  { id: 'm21', name: 'Clopidogrel', presentation: '75mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', instructions: 'Administrar 1 comprimido. Via oral.', category: 'medicamento' },
  { id: 'm22', name: 'Sinvastatina', presentation: '40mg comprimido', defaultDose: '2 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '22h', category: 'medicamento' },
  { id: 'm23', name: 'Enalapril', presentation: '10mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm24', name: 'Losartana', presentation: '50mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm25', name: 'Anlodipino', presentation: '5mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm26', name: 'Amiodarona', presentation: '150mg/3mL - Ampola', defaultDose: '300mg', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SG5%.', category: 'medicamento' },
  { id: 'm27', name: 'Furosemida', presentation: '20mg/2mL - Ampola', defaultDose: '20mg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm28', name: 'Furosemida', presentation: '40mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medicamento' },

  // Gastrointestinal
  { id: 'm29', name: 'Omeprazol', presentation: '40mg - Frasco-ampola', defaultDose: '1 frasco', defaultRoute: 'Intravenosa', defaultPosology: '1x/dia', defaultSchedule: '06h', instructions: 'Diluir 01 frasco em diluente próprio. Via Intravenosa.', category: 'medicamento' },
  { id: 'm30', name: 'Omeprazol', presentation: '40mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '24/24h', defaultSchedule: '06h', instructions: 'NA AUSÊNCIA DO ITEM EV.', category: 'medicamento' },
  { id: 'm31', name: 'Pantoprazol', presentation: '40mg - Frasco-ampola', defaultDose: '1 frasco', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '06h', category: 'medicamento' },
  { id: 'm32', name: 'Metoclopramida (Plasil)', presentation: '10mg/2mL - Ampola', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm33', name: 'Ondansetrona', presentation: '4mg/2mL - Ampola', defaultDose: '4mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm34', name: 'Bromoprida', presentation: '10mg/2mL - Ampola', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm35', name: 'Lactulose', presentation: '667mg/mL - Frasco', defaultDose: '15-30mL', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medicamento' },

  // Sedação e Analgesia
  { id: 'm36', name: 'Midazolam', presentation: '5mg/mL - Ampola 3mL', defaultDose: '15mg', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Uso em bomba de infusão conforme protocolo de sedação.', category: 'medicamento' },
  { id: 'm37', name: 'Fentanil', presentation: '50mcg/mL - Ampola 10mL', defaultDose: '500mcg', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Uso em bomba de infusão conforme protocolo de sedação.', category: 'medicamento' },
  { id: 'm38', name: 'Propofol', presentation: '10mg/mL - Frasco 20mL', defaultDose: '200mg', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Uso em bomba de infusão. Não misturar com outras drogas.', category: 'medicamento' },
  { id: 'm39', name: 'Cetamina (Ketamina)', presentation: '50mg/mL - Frasco 10mL', defaultDose: '1-2mg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', category: 'medicamento' },

  // Anti-hipertensivos / Vasodilatadores
  { id: 'm40', name: 'Nitroprussiato de Sódio', presentation: '50mg - Ampola', defaultDose: '50mg', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Diluir em 250mL de SG5%. Fotossensível. Bomba de infusão.', category: 'medicamento' },
  { id: 'm41', name: 'Nitroglicerina', presentation: '50mg/10mL - Ampola', defaultDose: '50mg', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Diluir em 240mL de SG5%. Bomba de infusão.', category: 'medicamento' },

  // Corticosteróides
  { id: 'm42', name: 'Hidrocortisona', presentation: '100mg - Frasco-ampola', defaultDose: '100mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm43', name: 'Dexametasona', presentation: '4mg/mL - Ampola 2,5mL', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm44', name: 'Prednisona', presentation: '20mg comprimido', defaultDose: '1 comp', defaultRoute: 'Oral', defaultPosology: '1x/dia', defaultSchedule: '08h', category: 'medicamento' },

  // Insulinas
  { id: 'm45', name: 'Insulina Regular', presentation: '100UI/mL - Frasco', defaultDose: 'Conforme esquema', defaultRoute: 'Subcutânea', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Conforme protocolo de controle glicêmico.', category: 'medicamento' },
  { id: 'm46', name: 'Insulina NPH', presentation: '100UI/mL - Frasco', defaultDose: 'Conforme esquema', defaultRoute: 'Subcutânea', defaultPosology: '12/12h', defaultSchedule: '08h', category: 'medicamento' },

  // Anticonvulsivantes
  { id: 'm47', name: 'Fenitoína', presentation: '250mg/5mL - Ampola', defaultDose: '250mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 250mL de SF0,9%. Infundir lentamente (máx 50mg/min).', category: 'medicamento' },
  { id: 'm48', name: 'Diazepam', presentation: '10mg/2mL - Ampola', defaultDose: '10mg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Aplicar lentamente. Não diluir.', category: 'medicamento' },

  // Eletrólitos
  { id: 'm49', name: 'KCl 19,1%', presentation: '10mL - Ampola', defaultDose: '10mL', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'NUNCA em bolus. Diluir em 500mL de SF0,9%. Infundir em 4-6h.', category: 'medicamento' },
  { id: 'm50', name: 'Sulfato de Magnésio 50%', presentation: '10mL - Ampola', defaultDose: '2g', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 30 min.', category: 'medicamento' },
  { id: 'm51', name: 'Gluconato de Cálcio 10%', presentation: '10mL - Ampola', defaultDose: '10mL', defaultRoute: 'Intravenosa', defaultPosology: 'ACM', defaultSchedule: 'ACM', instructions: 'Infundir lentamente em 10-20 min. Monitorar FC.', category: 'medicamento' },

  // Broncodilatadores
  { id: 'm52', name: 'Salbutamol (Aerolin)', presentation: '5mg/mL - Frasco', defaultDose: '10 gotas', defaultRoute: 'Inalatória', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 3mL de SF0,9%. Nebulização.', category: 'medicamento' },
  { id: 'm53', name: 'Ipratrópio (Atrovent)', presentation: '0,25mg/mL - Frasco', defaultDose: '20 gotas', defaultRoute: 'Inalatória', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Nebulização associada ao salbutamol.', category: 'medicamento' },

  // Outros
  { id: 'm54', name: 'Heparina Sódica', presentation: '5.000UI/0,25mL - Ampola', defaultDose: '5.000UI', defaultRoute: 'Subcutânea', defaultPosology: '8/8h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm55', name: 'Glicose 50%', presentation: '20mL - Ampola', defaultDose: '40mL', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Se glicemia menor que 70mg/dL.', category: 'medicamento' },
  { id: 'm56', name: 'Tiamina (Vitamina B1)', presentation: '100mg/mL - Ampola', defaultDose: '1 amp', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', defaultSchedule: '08h', category: 'medicamento' },
  { id: 'm57', name: 'Ácido Tranexâmico', presentation: '250mg/5mL - Ampola', defaultDose: '1g', defaultRoute: 'Intravenosa', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 10 min.', category: 'medicamento' },
  { id: 'm58', name: 'Terlipressina', presentation: '1mg - Frasco-ampola', defaultDose: '1mg', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: '06h', instructions: 'Diluir em 10mL de SF0,9%. Infundir em bolus lento.', category: 'medicamento' },
];

export const RECOMMENDATION_TEMPLATES: string[] = [
  'Cabeceira do leito 30-45° | Manter centralização cefálica e colar cervical',
  'Oximetria de pulso contínua',
  'Fisioterapia motora e respiratória 3x ao dia',
  'Acompanhamento com fonoaudiologia',
  'Acompanhamento com psicologia',
  'Acompanhamento com odontologia',
  'Monitorização cardíaca contínua',
  'Controle glicêmico 6/6h',
  'Insulina regular SC conforme esquema: 150-200: 2 unidades | 201-250: 4 unidades | 251-300: 6 unidades | >300: Chamar',
  'Glicose 50% - 40mL - EV - Se glicemia menor que 70mg/dL',
  'Aferição de sinais vitais e neurocheck 2/2h',
  'Compressor pneumático intermitente em MMII',
  'Ventilação Mecânica',
  'Neurocheck 4/4h',
  'Balanço hídrico 6/6h',
  'Cuidados com acessos venosos centrais',
  'Cuidados com sonda vesical de demora',
  'Cuidados com sonda nasoenteral',
  'Mudança de decúbito 2/2h',
  'Aspiração traqueal SOS',
  'Manter PAM > 65mmHg',
  'Restrição hídrica: ____mL/dia',
  'Jejum para procedimento',
  'Comunicar médico plantonista se instabilidade hemodinâmica',
  'Profilaxia de TVP conforme protocolo',
];
