/**
 * TESTE: Campos IV (diluição, volume, tempo) não podem aparecer em itens orais
 *
 * Reportado (07/08/2026): Omeprazol via oral aparecia com "diluir em SF0,9%
 * 100mL, vol 100mL, correr em 30min" no modo compactado e na folha impressa.
 *
 * DOIS BUGS DISTINTOS, mesma origem:
 *
 *  1. applyIvClinicalAutofills (PrescricaoPage.tsx):
 *     A sugestão clínica ('omeprazol' → IV) preenchia diluent/volumeTotal/
 *     infusionTime SEM checar se a via era realmente EV. Omeprazol VO
 *     recebia os campos IV da entrada única do dicionário (EV).
 *     Correção: campos de infusão só são aplicados quando isIV=true.
 *
 *  2. buildPrepSegments (solutoToken.ts) e modo compactado (PrescricaoPage.tsx):
 *     Liam diluent/volumeTotal/infusionTime diretamente do objeto do item sem
 *     checar o tipo de apresentação. Se os campos estivessem preenchidos (pelo
 *     bug 1 ou por edição manual anterior com rota EV depois trocada para VO),
 *     apareciam na linha compacta e no impresso para itens orais.
 *     Correção: guarda isIVPresentation em ambos os locais antes de renderizar.
 *
 * Dados fictícios | Zero impacto em produção.
 */

// ── Réplica da lógica isIVPresentation de buildPrepSegments ─────────────

function isIVPresentation(presentation: string, route: string): boolean {
  const r = route.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const p = presentation.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/(comprimido|capsula|cap\.|dragea|sublingual|orodispersivel)/.test(p)) return false;
  if (/(oral|\bvo\b|sublingual|enteral|sonda|topico|retal|supositorio|pomada|creme|gel|intramuscular|subcutanea|\bsc\b|\bim\b)/.test(r)) return false;
  if (/(intravenosa|endovenosa|\bev\b)/.test(r)) return true;
  if (/(ampola|frasco|fr\.?\s*ampola|po liofiliz)/.test(p)) return true;
  return false;
}

// ── Réplica do guard de applyIvClinicalAutofills ─────────────────────────

interface FakeItem {
  route: string;
  diluent?: string;
  volumeTotal?: string;
  infusionTime?: string;
}

function applyEvidenceSuggestion(
  item: FakeItem,
  suggestion: { diluent: string; volumeTotal: string; infusionTime: string },
  isIV: boolean,
): FakeItem {
  const result = { ...item };
  const isEmpty = (v?: string) => !v || !v.trim() || v.trim() === '-';
  // Campos de infusão só para IV (bugfix)
  if (isIV) {
    if (isEmpty(result.diluent)) result.diluent = suggestion.diluent;
    if (isEmpty(result.volumeTotal)) result.volumeTotal = suggestion.volumeTotal;
    if (isEmpty(result.infusionTime)) result.infusionTime = suggestion.infusionTime;
  }
  return result;
}

// ── Runner mínimo ─────────────────────────────────────────────────────────

let total = 0;
let falhas = 0;
function check(label: string, cond: boolean, detail?: string) {
  total++;
  if (cond) console.log(`  OK  ${label}`);
  else { falhas++; console.error(`FALHA  ${label}${detail ? ` — ${detail}` : ''}`); }
}

const IV_SUGGESTION = { diluent: 'SF0,9%', volumeTotal: '100', infusionTime: '30' };

