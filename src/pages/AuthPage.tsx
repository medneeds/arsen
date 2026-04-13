import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  LogIn, User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  Activity, Brain, MapPin, Stethoscope, HeartPulse, Shield,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BigHelpLogo } from "@/components/BigHelpLogo";
import { cn } from "@/lib/utils";
import { whitelabel } from "@/config/whitelabel";
import { motion, AnimatePresence } from "framer-motion";
import { IndividualSignUpForm } from "@/components/IndividualSignUpForm";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { supabase } from "@/integrations/supabase/client";
import { useDepartment, Department } from "@/contexts/DepartmentContext";

// Floating icon data for background animation
const floatingIcons = [
  { Icon: Activity, x: "10%", y: "20%", delay: 0, duration: 6 },
  { Icon: Brain, x: "85%", y: "15%", delay: 1.2, duration: 7 },
  { Icon: MapPin, x: "75%", y: "70%", delay: 0.5, duration: 5.5 },
  { Icon: Stethoscope, x: "15%", y: "75%", delay: 2, duration: 8 },
  { Icon: HeartPulse, x: "50%", y: "85%", delay: 0.8, duration: 6.5 },
  { Icon: Shield, x: "90%", y: "45%", delay: 1.5, duration: 7.5 },
  { Icon: Activity, x: "30%", y: "10%", delay: 2.5, duration: 6 },
  { Icon: Brain, x: "60%", y: "30%", delay: 3, duration: 5 },
];

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

