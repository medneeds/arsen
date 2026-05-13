/**
 * DIH — Dia de Internação Hospitalar.
 * Calculado a partir da data de admissão NO SETOR (não admissão hospitalar).
 * Quando o paciente é transferido entre setores, a data de admissão no setor
 * é resetada (via bed_census.admission_at) e o DIH se recalcula automaticamente.
 *
 * Convenção:
 *   D0   = dia da admissão (calendário)
 *   DIH1 = dia seguinte
 *   DIH N = N dias após a admissão
 */

export function calcDIH(admissionDateIso: string | null | undefined, now: Date = new Date()): number | null {
  if (!admissionDateIso) return null;
  const adm = new Date(admissionDateIso);
  if (isNaN(adm.getTime())) return null;
  // Normaliza ambas as datas para meia-noite local
  const a = new Date(adm.getFullYear(), adm.getMonth(), adm.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((b.getTime() - a.getTime()) / 86_400_000);
  return diff < 0 ? null : diff;
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
