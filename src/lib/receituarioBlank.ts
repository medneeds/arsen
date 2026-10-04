/**
 * Receituario simples EM BRANCO: o medico escreve o texto inteiro, sem a tabela de
 * medicamentos. Gravado como receituario "simples" com itens vazios e o texto em
 * free_text (nenhuma mudanca de banco). Este modulo concentra as regras puras
 * (reconhecer, validar e montar o corpo) usadas pelo editor e pela reimpressao.
 */

/** Aviso fixo do modelo em branco: o texto livre nao e checado contra controlados. */
export const BLANK_RX_NOTICE =
  "Medicamentos controlados (Portaria 344/98) exigem o Receituário de Controle Especial.";

/** Escapa HTML para texto digitado pelo medico (ele pode usar < & " livremente). */
export function escapeRxHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Receituario em branco = sem itens estruturados e com texto livre. */
export function isBlankReceituario(
  items: readonly unknown[] | null | undefined,
  freeText: string | null | undefined,
): boolean {
  return (!items || items.length === 0) && !!freeText && freeText.trim().length > 0;
}

/** Mensagem de erro quando o texto nao pode ser impresso; null se estiver ok. */
export function validateBlankReceituario(text: string | null | undefined): string | null {
  return text && text.trim().length > 0 ? null : "Escreva o texto do receituário antes de imprimir";
}

/** Corpo do receituario em branco: so o texto, com quebras de linha preservadas. */
export function buildBlankReceituarioHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\s+$/g, "");
  return `<div style="font-size:10.5pt;line-height:1.6;white-space:pre-wrap;padding:4pt 2pt">${escapeRxHtml(normalized)}</div>`;
}
