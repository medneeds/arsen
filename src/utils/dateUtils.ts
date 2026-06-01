/**
 * Utilitários de formatação de datas para o padrão brasileiro (DD/MM/YYYY).
 * Use estas funções em vez de manipulações inline para garantir consistência.
 */

/**
 * Converte qualquer string de data para DD/MM/YYYY.
 * Suporta: ISO (2026-06-03), ISO com hora (2026-06-03T12:00:00Z),
 *          Date objects, e mantém sufixos como "(D+7)".
 */
export function formatDateBR(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const str = input instanceof Date ? input.toISOString() : String(input).trim();

  // Extrair sufixo opcional como "(D+7)" ou "(D+10)"
  const suffixMatch = str.match(/\s*(\(D\+\d+\))\s*$/);
  const suffix = suffixMatch ? ` ${suffixMatch[1]}` : "";
  const datePart = str.replace(/\s*\(D\+\d+\)\s*$/, "").trim();

  // ISO YYYY-MM-DD (com ou sem horário)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(datePart);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}${suffix}`;

  // Já está em DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(datePart)) return `${datePart}${suffix}`;

  // Date object via toISOString
  try {
    const d = new Date(datePart);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}${suffix}`;
    }
  } catch {}

  return `${datePart}${suffix}`; // fallback: retorna como está
}

/**
 * Formata data e hora: DD/MM/YYYY às HH:MM
 */
export function formatDateTimeBR(input: string | Date | null | undefined): string {
  if (!input) return "—";
  try {
    const d = input instanceof Date ? input : new Date(String(input));
    if (isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
  } catch { return "—"; }
}
