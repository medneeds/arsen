import { HeartHandshake, ShieldAlert, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/utils/dateUtils";
import { hasActivePrecaution } from "@/lib/internacaoDiagnosticContext";

/**
 * Marcacoes clinicas da internacao exibidas no mapa de leitos. Fonte unica:
 * colunas de `internacoes` (paliativo, precaucao_isolamento,
 * previsao_alta_hospitalar), as mesmas que a evolucao grava via
 * usePatientDiagnosticContext.
 */
export function ClinicalFlagBadges({
  isPalliative,
  isolationPrecautions,
  hospitalDischargePrediction,
  className,
}: {
  isPalliative?: boolean;
  isolationPrecautions?: string;
  /** Quando informado, mostra o chip "Prev. alta hosp." (cards fora da UTI). */
  hospitalDischargePrediction?: string;
  className?: string;
}) {
  // "Sem precaução" e ausencia registrada: nao exibe selo de isolamento no mapa.
  const isolation = hasActivePrecaution(isolationPrecautions) ? (isolationPrecautions ?? "").trim() : "";
  const hospital = (hospitalDischargePrediction ?? "").trim();
  if (!isPalliative && !isolation && !hospital) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {isolation && (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning-on-soft"
          title={`Precaução: ${isolation}`}
        >
          <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate max-w-[10rem]">{isolation}</span>
        </span>
      )}
      {isPalliative && (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
          title="Cuidados paliativos"
        >
          <HeartHandshake className="h-3 w-3 shrink-0" aria-hidden />
          Paliativo
        </span>
      )}
      {hospital && (
        <span
          className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground"
          title="Previsão de alta hospitalar (não é a data da alta efetiva)"
        >
          <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
          Prev. alta hosp.: <span className="font-medium">{formatDateBR(hospital)}</span>
        </span>
      )}
    </div>
  );
}
