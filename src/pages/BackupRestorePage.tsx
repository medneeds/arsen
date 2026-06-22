import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Database, Download, RefreshCw, ShieldAlert, History as HistoryIcon,
  Loader2, FileArchive, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

interface BackupJob {
  id: string;
  created_at: string;
  created_by_email: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: { step: string; percent: number; current?: number | null; total?: number | null } | null;
  storage_path: string | null;
  file_size_bytes: number | null;
  table_counts: Record<string, number> | null;
  auth_user_count: number | null;
  checksum_sha256: string | null;
  duration_ms: number | null;
  reason: string | null;
  error: string | null;
}

interface BackupAudit {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  backup_job_id: string | null;
  restore_job_id: string | null;
  result: string | null;
  duration_ms: number | null;
  error: string | null;
}

function formatBytes(n: number | null) {
  if (!n || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
function formatDuration(ms: number | null) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function statusBadge(s: BackupJob["status"]) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    pending: { label: "Pendente", cls: "bg-slate-200 text-slate-700", icon: Loader2 },
    running: { label: "Em andamento", cls: "bg-blue-100 text-blue-800 animate-pulse", icon: Loader2 },
    completed: { label: "Concluído", cls: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
    failed: { label: "Falhou", cls: "bg-rose-100 text-rose-800", icon: XCircle },
    cancelled: { label: "Cancelado", cls: "bg-amber-100 text-amber-800", icon: XCircle },
  };
  const c = map[s] ?? map.pending;
  const Icon = c.icon;
  return <Badge className={c.cls}><Icon className="w-3 h-3 mr-1" />{c.label}</Badge>;
}

export default function BackupRestorePage() {
  const { isAdmin, loading: lA } = useIsAdmin();
  const { isSuperAdmin, loading: lS } = useIsSuperAdmin();
  const allowed = isAdmin || isSuperAdmin;

  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [audit, setAudit] = useState<BackupAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [includeAudit, setIncludeAudit] = useState(false);
  const [reason, setReason] = useState("");

  async function loadJobs() {
    const { data, error } = await supabase
      .from("backup_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { toast.error("Falha ao carregar backups: " + error.message); return; }
    setJobs((data as unknown as BackupJob[]) ?? []);
  }
  async function loadAudit() {
    const { data, error } = await supabase
      .from("backup_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.warn(error); return; }
    setAudit((data as unknown as BackupAudit[]) ?? []);
  }

  useEffect(() => {
    if (!allowed) return;
    setLoading(true);
    Promise.all([loadJobs(), loadAudit()]).finally(() => setLoading(false));
    // Polling enquanto houver job rodando
    const interval = setInterval(() => {
      loadJobs();
    }, 3000);
    return () => clearInterval(interval);
  }, [allowed]);

  if (lA || lS) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando permissões…</div>;
  }
  if (!allowed) return <Navigate to="/" replace />;

  async function handleCreateBackup() {
    setCreating(true);
    let backupId: string | null = null;
    try {
      toast.info("Iniciando backup chunked…");
      const { data, error } = await supabase.functions.invoke("backup-create", {
        body: { action: "start", reason: reason || "Backup manual", include_audit_logs: includeAudit },
      });
      if (error) throw error;
      backupId = (data as any)?.backup_id;
      if (!backupId) throw new Error("backup_id não retornado");
      toast.success(`Job criado: ${String(backupId).slice(0, 8)}… processando…`);
      setReason("");
      await loadJobs();

      // Loop de steps até concluir/falhar — cada chamada é curta (<2s)
      let safety = 5000;
      while (safety-- > 0) {
        const { data: sd, error: se } = await supabase.functions.invoke("backup-create", {
          body: { action: "step", backup_id: backupId },
        });
        if (se) throw se;
        if ((sd as any)?.done) {
          if ((sd as any)?.phase === "failed") throw new Error((sd as any)?.error ?? "falha desconhecida");
          break;
        }
        await new Promise((r) => setTimeout(r, 60));
      }
      await loadJobs(); await loadAudit();
      toast.success("Backup concluído.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Falha no backup: " + msg);
      await loadJobs(); await loadAudit();
    } finally {
      setCreating(false);
    }
  }

  async function handleDownload(job: BackupJob) {
    try {
      toast.info("Montando ZIP… pode levar alguns segundos.");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { toast.error("Sessão expirada"); return; }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-download`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ backup_id: job.id }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `backup-${job.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error("Falha ao baixar: " + (e instanceof Error ? e.message : String(e)));
    }
  }


  const runningJob = jobs.find((j) => j.status === "running" || j.status === "pending");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold uppercase flex items-center gap-2">
            <FileArchive className="w-6 h-6" />
            Backup & Restauração
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Exportação completa da instância (dados, usuários auth, perfis, permissões e configurações).
          </p>
        </div>
      </div>

      {/* Aviso técnico permanente */}
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="pt-4 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong>Atenção — limitações desta versão:</strong>
            <ul className="list-disc ml-5 space-y-0.5">
              <li>O backup contém <strong>dados</strong>, não o esquema (DDL). A instância destino deve ter as mesmas migrations aplicadas.</li>
              <li>Senhas dos usuários <strong>não são exportadas</strong>; após restauração, cada usuário recebe email para definir nova senha.</li>
              <li>MFA, sessões ativas e identidades sociais (Google/Apple) precisam ser reconfigurados manualmente.</li>
              <li>Logs de auditoria (<code>audit_logs</code>) ficam fora por padrão (volume elevado). Marque a opção abaixo para incluir.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="backups">
        <TabsList>
          <TabsTrigger value="backups"><Database className="w-4 h-4 mr-2" />Backups</TabsTrigger>
          <TabsTrigger value="restore" disabled><RefreshCw className="w-4 h-4 mr-2" />Restaurar (em breve)</TabsTrigger>
          <TabsTrigger value="historico"><HistoryIcon className="w-4 h-4 mr-2" />Histórico</TabsTrigger>
        </TabsList>

        {/* ── BACKUPS ── */}
        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Criar novo backup</CardTitle>
              <CardDescription>Gera um arquivo ZIP completo com manifest, dados, usuários e checksum SHA-256.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo / descrição (opcional)</Label>
                <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: backup mensal, antes de migração de produção, etc."
                  rows={2} disabled={creating} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="audit" checked={includeAudit} onCheckedChange={(c) => setIncludeAudit(!!c)} disabled={creating} />
                <Label htmlFor="audit" className="text-sm cursor-pointer">
                  Incluir <code>audit_logs</code> (pode aumentar o arquivo em &gt;100 MB)
                </Label>
              </div>
              <Button onClick={handleCreateBackup} disabled={creating || !!runningJob}>
                {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando backup…</> :
                  <><Database className="w-4 h-4 mr-2" />Criar Backup</>}
              </Button>
              {runningJob && (
                <div className="space-y-2 border rounded-md p-3 bg-blue-50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Em andamento: {runningJob.progress?.step ?? "iniciando"}</span>
                    <span>{runningJob.progress?.percent ?? 0}%</span>
                  </div>
                  <Progress value={runningJob.progress?.percent ?? 0} />
                  {runningJob.progress?.current != null && runningJob.progress?.total != null && (
                    <p className="text-xs text-muted-foreground">
                      Tabela {runningJob.progress.current} de {runningJob.progress.total}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Backups gerados</CardTitle>
              <CardDescription>{jobs.length} registro(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Carregando…</div> :
               jobs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum backup gerado ainda.</p> :
               <div className="space-y-2">
                {jobs.map((j) => (
                  <div key={j.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(j.status)}
                        <span className="text-sm font-medium">{formatDate(j.created_at)}</span>
                        <span className="text-xs text-muted-foreground">por {j.created_by_email ?? "—"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                        <span>📦 {formatBytes(j.file_size_bytes)}</span>
                        <span>⏱ {formatDuration(j.duration_ms)}</span>
                        <span>👥 {j.auth_user_count ?? 0} usuários</span>
                        <span>🗂 {j.table_counts ? Object.values(j.table_counts).reduce((a, b) => a + b, 0).toLocaleString("pt-BR") : 0} registros</span>
                      </div>
                      {j.reason && <p className="text-xs italic text-slate-600 truncate">{j.reason}</p>}
                      {j.error && <p className="text-xs text-rose-700 break-all">Erro: {j.error}</p>}
                      {j.checksum_sha256 && <p className="text-[10px] font-mono text-slate-400 truncate">sha256: {j.checksum_sha256}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {j.status === "completed" && j.storage_path && (
                        <Button size="sm" variant="outline" onClick={() => handleDownload(j)}>
                          <Download className="w-4 h-4 mr-1" />Baixar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
               </div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── HISTÓRICO (auditoria) ── */}
        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trilha de auditoria</CardTitle>
              <CardDescription>{audit.length} evento(s) — últimos 100</CardDescription>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? <p className="text-sm text-muted-foreground">Sem eventos registrados.</p> :
                <div className="space-y-1 text-sm">
                  {audit.map((e) => (
                    <div key={e.id} className="border-l-2 border-slate-200 pl-3 py-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-500">{formatDate(e.created_at)}</span>
                        <Badge variant="outline" className="text-xs">{e.action}</Badge>
                        {e.result === "fail" && <Badge className="bg-rose-100 text-rose-800 text-xs">falha</Badge>}
                        {e.result === "success" && <Badge className="bg-emerald-100 text-emerald-800 text-xs">ok</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.actor_email ?? "sistema"} · {formatDuration(e.duration_ms)}
                        {e.error && <span className="text-rose-700"> · {e.error}</span>}
                      </div>
                    </div>
                  ))}
                </div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground flex items-center gap-2 pt-4 border-t">
        <ShieldAlert className="w-3.5 h-3.5" />
        Módulo restrito a administradores. Todas as operações são auditadas em tempo real.
      </div>
    </div>
  );
}
