import { useState, useEffect } from "react";
import { AlertTriangle, ShieldAlert, Pill, Layers, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ClinicalAlert } from "@/lib/clinicalAlertChecks";
import { cn } from "@/lib/utils";

interface PreValidationAlertDialogProps {
  open: boolean;
  alerts: ClinicalAlert[];
  scopeLabel: string; // "prescrição" | "este item"
  onCancel: () => void;
  onConfirm: () => void;
}

const TYPE_META: Record<
  ClinicalAlert["type"],
  { label: string; Icon: typeof AlertTriangle; tone: string }
> = {
  allergy: { label: "Alergia", Icon: ShieldAlert, tone: "text-destructive" },
  interaction: { label: "Interação grave", Icon: AlertTriangle, tone: "text-destructive" },
  duplicate: { label: "Duplicidade", Icon: Layers, tone: "text-amber-600 dark:text-amber-400" },
};

export function PreValidationAlertDialog({
  open,
  alerts,
  scopeLabel,
  onCancel,
  onConfirm,
}: PreValidationAlertDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open]);

  const highCount = alerts.filter((a) => a.severity === "high").length;
  const mediumCount = alerts.length - highCount;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Alertas de segurança antes de validar
          </DialogTitle>
          <DialogDescription>
            Foram detectados sinais de risco em {scopeLabel}. Revise antes de prosseguir.
            {highCount > 0 && (
              <span className="ml-1 font-medium text-destructive">
                {highCount} grave{highCount > 1 ? "s" : ""}
              </span>
            )}
            {mediumCount > 0 && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                {" • "}
                {mediumCount} moderado{mediumCount > 1 ? "s" : ""}
              </span>
            )}
            .
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] -mx-1 px-1">
          <ul className="space-y-2">
            {alerts.map((alert, idx) => {
              const meta = TYPE_META[alert.type];
              const Icon = meta.Icon;
              return (
                <li
                  key={idx}
                  className={cn(
                    "rounded-md border p-3 text-sm",
                    alert.severity === "high"
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-amber-300/40 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", meta.tone)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={alert.severity === "high" ? "destructive" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {meta.label}
                        </Badge>
                        <span className="font-semibold text-foreground">{alert.title}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground leading-snug">{alert.detail}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              className="mt-0.5"
            />
            <span>
              <strong>Estou ciente</strong> dos alertas acima e assumo a responsabilidade clínica
              por prosseguir com a validação. (A ação não está bloqueada.)
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Revisar prescrição
          </Button>
          <Button
            variant={alerts.some((a) => a.severity === "high") ? "destructive" : "default"}
            disabled={!acknowledged}
            onClick={onConfirm}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            Confirmar ciência e prosseguir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
