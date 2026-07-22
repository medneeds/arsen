// ════════════════════════════════════════════════════════════════════════
// NUTRIÇÃO & HIDRATAÇÃO — fonte única do detalhamento nas 3 superfícies
// ════════════════════════════════════════════════════════════════════════
// Unificado em 21/07/2026 (auditoria de inconsistências pedida pelo gestor:
// "não podemos deixar passar nenhuma inconsistência").
//
// ANTES havia QUATRO implementações divergentes do detalhamento de nutrição:
//   1. Tela compacta (PrescricaoPage ~1980): telegráfica, única com
//      nutConsistency (oral), sem dietProfile/composition/monitoring.
//   2. PrintItemRow (código MORTO, removido): a mais completa — única com
//      nutProgression; serviu de referência para este superconjunto.
//   3. PrintablePrescription (impresso principal): SEM nutConsistency (!) e
//      sem nutProgression.
//   4. printExtraPrescription: a mais pobre (9 campos), rótulos divergentes
//      ("Vol/dia:" vs "Vol:", "Vazão:" vs "Correr em:", "Cab:" vs
//      "Cabeceira:", "Jejum:" vs "Motivo jejum:").
//
// ACHADO DE SEGURANÇA: nutConsistency (textura IDDSI — segurança de
// disfagia/broncoaspiração) era configurada no wizard e exibida na tela,
// mas NÃO saía em NENHUM impresso vivo. A copeira/enfermagem que executa a
// dieta usa o papel. Corrigido: entra no superconjunto, em posição de
// destaque (logo após o tipo de dieta).
//
// Hidratação: a frase com FASES e TOTAL/24h (balanço hídrico) existia só na
// tela compacta; os impressos mostravam apenas Vol/tempo/vazão genéricos.
// buildHydrationLine unifica — mesma frase nas 3 superfícies.

import { intervalToPhases } from '@/lib/prescriptionIntervals';

export interface NutritionPrintFields {
  nutritionType?: string;     // diet_enteral | diet_oral | diet_parenteral | water | npt | zero | supplement
  dietType?: string;
  dietProfile?: string;
  nutConsistency?: string;    // IDDSI / textura (oral) — SEGURANÇA disfagia
  nutComposition?: string;
  nutVolDay?: string;
  nutScheduleMode?: string;   // 'interval' | 'steps'
  nutSteps?: string;
  dietInterval?: string;
  nutRateMode?: string;       // 'mlh' | 'gtt'
  infusionRate?: string;
  nutMode?: string;
  nutFraction?: string;
  nutProgression?: string;
  nutNightPause?: string;
  nutBedHead?: string;
  nutAccess?: string;
  nutMonitoring?: string;
  nutResidualCheck?: string;
  nutWaterVolPerAdmin?: string;
  nutWaterFreq?: string;
  nutZeroReason?: string;
  // NPT usa volume/tempo do frasco:
  volumeTotal?: string;
  infusionTime?: string;
  infusionTimeUnit?: string;  // 'h' | 'min'
  // Água: fallback legado (dose/posology quando campos nutWater* vazios)
  dose?: string;
  posology?: string;
}

/**
 * Superconjunto ordenado do detalhamento de nutrição. Rótulos completos
 * (padrão dos impressos) — usado por tela compacta, impresso principal e
 * impresso extra, garantindo que o médico veja o MESMO item em qualquer
 * superfície. Campos vazios são omitidos.
 */
