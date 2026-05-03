import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsDev } from "@/hooks/useIsDev";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Activity, Database, Users, AlertTriangle, Bot, Send, RefreshCw, ShieldAlert, Terminal, Sliders, ListChecks } from "lucide-react";
import { CustomizationTab } from "@/components/dev/CustomizationTab";
import { PendenciesTab } from "@/components/dev/PendenciesTab";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ChatMsg = { role: "user" | "assistant"; content: string };

interface Health {
  activePatients: number;
  prescriptions24h: number;
  admissions24h: number;
  deletes24h: number;
  usersTotal: number;
  checkedAt: string;
}

interface AuditRow {
  id: string; action: string; table_name: string; user_email: string | null;
  user_role: string | null; created_at: string; record_id: string | null;
  changed_fields: string[] | null;
}

const callOps = async (action: string, params: Record<string, unknown> = {}, confirm = false) => {
  const { data, error } = await supabase.functions.invoke("dev-console-ops", {
    body: { action, params, confirm },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
};

export default function DevConsolePage() {
  const { isDev, loading: roleLoading } = useIsDev();

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isDev) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-9 w-9" />
            <div className="h-9 w-9 rounded-md bg-primary/10 grid place-items-center">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Dev Console</h1>
              <p className="text-xs text-muted-foreground">Painel de operação técnica · acesso restrito</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <ShieldAlert className="h-3 w-3" /> Acesso dev
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="pendencies" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pendencies" className="gap-1.5"><ListChecks className="h-4 w-4" /> Pendências</TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5"><Activity className="h-4 w-4" /> Saúde</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5"><Database className="h-4 w-4" /> Logs</TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5"><Bot className="h-4 w-4" /> Console IA</TabsTrigger>
            <TabsTrigger value="actions" className="gap-1.5"><Users className="h-4 w-4" /> Ações</TabsTrigger>
            <TabsTrigger value="customization" className="gap-1.5"><Sliders className="h-4 w-4" /> Personalização</TabsTrigger>
          </TabsList>

          <TabsContent value="pendencies"><PendenciesTab /></TabsContent>
          <TabsContent value="health"><HealthTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
          <TabsContent value="ai"><AiTab /></TabsContent>
          <TabsContent value="actions"><ActionsTab /></TabsContent>
          <TabsContent value="customization"><CustomizationTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ─────────── HEALTH ───────────
function HealthTab() {
  const [health, setHealth] = useState<Health | null>(null);
  const [tables, setTables] = useState<Record<string, number> | null>(null);
  const [topUsers, setTopUsers] = useState<{ email: string; count: number }[]>([]);
  const [series, setSeries] = useState<{ date: string; encounters: number; prescriptions: number; evolutions: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [h, t, u, s] = await Promise.all([
        callOps("system_health"),
        callOps("db_table_sizes"),
        callOps("user_activity"),
        callOps("clinical_volume"),
      ]);
      setHealth(h);
      setTables(t.tables);
      setTopUsers(u.topUsers);
      setSeries(s.series);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Pacientes ativos" value={health?.activePatients ?? "—"} />
        <KpiCard label="Prescrições 24h" value={health?.prescriptions24h ?? "—"} />
        <KpiCard label="Admissões 24h" value={health?.admissions24h ?? "—"} />
        <KpiCard label="Exclusões 24h" value={health?.deletes24h ?? "—"} icon={<AlertTriangle className="h-3 w-3 text-destructive" />} />
        <KpiCard label="Usuários totais" value={health?.usersTotal ?? "—"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Tamanho das tabelas</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {!tables ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <div className="space-y-1.5">
                {Object.entries(tables).map(([name, count]) => (
                  <div key={name} className="flex justify-between border-b border-border/50 pb-1">
                    <span className="font-mono text-xs">{name}</span>
                    <span className="tabular-nums font-medium">{count.toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Top usuários (7 dias)</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {topUsers.length === 0 ? <p className="text-muted-foreground text-xs">Sem atividade.</p> : (
              <div className="space-y-1.5">
                {topUsers.slice(0, 10).map((u) => (
                  <div key={u.email} className="flex justify-between border-b border-border/50 pb-1">
                    <span className="truncate max-w-[200px] text-xs">{u.email}</span>
                    <span className="tabular-nums font-medium">{u.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Volume clínico (últimos 7 dias)</CardTitle></CardHeader>
        <CardContent>
          {series.length === 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5">Data</th>
                  <th className="text-right">Atendimentos</th>
                  <th className="text-right">Prescrições</th>
                  <th className="text-right">Evoluções</th>
                </tr></thead>
                <tbody>
                  {series.map((s) => (
                    <tr key={s.date} className="border-b border-border/50">
                      <td className="py-1.5 font-mono">{s.date}</td>
                      <td className="text-right tabular-nums">{s.encounters}</td>
                      <td className="text-right tabular-nums">{s.prescriptions}</td>
                      <td className="text-right tabular-nums">{s.evolutions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{label}</span>{icon}
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

// ─────────── LOGS ───────────
function LogsTab() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await callOps("audit_recent", { limit: 100 });
      setLogs(r.logs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = logs.filter((l) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return l.table_name.toLowerCase().includes(f)
      || (l.user_email ?? "").toLowerCase().includes(f)
      || l.action.toLowerCase().includes(f);
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Filtrar por tabela, email ou ação..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card z-10 border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="text-left p-2">Data</th>
                  <th className="text-left">Ação</th>
                  <th className="text-left">Tabela</th>
                  <th className="text-left">Usuário</th>
                  <th className="text-left">Perfil</th>
                  <th className="text-left">Campos alterados</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2 font-mono whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td><Badge variant={l.action === "DELETE" ? "destructive" : l.action === "INSERT" ? "default" : "secondary"} className="text-[10px]">{l.action}</Badge></td>
                    <td className="font-mono">{l.table_name}</td>
                    <td className="truncate max-w-[200px]">{l.user_email ?? "—"}</td>
                    <td>{l.user_role ?? "—"}</td>
                    <td className="text-muted-foreground truncate max-w-[200px]">{l.changed_fields?.join(", ") ?? "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum log.</td></tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────── AI CONSOLE (streaming) ───────────
function AiTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Olá! Sou o assistente do Dev Console. Posso buscar métricas, logs, atividade de usuários, hot tables e diagnosticar a plataforma. O que você quer investigar?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!input.trim() || busy) return;
    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length > next.length) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dev-console-ai`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (resp.status === 429) throw new Error("Limite de requisições atingido. Aguarde alguns segundos.");
      if (resp.status === 402) throw new Error("Créditos esgotados. Adicione fundos em Configurações → Workspace → Uso.");
      if (!resp.ok || !resp.body) {
        const t = await resp.text();
        throw new Error(t || "Falha no stream");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ Erro: ${e instanceof Error ? e.message : "desconhecido"}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px] p-4">
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t border-border p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Ex: quantos pacientes ativos? hot tables hoje? quem mais editou?"
            disabled={busy}
          />
          <Button onClick={send} disabled={busy || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────── ACTIONS ───────────
function ActionsTab() {
  const [users, setUsers] = useState<{ id: string; email: string; full_name: string | null; roles: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantEmail, setGrantEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetPwd, setResetPwd] = useState("");
  const [pendingAction, setPendingAction] = useState<{ type: string; label: string; exec: () => Promise<void> } | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await callOps("list_users");
      setUsers(r.users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const askConfirm = (type: string, label: string, exec: () => Promise<void>) =>
    setPendingAction({ type, label, exec });

  const grantDev = () => askConfirm("grant", `Conceder perfil 'dev' para ${grantEmail}`, async () => {
    const r = await callOps("grant_dev_role", { email: grantEmail }, true);
    toast.success(r.message);
    setGrantEmail(""); refresh();
  });

  const revokeDev = (email: string) => askConfirm("revoke", `Revogar perfil 'dev' de ${email}`, async () => {
    const r = await callOps("revoke_dev_role", { email }, true);
    toast.success(r.message); refresh();
  });

  const forceReset = () => askConfirm("reset", `Resetar senha de ${resetEmail}`, async () => {
    await callOps("force_password_reset", { email: resetEmail, newPassword: resetPwd }, true);
    toast.success(`Senha redefinida para ${resetEmail}`);
    setResetEmail(""); setResetPwd("");
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Conceder perfil 'dev'</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="email@arsen.com.br" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} />
            <Button onClick={grantDev} disabled={!grantEmail.trim()} className="w-full">Conceder</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Resetar senha de usuário</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="email do usuário" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
            <Input type="password" placeholder="nova senha (mín. 8)" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} />
            <Button onClick={forceReset} disabled={!resetEmail.trim() || resetPwd.length < 8} variant="destructive" className="w-full">Resetar</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row justify-between items-center">
          <CardTitle className="text-sm">Usuários (100 mais recentes)</CardTitle>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left">Email</th>
                  <th className="text-left">Perfis</th>
                  <th className="text-right p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2">{u.full_name ?? "—"}</td>
                    <td>{u.email}</td>
                    <td className="space-x-1">{u.roles.map((r) => (
                      <Badge key={r} variant={r === "dev" ? "default" : "secondary"} className="text-[10px]">{r}</Badge>
                    ))}</td>
                    <td className="text-right p-2">
                      {u.roles.includes("dev") && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => revokeDev(u.email)}>
                          Revogar dev
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação sensível</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.label}. Essa ação será registrada nos audit_logs.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const a = pendingAction; setPendingAction(null);
              if (a) try { await a.exec(); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
            }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
