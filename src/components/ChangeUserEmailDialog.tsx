// MIGRAÇÃO: funcionalidade degradada. Não existe edge function para alterar o
// e-mail de LOGIN (auth) no backend self-hosted novo — a antiga
// `admin-change-email` foi removida. O diálogo e seus props são mantidos para não
// quebrar quem o importa, mas o envio agora é um no-op informativo: mostra a
// mensagem de indisponibilidade e o botão de confirmar fica desabilitado.
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Mail, AlertTriangle } from "lucide-react";

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
  // MIGRAÇÃO: props userId/onSuccess mantidos na assinatura por compatibilidade,
  // mas não usados enquanto a alteração de e-mail estiver indisponível.
  void userId;
  void onSuccess;

  // MIGRAÇÃO: substitui o supabase.functions.invoke("admin-change-email").
  const handleUnavailable = () => {
    toast.error("Alteração de e-mail de acesso ainda não está disponível neste ambiente.");
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
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs preserve-case">E-mail atual</span>
            </div>
            <div className="font-mono text-sm break-all preserve-case">
              {currentEmail || "—"}
            </div>
          </div>

          {/* MIGRAÇÃO: aviso de indisponibilidade no lugar do formulário. */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-700 preserve-case leading-relaxed">
              Alteração de e-mail de acesso ainda não está disponível neste ambiente.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button type="button" disabled onClick={handleUnavailable}>
              Confirmar alteração
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
