import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, RefreshCw, ListChecks, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Priority = "baixa" | "media" | "alta" | "critica";
type Status = "aberta" | "em_andamento" | "bloqueada" | "concluida" | "arquivada";

interface Pendency {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: Priority;
  status: Status;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica",
};
const PRIORITY_COLOR: Record<Priority, string> = {
  baixa: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  media: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  alta: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  critica: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
};
const STATUS_LABEL: Record<Status, string> = {
  aberta: "Aberta", em_andamento: "Em andamento", bloqueada: "Bloqueada",
  concluida: "Concluída", arquivada: "Arquivada",
};

export function PendenciesTab() {
  const [items, setItems] = useState<Pendency[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<Status | "todas">("todas");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "", priority: "media" as Priority, tags: "",
  });

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dev_pendencies")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Pendency[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const create = async () => {
    if (!form.title.trim()) { toast.error("Informe o título"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("dev_pendencies").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      priority: form.priority,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Pendência criada");
    setOpen(false);
    setForm({ title: "", description: "", category: "", priority: "media", tags: "" });
    refresh();
  };

  const updateStatus = async (id: string, status: Status) => {
    const patch: Record<string, unknown> = { status };
    if (status === "concluida") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("dev_pendencies").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const updatePriority = async (id: string, priority: Priority) => {
    const { error } = await supabase.from("dev_pendencies").update({ priority }).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta pendência?")) return;
    const { error } = await supabase.from("dev_pendencies").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluída"); refresh(); }
  };

  const filtered = filterStatus === "todas" ? items : items.filter(i => i.status === filterStatus);
  const counts = {
    abertas: items.filter(i => i.status === "aberta").length,
    andamento: items.filter(i => i.status === "em_andamento").length,
    bloqueadas: items.filter(i => i.status === "bloqueada").length,
    concluidas: items.filter(i => i.status === "concluida").length,
    criticas: items.filter(i => i.priority === "critica" && i.status !== "concluida" && i.status !== "arquivada").length,
  };

  return (
    <div className="space-y-5">
      {/* KPIs com cartões dark gradiente */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiBox label="Abertas" value={counts.abertas} tone="blue" icon={<ListChecks className="h-4 w-4" />} />
        <KpiBox label="Em andamento" value={counts.andamento} tone="indigo" />
        <KpiBox label="Bloqueadas" value={counts.bloqueadas} tone="amber" />
        <KpiBox label="Concluídas" value={counts.concluidas} tone="emerald" icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiBox label="Críticas pendentes" value={counts.criticas} tone="red" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as Status | "todas")}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="aberta">Abertas</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="bloqueada">Bloqueadas</SelectItem>
              <SelectItem value="concluida">Concluídas</SelectItem>
              <SelectItem value="arquivada">Arquivadas</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white shadow-md">
              <Plus className="h-4 w-4 mr-1.5" /> Nova pendência
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova pendência</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Título *</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Implantar fluxo X no setor Y" />
              </div>
              <div>
                <label className="text-xs font-medium">Descrição</label>
                <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes, contexto, decisão pendente..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Categoria</label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Triagem, Farmácia, NIR" />
                </div>
                <div>
                  <label className="text-xs font-medium">Prioridade</label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["baixa", "media", "alta", "critica"] as Priority[]).map(p => (
                        <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Tags (separadas por vírgula)</label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="ui, backend, urgente" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={create} className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-900/30">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Radar de pendências <span className="text-muted-foreground font-normal">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="py-8 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma pendência neste filtro.</p>
          ) : (
            <div className="space-y-2.5">
              {filtered.map(p => (
                <div
                  key={p.id}
                  className="group relative border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-white dark:bg-slate-900/50 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700/60 transition-all"
                >
                  <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${
                    p.priority === "critica" ? "bg-red-500" :
                    p.priority === "alta" ? "bg-amber-500" :
                    p.priority === "media" ? "bg-blue-500" : "bg-slate-400"
                  }`} />
                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{p.title}</h3>
                        <Badge variant="outline" className={`text-[10px] uppercase ${PRIORITY_COLOR[p.priority]}`}>{PRIORITY_LABEL[p.priority]}</Badge>
                        {p.category && <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>}
                        {p.tags?.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap leading-relaxed">{p.description}</p>}
                      <p className="text-[10px] text-muted-foreground mt-2 normal-case">
                        Criada em {new Date(p.created_at).toLocaleString("pt-BR")}
                        {p.resolved_at && ` • Resolvida em ${new Date(p.resolved_at).toLocaleString("pt-BR")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Select value={p.priority} onValueChange={(v) => updatePriority(p.id, v as Priority)}>
                        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["baixa", "media", "alta", "critica"] as Priority[]).map(pr => (
                            <SelectItem key={pr} value={pr}>{PRIORITY_LABEL[pr]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={p.status} onValueChange={(v) => updateStatus(p.id, v as Status)}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as Status[]).map(s => (
                            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive opacity-60 group-hover:opacity-100" onClick={() => remove(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const TONE_STYLES = {
  blue: "from-blue-600 to-blue-800 ring-blue-500/30",
  indigo: "from-indigo-600 to-indigo-800 ring-indigo-500/30",
  amber: "from-amber-600 to-amber-800 ring-amber-500/30",
  emerald: "from-emerald-600 to-emerald-800 ring-emerald-500/30",
  red: "from-red-600 to-red-800 ring-red-500/30",
} as const;

function KpiBox({ label, value, icon, tone = "blue" }: { label: string; value: number; icon?: React.ReactNode; tone?: keyof typeof TONE_STYLES }) {
  return (
    <div className={`relative overflow-hidden rounded-xl p-4 bg-gradient-to-br ${TONE_STYLES[tone]} text-white shadow-md ring-1`}>
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 blur-xl" />
      <div className="relative">
        <div className="text-[10px] uppercase tracking-wider text-white/80 flex items-center gap-1.5 font-medium">{icon}{label}</div>
        <div className="text-3xl font-bold tabular-nums mt-1.5 drop-shadow-sm">{value}</div>
      </div>
    </div>
  );
}
