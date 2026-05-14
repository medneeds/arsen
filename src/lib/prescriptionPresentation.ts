/**
 * Adaptive validation by medication presentation type.
 *
 * Used by PrescricaoPage to:
 *  - Render only the relevant fields in the expanded item card
 *  - Compute the list of missing required fields per item
 *  - Offer evidence-based suggestion fills for the top ~50 most used drugs
 *
 * No backend changes — purely client-side inference from the catalog string.
 */

export type PresentationType =
  | 'oral_solid'        // comprimido, cápsula, drágea, sublingual
  | 'oral_liquid'       // solução oral, xarope, suspensão, gotas orais
  | 'iv_continuous'     // BIC / infusão contínua (vasoativos, sedação)
  | 'iv_intermittent'   // ATB EV diluído, push lento
  | 'iv_bolus'          // EV direto, bolus rápido
  | 'im_sc'             // intramuscular / subcutânea
  | 'inhalation'        // nebulização / inalação
  | 'topical'           // pomada, creme, oftálmico, otológico, nasal
  | 'rectal'            // supositório / enema
  | 'unknown';

export type RequiredField =
  | 'dose'
  | 'via'
  | 'posologia'
  | 'diluente'
  | 'volume total'
  | 'tempo de infusão';

const norm = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Drugs that ALWAYS run as continuous infusion (BIC) regardless of catalog text.
const CONTINUOUS_BIC_NAMES = [
  'noradrenalina', 'adrenalina', 'dobutamina', 'dopamina', 'vasopressina',
  'nitroprussiato', 'nitroglicerina', 'fentanil', 'midazolam', 'propofol',
  'dexmedetomidina', 'cisatracurio', 'rocuronio', 'remifentanil', 'milrinona',
  'amiodarona infusao', 'heparina infusao', 'insulina infusao',
];

// Drugs that are typically intermittent IV with diluent (ATB main offenders).
const INTERMITTENT_IV_NAMES = [
  'ceftriaxona', 'cefepime', 'cefazolina', 'cefuroxima',
  'piperacilina', 'tazobactam', 'meropenem', 'imipenem', 'ertapenem',
  'vancomicina', 'teicoplanina', 'linezolida', 'daptomicina',
  'ampicilina', 'sulbactam', 'oxacilina', 'penicilina',
  'metronidazol', 'azitromicina', 'claritromicina', 'clindamicina',
  'gentamicina', 'amicacina', 'tobramicina',
  'fluconazol', 'anfotericina', 'voriconazol', 'micafungina',
  'aciclovir', 'ganciclovir',
];

export function inferPresentationType(
  presentation?: string,
  route?: string,
  name?: string
): PresentationType {
  const p = norm(presentation);
  const r = norm(route);
  const n = norm(name);

  if (CONTINUOUS_BIC_NAMES.some(k => n.includes(k))) return 'iv_continuous';
  if (INTERMITTENT_IV_NAMES.some(k => n.includes(k))) return 'iv_intermittent';

  // Oral solids
  if (/(comprimido|capsula|cap\.|drágea|dragea|sublingual|orodispersivel|past\.|pastilha)/.test(p))
    return 'oral_solid';

  // Oral liquids
  if (/(solucao oral|sol\. oral|xarope|suspensao oral|gotas? orais?|elixir)/.test(p))
    return 'oral_liquid';

  // Inhalation
  if (/(inalacao|nebuliz|aerossol|spray oral)/.test(p) || /inal/.test(r))
    return 'inhalation';

  // Topical / ophthalmic / otologic / nasal / dermo
  if (/(pomada|creme|gel|oftalmica|otologica|colirio|nasal spray|dermat)/.test(p))
    return 'topical';

  // Rectal
  if (/(supositorio|enema|retal)/.test(p) || /retal/.test(r))
    return 'rectal';

  // IM / SC
  if (/intramuscular|subcutanea|sc\b|im\b/.test(r) || /seringa preench/.test(p))
    return 'im_sc';

  // IV (default to intermittent if ampola/frasco + EV)
  const isIV = /(intravenosa|endovenosa|ev\b)/.test(r);
  const isAmpFrasco = /(ampola|frasco|fr\.?\s*ampola|po liofiliz)/.test(p);
  if (isIV && isAmpFrasco) return 'iv_intermittent';
  if (isIV) return 'iv_bolus';

  return 'unknown';
}

