/**
 * Rotulo da previsao de alta no impresso: so a data. O formulario compoe
 * "21/10/2026 (D+10)" (dias calculados automaticamente) e esse texto tambem fica
 * gravado no plano da admissao, onde e lido de volta para recompor os dias. Por
 * isso o "(D+N)" so e removido na hora de imprimir.
 */
export function stripDischargeDays(label: string | null | undefined): string {
  return (label ?? "").replace(/\s*\(\s*D\s*\+\s*\d+\s*\)\s*$/i, "").trim();
}
