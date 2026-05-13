/**
 * Clinical alert checks (pre-validation):
 * - Therapeutic duplicity (same drug or same class active twice)
 * - Allergy cross-reference vs patient allergies
 * - Severe interaction red-flags (heuristic on known high-risk combos)
 *
 * NÃO bloqueia a ação — apenas detecta. A UI exibe o alerta e exige
 * confirmação de ciência do médico para prosseguir.
 */

export interface MinimalRxItem {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'suspended';
  highAlert?: boolean;
}

export type AlertSeverity = 'high' | 'medium';

export interface ClinicalAlert {
  type: 'duplicate' | 'allergy' | 'interaction';
  severity: AlertSeverity;
  title: string;
  detail: string;
  itemIds: string[];
}

/* -----------------------------------------------------------
 * Therapeutic class heuristic — agrupa por palavras-chave no nome
 * ----------------------------------------------------------- */
const CLASS_PATTERNS: Array<{ class: string; patterns: RegExp[] }> = [
  { class: 'Opióides', patterns: [/morfina/i, /fentanil/i, /tramadol/i, /codeína/i, /oxicodona/i, /metadona/i, /remifentanil/i, /sufentanil/i, /nalbufina/i, /meperidina/i] },
  { class: 'Benzodiazepínicos', patterns: [/midazolam/i, /diazepam/i, /clonazepam/i, /lorazepam/i, /alprazolam/i, /bromazepam/i] },
  { class: 'AINEs', patterns: [/ibuprofeno/i, /diclofenaco/i, /cetoprofeno/i, /naproxeno/i, /tenoxicam/i, /piroxicam/i, /nimesulida/i, /cetorolaco/i, /\bketorolac/i] },
  // CLASSES SEPARADAS (sem reatividade cruzada entre si):
  // - Dipirona (metamizol) é pirazolona
  // - Paracetamol (acetaminofen) é para-aminofenol
  // Alergia a um NÃO contraindica o outro.
  { class: 'Pirazolonas (Dipirona)', patterns: [/dipirona/i, /metamizol/i, /novalgina/i, /anador/i, /\bmagnopyrol/i] },
  { class: 'Para-aminofenóis (Paracetamol)', patterns: [/paracetamol/i, /acetaminofen/i, /tylenol/i] },
  { class: 'Beta-bloqueadores', patterns: [/metoprolol/i, /propranolol/i, /atenolol/i, /carvedilol/i, /esmolol/i, /bisoprolol/i, /nebivolol/i] },
  { class: 'IECA', patterns: [/captopril/i, /enalapril/i, /lisinopril/i, /ramipril/i, /perindopril/i] },
  { class: 'BRA (sartanas)', patterns: [/losartana/i, /valsartana/i, /candesartana/i, /olmesartana/i, /telmisartana/i, /irbesartana/i] },
  { class: 'Diuréticos de alça', patterns: [/furosemida/i, /bumetanida/i, /torasemida/i] },
  { class: 'Tiazídicos', patterns: [/hidroclorotiazida/i, /clortalidona/i, /indapamida/i] },
  { class: 'Heparinas', patterns: [/heparina/i, /enoxaparina/i, /dalteparina/i, /fondaparinux/i] },
  { class: 'Anticoagulantes orais', patterns: [/varfarina/i, /warfarin/i, /rivaroxabana/i, /apixabana/i, /dabigatrana/i, /edoxabana/i] },
  { class: 'Antiagregantes', patterns: [/aas\b/i, /ácido acetilsalicíl/i, /clopidogrel/i, /ticagrelor/i, /prasugrel/i] },
  { class: 'Vasopressores', patterns: [/noradrenalina/i, /norepinefrina/i, /adrenalina/i, /epinefrina/i, /vasopressina/i, /fenilefrina/i] },
  { class: 'Inotrópicos', patterns: [/dobutamina/i, /milrinona/i, /levosimend/i] },
  { class: 'Antibióticos β-lactâmicos', patterns: [/cefalexina/i, /cefazolina/i, /cefuroxim/i, /ceftriaxon/i, /cefotaxim/i, /cefepim/i, /ceftazidim/i, /ampicilina/i, /amoxicilina/i, /piperacilina/i, /penicilina/i, /oxacilina/i] },
  { class: 'Carbapenêmicos', patterns: [/meropenem/i, /imipenem/i, /ertapenem/i, /doripenem/i] },
  { class: 'Glicopeptídeos', patterns: [/vancomicina/i, /teicoplanina/i] },
  { class: 'Aminoglicosídeos', patterns: [/gentamicina/i, /amicacina/i, /tobramicina/i, /estreptomicina/i] },
  { class: 'Fluoroquinolonas', patterns: [/ciprofloxac/i, /levofloxac/i, /moxifloxac/i, /norfloxac/i] },
  { class: 'Macrolídeos', patterns: [/azitromicina/i, /claritromicina/i, /eritromicina/i] },
  { class: 'Sulfonamidas', patterns: [/sulfametoxazol/i, /bactrim/i, /sulfadiazin/i, /sulfassalazin/i, /sulfa\b/i] },
  { class: 'IBP', patterns: [/omeprazol/i, /pantoprazol/i, /esomeprazol/i, /lansoprazol/i, /rabeprazol/i] },
  { class: 'Bloqueadores H2', patterns: [/ranitidina/i, /famotidina/i, /cimetidina/i] },
  { class: 'Estatinas', patterns: [/sinvastatina/i, /atorvastatin/i, /rosuvastatin/i, /pravastatin/i] },
  { class: 'Insulinas', patterns: [/insulina/i, /\bnph\b/i, /regular\b/i, /glargina/i, /lispro/i, /aspart/i, /detemir/i] },
  { class: 'Antieméticos 5-HT3', patterns: [/ondansetron/i, /granisetron/i, /palonosetron/i] },
  { class: 'Corticoides', patterns: [/hidrocortisona/i, /metilpredniso/i, /predniso/i, /dexametasona/i, /betametasona/i] },
  { class: 'Antipsicóticos', patterns: [/haloperidol/i, /clorpromazina/i, /olanzapin/i, /quetiapin/i, /risperidon/i] },
  { class: 'Anticonvulsivantes', patterns: [/fenitoína/i, /fenobarbital/i, /carbamazepin/i, /ácido valproico/i, /valproato/i, /levetiracetam/i] },
];