export function getRequiredFields(type: PresentationType): RequiredField[] {
  switch (type) {
    case 'oral_solid':
    case 'oral_liquid':
    case 'im_sc':
    case 'topical':
    case 'rectal':
      return ['dose', 'via', 'posologia'];
    case 'iv_bolus':
      return ['dose', 'via', 'posologia'];
    case 'iv_intermittent':
      // tempo/volume validados condicionalmente em getItemMissingFields
      return ['dose', 'via', 'posologia', 'diluente'];
    case 'iv_continuous':
      return ['dose', 'via', 'posologia', 'diluente'];
    case 'inhalation':
      return ['dose', 'via', 'posologia'];
    case 'unknown':
    default:
      return ['dose', 'via', 'posologia'];
  }
}

// Whether the IV/infusion block (diluente, vol, tempo, vazão) should be rendered.
export function showInfusionBlock(type: PresentationType): boolean {
  return type === 'iv_continuous' || type === 'iv_intermittent' || type === 'iv_bolus' || type === 'inhalation';
}

// Whether the diluente/volume/access row should be rendered.
export function showDiluentRow(type: PresentationType): boolean {
  return type === 'iv_continuous' || type === 'iv_intermittent' || type === 'inhalation';
}

// =========================================================================
// Evidence-based suggestions (top 50 — UpToDate / AMIB / Sanford / KDIGO / bulários)
// =========================================================================
export interface EvidenceSuggestion {
  defaultDose?: string;
  defaultRoute?: string;
  defaultPosology?: string;
  diluent?: string;
  volumeTotal?: string;          // mL
  infusionTime?: string;
  infusionTimeUnit?: 'min' | 'h';
  source: string;                 // e.g. "UpToDate · Sanford 2024"
  notes?: string;
}

