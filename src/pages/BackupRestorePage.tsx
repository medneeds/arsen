import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Database, Download, RefreshCw, ShieldAlert, History as HistoryIcon,
  Loader2, FileArchive, AlertTriangle, CheckCircle2, XCircle, RotateCcw, FlaskConical, Upload,
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

interface RestoreJob {
  id: string;
  created_at: string;
  created_by_email: string | null;
  backup_job_id: string | null;
  dry_run: boolean | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: any;
  report: any;
  reason: string | null;
  error: string | null;
  duration_ms: number | null;
}

type PlanItem = { table: string; pk: string[]; parts: { path: string }[]; rows_expected: number };

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
  const [restoreJobs, setRestoreJobs] = useState<RestoreJob[]>([]);
  const [audit, setAudit] = useState<BackupAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [includeAudit, setIncludeAudit] = useState(false);
  const [reason, setReason] = useState("");

  // ── Restore state
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupJob | null>(null);
  const [restoreStep, setRestoreStep] = useState<1 | 2 | 3>(1);
  const [restoreMode, setRestoreMode] = useState<"full" | "partial">("full");
  const [restoreDryRun, setRestoreDryRun] = useState(true);
  const [restoreTables, setRestoreTables] = useState<Set<string>>(new Set());
  const [restoreReason, setRestoreReason] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoreRunning, setRestoreRunning] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ percent: number; step: string; processed: number; errors: number } | null>(null);

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
  async function loadRestoreJobs() {
    const { data, error } = await supabase
      .from("restore_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { console.warn(error); return; }
    setRestoreJobs((data as unknown as RestoreJob[]) ?? []);
  }

  useEffect(() => {
    if (!allowed) return;
    setLoading(true);
    Promise.all([loadJobs(), loadAudit(), loadRestoreJobs()]).finally(() => setLoading(false));
    const interval = setInterval(() => {
      loadJobs(); loadRestoreJobs();
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
      toast.info("Listando arquivos do backup…");
      const { data, error } = await supabase.functions.invoke("backup-download", {
        body: { backup_id: job.id },
      });
      if (error) throw error;
      const files: { rel: string; url: string; bytes: number }[] = (data as any)?.files ?? [];
      if (files.length === 0) throw new Error("Nenhum arquivo retornado");

      // Baixa cada parte e monta o ZIP no browser via fflate
      const { zip: makeZip, strToU8 } = await import("fflate");
      const tree: Record<string, Uint8Array> = {};
      let done = 0;
      const total = files.length;
      const totalBytes = files.reduce((a, f) => a + (f.bytes ?? 0), 0);
      let downloadedBytes = 0;
      const toastId = toast.loading(`Baixando ${total} arquivos… 0%`);

      for (const f of files) {
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`HTTP ${res.status} em ${f.rel}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        tree[f.rel] = buf;
        done++;
        downloadedBytes += buf.byteLength;
        const pct = totalBytes > 0
          ? Math.floor((downloadedBytes / totalBytes) * 100)
          : Math.floor((done / total) * 100);
        toast.loading(`Baixando ${done}/${total} arquivos · ${pct}%`, { id: toastId });
      }

      // Reorganiza em estrutura de pastas
      const structured: any = {};
      for (const [path, bytes] of Object.entries(tree)) {
        const parts = path.split("/");
        let cur = structured;
        for (let i = 0; i < parts.length - 1; i++) {
          cur[parts[i]] = cur[parts[i]] ?? {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = bytes;
      }

      toast.loading("Compactando ZIP…", { id: toastId });
      const zipped: Uint8Array = await new Promise((resolve, reject) => {
        makeZip(structured, { level: 0 }, (err, out) => err ? reject(err) : resolve(out));
      });
      void strToU8; // marca uso para evitar tree-shake remover import

      const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `backup-${job.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`Backup baixado (${formatBytes(blob.size)})`, { id: toastId });
    } catch (e) {
      toast.error("Falha ao baixar: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function openRestoreDialog(job: BackupJob) {
    setRestoreTarget(job);
    setRestoreStep(1);
    setRestoreMode("full");
    setRestoreDryRun(true);
    setRestoreTables(new Set(Object.keys(job.table_counts ?? {})));
    setRestoreReason("");
    setRestorePassword("");
    setRestoreConfirm("");
    setRestoreProgress(null);
    setRestoreOpen(true);
  }

  async function runRestore() {
    if (!restoreTarget) return;
    setRestoreRunning(true);
    let restoreId: string | null = null;
    let plan: PlanItem[] = [];
    try {
      toast.info(restoreDryRun ? "Iniciando simulação (dry-run)…" : "Iniciando restauração…");
      const { data: planRes, error: planErr } = await supabase.functions.invoke("backup-restore", {
        body: {
          action: "plan",
          backup_id: restoreTarget.id,
          mode: restoreMode,
          tables: restoreMode === "partial" ? Array.from(restoreTables) : undefined,
          dry_run: restoreDryRun,
          reason: restoreReason,
          password: restorePassword,
        },
      });
      if (planErr) throw planErr;
      restoreId = (planRes as any)?.restore_id;
      plan = (planRes as any)?.plan ?? [];
      if (!restoreId) throw new Error("restore_id não retornado");
      toast.success(`Job criado: ${String(restoreId).slice(0, 8)}…`);
      await loadRestoreJobs();

      const totalParts = plan.reduce((a, p) => a + p.parts.length, 0) || 1;
      let doneParts = 0;
      let processedTotal = 0;
      let errorsTotal = 0;
      for (const t of plan) {
        for (const part of t.parts) {
          const { data: sd, error: se } = await supabase.functions.invoke("backup-restore", {
            body: { action: "step", restore_id: restoreId, table: t.table, part_path: part.path },
          });
          if (se) throw se;
          processedTotal += (sd as any)?.rows_processed ?? 0;
          errorsTotal += (sd as any)?.errors ?? 0;
          doneParts++;
          setRestoreProgress({
            percent: Math.floor((doneParts / totalParts) * 100),
            step: `${t.table} — ${doneParts}/${totalParts}`,
            processed: processedTotal,
            errors: errorsTotal,
          });
          await new Promise((r) => setTimeout(r, 30));
        }
      }

      await supabase.functions.invoke("backup-restore", {
        body: { action: "finalize", restore_id: restoreId, success: errorsTotal === 0 },
      });
      if (errorsTotal === 0) {
        toast.success(restoreDryRun ? `Simulação OK: ${processedTotal} linhas validadas.` : `Restauração concluída: ${processedTotal} linhas.`);
      } else {
        toast.warning(`Concluído com ${errorsTotal} erros (verifique histórico).`);
      }
      setRestoreOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Falha no restore: " + msg);
      if (restoreId) {
        try {
          await supabase.functions.invoke("backup-restore", {
            body: { action: "finalize", restore_id: restoreId, success: false, error: msg },
          });
        } catch { /* */ }
      }
    } finally {
      setRestoreRunning(false);
      await loadRestoreJobs();
      await loadAudit();
    }
  }

  const runningJob = jobs.find((j) => j.status === "running" || j.status === "pending");
  const runningRestore = restoreJobs.find((j) => j.status === "running" || j.status === "pending");
  const canRestore = isSuperAdmin;

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
          <TabsTrigger value="restore"><RefreshCw className="w-4 h-4 mr-2" />Restaurar</TabsTrigger>
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

        {/* ── RESTAURAR ── */}
        <TabsContent value="restore" className="space-y-4">
          {!canRestore && (
            <Card className="border-rose-300 bg-rose-50">
              <CardContent className="pt-4 text-sm text-rose-900 flex gap-3">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  A restauração é restrita a <strong>Super Administradores</strong>. Admin comum pode apenas
                  baixar backups. Solicite ao super admin se precisar restaurar.
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-rose-300">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><RotateCcw className="w-5 h-5 text-rose-600" />Restaurar a partir de um backup</CardTitle>
              <CardDescription>
                Operação <strong>irreversível</strong>. Sobrescreve dados existentes via UPSERT por chave primária.
                Recomendado executar <strong>simulação (dry-run)</strong> antes do restore real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.filter((j) => j.status === "completed").length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum backup concluído disponível.</p>
              ) : (
                <div className="space-y-2">
                  {jobs.filter((j) => j.status === "completed").map((j) => (
                    <div key={j.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <div className="font-medium">{formatDate(j.created_at)} · {formatBytes(j.file_size_bytes)}</div>
                        <div className="text-xs text-muted-foreground">
                          {j.table_counts ? Object.keys(j.table_counts).length : 0} tabelas ·
                          {" "}{j.table_counts ? Object.values(j.table_counts).reduce((a, b) => a + b, 0).toLocaleString("pt-BR") : 0} registros
                          {" "}· por {j.created_by_email ?? "—"}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!canRestore || !!runningRestore}
                        onClick={() => openRestoreDialog(j)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />Restaurar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Restaurações executadas</CardTitle>
              <CardDescription>{restoreJobs.length} registro(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {restoreJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma restauração executada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {restoreJobs.map((r) => (
                    <div key={r.id} className="border rounded-md p-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(r.status)}
                        {r.dry_run && <Badge variant="outline" className="text-xs"><FlaskConical className="w-3 h-3 mr-1" />dry-run</Badge>}
                        <span className="font-medium">{formatDate(r.created_at)}</span>
                        <span className="text-xs text-muted-foreground">por {r.created_by_email ?? "—"} · {formatDuration(r.duration_ms)}</span>
                      </div>
                      {r.status === "running" && r.progress && (
                        <div className="mt-2 space-y-1">
                          <Progress value={r.progress.percent ?? 0} />
                          <p className="text-xs text-muted-foreground">{r.progress.step} · {r.progress.processed ?? 0} linhas · {r.progress.errors ?? 0} erros</p>
                        </div>
                      )}
                      {r.report && r.status === "completed" && (
                        <p className="text-xs text-emerald-700 mt-1">{r.report.processed ?? 0} linhas processadas · {r.report.errors ?? 0} erros</p>
                      )}
                      {r.reason && <p className="text-xs italic text-slate-600 mt-1">{r.reason}</p>}
                      {r.error && <p className="text-xs text-rose-700 break-all">Erro: {r.error}</p>}
                    </div>
                  ))}
                </div>
              )}
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

      {/* ── Dialog de Restauração ── */}
      <Dialog open={restoreOpen} onOpenChange={(o) => { if (!restoreRunning) setRestoreOpen(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <RotateCcw className="w-5 h-5" />
              {restoreDryRun ? "Simulação de restauração" : "Restauração de backup"} — Etapa {restoreStep} de 3
            </DialogTitle>
            <DialogDescription>
              Backup de {restoreTarget ? formatDate(restoreTarget.created_at) : "—"} · {restoreTarget ? formatBytes(restoreTarget.file_size_bytes) : "—"}
            </DialogDescription>
          </DialogHeader>

          {/* Etapa 1 — modo + dry-run + tabelas */}
          {restoreStep === 1 && restoreTarget && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Modo de restauração</Label>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant={restoreMode === "full" ? "default" : "outline"} onClick={() => setRestoreMode("full")}>Completo (todas as tabelas)</Button>
                  <Button size="sm" variant={restoreMode === "partial" ? "default" : "outline"} onClick={() => setRestoreMode("partial")}>Parcial (selecionar)</Button>
                </div>
              </div>

              <div className="flex items-center gap-2 border rounded-md p-3 bg-blue-50">
                <Checkbox id="dryrun" checked={restoreDryRun} onCheckedChange={(c) => setRestoreDryRun(!!c)} />
                <Label htmlFor="dryrun" className="text-sm cursor-pointer flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-blue-600" />
                  <strong>Simulação (dry-run)</strong> — baixa e valida os arquivos sem escrever no banco. <strong>Altamente recomendado</strong>.
                </Label>
              </div>

              {restoreMode === "partial" && restoreTarget.table_counts && (
                <div>
                  <Label className="text-sm font-medium">Tabelas a restaurar</Label>
                  <ScrollArea className="h-48 border rounded-md p-2 mt-1">
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(restoreTarget.table_counts).sort().map(([t, n]) => (
                        <label key={t} className="flex items-center gap-2 text-xs hover:bg-slate-50 px-1 rounded cursor-pointer">
                          <Checkbox
                            checked={restoreTables.has(t)}
                            onCheckedChange={(c) => {
                              const next = new Set(restoreTables);
                              if (c) next.add(t); else next.delete(t);
                              setRestoreTables(next);
                            }}
                          />
                          <span className="font-mono">{t}</span>
                          <span className="text-muted-foreground">({n.toLocaleString("pt-BR")})</span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-1">{restoreTables.size} tabela(s) selecionada(s)</p>
                </div>
              )}
            </div>
          )}

          {/* Etapa 2 — avisos */}
          {restoreStep === 2 && (
            <div className="space-y-3">
              <Card className="border-rose-300 bg-rose-50">
                <CardContent className="pt-4 text-sm text-rose-900 space-y-2">
                  <p className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />O que vai acontecer:</p>
                  <ul className="list-disc ml-5 space-y-1">
                    {!restoreDryRun && <li>O sistema entrará em <strong>modo manutenção</strong> — usuários comuns ficam bloqueados até finalizar.</li>}
                    {!restoreDryRun && <li>Linhas do backup serão <strong>UPSERT</strong> (insert ou overwrite) por chave primária. Linhas que existem só no destino <strong>não</strong> são apagadas.</li>}
                    {!restoreDryRun && <li>Triggers, RLS e constraints ficam <strong>ativos</strong> durante a operação — falhas individuais são reportadas.</li>}
                    <li>Senhas, MFA e identidades sociais <strong>não são restauradas</strong>.</li>
                    <li>Usuários de auth (auth.users) <strong>não são tocados</strong> nesta versão.</li>
                    {restoreDryRun && <li className="font-bold">Em dry-run, NENHUMA gravação ocorre. Apenas validação de manifest, parts e JSON.</li>}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Etapa 3 — senha + confirmação */}
          {restoreStep === 3 && (
            <div className="space-y-3">
              {restoreRunning && restoreProgress ? (
                <div className="space-y-2">
                  <Progress value={restoreProgress.percent} />
                  <p className="text-sm font-medium">{restoreProgress.step}</p>
                  <p className="text-xs text-muted-foreground">{restoreProgress.processed} linhas processadas · {restoreProgress.errors} erros</p>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="rreason" className="text-sm">Motivo / justificativa (≥10 caracteres, será auditado)</Label>
                    <Textarea id="rreason" value={restoreReason} onChange={(e) => setRestoreReason(e.target.value)} rows={2} maxLength={500} />
                  </div>
                  <div>
                    <Label htmlFor="rpass" className="text-sm">Sua senha (reverificação)</Label>
                    <Input id="rpass" type="password" value={restorePassword} onChange={(e) => setRestorePassword(e.target.value)} autoComplete="current-password" />
                  </div>
                  <div>
                    <Label htmlFor="rconfirm" className="text-sm">
                      Digite <code className="bg-rose-100 px-1 rounded">RESTAURAR AGORA</code> para confirmar
                    </Label>
                    <Input id="rconfirm" value={restoreConfirm} onChange={(e) => setRestoreConfirm(e.target.value.toUpperCase())} />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {restoreStep > 1 && !restoreRunning && (
              <Button variant="outline" onClick={() => setRestoreStep((s) => (s - 1) as 1 | 2 | 3)}>Voltar</Button>
            )}
            {restoreStep < 3 && (
              <Button
                onClick={() => setRestoreStep((s) => (s + 1) as 1 | 2 | 3)}
                disabled={restoreStep === 1 && restoreMode === "partial" && restoreTables.size === 0}
              >
                Continuar
              </Button>
            )}
            {restoreStep === 3 && (
              <Button
                variant="destructive"
                onClick={runRestore}
                disabled={
                  restoreRunning ||
                  restoreReason.trim().length < 10 ||
                  !restorePassword ||
                  restoreConfirm !== "RESTAURAR AGORA"
                }
              >
                {restoreRunning ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Executando…</>
                ) : restoreDryRun ? (
                  <><FlaskConical className="w-4 h-4 mr-2" />Executar simulação</>
                ) : (
                  <><RotateCcw className="w-4 h-4 mr-2" />Confirmar restauração</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
