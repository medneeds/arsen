import type { PrintOption } from "@/components/PostValidationPrintDialog";

/**
 * Opções de impressão da prescrição, iguais às do diálogo do botão impressora.
 *
 * REGRA CENTRAL: guia regulatória NUNCA vem marcada. O documento principal vem;
 * ATM e Psicotrópicos só saem se o usuário marcar. Impressão de guia é ato
 * regulatório — assumir que "sai junto" gera papel que ninguém pediu e, pior,
 * dá a impressão de que a guia foi emitida quando talvez não tenha sido.
 *
 * Devolve undefined quando não há guia aplicável: sem escolha a fazer, a etapa
 * mostra só o botão direto, sem caixas para marcar.
 */
export function buildPrescriptionPrintOptions(
  hasActiveAtb: boolean,
  hasActivePsy: boolean,
): PrintOption[] | undefined {
  if (!hasActiveAtb && !hasActivePsy) return undefined;
  return [
    {
      id: "prescricao",
      label: "Prescrição médica",
      description: "Documento principal validado.",
      defaultChecked: true,
    },
    ...(hasActiveAtb
      ? [{
          id: "atm",
          label: "Guia de Antimicrobianos (CCIH / Norma Zero)",
          description: "Abre a Guia ATM com seus antibióticos.",
        }]
      : []),
    ...(hasActivePsy
      ? [{
          id: "psy",
          label: "Guia de Psicotrópicos (Portaria 344)",
          description: "Abre a Guia de psicotrópicos para impressão.",
        }]
      : []),
  ];
}
