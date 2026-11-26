/**
 * Ponte prescricao -> aprazamento -> checagem. Puro (sem Supabase), testavel via tsx.
 *
 * Fonte dos itens: a MESMA regra do card de prescricao ativa (useActivePrescription):
 * ultima prescricao nao-rascunho da internacao, itens com status != 'suspended'.
 * Cuidados ('care') e dieta ('nutrition') nao se aprazam aqui (dieta entra na etapa 5).
 *
 * Volume por dose (vai para o BH quando a dose e checada como realizada):
 *   via EV   -> volumeTotal, senao diluentVolume  -> categoria "ev_intermitente"
 *   hidratacao enteral (sonda/ostomia) -> volumeTotal/doseValue -> "agua_enteral"
 *   hidratacao VO -> "oral"
 *   demais vias (VO comprimido, SC, IM, inalatoria) -> sem volume no BH
 */
import {
  intervaloHoras, parseFrequencia, parseScheduleHours, suggestSchedule, validateFreeSchedule,
  type ClasseFarmaco, type Frequencia, type ScheduleSuggestion,
} from "./aprazamentoHmdm.ts";
import { windowHourToDate, type ValidityWindow } from "./prescriptionValidity.ts";
import { fortalezaLocal, fortalezaParts } from "./docPrefixes.ts";

export type TipoAprazamento = "grade" | "sn" | "continuo" | "manual";

export interface ItemAprazavel {
  itemId: string;
  nome: string;
  resumo: string;
  categoria: string;
  posologia: string;
  frequencia: Frequencia;
  tipo: TipoAprazamento;
  classe: ClasseFarmaco;
  novoAntibiotico: boolean;
  recomendacao: number[];
  volumeMl: number | null;
  bhCategoria: string | null;
  mav: boolean;
}

interface RawItem {
  id?: unknown; name?: unknown; category?: unknown; status?: unknown; posology?: unknown;
  schedule?: unknown; route?: unknown; dose?: unknown; volumeTotal?: unknown; diluentVolume?: unknown;
  doseValue?: unknown; atbStartDate?: unknown; highAlert?: unknown; doubleCheck?: unknown;
  securityCategory?: unknown;
}

const NAO_APRAZA = new Set(["care", "nutrition"]);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const vazio = (s: string) => !s || s === "-" || s === "—";

export function parseVolume(v: unknown): number | null {
  const s = str(v).replace(",", ".");
  if (vazio(s)) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) && n > 0 && n < 10000 ? Math.round(n * 10) / 10 : null;
}

export function ehViaEV(route: string): boolean {
  return /^(ev|iv)\b|intraven|endoven/i.test(route.trim());
}
export function ehViaEnteral(route: string): boolean {
  return /sne|sng|sonda|gtt|gastrost|jejunost|enteral|ostomia|\bpeg\b/i.test(route);
}
export function ehViaOral(route: string): boolean {
  return /^vo\b|oral/i.test(route.trim()) && !ehViaEnteral(route);
}

const CLASSE_POR_NOME: [RegExp, ClasseFarmaco][] = [
  [/dipirona|paracetamol|metamizol/i, "antitermico"],
  [/tramadol|morfina|code[ií]na|fentanil|metadona|cetoprofeno|tenoxicam|ibuprofeno|cetorolaco/i, "analgesico"],
  [/ondansetrona|metoclopramida|bromoprida|dimenidrinato|droperidol/i, "antiemetico"],
];

export function classeDoItem(categoria: string, nome: string): ClasseFarmaco {
  if (categoria === "antimicrobial") return "antibiotico";
  for (const [re, c] of CLASSE_POR_NOME) if (re.test(nome)) return c;
  return "outro";
}

