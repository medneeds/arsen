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
import { AlertTriangle, Skull, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docId: string;
  patientName: string;
  patientId?: string | null;
  docTypeLabel: string;
  /**
   * "obito" exige motivo mais longo (mínimo 20 caracteres, vs. 10 para alta)
   * e copy própria — mesma trilha de auditoria, barra de confirmação mais
   * alta dada a gravidade médico-legal da suspensão de um óbito.
   */
  documentType?: "alta" | "obito";
}

export function SuspendDischargeDialog({
  open,
  onOpenChange,
  docId,
  patientName,
  patientId,
  docTypeLabel,
  documentType = "alta",
}: Props) {
  const qc = useQueryClient();
  const isObito = documentType === "obito";
  const minLen = isObito ? 20 : 10;
  const [reason, setReason] = useState("");
  const [askPassword, setAskPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Tela de confirmação real (não só toast) — pedido do gestor 16/07/2026:
  // um toast passageiro some rápido demais num plantão corrido; a equipe
  // precisa de uma tela que exija clique explícito confirmando que a ação
  // realmente aconteceu.
  const [succeeded, setSucceeded] = useState(false);

  const reasonOk = reason.trim().length >= minLen;

  const reset = () => {
    setReason("");
    setAskPassword(false);
    setSubmitting(false);
    setSucceeded(false);
  };

  const handleConfirmed = async () => {
    if (submitting) return; // guard de reentrada — duplo clique/Enter antes do re-render (auditoria 22/07/2026)
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("suspend_discharge_document", {
        p_doc_id: docId,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["discharge-docs"] });
      await qc.invalidateQueries({ queryKey: ["patient-movements"] });
      await qc.invalidateQueries({ queryKey: ["patients"] });
      setAskPassword(false);
      setSucceeded(true);
    } catch (e: any) {
      const map: Record<string, string> = {
        reason_too_short: isObito
          ? "Motivo precisa ter ao menos 20 caracteres — suspensão de óbito exige justificativa detalhada."
          : "Motivo precisa ter ao menos 10 caracteres.",
        already_suspended: isObito ? "Este óbito já foi suspenso." : "Esta alta já foi suspensa.",
        doc_not_found: "Documento não encontrado.",
        unauthenticated: "Sessão expirada. Faça login novamente.",
      };
      toast.error(isObito ? "Não foi possível suspender o óbito" : "Não foi possível suspender a alta", {
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
                  <p className="font-semibold text-base">
                    {isObito ? "Óbito suspenso" : "Alta suspensa"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {patientName} permanece internado(a) no leito atual.{" "}
                    {isObito ? "A declaração de óbito" : "A alta"} foi marcada como suspensa e o
                    motivo ficou registrado na auditoria.
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
                <DialogTitle className={isObito ? "flex items-center gap-2 text-destructive" : "flex items-center gap-2 text-amber-700 dark:text-amber-400"}>
                  {isObito ? <Skull className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                  {isObito ? "Suspender óbito sinalizado" : "Suspender alta"} — {patientName}
                </DialogTitle>
                <DialogDescription className="pt-1">
                  {isObito ? (
                    <>Esta ação <strong>suspende a declaração de óbito</strong> ({docTypeLabel}) e mantém o paciente no leito atual como internado.</>
                  ) : (
                    <>Esta ação <strong>suspende a alta vigente</strong> ({docTypeLabel}) e mantém o paciente no leito atual.</>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className={isObito
                  ? "rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1.5 text-[12.5px] text-destructive"
                  : "rounded-md border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-1.5 text-[12.5px] text-amber-900 dark:text-amber-200"}>
                  <p className="font-semibold">O que vai acontecer:</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    <li>
                      {isObito ? "A declaração de óbito" : "O documento de alta"} deixa de constar como vigente no cockpit.
                    </li>
                    <li>O paciente volta ao status <strong>internado</strong> e o atendimento (encounter) é reaberto.</li>
                    <li>A movimentação vinculada (se existir) será marcada como <strong>cancelada</strong>.</li>
                    <li>O paciente continua no <strong>mesmo leito</strong>, sem qualquer alteração em prescrição, evolução ou sinais vitais.</li>
                    <li>O documento original é <strong>preservado no histórico</strong> com o motivo da suspensão e seu nome (auditoria imutável).</li>
                    {isObito && (
                      <li className="font-semibold">Use apenas em caso de engano de registro — esta ação fica permanentemente auditada.</li>
                    )}
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
                    placeholder={
                      isObito
                        ? "Descreva detalhadamente o motivo (ex.: registro em paciente incorreto, erro de digitação de leito)…"
                        : "Descreva o motivo clínico/administrativo (mínimo 10 caracteres)…"
                    }
                    rows={3}
                    disabled={submitting}
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {reason.trim().length}/{minLen} caracteres mínimos
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
            </>
          )}
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={askPassword}
        onOpenChange={(o) => {
          if (!o && !submitting) setAskPassword(false);
        }}
        title={isObito ? "Confirmar suspensão de óbito" : "Confirmar suspensão de alta"}
        description={
          isObito
            ? `Digite sua senha para confirmar a suspensão da declaração de óbito de ${patientName}.`
            : `Digite sua senha para confirmar a suspensão da alta de ${patientName}.`
        }
        actionLabel={submitting ? "Suspendendo…" : (isObito ? "Suspender óbito" : "Suspender alta")}
        onConfirmed={handleConfirmed}
      />
    </>
  );
}
