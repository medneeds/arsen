/**
 * Balanco hidrico 24h (07:00 -> 07:00, America/Fortaleza) — fonte UNICA da tela de BH,
 * da nutricao (volume infundido), do painel do enfermeiro, do PDF ENF-BH e do SBAR.
 * Puro: sem Supabase.
 *
 * computeInfusedEnteral e a MESMA funcao na nutricao e no BH: resolve a divergencia
 * entre "volume infundido" calculado em cada tela de um jeito.
 */
import { fortalezaLocal, fortalezaParts } from "./docPrefixes.ts";

export type Sentido = "ganho" | "perda";

export interface Lancamento {
  dataHora: Date;
  sentido: Sentido;
  categoria: string;
  volumeMl: number;
  origem: "manual" | "administracao" | "dieta" | "dispositivo" | string;
  /** Lancamento anulado (correcao): nao entra no total. */
  anulado?: boolean;
}

export interface Periodo { start: Date; end: Date }

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Periodo do BH que contem `ref`: 07:00 do dia ate 07:00 do dia seguinte. */
export function periodoBH(ref: Date): Periodo {
  const p = fortalezaParts(ref);
  const seteHoje = fortalezaLocal(p.year, p.month, p.day, 7, 0);
  const start = p.hour >= 7 ? seteHoje : new Date(seteHoje.getTime() - DAY_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export interface HourRow { hora: number; inicio: Date; ganhos: number; perdas: number; saldo: number }

export interface Alerta { tipo: "oliguria" | "sem_peso"; mensagem: string }

export interface FluidBalanceOptions {
  pesoKg?: number | null;
  incluirInsensiveis: boolean;
  /** Horas com temperatura > 37,5 °C no periodo (acrescimo nas insensiveis). */
  horasFebre?: number;
  /** Graus acima de 37,5 (media nas horas de febre). Padrao 1. */
  grausAcima?: number;
  /** mL/kg/24h basal das perdas insensiveis (configuravel por hospital). Padrao 10. */
  insensivelMlKgDia?: number;
  /** Instante de calculo (diurese mL/kg/h usa as horas decorridas). Padrao: fim do periodo. */
  agora?: Date;
}

export interface FluidBalanceResult {
  porHora: HourRow[];
  parciais: { t07_13: number; t13_19: number; t19_07: number };
  ganhos: number;
  perdas: number;
  insensiveis: number | null;
  balanco: number;
  porCategoria: Record<string, number>;
  diureseMl: number;
  diureseMlKgH: number | null;
  alertas: Alerta[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeFluidBalance(
  lancamentos: Lancamento[],
  periodo: Periodo,
  opts: FluidBalanceOptions,
): FluidBalanceResult {
  const validos = lancamentos.filter(
    (l) => !l.anulado && Number.isFinite(l.volumeMl) && l.volumeMl > 0
      && l.dataHora.getTime() >= periodo.start.getTime() && l.dataHora.getTime() < periodo.end.getTime(),
  );

  const porHora: HourRow[] = Array.from({ length: 24 }, (_, i) => {
    const inicio = new Date(periodo.start.getTime() + i * HOUR_MS);
    return { hora: (7 + i) % 24, inicio, ganhos: 0, perdas: 0, saldo: 0 };
  });
  const porCategoria: Record<string, number> = {};
  let ganhos = 0;
  let perdas = 0;
  let diureseMl = 0;
  const diurese_por_hora = new Array<number>(24).fill(0);

  for (const l of validos) {
    const idx = Math.min(23, Math.floor((l.dataHora.getTime() - periodo.start.getTime()) / HOUR_MS));
    const row = porHora[idx];
    const chave = `${l.sentido}:${l.categoria}`;
    porCategoria[chave] = round1((porCategoria[chave] ?? 0) + l.volumeMl);
    if (l.sentido === "ganho") { row.ganhos += l.volumeMl; ganhos += l.volumeMl; }
    else {
      row.perdas += l.volumeMl; perdas += l.volumeMl;
      if (l.categoria === "diurese") { diureseMl += l.volumeMl; diurese_por_hora[idx] += l.volumeMl; }
    }
  }
  porHora.forEach((r) => { r.ganhos = round1(r.ganhos); r.perdas = round1(r.perdas); r.saldo = round1(r.ganhos - r.perdas); });

  const soma = (de: number, ate: number) => round1(porHora.slice(de, ate).reduce((s, r) => s + r.saldo, 0));
  const parciais = { t07_13: soma(0, 6), t13_19: soma(6, 12), t19_07: soma(12, 24) };

  const alertas: Alerta[] = [];
  const peso = opts.pesoKg != null && opts.pesoKg > 0 ? opts.pesoKg : null;

  let insensiveis: number | null = null;
  if (opts.incluirInsensiveis) {
    if (peso == null) {
      alertas.push({ tipo: "sem_peso", mensagem: "Peso não registrado — perdas insensíveis não calculadas" });
    } else {
      const basal = (opts.insensivelMlKgDia ?? 10) * peso;
      const febre = (opts.horasFebre ?? 0) > 0 ? basal * 0.1 * (opts.grausAcima ?? 1) * ((opts.horasFebre ?? 0) / 24) : 0;
      insensiveis = round1(basal + febre);
    }
  }

  const agora = opts.agora && opts.agora.getTime() < periodo.end.getTime() ? opts.agora : periodo.end;
  const horasDecorridas = Math.max(0, (agora.getTime() - periodo.start.getTime()) / HOUR_MS);
  let diureseMlKgH: number | null = null;
  if (peso == null) {
    if (!opts.incluirInsensiveis) alertas.push({ tipo: "sem_peso", mensagem: "Peso não registrado — diurese em mL/kg/h indisponível" });
  } else if (horasDecorridas > 0) {
    diureseMlKgH = Math.round((diureseMl / peso / horasDecorridas) * 100) / 100;
    // Oliguria: < 0,5 mL/kg/h nas ultimas 6h completas.
    const horasCompletas = Math.floor(horasDecorridas);
    if (horasCompletas >= 6) {
      const ult6 = diurese_por_hora.slice(horasCompletas - 6, horasCompletas).reduce((s, v) => s + v, 0);
      const taxa = ult6 / peso / 6;
      if (taxa < 0.5) {
        alertas.push({ tipo: "oliguria", mensagem: `Diurese ${(Math.round(taxa * 100) / 100).toString().replace(".", ",")} mL/kg/h nas últimas 6h (peso ${peso} kg)` });
      }
    }
  }

  const balanco = round1(ganhos - perdas - (insensiveis ?? 0));
  return {
    porHora, parciais, ganhos: round1(ganhos), perdas: round1(perdas), insensiveis, balanco,
    porCategoria, diureseMl: round1(diureseMl), diureseMlKgH, alertas,
  };
}

/**
 * Volume enteral infundido: vazao x horas efetivas (fim - inicio - pausas).
 * Pausas fora do intervalo sao recortadas; pausas sobrepostas nao contam duas vezes.
 */
export function computeInfusedEnteral(
  vazaoMlH: number,
  inicio: Date,
  fim: Date,
  pausas: { inicio: Date; fim: Date }[],
): number {
  if (!Number.isFinite(vazaoMlH) || vazaoMlH <= 0) return 0;
  const a = inicio.getTime();
  const b = fim.getTime();
  if (b <= a) return 0;
  const cortadas = pausas
    .map((p) => [Math.max(a, p.inicio.getTime()), Math.min(b, p.fim.getTime())] as [number, number])
    .filter(([x, y]) => y > x)
    .sort((p, q) => p[0] - q[0]);
  let pausado = 0;
  let curS = -1;
  let curE = -1;
  for (const [x, y] of cortadas) {
    if (x > curE) { if (curE > curS) pausado += curE - curS; curS = x; curE = y; }
    else curE = Math.max(curE, y);
  }
  if (curE > curS) pausado += curE - curS;
  const horas = (b - a - pausado) / HOUR_MS;
  return round1(vazaoMlH * horas);
}

// ── Categorias (dado unico: tela, PDF ENF-BH, fechamento) ───────────────────
export interface CategoriaBH { key: string; label: string; sentido: Sentido }

export const BH_CATEGORIAS: readonly CategoriaBH[] = [
  { key: "ev_continuo", label: "EV contínuo", sentido: "ganho" },
  { key: "ev_intermitente", label: "EV intermitente", sentido: "ganho" },
  { key: "diluente", label: "Diluente de medicação", sentido: "ganho" },
  { key: "dieta_enteral", label: "Dieta enteral", sentido: "ganho" },
  { key: "oral", label: "Via oral", sentido: "ganho" },
  { key: "agua_enteral", label: "Água por sonda/ostomia", sentido: "ganho" },
  { key: "hemoderivado", label: "Hemoderivado", sentido: "ganho" },
  { key: "diurese", label: "Diurese", sentido: "perda" },
  { key: "dreno", label: "Dreno", sentido: "perda" },
  { key: "sng_aberta", label: "SNG aberta", sentido: "perda" },
  { key: "evacuacao", label: "Evacuação", sentido: "perda" },
  { key: "vomito", label: "Vômito", sentido: "perda" },
  { key: "sangramento", label: "Sangramento", sentido: "perda" },
  { key: "dialise", label: "Diálise (UF)", sentido: "perda" },
];

export function categoriaLabel(key: string): string {
  return BH_CATEGORIAS.find((c) => c.key === key)?.label ?? key;
}

/** "-150 mL" / "+1.200 mL" com sinal e milhar pt-BR. */
export function formatMl(v: number, comSinal = false): string {
  const n = Math.round(v * 10) / 10;
  const txt = Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (!comSinal) return `${n < 0 ? "-" : ""}${txt} mL`;
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${txt} mL`;
}
