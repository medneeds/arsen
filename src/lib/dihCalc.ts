/**
 * DIH — Dias de Internação Hospitalar.
 * Calculado a partir da data de admissão HOSPITALAR (internacoes.data_entrada).
 * NÃO reinicia em transferência interna: a transferência reusa a mesma linha de
 * internação (completeInternalTransfer não toca data_entrada), então a DIH conta
 * o tempo total no hospital de ponta a ponta.
 *
 * NÃO confundir com o TPS (Tempo de Permanência no Setor), que reinicia a cada
 * transferência de setor — esse vem de `patient.sectorSince` (criado_em do último
 * conclusao_transferencia_interna em logs_auditoria) e é medido pelo
 * useSectorStayTimer, não por este helper.
 *
 * (Histórico: a doc antiga descrevia reset por setor via bed_census.admission_at,
 * tabela do schema ANTIGO que não existe mais — comportamento nunca ocorreu no
 * schema novo.)
 *
 * Convenção:
 *   D0   = dia da admissão (calendário)
 *   DIH1 = dia seguinte
 *   DIH N = N dias após a admissão
 */

/**
 * Aceita ISO ("2026-05-13T10:00:00"), BR ("13/05/2026" ou "13/05/2026 10:00")
 * ou Date. Retorna número de dias decorridos (>= 0) ou null se inválido.
 * Datas no futuro são clampadas para 0 (D0) — DIH nunca é negativo.
 */
export function parseAdmissionDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s) return null;
  // BR: DD/MM/AAAA [HH:MM]
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (br) {
    const [, dd, mm, yyyyRaw, hh = "0", mi = "0"] = br;
    const yyyy = yyyyRaw.length === 2 ? 2000 + parseInt(yyyyRaw) : parseInt(yyyyRaw);
    const d = new Date(yyyy, parseInt(mm) - 1, parseInt(dd), parseInt(hh), parseInt(mi));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function calcDIH(admissionDate: string | Date | null | undefined, now: Date = new Date()): number | null {
  const adm = parseAdmissionDate(admissionDate);
  if (!adm) return null;
  // Normaliza ambas as datas para meia-noite local
  const a = new Date(adm.getFullYear(), adm.getMonth(), adm.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((b.getTime() - a.getTime()) / 86_400_000);
  // Datas no futuro (ex.: erro de digitação) são clampadas para 0 — nunca negativo
  return diff < 0 ? 0 : diff;
}

export function formatDIHLabel(dih: number | null): string {
  if (dih === null) return "—";
  return dih === 0 ? "D0" : `DIH${dih}`;
}

export function formatAdmissionDateBR(admissionDateIso: string | null | undefined): string {
  if (!admissionDateIso) return "—";
  const d = new Date(admissionDateIso);
  if (isNaN(d.getTime())) return admissionDateIso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/**
 * Resolve a data efetiva de admissão HOSPITALAR para fins de DIH/D-day (NÃO é
 * tempo de setor — esse é o TPS, via sectorSince). Prioriza, nesta ordem:
 *   1) admitted_at         — timestamp oficial gravado quando a admissão é validada (D0 real)
 *   2) admission_date      — data informada no cadastro / Edição Avançada (fallback)
 *   3) uti_admission_date  — último recurso (somente se os dois acima estiverem vazios)
 * No schema novo (1) e (2) mapeiam para internacoes.data_entrada.
 * Aceita Patient parcial (qualquer combinação dos campos abaixo).
 */
export function getEffectiveAdmissionDate(p: {
  utiAdmissionDate?: string | string[] | null;
  admittedAt?: string | null;
  admissionDate?: string | null;
  sector?: string | null;
} | null | undefined): string | null {
  if (!p) return null;
  if (p.admittedAt) return p.admittedAt;
  if (p.admissionDate) return p.admissionDate;
  const uti = Array.isArray(p.utiAdmissionDate) ? p.utiAdmissionDate[0] : p.utiAdmissionDate;
  if (uti) return uti as string;
  return null;
}


