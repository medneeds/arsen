/**
 * Encoding leve para marcar uma pendência como "concluída" sem mudar o schema:
 * `[x] texto`  → checked
 * `[ ] texto`  → unchecked explícito
 * `texto`      → unchecked (legado)
 *
 * Persistência permanece string[] — compatível com print, hooks e PDF antigos.
 */
const RE = /^\s*\[( |x|X)\]\s?/;

export function parsePendency(raw: string): { done: boolean; text: string } {
  if (typeof raw !== "string") return { done: false, text: "" };
  const m = raw.match(RE);
  if (!m) return { done: false, text: raw };
  return { done: m[1].toLowerCase() === "x", text: raw.replace(RE, "") };
}

export function setPendencyDone(raw: string, done: boolean): string {
  const { text } = parsePendency(raw);
  if (!text.trim() && !done) return ""; // mantém vazio limpo
  return `${done ? "[x] " : "[ ] "}${text}`;
}

export function stripPendencyMarker(raw: string): string {
  return parsePendency(raw).text;
}