export default function AuthPage() {
  const { user, signIn, role } = useAuth();
  const { setCurrentDepartment } = useDepartment();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [redirectRoute, setRedirectRoute] = useState("/");
  const [screen, setScreen] = useState<"splash" | "login" | "signup" | "forgot">("splash");
  const [signupState, setSignupState] = useState("");
  const [signupHospital, setSignupHospital] = useState("");
  const [signupDepartment, setSignupDepartment] = useState<Department>("URGÊNCIA E EMERGÊNCIA ADULTO");

  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

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
        // Fetch user's access_profile to determine redirect
        const internalEmail = `${loginData.username.toLowerCase()}@sistema.local`;
        const { data: profileData } = await supabase
          .from("profiles")
          .select("access_profile")
          .eq("email", internalEmail)
          .maybeSingle();
        
        const route = getRedirectRoute(profileData?.access_profile || null, null);
        setRedirectRoute(route);
        
        setCurrentDepartment("UTI");
        toast.success("Login realizado com sucesso");
        setShowLoadingScreen(true);
      }
    } catch (err) {
      toast.error("Erro ao validar dados");
      setLoading(false);
    }
  };

  // Shared dark background
  const bgClasses = "min-h-screen bg-gradient-to-br from-[#040a18] via-[#0a1628] to-[#0f2847] flex flex-col items-center justify-center relative overflow-hidden";

  return (
    <>
      {showLoadingScreen && (
        <LoadingScreen
          onComplete={() => navigate(redirectRoute)}
          duration={2000}
        />
      )}

      <AnimatePresence mode="wait">
        {screen === "splash" ? (
          /* ─── SPLASH / CONCEPTUAL SCREEN ─────────────────────── */
          <motion.div
            key="splash"
            className={bgClasses}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.5 }}
          >
            {/* Animated grid background */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(45,212,191,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,.4) 1px, transparent 1px)",
                backgroundSize: "60px 60px",
              }}
            />

            {/* Radial glow */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(45,212,191,0.08) 0%, transparent 70%)" }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Secondary glow */}
            <motion.div
              className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />

            {/* Floating icons */}
            {floatingIcons.map((item, i) => (
              <motion.div
                key={i}
                className="absolute text-[#2dd4bf]/[0.07]"
                style={{ left: item.x, top: item.y }}
                animate={{
                  y: [-12, 12, -12],
                  rotate: [-5, 5, -5],
                  opacity: [0.4, 0.8, 0.4],
                }}
                transition={{
                  duration: item.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: item.delay,
                }}
              >
                <item.Icon className="h-8 w-8 sm:h-10 sm:w-10" />
              </motion.div>
            ))}

            {/* Horizontal scanning line */}
            <motion.div
              className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2dd4bf]/20 to-transparent"
              animate={{ top: ["0%", "100%"] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />

            {/* Content */}
            <div className="relative z-10 text-center px-6 max-w-xl mx-auto flex flex-col items-center">
              {/* Logo with pulse rings */}
              <motion.div
                className="relative mb-6"
                initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  className="absolute inset-0 -m-12 rounded-full border-2 border-[#2dd4bf]/15"
                  animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.div
                  className="absolute inset-0 -m-12 rounded-full border border-[#2dd4bf]/10"
                  animate={{ scale: [1, 2.2], opacity: [0.3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 1 }}
                />
                <motion.div
                  animate={{ y: [-3, 3, -3] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="drop-shadow-[0_0_40px_rgba(45,212,191,0.5)]"
                >
                  <BigHelpLogo size="xl" glow />
                </motion.div>
              </motion.div>

              {/* Brand name */}
              <motion.div
                className="mb-2"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <h1 className="text-4xl sm:text-5xl md:text-6xl text-white tracking-tight">
                  <span className="font-extrabold">BigHelp</span>
                  <span className="font-extralight text-white/70 ml-1">Map</span>
                </h1>
              </motion.div>

              {/* Divider */}
              <motion.div
                className="flex items-center justify-center gap-3 my-5"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#2dd4bf]/40" />
                <motion.div
                  className="h-2 w-2 rounded-full bg-[#2dd4bf]/60"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#2dd4bf]/40" />
              </motion.div>

              {/* Impact phrase */}
              <motion.p
                className="text-lg sm:text-xl md:text-2xl text-slate-300 font-light tracking-wide leading-relaxed mb-10 max-w-md"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1 }}
              >
                Inteligência Clínica{" "}
                <span className="text-[#2dd4bf] font-medium">em Tempo Real</span>
              </motion.p>

              {/* CTA Button → goes directly to login */}
              <motion.button
                onClick={() => setScreen("login")}
                className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-full text-white font-semibold text-sm tracking-[0.2em] transition-all duration-500 overflow-hidden border border-[#2dd4bf]/30 hover:border-[#2dd4bf]/60"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.3 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#2dd4bf]/20 via-[#2dd4bf]/10 to-transparent group-hover:from-[#2dd4bf]/30 group-hover:via-[#2dd4bf]/15 transition-all duration-500" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent -skew-x-12"
                  animate={{ x: ["-150%", "150%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
                />
                <span className="relative z-10">Acessar Plataforma</span>
                <ArrowRight className="h-4 w-4 relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
              </motion.button>

              {/* By Medneeds badge */}
              <motion.div
                className="mt-14 flex flex-col items-center gap-0.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 1 }}
              >
                <div className="h-px w-12 bg-gradient-to-r from-transparent via-slate-500/30 to-transparent mb-3" />
                <p className="text-[9px] text-slate-600 tracking-[0.4em]">by</p>
                <p className="text-sm sm:text-base text-slate-300 font-bold tracking-[0.25em] mt-0.5">Medneeds</p>
                <p className="text-[8px] text-[#2dd4bf]/40 tracking-[0.35em] font-light mt-1">Clinical Intelligent Platform</p>
              </motion.div>
            </div>

            {/* Bottom decorative bar */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2dd4bf]/20 to-transparent" />
          </motion.div>

        ) : screen === "login" ? (
          /* ─── LOGIN SCREEN (Direct — no profile selection) ──────── */
          <motion.div
            key="login"
            className={cn(
              "min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#1a3a5c] flex items-center justify-center p-4 relative overflow-hidden transition-opacity duration-500",
              showLoadingScreen && "opacity-0"
            )}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Subtle background pattern */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[150px] bg-[#2dd4bf]/[0.04]" />
              <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] bg-white/[0.02]" />
            </div>

            <div className="w-full max-w-[400px] relative z-10">
              {/* Header with logo */}
              <div className="text-center mb-6">
                <motion.div
                  className="inline-block mb-4"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <BigHelpLogo size="md" glow />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <h1 className="text-2xl text-white tracking-tight mb-1">
                    <span className="font-extrabold">BigHelp</span>
                    <span className="font-extralight text-white/60 ml-0.5">Map</span>
                  </h1>
                  <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-[#2dd4bf]/40 to-transparent my-3" />
                  <p className="text-[10px] text-slate-400 tracking-[0.15em]">
                    {whitelabel.institution.hospitalName}
                  </p>
                </motion.div>
              </div>

              {/* Login Card */}
              <motion.div
                className="bg-white/[0.06] backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/30 p-7 border border-white/[0.08]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="mb-5 text-center">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#2dd4bf]/10 border border-[#2dd4bf]/20 mb-3">
                    <LogIn className="h-4 w-4 text-[#2dd4bf]" />
                  </div>
                  <h2 className="text-xs font-semibold text-white/80 tracking-[0.2em]">Acesse sua conta</h2>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="username" className="text-[10px] font-medium text-white/40 mb-1.5 block tracking-[0.15em]">Usuário</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                      <Input
                        id="username"
                        type="text"
                        value={loginData.username}
                        onChange={(e) => setLoginData({ ...loginData, username: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '') })}
                        placeholder="Digite seu usuário"
                        className="pl-10 h-11 bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm font-medium text-white placeholder:text-white/20 focus:border-[#2dd4bf]/40 focus:ring-2 focus:ring-[#2dd4bf]/10 focus:bg-white/[0.08] transition-all"
                        disabled={loading}
                        autoComplete="username"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-[10px] font-medium text-white/40 mb-1.5 block tracking-[0.15em]">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        placeholder="Digite sua senha"
                        className="pl-10 pr-10 h-11 bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm font-medium text-white placeholder:text-white/20 focus:border-[#2dd4bf]/40 focus:ring-2 focus:ring-[#2dd4bf]/10 focus:bg-white/[0.08] transition-all"
                        disabled={loading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-gradient-to-r from-[#2dd4bf]/20 to-[#2dd4bf]/10 hover:from-[#2dd4bf]/30 hover:to-[#2dd4bf]/15 text-white font-semibold text-xs rounded-xl border border-[#2dd4bf]/20 hover:border-[#2dd4bf]/40 tracking-[0.2em] transition-all duration-300"
                  >
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </motion.div>

              {/* Footer links */}
              <motion.div
                className="text-center mt-5 space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <button
                  onClick={() => setScreen("splash")}
                  className="inline-flex items-center gap-2 text-[10px] text-[#2dd4bf]/50 hover:text-[#2dd4bf] tracking-[0.2em] transition-colors duration-300"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Voltar
                </button>

                <div className="h-px w-16 mx-auto bg-white/10" />

                <button
                  onClick={() => setScreen("signup")}
                  className="inline-flex items-center gap-2 text-[10px] text-white/40 hover:text-white/80 tracking-[0.15em] transition-colors duration-300"
                >
                  <User className="h-3 w-3" />
                  Não tem conta? <span className="text-[#2dd4bf] font-semibold">Cadastre-se</span>
                </button>

                <p className="text-[9px] text-slate-600 tracking-[0.3em] font-light">
                  {whitelabel.credits.authorSignature}
                </p>
              </motion.div>
            </div>
          </motion.div>

        ) : screen === "signup" ? (
          /* ─── SIGNUP SCREEN ─────────────────────────────────────── */
          <motion.div
            key="signup"
            className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4 relative overflow-hidden"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-full max-w-lg relative z-10">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-h-[90vh] overflow-y-auto">
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
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