function classifyByName(name: string): string | null {
  for (const c of CLASS_PATTERNS) {
    if (c.patterns.some(p => p.test(name))) return c.class;
  }
  return null;
}

function normalize(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/* -----------------------------------------------------------
 * Duplicate detection — same generic name OR same class active
 * ----------------------------------------------------------- */
function detectDuplicates(items: MinimalRxItem[]): ClinicalAlert[] {
  const active = items.filter(i => i.status === 'active' && (i.category === 'medication' || i.category === 'antimicrobial'));
  const alerts: ClinicalAlert[] = [];

  // Same generic name (first significant token)
  const byName = new Map<string, MinimalRxItem[]>();
  for (const it of active) {
    const key = normalize(it.name).split(/\s+/)[0];
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(it);
  }
  for (const [key, list] of byName) {
    if (list.length > 1) {
      alerts.push({
        type: 'duplicate',
        severity: 'high',
        title: `Medicamento repetido: ${list[0].name.split(/\s+/)[0]}`,
        detail: `${list.length} prescrições ativas do mesmo princípio (${list.map(l => l.name).join(' • ')}). Verifique se há duplicidade real ou via/dose distintas intencionais.`,
        itemIds: list.map(l => l.id),
      });
    }
  }

  // Same therapeutic class
  const byClass = new Map<string, MinimalRxItem[]>();
  for (const it of active) {
    const cls = classifyByName(it.name);
    if (!cls) continue;
    if (!byClass.has(cls)) byClass.set(cls, []);
    byClass.get(cls)!.push(it);
  }
  for (const [cls, list] of byClass) {
    if (list.length > 1) {
      // Skip if already covered by name-duplicate
      const namesNorm = new Set(list.map(l => normalize(l.name).split(/\s+/)[0]));
      if (namesNorm.size === 1) continue;
      alerts.push({
        type: 'duplicate',
        severity: 'medium',
        title: `Duplicidade de classe: ${cls}`,
        detail: `${list.length} medicamentos ativos da mesma classe terapêutica: ${list.map(l => l.name).join(' • ')}. Avalie risco de potencialização de efeitos.`,
        itemIds: list.map(l => l.id),
      });
    }
  }

  return alerts;
}

/* -----------------------------------------------------------
 * Allergy cross-reference
 * ----------------------------------------------------------- */
function detectAllergies(items: MinimalRxItem[], allergiesText: string): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];
  if (!allergiesText) return alerts;
  const raw = normalize(allergiesText);
  if (!raw || raw === 'ndam' || raw === 'nda' || raw === 'nega' || raw.includes('nega alergia')) return alerts;

  // Split by common separators
  const tokens = raw
    .split(/[,;\/\n|+]| e | ou /g)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !['ndam', 'nda', 'sem', 'nenhuma', 'nego'].includes(t));

  // Class expansion — if patient is allergic to "penicilina", also flag β-lactâmicos
  const expanded: Array<{ token: string; matchClass?: string }> = [];
  for (const t of tokens) {
    expanded.push({ token: t });
    if (/penicil|amoxi|ampici|cefal|β-?lact|beta.?lact/.test(t)) {
      expanded.push({ token: t, matchClass: 'Antibióticos β-lactâmicos' });
      expanded.push({ token: t, matchClass: 'Carbapenêmicos' });
    }
    if (/dipirona|paracetamol|acetamin/.test(t)) {
      expanded.push({ token: t, matchClass: 'Paracetamol/Dipirona' });
    }
    if (/aas|aspirina|salicil/.test(t)) {
      expanded.push({ token: t, matchClass: 'AINEs' });
      expanded.push({ token: t, matchClass: 'Antiagregantes' });
    }
    if (/sulfa/.test(t)) {
      // Sulfa cross-reactivity is broad; flag bactrim/sulfameth
    }
    if (/aine|antiinflamat|anti.?inflamat|ibupr|diclof|cetop|nimesul/.test(t)) {
      expanded.push({ token: t, matchClass: 'AINEs' });
    }
  }

  const active = items.filter(i => i.status === 'active');
  for (const it of active) {
    const itemNorm = normalize(it.name);
    const itemClass = classifyByName(it.name);
    for (const e of expanded) {
      const nameMatch = e.token.length >= 4 && itemNorm.includes(e.token);
      const classMatch = e.matchClass && itemClass === e.matchClass;
      if (nameMatch || classMatch) {
        alerts.push({
          type: 'allergy',
          severity: 'high',
          title: `Possível alergia: ${it.name}`,
          detail: classMatch
            ? `Paciente refere alergia a "${e.token}" (classe ${e.matchClass}). Item prescrito pertence à mesma classe.`
            : `Paciente refere alergia a "${e.token}". Item prescrito coincide com o registro.`,
          itemIds: [it.id],
        });
        break; // one alert per item is enough
      }
    }
  }

  return alerts;
}

