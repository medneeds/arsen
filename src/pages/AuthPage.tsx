import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, User, Lock, Eye, EyeOff, Building2 } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";
import { whitelabel } from "@/config/whitelabel";
import bighelpLogo from "@/assets/bighelp-map-logo.png";
import { useDepartment, DEPARTMENTS, Department } from "@/contexts/DepartmentContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AuthPage() {
  const { user, signIn } = useAuth();
  const { setCurrentDepartment } = useDepartment();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department>("UTI");
  
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
        setCurrentDepartment(selectedDepartment);
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
      
      <div className={cn(
        "min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#1a3a5c] flex items-center justify-center p-4 relative overflow-hidden transition-opacity duration-500",
        showLoadingScreen && "opacity-0"
      )}>
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-[#0f2847] to-[#1a3a5c] hover:from-[#0a1628] hover:to-[#0f2847] text-white font-semibold uppercase text-xs rounded-xl shadow-lg tracking-wider transition-all duration-300"
              >
                {loading ? "ENTRANDO..." : "ENTRAR"}
              </Button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-slate-600 mt-6 tracking-widest uppercase font-light">
            {whitelabel.credits.authorSignature}
          </p>
        </div>
      </div>
    </>
  );
}
