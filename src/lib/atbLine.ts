// ════════════════════════════════════════════════════════════════════════
// GUIA ATB — linha de acompanhamento (fonte única)
// ════════════════════════════════════════════════════════════════════════
// Extraída de PrescricaoPage em 21/07/2026 (auditoria do gestor): o impresso
// principal mostrava "Sítio: X · D3/7 — hoje (início ..., previsão ...)" mas
// o impresso da Prescrição Extra NÃO mostrava NADA do guia ATB — um
// antibiótico adicionado como item extra perdia o dia de terapia e o sítio
// no anexo. Fonte única usada por ambos.

export interface AtbLineFields {
  atbStartDate?: string;   // YYYY-MM-DD
  atbPlannedDays?: string; // ex: "7"
  atbInfectionSite?: string;
}

/** "D3/7 — 21/07/2026 (início 19/07/2026, previsão 25/07/2026)" ou null. */
export function buildAtbDayLine(item: AtbLineFields): string | null {
  if (!item.atbStartDate) return null;
  const start = new Date(item.atbStartDate + 'T00:00:00');
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMid = new Date(start);
  startMid.setHours(0, 0, 0, 0);
  const dayN = Math.max(1, Math.floor((today.getTime() - startMid.getTime()) / 86400000) + 1);
  const days = parseInt(item.atbPlannedDays || '', 10);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  let endStr = '—';
  let suffix = '';
  if (Number.isFinite(days) && days > 0) {
    const end = new Date(startMid);
    end.setDate(end.getDate() + days - 1);
    endStr = fmt(end);
    suffix = `/${days}`;
  }
  return `D${dayN}${suffix} — ${fmt(today)} (início ${fmt(startMid)}, previsão ${endStr})`;
}

/** Partes da linha ATB (sítio + dia de terapia) — vazio quando nada preenchido. */
export function buildAtbLineParts(item: AtbLineFields): string[] {
  return [
    item.atbInfectionSite ? `Sítio: ${item.atbInfectionSite}` : null,
    buildAtbDayLine(item),
  ].filter((p): p is string => !!p);
}
