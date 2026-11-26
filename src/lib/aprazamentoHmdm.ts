/**
 * Aprazamento HMDM — grade institucional (Anexo A da especificacao) como DADO,
 * mais as regras de escolha aprovadas pelo PO. Puro: sem Supabase, testavel via tsx.
 *
 * Regras:
 *  1. Horario escrito na prescricao (item.schedule, ex. "06h, 18h") PREVALECE.
 *  2. Antibiotico NOVO: 1a dose imediata; as seguintes na grade padronizada
 *     (nao se ancora na hora da 1a dose).
 *  3. Intercalar antitermicos, analgesicos, antibioticos e antiemeticos.
 *  4. Evitar 07h e 19h (troca de plantao) quando houver opcao equivalente.
 *  5. Escolha automatica = menor custo: choque*1000 + desvio do intervalo da
 *     1a dose do ATB novo*10 + troca de plantao*1. Empate: ordem da grade.
 *  6. "Livre" exige no de doses compativel e espacamento minimo (tolerancia 1h).
 *  7. Item suspenso: horarios futuros saem; os ja passados permanecem.
 */
import { hasPRN, stripPRN } from "./prescriptionIntervals.ts";
import { windowHourToDate, type ValidityWindow } from "./prescriptionValidity.ts";

export interface GradeOption { key: string; label: string; hours: number[] }

/** Anexo A — Grade de aprazamento HMDM. Ordem = preferencia em caso de empate. */
export const HMDM_GRID: Readonly<Record<string, readonly GradeOption[]>> = Object.freeze({
  "4/4h": [
    { key: "4/4h:padrao", label: "Padrão", hours: [18, 22, 2, 6, 10, 14] },
    { key: "4/4h:alt1", label: "Alt 1", hours: [16, 20, 0, 4, 8, 12] },
    { key: "4/4h:alt2", label: "Alt 2", hours: [10, 14, 18, 22, 2, 6] },
  ],
  "6/6h": [
    { key: "6/6h:padrao", label: "Padrão", hours: [18, 0, 6, 12] },
    { key: "6/6h:alt1", label: "Alt 1", hours: [21, 3, 9, 15] },
    { key: "6/6h:alt2", label: "Alt 2", hours: [16, 22, 4, 10] },
    { key: "6/6h:alt3", label: "Alt 3", hours: [17, 23, 5, 11] },
  ],
  "8/8h": [
    { key: "8/8h:padrao", label: "Padrão", hours: [14, 22, 6] },
    { key: "8/8h:alt1", label: "Alt 1", hours: [20, 4, 12] },
    { key: "8/8h:alt2", label: "Alt 2", hours: [22, 6, 14] },
    { key: "8/8h:alt3", label: "Alt 3", hours: [17, 1, 9] },
  ],
  "12/12h": [
    { key: "12/12h:padrao", label: "Padrão", hours: [18, 6] },
    { key: "12/12h:alt1", label: "Alt 1", hours: [16, 4] },
    { key: "12/12h:alt2", label: "Alt 2", hours: [17, 5] },
  ],
  "24/24h": [
    { key: "24/24h:padrao", label: "Padrão", hours: [16] },
    { key: "24/24h:alt1", label: "Alt 1", hours: [21] },
    { key: "24/24h:alt2", label: "Alt 2", hours: [6] },
  ],
});

/** Classes que se intercalam (regra 3). */
export const CLASSES_INTERCALADAS = ["antitermico", "analgesico", "antibiotico", "antiemetico"] as const;
export type ClasseFarmaco = (typeof CLASSES_INTERCALADAS)[number] | "outro";

export const SHIFT_CHANGE_HOURS: readonly number[] = [7, 19];

// ─── Frequencia ─────────────────────────────────────────────────────────────

export type Frequencia =
  | { tipo: "intervalo"; horas: number; sn: boolean }   // 6/6h, 8/8h (+ S/N)
  | { tipo: "vezes_dia"; vezes: number; sn: boolean }   // 2x/dia
  | { tipo: "espacado"; dias: number }                   // 48/48h, 72/72h, 1x/semana
  | { tipo: "continuo" }
  | { tipo: "agora" }
  | { tipo: "dose_unica" }
  | { tipo: "sn" }                                        // S/N puro
  | { tipo: "acm" }
  | { tipo: "desconhecida"; bruto: string };

