import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Beaker, Clock, AlertTriangle, Syringe } from "lucide-react";

export interface PharmacySuggestion {
  /** ID do item na prescrição */
  itemId: string;
  /** Nome do medicamento */
  medicationName: string;
  /** Apresentação (ex.: "500mg/mL — Ampola 2mL") */
  presentation?: string;
  /** Diluição padrão (ex.: "SF 0,9%") */
  standardDilution?: string | null;
  /** Tempo de infusão (ex.: "30 min") */
  infusionTime?: string | null;
  /** Dose máxima diária */
  maxDailyDose?: string | null;
  /** Administração em bolus */
  ivBolus: boolean;
}

interface PharmacySuggestionDialogProps {
  open: boolean;
  suggestion: PharmacySuggestion | null;
  onApply: (suggestion: PharmacySuggestion) => void;
  onDismiss: () => void;
}

export function PharmacySuggestionDialog({
  open,
  suggestion,
  onApply,
  onDismiss,
}: PharmacySuggestionDialogProps) {
  if (!suggestion) return null;

  const hasData = suggestion.ivBolus ||
    suggestion.standardDilution ||
    suggestion.infusionTime ||
    suggestion.maxDailyDose;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
            <Beaker className="h-5 w-5 text-emerald-600" />
          </div>
          <DialogTitle className="text-center text-[14px]">
            Sugestão da Farmácia Clínica
          </DialogTitle>
          <p className="text-center text-[12px] text-muted-foreground leading-snug mt-0.5">
            <span className="font-semibold text-foreground">{suggestion.medicationName}</span>
            {suggestion.presentation && (
              <span className="text-muted-foreground"> · {suggestion.presentation}</span>
            )}
          </p>
        </DialogHeader>

        {hasData ? (
          <div className="rounded-lg border border-border/70 bg-muted/30 divide-y divide-border/60 text-[12px] my-1">
            {/* Bolus */}
            {suggestion.ivBolus && (
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <Syringe className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                <span className="text-muted-foreground">Administração</span>
                <span className="ml-auto font-semibold text-violet-700 dark:text-violet-400">
                  Bolus EV
                </span>
              </div>
            )}

            {/* Diluição — só quando não for bolus */}
            {!suggestion.ivBolus && suggestion.standardDilution && (
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <Beaker className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="text-muted-foreground">Diluição padrão</span>
                <span className="ml-auto font-semibold text-foreground text-right">
                  {suggestion.standardDilution}
                </span>
              </div>
            )}

            {/* Tempo de infusão — só quando não for bolus */}
            {!suggestion.ivBolus && suggestion.infusionTime && (
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-muted-foreground">Tempo de infusão</span>
                <span className="ml-auto font-semibold text-foreground">
                  {suggestion.infusionTime}
                </span>
              </div>
            )}

            {/* Dose máxima diária */}
            {suggestion.maxDailyDose && (
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                <span className="text-muted-foreground">Dose máx./dia</span>
                <span className="ml-auto font-semibold text-foreground">
                  {suggestion.maxDailyDose}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-[12px] text-muted-foreground py-2">
            Nenhuma sugestão específica cadastrada para esta apresentação.
          </p>
        )}

        <p className="text-[10.5px] text-muted-foreground text-center leading-relaxed">
          Sugerido pela Farmácia Clínica · Você pode editar os campos após aplicar.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={() => onApply(suggestion)} className="w-full" disabled={!hasData}>
            Seguir sugestão
          </Button>
          <Button variant="outline" onClick={onDismiss} className="w-full">
            Preencher manualmente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Badge exibido nos campos que foram preenchidos pela sugestão farmacêutica */
export function PharmacyFilledBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
      ✦ Sugestão Farmácia · Editável
    </span>
  );
}
