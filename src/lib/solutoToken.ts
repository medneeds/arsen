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

  // 3. Dose terapêutica com unidade de massa/atividade
  const isMassDose = !!doseRaw && !isConcentration && !isPureMlVolume &&
    /(\bmg\b|\bmcg\b|µg|ug|\bg\b|\bui\b|u\/|unidades?|\bmeq\b|\bmmol\b|%)/i.test(doseRaw);

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
  //   D1. Prescrito em mL → "20 mL (200mg)" (volume prescrito + dose)
  //   D2. Prescrito em unidade → "1 AMP (500mcg)" (qty na frente)
  //   D3. Prescrito em massa igual à dose → dose sozinha
  // ══════════════════════════════════════════════════════════════════
  if (isMassDose) {
    if (isVolumeUnit && qtyStr) {
      // Ex: 20 mL de Propofol 10mg/mL → "20 mL (200mg)"
      return `${qtyStr} (${doseRaw})`;
    }
    if (isUnitUnit && qtyStr) {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
      const qtyInDose  = norm(doseRaw).includes(norm(qtyStr));
      const doseIsQty  = norm(qtyStr) === norm(doseRaw);
      if (!qtyInDose && !doseIsQty) {
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
