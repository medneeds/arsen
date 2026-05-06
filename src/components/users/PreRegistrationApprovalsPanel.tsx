import { useEffect, useMemo, useState } from "react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  AlertTriangle,
  Mail,
  Phone,
  Stethoscope,
  Building2,
  ClipboardList,
  Copy,
} from "lucide-react";
import { ACCESS_PROFILE_LABEL_MAP, PROFILE_TO_ROLE_HINT } from "@/config/userProfiles";
import { logUserAdminAction } from "@/lib/userAdminAudit";

interface PreReq {
  id: string;
  full_name: string;
  email: string;
  cpf: string;
  phone: string;
  crm: string | null;
  access_profile: string;
  hospital_unit_id: string | null;
  justification: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_user_id: string | null;
  created_at: string;
  hospital_unit_name?: string | null;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  approved: { label: "Aprovado", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  rejected: { label: "Recusado", cls: "bg-red-500/10 text-red-700 border-red-500/20" },
};

const formatCpf = (d: string) =>
  d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const formatPhone = (d: string) =>
  d.length === 11
    ? d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    : d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");

// Senha padrão de PRIMEIRO ACESSO. Todo usuário aprovado recebe esta senha
// e DEVE trocá-la (e escolher um username) no primeiro login.
const FIRST_ACCESS_PASSWORD = "123456";

export function PreRegistrationApprovalsPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState<PreReq[]>([]);
  const [units, setUnits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [search, setSearch] = useState("");

  const [target, setTarget] = useState<PreReq | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [acting, setActing] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const [{ data, error }, { data: us }] = await Promise.all([
        supabase
          .from("pre_registration_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("hospital_units").select("id, name"),
      ]);
      if (error) throw error;
      const unitMap: Record<string, string> = {};
      (us || []).forEach((u: any) => (unitMap[u.id] = u.name));
      setUnits(unitMap);
      setItems(((data as any) || []).map((d: any) => ({
        ...d,
        hospital_unit_name: d.hospital_unit_id ? unitMap[d.hospital_unit_id] : null,
      })));
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar pré-cadastros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const counters = useMemo(() => ({
    pending: items.filter(i => i.status === "pending").length,
    approved: items.filter(i => i.status === "approved").length,
    rejected: items.filter(i => i.status === "rejected").length,
    all: items.length,
  }), [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter(i => tab === "all" ? true : i.status === tab)
      .filter(i => {
        if (!term) return true;
        return (
          i.full_name.toLowerCase().includes(term) ||
          i.email.toLowerCase().includes(term) ||
          i.cpf.includes(term.replace(/\D/g, "")) ||
          (i.crm || "").toLowerCase().includes(term)
        );
      });
  }, [items, tab, search]);

  const open = (item: PreReq, type: "approve" | "reject") => {
    setTarget(item);
    setDecision(type);
    setNote("");
    setTempPassword(type === "approve" ? FIRST_ACCESS_PASSWORD : "");
  };

  const close = () => {
    setTarget(null);
    setDecision(null);
    setNote("");
    setTempPassword("");
  };

  const submit = async () => {
    if (!target || !decision) return;
    setActing(true);
    try {
      if (decision === "approve") {
        if (!tempPassword || tempPassword.length < 6) {
          toast.error("Senha provisória inválida (mín. 6 caracteres).");
          setActing(false);
          return;
        }
        // Cria usuário via edge function existente
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;
        if (!accessToken) throw new Error("Sessão expirada.");

        const res = await supabase.functions.invoke("admin-create-user", {
          body: {
            mode: "password",
            email: target.email,
            password: tempPassword,
            fullName: target.full_name,
            cpf: target.cpf,
            phone: target.phone,
            crm: target.crm,
            accessProfile: target.access_profile,
            role: PROFILE_TO_ROLE_HINT[target.access_profile as keyof typeof PROFILE_TO_ROLE_HINT] || "medico",
            hospitalUnitId: target.hospital_unit_id,
            departments: [],
          },
        });
        if (res.error) throw res.error;
        const data = res.data as { success?: boolean; userId?: string; error?: string };
        if (!data?.success) throw new Error(data?.error || "Falha ao criar usuário");

        const { error: upErr } = await supabase
          .from("pre_registration_requests")
          .update({
            status: "approved",
            reviewer_notes: note.trim() || null,
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
            created_user_id: data.userId,
          })
          .eq("id", target.id);
        if (upErr) throw upErr;

        await logUserAdminAction({
          action: "prereg.approved",
          targetUserId: data.userId,
          targetEmail: target.email,
          targetName: target.full_name,
          accessProfile: target.access_profile,
          hospitalUnitId: target.hospital_unit_id,
          metadata: { source: "pre-registration", note: note.trim() || undefined },
        });

        toast.success("Pré-cadastro aprovado e usuário criado.");
      } else {
        const { error } = await supabase
          .from("pre_registration_requests")
          .update({
            status: "rejected",
            reviewer_notes: note.trim() || null,
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", target.id);
        if (error) throw error;
        await logUserAdminAction({
          action: "prereg.rejected",
          targetEmail: target.email,
          targetName: target.full_name,
          metadata: { source: "pre-registration", note: note.trim() || undefined },
        });
        toast.success("Pré-cadastro recusado.");
      }
      close();
      fetchItems();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao processar decisão");
    } finally {
      setActing(false);
    }
  };

  const renderRow = (i: PreReq) => {
    const meta = STATUS_META[i.status] || STATUS_META.pending;
    return (
      <TableRow key={i.id} className="hover:bg-muted/30">
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{i.full_name}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" /> {i.email}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" /> {formatPhone(i.phone)}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col text-xs">
            <span>CPF: {formatCpf(i.cpf)}</span>
            {i.crm && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Stethoscope className="h-3 w-3" /> CRM {i.crm}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1 text-xs">
            <Badge variant="outline" className="w-fit gap-1">
              <ClipboardList className="h-3 w-3" />
              {ACCESS_PROFILE_LABEL_MAP[i.access_profile as keyof typeof ACCESS_PROFILE_LABEL_MAP] || i.access_profile}
            </Badge>
            {i.hospital_unit_name && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="h-3 w-3" /> {i.hospital_unit_name}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`${meta.cls} gap-1`}>{meta.label}</Badge>
          <div className="text-[10px] text-muted-foreground mt-1">
            {format(new Date(i.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
        </TableCell>
        <TableCell className="text-right">
          {i.status === "pending" && (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={() => open(i, "approve")}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-700 border-red-500/30 hover:bg-red-500/10"
                onClick={() => open(i, "reject")}
              >
                <XCircle className="h-4 w-4 mr-1" /> Recusar
              </Button>
            </div>
          )}
          {i.status !== "pending" && i.reviewer_notes && (
            <span className="text-xs text-muted-foreground italic">
              "{i.reviewer_notes}"
            </span>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/pre-cadastro`
    : "/pre-cadastro";

  return (
    <div className="space-y-4">
      {/* Link público para divulgação */}
      <Card className="p-4 border-primary/20 bg-primary/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Link público de pré-cadastro</p>
            <p className="text-xs text-muted-foreground">
              Compartilhe esta URL com profissionais que devem solicitar acesso.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input value={publicUrl} readOnly className="md:w-80 text-xs" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Link copiado!");
              }}
            >
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: "pending", label: "Pendentes", icon: Clock, cls: "amber" },
          { k: "approved", label: "Aprovados", icon: CheckCircle2, cls: "emerald" },
          { k: "rejected", label: "Recusados", icon: XCircle, cls: "red" },
          { k: "all", label: "Total", icon: ClipboardList, cls: "muted" },
        ].map(({ k, label, icon: Icon, cls }) => (
          <Card
            key={k}
            className={cls === "muted" ? "p-4" : `p-4 border-${cls}-500/20 bg-${cls}-500/5`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-medium ${cls === "muted" ? "text-muted-foreground" : `text-${cls}-700`}`}>{label}</p>
                <p className={`text-2xl font-bold ${cls === "muted" ? "" : `text-${cls}-700`}`}>
                  {(counters as any)[k]}
                </p>
              </div>
              <Icon className={`h-8 w-8 ${cls === "muted" ? "text-muted-foreground/50" : `text-${cls}-500/50`}`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, CPF ou CRM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={fetchItems} disabled={loading}>
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
                  <TableHead className="text-xs font-bold">Documentos</TableHead>
                  <TableHead className="text-xs font-bold">Função / Unidade</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
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
                    <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                      Nenhum pré-cadastro nesta categoria.
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

      <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decision === "approve" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Aprovar pré-cadastro
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Recusar pré-cadastro
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {target?.full_name} • {target?.email}
            </DialogDescription>
          </DialogHeader>

          {target && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-xs">
                <div><b>CPF:</b> {formatCpf(target.cpf)} • <b>Telefone:</b> {formatPhone(target.phone)}</div>
                {target.crm && <div><b>CRM:</b> {target.crm}</div>}
                <div><b>Função pretendida:</b> {ACCESS_PROFILE_LABEL_MAP[target.access_profile as keyof typeof ACCESS_PROFILE_LABEL_MAP]}</div>
                {target.hospital_unit_name && <div><b>Unidade:</b> {target.hospital_unit_name}</div>}
                {target.justification && (
                  <div className="pt-1 border-t mt-1">
                    <b>Justificativa:</b> <span className="italic">{target.justification}</span>
                  </div>
                )}
              </div>

              {decision === "approve" && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Senha de primeiro acesso
                      </Label>
                      <p className="font-mono text-2xl font-bold tracking-widest text-emerald-700 dark:text-emerald-400">
                        {FIRST_ACCESS_PASSWORD}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(FIRST_ACCESS_PASSWORD);
                        toast.success("Senha copiada");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Padrão institucional. O usuário fará login com CPF ou e-mail + esta senha,
                    e será obrigado a definir uma <b>nova senha</b> e um <b>nome de usuário</b>{" "}
                    no primeiro acesso.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  {decision === "approve"
                    ? "Observação (opcional)"
                    : "Motivo da recusa (recomendado)"}
                </Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={decision === "approve" ? "Ex.: validado em reunião 06/05" : "Ex.: documentação inconsistente"}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={acting}>Cancelar</Button>
            <Button
              onClick={submit}
              disabled={acting}
              className={decision === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
            >
              {acting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> :
                decision === "approve" ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirmar {decision === "approve" ? "aprovação" : "recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
