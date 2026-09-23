// MIGRAÇÃO: painel reaproveitado. O schema novo (profissionais) não tem estado
// "perfil pendente" — usuários novos já nascem ativos, e a aprovação de NOVOS
// acessos vive apenas em `solicitacoes_pre_cadastro` (aba "Pré-cadastros").
// Este painel foi repontado para "Reativações": lista profissionais inativos
// (ativo = false) do hospital e permite reativá-los. Tabelas antigas
// (profiles, user_roles, user_admin_audit) não existem mais e foram removidas.
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  CheckCircle2,
  Search,
  RefreshCw,
  Mail,
  Info,
  UserCheck,
  UserX,
} from "lucide-react";
import { logUserAdminAction } from "@/lib/userAdminAudit";

// MIGRAÇÃO: enum papel_profissional (era access_profile/role no schema antigo).
type Papel = "super_admin" | "admin" | "medico" | "enfermeiro" | "tecnico" |
  "regulador" | "farmacia" | "nir" | "porta" | "visitante" | "coordenador" | "dev";

interface InactiveProfessional {
  id: string;
  nome: string;
  email: string | null;
  papel: Papel;
  ativo: boolean;
}

const PAPEL_LABEL: Record<Papel, string> = {
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

export function UserApprovalsPanel() {
  const [profissionais, setProfissionais] = useState<InactiveProfessional[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [target, setTarget] = useState<InactiveProfessional | null>(null);
  const [acting, setActing] = useState(false);

  // MIGRAÇÃO: só profissionais inativos. Consulta é RLS-scoped ao hospital do
  // usuário atual, então não precisamos filtrar hospital_id no cliente.
  const fetchProfissionais = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome, email, papel, ativo")
        .eq("ativo", false)
        .order("nome", { ascending: true });
      if (error) throw error;
      setProfissionais((data as InactiveProfessional[]) || []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar usuários inativos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfissionais();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return profissionais;
    return profissionais.filter(
      (p) =>
        (p.nome || "").toLowerCase().includes(term) ||
        (p.email || "").toLowerCase().includes(term),
    );
  }, [profissionais, search]);

  const submitReactivation = async () => {
    if (!target) return;
    setActing(true);
    try {
      // MIGRAÇÃO: aprovar/recusar/suspender virou um único "reativar"
      // (ativo = true). O único estado de acesso é profissionais.ativo.
      const { error: updErr } = await supabase
        .from("profissionais")
        .update({ ativo: true })
        .eq("id", target.id);

      if (updErr) {
        console.error("[Reativação] erro no UPDATE profissionais:", updErr);
        toast.error(`Erro ao reativar: ${updErr.message}`);
        return;
      }

      try {
        await logUserAdminAction({
          action: "user.status.reactivated",
          targetUserId: target.id,
          targetEmail: target.email,
          targetName: target.nome,
          oldData: { ativo: false },
          newData: { ativo: true },
        });
      } catch (auditErr) {
        console.warn("[Reativação] auditoria falhou (não bloqueante):", auditErr);
      }

      toast.success("Usuário reativado");
      setTarget(null);
      fetchProfissionais();
    } catch (e: any) {
      console.error("[Reativação] erro inesperado:", e);
      toast.error(`Erro: ${e?.message || "falha inesperada"}`);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* MIGRAÇÃO: cabeçalho explicando que a aprovação de NOVOS usuários migrou. */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Reativações de acesso</p>
          <p className="text-muted-foreground">
            A aprovação de <strong>novos</strong> usuários acontece agora na aba{" "}
            <strong>Pré-cadastros</strong>. Aqui você reativa profissionais que
            foram desativados (acesso suspenso).
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-700 font-medium">Inativos</p>
              <p className="text-2xl font-bold text-amber-700">{profissionais.length}</p>
            </div>
            <UserX className="h-8 w-8 text-amber-500/50" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={fetchProfissionais} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-bold">Profissional</TableHead>
              <TableHead className="text-xs font-bold">Papel</TableHead>
              <TableHead className="text-xs font-bold">Status</TableHead>
              <TableHead className="text-xs font-bold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <UserCheck className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum usuário inativo.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{p.nome || "—"}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {p.email?.replace("@sistema.local", "") || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {PAPEL_LABEL[p.papel] || p.papel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="bg-gray-500/10 text-gray-700 border-gray-500/20 gap-1"
                    >
                      <UserX className="h-3 w-3" />
                      Inativo
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10"
                      onClick={() => setTarget(p)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Reativar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reactivation confirmation dialog */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Reativar usuário
            </DialogTitle>
            <DialogDescription>
              {target?.nome} • {target?.email?.replace("@sistema.local", "")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O profissional voltará a ter acesso ao sistema imediatamente. A ação é
            registrada na trilha de auditoria.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={acting}>
              Cancelar
            </Button>
            <Button
              onClick={submitReactivation}
              disabled={acting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {acting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirmar reativação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
