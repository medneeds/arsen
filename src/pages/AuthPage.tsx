import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  LogIn, User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
// IndividualSignUpForm removed — signup público desativado; cadastros agora ficam em /gestao-usuarios.
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { supabase } from "@/integrations/supabase/client";
import { useDepartment } from "@/contexts/DepartmentContext";
import { HospitalSelector } from "@/components/HospitalSelector";
import { useHospital } from "@/contexts/HospitalContext";
import { AuthBackgroundFx } from "@/components/auth/AuthBackgroundFx";
import { resolveLandingRoute } from "@/config/profileDefaults";
import { ProfileChooser } from "@/components/auth/ProfileChooser";
import { FirstAccessSetup } from "@/components/auth/FirstAccessSetup";
import type { AccessProfile } from "@/config/userProfiles";

/* ─── Shared chrome ─────────────────────────────────────────────── */
function PageHeader() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/60" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-12 md:h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-medium text-muted-foreground tracking-[0.18em] md:tracking-[0.2em]">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span className="hidden sm:inline">ACESSO À PLATAFORMA</span>
          <span className="sm:hidden">ACESSO</span>
        </div>

        <button
          onClick={() => navigate("/")}
          className="preserve-case inline-flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 text-xs font-medium transition-all"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Início
        </button>
      </div>
    </header>
  );
}

