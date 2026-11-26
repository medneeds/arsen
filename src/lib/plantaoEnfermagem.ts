/**
 * Plantao de enfermagem — fonte unica do "Meu plantao" do tecnico e do painel do
 * enfermeiro do setor. Puro (sem Supabase), testavel via tsx.
 *
 *  - turnoAtual: turnos de 12h, 07-19 (diurno) e 19-07 (noturno), America/Fortaleza.
 *  - news2DeSinaisVitais: NEWS2 a partir da linha de `sinais_vitais` (mesma regra
 *    do Monitoramento). Sem o2_suplementar => "NEWS2 parcial", nunca um numero
 *    como se fosse completo.
 *  - tarefasAgora: doses ate +2h, atrasadas primeiro.
 *  - resumoLeito: indicadores da linha do painel do enfermeiro.
 */
import { fortalezaLocal, fortalezaParts } from "./docPrefixes.ts";
import { news2Status, type News2Status } from "./news2.ts";
import {
  statusDose, itensJaAprazados, planejarAprazamento,
  type StatusDose, type ItemAprazavel, type HorarioExistente,
} from "./aprazamentoItens.ts";
import type { ValidityWindow } from "./prescriptionValidity.ts";

const HOUR_MS = 3_600_000;

export interface Turno { inicio: Date; fim: Date; label: string; noturno: boolean }

export function turnoAtual(ref: Date): Turno {
  const p = fortalezaParts(ref);
  const sete = fortalezaLocal(p.year, p.month, p.day, 7, 0);
  const dezenove = fortalezaLocal(p.year, p.month, p.day, 19, 0);
  if (p.hour >= 7 && p.hour < 19) return { inicio: sete, fim: dezenove, label: "Diurno 07h–19h", noturno: false };
  const inicio = p.hour >= 19 ? dezenove : new Date(dezenove.getTime() - 24 * HOUR_MS);
  return { inicio, fim: new Date(inicio.getTime() + 12 * HOUR_MS), label: "Noturno 19h–07h", noturno: true };
}

// ── Sinais vitais -> NEWS2 ──────────────────────────────────────────────────

export interface SinaisVitaisRow {
  data_hora: string;
  freq_respiratoria?: number | null;
  spo2?: number | null;
  o2_suplementar?: boolean | null;
  temperatura?: number | null;
  pressao_sistolica?: number | null;
  freq_cardiaca?: number | null;
  nivel_consciencia?: string | null;
}

const num = (v: unknown): number | undefined => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function news2DeSinaisVitais(r: SinaisVitaisRow): News2Status {
  return news2Status({
    respiratoryRate: num(r.freq_respiratoria),
    spo2: num(r.spo2),
    supplementalOxygen: typeof r.o2_suplementar === "boolean" ? r.o2_suplementar : undefined,
    temperature: num(r.temperatura),
    systolicBp: num(r.pressao_sistolica),
    heartRate: num(r.freq_cardiaca),
    consciousnessLevel: r.nivel_consciencia || undefined,
  });
}

/** Valores plausiveis para um registro de SSVV (bloqueia digitacao absurda). */
export const FAIXAS_SSVV = {
  pressao_sistolica: [30, 300], pressao_diastolica: [10, 200], freq_cardiaca: [10, 300],
  freq_respiratoria: [2, 80], spo2: [30, 100], temperatura: [30, 44], glicemia_capilar: [10, 1000],
  dor_escala: [0, 10], pvc: [-10, 40], fio2: [0.21, 1],
} as const;
export type CampoSSVV = keyof typeof FAIXAS_SSVV;

export function validarSSVV(v: Partial<Record<CampoSSVV, number | null>>): string[] {
  const erros: string[] = [];
  for (const [k, [min, max]] of Object.entries(FAIXAS_SSVV) as [CampoSSVV, readonly [number, number]][]) {
    const x = v[k];
    if (x == null) continue;
    if (!Number.isFinite(x) || x < min || x > max) erros.push(`${k.replace(/_/g, " ")} fora da faixa (${min}–${max})`);
  }
  if (v.pressao_sistolica != null && v.pressao_diastolica != null && v.pressao_diastolica >= v.pressao_sistolica) {
    erros.push("pressão diastólica maior ou igual à sistólica");
  }
  return erros;
}

// ── Fila "Agora" ────────────────────────────────────────────────────────────