/* -----------------------------------------------------------
 * Severe interaction red-flags (heuristic, complementa AI)
 * ----------------------------------------------------------- */
const SEVERE_PAIRS: Array<{ a: RegExp; b: RegExp; reason: string }> = [
  { a: /tramadol|fentanil|morfina|metadona/i, b: /fluoxetin|sertralin|paroxetin|venlafax|duloxetin|amitriptilin|imipram/i, reason: 'Risco de síndrome serotoninérgica (opióide + ISRS/IRSN/tricíclico).' },
  { a: /linezolid/i, b: /fluoxetin|sertralin|venlafax|tramadol/i, reason: 'Risco de síndrome serotoninérgica (linezolida é IMAO fraco).' },
  { a: /varfarina|warfarin/i, b: /aas|ácido acetilsalicíl|clopidogrel|ibuprofeno|diclofenaco|cetop|naproxeno/i, reason: 'Sangramento elevado (anticoagulante + antiagregante/AINE).' },
  { a: /heparina|enoxaparin/i, b: /aas|clopidogrel|ticagrelor|ibuprofeno|diclofenaco/i, reason: 'Sangramento elevado (heparina + antiagregante/AINE).' },
  { a: /amiodarona|sotalol|haloperidol|ondansetron|azitromicin|claritromicin|levofloxac|moxifloxac|metadona/i, b: /amiodarona|sotalol|haloperidol|ondansetron|azitromicin|claritromicin|levofloxac|moxifloxac|metadona/i, reason: 'Prolongamento do QT — risco aditivo.' },
  { a: /sildenafil|tadalafil|vardenafil/i, b: /isossorbid|nitroglicerin|nitroprussi/i, reason: 'Hipotensão grave (PDE5 + nitratos).' },
  { a: /espironolacton|amilorid|enalapril|losartan|captopril|valsartan/i, b: /\bkcl\b|cloreto de potássio|potássio/i, reason: 'Hipercalemia (poupador K+ + reposição K+).' },
];

