/**
 * Assistente de Insulinoterapia — protocolos SBD 2024 + ADA 2024 + AMIB (UTI)
 *
 * Cobre 4 esquemas:
 *  1. basal_bolus    — NPH/Regular ou Glargina/Lispro com correção
 *  2. sliding        — Esquema de resgate (sliding scale) Regular SC
 *  3. nph_fixed      — NPH fixa em 2-3 tomadas/dia
 *  4. iv_continuous  — Insulina EV contínua (UTI / DKA / HHS)
 *
 * Toda regra é editável pelo prescritor; este módulo entrega apenas
 * sugestões iniciais baseadas em peso, faixa de glicemia e meta.
 */

export type InsulinScheme = 'basal_bolus' | 'sliding' | 'nph_fixed' | 'iv_continuous';

export type BasalInsulin = 'NPH' | 'Glargina' | 'Detemir' | 'Degludeca';
export type BolusInsulin = 'Regular' | 'Lispro' | 'Aspart' | 'Glulisina';

/** Linha de uma escala de correção (sliding scale) — faixa de HGT → unidades SC. */
export interface SlidingRow {
  /** Limite inferior em mg/dL (>=) */
  min: number;
  /** Limite superior em mg/dL (<=). null = sem teto (chamar médico). */
  max: number | null;
  /** Unidades de insulina rápida SC. -1 = "Chamar médico". */
  units: number;
}

/** Tomada fixa programada (NPH ou bolus alimentar). */
export interface InsulinDose {
  time: string;      // "07:00"
  units: number;     // unidades SC
  insulin: string;   // "NPH" | "Regular" | "Lispro" ...
  /** Marcar como pré-prandial / bedtime para orientar enfermagem. */
  moment?: 'pre_cafe' | 'pre_almoco' | 'pre_jantar' | 'bedtime' | 'antes_dormir' | 'manha' | 'noite';
}

export interface InsulinPlan {
  scheme: InsulinScheme;

  /** Dados do paciente (auxiliam o cálculo). */
  weightKg?: number;
  /** Meta glicêmica (mg/dL) — ex.: "140-180" UTI, "80-130" enfermaria. */
  glycemicTarget?: string;

  /** ===== basal_bolus ===== */
  basalInsulin?: BasalInsulin;
  bolusInsulin?: BolusInsulin;
  totalDailyDose?: number;          // U/dia
  basalPercent?: number;            // % (default 50)
  fixedDoses?: InsulinDose[];       // tomadas fixas geradas (basal + bolus refeições)
  correctionRows?: SlidingRow[];    // escala de correção pré-refeição

  /** ===== sliding ===== */
  hgtFrequency?: '2/2h' | '4/4h' | '6/6h' | 'pre_refeicoes' | 'pre_refeicoes_bedtime';
  slidingRows?: SlidingRow[];

  /** ===== nph_fixed ===== */
  nphDoses?: InsulinDose[];         // ex.: 2/3 manhã, 1/3 noite

  /** ===== iv_continuous (UTI / DKA / HHS) ===== */
  ivProtocol?: 'dka' | 'hhs' | 'uti_glicemia' | 'pos_op_cardiaco';
  ivBolusDose?: number;             // 0,1 U/kg (DKA/HHS)
  ivStartRate?: number;             // U/h inicial (geralmente 0,1 U/kg/h)
  ivConcentration?: string;         // ex.: "100 UI Regular em 100 mL SF 0,9% (1 U/mL)"
  ivAdjustmentRule?: string;        // texto livre / preset
  ivKMonitoring?: boolean;          // K+ a cada 2-4h em DKA
  ivTransitionRule?: string;        // critério para virar SC

  /** Notas / orientações livres. */
  notes?: string;

  /** Fonte do protocolo aplicado (transparência clínica). */
  source?: string;
}

// ───────────────────────── Detecção ─────────────────────────

const INSULIN_PATTERNS: RegExp[] = [
  /\binsulina\b/i,
  /\bnph\b/i,
  /\bglargina\b/i, /\blantus\b/i, /\btoujeo\b/i, /\bbasaglar\b/i,
  /\blispro\b/i,   /\bhumalog\b/i,
  /\baspart\b/i,   /\bnovorapid\b/i, /\bfiasp\b/i,
  /\bglulisina\b/i,/\bapidra\b/i,
  /\bdetemir\b/i,  /\blevemir\b/i,
  /\bdegludeca\b/i,/\btresiba\b/i,
];

