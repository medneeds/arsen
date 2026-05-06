import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ShieldCheck, UserCircle2, KeyRound, CheckCircle2 } from "lucide-react";

interface FirstAccessSetupProps {
  userId: string;
  fullName: string | null;
  onComplete: () => void;
}

const usernameOk = (s: string) => /^[a-z][a-z0-9._-]{2,29}$/i.test(s.trim());

export function FirstAccessSetup({ userId, fullName, onComplete }: FirstAccessSetupProps) {
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sugestão automática a partir do nome
  useEffect(() => {
    if (!username && fullName) {
      const first = fullName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      const last = fullName.trim().split(/\s+/).slice(-1)[0]?.toLowerCase() ?? "";
      const seed = `${first}.${last}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9._-]/g, "");
      if (usernameOk(seed)) setUsername(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName]);

  // Debounce check de disponibilidade
  useEffect(() => {
    if (!usernameOk(username)) {
      setAvailable(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("is_username_available", {
          p_username: username.trim(),
          p_exclude_user: userId,
        });
        if (!cancelled) setAvailable(error ? null : Boolean(data));
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, userId]);

  const pwdStrong = useMemo(() => {
    const v = pwd;
    if (v.length < 8) return { ok: false, msg: "Mínimo 8 caracteres" };
    if (!/[a-zA-Z]/.test(v) || !/\d/.test(v))
      return { ok: false, msg: "Use letras e números" };
    if (v === "123456" || /^(.)\1+$/.test(v))
      return { ok: false, msg: "Senha muito fraca" };
    return { ok: true, msg: "Senha forte" };
  }, [pwd]);

  const canSubmit =
    usernameOk(username) &&
    available === true &&
    pwdStrong.ok &&
    pwd === pwd2 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // 1) Atualiza senha no auth + metadados
      const { error: updErr } = await supabase.auth.updateUser({
        password: pwd,
        data: { username: username.trim().toLowerCase() },
      });
      if (updErr) throw updErr;

      // 2) Persiste username e marca conclusão do primeiro acesso
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          username: username.trim().toLowerCase(),
          must_change_password: false,
        })
        .eq("id", userId);
      if (profErr) {
        // username pode colidir com índice único — mensagem amigável
        if ((profErr.message || "").includes("idx_profiles_username_unique")) {
          toast.error("Este nome de usuário acabou de ser escolhido. Tente outro.");
          setAvailable(false);
          return;
        }
        throw profErr;
      }

      toast.success("Primeiro acesso concluído!");
      onComplete();
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || "Falha ao concluir primeiro acesso.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-10 bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 min-h-[100dvh] overflow-y-auto"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/15 blur-3xl animate-pulse" />
        <div
          className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-3xl animate-pulse"
          style={{ animationDelay: "1.2s", animationDuration: "6s" }}
        />
      </div>

      <Card className="relative w-full max-w-md p-7 space-y-5 backdrop-blur-xl bg-card/80 border-border/60 shadow-2xl shadow-primary/10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/15 to-emerald-500/20 ring-1 ring-primary/30 flex items-center justify-center shadow-lg shadow-primary/20">
            <ShieldCheck className="h-7 w-7 text-primary drop-shadow" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">PRIMEIRO ACESSO</h1>
          <p className="text-sm text-muted-foreground">
            {fullName ? `Olá, ${fullName.split(" ")[0]}.` : "Bem-vindo(a)."} Para finalizar
            o cadastro, escolha seu <b>nome de usuário</b> e uma <b>nova senha</b>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="flex items-center gap-1">
              <UserCircle2 className="h-3.5 w-3.5" /> Nome de usuário *
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
              placeholder="ex.: maria.silva"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <div className="text-xs min-h-[1rem]">
              {!username ? (
                <span className="text-muted-foreground">3–30 caracteres, letras/números, ponto, hífen ou underline.</span>
              ) : !usernameOk(username) ? (
                <span className="text-amber-600">Formato inválido (use letras, números, ponto, hífen ou underline).</span>
              ) : checking ? (
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> verificando...
                </span>
              ) : available === true ? (
                <span className="text-emerald-600 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> disponível
                </span>
              ) : available === false ? (
                <span className="text-red-600">já em uso, escolha outro</span>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pwd" className="flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" /> Nova senha *
            </Label>
            <div className="relative">
              <Input
                id="pwd"
                type={showPwd ? "text" : "password"}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Mín. 8 caracteres, com letras e números"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className={`text-xs ${pwdStrong.ok ? "text-emerald-600" : "text-amber-600"}`}>
              {pwd ? pwdStrong.msg : "Mínimo 8 caracteres, letras e números."}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pwd2">Confirmar nova senha *</Label>
            <Input
              id="pwd2"
              type={showPwd ? "text" : "password"}
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              placeholder="Repita a senha"
              required
            />
            {pwd2 && pwd !== pwd2 && (
              <div className="text-xs text-red-600">As senhas não coincidem.</div>
            )}
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full h-11" size="lg">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Concluindo...
              </>
            ) : (
              "Concluir primeiro acesso"
            )}
          </Button>
        </form>

        <p className="text-[11px] text-center text-muted-foreground">
          Após concluir, você usará seu <b>usuário, CPF ou e-mail</b> + a nova senha em todos os próximos acessos.
        </p>
      </Card>
    </div>
  );
}
