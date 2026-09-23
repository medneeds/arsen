import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  KeyRound,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  Shield,
  Copy,
} from "lucide-react";

// MIGRAÇÃO: tabela antiga `password_reset_requests` (inglês) foi removida.
// Origem/destino agora é `solicitacoes_redefinicao_senha` (schema pt-BR).
// Mapeamento de colunas:
//   username        -> nome_usuario
//   user_id         -> usuario_id (auth uid, nullable)
//   requested_at    -> solicitado_em
//   reviewed_at     -> avaliado_em
//   reviewed_by     -> avaliado_por
//   reviewer_notes  -> observacoes_avaliador
//   + nova_senha_definida_em (timestamp)
// Status agora em pt: 'pendente' | 'aprovado' | 'reprovado'.
// RLS desabilitada -> legível/gravável por qualquer usuário autenticado.
// Não há coluna hospital_id nesta tabela -> não é possível escopar por hospital no DB.
interface PasswordResetRequest {
  id: string;
  usuario_id: string | null;
  nome_usuario: string;
  crm: string;
  status: string;
  solicitado_em: string;
  avaliado_em: string | null;
  avaliado_por: string | null;
  observacoes_avaliador: string | null;
  nova_senha_definida_em: string | null;
}

type PasswordResetRequestsPanelProps = {
  // MIGRAÇÃO: aceito por compatibilidade, mas ignorado — a tabela
  // solicitacoes_redefinicao_senha não possui hospital_id para escopo no DB.
  hospitalId?: string;
};

