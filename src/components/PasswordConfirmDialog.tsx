import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface PasswordConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  onConfirmed: () => void | Promise<void>;
}

export function PasswordConfirmDialog({
  open,
  onOpenChange,
  title = "Confirmar com senha",
  description = "Digite sua senha para confirmar a validação da prescrição.",
  actionLabel = "Validar",
  onConfirmed,
}: PasswordConfirmDialogProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayIdentity, setDisplayIdentity] = useState<string>("");

  useEffect(() => {
    let active = true;

    const loadDisplayIdentity = async () => {
      if (!open || !user?.id) {
        if (active) setDisplayIdentity("");
        return;
      }

      setDisplayIdentity("CARREGANDO IDENTIFICAÇÃO…");

      // MIGRAÇÃO: `profiles` (morta) → `profissionais` por `user_id`
      // (profissionais.id ≠ auth.uid). full_name→nome.
      const { data } = await supabase
        .from("profissionais")
        .select("nome, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      const prof = data as { nome?: string | null; email?: string | null } | null;
      const label = [prof?.nome, prof?.email ?? user.email].filter(Boolean).join(" • ");
      setDisplayIdentity(label || user.email || "USUÁRIO AUTENTICADO");
    };

    loadDisplayIdentity();
    return () => {
      active = false;
    };
  }, [open, user?.id, user?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }
    if (!password) {
      toast.error("Informe sua senha.");
      return;
    }
    setLoading(true);
    try {
      // MIGRAÇÃO: a edge function `verify-user-password` não está disponível no
      // backend novo. Validamos a senha CLIENTE-SIDE com um client efêmero
      // (persistSession:false + storageKey próprio) → não troca a sessão atual
      // nem faz login de verdade no app; só confirma a senha no GoTrue.
      const email = user.email;
      if (!email) {
        toast.error("Sua conta não tem e-mail de acesso para validar a senha.");
        setLoading(false);
        return;
      }
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const verifier = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, storageKey: "arsen-pwd-verify" },
      });
      const { error } = await verifier.auth.signInWithPassword({ email, password });
      // Encerra a sessão efêmera (não afeta a sessão principal do app).
      try { await verifier.auth.signOut(); } catch { /* noop */ }

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("invalid login") || msg.includes("credentials")) {
          toast.error("Senha incorreta", { description: "Verifique e tente novamente." });
        } else {
          toast.error("Não foi possível validar a senha", { description: "Tente novamente em instantes." });
        }
        setLoading(false);
        return;
      }
      await onConfirmed();
      setPassword("");
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível validar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!loading) {
          if (!o) setPassword("");
          onOpenChange(o);
        }
      }}
    >
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-base leading-snug break-words">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-1" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed break-words">{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Senha</Label>
            <Input
              id="confirm-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Sua senha de acesso"
            />
            <p className="text-xs text-muted-foreground break-words">
              Usuário: <span className="font-medium">{displayIdentity || "USUÁRIO AUTENTICADO"}</span>
            </p>
          </div>
          <DialogFooter className="gap-2 sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !password} className="w-full sm:w-auto whitespace-normal text-center leading-snug">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando…
                </>
              ) : (
                actionLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
