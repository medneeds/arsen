import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/MainLayout";
import { PasswordResetRequestsPanel } from "@/components/PasswordResetRequestsPanel";
import { UserMonitoringPanel } from "@/components/UserMonitoringPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  UserCheck,
  UserX,
  Ban,
  RefreshCw,
  Eye,
  AlertTriangle,
  Stethoscope,
  Phone,
  Mail,
  Calendar,
  Building2,
  KeyRound,
  Settings2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResetUserPasswordDialog } from "@/components/ResetUserPasswordDialog";
import { UserPermissionsDialog } from "@/components/UserPermissionsDialog";
import { useIsGestor } from "@/hooks/useIsGestor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CreateUserForm } from "@/components/users/CreateUserForm";
import { UserAuditHistoryPanel } from "@/components/users/UserAuditHistoryPanel";
import { UserApprovalsPanel } from "@/components/users/UserApprovalsPanel";
import { PreRegistrationApprovalsPanel } from "@/components/users/PreRegistrationApprovalsPanel";
import { logUserAdminAction } from "@/lib/userAdminAudit";
import { UserPlus, History, ShieldCheck, Inbox } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  crm: string | null;
  specialty: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  access_profile?: string | null;
}

interface UserWithRole extends UserProfile {
  role: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { 
    label: "Pendente", 
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20", 
    icon: <Clock className="h-3 w-3" /> 
  },
  approved: { 
    label: "Aprovado", 
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", 
    icon: <CheckCircle className="h-3 w-3" /> 
  },
  rejected: { 
    label: "Rejeitado", 
    color: "bg-red-500/10 text-red-600 border-red-500/20", 
    icon: <XCircle className="h-3 w-3" /> 
  },
  suspended: { 
    label: "Suspenso", 
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20", 
    icon: <Ban className="h-3 w-3" /> 
  },
};

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin: { label: "Coordenador", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  medico: { label: "Médico", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  porta: { label: "Porta", color: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  visitante: { label: "Visitante", color: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
};

export default function UserManagementPage() {
  const { user, role: currentUserRole } = useAuth();
  const isGestor = useIsGestor();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<UserWithRole | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [userToManagePermissions, setUserToManagePermissions] = useState<UserWithRole | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles (incluindo access_profile)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || null,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    setActionLoading(true);
    try {
      const target = users.find((u) => u.id === userId);
      const { error } = await supabase
        .from("profiles")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq("id", userId);

      if (error) throw error;

      await logUserAdminAction({
        action: "user.status.approved",
        targetUserId: userId,
        targetEmail: target?.email ?? null,
        targetName: target?.full_name ?? null,
        oldData: { status: target?.status },
        newData: { status: "approved" },
      });

      toast.success("Usuário aprovado com sucesso");
      fetchUsers();
      setDetailsOpen(false);
    } catch (error) {
      console.error("Error approving user:", error);
      toast.error("Erro ao aprovar usuário");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (userId: string) => {
    setActionLoading(true);
    try {
      const target = users.find((u) => u.id === userId);
      const { error } = await supabase
        .from("profiles")
        .update({
          status: "rejected",
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq("id", userId);

      if (error) throw error;

      await logUserAdminAction({
        action: "user.status.rejected",
        targetUserId: userId,
        targetEmail: target?.email ?? null,
        targetName: target?.full_name ?? null,
        oldData: { status: target?.status },
        newData: { status: "rejected" },
      });

      toast.success("Usuário rejeitado");
      fetchUsers();
      setDetailsOpen(false);
    } catch (error) {
      console.error("Error rejecting user:", error);
      toast.error("Erro ao rejeitar usuário");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async (userId: string) => {
    setActionLoading(true);
    try {
      const target = users.find((u) => u.id === userId);
      const { error } = await supabase
        .from("profiles")
        .update({ status: "suspended" })
        .eq("id", userId);

      if (error) throw error;

      await logUserAdminAction({
        action: "user.status.suspended",
        targetUserId: userId,
        targetEmail: target?.email ?? null,
        targetName: target?.full_name ?? null,
        oldData: { status: target?.status },
        newData: { status: "suspended" },
      });

      toast.success("Usuário suspenso");
      fetchUsers();
      setDetailsOpen(false);
    } catch (error) {
      console.error("Error suspending user:", error);
      toast.error("Erro ao suspender usuário");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (userId: string) => {
    setActionLoading(true);
    try {
      const target = users.find((u) => u.id === userId);
      const { error } = await supabase
        .from("profiles")
        .update({ status: "approved" })
        .eq("id", userId);

      if (error) throw error;

      await logUserAdminAction({
        action: "user.status.reactivated",
        targetUserId: userId,
        targetEmail: target?.email ?? null,
        targetName: target?.full_name ?? null,
        oldData: { status: target?.status },
        newData: { status: "approved" },
      });

      toast.success("Usuário reativado");
      fetchUsers();
      setDetailsOpen(false);
    } catch (error) {
      console.error("Error reactivating user:", error);
      toast.error("Erro ao reativar usuário");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setActionLoading(true);
    try {
      const target = users.find((u) => u.id === userId);
      const previousRole = target?.role ?? null;
      // Check if user has a role already
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole as any })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole as any });
        if (error) throw error;
      }

      await logUserAdminAction({
        action: "user.role.updated",
        targetUserId: userId,
        targetEmail: target?.email ?? null,
        targetName: target?.full_name ?? null,
        appRole: newRole,
        oldData: { role: previousRole },
        newData: { role: newRole },
      });

      toast.success("Papel atualizado com sucesso");
      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Erro ao atualizar papel");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.full_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (u.email?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (u.crm?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const pendingCount = users.filter(u => u.status === "pending").length;
  const [preRegPending, setPreRegPending] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("pre_registration_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!cancelled) setPreRegPending(count || 0);
    })();
    return () => { cancelled = true; };
  }, []);

  // Coordenadores (admin) e Gestores podem acessar a gestão de usuários
  const canManageUsers = currentUserRole === "admin" || isGestor;

  if (!canManageUsers) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
            <p className="text-muted-foreground mt-2">
              Você não tem permissão para acessar esta página.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Gestão de Usuários
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie aprovações e permissões de acesso • Conformidade LGPD
              </p>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-600">
                {pendingCount} usuário{pendingCount > 1 ? "s" : ""} aguardando aprovação
              </span>
            </div>
          )}
        </div>

        <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") || "list"} className="space-y-4">
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <Users className="h-4 w-4" /> Lista de Usuários
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Aprovações
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            {(currentUserRole === "admin" || isGestor) && (
              <TabsTrigger value="create" className="gap-2">
                <UserPlus className="h-4 w-4" /> Cadastrar Usuário
              </TabsTrigger>
            )}
            <TabsTrigger value="audit" className="gap-2">
              <History className="h-4 w-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approvals">
            <UserApprovalsPanel />
          </TabsContent>

          <TabsContent value="list" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou CRM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                  <SelectItem value="suspended">Suspensos</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={fetchUsers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {/* Users Table */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold text-xs">Usuário</TableHead>
                    <TableHead className="font-bold text-xs">CRM</TableHead>
                    <TableHead className="font-bold text-xs">Status</TableHead>
                    <TableHead className="font-bold text-xs">Papel</TableHead>
                    <TableHead className="font-bold text-xs">Cadastro</TableHead>
                    <TableHead className="font-bold text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Carregando usuários...</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Users className="h-6 w-6 mx-auto text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Nenhum usuário encontrado</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => {
                      const statusConfig = STATUS_CONFIG[u.status] || STATUS_CONFIG.pending;
                      const roleConfig = u.role ? ROLE_CONFIG[u.role] : null;

                      return (
                        <TableRow key={u.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {u.full_name || "—"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {u.email?.replace("@sistema.local", "") || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-mono">{u.crm || "—"}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${statusConfig.color} gap-1`}>
                              {statusConfig.icon}
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {roleConfig ? (
                              <Badge variant="outline" className={roleConfig.color}>
                                {roleConfig.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Ver detalhes"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setDetailsOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Gerenciar setores e permissões"
                                onClick={() => {
                                  setUserToManagePermissions(u);
                                  setPermissionsOpen(true);
                                }}
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <UserMonitoringPanel />
            <PasswordResetRequestsPanel />
          </TabsContent>

          {(currentUserRole === "admin" || isGestor) && (
            <TabsContent value="create">
              <div className="rounded-xl border bg-card shadow-sm p-6">
                <CreateUserForm onCreated={fetchUsers} />
              </div>
            </TabsContent>
          )}

          <TabsContent value="audit">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <UserAuditHistoryPanel />
            </div>
          </TabsContent>
        </Tabs>

        {/* LGPD Notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <Shield className="h-4 w-4" />
          <span>
            Todos os dados de usuários são tratados conforme a Lei 13.709/2018 (LGPD).
            Alterações de status são registradas na trilha de auditoria.
          </span>
        </div>
      </div>


      {/* User Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Detalhes do Usuário
            </DialogTitle>
            <DialogDescription>
              Visualize e gerencie as informações do usuário
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Stethoscope className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedUser.full_name || "Sem nome"}</h3>
                    <Badge variant="outline" className={STATUS_CONFIG[selectedUser.status]?.color || ""}>
                      {STATUS_CONFIG[selectedUser.status]?.icon}
                      {STATUS_CONFIG[selectedUser.status]?.label}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email/Login
                    </p>
                    <p className="text-sm font-mono">{selectedUser.email?.replace("@sistema.local", "") || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" /> CRM
                    </p>
                    <p className="text-sm font-mono">{selectedUser.crm || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Especialidade
                    </p>
                    <p className="text-sm">{selectedUser.specialty || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telefone
                    </p>
                    <p className="text-sm">{selectedUser.phone || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Data de Cadastro
                    </p>
                    <p className="text-sm">
                      {format(new Date(selectedUser.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {selectedUser.approved_at && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Data de Aprovação
                      </p>
                      <p className="text-sm">
                        {format(new Date(selectedUser.approved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Role Management */}
              <div className="space-y-2 pt-4 border-t">
                <p className="text-xs text-muted-foreground font-semibold">Papel no Sistema</p>
                <Select
                  value={selectedUser.role || "medico"}
                  onValueChange={(value) => handleUpdateRole(selectedUser.id, value)}
                  disabled={actionLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medico">Médico</SelectItem>
                    <SelectItem value="porta">Porta</SelectItem>
                    <SelectItem value="visitante">Visitante</SelectItem>
                    <SelectItem value="admin">Coordenador (Admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-4 border-t">
                {/* Password Reset Button - Always visible */}
                <Button
                  variant="outline"
                  className="w-full text-amber-600 border-amber-600 hover:bg-amber-50"
                  onClick={() => {
                    setUserToResetPassword(selectedUser);
                    setResetPasswordOpen(true);
                  }}
                  disabled={actionLoading}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Redefinir Senha
                </Button>

                <div className="flex gap-2">
                  {selectedUser.status === "pending" && (
                    <>
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleApprove(selectedUser.id)}
                        disabled={actionLoading}
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Aprovar
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleReject(selectedUser.id)}
                        disabled={actionLoading}
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Rejeitar
                      </Button>
                    </>
                  )}
                  
                  {selectedUser.status === "approved" && (
                    <Button
                      variant="outline"
                      className="flex-1 text-gray-600 border-gray-400 hover:bg-gray-50"
                      onClick={() => handleSuspend(selectedUser.id)}
                      disabled={actionLoading}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Suspender
                    </Button>
                  )}
                  
                  {(selectedUser.status === "suspended" || selectedUser.status === "rejected") && (
                    <Button
                      variant="outline"
                      className="flex-1 text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                      onClick={() => handleReactivate(selectedUser.id)}
                      disabled={actionLoading}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reativar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      {userToResetPassword && (
        <ResetUserPasswordDialog
          open={resetPasswordOpen}
          onOpenChange={setResetPasswordOpen}
          userId={userToResetPassword.id}
          userName={userToResetPassword.full_name || ""}
          userEmail={userToResetPassword.email || ""}
          onSuccess={fetchUsers}
        />
      )}

      {/* Permissions / Sectors Dialog */}
      {userToManagePermissions && (
        <UserPermissionsDialog
          open={permissionsOpen}
          onOpenChange={(open) => {
            setPermissionsOpen(open);
            if (!open) setUserToManagePermissions(null);
          }}
          userId={userToManagePermissions.id}
          userName={userToManagePermissions.full_name || "Usuário"}
          userEmail={userToManagePermissions.email || ""}
          currentRole={userToManagePermissions.role}
          currentAccessProfile={userToManagePermissions.access_profile}
          onSaved={fetchUsers}
        />
      )}
    </MainLayout>
  );
}
