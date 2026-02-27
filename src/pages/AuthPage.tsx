import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, User, Lock, Eye, EyeOff } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";

const SLATE = {
  bg: "from-[#0f172a] via-[#1e293b] to-[#334155]",
} as const;

export default function AuthPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  
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
        `min-h-screen bg-gradient-to-br ${SLATE.bg} flex items-center justify-center p-4 relative overflow-hidden transition-opacity duration-500`,
        showLoadingScreen && "opacity-0"
      )}>
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-32 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-3xl animate-pulse [animation-delay:1.5s]" />
        </div>

        <div className="w-full max-w-sm relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white tracking-wider mb-2">UTI 2</h1>
            <p className="text-slate-400 text-sm">Hospital Municipal Djalma Marques</p>
            <p className="text-slate-500 text-xs mt-1">Socorrão I</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 p-6">
            <div className="mb-4 text-center">
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 shadow-md mb-2">
                <LogIn className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-sm font-bold text-gray-900 uppercase">Acesse sua conta</h2>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Usuário</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    value={loginData.username}
                    onChange={(e) => setLoginData({ ...loginData, username: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '') })}
                    placeholder="DIGITE SEU USUÁRIO"
                    className="pl-10 h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase font-medium text-gray-900 placeholder:text-gray-400 focus:border-slate-700 focus:ring-1 focus:ring-slate-700/10"
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value.toUpperCase() })}
                    placeholder="DIGITE SUA SENHA"
                    className="pl-10 pr-10 h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase font-medium text-gray-900 placeholder:text-gray-400 focus:border-slate-700 focus:ring-1 focus:ring-slate-700/10"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-900 hover:to-slate-800 text-white font-semibold uppercase text-xs rounded-lg shadow-lg"
              >
                {loading ? "ENTRANDO..." : "ENTRAR"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
