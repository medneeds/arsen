/**
 * Rotulo da previsao de alta no impresso: so a data. O formulario compoe
 * "21/10/2026 (D+10)" (dias calculados automaticamente) e esse texto tambem fica
 * gravado no plano da admissao, onde e lido de volta para recompor os dias. Por
 * isso o "(D+N)" so e removido na hora de imprimir.
 */
export function stripDischargeDays(label: string | null | undefined): string {
  return (label ?? "").replace(/\s*\(\s*D\s*\+\s*\d+\s*\)\s*$/i, "").trim();
}

/**
 * A admissao grava a previsao de alta como ultima linha do plano
 * ("...\n\nPrevisao de alta: 21/10/2026 (D+10)"). Para imprimir, separa o
 * rotulo (campo proprio "Previsao de alta") do texto do plano — senao o campo
 * sai em branco e a linha aparece dentro do Plano terapeutico.
 */
export function splitDischargePrediction(
  plan: string | null | undefined,
  ...extraLabelSources: Array<string | null | undefined>
): { plan: string; label: string } {
  let label = "";
  for (const s of [plan, ...extraLabelSources]) {
    const m = (s ?? "").match(/Previs[aã]o de alta\s*:\s*([^\n]+)/i);
    if (m && m[1].trim()) { label = m[1].trim(); break; }
  }
  return { plan: (plan ?? "").replace(/\n*Previs[aã]o de alta\s*:[\s\S]*$/i, "").trim(), label };
}
