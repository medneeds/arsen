import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Copy, AlertTriangle } from "lucide-react";

interface NewPrescriptionChoiceDialogProps {
  open: boolean;
  onClose: () => void;
  onStartBlank: () => void;
  onCopyPrevious: () => void;
  hasCurrentItems: boolean;
}

/**
 * Pop-up de confirmação ao clicar em "Nova" prescrição.
 * Oferece três opções: começar do zero, copiar do dia anterior ou cancelar.
 * Evita perda acidental de itens já digitados.
 */
export function NewPrescriptionChoiceDialog({
  open,
  onClose,
  onStartBlank,
  onCopyPrevious,
  hasCurrentItems,
}: NewPrescriptionChoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Nova prescrição
          </DialogTitle>
          <DialogDescription>
            Como deseja iniciar a próxima prescrição médica?
          </DialogDescription>
        </DialogHeader>

        {hasCurrentItems && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-warning-soft border border-warning-border text-warning-on-soft">
            <AlertTriangle className="h-4 w-4 mt-1 shrink-0" />
            <p className="text-xs">
              Há itens não salvos no formulário atual. Eles serão descartados ao iniciar uma nova prescrição.
            </p>
          </div>
        )}

        <div className="grid gap-2 pt-1">
          <Button
            variant="outline"
            className="h-auto py-3 px-4 justify-start gap-3 hover:border-primary hover:bg-primary/5"
            onClick={() => { onCopyPrevious(); onClose(); }}
          >
            <Copy className="h-5 w-5 text-primary shrink-0" />
            <div className="text-left flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">Copiar do dia anterior</div>
              <div className="text-xs text-muted-foreground font-normal whitespace-normal">
                Recomendado — duplica a última prescrição assinada e permite ajustes.
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-3 px-4 justify-start gap-3 hover:border-primary hover:bg-primary/5"
            onClick={() => { onStartBlank(); onClose(); }}
          >
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="text-left flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">Começar do zero</div>
              <div className="text-xs text-muted-foreground font-normal whitespace-normal">
                Limpa todo o formulário e inicia uma prescrição em branco.
              </div>
            </div>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