export interface DoseFila {
  id: string;
  internacaoId: string;
  horario: Date;
  checagem: { status: "realizado" | "nao_realizado" } | null;
  cancelado: boolean;
}

export interface TarefaAgora<T extends DoseFila> { dose: T; status: StatusDose }

/** Doses sem checagem com horario ate agora + horizonte, atrasadas primeiro. */
export function tarefasAgora<T extends DoseFila>(doses: T[], agora: Date, horizonteH = 2): TarefaAgora<T>[] {
  const limite = agora.getTime() + horizonteH * HOUR_MS;
  return doses
    .filter((d) => !d.cancelado && !d.checagem && d.horario.getTime() <= limite)
    .map((d) => ({ dose: d, status: statusDose(d.horario, agora, null) }))
    .sort((a, b) => {
      const pa = a.status === "atrasada" ? 0 : 1;
      const pb = b.status === "atrasada" ? 0 : 1;
      return pa - pb || a.dose.horario.getTime() - b.dose.horario.getTime();
    });
}

// ── Linha do painel do enfermeiro ───────────────────────────────────────────

export type SituacaoBH = "validado" | "fechado" | "aberto";

export interface ResumoLeitoInput {
  agora: Date;
  doses: DoseFila[];
  /** checagens MAV realizadas ainda sem dupla checagem */
  duplaPendente: number;
  /** itens de grade/manual da prescricao ativa sem horario na vigencia */
  semAprazamento: number;
  ultimoSSVV: SinaisVitaisRow | null;
  /** situacao do BH do periodo 07->07 que JA terminou */
  bhAnterior: SituacaoBH;
  tecnicos: string[];
}

export interface ResumoLeito {
  atrasadas: number;
  proximaHora: number;
  duplaPendente: number;
  semAprazamento: number;
  news2: News2Status | null;
  ssvvHaHoras: number | null;
  /** Sem SSVV ha mais de 6h (ou nunca). */
  ssvvAtrasado: boolean;
  bhAnterior: SituacaoBH;
  /** BH de ontem ainda sem validacao depois das 09h. */
  bhPendente: boolean;
  tecnicos: string[];
  pendencias: number;
}

export const SSVV_MAX_HORAS = 6;

export function resumoLeito(i: ResumoLeitoInput): ResumoLeito {
  let atrasadas = 0;
  let proximaHora = 0;
  for (const d of i.doses) {
    if (d.cancelado || d.checagem) continue;
    const st = statusDose(d.horario, i.agora, null);
    if (st === "atrasada") atrasadas++;
    else if (st === "proxima") proximaHora++;
  }
  const news2 = i.ultimoSSVV ? news2DeSinaisVitais(i.ultimoSSVV) : null;
  const ssvvHaHoras = i.ultimoSSVV
    ? Math.max(0, Math.round(((i.agora.getTime() - new Date(i.ultimoSSVV.data_hora).getTime()) / HOUR_MS) * 10) / 10)
    : null;
  const ssvvAtrasado = ssvvHaHoras == null || ssvvHaHoras > SSVV_MAX_HORAS;
  const hora = fortalezaParts(i.agora).hour;
  const bhPendente = i.bhAnterior !== "validado" && hora >= 9;
  const pendencias = atrasadas + i.duplaPendente + i.semAprazamento
    + (news2?.alertaEnfermeiro ? 1 : 0) + (ssvvAtrasado ? 1 : 0) + (bhPendente ? 1 : 0);
  return {
    atrasadas, proximaHora, duplaPendente: i.duplaPendente, semAprazamento: i.semAprazamento,
    news2, ssvvHaHoras, ssvvAtrasado, bhAnterior: i.bhAnterior, bhPendente, tecnicos: i.tecnicos, pendencias,
  };
}

/**
 * Itens da prescricao ativa ainda sem horario na vigencia (o "item novo sem
 * horario" do painel). Item de grade sem dose restante na vigencia nao conta.
 */
export function itensSemAprazamento(
  itens: ItemAprazavel[], w: ValidityWindow, agora: Date, existentes: HorarioExistente[],
): ItemAprazavel[] {
  const ja = itensJaAprazados(existentes);
  const grade = planejarAprazamento(itens, w, agora, existentes)
    .filter((p) => p.sugestao.horarios.length > 0)
    .map((p) => p.item);
  const manuais = itens.filter((i) => i.tipo === "manual" && !ja.has(i.itemId));
  return [...grade, ...manuais];
}
