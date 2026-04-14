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
import { HospitalSelector } from "@/components/HospitalSelector";
import { useHospital } from "@/contexts/HospitalContext";

// Floating icon data for background animation
const floatingIcons = [
  { Icon: Activity, x: "10%", y: "20%", delay: 0, duration: 6 },
  { Icon: Brain, x: "85%", y: "15%", delay: 1.2, duration: 7 },
  { Icon: MapPin, x: "75%", y: "70%", delay: 0.5, duration: 5.5 },
  { Icon: Stethoscope, x: "15%", y: "75%", delay: 2, duration: 8 },
  { Icon: HeartPulse, x: "50%", y: "85%", delay: 0.8, duration: 6.5 },
  { Icon: Shield, x: "90%", y: "45%", delay: 1.5, duration: 7.5 },
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
  const { setCurrentHospital } = useHospital();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [redirectRoute, setRedirectRoute] = useState("/");
  const [screen, setScreen] = useState<"splash" | "login" | "signup" | "forgot">("splash");
  const [signupState, setSignupState] = useState("");
  const [signupHospital, setSignupHospital] = useState("");
  const [signupDepartment, setSignupDepartment] = useState<Department>("URGÊNCIA E EMERGÊNCIA ADULTO");
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

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

  // Shared dark background for splash
  const bgSplash = "min-h-screen bg-gradient-to-br from-[#040a18] via-[#0a1628] to-[#0f2847] flex flex-col items-center justify-center relative overflow-hidden";

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
            className={bgSplash}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.5 }}
          >
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(45,212,191,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,.4) 1px, transparent 1px)",
                backgroundSize: "60px 60px",
              }}
            />

            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(45,212,191,0.08) 0%, transparent 70%)" }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            {floatingIcons.map((item, i) => (
              <motion.div
                key={i}
                className="absolute text-[#2dd4bf]/[0.07]"
                style={{ left: item.x, top: item.y }}
                animate={{ y: [-12, 12, -12], rotate: [-5, 5, -5], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: item.duration, repeat: Infinity, ease: "easeInOut", delay: item.delay }}
              >
                <item.Icon className="h-8 w-8 sm:h-10 sm:w-10" />
              </motion.div>
            ))}

            <motion.div
              className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2dd4bf]/20 to-transparent"
              animate={{ top: ["0%", "100%"] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />

            <div className="relative z-10 text-center px-6 max-w-xl mx-auto flex flex-col items-center">
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
                  animate={{ y: [-3, 3, -3] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="drop-shadow-[0_0_40px_rgba(45,212,191,0.5)]"
                >
                  <BigHelpLogo size="xl" glow />
                </motion.div>
              </motion.div>

              <motion.div
                className="mb-2"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <h1 className="text-4xl sm:text-5xl md:text-6xl text-white tracking-tight">
                  <span className="font-extrabold">BIGHELP</span>
                  <span className="font-extralight text-white/70 ml-1">MAP</span>
                </h1>
              </motion.div>

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

              <motion.p
                className="text-lg sm:text-xl md:text-2xl text-slate-300 font-light tracking-wide leading-relaxed mb-10 max-w-md"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1 }}
              >
                Inteligência Clínica{" "}
                <span className="text-[#2dd4bf] font-medium">em Tempo Real</span>
              </motion.p>

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
                <span className="relative z-10">ACESSAR PLATAFORMA</span>
                <ArrowRight className="h-4 w-4 relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
              </motion.button>

              <motion.div
                className="mt-14 flex flex-col items-center gap-0.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 1 }}
              >
                <div className="h-px w-12 bg-gradient-to-r from-transparent via-slate-500/30 to-transparent mb-3" />
                <p className="text-[9px] text-slate-600 tracking-[0.4em]">BY</p>
                <p className="text-sm sm:text-base text-slate-300 font-bold tracking-[0.25em] mt-0.5">MEDNEEDS</p>
                <p className="text-[8px] text-[#2dd4bf]/40 tracking-[0.35em] font-light mt-1">CLINICAL INTELLIGENT PLATFORM</p>
              </motion.div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2dd4bf]/20 to-transparent" />
          </motion.div>

        ) : screen === "login" ? (
          /* ─── LOGIN SCREEN — LIGHT, CLEAN, ELEGANT ──────── */
          <motion.div
            key="login"
            className={cn(
              "min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex items-center justify-center p-4 relative overflow-hidden transition-opacity duration-500",
              showLoadingScreen && "opacity-0"
            )}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Subtle light background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-100/30 blur-[100px]" />
              <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-teal-100/20 blur-[100px]" />
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-indigo-50/40 blur-[80px]" />
            </div>

            {/* Subtle grid */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(0,0,0,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.15) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            <div className="w-full max-w-[420px] relative z-10">
              {/* Header with logo */}
              <div className="text-center mb-6">
                <motion.div
                  className="inline-block mb-4"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <BigHelpLogo size="md" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <h1 className="text-2xl text-slate-800 tracking-tight mb-1">
                    <span className="font-extrabold">BIGHELP</span>
                    <span className="font-extralight text-slate-400 ml-0.5">MAP</span>
                  </h1>
                  <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-slate-300 to-transparent my-3" />
                  <p className="text-[10px] text-slate-400 tracking-[0.15em]">
                    {whitelabel.institution.hospitalName}
                  </p>
                </motion.div>
              </div>

              {/* Login Card — Light with prominent shadow */}
              <motion.div
                className="bg-white rounded-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] border border-slate-100 p-7"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                {/* Hospital Selector */}
                <div className="mb-5">
                  <HospitalSelector
                    selectedHospitalId={selectedHospitalId}
                    onSelect={handleHospitalSelect}
                  />
                </div>

                <div className="h-px w-full bg-slate-100 mb-5" />

                <div className="mb-5 text-center">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 mb-3">
                    <LogIn className="h-4 w-4 text-blue-600" />
                  </div>
                  <h2 className="text-xs font-semibold text-slate-500 tracking-[0.2em]">ACESSE SUA CONTA</h2>
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
                        className="pl-10 h-11 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
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
                        className="pl-10 pr-10 h-11 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
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

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-xs rounded-xl tracking-[0.2em] transition-all duration-300 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30"
                  >
                    {loading ? "ENTRANDO..." : "ENTRAR"}
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
                  className="inline-flex items-center gap-2 text-[10px] text-slate-400 hover:text-slate-600 tracking-[0.2em] transition-colors duration-300"
                >
                  <ArrowLeft className="h-3 w-3" />
                  VOLTAR
                </button>

                <div className="h-px w-16 mx-auto bg-slate-200" />

                <button
                  onClick={() => setScreen("signup")}
                  className="inline-flex items-center gap-2 text-[10px] text-slate-400 hover:text-slate-600 tracking-[0.15em] transition-colors duration-300"
                >
                  <User className="h-3 w-3" />
                  NÃO TEM CONTA? <span className="text-blue-600 font-semibold">CADASTRE-SE</span>
                </button>

                <p className="text-[9px] text-slate-300 tracking-[0.3em] font-light">
                  {whitelabel.credits.authorSignature}
                </p>
              </motion.div>
            </div>
          </motion.div>

        ) : screen === "signup" ? (
          /* ─── SIGNUP SCREEN ─────────────────────────────────────── */
          <motion.div
            key="signup"
            className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex items-center justify-center p-4 relative overflow-hidden"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-full max-w-lg relative z-10">
              <div className="bg-white rounded-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] border border-slate-100 p-6 max-h-[90vh] overflow-y-auto">
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
