import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Lock, Eye, EyeOff, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * /reset-password
 * Página pública. Supabase entrega aqui após o link enviado por e-mail.
 * Após `onAuthStateChange("PASSWORD_RECOVERY")`, basta chamar updateUser.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Detect URL errors (expired/invalid link) — Supabase puts them in the hash
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const combined = hash + search;
    if (combined.includes("error=") || combined.includes("error_code=")) {
      const params = new URLSearchParams(hash.replace(/^#/, "") + "&" + search.replace(/^\?/, ""));
      const desc = params.get("error_description") || params.get("error") || "Link inválido ou expirado";
      setLinkError(decodeURIComponent(desc.replace(/\+/g, " ")));
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Caso a navegação chegue já com sessão ativa de recovery
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setReady(true);
    });

    // Fallback: se em 4s não detectou recovery, mostra erro
    const timer = setTimeout(() => {
      if (cancelled) return;
      setReady((r) => {
        if (!r) setLinkError("Link de recuperação inválido ou expirado. Solicite um novo na tela de login.");
        return r;
      });
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6 || password.length > 12) {
      toast.error("A nova senha deve ter de 6 a 12 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível redefinir a senha: " + error.message);
      return;
    }
    setDone(true);
    toast.success("Senha redefinida com sucesso");
    // Encerra a sessão de recovery e devolve ao login
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/auth");
    }, 1800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-card border border-border/70 rounded-2xl p-6 shadow-xl"
      >
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <h1 className="preserve-case text-center text-lg font-semibold">
          {done ? "Senha redefinida" : "Definir nova senha"}
        </h1>
        <p className="preserve-case text-center text-xs text-muted-foreground mt-1">
          {done
            ? "Você será redirecionado ao login..."
            : "Crie uma senha forte para acessar a plataforma."}
        </p>

        {done ? (
          <div className="mt-6 flex items-center gap-2 justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="preserve-case text-sm">Tudo certo!</span>
          </div>
        ) : linkError ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center">
              <p className="preserve-case text-xs text-destructive">{linkError}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full preserve-case"
              onClick={() => navigate("/auth")}
            >
              Voltar ao login
            </Button>
          </div>
        ) : !ready ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="preserve-case text-sm">Validando link de recuperação...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <Label className="text-[10px] font-medium text-muted-foreground mb-1.5 block tracking-[0.15em]">
                NOVA SENHA
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 12))}
                  className="pl-10 pr-11 h-11"
                  placeholder="6 a 12 caracteres"
                  maxLength={12}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/60"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-[10px] font-medium text-muted-foreground mb-1.5 block tracking-[0.15em]">
                CONFIRMAR SENHA
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value.slice(0, 12))}
                  className="pl-10 h-11"
                  placeholder="Repita a nova senha"
                  maxLength={12}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 preserve-case">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar nova senha"
              )}
            </Button>

            <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/70">
              <ShieldCheck className="h-3 w-3" />
              <span className="preserve-case">Conexão segura • LGPD • CFM</span>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
