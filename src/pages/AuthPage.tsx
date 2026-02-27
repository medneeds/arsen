import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment, DEPARTMENTS, Department } from "@/contexts/DepartmentContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, User, Lock, Building2, Eye, EyeOff, Shield, FileCheck, UserPlus } from "lucide-react";
import { z } from "zod";
import { whitelabel } from "@/config/whitelabel";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";
import { IndividualSignUpForm } from "@/components/IndividualSignUpForm";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import axiusWordmark from "@/assets/axius-wordmark.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Validação: username só aceita letras maiúsculas (A-Z) e números
const loginSchema = z.object({
  username: z.string()
    .trim()
    .min(1, { message: "LOGIN OBRIGATÓRIO" })
    .max(50)
    .regex(/^[A-Z0-9.]+$/, { message: "APENAS LETRAS MAIÚSCULAS E NÚMEROS" }),
  password: z.string()
    .min(6, { message: "SENHA DEVE TER 6 CARACTERES" })
    .max(6, { message: "SENHA DEVE TER 6 CARACTERES" })
    .regex(/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/, { message: "SENHA: 6 CARACTERES COM LETRAS E NÚMEROS" }),
});

type AuthMode = "login" | "individual-signup" | "forgot-password";

// ─── Slate corporate palette ────────────────────────────────────────────
const SLATE = {
  bg: "from-[#0f172a] via-[#1e293b] to-[#334155]",
  primary: "#1e293b",
  accent: "#334155",
  hover: "#0f172a",
} as const;

