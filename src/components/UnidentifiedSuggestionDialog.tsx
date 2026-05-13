import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Sparkles, ShieldCheck } from "lucide-react";
import type { NiDetection } from "@/lib/unidentifiedDetector";

interface Props {
  open: boolean;
  detection: NiDetection | null;
  /** Aceita ativar fluxo NI */
  onConfirm: () => void;
  /** Recusa: é nome real, segue cadastro normal */
  onReject: () => void;
  /** Cancelar tudo */
  onCancel: () => void;
}

export function UnidentifiedSuggestionDialog({
  open,
  detection,
  onConfirm,
  onReject,
  onCancel,
}: Props) {
  if (!detection) return null;

  const confidencePct = Math.round(detection.confidence * 100);
  const sourceLabel =
    detection.source === "ai" ? (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Sparkles className="h-3 w-3" />
        IA
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1 text-[10px]">
        <ShieldCheck className="h-3 w-3" />
        Heurística
      </Badge>
    );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Paciente possivelmente NÃO IDENTIFICADO
          </DialogTitle>
          <DialogDescription className="text-xs">
            Detectamos indícios de que este pode ser um paciente não identificado.
            Você decide se segue com o fluxo NI institucional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground">Motivo</span>
              <span className="text-xs font-medium">{detection.reason}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              {sourceLabel}
              <span className="text-[10px] text-muted-foreground">
                Confiança {confidencePct}%
              </span>
            </div>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs space-y-1">
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              Ao ativar o fluxo NI:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-foreground/90">
              <li>Código institucional <strong>NI-AAAA-NNNNNN</strong> gerado automaticamente.</li>
              <li>Dados úteis preservados (sexo aparente, idade estimada, contato, endereço).</li>
              <li>Promoção a paciente identificado disponível depois sem perda de histórico.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="outline" size="sm" onClick={onReject}>
            Não, é nome real
          </Button>
          <Button size="sm" onClick={onConfirm} className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sim, ativar fluxo NI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
