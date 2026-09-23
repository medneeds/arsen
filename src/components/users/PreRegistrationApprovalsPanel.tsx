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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ACCESS_PROFILE_LABEL_MAP } from "@/config/userProfiles";
import { logUserAdminAction } from "@/lib/userAdminAudit";

// MIGRAÇÃO: pre_registration_requests → solicitacoes_pre_cadastro (colunas em pt-BR).
// hospital_units(id,name) → hospitais(id,nome). status agora é pt: pendente|aprovado|reprovado.
type PreStatus = "pendente" | "aprovado" | "reprovado";

interface PreReq {
  id: string;
  nome_completo: string;
  email: string;
  cpf: string;
  telefone: string;
  crm: string | null;
  perfil_acesso: string;
  hospital_id: string | null;
  justificativa: string | null;
  status: PreStatus;
  observacoes_avaliador: string | null;
  avaliado_por: string | null;
  avaliado_em: string | null;
  usuario_criado_id: string | null;
  criado_em: string;
  hospital_nome?: string | null;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  aprovado: { label: "Aprovado", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  reprovado: { label: "Recusado", cls: "bg-red-500/10 text-red-700 border-red-500/20" },
};

// MIGRAÇÃO: aprovação é feita pela edge function "aprovar-pre-cadastro", que exige
// um "papel" do sistema. Opções válidas (exclui super_admin/admin/dev).
const PAPEL_OPTIONS: { value: string; label: string }[] = [
  { value: "medico", label: "Médico" },
  { value: "enfermeiro", label: "Enfermeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "coordenador", label: "Coordenador" },
  { value: "farmacia", label: "Farmácia" },
  { value: "regulador", label: "Regulador" },
  { value: "nir", label: "NIR" },
  { value: "porta", label: "Porta" },
  { value: "visitante", label: "Visitante" },
];

// Melhor palpite de papel a partir do perfil_acesso solicitado.
const guessPapel = (perfil: string): string => {
  const p = (perfil || "").toLowerCase();
  if (p === "medico") return "medico";
  if (p === "ccih") return "enfermeiro";
  if (p.startsWith("coord_")) return "coordenador";
  if (p === "gestor") return "coordenador";
  if (p === "farmacia") return "farmacia";
  if (p === "nir") return "nir";
  if (p === "imagem" || p === "laboratorio") return "tecnico";
  return "medico";
};

const formatCpf = (d: string) =>
  d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const formatPhone = (d: string) =>
  d.length === 11
    ? d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    : d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");

interface ApprovalResult {
  email: string;
  nome: string;
  tempPassword: string;
  aviso?: string;
}

export function PreRegistrationApprovalsPanel(_props?: { hospitalId?: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<PreReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PreStatus | "all">("pendente");
  const [search, setSearch] = useState("");

  const [target, setTarget] = useState<PreReq | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [papel, setPapel] = useState("medico");
  const [acting, setActing] = useState(false);
  // Credenciais retornadas pela edge function após aprovação (mostradas ao admin).
  const [result, setResult] = useState<ApprovalResult | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      // MIGRAÇÃO: SELECT já é RLS-scoped ao hospital do admin automaticamente.
      const [{ data, error }, { data: hs }] = await Promise.all([
        supabase
          .from("solicitacoes_pre_cadastro")
          .select("*")
          .order("criado_em", { ascending: false }),
        supabase.from("hospitais").select("id, nome"),
      ]);
      if (error) throw error;
      const hospMap: Record<string, string> = {};
      (hs || []).forEach((h: any) => (hospMap[h.id] = h.nome));
      setItems(((data as any) || []).map((d: any) => ({
        ...d,
        hospital_nome: d.hospital_id ? hospMap[d.hospital_id] : null,
      })) as PreReq[]);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível carregar pré-cadastros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const counters = useMemo(() => ({
    pendente: items.filter(i => i.status === "pendente").length,
    aprovado: items.filter(i => i.status === "aprovado").length,
    reprovado: items.filter(i => i.status === "reprovado").length,
    all: items.length,
  }), [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter(i => tab === "all" ? true : i.status === tab)
      .filter(i => {
        if (!term) return true;
        return (
          i.nome_completo.toLowerCase().includes(term) ||
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
    setResult(null);
    setPapel(type === "approve" ? guessPapel(item.perfil_acesso) : "medico");
  };

  const close = () => {
    setTarget(null);
    setDecision(null);
    setNote("");
    setResult(null);
  };

  const submit = async () => {
    if (!target || !decision) return;
    setActing(true);
    try {
      if (decision === "approve") {
        // MIGRAÇÃO: criação de conta + marcação 'aprovado' via edge function
        // "aprovar-pre-cadastro" (não usar mais admin-create-user).
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) throw new Error("Sessão expirada.");

        const res = await supabase.functions.invoke("aprovar-pre-cadastro", {
          body: {
            solicitacaoId: target.id,
            papel,
            observacoes: note.trim() || undefined,
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.error) {
          // A mensagem real costuma vir em error.context.body (JSON string).
          let msg = res.error.message || "Falha ao aprovar pré-cadastro";
          try {
            const body = (res.error as any)?.context?.body;
            if (body) {
              const parsed = typeof body === "string" ? JSON.parse(body) : body;
              if (parsed?.error) msg = parsed.error;
            }
          } catch { /* mantém msg padrão */ }
          throw new Error(msg);
        }

        const data = res.data as {
          success?: boolean;
          email?: string;
          nome?: string;
          tempPassword?: string;
          error?: string;
          aviso?: string;
        };
        if (!data?.success) throw new Error(data?.error || "Falha ao aprovar pré-cadastro");

        await logUserAdminAction({
          action: "prereg.approved",
          targetEmail: data.email || target.email,
          targetName: data.nome || target.nome_completo,
          accessProfile: target.perfil_acesso,
          appRole: papel,
          hospitalUnitId: target.hospital_id,
          metadata: { source: "pre-registration", note: note.trim() || undefined, papel },
        });

        setResult({
          email: data.email || target.email,
          nome: data.nome || target.nome_completo,
          tempPassword: data.tempPassword || "",
          aviso: data.aviso,
        });
        toast.success("Pré-cadastro aprovado e conta criada.");
        fetchItems();
        // Mantém o diálogo aberto para exibir a senha provisória.
      } else {
        // MIGRAÇÃO: recusa é um UPDATE direto (RLS).
        const { error } = await supabase
          .from("solicitacoes_pre_cadastro")
          .update({
            status: "reprovado",
            observacoes_avaliador: note.trim() || null,
            avaliado_por: user?.id,
            avaliado_em: new Date().toISOString(),
          })
          .eq("id", target.id);
        if (error) throw error;
        await logUserAdminAction({
          action: "prereg.rejected",
          targetEmail: target.email,
          targetName: target.nome_completo,
          hospitalUnitId: target.hospital_id,
          metadata: { source: "pre-registration", note: note.trim() || undefined },
        });
        toast.success("Pré-cadastro recusado.");
        close();
        fetchItems();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao processar decisão");
    } finally {
      setActing(false);
    }
  };

  const renderRow = (i: PreReq) => {
    const meta = STATUS_META[i.status] || STATUS_META.pendente;
    return (
      <TableRow key={i.id} className="hover:bg-muted/30">
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{i.nome_completo}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" /> {i.email}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" /> {formatPhone(i.telefone)}
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
              {ACCESS_PROFILE_LABEL_MAP[i.perfil_acesso as keyof typeof ACCESS_PROFILE_LABEL_MAP] || i.perfil_acesso}
            </Badge>
            {i.hospital_nome && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="h-3 w-3" /> {i.hospital_nome}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`${meta.cls} gap-1`}>{meta.label}</Badge>
          <div className="text-[10px] text-muted-foreground mt-1">
            {format(new Date(i.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
        </TableCell>
        <TableCell className="text-right">
          {i.status === "pendente" && (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                className="text-released-on-soft border-released/30 hover:bg-released/10"
                onClick={() => open(i, "approve")}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-critical-on-soft border-critical/30 hover:bg-critical/10"
                onClick={() => open(i, "reject")}
              >
                <XCircle className="h-4 w-4 mr-1" /> Recusar
              </Button>
            </div>
          )}
          {i.status !== "pendente" && i.observacoes_avaliador && (
            <span className="text-xs text-muted-foreground italic">
              "{i.observacoes_avaliador}"
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
                toast.success("Link copiado");
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
          { k: "pendente", label: "Pendentes", icon: Clock, cls: "amber" },
          { k: "aprovado", label: "Aprovados", icon: CheckCircle2, cls: "emerald" },
          { k: "reprovado", label: "Recusados", icon: XCircle, cls: "red" },
          { k: "all", label: "Total", icon: ClipboardList, cls: "muted" },
        ].map(({ k, label, icon: Icon, cls }) => (
          <Card
            key={k}
            className={cls === "muted" ? "p-4" : `p-4 border-${cls}-500/20 bg-${cls}-500/5`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-medium ${cls === "muted" ? "text-muted-foreground" : `text-${cls}-700`}`}>{label}</p>
                <p className={`text-2xl font-semibold ${cls === "muted" ? "" : `text-${cls}-700`}`}>
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
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={fetchItems} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pendente" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes
            {counters.pendente > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                {counters.pendente}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="aprovado" className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> Aprovados
          </TabsTrigger>
          <TabsTrigger value="reprovado" className="gap-2">
            <XCircle className="h-4 w-4" /> Recusados
          </TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">Solicitante</TableHead>
                  <TableHead className="text-xs font-semibold">Documentos</TableHead>
                  <TableHead className="text-xs font-semibold">Função / Unidade</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Ações</TableHead>
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
                    <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
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
                  <CheckCircle2 className="h-5 w-5 text-released-on-soft" />
                  Aprovar pré-cadastro
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-critical-on-soft" />
                  Recusar pré-cadastro
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {target?.nome_completo} • {target?.email}
            </DialogDescription>
          </DialogHeader>

          {/* Resultado da aprovação: senha provisória retornada pela edge function. */}
          {result ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-2">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Conta criada para {result.nome}
                </p>
                <div className="text-xs text-muted-foreground">{result.email}</div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Senha provisória
                    </Label>
                    <p className="font-mono text-2xl font-bold tracking-widest text-emerald-700 dark:text-emerald-400">
                      {result.tempPassword || "—"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!result.tempPassword}
                    onClick={() => {
                      navigator.clipboard.writeText(result.tempPassword);
                      toast.success("Senha copiada");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Repasse esta senha ao profissional. Ele deverá trocá-la no primeiro acesso.
                </p>
              </div>
              {result.aviso && (
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {result.aviso}
                </div>
              )}
            </div>
          ) : target && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-xs">
                <div><b>CPF:</b> {formatCpf(target.cpf)} • <b>Telefone:</b> {formatPhone(target.telefone)}</div>
                {target.crm && <div><b>CRM:</b> {target.crm}</div>}
                <div><b>Função pretendida:</b> {ACCESS_PROFILE_LABEL_MAP[target.perfil_acesso as keyof typeof ACCESS_PROFILE_LABEL_MAP] || target.perfil_acesso}</div>
                {target.hospital_nome && <div><b>Unidade:</b> {target.hospital_nome}</div>}
                {target.justificativa && (
                  <div className="pt-1 border-t mt-1">
                    <b>Justificativa:</b> <span className="italic">{target.justificativa}</span>
                  </div>
                )}
              </div>

              {decision === "approve" && (
                <div className="space-y-2">
                  <Label>Papel no sistema</Label>
                  <Select value={papel} onValueChange={setPapel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAPEL_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    A senha provisória será gerada e exibida após a aprovação.
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
            {result ? (
              <Button onClick={close}>Concluir</Button>
            ) : (
              <>
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
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