function PageFooter() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60 bg-muted/30 py-6 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="preserve-case text-xs text-muted-foreground">
          © {currentYear} Arsen. Todos os direitos reservados.
        </p>
        <p className="preserve-case text-xs text-muted-foreground">
          Desenvolvido por <span className="font-medium text-foreground/80">Medneeds</span>
        </p>
      </div>
    </footer>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function AuthPage() {
  const { user, signIn } = useAuth();
  const { setCurrentDepartment } = useDepartment();
  const { setCurrentHospital } = useHospital();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [redirectRoute, setRedirectRoute] = useState("/");
  const [screen] = useState<"login">("login");
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Multi-perfil: estado para a tela de escolha após login
  const [chooserProfiles, setChooserProfiles] = useState<AccessProfile[] | null>(null);
  const [chooserAppRole, setChooserAppRole] = useState<string | null>(null);
  const [chooserUserName, setChooserUserName] = useState<string | null>(null);

  // Primeiro acesso (senha padrão 123456 → exige troca + escolha de username)
  const [firstAccess, setFirstAccess] = useState<{ userId: string; fullName: string | null } | null>(null);

  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  // Flag síncrona: enquanto o handleLogin está orquestrando o pós-login
  // (buscando perfis, decidindo chooser vs. redirect direto), o auto-redirect
  // do useEffect abaixo NÃO pode disparar — senão "engole" o ProfileChooser.
  const postLoginInFlight = useRef(false);

  useEffect(() => {
    // Auto-redirect só para quem JÁ chegou autenticado (sessão restaurada
    // de outra aba/refresh). Nunca durante o fluxo de login ativo.
    if (user && !postLoginInFlight.current && !chooserProfiles && !showLoadingScreen) {
      navigate("/");
    }
  }, [user, navigate, chooserProfiles, showLoadingScreen]);

  const handleHospitalSelect = (hospital: any) => {
    setSelectedHospitalId(hospital.id);
    setCurrentHospital(hospital);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginData.username.trim()) {
      toast.error("Digite seu usuário");
      return;
    }
    if (!loginData.password.trim()) {
      toast.error("Digite sua senha");
      return;
    }

    setLoading(true);
    postLoginInFlight.current = true;

    try {
      const { error } = await signIn(loginData.username, loginData.password);

      if (error) {
        const msg = (error as { message?: string })?.message ?? "";
        if (msg.includes("Invalid login credentials")) {
          toast.error("Usuário, CPF ou senha incorretos");
        } else if (msg.includes("CPF não encontrado")) {
          toast.error("CPF não encontrado");
        } else {
          toast.error("Erro ao fazer login: " + msg);
        }
        setLoading(false);
        postLoginInFlight.current = false;
      } else {
        // Login generalista: descobre o perfil/role definidos pelo gestor/admin
        // a partir do usuário autenticado (suporta login por email, CPF ou usuário).
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? null;
        const { data: profileRow } = userId
          ? await supabase
              .from("profiles")
              .select("id, full_name, access_profile, access_profiles, must_change_password")
              .eq("id", userId)
              .maybeSingle()
          : { data: null as { id?: string; full_name?: string; access_profile?: string; access_profiles?: string[]; must_change_password?: boolean } | null };

        let appRole: string | null = null;
        if (profileRow?.id) {
          const { data: roleRow } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profileRow.id)
            .maybeSingle();
          appRole = (roleRow as { role?: string } | null)?.role ?? null;
        }

        const accessProfile = (profileRow as { access_profile?: string } | null)?.access_profile ?? null;
        const accessProfilesList = (profileRow as { access_profiles?: string[] } | null)?.access_profiles ?? [];
        // Lista efetiva: usa access_profiles se preenchida; senão cai no singular.
        const effectiveProfiles = (accessProfilesList && accessProfilesList.length > 0)
          ? accessProfilesList
          : (accessProfile ? [accessProfile] : []);

        setCurrentDepartment("UTI");

        // 🔐 Primeiro acesso: senha padrão 123456 → exige troca + escolha de username
        const mustChange = (profileRow as { must_change_password?: boolean } | null)?.must_change_password === true;
        if (mustChange && userId) {
          toast.success("Bem-vindo(a)! Configure seu acesso.");
          setFirstAccess({
            userId,
            fullName: (profileRow as { full_name?: string } | null)?.full_name ?? null,
          });
          setLoading(false);
          return;
        }

        if (effectiveProfiles.length > 1) {
          // Múltiplos perfis → mostra seletor antes de redirecionar.
          toast.success("Login realizado — escolha o ambiente");
          setChooserProfiles(effectiveProfiles as AccessProfile[]);
          setChooserAppRole(appRole);
          setChooserUserName((profileRow as { full_name?: string } | null)?.full_name ?? null);
          setLoading(false);
          return;
        }

        // Caminho único: redireciona direto.
        const chosen = effectiveProfiles[0] ?? accessProfile ?? null;
        const route = resolveLandingRoute(chosen, appRole);
        setRedirectRoute(route);
        if (chosen) {
          localStorage.setItem("access_profile", chosen);
          sessionStorage.setItem("active_access_profile", chosen);
        }
        toast.success("Login realizado com sucesso");
        setShowLoadingScreen(true);
      }
    } catch (err) {
      toast.error("Erro ao validar dados");
      setLoading(false);
      postLoginInFlight.current = false;
    }
  };

  // Tela de escolha de perfil (multi-perfil) — toma a tela inteira após login bem-sucedido
  if (chooserProfiles && chooserProfiles.length > 1 && !showLoadingScreen) {
    return (
      <ProfileChooser
        userName={chooserUserName}
        profiles={chooserProfiles}
        appRole={chooserAppRole}
        onChosen={(_p, route) => {
          setRedirectRoute(route);
          setChooserProfiles(null);
          setShowLoadingScreen(true);
        }}
      />
    );
  }

  return (
    <>
      {showLoadingScreen && (
        <LoadingScreen
          onComplete={() => navigate(redirectRoute)}
          duration={2000}
        />
      )}

      <div
        className={cn(
          "min-h-screen flex flex-col bg-background text-foreground transition-opacity duration-500 relative",
          showLoadingScreen && "opacity-0"
        )}
      >
        {/* Animated background — clinical concept (ECG, pulses, particles) */}
        <AuthBackgroundFx />

        <PageHeader />

        <main className="flex-1 flex items-start sm:items-center justify-center px-3 sm:px-6 pt-4 pb-8 sm:py-16 relative">
          <AnimatePresence mode="wait">
            {screen === "login" ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-[440px] relative"
              >
                {/* Brand block removed — focus on whitelabel */}

                {/* Login Card */}
                <motion.div
                  className="relative bg-card rounded-2xl border border-border/70 p-4 sm:p-7 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.18),0_8px_24px_-12px_hsl(215_25%_12%/0.08)]"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  {/* Card top accent bar */}
                  <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

                  {/* Hospital Selector */}
                  <div className="mb-4 sm:mb-5">
                    <HospitalSelector
                      selectedHospitalId={selectedHospitalId}
                      onSelect={handleHospitalSelect}
                    />
                  </div>

                  <div className="h-px w-full bg-border/60 mb-4 sm:mb-5" />

                  <div className="mb-4 sm:mb-5 flex items-center gap-2.5">
                    <div className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15">
                      <LogIn className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="preserve-case text-sm font-semibold text-foreground">Acesse sua conta</p>
                      <p className="preserve-case text-xs text-muted-foreground">Informe suas credenciais</p>
                    </div>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                    <div>
                      <Label htmlFor="username" className="text-[10px] font-medium text-muted-foreground mb-1.5 block tracking-[0.15em]">
                        USUÁRIO, CPF OU E-MAIL
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                        <Input
                          id="username"
                          type="text"
                          value={loginData.username}
                          onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                          placeholder="Usuário, CPF ou e-mail"
                          className="preserve-case pl-10 h-12 text-base sm:h-11 sm:text-sm bg-muted/40 border border-border rounded-xl font-medium text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-card transition-all"
                          disabled={loading}
                          autoComplete="username"
                          autoFocus
                          inputMode="text"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="password" className="text-[10px] font-medium text-muted-foreground mb-1.5 block tracking-[0.15em]">
                        SENHA
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          placeholder="Digite sua senha"
                          className="pl-10 pr-12 h-12 text-base sm:h-11 sm:text-sm bg-muted/40 border border-border rounded-xl font-medium text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-card transition-all"
                          disabled={loading}
                          autoComplete="current-password"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 active:bg-muted transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setForgotOpen(true)}
                          className="preserve-case text-xs sm:text-[11px] py-1 px-1 -mr-1 text-primary hover:text-primary/80 hover:underline transition-colors"
                          disabled={loading}
                        >
                          Esqueceu a senha?
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="preserve-case w-full h-12 sm:h-11 bg-gradient-to-b from-primary to-primary/90 hover:from-primary/95 hover:to-primary/80 text-primary-foreground font-medium text-sm rounded-xl transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 group border border-primary/20"
                    >
                      {loading ? "Entrando..." : (
                        <span className="inline-flex items-center gap-2">
                          Entrar
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      )}
                    </Button>
                  </form>

                  {/* Compliance microline */}
                  <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 text-muted-foreground/60" />
                    <span className="preserve-case text-[10px] text-muted-foreground/70 tracking-wide">
                      Conexão segura • LGPD • CFM
                    </span>
                  </div>
                </motion.div>

                {/* Acesso restrito — cadastros são gerados internamente */}
                <motion.div
                  className="text-center mt-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <p className="preserve-case inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80 px-4">
                    <ShieldCheck className="h-3 w-3 shrink-0" />
                    <span>Acesso restrito • Solicite seu cadastro à coordenação</span>
                  </p>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>

        <PageFooter />
      </div>

      <ForgotPasswordDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        defaultUsername={loginData.username}
      />
    </>
  );
}