export function buildNutritionParts(f: NutritionPrintFields): string[] {
  const scheduleText = f.nutScheduleMode === 'steps'
    ? (f.nutSteps ? `${f.nutSteps} ${f.nutSteps === '1' ? 'etapa/dia' : 'etapas/dia'}` : null)
    : (f.dietInterval ? `Intervalo: ${f.dietInterval}` : null);
  const rateUnit = f.nutRateMode === 'gtt' ? 'gts/min' : 'mL/h';
  const tUnit = f.infusionTimeUnit === 'h' ? 'h' : 'min';

  const parts: Array<string | null> = [
    f.dietType || null,
    // Consistência logo após o tipo — dado de segurança (disfagia). Sem o
    // sufixo "(IDDSI ...)" para economizar espaço; o nome já identifica.
    f.nutConsistency ? f.nutConsistency.replace(/\s*\(IDDSI[^)]*\)/i, '') : null,
    f.dietProfile ? `Perfil: ${f.dietProfile}` : null,
    f.nutComposition || null,
    f.nutVolDay ? `Vol/dia: ${f.nutVolDay} mL` : null,
    scheduleText,
    f.infusionRate ? `Correr em: ${f.infusionRate} ${rateUnit}` : null,
    // NPT: volume do frasco + tempo de infusão
    f.volumeTotal ? `Vol: ${f.volumeTotal} mL` : null,
    f.infusionTime ? `Tempo: ${f.infusionTime}${tUnit}` : null,
    f.nutMode || null,
    f.nutFraction ? `Fração: ${f.nutFraction}` : null,
    f.nutProgression ? `Progressão: ${f.nutProgression}` : null,
    f.nutNightPause ? `Pausa noturna: ${f.nutNightPause}` : null,
    f.nutBedHead ? `Cabeceira: ${f.nutBedHead}°` : null,
    f.nutAccess ? `Acesso: ${f.nutAccess}` : null,
    f.nutMonitoring ? `Monit: ${f.nutMonitoring}` : null,
    f.nutResidualCheck ? `Resíduo: ${f.nutResidualCheck}` : null,
    f.nutWaterVolPerAdmin
      ? `Vol/adm: ${f.nutWaterVolPerAdmin} mL`
      : (f.nutritionType === 'water' && f.dose && f.dose !== '-' ? `Vol/adm: ${f.dose}` : null),
    f.nutWaterFreq
      ? `Freq: ${f.nutWaterFreq}`
      : (f.nutritionType === 'water' && f.posology && f.posology !== '-' ? `Freq: ${f.posology}` : null),
    f.nutZeroReason ? `Motivo jejum: ${f.nutZeroReason}` : null,
  ];
  return parts.filter((p): p is string => !!p);
}

export interface HydrationLineFields {
  volumeTotal?: string;       // volume por fase (mL)
  posology?: string;          // intervalo (define nº de fases)
  infusionTime?: string;
  infusionTimeUnit?: string;  // 'h' | 'min'
  infusionRate?: string;      // vazão digitada (sincronizada pela tela)
  infusionMode?: string;      // 'BIC' | 'gts'
}

/**
 * Frase única de hidratação — fases + tempo + vazão + TOTAL/24h (balanço
 * hídrico). Mesma frase na tela compacta e nos dois impressos. A vazão usa
 * o valor digitado/sincronizado; sem ele, calcula de volume ÷ tempo (mesma
 * regra do buildPrepSegments).
 */
export function buildHydrationLine(f: HydrationLineFields): string {
  const phases = intervalToPhases(f.posology);
  const interval = f.posology || '24/24h';
  const vol = parseFloat((f.volumeTotal || '0').replace(',', '.')) || 0;
  const total24 = vol * phases;
  const tVal = f.infusionTime || '';
  const tUnit = f.infusionTimeUnit === 'h' ? 'h' : 'min';
  const rateLabel = f.infusionMode === 'gts' ? 'gts/min' : 'mL/h';
  let rate = f.infusionRate ? `${f.infusionRate} ${rateLabel}` : '';
  if (!rate && vol > 0 && tVal) {
    const tRaw = parseFloat(tVal.replace(',', '.'));
    const tMin = f.infusionTimeUnit === 'h' ? tRaw * 60 : tRaw;
    if (tMin > 0) rate = `${(vol / (tMin / 60)).toFixed(1).replace(/\.0$/, '')} mL/h`;
  }
  return [
    vol ? `${vol}mL/fase` : '',
    `${phases} fase${phases > 1 ? 's' : ''} (${interval})`,
    tVal ? `correr em ${tVal}${tUnit}` : '',
    rate ? `(${rate})` : '',
    total24 ? `total ${total24}mL/24h` : '',
  ].filter(Boolean).join(' · ');
}