/** True quando o nome (ou apresentação) bate com qualquer insulina conhecida. */
export function isInsulinMedication(name: string): boolean {
  if (!name) return false;
  // bypass: a "Insulina Regular SOS Hipercalemia" é uma dose única e
  // não deve abrir o assistente (já tem instrução pronta).
  if (/hipercalemia/i.test(name) || /\bsos\b/i.test(name)) return false;
  return INSULIN_PATTERNS.some(rx => rx.test(name));
}

/** Detecta a "família" da insulina pelo nome — usado para preselecionar campos. */
export function detectInsulinKind(name: string): { isBasal: boolean; isBolus: boolean; suggested?: BasalInsulin | BolusInsulin } {
  const n = name.toLowerCase();
  if (/glargina|lantus|toujeo|basaglar/.test(n)) return { isBasal: true,  isBolus: false, suggested: 'Glargina' };
  if (/detemir|levemir/.test(n))                  return { isBasal: true,  isBolus: false, suggested: 'Detemir'  };
  if (/degludeca|tresiba/.test(n))                return { isBasal: true,  isBolus: false, suggested: 'Degludeca'};
  if (/\bnph\b/.test(n))                          return { isBasal: true,  isBolus: false, suggested: 'NPH'      };
  if (/lispro|humalog/.test(n))                   return { isBasal: false, isBolus: true,  suggested: 'Lispro'   };
  if (/aspart|novorapid|fiasp/.test(n))           return { isBasal: false, isBolus: true,  suggested: 'Aspart'   };
  if (/glulisina|apidra/.test(n))                 return { isBasal: false, isBolus: true,  suggested: 'Glulisina'};
  if (/regular/.test(n))                          return { isBasal: false, isBolus: true,  suggested: 'Regular'  };
  return { isBasal: false, isBolus: false };
}

// ───────────────────────── Sugestões padrão ─────────────────────────

/** Escala de correção padrão (low-dose) — adultos sensíveis, peso < 70 kg. */
export const SLIDING_LOW: SlidingRow[] = [
  { min: 150, max: 200, units: 2 },
  { min: 201, max: 250, units: 4 },
  { min: 251, max: 300, units: 6 },
  { min: 301, max: 350, units: 8 },
  { min: 351, max: null, units: -1 }, // chamar médico
];

/** Escala de correção média — adultos 70-100 kg. */
export const SLIDING_MEDIUM: SlidingRow[] = [
  { min: 150, max: 200, units: 4 },
  { min: 201, max: 250, units: 6 },
  { min: 251, max: 300, units: 8 },
  { min: 301, max: 350, units: 10 },
  { min: 351, max: null, units: -1 },
];

/** Escala de correção alta — pacientes resistentes, > 100 kg, corticoterapia. */
export const SLIDING_HIGH: SlidingRow[] = [
  { min: 150, max: 200, units: 6 },
  { min: 201, max: 250, units: 8 },
  { min: 251, max: 300, units: 10 },
  { min: 301, max: 350, units: 12 },
  { min: 351, max: null, units: -1 },
];

export function suggestSlidingByWeight(weightKg?: number): SlidingRow[] {
  if (!weightKg) return SLIDING_LOW;
  if (weightKg < 70) return SLIDING_LOW;
  if (weightKg <= 100) return SLIDING_MEDIUM;
  return SLIDING_HIGH;
}

/** Cálculo Basal-Bolus: TDD = peso × 0,4 (default), 50% basal / 50% bolus dividido em 3. */
export function computeBasalBolus(opts: {
  weightKg: number;
  unitsPerKg?: number;        // default 0,4 (0,3-0,5 ADA 2024)
  basalPercent?: number;      // default 50
  basalInsulin?: BasalInsulin;
  bolusInsulin?: BolusInsulin;
}): { tdd: number; basal: number; bolus: number; doses: InsulinDose[] } {
  const tdd = Math.round(opts.weightKg * (opts.unitsPerKg ?? 0.4));
  const basalPct = opts.basalPercent ?? 50;
  const basal = Math.round((tdd * basalPct) / 100);
  const bolus = tdd - basal;
  const perMeal = Math.round(bolus / 3);
  const basalIns = opts.basalInsulin ?? 'NPH';
  const bolusIns = opts.bolusInsulin ?? 'Regular';

  const doses: InsulinDose[] = basalIns === 'NPH'
    ? [
        // NPH split 2/3 manhã + 1/3 noite (padrão SBD)
        { time: '07:00', insulin: 'NPH', units: Math.round((basal * 2) / 3), moment: 'pre_cafe' },
        { time: '22:00', insulin: 'NPH', units: basal - Math.round((basal * 2) / 3), moment: 'antes_dormir' },
        { time: '07:00', insulin: bolusIns, units: perMeal, moment: 'pre_cafe' },
        { time: '12:00', insulin: bolusIns, units: perMeal, moment: 'pre_almoco' },
        { time: '18:00', insulin: bolusIns, units: bolus - 2 * perMeal, moment: 'pre_jantar' },
      ]
    : [
        // Análogo de longa: 1x/dia
        { time: '22:00', insulin: basalIns, units: basal, moment: 'bedtime' },
        { time: '07:00', insulin: bolusIns, units: perMeal, moment: 'pre_cafe' },
        { time: '12:00', insulin: bolusIns, units: perMeal, moment: 'pre_almoco' },
        { time: '18:00', insulin: bolusIns, units: bolus - 2 * perMeal, moment: 'pre_jantar' },
      ];

  return { tdd, basal, bolus, doses };
}