export function parseFrequencia(posology: string | null | undefined): Frequencia {
  const raw = (posology ?? "").trim();
  const sn = hasPRN(raw);
  const base = stripPRN(raw).trim();
  const low = base.toLowerCase();
  if (!base) return sn ? { tipo: "sn" } : { tipo: "desconhecida", bruto: raw };
  if (low === "acm") return { tipo: "acm" };
  // Formatos reais da prescricao (banco de teste, 57 mil itens): "Contínuo",
  // "contínuo", "Contínua (BIC)"; "SOS"; "Conforme glicemia capilar",
  // "Conforme necessidade/demanda"; "Antes/após dieta e medicações"; "-".
  if (/^cont[ií]nu/.test(low)) return { tipo: "continuo" };
  if (low === "sos" || low.startsWith("conforme") || low.startsWith("antes/") || low.startsWith("se necess")) return { tipo: "sn" };
  if (low === "-") return { tipo: "desconhecida", bruto: raw };
  if (low === "agora") return { tipo: "agora" };
  if (low === "dose única" || low === "dose unica") return { tipo: "dose_unica" };
  if (low === "1x/semana") return { tipo: "espacado", dias: 7 };
  const m = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*h$/.exec(low);
  if (m && m[1] === m[2]) {
    const h = Number(m[1]);
    if (h >= 48) return { tipo: "espacado", dias: h / 24 };
    if (h >= 1 && h <= 24 && 24 % h === 0) return { tipo: "intervalo", horas: h, sn };
  }
  const v = /^(\d)\s*x\s*\/\s*dia$/.exec(low);
  if (v) return { tipo: "vezes_dia", vezes: Number(v[1]), sn };
  return { tipo: "desconhecida", bruto: raw };
}

/** Intervalo equivalente em horas (x/dia -> 24/x); null quando nao se apraza. */
export function intervaloHoras(f: Frequencia): number | null {
  if (f.tipo === "intervalo") return f.horas;
  if (f.tipo === "vezes_dia" && f.vezes > 0 && 24 % f.vezes === 0) return 24 / f.vezes;
  if (f.tipo === "espacado") return 24;
  return null;
}

/** Doses esperadas na janela de 24h. */
export function dosesNaJanela(f: Frequencia): number {
  if (f.tipo === "intervalo") return 24 / f.horas;
  if (f.tipo === "vezes_dia") return f.vezes;
  if (f.tipo === "espacado" || f.tipo === "agora" || f.tipo === "dose_unica") return 1;
  return 0;
}

/** Opcoes da grade para a frequencia (calculadas quando fora do Anexo A, ex. 2/2h). */
export function gradeOptions(f: Frequencia): GradeOption[] {
  const ih = intervaloHoras(f);
  if (ih == null) return [];
  const key = `${ih}/${ih}h`;
  const fromGrid = HMDM_GRID[key];
  if (fromGrid) return fromGrid.map((o) => ({ ...o, hours: [...o.hours] }));
  const n = 24 / ih;
  return [{ key: `${key}:calculado`, label: "Calculado", hours: Array.from({ length: n }, (_, i) => (12 + i * ih) % 24) }];
}

/** Le "06h, 18h" / "6h-18h" / "06:00, 18:00" -> [6, 18]. Vazio/invalido -> []. */
export function parseScheduleHours(schedule: string | null | undefined): number[] {
  const s = (schedule ?? "").trim();
  if (!s) return [];
  const out: number[] = [];
  for (const m of s.matchAll(/(\d{1,2})(?::(\d{2}))?\s*h?/gi)) {
    const h = Number(m[1]);
    if (h >= 0 && h <= 24) out.push(h % 24);
  }
  return [...new Set(out)];
}

// ─── Sugestao ───────────────────────────────────────────────────────────────

export interface ScheduleInput {
  /** Valor de `posology` do item (ex.: "8/8h", "6/6h S/N"). */
  frequencia: string;
  classe?: ClasseFarmaco;
  /** Antibiotico iniciado agora: 1a dose imediata. */
  novoAntibiotico?: boolean;
  /** Horarios escritos na prescricao (item.schedule) — prevalecem. */
  recomendacaoPrescricao?: number[];
  agora: Date;
}

export type ModoAprazamento = "padrao" | "alternativo" | "livre" | "agora" | "sn" | "continuo" | "prescricao";

export interface ScheduleSuggestion {
  modo: ModoAprazamento;
  option: GradeOption | null;
  horarios: Date[];
  motivo: string;
  custo: number;
}

const HOUR_MS = 3_600_000;

function localHour(d: Date, w: ValidityWindow): number {
  return (12 + Math.floor((d.getTime() - w.start.getTime()) / HOUR_MS)) % 24;
}

function sortDates(ds: Date[]): Date[] {
  return [...ds].sort((a, b) => a.getTime() - b.getTime());
}

/** Horarios de uma opcao na janela, a partir de `desde` (inclusive). */
function optionDates(o: GradeOption, w: ValidityWindow, desde: Date): Date[] {
  return sortDates(o.hours.map((h) => windowHourToDate(w, h))).filter(
    (d) => d.getTime() >= desde.getTime() && d.getTime() < w.end.getTime(),
  );
}

