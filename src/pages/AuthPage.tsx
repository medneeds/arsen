import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, User, Lock, Eye, EyeOff, Building2, ArrowRight, Activity, Brain, MapPin, Stethoscope, HeartPulse, Shield } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";
import { whitelabel } from "@/config/whitelabel";
import bighelpLogo from "@/assets/bighelp-map-logo.png";
import { useDepartment } from "@/contexts/DepartmentContext";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function AuthPage() {
  const { user, signIn } = useAuth();
  const { setCurrentDepartment } = useDepartment();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [selectedSector, setSelectedSector] = useState<string>("red");
  
  const SECTORS = Object.entries(SECTOR_BED_CONFIG).map(([key, config]) => ({
    key,
    label: config.label,
  }));
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
      toast.error("DIGITE SEU USUÁRIO");
      return;
    }
    if (!loginData.password.trim()) {
      toast.error("DIGITE SUA SENHA");
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(loginData.username, loginData.password);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("LOGIN OU SENHA INCORRETOS");
        } else {
          toast.error("ERRO AO FAZER LOGIN: " + error.message.toUpperCase());
        }
        setLoading(false);
      } else {
        setCurrentDepartment("UTI");
        localStorage.setItem("selected_sector", selectedSector);
        toast.success("LOGIN REALIZADO COM SUCESSO");
        setShowLoadingScreen(true);
      }
    } catch (err) {
      toast.error("ERRO AO VALIDAR DADOS");
      setLoading(false);
    }
  };

  return (
    <>
      {showLoadingScreen && (
        <LoadingScreen 
          onComplete={() => navigate("/")} 
          duration={2000}
        />
      )}

      <AnimatePresence mode="wait">
        {showSplash ? (
          /* ─── SPLASH / CONCEPTUAL SCREEN ─────────────────────── */
          <motion.div
            key="splash"
            className="min-h-screen bg-gradient-to-br from-[#040a18] via-[#0a1628] to-[#0f2847] flex flex-col items-center justify-center relative overflow-hidden"
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
              {/* Logo with pulse ring */}
              <motion.div
                className="relative mb-8"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                {/* Pulse rings */}
                <motion.div
                  className="absolute inset-0 -m-8 rounded-full border border-[#2dd4bf]/10"
                  animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.div
                  className="absolute inset-0 -m-8 rounded-full border border-[#2dd4bf]/10"
                  animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 1.25 }}
                />
                <div className="absolute inset-0 -m-10 rounded-full blur-[60px] bg-[#2dd4bf]/[0.12]" />
                <img
                  src={bighelpLogo}
                  alt="BigHelp Map"
                  className="h-24 sm:h-32 object-contain relative z-10 drop-shadow-[0_0_30px_rgba(45,212,191,0.4)]"
                />
              </motion.div>

              {/* Divider */}
              <motion.div
                className="flex items-center justify-center gap-3 mb-6"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#2dd4bf]/30" />
                <div className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf]/40" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#2dd4bf]/30" />
              </motion.div>

              {/* Impact phrase */}
              <motion.h1
                className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight mb-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              >
                Inteligência Clínica
                <br />
                <span className="text-[#2dd4bf]">em Tempo Real</span>
              </motion.h1>

              <motion.p
                className="text-slate-400 text-sm sm:text-base font-light tracking-wide max-w-md mb-10 leading-relaxed"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.9 }}
              >
                Gestão hospitalar inteligente com visibilidade total, decisões baseadas em dados e cuidado centrado no paciente.
              </motion.p>

              {/* CTA Button */}
              <motion.button
                onClick={() => setShowSplash(false)}
                className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-full text-white font-semibold text-sm uppercase tracking-[0.2em] transition-all duration-500 overflow-hidden border border-[#2dd4bf]/30 hover:border-[#2dd4bf]/60"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.2 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Gradient bg */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#2dd4bf]/20 via-[#2dd4bf]/10 to-transparent group-hover:from-[#2dd4bf]/30 group-hover:via-[#2dd4bf]/15 transition-all duration-500" />
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent -skew-x-12"
                  animate={{ x: ["-150%", "150%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
                />
                <span className="relative z-10">Acessar Plataforma</span>
                <ArrowRight className="h-4 w-4 relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
              </motion.button>

              {/* By Medora badge */}
              <motion.div
                className="mt-12 flex flex-col items-center gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1.6 }}
              >
                <div className="h-px w-10 bg-gradient-to-r from-transparent via-slate-600/40 to-transparent mb-2" />
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.35em] font-medium">
                  by
                </p>
                <p className="text-xs sm:text-sm text-slate-300 font-semibold tracking-[0.2em] uppercase">
                  Medora
                </p>
                <p className="text-[9px] text-[#2dd4bf]/50 uppercase tracking-[0.3em] font-light">
                  Clinical Intelligent Platform
                </p>
              </motion.div>
            </div>

            {/* Bottom decorative bar */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2dd4bf]/20 to-transparent" />
          </motion.div>
        ) : (
          /* ─── LOGIN SCREEN ─────────────────────────────────────── */
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

            <div className="w-full max-w-sm relative z-10">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 -m-12 rounded-full blur-[70px] bg-[#2dd4bf]/[0.1]" />
                  <img 
                    src={bighelpLogo} 
                    alt="BigHelp Map" 
                    className="h-20 sm:h-24 object-contain relative z-10 drop-shadow-[0_0_20px_rgba(45,212,191,0.3)]"
                  />
                </div>
                <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-[#2dd4bf]/40 to-transparent mb-5" />
                <p className="text-slate-300 text-base font-medium tracking-widest uppercase">
                  Hospital Mun. Djalma Marques
                </p>
                <p className="text-slate-400 text-sm mt-1 font-light tracking-wide">Socorrão I</p>
              </div>

              {/* Login Card */}
              <div className="bg-white/[0.97] backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/20 p-7 border border-white/20">
                <div className="mb-5 text-center">
                  <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-[#0f2847] to-[#1a3a5c] shadow-lg mb-3">
                    <LogIn className="h-5 w-5 text-[#2dd4bf]" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Acesse sua conta</h2>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="username" className="text-[11px] font-medium text-gray-400 uppercase mb-1.5 block tracking-wider">Usuário</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                      <Input
                        id="username"
                        type="text"
                        value={loginData.username}
                        onChange={(e) => setLoginData({ ...loginData, username: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '') })}
                        placeholder="DIGITE SEU USUÁRIO"
                        className="pl-10 h-11 bg-gray-50/80 border border-gray-200/80 rounded-xl text-sm uppercase font-medium text-gray-900 placeholder:text-gray-300 focus:border-[#2dd4bf]/50 focus:ring-2 focus:ring-[#2dd4bf]/10 transition-all"
                        disabled={loading}
                        autoComplete="username"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-[11px] font-medium text-gray-400 uppercase mb-1.5 block tracking-wider">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value.toUpperCase() })}
                        placeholder="DIGITE SUA SENHA"
                        className="pl-10 pr-10 h-11 bg-gray-50/80 border border-gray-200/80 rounded-xl text-sm uppercase font-medium text-gray-900 placeholder:text-gray-300 focus:border-[#2dd4bf]/50 focus:ring-2 focus:ring-[#2dd4bf]/10 transition-all"
                        disabled={loading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="sector" className="text-[11px] font-medium text-gray-400 uppercase mb-1.5 block tracking-wider">Setor</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 z-10 pointer-events-none" />
                      <Select
                        value={selectedSector}
                        onValueChange={(val) => setSelectedSector(val)}
                        disabled={loading}
                      >
                        <SelectTrigger className="pl-10 h-11 bg-gray-50/80 border border-gray-200/80 rounded-xl text-sm uppercase font-medium text-gray-900 focus:border-[#2dd4bf]/50 focus:ring-2 focus:ring-[#2dd4bf]/10 transition-all">
                          <SelectValue placeholder="SELECIONE O SETOR" />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTORS.map((sector) => (
                            <SelectItem key={sector.key} value={sector.key} className="uppercase text-xs font-medium">
                              {sector.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-gradient-to-r from-[#0f2847] to-[#1a3a5c] hover:from-[#0a1628] hover:to-[#0f2847] text-white font-semibold uppercase text-xs rounded-xl shadow-lg tracking-wider transition-all duration-300"
                  >
                    {loading ? "ENTRANDO..." : "ENTRAR"}
                  </Button>
                </form>
              </div>

              {/* Back to splash + Footer */}
              <div className="text-center mt-5 space-y-3">
                <button
                  onClick={() => setShowSplash(true)}
                  className="text-[10px] text-[#2dd4bf]/60 hover:text-[#2dd4bf] uppercase tracking-[0.2em] transition-colors duration-300"
                >
                  ← Voltar
                </button>
                <p className="text-[10px] text-slate-600 tracking-widest uppercase font-light">
                  {whitelabel.credits.authorSignature}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
