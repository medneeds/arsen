import { useEffect, useState } from "react";
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
import { KeyRound, Loader2, CheckCircle2, ShieldCheck, Mail } from "lucide-react";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultUsername?: string;
}

/**
 * Fluxo "Esqueci minha senha":
 * - Usuário informa o e-mail de cadastro.
 * - Supabase envia link com token de recuperação para /reset-password.
 * - Para contas internas (sem e-mail real), instruímos a procurar a coordenação.
 */
export function ForgotPasswordDialog({
  open,
  onOpenChange,
  defaultUsername = "",
}: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open && defaultUsername.includes("@")) {
      setEmail(defaultUsername.toLowerCase());
    }
  }, [open, defaultUsername]);

  const reset = () => {
    setEmail("");
    setSubmitted(false);
    setLoading(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!v || !v.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }
    if (v.endsWith("@sistema.local")) {
      toast.error(
        "Este usuário não possui e-mail cadastrado. Procure a coordenação para redefinir.",
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(v, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("Enviamos o link de recuperação para o seu e-mail");
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível enviar o e-mail: " + (err?.message ?? ""));
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
            {submitted ? "Verifique seu e-mail" : "Recuperar senha"}
          </DialogTitle>
          <DialogDescription className="text-center preserve-case">
            {submitted
              ? "Enviamos um link seguro para redefinir sua senha. O link expira em alguns minutos por segurança."
              : "Informe o e-mail cadastrado para receber o link de redefinição."}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-emerald-700 preserve-case">E-mail enviado</p>
                <p className="text-xs text-emerald-700/80 preserve-case">
                  Não esqueça de checar a caixa de spam.
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
              <Label
                htmlFor="forgot-email"
                className="text-[10px] font-medium text-muted-foreground mb-1.5 block tracking-[0.15em]"
              >
                E-MAIL DE CADASTRO
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@hospital.com.br"
                  className="pl-10 h-12 text-base sm:h-11 sm:text-sm"
                  disabled={loading}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground preserve-case">
                Use o e-mail informado no cadastro pela coordenação.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground preserve-case leading-relaxed">
                Por segurança, o link é único e expira após o uso. Se você não cadastrou e-mail,
                procure a coordenação para validação manual.
              </p>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={loading}
                className="preserve-case w-full sm:w-auto h-11 sm:h-10"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="preserve-case w-full sm:w-auto h-11 sm:h-10">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Enviar link
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
