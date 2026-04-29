import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";

interface PasswordResetRequest {
  id: string;
  user_id: string | null;
  username: string;
  crm: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_notes: string | null;
}

export function PasswordResetRequestsPanel() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("password_reset_requests")
        .select("*")
        .order("requested_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Erro ao buscar solicitações:", error);
      toast.error("Erro ao carregar solicitações");
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 6 || password.length > 12) {
      return "Senha deve ter entre 6 e 12 caracteres";
    }
    return null;
  };

  const handleApproveReset = async () => {
    if (!selectedRequest || !newPassword) return;

    const validationError = validatePassword(newPassword);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (!selectedRequest.user_id) {
      toast.error("Usuário não encontrado no sistema");
      return;
    }

    setProcessing(true);
    try {
      // Primeiro, atualizar status para aprovado
      const { error: approveError } = await supabase
        .from("password_reset_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          reviewer_notes: `Nova senha definida pelo coordenador`,
        })
        .eq("id", selectedRequest.id);

      if (approveError) throw approveError;

      // Chamar edge function para resetar a senha
      const { data, error: resetError } = await supabase.functions.invoke(
        "reset-user-password",
        {
          body: {
            userId: selectedRequest.user_id,
            newPassword: newPassword,
            requestId: selectedRequest.id,
          },
        }
      );

      if (resetError) {
        console.error("Erro da edge function:", resetError);
        throw new Error(resetError.message || "Erro ao redefinir senha");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(
        `Senha redefinida com sucesso! Informe ao usuário ${selectedRequest.username} que a nova senha é: ${newPassword}`
      );
      setShowResetDialog(false);
      setSelectedRequest(null);
      setNewPassword("");
      setConfirmPassword("");
      fetchRequests();
    } catch (error: any) {
      console.error("Erro ao aprovar solicitação:", error);
      toast.error(error.message || "Erro ao processar aprovação");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("password_reset_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          reviewer_notes: rejectReason || "Solicitação rejeitada",
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast.success("Solicitação rejeitada");
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectReason("");
      fetchRequests();
    } catch (error) {
      console.error("Erro ao rejeitar solicitação:", error);
      toast.error("Erro ao rejeitar solicitação");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
      pending: { variant: "secondary", label: "Pendente", icon: <Clock className="h-3 w-3" /> },
      approved: { variant: "default", label: "Aprovado", icon: <CheckCircle className="h-3 w-3" /> },
      rejected: { variant: "destructive", label: "Rejeitado", icon: <XCircle className="h-3 w-3" /> },
      completed: { variant: "outline", label: "Concluído", icon: <CheckCircle className="h-3 w-3" /> },
    };
    const badge = badges[status] || badges.pending;
    return (
      <Badge variant={badge.variant} className="flex items-center gap-1">
        {badge.icon}
        {badge.label}
      </Badge>
    );
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

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
                <TableHead>Revisado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.username}</TableCell>
                  <TableCell>{request.crm}</TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    {format(new Date(request.requested_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>
                    {request.reviewed_at
                      ? format(new Date(request.reviewed_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {request.status === "pending" ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowResetDialog(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprovar
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
                          Rejeitar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          toast.info(request.reviewer_notes || "Sem observações");
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

        {/* Dialog de Aprovação */}
        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Definir Nova Senha</DialogTitle>
              <DialogDescription>
                Defina uma nova senha para o usuário{" "}
                <strong>{selectedRequest?.username}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Política de Senha:</strong> Exatamente 6 caracteres, 
                  apenas letras maiúsculas e números.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Nova Senha *</Label>
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  placeholder="EX: ABC123"
                  maxLength={6}
                   className=""
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar Senha *</Label>
                <Input
                  type="text"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  placeholder="REPITA A SENHA"
                  maxLength={6}
                  className=""
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResetDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleApproveReset} disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Confirmar Nova Senha"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Rejeição */}
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rejeitar Solicitação</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja rejeitar a solicitação de{" "}
                <strong>{selectedRequest?.username}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label>Motivo da Rejeição (opcional)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Informe o motivo da rejeição..."
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
                {processing ? "Processando..." : "Rejeitar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