function dataLocal(d: Date): string {
  const p = fortalezaParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Itens da prescricao ativa que entram no aprazamento, na ordem da prescricao. */
export function itensAprazaveis(itens: unknown, agora: Date): ItemAprazavel[] {
  if (!Array.isArray(itens)) return [];
  const hoje = dataLocal(agora);
  const out: ItemAprazavel[] = [];
  itens.forEach((raw, idx) => {
    const it = (raw ?? {}) as RawItem;
    const nome = str(it.name);
    const categoria = str(it.category) || "medication";
    if (!nome || NAO_APRAZA.has(categoria) || str(it.status) === "suspended") return;
    const posologia = str(it.posology);
    const frequencia = parseFrequencia(posologia);
    const tipo: TipoAprazamento =
      frequencia.tipo === "continuo" ? "continuo"
        : frequencia.tipo === "sn" || frequencia.tipo === "acm" ? "sn"
          : frequencia.tipo === "desconhecida" ? "manual" : "grade";
    const route = str(it.route);
    let volumeMl: number | null = null;
    let bhCategoria: string | null = null;
    if (categoria === "hydration") {
      volumeMl = parseVolume(it.volumeTotal) ?? parseVolume(it.doseValue);
      bhCategoria = ehViaEV(route) ? "ev_intermitente" : ehViaOral(route) ? "oral" : "agua_enteral";
    } else if (ehViaEV(route)) {
      volumeMl = parseVolume(it.volumeTotal) ?? parseVolume(it.diluentVolume);
      bhCategoria = "ev_intermitente";
    }
    if (volumeMl == null) bhCategoria = null;
    const dose = str(it.dose);
    const resumo = [vazio(dose) ? "" : dose, vazio(route) ? "" : route, vazio(posologia) ? "" : posologia]
      .filter(Boolean).join(" · ");
    out.push({
      itemId: str(it.id) || `idx-${idx}`,
      nome,
      resumo,
      categoria,
      posologia,
      frequencia,
      tipo,
      classe: classeDoItem(categoria, nome),
      novoAntibiotico: categoria === "antimicrobial" && str(it.atbStartDate) === hoje,
      recomendacao: vazio(str(it.schedule)) ? [] : parseScheduleHours(str(it.schedule)),
      volumeMl,
      bhCategoria,
      mav: it.highAlert === true || it.doubleCheck === true || /^MAV/.test(str(it.securityCategory)),
    });
  });
  return out;
}

export interface HorarioExistente { itemId: string; horario: Date; cancelado: boolean; aprazadoEm?: Date; canceladoEm?: Date | null }

/**
 * Itens que contam como "ja aprazados" na vigencia: tem horario ativo, a menos que
 * o cancelamento mais recente seja posterior ao ultimo aprazamento ativo
 * (reaprazamento: os futuros foram riscados e o item volta para "A aprazar").
 */
export function itensJaAprazados(existentes: HorarioExistente[]): Set<string> {
  const ultimoAtivo = new Map<string, number>();
  const ultimoCancel = new Map<string, number>();
  for (const e of existentes) {
    if (e.cancelado) {
      const t = e.canceladoEm?.getTime() ?? 0;
      ultimoCancel.set(e.itemId, Math.max(ultimoCancel.get(e.itemId) ?? 0, t));
    } else {
      const t = e.aprazadoEm?.getTime() ?? 0;
      ultimoAtivo.set(e.itemId, Math.max(ultimoAtivo.get(e.itemId) ?? 0, t));
    }
  }
  const out = new Set<string>();
  for (const [id, t] of ultimoAtivo) if (!(ultimoCancel.has(id) && (ultimoCancel.get(id) as number) > t)) out.add(id);
  return out;
}

const HOUR_MS = 3_600_000;
function horaDaJanela(d: Date, w: ValidityWindow): number {
  return (12 + Math.floor((d.getTime() - w.start.getTime()) / HOUR_MS)) % 24;
}

export interface Sugestao { item: ItemAprazavel; sugestao: ScheduleSuggestion }

/**
 * Sugestao para os itens AINDA nao aprazados na janela. Itens ja aprazados entram
 * no mapa de ocupacao (regra de intercalar), e as sugestoes se acumulam na ordem:
 * antibioticos primeiro (1a dose e grade), depois a prescricao na ordem escrita.
 */
export function planejarAprazamento(
  itens: ItemAprazavel[],
  w: ValidityWindow,
  agora: Date,
  existentes: HorarioExistente[],
): Sugestao[] {
  const ativos = existentes.filter((e) => !e.cancelado);
  const jaAprazado = itensJaAprazados(existentes);
  const classePorItem = new Map(itens.map((i) => [i.itemId, i.classe]));
  const ocupados = new Map<number, ClasseFarmaco[]>();
  const ocupar = (h: number, c: ClasseFarmaco) => ocupados.set(h, [...(ocupados.get(h) ?? []), c]);
  for (const e of ativos) {
    const c = classePorItem.get(e.itemId);
    if (c) ocupar(horaDaJanela(e.horario, w), c);
  }
  const pendentes = itens.filter((i) => i.tipo === "grade" && !jaAprazado.has(i.itemId));
  const ordem = [...pendentes.filter((i) => i.classe === "antibiotico"), ...pendentes.filter((i) => i.classe !== "antibiotico")];
  return ordem.map((item) => {
    const sugestao = suggestSchedule(
      { frequencia: item.posologia, classe: item.classe, novoAntibiotico: item.novoAntibiotico, recomendacaoPrescricao: item.recomendacao, agora },
      w,
      ocupados,
    );
    sugestao.horarios.forEach((d) => ocupar(horaDaJanela(d, w), item.classe));
    return { item, sugestao };
  });
}

// ── Checagem ────────────────────────────────────────────────────────────────

export type StatusDose = "pendente" | "proxima" | "atrasada" | "realizada" | "nao_realizada" | "cancelada";

/** Tolerancia institucional: dose checada ate 60 min depois do horario nao e atraso. */
export const TOLERANCIA_ATRASO_MIN = 60;

export function statusDose(
  horario: Date,
  agora: Date,
  checagem: { status: "realizado" | "nao_realizado" } | null,
  cancelado = false,
): StatusDose {
  if (cancelado) return "cancelada";
  if (checagem) return checagem.status === "realizado" ? "realizada" : "nao_realizada";
  const diffMin = (agora.getTime() - horario.getTime()) / 60_000;
  if (diffMin > TOLERANCIA_ATRASO_MIN) return "atrasada";
  if (diffMin >= -60) return "proxima";
  return "pendente";
}

/**
 * Regra 7 (suspensao) aplicada ao que ja foi aprazado: item que saiu da
 * prescricao ativa (suspenso/removido) tem os horarios FUTUROS e ainda nao
 * checados listados para cancelamento; os passados permanecem.
 */
export function horariosACancelar<T extends { itemId: string; horario: Date; cancelado: boolean; checado: boolean }>(
  aprazados: T[],
  itensAtivos: Set<string>,
  agora: Date,
): T[] {
  return aprazados.filter(
    (a) => !a.cancelado && !a.checado && !itensAtivos.has(a.itemId) && a.horario.getTime() >= agora.getTime(),
  );
}

/**
 * Horarios (a partir de agora) de uma opcao escolhida pelo enfermeiro
 * (alternativa da grade ou livre). ATB novo mantem a 1a dose imediata e tira
 * dose colada a ela (< metade do intervalo).
 */
export function horariosDaOpcao(item: ItemAprazavel, horas: number[], w: ValidityWindow, agora: Date): Date[] {
  const desde = agora.getTime() > w.start.getTime() ? agora : w.start;
  const ds = [...new Set(horas)].map((h) => windowHourToDate(w, h)).sort((a, b) => a.getTime() - b.getTime());
  const futuras = ds.filter((d) => d.getTime() >= desde.getTime() && d.getTime() < w.end.getTime());
  if (!item.novoAntibiotico) return futuras;
  const ih = intervaloHoras(item.frequencia) ?? 24;
  return [desde, ...futuras.filter((d) => d.getTime() - desde.getTime() >= (ih * HOUR_MS) / 2)];
}

/**
 * Livre: o enfermeiro informa as horas da vigencia inteira (ex. "10, 18, 02");
 * valida numero de doses e espacamento sobre o conjunto completo e devolve so
 * as futuras para gravar.
 */
export function validarLivre(item: ItemAprazavel, texto: string, w: ValidityWindow, agora: Date): { ok: boolean; erros: string[]; horarios: Date[] } {
  const horas = parseScheduleHours(texto);
  if (!horas.length) return { ok: false, erros: ["informe as horas, ex.: 10, 18, 02"], horarios: [] };
  const completos = horas.map((h) => windowHourToDate(w, h));
  const v = item.tipo === "manual" ? { ok: true, erros: [] as string[] } : validateFreeSchedule(completos, item.posologia, w);
  const horarios = horariosDaOpcao(item, horas, w, agora);
  if (v.ok && !horarios.length) return { ok: false, erros: ["todas as horas informadas já passaram nesta vigência"], horarios };
  return { ok: v.ok, erros: v.erros, horarios };
}

/** Instante da checagem a partir de "HH:MM", no dia mais proximo do horario aprazado. */
export function instanteChecagem(hhmm: string, referencia: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]); const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  const p = fortalezaParts(referencia);
  const base = fortalezaLocal(p.year, p.month, p.day, h, mi);
  const cands = [-1, 0, 1].map((k) => new Date(base.getTime() + k * 24 * HOUR_MS));
  return cands.reduce((a, b) => (Math.abs(b.getTime() - referencia.getTime()) < Math.abs(a.getTime() - referencia.getTime()) ? b : a));
}
