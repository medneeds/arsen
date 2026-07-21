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
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
  patientName: string;
  /** 'interna' | 'externa' — só para copy; a RPC lê o status real do paciente. */
  transferKind: "interna" | "externa";
}

/**
 * Suspende uma sinalização de transferência interna ou externa (RPC
 * cancel_transfer_signal — nome interno mantido; texto visível ao usuário
 * usa "suspender", igual à terminologia já usada para alta/óbito, pedido
 * do gestor 16/07/2026 para manter consistência).
 */
export function CancelTransferSignalDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  transferKind,
}: Props) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [askPassword, setAskPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Tela de confirmação real (não só toast) — mesma correção aplicada em
  // SuspendDischargeDialog: toast passageiro não é suficiente num plantão.
  const [succeeded, setSucceeded] = useState(false);

  const reasonOk = reason.trim().length >= 10;

  const reset = () => {
    setReason("");
    setAskPassword(false);
    setSubmitting(false);
    setSucceeded(false);
  };

  const handleConfirmed = async () => {
    setSubmitting(true);
    try {
      const { error } = await (supabase.rpc as any)("cancel_transfer_signal", {
        p_patient_id: patientId,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["patients"] });
      await qc.invalidateQueries({ queryKey: ["internal-transfer-requests"] });
      setAskPassword(false);
      setSucceeded(true);
    } catch (e: any) {
      const map: Record<string, string> = {
        reason_too_short: "Motivo precisa ter ao menos 10 caracteres.",
        no_pending_signal: "Não há sinalização pendente para este paciente (pode já ter sido concluída ou suspensa).",
        patient_not_found: "Paciente não encontrado.",
        unauthenticated: "Sessão expirada. Faça login novamente.",
      };
      toast.error("Não foi possível suspender a sinalização", {
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
          {succeeded ? (
            // ═══════ TELA DE CONFIRMAÇÃO ═══════
            <div className="py-2">
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-base">Sinalização suspensa</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {patientName} permanece internado(a) no leito atual. A sinalização de
                    transferência {transferKind} foi suspensa e o motivo ficou registrado na
                    auditoria.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  onClick={() => {
                    reset();
                    onOpenChange(false);
                  }}
                >
                  Entendi, fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                  Suspender transferência {transferKind} sinalizada — {patientName}
                </DialogTitle>
                <DialogDescription className="pt-1">
                  Esta ação <strong>suspende a sinalização de transferência {transferKind}</strong> e
                  mantém o paciente internado no leito atual.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="rounded-md border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-1.5 text-[12.5px] text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">O que vai acontecer:</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    <li>O paciente volta ao status <strong>internado</strong> no leito atual.</li>
                    {transferKind === "interna" ? (
                      <li>O registro na fila do setor destino é <strong>cancelado</strong> — o setor deixa de ver este paciente como aguardando alocação.</li>
                    ) : (
                      <li>O atendimento (encounter) é <strong>reaberto</strong> — havia sido encerrado no momento da sinalização.</li>
                    )}
                    <li>Nenhuma alteração em prescrição, evolução ou sinais vitais.</li>
                    <li>A sinalização original fica <strong>preservada no histórico</strong> com o motivo da suspensão (auditoria imutável).</li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cancel-transfer-reason" className="text-xs font-semibold">
                    Motivo da suspensão <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="cancel-transfer-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Descreva o motivo (ex.: paciente estabilizou, destino indisponível, sinalização por engano)…"
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
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  disabled={!reasonOk || submitting}
                  onClick={() => setAskPassword(true)}
                >
                  Continuar e confirmar com senha
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={askPassword}
        onOpenChange={(o) => {
          if (!o && !submitting) setAskPassword(false);
        }}
        title="Confirmar suspensão de sinalização"
        description={`Digite sua senha para confirmar a suspensão da transferência ${transferKind} sinalizada de ${patientName}.`}
        actionLabel={submitting ? "Suspendendo…" : "Suspender sinalização"}
        onConfirmed={handleConfirmed}
      />
    </>
  );
}
