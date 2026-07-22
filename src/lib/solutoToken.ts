// ════════════════════════════════════════════════════════════════════════
// SOLUTO TOKEN — fonte única de verdade para exibir a quantidade/dose
// ════════════════════════════════════════════════════════════════════════
// Extraído de PrescricaoPage.tsx em 16/07/2026 para corrigir bug da
// Prescrição Extra: a pré-visualização na tela usava esta lógica
// (quantity + quantityUnit + dose com classificação), mas o impresso
// (printExtraPrescription) usava apenas `dose` cru — quando o médico
// preenchia só a Qtd (ex: Midazolam 20 mL), o volume desaparecia do papel.
// Tela e impresso agora consomem a MESMA função.

export interface SolutoFields {
  quantity?: string;
  quantityUnit?: string;
  dose?: string;
}

// Siglas hospitalares para forma/unidade (display-only; valor preservado)
export const QUANTITY_UNIT_SHORT: Record<string, string> = {
  'mL': 'mL',
  'ampola': 'AMP',
  'frasco-ampola': 'FA',
  'frasco': 'FR',
  'comprimido': 'CP',
  'cápsula': 'CAP',
  'gota': 'gts',
  'mg': 'mg',
  'g': 'g',
  'mcg': 'mcg',
  'UI': 'UI',
  'bolsa': 'BOL',
  'unidade': 'UN',
  'sachê': 'SCH',
  'envelope': 'ENV',
  'adesivo': 'ADES',
  'supositório': 'SUP',
  'óvulo': 'OV',
  'bisnaga': 'BIS',
};

export const quantityUnitShort = (u?: string) => (u && QUANTITY_UNIT_SHORT[u]) || u || '';

// Variante com rótulo "Qtd.:" — usada nos pontos onde o soluto aparece como
// segmento isolado (corpo da prescrição na tela, impressos diário e anexo).
// O rótulo só entra quando o médico preencheu o campo Qtd (que é o que gera
// o token); textos vindos apenas do campo dose (ex: "Bolus 150 mL") ficam
// sem rótulo para não rotular como quantidade algo que não é.
// A frase corrida do preparo ("Diluir X em Y...") continua usando
// buildSolutoToken puro — rótulo ali quebraria a gramática.
export function buildSolutoTokenLabeled(item: SolutoFields): string {
  const s = buildSolutoToken(item);
  if (!s) return s;
  const qtyRaw = (item.quantity || '').trim();
  const hasQty = !!qtyRaw && qtyRaw !== '0';
  return hasQty ? `Qtd.: ${s}` : s;
}

