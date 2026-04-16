import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  LogIn, User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  Briefcase, Sparkles,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";
import { whitelabel } from "@/config/whitelabel";
import { motion, AnimatePresence } from "framer-motion";
import { IndividualSignUpForm } from "@/components/IndividualSignUpForm";
import { supabase } from "@/integrations/supabase/client";
import { useDepartment, Department } from "@/contexts/DepartmentContext";
import { HospitalSelector } from "@/components/HospitalSelector";
import { useHospital } from "@/contexts/HospitalContext";

// Map access_profile to redirect routes
function getRedirectRoute(accessProfile: string | null, role: string | null): string {
  const profile = accessProfile || role || "medico";
  switch (profile) {
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
function PageHeader({ onLogoClick }: { onLogoClick?: () => void }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          onClick={onLogoClick ?? (() => navigate("/"))}
          className="flex items-center gap-2.5 group"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="preserve-case text-lg font-semibold tracking-tight text-slate-800">
            Arsen
          </span>
        </button>

        <button
          onClick={() => navigate("/")}
          className="preserve-case inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-slate-600 hover:text-slate-900 text-xs font-medium transition-colors"
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
    <footer className="border-t border-slate-100 bg-slate-50/50 py-6 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="preserve-case text-xs text-slate-400">
          © {currentYear} Arsen. Todos os direitos reservados.
        </p>
        <p className="preserve-case text-xs text-slate-400">
          Desenvolvido por <span className="font-medium text-slate-600">Medneeds</span>
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
          "min-h-screen flex flex-col bg-white text-slate-700 transition-opacity duration-500",
          showLoadingScreen && "opacity-0"
        )}
      >
        <PageHeader />

        {/* Ambient gradients (shared across screens) */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-br from-sky-100/60 via-blue-50/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-teal-50/50 to-transparent rounded-full blur-3xl" />
        </div>

        <main className="flex-1 flex items-center justify-center px-6 py-10 md:py-16 relative">
          {/* Subtle grid */}
          <div
            className="absolute inset-0 -z-10 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(215 20% 65% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(215 20% 65% / 0.4) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

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
                {/* Brand block */}
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-sm mb-5"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="preserve-case text-[11px] font-medium text-slate-600 tracking-wide">
                      Acesso à plataforma
                    </span>
                  </motion.div>

                  <motion.h1
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="preserve-case text-5xl md:text-6xl font-bold tracking-tight mb-3 bg-gradient-to-b from-slate-800 via-slate-700 to-slate-500 bg-clip-text text-transparent leading-none"
                  >
                    Arsen
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="preserve-case text-sm md:text-base text-slate-500 font-light tracking-tight"
                  >
                    Inteligência clínica em tempo real
                  </motion.p>
                </div>

                {/* Login Card */}
                <motion.div
                  className="bg-white rounded-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] border border-slate-100 p-7"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  {/* Hospital Selector */}
                  <div className="mb-5">
                    <HospitalSelector
                      selectedHospitalId={selectedHospitalId}
                      onSelect={handleHospitalSelect}
                    />
                  </div>

                  <div className="h-px w-full bg-slate-100 mb-5" />

                  <div className="mb-5 flex items-center gap-2.5">
                    <div className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-sky-50 to-blue-100/60 border border-sky-100">
                      <LogIn className="h-4 w-4 text-sky-600" />
                    </div>
                    <div>
                      <p className="preserve-case text-sm font-semibold text-slate-800">Acesse sua conta</p>
                      <p className="preserve-case text-xs text-slate-500">Informe suas credenciais</p>
                    </div>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="username" className="text-[10px] font-medium text-slate-400 mb-1.5 block tracking-[0.15em]">
                        USUÁRIO
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        <Input
                          id="username"
                          type="text"
                          value={loginData.username}
                          onChange={(e) => setLoginData({ ...loginData, username: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '') })}
                          placeholder="Digite seu usuário"
                          className="pl-10 h-11 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all"
                          disabled={loading}
                          autoComplete="username"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="password" className="text-[10px] font-medium text-slate-400 mb-1.5 block tracking-[0.15em]">
                        SENHA
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          placeholder="Digite sua senha"
                          className="pl-10 pr-10 h-11 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all"
                          disabled={loading}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Tipo de Acesso */}
                    <div>
                      <Label htmlFor="access-profile" className="text-[10px] font-medium text-slate-400 mb-1.5 block tracking-[0.15em]">
                        TIPO DE ACESSO
                      </Label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 z-10 pointer-events-none" />
                        <select
                          id="access-profile"
                          value={selectedAccessProfile}
                          onChange={(e) => setSelectedAccessProfile(e.target.value)}
                          className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all appearance-none cursor-pointer uppercase tracking-wide"
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
                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="preserve-case w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl transition-all duration-300 shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/15 group"
                    >
                      {loading ? "Entrando..." : (
                        <span className="inline-flex items-center gap-2">
                          Entrar
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      )}
                    </Button>
                  </form>
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
                    className="preserve-case inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <User className="h-3.5 w-3.5" />
                    Não tem conta?
                    <span className="text-sky-600 font-medium">Cadastre-se</span>
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
                <div className="bg-white rounded-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] border border-slate-100 p-6 max-h-[80vh] overflow-y-auto">
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
