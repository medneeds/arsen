/**
 * Derivação heurística de flags assistenciais para medicamentos EV.
 *
 * Sprint A — fonte é uma curadoria leve por nome (NFD-normalizado).
 * Quando o catálogo HMDM 2026 ganhar essas colunas no banco, basta substituir
 * a derivação por leitura direta do registro.
 */

export interface IvMedicationFlags {
  photoprotection: boolean;   // Fotossensível — proteger da luz (envoltório âmbar / equipo opaco)
  requiresFilter: boolean;    // Necessita filtro em linha (0,22 µm geralmente)
  requiresPump: boolean;      // Exige bomba de infusão (BIC obrigatória)
}

export interface ReconstitutionDefault {
  required: boolean;
  solvent?: string;     // Ex.: 'AD', 'SF 0,9%'
  volumeMl?: string;    // Ex.: '10', '20'
}

const PHOTO_PROTECTION_RX = /(nitroprussiato|anfotericina|dacarbazina|epinefrina\b|adrenalina|nimodipino|vitamina k|fitomenadiona|furosemida|metronidazol|nipride)/i;

const FILTER_RX = /(anfotericina lipos|abelcet|amphocil|paclitaxel|manitol|imunoglobulina|nutri[cç][aã]o parenteral|npt\b)/i;

const PUMP_RX = /(noradrenalina|noraepinefrina|adrenalina|epinefrina|dobutamina|dopamina|nitroprussiato|nitroglicerina|milrinona|vasopressina|midazolam|propofol|fentanil|remifentanil|cisatracur|atracur|rocuronio|insulina (regular|humana) ev|heparina (n[aã]o fracion|s[oó]dica)|amiodarona|lidoca[ií]na (ev|cont[íi]n)|esmolol|nitroprussiato|terlipressina|labetalol|nicardipino|alteplase|tenecteplase|estreptoquinase)/i;

// Reconstituição (pó liofilizado → AD/SF antes da diluição final)
const RECONSTITUTION: Array<{ rx: RegExp; solvent: string; volumeMl: string }> = [
  { rx: /vancomicina/i, solvent: 'AD', volumeMl: '20' },
  { rx: /piperacilina[\s-]?tazobactam|tazocin/i, solvent: 'AD', volumeMl: '20' },
  { rx: /ceftriaxon/i, solvent: 'AD', volumeMl: '10' },
  { rx: /cefepim/i, solvent: 'AD', volumeMl: '10' },
  { rx: /cefazolin/i, solvent: 'AD', volumeMl: '10' },
  { rx: /cefuroxim/i, solvent: 'AD', volumeMl: '10' },
  { rx: /meropenem/i, solvent: 'AD', volumeMl: '20' },
  { rx: /imipenem/i, solvent: 'SF 0,9%', volumeMl: '20' },
  { rx: /ertapenem/i, solvent: 'AD', volumeMl: '10' },
  { rx: /ampicilina(?!\s*\+\s*sulbactam)/i, solvent: 'AD', volumeMl: '10' },
  { rx: /ampicilina\s*\+\s*sulbactam|unasyn/i, solvent: 'AD', volumeMl: '10' },
  { rx: /oxacilina/i, solvent: 'AD', volumeMl: '10' },
  { rx: /aciclovir/i, solvent: 'AD', volumeMl: '10' },
  { rx: /ganciclovir/i, solvent: 'AD', volumeMl: '10' },
  { rx: /linezolid(a)?(?=\s|$)/i, solvent: 'SF 0,9%', volumeMl: '10' }, // já vem pronto em alguns casos — flag para conferência
  { rx: /teicoplanin/i, solvent: 'AD', volumeMl: '3' },
  { rx: /daptomicin/i, solvent: 'SF 0,9%', volumeMl: '10' },
  { rx: /omeprazol\s+ev|omeprazol\s+inj/i, solvent: 'próprio diluente', volumeMl: '10' },
  { rx: /pantoprazol\s+(ev|inj)/i, solvent: 'SF 0,9%', volumeMl: '10' },
  { rx: /hidrocortison|succinato de hidrocortisona/i, solvent: 'AD', volumeMl: '2' },
  { rx: /metilprednisolon/i, solvent: 'próprio diluente', volumeMl: '8' },
];

function nfd(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function deriveIvMedicationFlags(name: string): IvMedicationFlags {
  const n = nfd(name);
  return {
    photoprotection: PHOTO_PROTECTION_RX.test(n),
    requiresFilter: FILTER_RX.test(n),
    requiresPump: PUMP_RX.test(n),
  };
}

export function getReconstitutionDefault(name: string): ReconstitutionDefault {
  const n = nfd(name);
  const hit = RECONSTITUTION.find(r => r.rx.test(n));
  if (!hit) return { required: false };
  return { required: true, solvent: hit.solvent, volumeMl: hit.volumeMl };
}