// Keys are normalized (lowercase, no accents). Lookup uses startsWith/includes.
export const EVIDENCE_SUGGESTIONS: Record<string, EvidenceSuggestion> = {
  // ===== ATB =====
  'ceftriaxona':            { defaultDose: '1 g',    defaultRoute: 'Intravenosa', defaultPosology: '12/12h', diluent: 'SF0,9%',  volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Sanford 2024 · UpToDate', notes: 'Adulto: 1–2 g 12/12h ou 24/24h conforme foco' },
  'piperacilina':           { defaultDose: '4,5 g',  defaultRoute: 'Intravenosa', defaultPosology: '6/6h',   diluent: 'SF0,9%',  volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Sanford 2024',           notes: 'Considerar infusão estendida 4h em sepse' },
  'meropenem':              { defaultDose: '1 g',    defaultRoute: 'Intravenosa', defaultPosology: '8/8h',   diluent: 'SF0,9%',  volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Sanford 2024 · BSAC',     notes: 'Infusão estendida 3h em PK/PD desafiador' },
  'vancomicina':            { defaultDose: '1 g',    defaultRoute: 'Intravenosa', defaultPosology: '12/12h', diluent: 'SF0,9%',  volumeTotal: '250', infusionTime: '60', infusionTimeUnit: 'min', source: 'IDSA 2020',               notes: 'Máx 10 mg/min · monitorar nível alvo AUC 400–600' },
  'cefepime':               { defaultDose: '2 g',    defaultRoute: 'Intravenosa', defaultPosology: '8/8h',   diluent: 'SF0,9%',  volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Sanford 2024' },
  'ampicilina':             { defaultDose: '2 g',    defaultRoute: 'Intravenosa', defaultPosology: '6/6h',   diluent: 'SF0,9%',  volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Sanford 2024' },
  'metronidazol':           { defaultDose: '500 mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h',   diluent: 'SF0,9%',  volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Sanford 2024' },
  'azitromicina':           { defaultDose: '500 mg', defaultRoute: 'Intravenosa', defaultPosology: '24/24h', diluent: 'SF0,9%',  volumeTotal: '250', infusionTime: '60', infusionTimeUnit: 'min', source: 'Bulário · Sanford' },
  'clindamicina':           { defaultDose: '600 mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h',   diluent: 'SF0,9%',  volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Sanford 2024' },
  'linezolida':             { defaultDose: '600 mg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', diluent: 'sem_diluente',  volumeTotal: '300', infusionTime: '60', infusionTimeUnit: 'min', source: 'Sanford 2024', notes: 'Bolsa pronta 600 mg/300 mL — NÃO diluir; infundir direto em 30–120 min' },

  // ===== Vasoativos / sedação (BIC) =====
  'noradrenalina':          { defaultDose: '0,05–0,5 mcg/kg/min', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', diluent: 'SG5%', volumeTotal: '250', source: 'AMIB 2023 · UpToDate', notes: 'Diluição padrão 16 mg / 250 mL = 64 mcg/mL · acesso central' },
  'adrenalina':             { defaultDose: '0,01–0,5 mcg/kg/min', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', diluent: 'SG5%', volumeTotal: '250', source: 'AMIB 2023', notes: 'Choque refratário · acesso central' },
  'dobutamina':             { defaultDose: '2,5–20 mcg/kg/min',   defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', diluent: 'SG5%', volumeTotal: '250', source: 'AMIB 2023', notes: '250 mg / 250 mL = 1 mg/mL' },
  'vasopressina':           { defaultDose: '0,03 U/min (fixa)',   defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', diluent: 'SF0,9%', volumeTotal: '100', source: 'SSC 2021', notes: 'Adjuvante na sepse · não titular acima de 0,04 U/min' },
  'nitroprussiato':         { defaultDose: '0,3–3 mcg/kg/min',    defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', diluent: 'SG5%', volumeTotal: '250', source: 'UpToDate', notes: 'Proteção da luz · risco de cianeto' },
  'fentanil':               { defaultDose: '0,5–3 mcg/kg/h',      defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', diluent: 'SF0,9%', volumeTotal: '100', source: 'AMIB 2023', notes: '500 mcg / 100 mL = 5 mcg/mL' },
  'midazolam':              { defaultDose: '0,02–0,1 mg/kg/h',    defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', diluent: 'SF0,9%', volumeTotal: '100', source: 'AMIB 2023' },
  'propofol':               { defaultDose: '0,3–4 mg/kg/h',       defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', diluent: 'sem_diluente', volumeTotal: '100', source: 'AMIB 2023', notes: 'Frasco puro · trocar equipo 12/12h' },
  'dexmedetomidina':        { defaultDose: '0,2–1,4 mcg/kg/h',    defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', diluent: 'SF0,9%', volumeTotal: '50',  source: 'AMIB 2023', notes: '200 mcg / 50 mL = 4 mcg/mL' },
  'cisatracurio':           { defaultDose: '1–3 mcg/kg/min',      defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', diluent: 'SF0,9%', volumeTotal: '100', source: 'AMIB 2023', notes: 'Refrigerar · TOF a cada 4h' },

  // ===== Analgesia / sintomáticos =====
  'dipirona':               { defaultDose: '1 g',    defaultRoute: 'Intravenosa', defaultPosology: '6/6h', diluent: 'SF0,9%', volumeTotal: '100', infusionTime: '15', infusionTimeUnit: 'min', source: 'Bulário' },
  'paracetamol':            { defaultDose: '1 g',    defaultRoute: 'Oral',        defaultPosology: '6/6h', source: 'Bulário', notes: 'EV 1g em 100 mL SF · correr 15 min' },
  'tramadol':               { defaultDose: '100 mg', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', diluent: 'SF0,9%', volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Bulário' },
  'morfina':                { defaultDose: '2–4 mg', defaultRoute: 'Intravenosa', defaultPosology: '4/4h', source: 'UpToDate', notes: 'Bolus lento em 5 min' },
  'ondansetrona':           { defaultDose: '4 mg',   defaultRoute: 'Intravenosa', defaultPosology: '8/8h', source: 'Bulário' },
  'bromoprida':             { defaultDose: '10 mg',  defaultRoute: 'Intravenosa', defaultPosology: '8/8h', source: 'Bulário' },
  'escopolamina':           { defaultDose: '20 mg',  defaultRoute: 'Intravenosa', defaultPosology: '8/8h', source: 'Bulário' },
  'cetoprofeno':            { defaultDose: '100 mg', defaultRoute: 'Intravenosa', defaultPosology: '12/12h', diluent: 'SF0,9%', volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Bulário' },

  // ===== Cardio =====
  'aas':                    { defaultDose: '100 mg', defaultRoute: 'Oral', defaultPosology: '1x/dia', source: 'AHA 2020' },
  'clopidogrel':            { defaultDose: '75 mg',  defaultRoute: 'Oral', defaultPosology: '1x/dia', source: 'AHA 2020' },
  'atorvastatina':          { defaultDose: '40 mg',  defaultRoute: 'Oral', defaultPosology: '1x/dia', source: 'AHA 2018' },
  'enalapril':              { defaultDose: '10 mg',  defaultRoute: 'Oral', defaultPosology: '12/12h', source: 'ESC 2021' },
  'losartana':              { defaultDose: '50 mg',  defaultRoute: 'Oral', defaultPosology: '1x/dia', source: 'ESC 2021' },
  'anlodipino':             { defaultDose: '5 mg',   defaultRoute: 'Oral', defaultPosology: '1x/dia', source: 'ESC 2021' },
  'carvedilol':             { defaultDose: '6,25 mg',defaultRoute: 'Oral', defaultPosology: '12/12h', source: 'ESC HF 2021' },
  'furosemida':             { defaultDose: '20 mg',  defaultRoute: 'Intravenosa', defaultPosology: '8/8h', source: 'UpToDate', notes: 'Bolus lento · máx 4 mg/min' },
  'espironolactona':        { defaultDose: '25 mg',  defaultRoute: 'Oral', defaultPosology: '1x/dia', source: 'ESC HF 2021' },
  'hidroclorotiazida':      { defaultDose: '25 mg',  defaultRoute: 'Oral', defaultPosology: '1x/dia', source: 'ESC 2021' },

  // ===== GI / Profilaxia =====
  'omeprazol':              { defaultDose: '40 mg',  defaultRoute: 'Intravenosa', defaultPosology: '24/24h', diluent: 'SF0,9%', volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Bulário' },
  'pantoprazol':            { defaultDose: '40 mg',  defaultRoute: 'Intravenosa', defaultPosology: '24/24h', diluent: 'SF0,9%', volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Bulário' },
  'ranitidina':             { defaultDose: '50 mg',  defaultRoute: 'Intravenosa', defaultPosology: '8/8h',   diluent: 'SF0,9%', volumeTotal: '100', infusionTime: '20', infusionTimeUnit: 'min', source: 'Bulário' },
  'enoxaparina':            { defaultDose: '40 mg',  defaultRoute: 'Subcutânea',  defaultPosology: '24/24h', source: 'CHEST 2012', notes: 'Profilaxia TEV · ajustar para ClCr <30' },
  'heparina':               { defaultDose: '5000 UI',defaultRoute: 'Subcutânea',  defaultPosology: '8/8h',   source: 'CHEST 2012', notes: 'Profilaxia TEV' },

  // ===== Endócrino =====
  'insulina regular':       { defaultDose: 'conforme HGT', defaultRoute: 'Subcutânea', defaultPosology: 'ACM', source: 'ADA 2024', notes: 'Esquema correção · checar HGT 6/6h' },
  'insulina nph':           { defaultDose: '10 UI',  defaultRoute: 'Subcutânea', defaultPosology: '12/12h', source: 'ADA 2024' },
  'hidrocortisona':         { defaultDose: '100 mg', defaultRoute: 'Intravenosa', defaultPosology: '8/8h',   diluent: 'SF0,9%', volumeTotal: '100', infusionTime: '15', infusionTimeUnit: 'min', source: 'SCCM 2017' },
  'metilprednisolona':      { defaultDose: '40 mg',  defaultRoute: 'Intravenosa', defaultPosology: '12/12h', diluent: 'SF0,9%', volumeTotal: '100', infusionTime: '30', infusionTimeUnit: 'min', source: 'Bulário' },
  'levotiroxina':           { defaultDose: '50 mcg', defaultRoute: 'Oral', defaultPosology: '1x/dia', source: 'ATA 2014', notes: 'Em jejum, 30 min antes do café' },

  // ===== Inalação / outros =====
  'salbutamol':             { defaultDose: '10 gts (2,5 mg)', defaultRoute: 'Inalatória', defaultPosology: '6/6h', diluent: 'SF0,9%', volumeTotal: '4', source: 'GOLD 2024', notes: '4 mL SF · NBZ' },
  'ipratropio':             { defaultDose: '40 gts (0,5 mg)', defaultRoute: 'Inalatória', defaultPosology: '6/6h', diluent: 'SF0,9%', volumeTotal: '4', source: 'GOLD 2024' },
  'budesonida':             { defaultDose: '0,5 mg',           defaultRoute: 'Inalatória', defaultPosology: '12/12h', diluent: 'SF0,9%', volumeTotal: '4', source: 'GINA 2024' },
  'n-acetilcisteina':       { defaultDose: '600 mg', defaultRoute: 'Oral', defaultPosology: '8/8h', source: 'Bulário' },
  'kcl 19,1%':              { defaultDose: '10 mL',  defaultRoute: 'Intravenosa', defaultPosology: 'ACM', diluent: 'SF0,9%', volumeTotal: '100', infusionTime: '60', infusionTimeUnit: 'min', source: 'AMIB 2023', notes: 'Máx periférico 40 mEq/L · NUNCA bolus' },
};

export function getEvidenceSuggestion(name?: string): EvidenceSuggestion | undefined {
  const n = norm(name);
  if (!n) return undefined;
  // exact prefix first
  for (const key of Object.keys(EVIDENCE_SUGGESTIONS)) {
    if (n.startsWith(key) || n.includes(key)) return EVIDENCE_SUGGESTIONS[key];
  }
  return undefined;
}
