/**
 * Lista de medicamentos que NÃO devem ser triturados/abertos para administração
 * via sonda enteral. Baseada em ISMP-Brasil "Lista de medicamentos potencialmente
 * inapropriados para serem triturados ou abertos" + bula RENAME.
 *
 * Match por NFD-normalize (sem acentos, lowercase) — checa se algum termo está
 * contido no nome do medicamento.
 */

export interface NotCrushableEntry {
  /** Termo a procurar no nome (NFD lower). Pode ser substring. */
  match: string;
  /** Razão didática mostrada ao usuário. */
  reason: string;
  /** Categoria visual do alerta. */
  kind: 'liberacao_modificada' | 'reves_enterico' | 'sublingual' | 'citotoxico' | 'irritante' | 'capsula_gel' | 'outros';
  /** Sugestão de manejo (substituição quando possível). */
  alternative?: string;
}

export const NOT_CRUSHABLE: NotCrushableEntry[] = [
  // Liberação modificada / SR / XR / CD / CR / LA / retard
  { match: ' sr', reason: 'Liberação prolongada (SR) — triturar libera dose imediata e pode causar pico tóxico.', kind: 'liberacao_modificada', alternative: 'Trocar por apresentação de liberação imediata equivalente.' },
  { match: ' xr', reason: 'Liberação prolongada (XR) — não triturar.', kind: 'liberacao_modificada' },
  { match: ' cr', reason: 'Liberação controlada (CR) — não triturar.', kind: 'liberacao_modificada' },
  { match: ' la', reason: 'Long-acting — não triturar.', kind: 'liberacao_modificada' },
  { match: 'retard', reason: 'Liberação retardada — triturar gera pico de absorção.', kind: 'liberacao_modificada' },
  { match: 'cd', reason: 'Liberação prolongada (CD) — não triturar.', kind: 'liberacao_modificada' },
  { match: 'oros', reason: 'Sistema OROS — não triturar nem partir.', kind: 'liberacao_modificada' },

  // Revestimento entérico
  { match: 'enterica', reason: 'Revestimento entérico — proteção contra suco gástrico será destruída.', kind: 'reves_enterico' },
  { match: 'enterico', reason: 'Revestimento entérico — não triturar.', kind: 'reves_enterico' },
  { match: 'aas 100', reason: 'AAS revestido — risco de irritação gástrica se triturado.', kind: 'reves_enterico', alternative: 'AAS macerável ou dispersível.' },
  { match: 'omeprazol', reason: 'Cápsula com microgrânulos gastrorresistentes. NÃO triturar; pode abrir cápsula e dispersar grânulos em suco de laranja/maçã (pH ácido) sem mastigar.', kind: 'capsula_gel', alternative: 'Esomeprazol/Pantoprazol IV se via enteral inviável.' },
  { match: 'pantoprazol', reason: 'Comprimido gastrorresistente. NÃO triturar.', kind: 'reves_enterico', alternative: 'Pantoprazol IV.' },
  { match: 'lansoprazol', reason: 'Cápsula com microgrânulos gastrorresistentes — abrir e dispersar sem triturar grânulos.', kind: 'capsula_gel' },
  { match: 'esomeprazol', reason: 'Comprimido gastrorresistente — não triturar.', kind: 'reves_enterico' },

  // Cápsula gelatinosa líquida
  { match: 'nimodipino cap', reason: 'Cápsula líquida — aspirar conteúdo com seringa e administrar.', kind: 'capsula_gel' },
  { match: 'voriconazol', reason: 'Comprimido revestido — não triturar. Existe suspensão oral.', kind: 'reves_enterico', alternative: 'Voriconazol suspensão oral 40 mg/mL.' },
  { match: 'isotretinoina', reason: 'Cápsula gelatinosa fotossensível — não abrir.', kind: 'capsula_gel' },

  // Sublingual / bucal
  { match: 'sublingual', reason: 'Sublingual — perde efeito se triturada e administrada por sonda.', kind: 'sublingual' },
  { match: 'isordil', reason: 'Sublingual — não triturar.', kind: 'sublingual' },

  // Citotóxicos / hormônios
  { match: 'metotrexato', reason: 'Citotóxico — risco ocupacional. NÃO triturar.', kind: 'citotoxico' },
  { match: 'finasterida', reason: 'Risco teratogênico — não manipular se gestante.', kind: 'citotoxico' },
  { match: 'dutasterida', reason: 'Cápsula — risco teratogênico se rompida.', kind: 'capsula_gel' },

  // Irritantes
  { match: 'bisacodil', reason: 'Comprimido revestido entérico — triturar causa irritação gástrica.', kind: 'reves_enterico' },
  { match: 'sulfato ferroso revest', reason: 'Revestido — pode irritar mucosa se triturado.', kind: 'reves_enterico' },

  // ATBs específicos
  { match: 'cefuroxima axetila', reason: 'Comprimido revestido — triturar resulta em sabor amargo e absorção errática.', kind: 'reves_enterico', alternative: 'Cefuroxima suspensão oral.' },
  { match: 'eritromicina', reason: 'Revestido entérico — não triturar.', kind: 'reves_enterico', alternative: 'Eritromicina suspensão oral.' },
  { match: 'doxiciclina cap', reason: 'Cápsula — pode abrir e dispersar (não triturar). Risco de erosão esofágica.', kind: 'capsula_gel' },
  { match: 'azitromicina compr', reason: 'Comprimido revestido — preferir suspensão.', kind: 'reves_enterico', alternative: 'Azitromicina suspensão oral 200 mg/5 mL.' },
  { match: 'claritromicina', reason: 'Comprimido revestido — sabor extremamente amargo se triturado.', kind: 'reves_enterico', alternative: 'Claritromicina suspensão oral.' },
  { match: 'nitrofurantoina cap', reason: 'Cápsula com macrocristais — não triturar.', kind: 'capsula_gel' },
];

/** NFD-normalize helper. */
function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Detecta se o medicamento NÃO pode ser triturado. Retorna o entry encontrado. */
export function findNotCrushable(name: string, presentation?: string): NotCrushableEntry | null {
  const haystack = `${norm(name)} ${norm(presentation || '')}`;
  for (const entry of NOT_CRUSHABLE) {
    if (haystack.includes(entry.match)) return entry;
  }
  return null;
}

/** Heurística: presentação é comprimido/cápsula? */
export function isTabletOrCapsule(presentation?: string): boolean {
  const p = norm(presentation || '');
  return /\b(comp|comprimido|cp|capsula|drag|drage)\b/.test(p);
}

/** Heurística: via é enteral/sonda? */
export function isEnteralRoute(route?: string): boolean {
  const r = norm(route || '');
  return /enteral|sng|sne|gtt|sonda|nasoenter|nasogastr|gastrostom|jejunost/.test(r);
}