export function PasswordResetRequestsPanel(_props: PasswordResetRequestsPanelProps = {}) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [resetTarget, setResetTarget] = useState<{ email: string; nome: string } | null>(null);

  const getFunctionErrorMessage = async (error: unknown) => {
    const err = error as { message?: string; context?: Response };
    if (err.context) {
      try {
        const body = await err.context.clone().json();
        if (body?.error) return body.error as string;
      } catch {
        // mantém fallback abaixo
      }
    }
    return err.message || "Erro ao redefinir senha";
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("solicitacoes_redefinicao_senha")
        .select("*")
        .order("solicitado_em", { ascending: false });

      if (error) throw error;
      setRequests((data as PasswordResetRequest[]) || []);
    } catch (error) {
      console.error("Erro ao buscar solicitações:", error);
      toast.error("Não foi possível carregar solicitações");
    } finally {
      setLoading(false);
    }
  };

  // MIGRAÇÃO: fluxo antigo (admin digitava a senha + edge function reset-user-password)
  // foi substituído. Agora a edge function "resetar-senha-profissional" gera uma
  // senha provisória e a retorna; o painel apenas a exibe para o coordenador copiar.
  const handleApproveReset = async () => {
    if (!selectedRequest) return;

    if (!selectedRequest.usuario_id) {
      toast.error("Usuário não vinculado no sistema");
      return;
    }

    setProcessing(true);
    try {
      // 1) Localiza o profissional pelo auth uid (usuario_id -> profissionais.user_id)
      const { data: prof, error: profError } = await supabase
        .from("profissionais")
        .select("id, email, nome")
        .eq("user_id", selectedRequest.usuario_id)
        .maybeSingle();

      if (profError) throw profError;
      if (!prof) {
        throw new Error("Profissional não encontrado para este usuário");
      }

      // 2) Chama a edge function que gera a nova senha provisória
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: resetError } = await supabase.functions.invoke(
        "resetar-senha-profissional",
        {
          body: { profissionalId: prof.id },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        }
      );

      if (resetError) {
        console.error("Erro da edge function:", resetError);
        throw new Error(await getFunctionErrorMessage(resetError));
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      const tempPass: string = data?.tempPassword ?? "";
      const email: string = data?.email ?? prof.email ?? "";
      const nome: string = data?.nome ?? prof.nome ?? selectedRequest.nome_usuario;

      // 3) Marca a solicitação como aprovada
      const nowIso = new Date().toISOString();
      const { error: approveError } = await supabase
        .from("solicitacoes_redefinicao_senha")
        .update({
          status: "aprovado",
          avaliado_em: nowIso,
          avaliado_por: user?.id ?? null,
          nova_senha_definida_em: nowIso,
          observacoes_avaliador: "Nova senha provisória gerada pelo coordenador",
        })
        .eq("id", selectedRequest.id);

      if (approveError) throw approveError;

      // 4) Exibe a senha provisória para cópia
      setTempPassword(tempPass);
      setResetTarget({ email, nome });
      toast.success(`Senha provisória gerada para ${nome}`);
      fetchRequests();
    } catch (error) {
      console.error("Erro ao aprovar solicitação:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao processar aprovação");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("solicitacoes_redefinicao_senha")
        .update({
          status: "reprovado",
          avaliado_em: new Date().toISOString(),
          avaliado_por: user?.id ?? null,
          observacoes_avaliador: rejectReason || "Solicitação recusada",
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast.success("Solicitação recusada");
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectReason("");
      fetchRequests();
    } catch (error) {
      console.error("Erro ao recusar solicitação:", error);
      toast.error("Erro ao recusar solicitação");
    } finally {
      setProcessing(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("Senha copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const closeResetDialog = () => {
    setShowResetDialog(false);
    setSelectedRequest(null);
    setTempPassword("");
    setResetTarget(null);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
      pendente: { variant: "secondary", label: "Pendente", icon: <Clock className="h-3 w-3" /> },
      aprovado: { variant: "default", label: "Aprovado", icon: <CheckCircle className="h-3 w-3" /> },
      reprovado: { variant: "destructive", label: "Reprovado", icon: <XCircle className="h-3 w-3" /> },
    };
    const badge = badges[status] || badges.pendente;
    return (
      <Badge variant={badge.variant} className="flex items-center gap-1">
        {badge.icon}
        {badge.label}
      </Badge>
    );
  };

  const pendingCount = requests.filter((r) => r.status === "pendente").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Solicitações de Reset de Senha
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingCount} pendente(s)
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Gerencie as solicitações de redefinição de senha dos usuários
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma solicitação de reset de senha</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>CRM</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Solicitado em</TableHead>
                <TableHead>Avaliado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.nome_usuario}</TableCell>
                  <TableCell>{request.crm}</TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    {format(new Date(request.solicitado_em), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>
                    {request.avaliado_em
                      ? format(new Date(request.avaliado_em), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {request.status === "pendente" ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setSelectedRequest(request);
                            setTempPassword("");
                            setResetTarget(null);
                            setShowResetDialog(true);
                          }}
                        >
                          <KeyRound className="h-4 w-4 mr-1" />
                          Gerar nova senha
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowRejectDialog(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Recusar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          toast.info(request.observacoes_avaliador || "Sem observações");
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Dialog de Geração de nova senha */}
        <Dialog open={showResetDialog} onOpenChange={(o) => { if (!o) closeResetDialog(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar nova senha</DialogTitle>
              <DialogDescription>
                Uma senha provisória será gerada para o usuário{" "}
                <strong>{selectedRequest?.nome_usuario}</strong>. Repasse-a com segurança.
              </DialogDescription>
            </DialogHeader>

            {tempPassword ? (
              <div className="space-y-4 py-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs text-emerald-800">
                    Senha provisória gerada com sucesso
                    {resetTarget?.email ? ` para ${resetTarget.email}` : ""}.
                    Copie e informe ao usuário — ela não será exibida novamente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Senha provisória</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono break-all">
                      {tempPassword}
                    </code>
                    <Button type="button" variant="outline" size="icon" onClick={copyPassword} title="Copiar senha">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    A senha será gerada automaticamente pelo sistema e exibida aqui para cópia.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              {tempPassword ? (
                <Button onClick={closeResetDialog}>Concluir</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={closeResetDialog}>
                    Cancelar
                  </Button>
                  <Button onClick={handleApproveReset} disabled={processing}>
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      "Gerar senha provisória"
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Recusa */}
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Recusar Solicitação</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja recusar a solicitação de{" "}
                <strong>{selectedRequest?.nome_usuario}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label>Motivo da Recusa (opcional)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Informe o motivo da recusa..."
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReject}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={processing}
              >
                {processing ? "Processando..." : "Recusar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
