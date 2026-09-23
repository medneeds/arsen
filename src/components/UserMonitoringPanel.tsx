// MIGRAÇÃO: painel degradado. O schema novo não tem os insumos do monitoramento
// em tempo real antigo (audit_logs com LOGIN/LOGOUT, presença por user_roles,
// last_activity). Tabelas antigas (audit_logs, profiles, user_roles) não existem
// mais. O painel agora mostra um resumo simples de `profissionais`: total, ativos,
// inativos e a distribuição por papel — tudo agregado no cliente.
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, UserCheck, UserX, RefreshCw, BarChart3 } from "lucide-react";

// MIGRAÇÃO: rótulos do enum papel_profissional (substitui ROLE_CONFIG antigo).
const PAPEL_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  medico: "Médico",
  enfermeiro: "Enfermeiro",
  tecnico: "Técnico",
  regulador: "Regulador",
  farmacia: "Farmácia",
  nir: "NIR",
  porta: "Porta",
  visitante: "Visitante",
  coordenador: "Coordenador",
  dev: "Dev",
};

interface Summary {
  total: number;
  ativos: number;
  inativos: number;
  porPapel: { papel: string; total: number; ativos: number }[];
}

export function UserMonitoringPanel() {
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    ativos: 0,
    inativos: 0,
    porPapel: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      // MIGRAÇÃO: consulta RLS-scoped ao hospital do usuário atual.
      const { data, error } = await supabase
        .from("profissionais")
        .select("papel, ativo");
      if (error) throw error;

      const rows = (data as { papel: string; ativo: boolean }[]) || [];
      const ativos = rows.filter((r) => r.ativo).length;

      const byPapel = new Map<string, { total: number; ativos: number }>();
      rows.forEach((r) => {
        const entry = byPapel.get(r.papel) || { total: 0, ativos: 0 };
        entry.total += 1;
        if (r.ativo) entry.ativos += 1;
        byPapel.set(r.papel, entry);
      });

      const porPapel = Array.from(byPapel.entries())
        .map(([papel, v]) => ({ papel, ...v }))
        .sort((a, b) => b.total - a.total);

      setSummary({
        total: rows.length,
        ativos,
        inativos: rows.length - ativos,
        porPapel,
      });
    } catch (error) {
      console.error("Error fetching monitoring data:", error);
      toast.error("Erro ao carregar resumo de usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Resumo de Usuários</CardTitle>
              <CardDescription>
                Visão geral dos profissionais cadastrados no hospital
              </CardDescription>
            </div>
          </div>
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-3xl font-bold text-blue-600">{summary.total}</p>
                  <p className="text-xs text-muted-foreground">Total de usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserCheck className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-3xl font-bold text-green-600">{summary.ativos}</p>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserX className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-3xl font-bold text-orange-600">{summary.inativos}</p>
                  <p className="text-xs text-muted-foreground">Inativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown by papel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Distribuição por papel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : summary.porPapel.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Nenhum profissional cadastrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {summary.porPapel.map((p) => (
                  <div
                    key={p.papel}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <Badge variant="outline" className="text-xs">
                      {PAPEL_LABEL[p.papel] || p.papel}
                    </Badge>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-600">{p.ativos} ativos</span>
                      <span className="font-medium text-foreground">{p.total} total</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