export function suggestSchedule(
  input: ScheduleInput,
  w: ValidityWindow,
  ocupados: Map<number, ClasseFarmaco[]> = new Map(),
): ScheduleSuggestion {
  const f = parseFrequencia(input.frequencia);
  const agora = input.agora;
  const desde = agora.getTime() > w.start.getTime() ? agora : w.start;

  if (f.tipo === "continuo") return { modo: "continuo", option: null, horarios: [], motivo: "infusão contínua — sem aprazamento", custo: 0 };
  if (f.tipo === "sn" || f.tipo === "acm") return { modo: "sn", option: null, horarios: [], motivo: f.tipo === "acm" ? "a critério médico" : "se necessário", custo: 0 };
  if (f.tipo === "agora" || f.tipo === "dose_unica") return { modo: "agora", option: null, horarios: [desde], motivo: "dose imediata", custo: 0 };
  if (f.tipo === "desconhecida") return { modo: "livre", option: null, horarios: [], motivo: `frequência não reconhecida ("${f.bruto}") — aprazar manualmente`, custo: 0 };

  // Regra 1: recomendacao escrita na prescricao prevalece.
  if (input.recomendacaoPrescricao && input.recomendacaoPrescricao.length > 0) {
    const opt: GradeOption = { key: "prescricao", label: "Prescrição", hours: [...input.recomendacaoPrescricao] };
    return { modo: "prescricao", option: opt, horarios: optionDates(opt, w, desde), motivo: "horário definido na prescrição", custo: 0 };
  }

  const ih = intervaloHoras(f) ?? 24;
  const intercala = !!input.classe && (CLASSES_INTERCALADAS as readonly string[]).includes(input.classe);
  const candidatos = gradeOptions(f);
  let best: ScheduleSuggestion | null = null;

  candidatos.forEach((opt, idx) => {
    let horarios: Date[];
    let desvio = 0;
    if (input.novoAntibiotico) {
      // Regra 2: 1a dose agora; as seguintes na grade, sem dose colada a 1a.
      const primeira = desde;
      const seguintes = optionDates(opt, w, primeira).filter(
        (d) => d.getTime() - primeira.getTime() >= (ih * HOUR_MS) / 2,
      );
      horarios = [primeira, ...seguintes];
      if (seguintes.length > 0) {
        const gapH = (seguintes[0].getTime() - primeira.getTime()) / HOUR_MS;
        desvio = Math.abs(gapH - ih);
      }
    } else {
      horarios = optionDates(opt, w, desde);
    }
    let choques = 0;
    let trocas = 0;
    const descontarPrimeira = input.novoAntibiotico ? 1 : 0; // dose imediata nao conta choque
    horarios.forEach((d, i) => {
      const h = localHour(d, w);
      if (SHIFT_CHANGE_HOURS.includes(h) && i >= descontarPrimeira) trocas++;
      if (intercala && i >= descontarPrimeira) {
        const occ = ocupados.get(h) ?? [];
        if (occ.some((c) => (CLASSES_INTERCALADAS as readonly string[]).includes(c))) choques++;
      }
    });
    const custo = choques * 1000 + desvio * 10 + trocas;
    const partes: string[] = [];
    if (input.novoAntibiotico) partes.push("1ª dose imediata");
    partes.push(choques === 0 ? (intercala ? "intercalado, sem choque de horário" : "sem choque de horário") : `${choques} choque(s) de horário`);
    const cand: ScheduleSuggestion = {
      modo: idx === 0 ? "padrao" : "alternativo",
      option: opt,
      horarios,
      motivo: `${opt.label}: ${partes.join("; ")}`,
      custo,
    };
    if (!best || cand.custo < best.custo) best = cand;
  });

  return best ?? { modo: "livre", option: null, horarios: [], motivo: "sem opção de grade — aprazar manualmente", custo: 0 };
}

// ─── Livre ──────────────────────────────────────────────────────────────────

export function validateFreeSchedule(
  horarios: Date[],
  frequencia: string,
  w: ValidityWindow,
): { ok: boolean; erros: string[] } {
  const f = parseFrequencia(frequencia);
  const erros: string[] = [];
  const esperado = dosesNaJanela(f);
  const ds = sortDates(horarios);
  if (ds.some((d) => d.getTime() < w.start.getTime() || d.getTime() >= w.end.getTime())) {
    erros.push("há horário fora da vigência da prescrição (12h às 12h)");
  }
  if (esperado > 0 && ds.length !== esperado) {
    erros.push(`a frequência ${frequencia} pede ${esperado} dose(s) na janela; foram informadas ${ds.length}`);
  }
  if (f.tipo === "intervalo") {
    const minimo = f.horas - 1; // tolerancia de 1h
    for (let i = 1; i < ds.length; i++) {
      const gap = (ds[i].getTime() - ds[i - 1].getTime()) / HOUR_MS;
      if (gap < minimo) {
        erros.push(`intervalo de ${gap}h entre doses — mínimo ${minimo}h para ${frequencia}`);
        break;
      }
    }
  }
  return { ok: erros.length === 0, erros };
}

// ─── Suspensao e alta vigilancia ────────────────────────────────────────────

/** Regra 7: na suspensao, so os horarios ainda futuros saem. */
export function splitSuspended(horarios: Date[], suspensoEm: Date): { mantidos: Date[]; riscados: Date[] } {
  const t = suspensoEm.getTime();
  return {
    mantidos: horarios.filter((d) => d.getTime() < t),
    riscados: horarios.filter((d) => d.getTime() >= t),
  };
}

/** MAV: item marcado como alta vigilancia/dupla checagem na prescricao. */
export function requiresDoubleCheck(item: { highAlert?: unknown; doubleCheck?: unknown } | null | undefined): boolean {
  return item?.highAlert === true || item?.doubleCheck === true;
}
