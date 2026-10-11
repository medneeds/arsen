/**
 * Parse o texto livre de "Hipóteses Diagnósticas" (uma por linha)
 * em um array normalizado, removendo duplicadas, vazios e prefixos
 * numéricos como "1. ", "2) ", "- ".
 */
export function parseDiagnosesText(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*\d+\s*[.)]\s*/, "") // remove "1. " ou "1) "
        .replace(/^\s*[-•·]\s*/, "")      // remove "- " ou "• "
        .trim()
    )
    .filter((line, idx, arr) => line.length > 0 && arr.indexOf(line) === idx);
}

/** Converte array `patients.diagnoses` em texto multiline para o textarea. */
export function diagnosesArrayToText(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return "";
  return arr.join("\n");
}

/**
 * Hipoteses diagnosticas lidas do banco podem chegar como lista em formato de
 * codigo (`["AVCI","ME?"]`). Converte para uma hipotese por linha. Texto que ja
 * esta em linhas (ou qualquer valor que nao seja uma lista JSON valida) volta
 * exatamente como veio.
 */
export function normalizeDiagnosisText(raw: string | null | undefined): string {
  if (!raw) return "";
  const text = String(raw);
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return text;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return text;
    const items = parsed
      .map((v) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : ""))
      .filter((v) => v.length > 0);
    return items.length > 0 ? items.join("\n") : text;
  } catch {
    return text;
  }
}
