/**
 * Formata o momento de uma validação para exibição em pt-BR.
 *
 * Vive aqui, e não dentro do componente, por dois motivos: é lógica pura e
 * testável, e exportá-la junto do componente dispara o aviso
 * react-refresh/only-export-components.
 *
 * Contrato: data ausente ou inválida devolve null. Nunca "Invalid Date" —
 * numa tela de prontuário isso seria pior que omitir a data.
 */
export function formatValidationMoment(value?: Date | string | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