export default function AuthPage() {
  const { user, signIn } = useAuth();
  const { setCurrentDepartment } = useDepartment();
  const { states, hospitals, setCurrentHospital, isLoading: hospitalLoading } = useHospital();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<Department>("URGÊNCIA E EMERGÊNCIA ADULTO");

  // Filter hospitals by selected state
  const filteredHospitals = selectedState 
    ? hospitals.filter(h => h.state_id === selectedState)
    : [];

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedState) {
      toast.error("SELECIONE UM ESTADO");
      return;
    }
    if (!selectedHospitalId) {
      toast.error("SELECIONE UMA UNIDADE HOSPITALAR");
      return;
    }
    
    setLoading(true);

    try {
      const validated = loginSchema.parse(loginData);
      const { error } = await signIn(validated.username, validated.password);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("LOGIN OU SENHA INCORRETOS");
        } else {
          toast.error("ERRO AO FAZER LOGIN: " + error.message.toUpperCase());
        }
        setLoading(false);
      } else {
        const selectedHospital = hospitals.find(h => h.id === selectedHospitalId);
        if (selectedHospital) {
          setCurrentHospital(selectedHospital);
        }
        setCurrentDepartment(selectedDepartment);
        toast.success("LOGIN REALIZADO COM SUCESSO");
        setShowLoadingScreen(true);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("ERRO AO VALIDAR DADOS");
      }
      setLoading(false);
    }
  };

  // ─── Shared background ────────────────────────────────────────────────
  const AuthBackground = ({ children }: { children: React.ReactNode }) => (
    <div className={cn(
      `min-h-screen bg-gradient-to-br ${SLATE.bg} flex items-center justify-center p-4 relative overflow-hidden`,
      "lg:p-0"
    )}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-3xl animate-pulse [animation-delay:1.5s]" />
      </div>
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />
      {children}
    </div>
  );

  // ─── Signup mode ──────────────────────────────────────────────────────
  if (authMode === "individual-signup") {
    return (
      <AuthBackground>
        <div className="w-full max-w-md relative z-10">
          <div className="bg-white backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/30 p-6 border border-white/40">
            <IndividualSignUpForm
              onBack={() => setAuthMode("login")}
              onSuccess={() => setAuthMode("login")}
              selectedState={selectedState}
              selectedHospitalId={selectedHospitalId}
              selectedDepartment={selectedDepartment}
              onStateChange={setSelectedState}
              onHospitalChange={setSelectedHospitalId}
              onDepartmentChange={setSelectedDepartment}
            />
          </div>
        </div>
      </AuthBackground>
    );
  }

  // ─── Forgot password mode ─────────────────────────────────────────────
  if (authMode === "forgot-password") {
    return (
      <AuthBackground>
        <div className="w-full max-w-md relative z-10">
          <div className="bg-white backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/30 p-6 border border-white/40">
            <ForgotPasswordForm onBack={() => setAuthMode("login")} />
          </div>
        </div>
      </AuthBackground>
    );
  }

  // ─── Select component helpers (force light theme) ─────────────────────
  const selectTriggerClass = "h-7 bg-gray-50/80 dark:bg-gray-50/80 border border-gray-200 focus:border-slate-700 focus:ring-1 focus:ring-slate-700/10 rounded text-[10px] font-medium uppercase text-gray-900 dark:text-gray-900";
  const selectContentClass = "bg-white dark:bg-white border border-gray-200 shadow-xl z-[9999] rounded-lg text-gray-900 dark:text-gray-900";
  const selectItemClass = "text-xs font-medium py-1.5 text-gray-900 dark:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-100 focus:bg-gray-100 dark:focus:bg-gray-100 focus:text-gray-900 dark:focus:text-gray-900";
  const inputFocusClass = "focus:border-slate-700 focus:ring-1 focus:ring-slate-700/10";

  return (
    <>
      {showLoadingScreen && (
        <LoadingScreen 
          onComplete={() => navigate("/")} 
          duration={2500}
        />
      )}
      
      <div className={cn(
        `min-h-screen bg-gradient-to-br ${SLATE.bg} flex items-center justify-center p-4 relative overflow-hidden transition-opacity duration-500`,
        "lg:p-0",
        showLoadingScreen && "opacity-0"
      )}>
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-32 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-3xl animate-pulse [animation-delay:1.5s]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-3xl animate-pulse [animation-delay:3s]" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        {/* ═══════════════════ DESKTOP ═══════════════════ */}
        <div className="hidden lg:flex w-full h-screen relative z-10">
          {/* Left Panel - Branding */}
          <div className="w-[45%] xl:w-1/2 flex flex-col items-center justify-center p-6 xl:p-10 relative">
            <div className="relative z-10 text-center max-w-md animate-in fade-in-0 slide-in-from-left-8 duration-1000">
              {/* Wordmark logo */}
              <div className="mb-8">
                <img 
                  src={axiusWordmark} 
                  alt="Axius" 
                  className="h-14 xl:h-16 object-contain mx-auto opacity-90"
                />
              </div>
              
              {/* Divider */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-slate-500/30" />
                <div className="h-1 w-1 rounded-full bg-slate-500/40" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-slate-500/30" />
              </div>
              
              {/* Slogan */}
              <p className="text-slate-400 text-sm xl:text-base font-light tracking-wide mb-8 leading-relaxed">
                {whitelabel.platform.slogan}
              </p>
              
              {/* Feature highlights */}
              <div className="space-y-3 text-left animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-500">
                {whitelabel.loginFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-slate-500 hover:text-slate-300 transition-colors duration-300 group">
                    <div className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.08] transition-all duration-300">
                      {idx === 0 ? <Building2 className="h-4 w-4" /> : idx === 1 ? <User className="h-4 w-4" /> : idx === 2 ? <Shield className="h-4 w-4" /> : <FileCheck className="h-4 w-4" />}
                    </div>
                    <span className="text-xs font-light tracking-wide">{feature}</span>
                  </div>
                ))}
              </div>
              
              {/* LGPD Badge */}
              <div className="mt-8">
                <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2">
                  <div className="h-8 w-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <FileCheck className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-semibold text-white/80 uppercase tracking-wide">{whitelabel.compliance.complianceBadgeTitle}</p>
                    <p className="text-[9px] text-slate-500">{whitelabel.compliance.legalReferences}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-[9px] text-slate-600 uppercase tracking-widest">{whitelabel.credits.developerLabel}</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{whitelabel.credits.developerName}</p>
            </div>
          </div>
          
          {/* Right Panel - Form */}
          <div className="w-[55%] xl:w-1/2 bg-white flex items-center justify-center p-8 xl:p-12 relative">
            <div className="absolute inset-0 opacity-[0.01]" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #334155 1px, transparent 0)`,
              backgroundSize: '20px 20px'
            }} />
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-slate-100 to-transparent" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-slate-100 to-transparent" />
            
            <div className="w-full max-w-[320px] relative z-10 animate-in fade-in-0 slide-in-from-right-8 duration-1000 delay-300">
              {/* Form header */}
              <div className="mb-3 text-center">
                <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 shadow-md shadow-slate-800/25 mb-1.5">
                  <LogIn className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900 uppercase">Acesse sua conta</h2>
              </div>

              <form onSubmit={handleLogin} className="space-y-2">
                {/* Location selects */}
                <div className="space-y-1.5 pb-2 border-b border-gray-100">
                  <div className="group">
                    <Label htmlFor="state-select-desktop" className="text-[8px] font-semibold text-gray-500 uppercase mb-0.5 block">Estado</Label>
                    <Select value={selectedState} onValueChange={(v) => { setSelectedState(v); setSelectedHospitalId(""); }} disabled={loading || hospitalLoading}>
                      <SelectTrigger id="state-select-desktop" className={selectTriggerClass}>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {states.map((state) => (
                          <SelectItem key={state.id} value={state.id} className={selectItemClass}>{state.name} ({state.abbreviation})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="group">
                    <Label htmlFor="hospital-select-desktop" className="text-[8px] font-semibold text-gray-500 uppercase mb-0.5 block">Unidade</Label>
                    <Select value={selectedHospitalId} onValueChange={setSelectedHospitalId} disabled={loading || hospitalLoading || !selectedState}>
                      <SelectTrigger id="hospital-select-desktop" className={cn(selectTriggerClass, "disabled:opacity-50")}>
                        <SelectValue placeholder={selectedState ? "Selecione a unidade" : "Selecione o estado primeiro"} />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {filteredHospitals.map((hospital) => (
                          <SelectItem key={hospital.id} value={hospital.id} className={selectItemClass}>{hospital.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="group">
                    <Label htmlFor="department-select-desktop" className="text-[8px] font-semibold text-gray-500 uppercase mb-0.5 block">Setor</Label>
                    <Select value={selectedDepartment} onValueChange={(v: Department) => setSelectedDepartment(v)} disabled={loading}>
                      <SelectTrigger id="department-select-desktop" className={selectTriggerClass}>
                        <SelectValue placeholder="Selecione o setor" />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept} className={selectItemClass}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Credentials */}
                <div className="space-y-1.5 pt-1.5">
                  <div>
                    <Label htmlFor="login-username-desktop" className="text-[8px] font-semibold text-gray-500 uppercase mb-0.5 block">Usuário</Label>
                    <div className="relative">
                      <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                      <Input
                        id="login-username-desktop"
                        type="text"
                        value={loginData.username}
                        onChange={(e) => {
                          const v = e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '');
                          setLoginData({ ...loginData, username: v });
                          if (v === 'MEDICOUTI') setSelectedDepartment('UTI');
                          else if (v === 'MEDICOPORTA') setSelectedDepartment('URGÊNCIA E EMERGÊNCIA ADULTO');
                        }}
                        placeholder="DIGITE SEU USUÁRIO"
                        className={cn("h-7 pl-7 bg-gray-50/80 border border-gray-200 rounded text-[10px] uppercase font-medium text-gray-900 placeholder:text-[9px] placeholder:uppercase placeholder:font-normal placeholder:text-gray-500", inputFocusClass)}
                        disabled={loading}
                        maxLength={50}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="login-password-desktop" className="text-[8px] font-semibold text-gray-500 uppercase mb-0.5 block">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                      <Input
                        id="login-password-desktop"
                        type={showPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => {
                          const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                          setLoginData({ ...loginData, password: v });
                        }}
                        placeholder="EX: ABC123"
                        className={cn("h-7 pl-7 pr-7 bg-gray-50/80 border border-gray-200 rounded text-[10px] uppercase font-mono tracking-wider text-gray-900 placeholder:text-[9px] placeholder:uppercase placeholder:font-normal placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-500", inputFocusClass)}
                        disabled={loading}
                        maxLength={6}
                      />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7 text-gray-400 hover:text-gray-600" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-8 mt-1 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-900 hover:to-slate-800 text-white font-bold uppercase rounded text-[11px] shadow-md shadow-slate-800/25 transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
                >
                  {loading ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processando...</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <LogIn className="h-3.5 w-3.5" />
                      Entrar
                    </span>
                  )}
                </Button>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => setAuthMode("forgot-password")} className="text-[9px] text-gray-400 hover:text-slate-700 transition-colors">
                    Esqueci minha senha
                  </button>
                  <Button type="button" variant="ghost" onClick={() => setAuthMode("individual-signup")} className="text-slate-700 hover:text-slate-900 font-semibold text-[10px] uppercase hover:bg-slate-100 gap-1 h-6 px-2">
                    <UserPlus className="h-3 w-3" />
                    Criar conta
                  </Button>
                </div>

                <div className="flex items-center justify-center gap-1 pt-1 text-gray-300">
                  <Lock className="h-2 w-2" />
                  <span className="text-[7px] uppercase tracking-wider">Conexão criptografada</span>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ═══════════════════ MOBILE ═══════════════════ */}
        <div className="lg:hidden w-full max-w-[480px] relative z-10">
          {/* Logo Section */}
          <div className="text-center mb-5 animate-in fade-in-0 slide-in-from-top-8 duration-1000">
            <img 
              src={axiusWordmark} 
              alt="Axius" 
              className="h-10 object-contain mx-auto opacity-90 mb-2"
            />
            <p className="text-slate-500 text-xs font-light tracking-wide">{whitelabel.platform.slogan}</p>
          </div>

          {/* Login Card */}
          <div className="bg-white backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/30 p-5 border border-white/40 relative overflow-hidden animate-in fade-in-0 zoom-in-95 duration-1000 delay-500">
            {/* Header inside card */}
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center shadow-md shadow-slate-800/30">
                <LogIn className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800 uppercase">Acesse sua conta</h2>
                <p className="text-[10px] text-gray-500 italic">{whitelabel.platform.slogan.split('.')[0]}</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-2.5 relative z-10">
              {/* Location */}
              <div className="space-y-2.5 pb-2.5 border-b border-gray-200">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">LOCALIZAÇÃO</p>
                
                <div className="space-y-0.5">
                  <Label htmlFor="state-select-mobile" className="text-[10px] font-semibold text-gray-600 flex items-center gap-1 uppercase">
                    <Building2 className="h-2.5 w-2.5 text-gray-500" /> ESTADO
                  </Label>
                  <Select value={selectedState} onValueChange={(v) => { setSelectedState(v); setSelectedHospitalId(""); }} disabled={loading || hospitalLoading}>
                    <SelectTrigger id="state-select-mobile" className="h-9 bg-gray-50 dark:bg-gray-50 border border-gray-200 focus:border-slate-700 rounded-lg text-xs font-medium uppercase text-gray-900 dark:text-gray-900">
                      <SelectValue placeholder="SELECIONE O ESTADO" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {states.map((state) => (
                        <SelectItem key={state.id} value={state.id} className={selectItemClass}>{state.name} ({state.abbreviation})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-0.5">
                  <Label htmlFor="hospital-select-mobile" className="text-[10px] font-semibold text-gray-600 flex items-center gap-1 uppercase">
                    <Building2 className="h-2.5 w-2.5 text-gray-500" /> UNIDADE
                  </Label>
                  <Select value={selectedHospitalId} onValueChange={setSelectedHospitalId} disabled={loading || hospitalLoading || !selectedState}>
                    <SelectTrigger id="hospital-select-mobile" className="h-9 bg-gray-50 dark:bg-gray-50 border border-gray-200 focus:border-slate-700 rounded-lg text-xs font-medium uppercase text-gray-900 dark:text-gray-900 disabled:opacity-50">
                      <SelectValue placeholder={selectedState ? "SELECIONE" : "SELECIONE ESTADO PRIMEIRO"} />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {filteredHospitals.map((hospital) => (
                        <SelectItem key={hospital.id} value={hospital.id} className={selectItemClass}>{hospital.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-0.5">
                  <Label htmlFor="department-select-mobile" className="text-[10px] font-semibold text-gray-600 flex items-center gap-1 uppercase">
                    <Building2 className="h-2.5 w-2.5 text-gray-500" /> SETOR
                  </Label>
                  <Select value={selectedDepartment} onValueChange={(v: Department) => setSelectedDepartment(v)} disabled={loading}>
                    <SelectTrigger id="department-select-mobile" className="h-9 bg-gray-50 dark:bg-gray-50 border border-gray-200 focus:border-slate-700 rounded-lg text-xs font-medium uppercase text-gray-900 dark:text-gray-900">
                      <SelectValue placeholder="SELECIONE O SETOR" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept} className={selectItemClass}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Credentials */}
              <div className="space-y-2.5 pt-2">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">CREDENCIAIS</p>
                
                <div className="space-y-0.5">
                  <Label htmlFor="login-username-mobile" className="text-[10px] font-semibold text-gray-600 flex items-center gap-1 uppercase">
                    <User className="h-2.5 w-2.5 text-gray-500" /> USUÁRIO
                  </Label>
                  <Input
                    id="login-username-mobile"
                    type="text"
                    placeholder="DIGITE SEU USUÁRIO"
                    className="h-9 bg-gray-50 border border-gray-200 focus:border-slate-700 rounded-lg text-xs font-medium uppercase text-gray-900 placeholder:text-gray-500"
                    value={loginData.username}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '');
                      setLoginData(prev => ({ ...prev, username: v }));
                      if (v === 'MEDICOUTI') setSelectedDepartment('UTI');
                      else if (v === 'MEDICOPORTA') setSelectedDepartment('URGÊNCIA E EMERGÊNCIA ADULTO');
                    }}
                    disabled={loading}
                    autoComplete="username"
                    maxLength={50}
                  />
                  <p className="text-[8px] text-gray-400">Apenas maiúsculas e números</p>
                </div>

                <div className="space-y-0.5">
                  <Label htmlFor="login-password-mobile" className="text-[10px] font-semibold text-gray-600 flex items-center gap-1 uppercase">
                    <Lock className="h-2.5 w-2.5 text-gray-500" /> SENHA (6 CARACTERES)
                  </Label>
                  <div className="relative">
                    <Input
                      id="login-password-mobile"
                      type={showPassword ? "text" : "password"}
                      placeholder="EX: ABC123"
                      className="h-9 bg-gray-50 border border-gray-200 focus:border-slate-700 rounded-lg pr-9 text-xs font-mono uppercase tracking-widest text-gray-900 placeholder:text-gray-500"
                      value={loginData.password}
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                        setLoginData(prev => ({ ...prev, password: v }));
                      }}
                      disabled={loading}
                      autoComplete="current-password"
                      maxLength={6}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-700" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[8px] text-gray-400">{loginData.password.length}/6 • Letras e números</p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-900 hover:to-slate-800 text-white font-bold text-xs rounded-lg shadow-md shadow-slate-800/30 mt-3 uppercase"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>ENTRANDO...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-3.5 w-3.5" />
                    <span>ENTRAR</span>
                  </div>
                )}
              </Button>
            </form>

            <div className="mt-3 pt-3 border-t border-gray-100 relative z-10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setAuthMode("individual-signup")} className="text-[10px] text-slate-700 hover:text-slate-900 font-semibold uppercase flex items-center gap-1">
                  <UserPlus className="h-3 w-3" />
                  CRIAR CONTA
                </button>
                <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                  <Shield className="h-2.5 w-2.5 text-emerald-600" />
                  <span className="text-emerald-600 font-medium">LGPD</span>
                  <span className="mx-1">•</span>
                  <Lock className="h-2.5 w-2.5" />
                  <span>SEGURO</span>
                </div>
              </div>
              <button type="button" onClick={() => setAuthMode("forgot-password")} className="text-[9px] text-gray-500 hover:text-slate-700 transition-colors text-center">
                Esqueci minha senha
              </button>
            </div>
          </div>
          
          {/* LGPD Badge - Mobile */}
          <div className="flex items-center justify-center gap-2 mt-3 px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg mx-auto">
            <FileCheck className="h-3.5 w-3.5 text-emerald-400" />
            <div className="text-center">
              <p className="text-[9px] font-medium text-white/80">{whitelabel.compliance.complianceBadgeTitle}</p>
              <p className="text-[8px] text-slate-500">{whitelabel.compliance.legalReferences}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-3">
            <p className="text-slate-600 text-[9px] uppercase tracking-widest">{whitelabel.credits.developerLabel}</p>
            <p className="text-slate-500 text-[10px] font-semibold mt-0.5">{whitelabel.credits.developerName}</p>
          </div>
        </div>
      </div>
    </>
  );
}
