import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Mail, AlertTriangle, Loader2, ArrowRight } from "lucide-react";

interface ChangeUserEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentEmail: string;
  onSuccess?: () => void;
}

export function ChangeUserEmailDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentEmail,
  onSuccess,
}: ChangeUserEmailDialogProps) {
  const [newEmail, setNewEmail] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setNewEmail("");
      setReason("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = newEmail.trim().toLowerCase();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error("INFORME UM E-MAIL VÁLIDO");
      return;
    }
    if (v === (currentEmail || "").toLowerCase()) {
      toast.error("O NOVO E-MAIL É IGUAL AO ATUAL");
      return;
    }
    if (reason.trim().length < 5) {
      toast.error("INFORME O MOTIVO DA ALTERAÇÃO (MÍN. 5 CARACTERES)");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke(
      "admin-change-email",
      { body: { userId, newEmail: v, reason: reason.trim() } },
    );
    setLoading(false);

    if (error || (data as any)?.error) {
      toast.error(
        "FALHA AO ATUALIZAR E-MAIL: " +
          ((data as any)?.error || error?.message || "ERRO DESCONHECIDO"),
      );
      return;
    }

    toast.success("E-MAIL ATUALIZADO COM SUCESSO");
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center">Alterar e-mail</DialogTitle>
          <DialogDescription className="text-center preserve-case">
            Alteração administrativa do e-mail de <strong>{userName}</strong>.
            A ação é auditada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs preserve-case">E-mail atual</span>
            </div>
            <div className="font-mono text-sm break-all preserve-case">
              {currentEmail || "—"}
            </div>
            <div className="flex items-center gap-2 mt-2 text-blue-600 text-xs">
              <ArrowRight className="h-3 w-3" />
              <span className="preserve-case">Novo e-mail abaixo</span>
            </div>
          </div>

          <div>
            <Label className="text-[10px] font-medium text-muted-foreground tracking-[0.15em]">
              NOVO E-MAIL
            </Label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="novo.email@hospital.com.br"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              disabled={loading}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label className="text-[10px] font-medium text-muted-foreground tracking-[0.15em]">
              MOTIVO DA ALTERAÇÃO
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: correção solicitada pelo usuário"
              rows={2}
              disabled={loading}
              className="mt-1.5 resize-none"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 preserve-case leading-relaxed">
              O e-mail novo será marcado como verificado automaticamente.
              O usuário deverá usar o novo e-mail no próximo login.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Confirmar alteração"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
