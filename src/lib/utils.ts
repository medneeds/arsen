import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Valida se uma string é um UUID v4 (formato Postgres uuid).
 * Retorna `true` apenas se a string segue o padrão 8-4-4-4-12 hex.
 *
 * Útil para evitar enviar IDs mock (ex: "uti2-01") para colunas uuid no Supabase,
 * o que gera erro: invalid input syntax for type uuid.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Devolve o valor se for UUID válido; caso contrário, `null`.
 * Use ao montar payloads para colunas `uuid NULL` no Supabase.
 */
export function asUuidOrNull(value: unknown): string | null {
  return isUuid(value) ? value : null;
}
