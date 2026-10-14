import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TestTubes } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * Aviso intermediario (gate suave) antes de concluir uma solicitacao de
 * LABORATORIO quando ja existe exame laboratorial solicitado para o mesmo
 * paciente ha menos de 48h, em setor NAO-critico (UTI/UCI nao disparam).
 *
 * Nao persiste nada: so avisa e exige a declaracao de ciencia para habilitar
 * o botao Prosseguir. Ao prosseguir, segue o MESMO caminho de submit que ja
 * existia (assinatura + handleSubmitRequest). Decisao do setor de laboratorio.
 */
interface LabReorderWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Segue o fluxo normal de solicitacao (assinatura + submit). */
  onConfirm: () => void;
  /** Quantas solicitacoes de laboratorio nas ultimas 48h. */
  count: number;
  /** Data/hora da solicitacao de laboratorio mais recente (ISO). */
  lastRequestedAt?: string | null;
}

export function LabReorderWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  count,
  lastRequestedAt,
}: LabReorderWarningDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  // Zera a ciencia a cada abertura/fechamento — nada persiste entre aberturas.
  useEffect(() => {
    if (!open) setAcknowledged(false);
  }, [open]);

  let quando: string | null = null;
  if (lastRequestedAt) {
    const t = new Date(lastRequestedAt).getTime();
    if (Number.isFinite(t)) quando = format(new Date(t), "dd/MM 'as' HH:mm", { locale: ptBR });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-warning-soft shrink-0">
              <TestTubes className="h-5 w-5 text-warning-on-soft" />
            </span>
            Exames laboratoriais recentes
          </DialogTitle>
          <DialogDescription className="pt-1">
            Ja {count === 1 ? "ha" : "existem"}{" "}
            <strong>{count}</strong>{" "}
            {count === 1 ? "solicitacao" : "solicitacoes"} de laboratorio para este paciente nas ultimas 48h
            {quando ? <> (a mais recente em <strong>{quando}</strong>)</> : null}.
            Confirme se deseja mesmo abrir uma nova solicitacao.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 px-3 py-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="lab-reorder-ack"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="lab-reorder-ack" className="text-sm font-normal leading-snug cursor-pointer">
              Declaro ciencia e desejo prosseguir
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!acknowledged}
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Prosseguir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
