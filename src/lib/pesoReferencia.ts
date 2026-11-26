/**
 * Peso de referencia da internacao — fonte UNICA (internacoes.peso_kg + origem e data)
 * para meta kcal/ptn, diurese mL/kg/h, Fugulin, AIH, evolucao e impressos.
 */
import { fortalezaParts } from "./docPrefixes.ts";

export type PesoOrigem = "aferido" | "estimado" | "referido";

export interface PesoRef {
  kg: number | null;
  origem: PesoOrigem | null;
  /** ISO do momento da afericao/registro. */
  em: string | null;
  /** Texto pronto para tela e impresso ("72 kg · aferido 20/11" | "—"). */
  texto: string;
}

export interface InternacaoPesoRow {
  peso_kg?: number | string | null;
  peso_origem?: string | null;
  peso_aferido_em?: string | null;
}

const ORIGENS: readonly PesoOrigem[] = ["aferido", "estimado", "referido"];

/** Peso valido: numero finito entre 0,3 kg (prematuro extremo) e 500 kg. */
export function parsePesoKg(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0.3 || n > 500) return null;
  return Math.round(n * 10) / 10;
}

export function formatPesoRef(p: Pick<PesoRef, "kg" | "origem" | "em">): string {
  if (p.kg == null) return "—";
  const kg = Number.isInteger(p.kg) ? String(p.kg) : String(p.kg).replace(".", ",");
  const parts = [`${kg} kg`];
  if (p.origem) {
    let o: string = p.origem;
    if (p.em) {
      const d = new Date(p.em);
      if (!Number.isNaN(d.getTime())) {
        const f = fortalezaParts(d);
        o += ` ${String(f.day).padStart(2, "0")}/${String(f.month).padStart(2, "0")}`;
      }
    }
    parts.push(o);
  }
  return parts.join(" · ");
}

export function pesoRefFromRow(row: InternacaoPesoRow | null | undefined): PesoRef {
  const kg = parsePesoKg(row?.peso_kg);
  const origemRaw = (row?.peso_origem ?? "").trim().toLowerCase();
  const origem = (ORIGENS as readonly string[]).includes(origemRaw) ? (origemRaw as PesoOrigem) : null;
  const em = kg != null ? (row?.peso_aferido_em ?? null) : null;
  const base = { kg, origem: kg != null ? origem : null, em };
  return { ...base, texto: formatPesoRef(base) };
}

/** Altura digitada em metros (1,70) ou centimetros (170) -> cm; invalida -> null. */
export function parseAlturaCm(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const cm = n <= 3 ? n * 100 : n;
  if (cm < 20 || cm > 260) return null;
  return Math.round(cm * 10) / 10;
}

export interface PesoUpdate {
  peso_kg?: number;
  peso_origem?: PesoOrigem | null;
  peso_aferido_em?: string;
  altura_cm?: number;
}

/**
 * Colunas de internacoes a gravar a partir do que foi digitado. So inclui o que
 * e valido: peso/altura vazios ou absurdos NAO sobrescrevem o valor existente
 * (ex.: admissao sem peso nao apaga o peso que a prescricao ja tinha).
 * `origem` undefined = nao mexe na origem; null = origem desconhecida.
 */
export function buildPesoUpdate(
  pesoStr: unknown,
  alturaStr: unknown,
  origem: PesoOrigem | null | undefined,
  agora: Date = new Date(),
): PesoUpdate {
  const out: PesoUpdate = {};
  const kg = parsePesoKg(pesoStr);
  if (kg != null) {
    out.peso_kg = kg;
    out.peso_aferido_em = agora.toISOString();
    if (origem !== undefined) out.peso_origem = origem;
  }
  const cm = parseAlturaCm(alturaStr);
  if (cm != null) out.altura_cm = cm;
  return out;
}
