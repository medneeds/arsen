import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  History,
  Eye,
  Mail,
  Phone,
  Stethoscope,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { logUserAdminAction } from "@/lib/userAdminAudit";

interface PendingProfile {
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
  access_profile: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  actor_email: string | null;
  actor_name: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
  metadata: any;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20", icon: Clock },
  approved: { label: "Aprovado", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", icon: CheckCircle2 },
  rejected: { label: "Recusado", cls: "bg-red-500/10 text-red-700 border-red-500/20", icon: XCircle },
  suspended: { label: "Suspenso", cls: "bg-gray-500/10 text-gray-700 border-gray-500/20", icon: UserX },
};

export function UserApprovalsPanel() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [search, setSearch] = useState("");

  const [decisionTarget, setDecisionTarget] = useState<PendingProfile | null>(null);
  const [decisionType, setDecisionType] = useState<"approve" | "reject" | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [acting, setActing] = useState(false);

  const [historyTarget, setHistoryTarget] = useState<PendingProfile | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, crm, specialty, phone, status, created_at, approved_at, approved_by, access_profile")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProfiles((data as any) || []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar cadastros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const counters = useMemo(() => {
    return {
      pending: profiles.filter((p) => p.status === "pending").length,
      approved: profiles.filter((p) => p.status === "approved").length,
      rejected: profiles.filter((p) => p.status === "rejected").length,
      all: profiles.length,
    };
  }, [profiles]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return profiles
      .filter((p) => (tab === "all" ? true : p.status === tab))
      .filter((p) => {
        if (!term) return true;
        return (
          (p.full_name || "").toLowerCase().includes(term) ||
          (p.email || "").toLowerCase().includes(term) ||
          (p.crm || "").toLowerCase().includes(term)
        );
      });
  }, [profiles, tab, search]);

  const openDecision = (profile: PendingProfile, type: "approve" | "reject") => {
    setDecisionTarget(profile);
    setDecisionType(type);
    setDecisionNote("");
  };

  const closeDecision = () => {
    setDecisionTarget(null);
    setDecisionType(null);
    setDecisionNote("");
  };

  const submitDecision = async () => {
    if (!decisionTarget || !decisionType) return;
    setActing(true);
    try {
      const newStatus = decisionType === "approve" ? "approved" : "rejected";
      const { error } = await supabase
        .from("profiles")
        .update({
          status: newStatus,
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq("id", decisionTarget.id);
      if (error) throw error;

      await logUserAdminAction({
        action: decisionType === "approve" ? "user.status.approved" : "user.status.rejected",
        targetUserId: decisionTarget.id,
        targetEmail: decisionTarget.email,
        targetName: decisionTarget.full_name,
        oldData: { status: decisionTarget.status },
        newData: { status: newStatus },
        metadata: decisionNote.trim() ? { note: decisionNote.trim() } : undefined,
      });

      toast.success(decisionType === "approve" ? "Cadastro aprovado" : "Cadastro recusado");
      closeDecision();
      fetchProfiles();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao processar decisão");
    } finally {
      setActing(false);
    }
  };

  const openHistory = async (profile: PendingProfile) => {
    setHistoryTarget(profile);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_admin_audit")
        .select("id, action, actor_email, actor_name, old_data, new_data, created_at, notes")
        .eq("target_user_id", profile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setHistory((data as any) || []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar histórico");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const renderRow = (p: PendingProfile) => {
    const meta = STATUS_META[p.status] || STATUS_META.pending;
    const Icon = meta.icon;
    return (
      <TableRow key={p.id} className="hover:bg-muted/30">
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{p.full_name || "—"}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {p.email?.replace("@sistema.local", "") || "—"}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col text-xs">
            {p.crm && (
              <span className="flex items-center gap-1">
                <Stethoscope className="h-3 w-3" />
                {p.crm}
              </span>
            )}
            {p.specialty && <span className="text-muted-foreground">{p.specialty}</span>}
            {p.phone && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Phone className="h-3 w-3" />
                {p.phone}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`${meta.cls} gap-1`}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
          {p.approved_at && (
            <div className="text-[10px] mt-0.5">
              Decidido em {format(new Date(p.approved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => openHistory(p)} title="Ver histórico">
              <History className="h-4 w-4" />
            </Button>
            {p.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10"
                  onClick={() => openDecision(p, "approve")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => openDecision(p, "reject")}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Recusar
                </Button>
              </>
            )}
            {p.status === "rejected" && (
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={() => openDecision(p, "approve")}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Reverter / Aprovar
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-700 font-medium">Pendentes</p>
              <p className="text-2xl font-bold text-amber-700">{counters.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-500/50" />
          </div>
        </Card>
        <Card className="p-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-700 font-medium">Aprovados</p>
              <p className="text-2xl font-bold text-emerald-700">{counters.approved}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
          </div>
        </Card>
        <Card className="p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-700 font-medium">Recusados</p>
              <p className="text-2xl font-bold text-red-700">{counters.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500/50" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total</p>
              <p className="text-2xl font-bold">{counters.all}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-muted-foreground/50" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou CRM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={fetchProfiles} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes
            {counters.pending > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                {counters.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> Aprovados
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" /> Recusados
          </TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-bold">Solicitante</TableHead>
                  <TableHead className="text-xs font-bold">Profissional</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                  <TableHead className="text-xs font-bold">Solicitado em</TableHead>
                  <TableHead className="text-xs font-bold text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nenhum cadastro nesta categoria
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(renderRow)
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Decision dialog */}
      <Dialog open={!!decisionTarget} onOpenChange={(o) => !o && closeDecision()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decisionType === "approve" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Aprovar cadastro
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Recusar cadastro
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {decisionTarget?.full_name} • {decisionTarget?.email?.replace("@sistema.local", "")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">
              {decisionType === "approve"
                ? "Observação (opcional)"
                : "Motivo da recusa (recomendado)"}
            </label>
            <Textarea
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder={
                decisionType === "approve"
                  ? "Ex: Documentação validada, perfil confirmado pela coordenação."
                  : "Ex: Documentação incompleta, CRM não confere."
              }
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Esta ação será registrada na trilha de auditoria com seu nome, data/hora e observação.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDecision} disabled={acting}>
              Cancelar
            </Button>
            <Button
              onClick={submitDecision}
              disabled={acting}
              className={
                decisionType === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {acting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : decisionType === "approve" ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar {decisionType === "approve" ? "aprovação" : "recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de alterações
            </DialogTitle>
            <DialogDescription>
              {historyTarget?.full_name} • {historyTarget?.email?.replace("@sistema.local", "")}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {historyLoading ? (
              <div className="py-8 text-center">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center">
                <History className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Sem registros de auditoria para este usuário
                </p>
              </div>
            ) : (
              <div className="space-y-2 pr-3">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="border rounded-lg p-3 bg-card hover:bg-muted/30 transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {h.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(h.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Por:{" "}
                      <span className="font-medium text-foreground">
                        {h.actor_name || h.actor_email || "Sistema"}
                      </span>
                    </p>
                    {h.notes && (
                      <p className="text-xs mt-1 italic text-foreground/80">"{h.notes}"</p>
                    )}
                    {(h.old_data || h.new_data) && (
                      <details className="mt-2">
                        <summary className="text-[10px] cursor-pointer text-muted-foreground hover:text-foreground">
                          Ver detalhes (diff)
                        </summary>
                        <div className="grid grid-cols-2 gap-2 mt-1 text-[10px] font-mono">
                          <pre className="bg-red-500/5 border border-red-500/10 rounded p-2 overflow-auto">
                            {JSON.stringify(h.old_data || {}, null, 2)}
                          </pre>
                          <pre className="bg-emerald-500/5 border border-emerald-500/10 rounded p-2 overflow-auto">
                            {JSON.stringify(h.new_data || {}, null, 2)}
                          </pre>
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
