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
  Eye,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// MIGRAÇÃO: tabelas antigas (audit_logs / user_admin_audit, inglês) foram removidas.
// Origem agora é `logs_auditoria` (schema pt-BR). Colunas em types.ts:
// criado_em, tipo_evento, acao (enum, nullable), nome_tabela, registro_id,
// ator_user_id, email_ator, papel_ator, dados_antigos/dados_novos (Json),
// campos_alterados (text[]), motivo, hospital_id, user_agent.
// RLS desabilitada -> legível por qualquer usuário autenticado.
type AuditRow = {
  id: string;
  criado_em: string;
  tipo_evento: string;
  acao: string | null;
  nome_tabela: string;
  registro_id: string | null;
  ator_user_id: string | null;
  email_ator: string | null;
  papel_ator: string | null;
  dados_antigos: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  campos_alterados: string[] | null;
  motivo: string | null;
  hospital_id: string | null;
  user_agent: string | null;
};

// MIGRAÇÃO: os antigos códigos de "action" (user.created.password, etc.) não
// existem mais. `tipo_evento` é texto livre no novo schema, então derivamos as
// opções do filtro dinamicamente a partir das linhas carregadas e usamos um
// badge genérico com o próprio texto do evento.
function eventLabel(tipo: string | null | undefined) {
  return (tipo ?? "—").replace(/[._]/g, " ");
}

const PAGE_SIZE = 50;

type UserAuditHistoryPanelProps = {
  hospitalId?: string;
};

export function UserAuditHistoryPanel({ hospitalId }: UserAuditHistoryPanelProps = {}) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [eventOptions, setEventOptions] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const fetchAudit = async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("logs_auditoria")
      .select("*", { count: "exact" })
      .order("criado_em", { ascending: false })
      .range(from, to);
    if (eventFilter !== "all") q = q.eq("tipo_evento", eventFilter);
    // MIGRAÇÃO: filtro opcional por hospital (coluna hospital_id existe).
    if (hospitalId) q = q.eq("hospital_id", hospitalId);
    const { data, count, error } = await q;
    if (error) {
      toast.error("Não foi possível carregar histórico");
    } else {
      const list = (data ?? []) as AuditRow[];
      setRows(list);
      setTotal(count ?? 0);
      // acumula os tipos de evento vistos para popular o filtro
      setEventOptions((prev) => {
        const set = new Set(prev);
        list.forEach((r) => r.tipo_evento && set.add(r.tipo_evento));
        return Array.from(set).sort();
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchAudit(); }, [page, eventFilter, hospitalId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().trim();
    return rows.filter((r) => {
      const hay = `${r.email_ator ?? ""} ${r.ator_user_id ?? ""} ${r.papel_ator ?? ""} ${r.tipo_evento ?? ""} ${r.acao ?? ""} ${r.nome_tabela ?? ""} ${r.registro_id ?? ""} ${r.motivo ?? ""}`
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, search]);

  const exportCsv = () => {
    const header = ["data", "tipo_evento", "acao", "ator_email", "ator_user_id", "papel", "tabela", "registro_id", "motivo"];
    const lines = filtered.map((r) => [
      format(new Date(r.criado_em), "yyyy-MM-dd HH:mm:ss"),
      r.tipo_evento ?? "", r.acao ?? "",
      r.email_ator ?? "", r.ator_user_id ?? "",
      r.papel_ator ?? "",
      r.nome_tabela ?? "", r.registro_id ?? "",
      r.motivo ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-auditoria-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shadow-sm">
          <History className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Histórico de auditoria</h2>
          <p className="text-xs text-muted-foreground">
            Registro imutável de eventos do sistema (quem fez o quê, em qual tabela) — conformidade LGPD.
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
            placeholder="Buscar por e-mail, usuário, tabela, evento ou motivo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full md:w-64"><SelectValue placeholder="Tipo de evento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            {eventOptions.map((k) => (
              <SelectItem key={k} value={k}>{eventLabel(k)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-2">Data/Hora</div>
          <div className="col-span-3">Evento</div>
          <div className="col-span-3">Alvo</div>
          <div className="col-span-3">Executado por</div>
          <div className="col-span-1 text-right">Detalhes</div>
        </div>

        {loading ? (
          <div className="p-3 space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <History className="h-6 w-6 mx-auto mb-2 opacity-60" />
            Nenhum evento encontrado.
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((r) => (
              <li key={r.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm hover:bg-muted/30">
                <div className="col-span-2 text-xs text-muted-foreground">
                  {format(new Date(r.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
                <div className="col-span-3 min-w-0">
                  <Badge variant="outline" className="bg-muted text-foreground border-border gap-1.5 font-medium max-w-full">
                    <Shield className="h-3 w-3 shrink-0" />
                    <span className="truncate">{eventLabel(r.tipo_evento)}</span>
                  </Badge>
                  {r.acao && (
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">{r.acao}</div>
                  )}
                </div>
                <div className="col-span-3 min-w-0">
                  <div className="font-medium truncate">{r.nome_tabela || "—"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.registro_id || "—"}</div>
                </div>
                <div className="col-span-3 min-w-0">
                  <div className="font-medium truncate">{r.email_ator || r.ator_user_id || "—"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.papel_ator || "—"}</div>
                </div>
                <div className="col-span-1 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setDetail(r)} title="Ver detalhes">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
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
                <Field label="Data/Hora" value={format(new Date(detail.criado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })} />
                <Field label="Tipo de evento" value={eventLabel(detail.tipo_evento)} />
                <Field label="Ação" value={detail.acao ?? "—"} />
                <Field label="Executado por" value={detail.email_ator ?? detail.ator_user_id ?? "—"} />
                <Field label="Papel" value={detail.papel_ator ?? "—"} />
                <Field label="Tabela" value={detail.nome_tabela ?? "—"} />
                <Field label="Registro" value={detail.registro_id ?? "—"} />
                <Field label="Campos alterados" value={detail.campos_alterados?.join(", ") || "—"} />
              </div>
              {detail.motivo && (
                <Field label="Motivo" value={detail.motivo} />
              )}
              {(detail.dados_antigos || detail.dados_novos) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {detail.dados_antigos && (
                    <div>
                      <div className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Antes</div>
                      <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-words">
                        {JSON.stringify(detail.dados_antigos, null, 2)}
                      </pre>
                    </div>
                  )}
                  {detail.dados_novos && (
                    <div>
                      <div className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Depois</div>
                      <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-words">
                        {JSON.stringify(detail.dados_novos, null, 2)}
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
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`${small ? "text-xs" : "text-sm"} break-words`}>{value}</div>
    </div>
  );
}