/** NPH fixa simples — 0,2 U/kg/dia, 2/3 manhã + 1/3 noite. */
export function computeNphFixed(weightKg: number, unitsPerKg = 0.2): InsulinDose[] {
  const total = Math.max(2, Math.round(weightKg * unitsPerKg));
  const morning = Math.round((total * 2) / 3);
  const night = total - morning;
  return [
    { time: '07:00', insulin: 'NPH', units: morning, moment: 'pre_cafe' },
    { time: '22:00', insulin: 'NPH', units: night, moment: 'antes_dormir' },
  ];
}

/** Protocolo EV contínuo — DKA / HHS / UTI / pós-op cardíaco. */
export function suggestIvProtocol(kind: InsulinPlan['ivProtocol'], weightKg?: number): Partial<InsulinPlan> {
  const w = weightKg ?? 70;
  switch (kind) {
    case 'dka':
      return {
        ivProtocol: 'dka',
        ivBolusDose: Math.round(w * 0.1 * 10) / 10,
        ivStartRate: Math.round(w * 0.1 * 10) / 10,
        ivConcentration: '100 UI Insulina Regular em 100 mL SF 0,9% (1 UI/mL) em BIC',
        ivAdjustmentRule:
          'Ajuste por HGT 1/1h: se queda < 50 mg/dL/h → ↑ 1 U/h. Glicemia ≤ 250 → adicionar SG5%, reduzir 50% e manter até resolução da cetoacidose (pH ≥ 7,3 e BIC ≥ 18). K+ entre 3,3-5,3.',
        ivKMonitoring: true,
        ivTransitionRule: 'Transição p/ SC após resolução: sobreposição de 2h após 1ª dose SC basal/bolus.',
        glycemicTarget: '150-200 mg/dL',
        source: 'AMIB 2023 / ADA DKA 2024',
      };
    case 'hhs':
      return {
        ivProtocol: 'hhs',
        ivBolusDose: Math.round(w * 0.1 * 10) / 10,
        ivStartRate: Math.round(w * 0.05 * 10) / 10,
        ivConcentration: '100 UI Insulina Regular em 100 mL SF 0,9% (1 UI/mL) em BIC',
        ivAdjustmentRule:
          'Hidratação agressiva PRIMEIRO. Reduzir glicemia 50-75 mg/dL/h. Glicemia ≤ 300 → SG5% + reduzir BIC 50%. Manter até osmolaridade < 315 e paciente alerta.',
        ivKMonitoring: true,
        ivTransitionRule: 'Transição p/ SC quando paciente alerta, tolerando dieta e osmolaridade normalizada.',
        glycemicTarget: '200-300 mg/dL',
        source: 'AMIB 2023 / ADA HHS 2024',
      };
    case 'uti_glicemia':
      return {
        ivProtocol: 'uti_glicemia',
        ivStartRate: Math.round(w * 0.05 * 10) / 10,
        ivConcentration: '50 UI Insulina Regular em 50 mL SF 0,9% (1 UI/mL) em BIC',
        ivAdjustmentRule:
          'HGT 1/1h até estabilidade (3 valores na meta), depois 2/2h. Meta 140-180 mg/dL. Algoritmo Yale: ajustar BIC conforme delta de glicemia.',
        ivKMonitoring: false,
        ivTransitionRule: 'Manter BIC enquanto NPO ou drogas vasoativas. Transição SC ao iniciar dieta plena.',
        glycemicTarget: '140-180 mg/dL',
        source: 'AMIB 2023 / ADA Inpatient 2024',
      };
    case 'pos_op_cardiaco':
      return {
        ivProtocol: 'pos_op_cardiaco',
        ivStartRate: Math.round(w * 0.05 * 10) / 10,
        ivConcentration: '100 UI Insulina Regular em 100 mL SF 0,9% (1 UI/mL) em BIC',
        ivAdjustmentRule: 'Algoritmo Portland — meta 110-150 mg/dL. HGT 1/1h × 12h, depois 2/2h.',
        ivKMonitoring: false,
        ivTransitionRule: 'Suspender 24-48h pós-op se euglicêmico. Transição SC se diabético prévio.',
        glycemicTarget: '110-150 mg/dL',
        source: 'STS Cardiac Surgery 2023',
      };
  }
  return {};
}

