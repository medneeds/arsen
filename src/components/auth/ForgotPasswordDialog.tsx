import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Loader2, CheckCircle2, ShieldCheck, User, Stethoscope } from "lucide-react";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultUsername?: string;
}

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  defaultUsername = "",
}: ForgotPasswordDialogProps) {
  const [username, setUsername] = useState(defaultUsername);
  const [crm, setCrm] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setUsername(defaultUsername);
    setCrm("");
    setSubmitted(false);
    setLoading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    const c = crm.trim();
    if (!u) {
      toast.error("Informe seu usuário");
      return;
    }
    if (!c) {
      toast.error("Informe seu CRM ou matrícula para validação");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("password_reset_requests").insert({
        username: u,
        crm: c,
        status: "pending",
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("Solicitação enviada à coordenação");
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível registrar a solicitação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center preserve-case">
            {submitted ? "Solicitação enviada" : "Recuperar acesso"}
          </DialogTitle>
          <DialogDescription className="text-center preserve-case">
            {submitted
              ? "A coordenação da sua unidade receberá a solicitação e definirá uma nova senha provisória. Você será notificado por canal interno."
              : "Por questões de segurança, a redefinição de senha é validada pela coordenação. Informe seus dados para registro."}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-emerald-700 preserve-case">Solicitação registrada</p>
                <p className="text-xs text-emerald-700/80 preserve-case">
                  Aguarde contato da coordenação. Em caso de urgência, procure-os pessoalmente.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)} className="w-full preserve-case">
                Voltar para o login
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="forgot-username" className="text-[10px] font-medium text-muted-foreground mb-1.5 block tracking-[0.15em]">
                USUÁRIO
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="forgot-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, ""))}
                  placeholder="SEU.USUARIO"
                  className="pl-10 h-11"
                  disabled={loading}
                  autoFocus
                  autoCapitalize="characters"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="forgot-crm" className="text-[10px] font-medium text-muted-foreground mb-1.5 block tracking-[0.15em]">
                CRM OU MATRÍCULA
              </Label>
              <div className="relative">
                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="forgot-crm"
                  value={crm}
                  onChange={(e) => setCrm(e.target.value.toUpperCase())}
                  placeholder="CRM/UF 000000 ou matrícula"
                  className="pl-10 h-11"
                  disabled={loading}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground preserve-case">
                Usado pela coordenação para validar sua identidade.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground preserve-case leading-relaxed">
                Este é um sistema corporativo fechado. A redefinição de senha é processada manualmente
                pela coordenação para garantir conformidade LGPD/CFM.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={loading}
                className="preserve-case"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="preserve-case">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Solicitar redefinição
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