function detectSevereInteractions(items: MinimalRxItem[]): ClinicalAlert[] {
  const active = items.filter(i => i.status === 'active');
  const alerts: ClinicalAlert[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const A = active[i];
      const B = active[j];
      for (const rule of SEVERE_PAIRS) {
        const matchAB = rule.a.test(A.name) && rule.b.test(B.name);
        const matchBA = rule.a.test(B.name) && rule.b.test(A.name);
        if (matchAB || matchBA) {
          const key = [A.id, B.id].sort().join('|') + '::' + rule.reason;
          if (seenPairs.has(key)) continue;
          seenPairs.add(key);
          alerts.push({
            type: 'interaction',
            severity: 'high',
            title: `Interação grave: ${A.name.split(/\s+/)[0]} + ${B.name.split(/\s+/)[0]}`,
            detail: rule.reason,
            itemIds: [A.id, B.id],
          });
        }
      }
    }
  }

  return alerts;
}

/* -----------------------------------------------------------
 * Public API
 * ----------------------------------------------------------- */
export function runClinicalAlertChecks(
  items: MinimalRxItem[],
  patientAllergies: string,
  scope?: { onlyItemId?: string }
): ClinicalAlert[] {
  let working = items;
  let dup: ClinicalAlert[] = [];
  let aller: ClinicalAlert[] = [];
  let inter: ClinicalAlert[] = [];

  if (scope?.onlyItemId) {
    // For single-item validation, still run global checks but filter alerts that involve the target item
    dup = detectDuplicates(items).filter(a => a.itemIds.includes(scope.onlyItemId!));
    aller = detectAllergies(items, patientAllergies).filter(a => a.itemIds.includes(scope.onlyItemId!));
    inter = detectSevereInteractions(items).filter(a => a.itemIds.includes(scope.onlyItemId!));
  } else {
    dup = detectDuplicates(working);
    aller = detectAllergies(working, patientAllergies);
    inter = detectSevereInteractions(working);
  }

  // Order: high severity first, then by type priority (allergy > interaction > duplicate)
  const typePriority: Record<ClinicalAlert['type'], number> = { allergy: 0, interaction: 1, duplicate: 2 };
  return [...aller, ...inter, ...dup].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return typePriority[a.type] - typePriority[b.type];
  });
}
