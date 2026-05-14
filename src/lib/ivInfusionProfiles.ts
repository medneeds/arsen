/**
 * Sprint B — Perfis de Infusão (comportamento interno).
 *
 * Detecta o "perfil" clínico do medicamento EV pelo nome e devolve defaults
 * técnicos (diluente, volume total, tempo, modo, acesso preferencial).
 *
 * Regras:
 * - Não muda UI: somente alimenta campos vazios no momento da inclusão do item.
 * - Catálogo HMDM e instruções da apresentação SEMPRE têm precedência sobre
 *   os defaults do perfil. O perfil é fallback.
 * - Quando o catálogo passar a expor essa metadata diretamente, basta
 *   trocar a derivação por leitura de coluna.
 */

export type IvInfusionProfile =
  | 'vasoactive'
  | 'sedative'
  | 'neuromuscular_blocker'
  | 'electrolyte_kcl'
  | 'electrolyte_mg'
  | 'antibiotic_slow'      // exige tempo mínimo (Vanco etc.)
  | 'antibiotic'
  | 'antiarrhythmic'
  | 'anticoagulant_iv'
  | 'chemo'
  | 'emergency_bolus'
  | 'maintenance'
  | 'hydration';

export interface IvInfusionProfileDefaults {
  profile: IvInfusionProfile;
  requiresPump: boolean;
  continuous: boolean;                  // titulada/contínua → não fixa tempo
  preferredAccess?: 'central' | 'peripheral';
  defaultDiluent?: string;              // 'SF 0,9%' | 'SG 5%' | 'RL'
  defaultVolumeTotal?: string;          // mL
  defaultInfusionTime?: string;         // valor numérico
  defaultInfusionTimeUnit?: 'min' | 'h';
  defaultInfusionMode?: 'BIC' | 'gts';
  /** Velocidade/tempo limite — uso futuro em validações soft (Sprint C) */
  maxRateNote?: string;
  minTimeNote?: string;
  /** Observações que podem aparecer em chips/resumos depois */
  notes?: string;
}

