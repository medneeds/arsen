/**
 * Rotulo de idade para exibicao em texto corrido: "42 anos", "1 ano", "8 meses".
 *
 * A idade chega em formatos diferentes conforme a fonte: "42a" (calculada do
 * nascimento, patientAge.formatAge), "42", 42, "42 anos" ou ate "42a anos" (quando
 * o rotulo "anos" era somado a um valor que ja trazia a unidade). Aqui tudo
 * converge para um unico formato, sem caixa alta (diferente de formatAgeDisplay,
 * que devolve "42 ANOS" para a lista do mapa).
 *
 * Valor que nao se reconhece e devolvido como veio, sem inventar unidade.
 */
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function formatAgeLabel(age: string | number | null | undefined): string | null {
  if (age === null || age === undefined) return null;
  if (typeof age === "number") {
    return Number.isFinite(age) && age >= 0 ? plural(Math.trunc(age), "ano", "anos") : null;
  }
  const raw = age.trim();
  if (!raw) return null;

  let m = raw.match(/^(\d+)\s*(?:a|anos?)?(?:\s*anos?)?$/i);
  if (m) return plural(Number(m[1]), "ano", "anos");

  m = raw.match(/^(\d+)\s*(?:m|mes|meses|mês)$/i);
  if (m) return plural(Number(m[1]), "mês", "meses");

  m = raw.match(/^(\d+)\s*(?:sem|semanas?)$/i);
  if (m) return plural(Number(m[1]), "semana", "semanas");

  m = raw.match(/^(\d+)\s*(?:d|dv|dias?)$/i);
  if (m) return plural(Number(m[1]), "dia", "dias");

  return raw;
}
