/**
 * Texto legivel de um erro. O Supabase/PostgREST devolve um OBJETO simples
 * ({ message, code, details, hint }), nao um Error — `String(obj)` vira
 * "[object Object]" e esconde a causa real (ex.: violacao de CHECK).
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [e.message, e.details, e.hint]
      .filter((v) => typeof v === "string" && v.trim())
      .map((v) => String(v).trim());
    if (parts.length) return parts.join(" — ");
    try { return JSON.stringify(err); } catch { /* ignora */ }
  }
  return String(err);
}