function nfd(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

interface Rule {
  rx: RegExp;
  defaults: Omit<IvInfusionProfileDefaults, 'profile'> & { profile: IvInfusionProfile };
}

const RULES: Rule[] = [
  // ===== Vasoativos =====
  {
    rx: /(noradrenalina|noraepinefrina|norepinefrina|adrenalina|epinefrina|dobutamina|dopamina|vasopressina|milrinona|terlipressina|nitroprussiato|nitroglicerina|nicardipino|esmolol|labetalol)/i,
    defaults: {
      profile: 'vasoactive',
      requiresPump: true,
      continuous: true,
      preferredAccess: 'central',
      defaultDiluent: 'SG 5%',
      defaultVolumeTotal: '250',
      defaultInfusionMode: 'BIC',
      notes: 'Titular conforme alvo hemodinâmico',
    },
  },

  // ===== Antiarrítmico contínuo (Amiodarona — incompatível com SF) =====
  {
    rx: /amiodaron/i,
    defaults: {
      profile: 'antiarrhythmic',
      requiresPump: true,
      continuous: false,
      defaultDiluent: 'SG 5%',
      defaultVolumeTotal: '250',
      defaultInfusionMode: 'BIC',
      notes: 'Diluir SOMENTE em SG 5% (incompatível com SF 0,9%)',
    },
  },

  // ===== Sedativos contínuos =====
  {
    rx: /(midazolam|propofol|fentanil|remifentanil|dexmedetomidin|ketamin|cetamin)/i,
    defaults: {
      profile: 'sedative',
      requiresPump: true,
      continuous: true,
      preferredAccess: 'central',
      defaultDiluent: 'SF 0,9%',
      defaultVolumeTotal: '100',
      defaultInfusionMode: 'BIC',
    },
  },

  // ===== Bloqueadores neuromusculares =====
  {
    rx: /(rocuroni|cisatracur|atracur|vecuroni|pancuroni)/i,
    defaults: {
      profile: 'neuromuscular_blocker',
      requiresPump: true,
      continuous: true,
      defaultDiluent: 'SF 0,9%',
      defaultVolumeTotal: '100',
      defaultInfusionMode: 'BIC',
    },
  },

  // ===== Heparina EV contínua =====
  {
    rx: /heparina (n[aã]o fracion|s[oó]dica|ev)/i,
    defaults: {
      profile: 'anticoagulant_iv',
      requiresPump: true,
      continuous: true,
      defaultDiluent: 'SF 0,9%',
      defaultVolumeTotal: '250',
      defaultInfusionMode: 'BIC',
      notes: 'Titular por TTPa',
    },
  },

  // ===== Insulina EV contínua =====
  {
    rx: /insulina (regular|humana|r\b).*ev|insulina.*cont[íi]nu/i,
    defaults: {
      profile: 'sedative', // tratado como contínuo crítico (perfil interno)
      requiresPump: true,
      continuous: true,
      defaultDiluent: 'SF 0,9%',
      defaultVolumeTotal: '100',
      defaultInfusionMode: 'BIC',
      notes: 'Saturar equipo; titular por glicemia capilar',
    },
  },

  // ===== Eletrólitos =====
  {
    rx: /(cloreto de pot[aá]ssio|kcl\b|cloreto k\b)/i,
    defaults: {
      profile: 'electrolyte_kcl',
      requiresPump: true,
      continuous: false,
      defaultDiluent: 'SF 0,9%',
      defaultVolumeTotal: '100',
      defaultInfusionTime: '60',
      defaultInfusionTimeUnit: 'min',
      defaultInfusionMode: 'BIC',
      maxRateNote: 'Periférico ≤ 40 mEq/L · ≤ 10 mEq/h (até 20 mEq/h em monitor)',
      notes: 'NUNCA push EV. Conferir concentração final.',
    },
  },
  {
    rx: /(sulfato de magn[eé]sio|mgso4|mg sulfato)/i,
    defaults: {
      profile: 'electrolyte_mg',
      requiresPump: true,
      continuous: false,
      defaultDiluent: 'SF 0,9%',
      defaultVolumeTotal: '100',
      defaultInfusionTime: '30',
      defaultInfusionTimeUnit: 'min',
      defaultInfusionMode: 'BIC',
      minTimeNote: '≥ 30 min (exceto eclâmpsia — protocolo específico)',
    },
  },

  // ===== Antibióticos com tempo mínimo / risco red-man =====
  {
    rx: /vancomicin/i,
    defaults: {
      profile: 'antibiotic_slow',
      requiresPump: true,
      continuous: false,
      defaultDiluent: 'SF 0,9%',
      defaultVolumeTotal: '250',
      defaultInfusionTime: '60',
      defaultInfusionTimeUnit: 'min',
      defaultInfusionMode: 'BIC',
      minTimeNote: '≥ 60 min/g (red-man)',
    },
  },
  {
    rx: /(anfotericina(?!\s+lipos)|anfotericina deoxicolat)/i,
    defaults: {
      profile: 'antibiotic_slow',
      requiresPump: true,
      continuous: false,
      defaultDiluent: 'SG 5%',
      defaultVolumeTotal: '500',
      defaultInfusionTime: '4',
      defaultInfusionTimeUnit: 'h',
      defaultInfusionMode: 'BIC',
      minTimeNote: '≥ 4 h (deoxicolato)',
      notes: 'Diluir em SG 5% (incompatível com SF). Filtro 1 µm.',
    },
  },
  {
    rx: /anfotericina lipos|ambisome/i,
    defaults: {
      profile: 'antibiotic_slow',
      requiresPump: true,
      continuous: false,
      defaultDiluent: 'SG 5%',
      defaultVolumeTotal: '250',
      defaultInfusionTime: '2',
      defaultInfusionTimeUnit: 'h',
      defaultInfusionMode: 'BIC',
      minTimeNote: '≥ 2 h',
    },
  },

  // ===== Antibióticos comuns =====
  {
    rx: /(piperacilina|tazocin|meropenem|imipenem|ertapenem|cefepim|ceftriaxon|cefazolin|cefuroxim|ampicilina|oxacilina|aciclovir|ganciclovir|linezolid|teicoplanin|daptomicin|metronidazol|azitromicin\s+ev|claritromicin\s+ev|levofloxacin\s+ev|ciprofloxacin\s+ev|gentamicin|amicacin|tigeciclin|colistin|polimixin)/i,
    defaults: {
      profile: 'antibiotic',
      requiresPump: false,
      continuous: false,
      defaultDiluent: 'SF 0,9%',
      defaultVolumeTotal: '100',
      defaultInfusionTime: '30',
      defaultInfusionTimeUnit: 'min',
      defaultInfusionMode: 'BIC',
    },
  },

  // ===== Bolus de emergência =====
  {
    rx: /(atropina|adenosin|naloxon|flumazenil|glucagon)/i,
    defaults: {
      profile: 'emergency_bolus',
      requiresPump: false,
      continuous: false,
      defaultInfusionMode: 'BIC',
      notes: 'Bolus EV',
    },
  },

  // ===== Hidratação / manutenção (cristaloides puros) =====
  {
    rx: /^(sf 0,9%|soro fisiol[oó]gico|sg 5%|soro glicosado|ringer lactato|ringer simples|sf 0,45%)/i,
    defaults: {
      profile: 'hydration',
      requiresPump: false,
      continuous: false,
      defaultInfusionMode: 'BIC',
    },
  },
];

export function getInfusionProfile(name: string): IvInfusionProfileDefaults | null {
  const n = nfd(name);
  const hit = RULES.find(r => r.rx.test(n));
  return hit ? hit.defaults : null;
}

/** Aplica defaults do perfil sobre um objeto parcial de PrescriptionItem,
 *  preenchendo SOMENTE campos vazios. Não sobrescreve catálogo nem o que
 *  o detector de instruções já preencheu. */
export function applyInfusionProfileDefaults<T extends Record<string, any>>(
  item: T,
  profile: IvInfusionProfileDefaults | null,
): T {
  if (!profile) return item;
  const isEmpty = (v: any) => v === undefined || v === null || v === '';
  const out: any = { ...item };

  if (profile.defaultInfusionMode && isEmpty(out.infusionMode)) {
    out.infusionMode = profile.defaultInfusionMode;
  }
  if (profile.defaultDiluent && isEmpty(out.diluent)) {
    out.diluent = profile.defaultDiluent;
  }
  if (profile.defaultVolumeTotal && isEmpty(out.diluentVolume)) {
    out.diluentVolume = profile.defaultVolumeTotal;
  }
  if (profile.defaultVolumeTotal && isEmpty(out.volumeTotal)) {
    out.volumeTotal = profile.defaultVolumeTotal;
  }
  // Para contínuos, NÃO força tempo de infusão (titulado).
  if (!profile.continuous) {
    if (profile.defaultInfusionTime && isEmpty(out.infusionTime)) {
      out.infusionTime = profile.defaultInfusionTime;
    }
    if (profile.defaultInfusionTimeUnit && isEmpty(out.infusionTimeUnit)) {
      out.infusionTimeUnit = profile.defaultInfusionTimeUnit;
    }
  }
  if (profile.preferredAccess && isEmpty(out.accessType)) {
    out.accessType = profile.preferredAccess;
  }
  return out;
}