// Compõe o token de dose combinando `dose` (texto livre, geralmente do preset
// do wizard) e `quantity`+`quantityUnit` (campos editados inline pelo médico).
export function buildSolutoToken(item: SolutoFields): string {
  const qtyRaw  = (item.quantity || '').trim();
  const qty     = qtyRaw && qtyRaw !== '0' ? qtyRaw : '';
  const unitShort = item.quantityUnit ? quantityUnitShort(item.quantityUnit) : '';
  const qtyStr  = qty && unitShort ? `${qty} ${unitShort}` : qty || '';

  const doseRaw = (item.dose && item.dose !== '-') ? item.dose.trim().replace(/\.$/, '') : '';

  // ── Classificadores do campo dose ──────────────────────────────────
  // 1. Concentração: contém "/" seguido de mL (ex: "100mcg/mL", "5mg/mL")
  const isConcentration = !!doseRaw && /\/\s*m[lL]\b/i.test(doseRaw);

  // 2. Volume puro em mL (ex: "10mL", "30 mL") — sem barras, sem massa
  const isPureMlVolume  = !isConcentration && /^\d+(?:[.,]\d+)?\s*m[lL]\b$/i.test(doseRaw);

  // 3. Dose terapêutica com unidade de massa/atividade.
  // Captura o NÚMERO + unidade (ex.: "1g", "500mg", "1 g") — funciona colado
  // ou com espaço. Antes exigia \b antes da unidade, que nunca bate quando o
  // número está colado (dígito e letra são ambos \w — sem fronteira entre
  // eles), então doses como "1g (2mL)" escapavam da classificação e caíam
  // no fallback genérico (CASO E), sem nunca escalar com a quantidade.
  const doseAmountMatch = doseRaw.match(/(\d[\d.,]*)\s*(mg|mcg|µg|ug|g|ui|meq|mmol)\b/i);
  const isMassDose = !!doseRaw && !isConcentration && !isPureMlVolume &&
    (!!doseAmountMatch || /(u\/|unidades?|%)/i.test(doseRaw));

  // ── Classificadores do campo quantityUnit ──────────────────────────
  const unitLower    = (item.quantityUnit || '').toLowerCase();
  const isVolumeUnit = unitLower === 'ml';           // prescrito em mL
  const isMassUnit   = /^(mg|mcg|µg|g|ui)$/i.test(unitLower); // prescrito em massa
  const isUnitUnit   = !isVolumeUnit && !isMassUnit; // amp, FA, comp, gota, etc.

  // ══════════════════════════════════════════════════════════════════
  // CASO A — Quantidade prescrita em MASSA (mg, mcg, g, UI)
  //   Médico digitou 500 mg ou 40 mg — mostrar só o qty.
  // ══════════════════════════════════════════════════════════════════
  if (isMassUnit) {
    return qtyStr || doseRaw;
  }

  // ══════════════════════════════════════════════════════════════════
  // CASO B — Dose é CONCENTRAÇÃO (100mcg/mL, 5mg/mL…)
  //   Concentração não informa dose total — omitir, mostrar só qty.
  // ══════════════════════════════════════════════════════════════════
  if (isConcentration) {
    return qtyStr || doseRaw;
  }

  // ══════════════════════════════════════════════════════════════════
  // CASO C — Dose é VOLUME PURO em mL
  //   C1. Prescrito em mL → usar volume prescrito (ex: 20 mL)
  //   C2. Prescrito em unidades → qty + volume por unidade (ex: 1 AMP (10mL))
  // ══════════════════════════════════════════════════════════════════
  if (isPureMlVolume) {
    if (isVolumeUnit) {
      // Prescrito em mL: usar qtyStr ("20 mL") em vez do dose da ampola
      // Se qty é o padrão '1' e doseRaw traz o volume real (ex: '100mL', '500mL'),
      // o médico não editou a quantidade — usar doseRaw para evitar exibir "1 mL"
      if (qty === '1' && doseRaw) return doseRaw;
      return qtyStr || doseRaw;
    }
    if (isUnitUnit && qtyStr) {
      // Prescrito em amp/FA → mostrar volume TOTAL quando qty > 1.
      // Bug crítico: "2 amp (2 mL)" exibia o volume UNITÁRIO da ampola, levando a
      // enfermagem a administrar metade da dose. Agora multiplica pela quantidade.
      const qtyNum = parseFloat((item.quantity || '').replace(',', '.'));
      const volUnit = parseFloat(doseRaw.replace(',', '.'));
      const hasMl = /m[lL]\b/.test(doseRaw);
      if (qtyNum > 1 && volUnit > 0 && hasMl) {
        const total = qtyNum * volUnit;
        const totalStr = Number.isInteger(total) ? String(total) : String(total).replace('.', ',');
        return `${qtyStr} (total ${totalStr} mL)`;
      }
      return `${qtyStr} (${doseRaw})`; // qty = 1 → volume unitário é o total
    }
    return doseRaw;
  }

  // ══════════════════════════════════════════════════════════════════
  // CASO D — Dose TERAPÊUTICA com massa (mg, mcg, UI…)
  //   D1. Prescrito em mL → só o volume, igual ao CASO A (mg/g)
  //   D2. Prescrito em unidade → "1 AMP (500mcg)" (qty na frente)
  //   D3. Prescrito em massa igual à dose → dose sozinha
  // ══════════════════════════════════════════════════════════════════
  if (isMassDose) {
    if (isVolumeUnit && qtyStr) {
      // Padronizado com o CASO A (mg/g): ao prescrever em mL, o volume já É
      // a informação relevante — anexar a dose por-unidade do catálogo
      // ("4 mL (1g (2mL))") ficava redundante e, pior, podia informar massa
      // ERRADA quando o mL prescrito não bate com o volume unitário do
      // catálogo (4 mL prescritos ≠ 1g se a referência é "1g por 2mL").
      return qtyStr;
    }
    if (isUnitUnit && qtyStr) {
      // Escala a dose com a quantidade — mesmo princípio já aplicado ao volume
      // puro em mL (CASO C): "2 AMP (1g)" sem multiplicar sugeria a dose
      // UNITÁRIA da ampola como se fosse o total, risco de subdosagem visual
      // na leitura da enfermagem. Agora soma quando dá para calcular.
      const qtyNum = parseFloat((item.quantity || '').replace(',', '.'));
      if (qtyNum > 1 && doseAmountMatch) {
        const perUnitAmount = parseFloat(doseAmountMatch[1].replace(',', '.'));
        const massUnit = doseAmountMatch[2];
        if (!isNaN(perUnitAmount) && perUnitAmount > 0) {
          const totalMass = perUnitAmount * qtyNum;
          const totalMassStr = Number.isInteger(totalMass) ? String(totalMass) : String(totalMass).replace('.', ',');
          // Volume embutido na dose (ex.: "1g (2mL)") também escala, se houver.
          const mlMatch = doseRaw.match(/(\d[\d.,]*)\s*m[lL]\b/i);
          let totalVolPart = '';
          if (mlMatch) {
            const perUnitVol = parseFloat(mlMatch[1].replace(',', '.'));
            if (!isNaN(perUnitVol) && perUnitVol > 0) {
              const totalVol = perUnitVol * qtyNum;
              const totalVolStr = Number.isInteger(totalVol) ? String(totalVol) : String(totalVol).replace('.', ',');
              totalVolPart = ` / ${totalVolStr}mL`;
            }
          }
          return `${qtyStr} (total ${totalMassStr}${massUnit}${totalVolPart})`;
        }
      }
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
      const qtyInDose  = norm(doseRaw).includes(norm(qtyStr));
      const doseIsQty  = norm(qtyStr) === norm(doseRaw);
      if (!qtyInDose && !doseIsQty) {
        // "1g (2mL)" já traz parênteses próprios — envolver de novo criava
        // "1 AMP (1g (2mL))" (parênteses duplicados). Junta sem embrulhar.
        if (/\(/.test(doseRaw)) return `${qtyStr} ${doseRaw}`;
        return `${qtyStr} (${doseRaw})`; // "1 AMP (500mcg)"
      }
    }
    // qty já está na dose, ou dose = qty → mostrar dose
    return doseRaw;
  }

  // ══════════════════════════════════════════════════════════════════
  // CASO E — Dose com mL embutido (ex: "Bolus 150 mL", "SF 0,9% 100 mL")
  // ══════════════════════════════════════════════════════════════════
  if (doseRaw && /\d+(?:[.,]\d+)?\s*m[lL]\b/i.test(doseRaw)) {
    if (qtyStr && !isVolumeUnit) return `${qtyStr} (${doseRaw})`;
    return doseRaw;
  }

  // ══════════════════════════════════════════════════════════════════
  // FALLBACK — qty ou dose bruto
  // ══════════════════════════════════════════════════════════════════
  return qtyStr || doseRaw;
}

// ════════════════════════════════════════════════════════════════════════
// PREP SEGMENTS — fonte única do detalhamento de preparo/infusão no impresso
// ════════════════════════════════════════════════════════════════════════
// Unificado em 21/07/2026 (pedido do gestor: impresso principal e extra devem
// ter o MESMO detalhamento). Antes, PrescricaoPage.buildPrepSegments e a
// montagem inline de printExtraPrescription divergiam em 4 pontos:
//   1. espaçamento de unidade ("250mL" vs "250 mL")
//   2. volume total omitido na principal quando == diluente (esconde dado de
//      segurança em BIC — agora SEMPRE mostra)
//   3. formato de reconstituição ("1 FA em 10mL AD" vs "AD 10 mL →")
//   4. inferência de BIC (extra não inferia; agora ambos inferem)
// Unificado pelo comportamento mais COMPLETO/SEGURO clinicamente.

export interface PrepFields {
  category?: string;
  route?: string;
  diluent?: string;
  diluentVolume?: string;
  volumeTotal?: string;
  quantity?: string;
  accessType?: string;
  concentration?: string;
  posology?: string;
  infusionMode?: string;
  infusionTime?: string;
  infusionTimeUnit?: string;
  infusionRate?: string;
  ivBolus?: boolean;
  reconstitutionSolvent?: string;
  reconstitutionVolume?: string;
}

export const isIVRoute = (route?: string): boolean => {
  const n = (route || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /(intravenosa|endovenosa|\bev\b|\biv\b)/.test(n);
};

export function isContinuousInfusionShared(item: PrepFields): boolean {
  if (item.ivBolus) return false;
  if (!isIVRoute(item.route || '')) return false;
  const hasDiluent = !!(item.diluent && item.diluent !== 'sem_diluente' && item.diluent !== '-');
  return (
    /cont[ií]nu/i.test(item.posology || '') ||
    item.infusionMode === 'BIC' ||
    (!item.infusionMode && hasDiluent)
  );
}

/**
 * Monta os segmentos de preparo/infusão do item para o impresso.
 * head = reconstituição, diluente, volume (vêm ANTES da via na linha).
 * tail = modo (BIC/Bolus), tempo, vazão (vêm DEPOIS da posologia).
 * Usado por AMBOS os impressos (principal e extra) — fonte única.
 */
export function buildPrepSegments(item: PrepFields): { head: string[]; tail: string[] } {
  const head: string[] = [];
  const tail: string[] = [];

  if (item.category === 'inhalation' || item.category === 'nutrition') {
    return { head, tail };
  }

  // ── HEAD ──
  // Reconstituição (pó liofilizado) — formato unificado: preserva o nº de FA
  // (dado real de preparo, vinha da principal) no layout da extra (com seta).
  if (item.reconstitutionSolvent && item.reconstitutionVolume) {
    const solvent = item.reconstitutionSolvent.replace(/\bABD\b/gi, 'AD');
    const qtyFA = item.quantity?.trim() && item.quantity.trim() !== '0' ? item.quantity.trim() : '1';
    head.push(`Reconstituir: ${qtyFA} FA em ${solvent} ${item.reconstitutionVolume} mL →`);
  }

  // Diluente — ou "Sem diluente" explícito
  const hasDiluent = !!(item.diluent && item.diluent !== 'sem_diluente' && item.diluent !== '-');
  if (hasDiluent) {
    const dilLabel = item.diluent === 'diluente_proprio' ? 'Diluente próprio' : item.diluent;
    head.push(item.diluentVolume ? `Dil.: ${dilLabel} ${item.diluentVolume} mL` : `Dil.: ${dilLabel}`);
  } else if (item.diluent === 'sem_diluente') {
    head.push('Sem diluente');
  }

  // Volume total — SEMPRE mostra quando preenchido (dado de segurança em BIC:
  // define concentração e confere a vazão). Não esconde mais por "redundância".
  if (item.volumeTotal) {
    const volTotalNum = parseFloat(item.volumeTotal.replace(',', '.'));
    if (volTotalNum > 0) head.push(`Vol.: ${item.volumeTotal} mL`);
  }

  // ── TAIL ──
  const isIV = isIVRoute(item.route || '');
  // Modo de infusão — Bolus/BIC só fazem sentido em via intravenosa.
  if (item.ivBolus && isIV) {
    tail.push('Bolus');
  } else if (isContinuousInfusionShared(item)) {
    tail.push('BIC');
  }

  // Tempo / Vazão — mL/h ou gts/min
  if (!item.ivBolus && (item.infusionTime || item.infusionRate)) {
    const unit = item.infusionTimeUnit === 'h' ? 'h' : 'min';
    const modeLabel = item.infusionMode === 'gts' ? 'gts/min' : 'mL/h';
    if (item.infusionTime) tail.push(`Correr em: ${item.infusionTime}${unit}`);
    if (item.infusionRate) {
      // Vazão digitada pelo médico tem prioridade.
      tail.push(`Vazão: ${item.infusionRate} ${modeLabel}`);
    } else if (item.volumeTotal && item.infusionTime) {
      // Sem vazão digitada mas com volume + tempo → CALCULA (mL/h, e gts/min
      // quando modo gotejamento). Antes esse cálculo só existia na tela
      // compacta; unificado no impresso em 21/07/2026 para tela e papel
      // mostrarem a mesma programação de bomba (confere a enfermagem).
      const vol = parseFloat((item.volumeTotal || '').replace(',', '.'));
      const timeRaw = parseFloat((item.infusionTime || '').replace(',', '.'));
      const timeMin = item.infusionTimeUnit === 'h' ? timeRaw * 60 : timeRaw;
      if (vol > 0 && timeMin > 0) {
        const mlh = (vol / (timeMin / 60)).toFixed(1).replace(/\.0$/, '');
        if (item.infusionMode === 'gts') {
          const gts = roundGtsToHospitalShared((vol * DRIP_FACTOR_MACRO) / timeMin);
          tail.push(`Vazão: ${mlh} mL/h · ${gts} gts/min`);
        } else {
          tail.push(`Vazão: ${mlh} mL/h`);
        }
      }
    }
  } else if (isContinuousInfusionShared(item) && !item.infusionRate && !item.infusionTime) {
    tail.push('Vazão: conforme protocolo');
  }

  return { head, tail };
}

// ── Gotejamento — FONTE ÚNICA (fator + arredondamento) ─────────────────────
// Unificado 21/07/2026 (auditoria do gestor): o fator 20 gts/mL estava
// hardcoded em 5+ lugares e o arredondamento hospitalar existia DUPLICADO
// (PrescricaoPage + aqui) — e a hidratação calculava gotas SEM arredondar,
// mostrando um número diferente do de medicação para o mesmo volume/tempo
// (ex.: 500 mL em 2 h → hidratação "83", medicação "84").
export const DRIP_FACTOR_MACRO = 20; // macrogotas/mL (equipo macro padrão)

/**
 * parseFloat tolerante à vírgula decimal brasileira. parseFloat("2,5") = 2
 * (TRUNCA silenciosamente na vírgula) — em cálculo clínico isso transforma
 * 2,5 h em 2 h sem nenhum erro. Fonte única para todo parse de campo
 * numérico digitável (volume, tempo, vazão, peso). Retorna NaN p/ vazio.
 */
export function parseDecimalBR(v?: string | number | null): number {
  if (typeof v === 'number') return v;
  if (!v) return NaN;
  return parseFloat(String(v).trim().replace(',', '.'));
}

/** Arredonda gts/min para valores práticos de equipo macro (múltiplos de 7). */
export function roundGtsToHospital(gts: number): number {
  if (gts <= 0) return 0;
  if (gts < 5) return Math.round(gts);
  return Math.round(gts / 7) * 7 || 7;
}
const roundGtsToHospitalShared = roundGtsToHospital;
