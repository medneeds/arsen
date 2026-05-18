import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docId: string;
  patientName: string;
  patientId?: string | null;
  docTypeLabel: string;
}

export function SuspendDischargeDialog({
  open,
  onOpenChange,
  docId,
  patientName,
  patientId,
  docTypeLabel,
}: Props) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [askPassword, setAskPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reasonOk = reason.trim().length >= 10;

  const reset = () => {
    setReason("");
    setAskPassword(false);
    setSubmitting(false);
  };

  const handleConfirmed = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("suspend_discharge_document", {
        p_doc_id: docId,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      toast.success("Alta suspensa", {
        description: `${patientName} permanece no leito. Movimentação de alta cancelada (se houver).`,
      });
      await qc.invalidateQueries({ queryKey: ["discharge-docs"] });
      await qc.invalidateQueries({ queryKey: ["patient-movements"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      const map: Record<string, string> = {
        reason_too_short: "Motivo precisa ter ao menos 10 caracteres.",
        already_suspended: "Esta alta já foi suspensa.",
        cannot_suspend_obito: "Relatório de óbito não pode ser suspenso por aqui.",
        doc_not_found: "Documento não encontrado.",
        unauthenticated: "Sessão expirada. Faça login novamente.",
      };
      toast.error("Não foi possível suspender", {
        description: map[e?.message] ?? e?.message ?? "Erro inesperado.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open && !askPassword}
        onOpenChange={(o) => {
          if (submitting) return;
          if (!o) reset();
          onOpenChange(o);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Suspender alta — {patientName}
            </DialogTitle>
            <DialogDescription className="pt-1">
              Esta ação <strong>cancela a alta vigente</strong> ({docTypeLabel}) e mantém o paciente no leito atual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-1.5 text-[12.5px] text-amber-900 dark:text-amber-200">
              <p className="font-semibold">O que vai acontecer:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>O documento de alta deixa de constar como vigente no cockpit.</li>
                <li>A movimentação de alta vinculada (se existir) será marcada como <strong>cancelada</strong>.</li>
                <li>O paciente continua no <strong>mesmo leito</strong>, sem qualquer alteração em prescrição, evolução ou sinais vitais.</li>
                <li>O documento original é <strong>preservado no histórico</strong> com o motivo da suspensão e seu nome (auditoria imutável).</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="suspend-reason" className="text-xs font-semibold">
                Motivo da suspensão <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="suspend-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo clínico/administrativo (mínimo 10 caracteres)…"
                rows={3}
                disabled={submitting}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {reason.trim().length}/10 caracteres mínimos
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!reasonOk || submitting}
              onClick={() => setAskPassword(true)}
            >
              Continuar e confirmar com senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={askPassword}
        onOpenChange={(o) => {
          if (!o && !submitting) setAskPassword(false);
        }}
        title="Confirmar suspensão de alta"
        description={`Digite sua senha para confirmar a suspensão da alta de ${patientName}.`}
        actionLabel={submitting ? "Suspendendo…" : "Suspender alta"}
        onConfirmed={handleConfirmed}
      />
    </>
  );
}