// ───────────────────────── Renderização (instrução p/ enfermagem) ─────────────────────────

const MOMENT_LABEL: Record<NonNullable<InsulinDose['moment']>, string> = {
  pre_cafe: 'pré-café',
  pre_almoco: 'pré-almoço',
  pre_jantar: 'pré-jantar',
  bedtime: 'ao deitar',
  antes_dormir: 'antes de dormir',
  manha: 'manhã',
  noite: 'noite',
};

export function formatSlidingRow(r: SlidingRow): string {
  const range = r.max == null ? `> ${r.min - 1}` : `${r.min}–${r.max}`;
  const action = r.units < 0 ? 'CHAMAR MÉDICO' : `${r.units} U SC`;
  return `HGT ${range} → ${action}`;
}

export function formatDose(d: InsulinDose): string {
  const moment = d.moment ? ` (${MOMENT_LABEL[d.moment]})` : '';
  return `${d.time} — ${d.insulin} ${d.units} U SC${moment}`;
}

/** Bloco enxuto para o painel/print. */
export function describeInsulinPlan(plan: InsulinPlan): { headline: string; lines: string[] } {
  const lines: string[] = [];
  let headline = 'Insulinoterapia';

  switch (plan.scheme) {
    case 'basal_bolus': {
      headline = `Basal-Bolus · ${plan.basalInsulin ?? 'NPH'} + ${plan.bolusInsulin ?? 'Regular'}`;
      if (plan.totalDailyDose) {
        lines.push(`TDD ${plan.totalDailyDose} U/dia · basal ${plan.basalPercent ?? 50}% / bolus ${100 - (plan.basalPercent ?? 50)}%`);
      }
      (plan.fixedDoses ?? []).forEach(d => lines.push(formatDose(d)));
      if (plan.correctionRows?.length) {
        lines.push('Correção pré-refeição:');
        plan.correctionRows.forEach(r => lines.push(`  • ${formatSlidingRow(r)}`));
      }
      break;
    }
    case 'sliding': {
      headline = 'Esquema de Resgate · Insulina Regular SC';
      lines.push(`HGT ${plan.hgtFrequency ?? '6/6h'}`);
      (plan.slidingRows ?? []).forEach(r => lines.push(`  • ${formatSlidingRow(r)}`));
      break;
    }
    case 'nph_fixed': {
      headline = 'NPH Fixa';
      (plan.nphDoses ?? []).forEach(d => lines.push(formatDose(d)));
      break;
    }
    case 'iv_continuous': {
      const proto = plan.ivProtocol ? PROTOCOL_LABEL[plan.ivProtocol] : 'BIC';
      headline = `Insulina EV Contínua · ${proto}`;
      if (plan.ivConcentration) lines.push(plan.ivConcentration);
      if (plan.ivBolusDose) lines.push(`Bolus inicial: ${plan.ivBolusDose} U EV`);
      if (plan.ivStartRate) lines.push(`Início: ${plan.ivStartRate} U/h em BIC`);
      if (plan.glycemicTarget) lines.push(`Meta glicêmica: ${plan.glycemicTarget}`);
      if (plan.ivAdjustmentRule) lines.push(`Ajuste: ${plan.ivAdjustmentRule}`);
      if (plan.ivKMonitoring) lines.push('K+ sérico a cada 2-4h.');
      if (plan.ivTransitionRule) lines.push(plan.ivTransitionRule);
      break;
    }
  }

  if (plan.notes) lines.push(`Obs: ${plan.notes}`);
  if (plan.source) lines.push(`Fonte: ${plan.source}`);
  return { headline, lines };
}

const PROTOCOL_LABEL: Record<NonNullable<InsulinPlan['ivProtocol']>, string> = {
  dka: 'Cetoacidose Diabética',
  hhs: 'Estado Hiperosmolar',
  uti_glicemia: 'Controle glicêmico UTI',
  pos_op_cardiaco: 'Pós-op cardíaco',
};

/** Frase única (compacta) para exibição em linha. */
export function assembleInsulinInstruction(plan: InsulinPlan): string {
  const { headline, lines } = describeInsulinPlan(plan);
  return `${headline} — ${lines.join(' · ')}`;
}
