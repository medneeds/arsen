import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  History,
  Search,
  RefreshCw,
  Shield,
  UserPlus,
  UserCog,
  KeyRound,
  Building2,
  CheckCircle2,
  Ban,
  XCircle,
  Mail,
  Eye,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type AuditRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  target_user_id: string | null;
  target_email: string | null;
  target_name: string | null;
  action: string;
  hospital_unit_id: string | null;
  access_profile: string | null;
  app_role: string | null;
  departments: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
};

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  "user.created.password": { label: "Cadastro c/ senha", icon: <UserPlus className="h-3 w-3" />, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  "user.created.invite": { label: "Convite enviado", icon: <Mail className="h-3 w-3" />, color: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  "user.role.updated": { label: "Role alterada", icon: <Shield className="h-3 w-3" />, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  "user.permissions.updated": { label: "Permissões/setores", icon: <UserCog className="h-3 w-3" />, color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  "user.password.reset": { label: "Senha redefinida", icon: <KeyRound className="h-3 w-3" />, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  "user.status.approved": { label: "Aprovado", icon: <CheckCircle2 className="h-3 w-3" />, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  "user.status.rejected": { label: "Rejeitado", icon: <XCircle className="h-3 w-3" />, color: "bg-red-500/10 text-red-600 border-red-500/20" },
  "user.status.suspended": { label: "Suspenso", icon: <Ban className="h-3 w-3" />, color: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
  "user.status.reactivated": { label: "Reativado", icon: <CheckCircle2 className="h-3 w-3" />, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  "user.hospital.updated": { label: "Unidade alterada", icon: <Building2 className="h-3 w-3" />, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
};

function actionMeta(a: string) {
  return ACTION_META[a] ?? { label: a, icon: <Shield className="h-3 w-3" />, color: "bg-muted text-foreground border-border" };
}

const PAGE_SIZE = 50;

export function UserAuditHistoryPanel() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const fetchAudit = async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("user_admin_audit")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (actionFilter !== "all") q = q.eq("action", actionFilter);
    const { data, count, error } = await q;
    if (error) {
      toast.error("Falha ao carregar histórico");
    } else {
      setRows((data ?? []) as AuditRow[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAudit(); /* eslint-disable-next-line */ }, [page, actionFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim();
    return rows.filter((r) => {
      const hay = `${r.target_name ?? ""} ${r.target_email ?? ""} ${r.actor_name ?? ""} ${r.actor_email ?? ""} ${r.app_role ?? ""} ${r.access_profile ?? ""}`
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, search]);

  const exportCsv = () => {
    const header = ["data", "ator", "ator_email", "alvo", "alvo_email", "acao", "perfil", "role", "setores"];
    const lines = filtered.map((r) => [
      format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
      r.actor_name ?? "", r.actor_email ?? "",
      r.target_name ?? "", r.target_email ?? "",
      r.action,
      r.access_profile ?? "", r.app_role ?? "",
      (r.departments ?? []).join("|"),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-usuarios-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow">
          <History className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Histórico de cadastros e permissões</h2>
          <p className="text-xs text-muted-foreground">
            Auditoria imutável de quem criou, aprovou, alterou perfil/role e permissões — conformidade LGPD.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAudit} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0} className="gap-2">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail, perfil ou role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full md:w-64"><SelectValue placeholder="Tipo de ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {Object.entries(ACTION_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-2">Data/Hora</div>
          <div className="col-span-3">Ação</div>
          <div className="col-span-3">Alvo</div>
          <div className="col-span-3">Executado por</div>
          <div className="col-span-1 text-right">Detalhes</div>
        </div>

        {loading ? (
          <div className="p-3 space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <History className="h-6 w-6 mx-auto mb-2 opacity-60" />
            Nenhum evento encontrado.
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((r) => {
              const m = actionMeta(r.action);
              return (
                <li key={r.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm hover:bg-muted/30">
                  <div className="col-span-2 text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                  <div className="col-span-3">
                    <Badge variant="outline" className={`${m.color} gap-1.5 font-medium`}>
                      {m.icon}{m.label}
                    </Badge>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <div className="font-medium truncate">{r.target_name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.target_email || "—"}</div>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <div className="font-medium truncate">{r.actor_name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.actor_email || "—"}</div>
                  </div>
                  <div className="col-span-1 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setDetail(r)} title="Ver detalhes">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Paginação */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total.toLocaleString("pt-BR")} eventos • página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Anterior</Button>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Próxima</Button>
          </div>
        </div>
      )}

      {/* Drawer de detalhes */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Evento de auditoria
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data/Hora" value={format(new Date(detail.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })} />
                <Field label="Ação" value={actionMeta(detail.action).label} />
                <Field label="Executado por" value={`${detail.actor_name ?? "—"} (${detail.actor_email ?? "—"})`} />
                <Field label="Alvo" value={`${detail.target_name ?? "—"} (${detail.target_email ?? "—"})`} />
                <Field label="Perfil de acesso" value={detail.access_profile ?? "—"} />
                <Field label="Role" value={detail.app_role ?? "—"} />
                <Field label="Setores" value={detail.departments?.join(", ") || "—"} />
                <Field label="IP" value={detail.ip_address ?? "—"} />
              </div>
              {(detail.old_data || detail.new_data) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {detail.old_data && (
                    <div>
                      <div className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Antes</div>
                      <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-words">
                        {JSON.stringify(detail.old_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {detail.new_data && (
                    <div>
                      <div className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Depois</div>
                      <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-words">
                        {JSON.stringify(detail.new_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
              {detail.user_agent && (
                <Field label="User-Agent" value={detail.user_agent} small />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className={`${small ? "text-[11px]" : "text-sm"} break-words`}>{value}</div>
    </div>
  );
}
