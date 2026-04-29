import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsGestor } from "@/hooks/useIsGestor";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Rota /signup — acesso restrito.
 * - Não autenticado: redireciona para /auth.
 * - Autenticado mas sem permissão (não admin / não gestor): mostra 403.
 * - Autenticado com permissão: redireciona para a aba "Cadastrar Usuário"
 *   em /gestao-usuarios.
 */
export default function SignupRedirectPage() {
  const { user, role, loading } = useAuth();
  const isGestor = useIsGestor();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && (role === "admin" || isGestor)) {
      navigate("/gestao-usuarios?tab=create", { replace: true });
    }
  }, [user, role, isGestor, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Autenticado sem permissão
  if (role !== "admin" && !isGestor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-lg">
          <div className="mx-auto h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <ShieldAlert className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Acesso restrito
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            O cadastro de usuários é uma operação interna disponível apenas para
            <strong className="text-foreground"> coordenadores e gestores</strong>.
            Solicite seu cadastro à coordenação da unidade.
          </p>
          <Button onClick={() => navigate("/", { replace: true })} className="w-full">
            Voltar para o painel
          </Button>
        </div>
      </div>
    );
  }

  // fallback enquanto efetua o redirect
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
