import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/MainLayout";
import { GestaoUsuarios } from "@/components/admin/GestaoUsuarios";
import { useIsGestor } from "@/hooks/useIsGestor";
import { Shield, Loader2, Users } from "lucide-react";

// MIGRAÇÃO: página reescrita como wrapper fino sobre <GestaoUsuarios>, que roda
// no schema novo (profissionais / solicitacoes_pre_cadastro / logs_auditoria).
// A mesma UI é montada dentro do painel do admin do hospital (/painel-admin).
export default function UserManagementPage() {
  const { role } = useAuth();
  const isGestor = useIsGestor();
  const canManageUsers = role === "admin" || role === "super_admin" || isGestor;

  const { data: hospitalId, isLoading } = useQuery({
    queryKey: ["um-hospital"],
    enabled: canManageUsers,
    queryFn: async () => {
      const { data, error } = await supabase.from("hospitais").select("id").limit(1).maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  if (!canManageUsers) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
            <p className="text-muted-foreground mt-2">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestão de Usuários</h1>
            <p className="text-sm text-muted-foreground">Gerencie aprovações e acessos • Conformidade LGPD</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...</div>
        ) : !hospitalId ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Nenhum hospital vinculado à sua conta.</p>
        ) : (
          <GestaoUsuarios hospitalId={hospitalId} />
        )}
      </div>
    </MainLayout>
  );
}