console.log('=== isIVPresentation: classificação correta por rota/apresentação ===');
{
  check('Omeprazol 40mg comprimido VO → NÃO é IV', !isIVPresentation('40mg comprimido', 'Oral'));
  check('Omeprazol 40mg comprimido sonda → NÃO é IV', !isIVPresentation('40mg comprimido', 'Enteral'));
  check('Omeprazol 40mg Frasco-ampola EV → É IV', isIVPresentation('40mg - Frasco-ampola', 'Intravenosa'));
  check('Omeprazol 40mg Frasco-ampola sem rota → É IV (presume por apresentação)', isIVPresentation('40mg - Frasco-ampola', ''));
  check('Dipirona ampola IM → NÃO é IV', !isIVPresentation('500mg/mL ampola', 'Intramuscular'));
  check('Dipirona ampola EV → É IV', isIVPresentation('500mg/mL ampola', 'Intravenosa'));
  check('Fluconazol cápsula VO → NÃO é IV', !isIVPresentation('150mg cápsula', 'Oral'));
  check('Fluconazol bolsa EV → É IV', isIVPresentation('200mg bolsa', 'Intravenosa'));
}

console.log('\n=== applyEvidenceSuggestion: campos IV não contaminam item oral ===');
{
  const oralItem: FakeItem = { route: 'Oral' };
  const resultOral = applyEvidenceSuggestion(oralItem, IV_SUGGESTION, false);
  check(
    'Omeprazol VO (isIV=false): diluent NÃO preenchido pela sugestão IV',
    !resultOral.diluent,
    `diluent: ${resultOral.diluent ?? '(vazio — correto)'}`,
  );
  check(
    'Omeprazol VO (isIV=false): volumeTotal NÃO preenchido pela sugestão IV',
    !resultOral.volumeTotal,
  );
  check(
    'Omeprazol VO (isIV=false): infusionTime NÃO preenchido pela sugestão IV',
    !resultOral.infusionTime,
  );

  const ivItem: FakeItem = { route: 'Intravenosa' };
  const resultIV = applyEvidenceSuggestion(ivItem, IV_SUGGESTION, true);
  check('Omeprazol EV (isIV=true): diluent preenchido corretamente', resultIV.diluent === 'SF0,9%');
  check('Omeprazol EV (isIV=true): volumeTotal preenchido corretamente', resultIV.volumeTotal === '100');
  check('Omeprazol EV (isIV=true): infusionTime preenchido corretamente', resultIV.infusionTime === '30');
}

console.log('\n=== modo compactado / buildPrepSegments: campos IV bloqueados para oral ===');
{
  // Simula item oral com campos IV poluídos (bug 1, ou edição manual com rota trocada)
  const itemOralPoluido = {
    presentation: '40mg comprimido',
    route: 'Oral',
    diluent: 'SF0,9%',     // poluído
    volumeTotal: '100',    // poluído
    infusionTime: '30',    // poluído
  };

  const isIV = isIVPresentation(itemOralPoluido.presentation, itemOralPoluido.route);
  const camposIVRenderizados = isIV
    ? ['diluent', 'volumeTotal', 'infusionTime'].filter(f => !!(itemOralPoluido as any)[f])
    : [];

  check(
    'Item oral poluído: isIVPresentation retorna false (guarda ativa)',
    !isIV,
  );
  check(
    'Item oral poluído: zero campos IV renderizados na tela/impresso',
    camposIVRenderizados.length === 0,
    `campos que seriam renderizados: ${camposIVRenderizados.join(', ') || 'nenhum (correto)'}`,
  );

  // IV com os mesmos campos → deve renderizar
  const itemIVLimpo = {
    presentation: '40mg - Frasco-ampola',
    route: 'Intravenosa',
    diluent: 'SF0,9%',
    volumeTotal: '100',
    infusionTime: '30',
  };
  const isIV2 = isIVPresentation(itemIVLimpo.presentation, itemIVLimpo.route);
  const camposIVRenderizados2 = isIV2
    ? ['diluent', 'volumeTotal', 'infusionTime'].filter(f => !!(itemIVLimpo as any)[f])
    : [];
  check(
    'Item EV com campos preenchidos: isIVPresentation retorna true',
    isIV2,
  );
  check(
    'Item EV com campos preenchidos: todos os 3 campos IV renderizados',
    camposIVRenderizados2.length === 3,
    `campos: ${camposIVRenderizados2.join(', ')}`,
  );
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
console.log('Todos os casos passaram.\n');
