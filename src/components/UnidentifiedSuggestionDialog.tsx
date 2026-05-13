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
import { AlertTriangle, Sparkles, ShieldCheck, FileUp, UserX, X } from "lucide-react";
import type { NiDetection } from "@/lib/unidentifiedDetector";

interface Props {
  open: boolean;
  detection: NiDetection | null;
  /** NI puro: gera código NI, sem dados administrativos */
  onConfirmPure: () => void;
  /** NI + dados do PIS: marca como NI mas permite preencher prontuário PIS, sexo presumido, observações */
  onConfirmWithPin: () => void;
  /** Rejeita: é nome real, segue cadastro normal */
  onReject: () => void;
  /** Cancelar tudo */
  onCancel: () => void;
}

export function UnidentifiedSuggestionDialog({
  open,
  detection,
  onConfirmPure,
  onConfirmWithPin,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Paciente possivelmente NÃO IDENTIFICADO
          </DialogTitle>
          <DialogDescription className="text-xs">
            Detectamos indícios de que este pode ser um paciente não identificado.
            Escolha como prosseguir.
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

          <div className="space-y-2">
            {/* Caminho 1: NI puro */}
            <button
              type="button"
              onClick={onConfirmPure}
              className="w-full text-left rounded-md border-2 border-amber-500/30 bg-amber-500/10 hover:border-amber-500 hover:bg-amber-500/20 transition px-3 py-2.5 group"
            >
              <div className="flex items-start gap-2">
                <UserX className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    NI puro — apenas código institucional
                  </div>
                  <p className="text-[10.5px] text-foreground/80 mt-0.5">
                    Gera <code className="text-[10px] px-1 bg-background rounded">NI-AAAA-NNNNNN</code> + prontuário oficial automático.
                    Apenas características aparentes (sexo, idade, sinais).
                  </p>
                </div>
              </div>
            </button>

            {/* Caminho 2: NI + PIS */}
            <button
              type="button"
              onClick={onConfirmWithPin}
              className="w-full text-left rounded-md border-2 border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10 transition px-3 py-2.5 group"
            >
              <div className="flex items-start gap-2">
                <FileUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    NI + dados administrativos do PIS
                    <Badge variant="outline" className="text-[9px] py-0">recomendado</Badge>
                  </div>
                  <p className="text-[10.5px] text-foreground/80 mt-0.5">
                    Mantém como Não Identificado, mas permite preencher <strong>nº de prontuário do PIS</strong>,
                    sexo/idade aparente, local de origem (SAMU, via pública) e observações da recepção.
                  </p>
                </div>
              </div>
            </button>

            {/* Caminho 3: rejeitar */}
            <button
              type="button"
              onClick={onReject}
              className="w-full text-left rounded-md border bg-background hover:bg-muted transition px-3 py-2"
            >
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-semibold">Não, é nome real</div>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">
                    Segue cadastro normal. Você ainda pode marcar NI manualmente depois.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Cancelar cadastro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
