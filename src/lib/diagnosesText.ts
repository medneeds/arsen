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
