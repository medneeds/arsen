import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  LogIn, User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  Briefcase, ShieldCheck,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { IndividualSignUpForm } from "@/components/IndividualSignUpForm";
import { supabase } from "@/integrations/supabase/client";
import { useDepartment, Department } from "@/contexts/DepartmentContext";
import { HospitalSelector } from "@/components/HospitalSelector";
import { useHospital } from "@/contexts/HospitalContext";
import { AuthBackgroundFx } from "@/components/auth/AuthBackgroundFx";

// Map access_profile to redirect routes
function getRedirectRoute(accessProfile: string | null, role: string | null): string {
  const profile = accessProfile || role || "medico";
  switch (profile) {
    case "gestor": return "/painel-gestor";
    case "imagem": return "/setor-imagem";
    case "laboratorio": return "/setor-laboratorio";
    case "nir": return "/nir";
    case "ccih": return "/ccih";
    case "administrativo": return "/recepcao";
    case "multi": return "/triagem-fila";
    case "farmacia": return "/validacao-farmaceutica";
    default: return "/";
  }
}

/* ─── Shared chrome ─────────────────────────────────────────────── */
function PageHeader() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-12 md:h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-medium text-muted-foreground tracking-[0.18em] md:tracking-[0.2em]">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span className="hidden xs:inline">ACESSO À PLATAFORMA</span>
          <span className="xs:hidden">ACESSO</span>
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
  const [screen, setScreen] = useState<"login" | "signup">("login");
  const [signupState, setSignupState] = useState("");
  const [signupHospital, setSignupHospital] = useState("");
  const [signupDepartment, setSignupDepartment] = useState<Department>("URGÊNCIA E EMERGÊNCIA ADULTO");
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [selectedAccessProfile, setSelectedAccessProfile] = useState("medico");

  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

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

    try {
      const { error } = await signIn(loginData.username, loginData.password);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Login ou senha incorretos");
        } else {
          toast.error("Erro ao fazer login: " + error.message);
        }
        setLoading(false);
      } else {
        const internalEmail = `${loginData.username.toLowerCase()}@sistema.local`;
        await supabase
          .from("profiles")
          .select("access_profile")
          .eq("email", internalEmail)
          .maybeSingle();

        const route = getRedirectRoute(selectedAccessProfile, null);
        setRedirectRoute(route);
        localStorage.setItem("access_profile", selectedAccessProfile);

        setCurrentDepartment("UTI");
        toast.success("Login realizado com sucesso");
        setShowLoadingScreen(true);
      }
    } catch (err) {
      toast.error("Erro ao validar dados");
      setLoading(false);
    }
  };

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

        <main className="flex-1 flex items-center justify-center px-3 sm:px-6 py-4 md:py-16 relative">
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
                        USUÁRIO
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                        <Input
                          id="username"
                          type="text"
                          value={loginData.username}
                          onChange={(e) => setLoginData({ ...loginData, username: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '') })}
                          placeholder="Digite seu usuário"
                          className="pl-10 h-11 bg-muted/40 border border-border rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-card transition-all"
                          disabled={loading}
                          autoComplete="username"
                          autoFocus
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
                          className="pl-10 pr-10 h-11 bg-muted/40 border border-border rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-card transition-all"
                          disabled={loading}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Tipo de Acesso */}
                    <div>
                      <Label htmlFor="access-profile" className="text-[10px] font-medium text-muted-foreground mb-1.5 block tracking-[0.15em]">
                        TIPO DE ACESSO
                      </Label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 z-10 pointer-events-none" />
                        <select
                          id="access-profile"
                          value={selectedAccessProfile}
                          onChange={(e) => setSelectedAccessProfile(e.target.value)}
                          className="w-full h-11 pl-10 pr-4 bg-muted/40 border border-border rounded-xl text-sm font-medium text-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-card transition-all appearance-none cursor-pointer uppercase tracking-wide"
                          disabled={loading}
                        >
                          <option value="medico">MÉDICO ASSISTENTE</option>
                          <option value="gestor">GESTOR HOSPITALAR</option>
                          <option value="farmacia">FARMÁCIA CLÍNICA</option>
                          <option value="ccih">CCIH — CONTROLE DE INFECÇÃO</option>
                          <option value="imagem">SETOR DE IMAGEM</option>
                          <option value="laboratorio">SETOR LABORATORIAL</option>
                          <option value="nir">NIR — REGULAÇÃO INTERNA</option>
                          <option value="multi">EQUIPE MULTIPROFISSIONAL</option>
                          <option value="administrativo">ADMINISTRATIVO / RECEPÇÃO</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="h-4 w-4 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="preserve-case w-full h-11 bg-gradient-to-b from-primary to-primary/90 hover:from-primary/95 hover:to-primary/80 text-primary-foreground font-medium text-sm rounded-xl transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 group border border-primary/20"
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

                {/* Signup link */}
                <motion.div
                  className="text-center mt-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <button
                    onClick={() => setScreen("signup")}
                    className="preserve-case inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <User className="h-3.5 w-3.5" />
                    Não tem conta?
                    <span className="text-primary font-medium">Cadastre-se</span>
                  </button>
                </motion.div>
              </motion.div>
            ) : (
              /* ─── SIGNUP SCREEN ─────────────────────────────── */
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-lg relative"
              >
                <div className="relative bg-card rounded-2xl border border-border/70 p-6 max-h-[80vh] overflow-y-auto shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.18),0_8px_24px_-12px_hsl(215_25%_12%/0.08)]">
                  <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                  <IndividualSignUpForm
                    onBack={() => setScreen("login")}
                    onSuccess={() => setScreen("login")}
                    selectedState={signupState}
                    selectedHospitalId={signupHospital}
                    selectedDepartment={signupDepartment}
                    onStateChange={setSignupState}
                    onHospitalChange={setSignupHospital}
                    onDepartmentChange={setSignupDepartment}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <PageFooter />
      </div>
    </>
  );
}
