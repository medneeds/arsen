import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";
// IndividualSignUpForm removed — signup público desativado; cadastros agora ficam em /gestao-usuarios.
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { supabase } from "@/integrations/supabase/client";
import { resolveLandingRoute } from "@/config/profileDefaults";
// Sob demanda: so aparece para quem tem mais de um perfil de acesso.
const ProfileChooser = lazy(() =>
  import("@/components/auth/ProfileChooser").then(m => ({ default: m.ProfileChooser })));
import { FirstAccessSetup } from "@/components/auth/FirstAccessSetup";
import type { AccessProfile } from "@/config/userProfiles";
import { safeSetItem } from "@/lib/safeStorage";
import { ArsenMark } from "@/components/brand/ArsenMark";
import { whitelabel } from "@/config/whitelabel";

/* ─── Shared chrome ─────────────────────────────────────────────── */

/* ─── Page ──────────────────────────────────────────────────────── */
export default function AuthPage() {
  const { user, signIn } = useAuth();
  // Esta instalacao do Arsen atende um unico hospital, entao nao ha escolha de
  // unidade antes de autenticar: o HospitalContext resolve sozinho (restaura do
  // navegador ou cai no padrao). Escolher hospital ANTES do login so
  // acrescentava um passo a quem chega para o plantao.
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [redirectRoute, setRedirectRoute] = useState("/");
  const [screen] = useState<"login">("login");
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard síncrono: postLoginInFlight já é true após o primeiro clique,
    // impedindo duplo submit antes do re-render desabilitar o botão.
    if (postLoginInFlight.current) return;

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
          toast.error("Não foi possível fazer login: " + msg);
        }
        setLoading(false);
        postLoginInFlight.current = false;
      } else {
        // Login generalista: descobre o perfil/role definidos pelo gestor/admin
        // a partir do usuário autenticado (suporta login por email, CPF ou usuário).
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id ?? null;
        const [{ data: profileRow }, { data: roleRow }] = userId
          ? await Promise.all([
              supabase
                .from("profiles")
                .select("id, full_name, access_profile, access_profiles, must_change_password")
                .eq("id", userId)
                .maybeSingle(),
              supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", userId)
                .maybeSingle(),
            ])
          : [
              { data: null as { id?: string; full_name?: string; access_profile?: string; access_profiles?: string[]; must_change_password?: boolean } | null },
              { data: null as { role?: string } | null },
            ];

        const appRole: string | null = (roleRow as { role?: string } | null)?.role ?? null;

        const accessProfile = (profileRow as { access_profile?: string } | null)?.access_profile ?? null;
        const accessProfilesList = (profileRow as { access_profiles?: string[] } | null)?.access_profiles ?? [];
        // Lista efetiva: usa access_profiles se preenchida; senão cai no singular.
        const effectiveProfiles = (accessProfilesList && accessProfilesList.length > 0)
          ? accessProfilesList
          : (accessProfile ? [accessProfile] : []);

        // Nao se fixa mais departamento no login. "UTI" (sem numero) nao existe
        // em DEPARTMENT_TO_SECTOR: gravava STORAGE_KEY com valor invalido e
        // zerava currentSectorCode, o que o proprio DepartmentContext registra
        // como causa de travamento no carregamento. O setor passa a ser
        // escolhido de forma explicita em /setores.

        // Primeiro acesso: senha padrão 123456 → exige troca + escolha de username
        const mustChange = (profileRow as { must_change_password?: boolean } | null)?.must_change_password === true;
        if (mustChange && userId) {
          toast.success("Bem-vindo(a) Configure seu acesso.");
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
          safeSetItem("access_profile", chosen);
          sessionStorage.setItem("active_access_profile", chosen);
        }
        toast.success("Login realizado com sucesso");
        setShowLoadingScreen(true);
      }
    } catch (err) {
      toast.error("Não foi possível validar dados");
      setLoading(false);
      postLoginInFlight.current = false;
    }
  };

  // Primeiro acesso (senha padrão 123456) — bloqueia até concluir
  if (firstAccess && !showLoadingScreen) {
    return (
      <FirstAccessSetup
        userId={firstAccess.userId}
        fullName={firstAccess.fullName}
        onComplete={async () => {
          const { data: prof } = await supabase
            .from("profiles")
            .select("access_profile, access_profiles")
            .eq("id", firstAccess.userId)
            .maybeSingle();
          const list = (prof as { access_profiles?: string[] } | null)?.access_profiles ?? [];
          const single = (prof as { access_profile?: string } | null)?.access_profile ?? null;
          const eff = list.length > 0 ? list : (single ? [single] : []);
          const { data: roleRow } = await supabase
            .from("user_roles").select("role").eq("user_id", firstAccess.userId).maybeSingle();
          const appRole = (roleRow as { role?: string } | null)?.role ?? null;
          if (eff.length > 1) {
            setChooserProfiles(eff as AccessProfile[]);
            setChooserAppRole(appRole);
            setChooserUserName(firstAccess.fullName);
            setFirstAccess(null);
            return;
          }
          const chosen = eff[0] ?? null;
          if (chosen) {
            safeSetItem("access_profile", chosen);
            sessionStorage.setItem("active_access_profile", chosen);
          }
          setRedirectRoute(resolveLandingRoute(chosen, appRole));
          setFirstAccess(null);
          setShowLoadingScreen(true);
        }}
      />
    );
  }

  // Tela de escolha de perfil (multi-perfil) — toma a tela inteira após login bem-sucedido
  if (chooserProfiles && chooserProfiles.length > 1 && !showLoadingScreen) {
    return (
      <Suspense fallback={null}>
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
      </Suspense>
    );
  }

  return (
    <>
      {showLoadingScreen && (
        <LoadingScreen
          onComplete={() => navigate(redirectRoute)}
          duration={800}
        />
      )}

      {/* Tela dividida: formulario a esquerda, campo institucional a direita.
          Em telas pequenas o campo vira uma faixa curta NO TOPO (order-1) e o
          formulario ocupa o resto — quem entra pelo celular ve primeiro de quem
          e o sistema, e so entao os campos. */}
      <div
        className={cn(
          "min-h-screen flex flex-col lg:flex-row bg-background text-foreground transition-opacity duration-500",
          showLoadingScreen && "opacity-0",
        )}
      >
        <section className="order-1 flex flex-col px-6 py-8 sm:px-8 lg:order-2 lg:w-[54%] lg:px-8 lg:py-8 relative overflow-hidden">
          {/* Campo navy em tres camadas de profundidade: o gradiente do fundo,
              a marca recortada em escala gigante e um feixe que nasce na fenda
              do apice. A marca nao aparece inteira — sangra nas bordas e lê como
              estrutura, nao como selo. */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(152deg, #1C4E80 0%, #123A62 44%, #091B31 100%)",
            }}
            aria-hidden
          />

          <svg
            viewBox="0 0 68 82"
            className="pointer-events-none absolute left-[30%] -top-[40%] h-[186%] hidden lg:block"
            fill="none"
            aria-hidden
          >
            <path d="M25.6,18 L29.25,18 L12,76 L6,76 Z" fill="#FFFFFF" opacity="0.07" />
            <path d="M33,2 L37.5,2 L62,76 L49,76 Z" fill="#FFFFFF" opacity="0.13" />
            <rect x="18" y="50" width="27" height="3.2" rx="1.6" fill="#FFFFFF" opacity="0.07" />
          </svg>

          <div
            className="pointer-events-none absolute left-[44%] top-0 h-[74%] w-[92px] hidden lg:block"
            style={{
              backgroundImage:
                "linear-gradient(177deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.028) 40%, rgba(255,255,255,0) 78%)",
              transform: "skewX(-12deg)",
            }}
            aria-hidden
          />

          <div className="relative mt-auto">
            <div className="mb-6 h-px w-7 bg-white/30" aria-hidden />
            <p
              className="preserve-case text-[40px] leading-none tracking-[0.012em] text-[#F4F8FC] lg:text-[44px]"
              style={{ fontFamily: "var(--font-brand)" }}
            >
              Arsen
            </p>
            <p className="preserve-case mt-2 text-xs font-normal tracking-[0.28em] text-[#E2EEF9]/[0.46]">
              PLATAFORMA HOSPITALAR INTELIGENTE
            </p>
          </div>
        </section>

        <section className="order-2 flex flex-1 flex-col px-6 py-8 sm:px-8 lg:order-1 lg:px-8 lg:py-8">
          <ArsenMark size={32} className="text-primary" />

          <div className="mt-auto w-full max-w-sm">
            <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="username" className="text-xs font-medium text-muted-foreground mb-2 block tracking-[0.15em]">
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
                    className="preserve-case pl-8 h-12 text-base sm:h-11 sm:text-sm bg-muted/40 border border-border rounded-lg font-medium text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-card transition-all"
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
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground mb-2 block tracking-[0.15em]">
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
                    className="pl-8 pr-8 h-12 text-base sm:h-11 sm:text-sm bg-muted/40 border border-border rounded-lg font-medium text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-card transition-all"
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
                    className="preserve-case text-xs sm:text-xs py-1 px-1 -mr-1 text-primary hover:text-primary/80 hover:underline transition-colors"
                    disabled={loading}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="preserve-case w-full h-12 sm:h-11 bg-primary hover:from-primary/95 hover:to-primary/80 text-primary-foreground font-medium text-sm rounded-lg transition-all duration-300 shadow-md shadow-md hover:shadow-md hover:shadow-md group border border-primary/20"
              >
                {loading ? "Entrando..." : (
                  <span className="inline-flex items-center gap-2">
                    Entrar
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </Button>
            </form>
          </div>

          <div className="mt-auto w-full max-w-sm pt-8">
            <p className="preserve-case text-xs text-muted-foreground">
              {whitelabel.institution.hospitalName}
            </p>
            <p className="preserve-case mt-1 text-xs font-normal text-muted-foreground/70">
              {whitelabel.institution.hospitalShortName} &nbsp;·&nbsp;{" "}
              {whitelabel.institution.city}, {whitelabel.institution.state}
            </p>
          </div>
        </section>
      </div>

      <ForgotPasswordDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        defaultUsername={loginData.username}
      />
    </>
  );
}
