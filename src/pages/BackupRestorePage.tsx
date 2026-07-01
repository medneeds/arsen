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

// Extrai mensagem específica do campo "error" do JSON retornado pela edge function
// em respostas não-2xx. supabase.functions.invoke devolve FunctionsHttpError
// com `.context` = Response — precisamos ler/parsear esse body manualmente.
async function extractEdgeError(err: unknown, fnName: string): Promise<string> {
  const fallback = err instanceof Error ? err.message : String(err);
  try {
    const ctx = (err as { context?: Response } | null)?.context;
    if (!ctx) {
      console.error(`[${fnName}] erro sem context:`, err);
      return fallback;
    }
    const status = ctx.status;
    let bodyText = "";
    try {
      const cloned = typeof ctx.clone === "function" ? ctx.clone() : null;
      bodyText = cloned ? await cloned.text() : await ctx.text();
    } catch { /* body já consumido */ }
    console.error(`[${fnName}] HTTP ${status} — body:`, bodyText);
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed && typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
        if (parsed && typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
      } catch { /* não-JSON */ }
      return `HTTP ${status}: ${bodyText.slice(0, 300)}`;
    }
    return `HTTP ${status}: ${fallback}`;
  } catch (parseErr) {
    console.error(`[${fnName}] falha ao extrair erro:`, parseErr, err);
    return fallback;
  }
}

interface BackupJob {
  id: string;
  created_at: string;
  created_by_email: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: { step: string; percent: number; current?: number | null; total?: number | null; imported?: boolean } | null;
  storage_path: string | null;
  file_size_bytes: number | null;
  table_counts: Record<string, number> | null;
  auth_user_count: number | null;
  checksum_sha256: string | null;
  duration_ms: number | null;
  reason: string | null;
  error: string | null;
  finished_at: string | null;
  manifest: any | null;
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

// Mesmo array replicado no backend (supabase/functions/backup-create/index.ts).
// Usado só para exibir badge "config" na UI.
const SPECIAL_TABLES = new Set<string>([
  "profiles", "user_roles", "user_departments", "user_hospital_assignments",
  "institution_branding", "hospital_units", "states", "system_maintenance_mode",
  "cid10_codes",
]);

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
  const [incremental, setIncremental] = useState(false);
  const [sinceLocal, setSinceLocal] = useState(""); // datetime-local: "YYYY-MM-DDTHH:mm"

  // ── Seleção parcial de tabelas
  const [allTables, setAllTables] = useState<string[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [includeAuthUsers, setIncludeAuthUsers] = useState(true);
  const [tableSearch, setTableSearch] = useState("");

  // ── Restore state
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupJob | null>(null);
  const [restoreStep, setRestoreStep] = useState<1 | 2 | 3>(1);
  const [restoreMode, setRestoreMode] = useState<"full" | "partial">("full");
  const [restoreDryRun, setRestoreDryRun] = useState(true);
  const [restoreMirror, setRestoreMirror] = useState(false);
  const [restoreTables, setRestoreTables] = useState<Set<string>>(new Set());
  const [restoreReason, setRestoreReason] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoreRunning, setRestoreRunning] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ percent: number; step: string; processed: number; errors: number } | null>(null);
  const [restoreMergeAck, setRestoreMergeAck] = useState(false);


  // ── Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ percent: number; step: string } | null>(null);

  // ── Maintenance state
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [forceUnlocking, setForceUnlocking] = useState(false);
  const [forceUnlockOpen, setForceUnlockOpen] = useState(false);
  const [forceUnlockReason, setForceUnlockReason] = useState("");

  async function loadMaintenance() {
    const { data } = await supabase
      .from("system_maintenance_mode")
      .select("is_active")
      .eq("id", 1)
      .maybeSingle();
    setMaintenanceActive(!!(data as any)?.is_active);
  }

  async function handleForceUnlock() {
    setForceUnlocking(true);
    try {
      const { error } = await supabase.functions.invoke("backup-restore", {
        body: { action: "force_unlock", reason: forceUnlockReason.trim() || undefined },
      });
      if (error) throw new Error(await extractEdgeError(error, "backup-restore:force_unlock"));
      toast.success("Modo manutenção desativado.");
      setForceUnlockOpen(false);
      setForceUnlockReason("");
      await Promise.all([loadMaintenance(), loadRestoreJobs(), loadAudit()]);
    } catch (e) {
      toast.error("Falha ao destravar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setForceUnlocking(false);
    }
  }




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
  async function loadAllTables() {
    setTablesLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_public_tables_timestamp_cols" as any);
      if (error) throw error;
      const rows = (data as { name: string }[] | null) ?? [];
      const names = rows.map((r) => r.name).sort();
      setAllTables(names);
      setSelectedTables(new Set(names)); // default: todas marcadas
    } catch (e) {
      console.warn("[loadAllTables]", e);
      toast.error("Falha ao listar tabelas: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTablesLoading(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    setLoading(true);
    Promise.all([loadJobs(), loadAudit(), loadRestoreJobs(), loadMaintenance(), loadAllTables()]).finally(() => setLoading(false));
    const interval = setInterval(() => {
      loadJobs(); loadRestoreJobs(); loadMaintenance();
    }, 3000);
    return () => clearInterval(interval);
  }, [allowed]);

  // Pré-preenche a data de corte com o horário do último backup completo
  // quando o modo incremental é ligado (se ainda estiver vazio).
  useEffect(() => {
    if (!incremental || sinceLocal) return;
    const lastFull = jobs.find((j) =>
      j.status === "completed" &&
      !j.manifest?.incremental?.enabled
    );
    const ts = lastFull?.finished_at ?? lastFull?.created_at;
    if (!ts) return;
    const d = new Date(ts);
    // datetime-local exige "YYYY-MM-DDTHH:mm" no fuso local
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setSinceLocal(local);
  }, [incremental, jobs, sinceLocal]);


  if (lA || lS) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando permissões…</div>;
  }
  if (!allowed) return <Navigate to="/" replace />;

  async function handleCreateBackup() {
    setCreating(true);
    let backupId: string | null = null;
    try {
      let sinceIso: string | null = null;
      if (incremental) {
        if (!sinceLocal) {
          toast.error("Informe a data/hora de corte para o backup incremental.");
          setCreating(false);
          return;
        }
        const parsed = new Date(sinceLocal);
        if (!Number.isFinite(parsed.getTime())) {
          toast.error("Data de corte inválida.");
          setCreating(false);
          return;
        }
        sinceIso = parsed.toISOString();
      }
      // Seleção parcial: envia lista só quando NÃO for todas
      const isAllSelected = allTables.length > 0 && selectedTables.size === allTables.length;
      const partialList = isAllSelected ? null : Array.from(selectedTables);
      if (partialList && partialList.length === 0 && !includeAuthUsers) {
        toast.error("Selecione pelo menos uma tabela ou marque 'Usuários (auth)'.");
        setCreating(false);
        return;
      }
      const tags: string[] = [];
      if (incremental) tags.push(`incremental desde ${sinceIso}`);
      if (partialList) tags.push(`parcial (${partialList.length} tabela${partialList.length === 1 ? "" : "s"})`);
      if (!includeAuthUsers) tags.push("sem auth");
      toast.info(tags.length ? `Iniciando backup ${tags.join(" • ")}…` : "Iniciando backup chunked…");
      const { data, error } = await supabase.functions.invoke("backup-create", {
        body: {
          action: "start",
          reason: reason || (incremental ? "Backup incremental" : partialList ? "Backup parcial" : "Backup manual"),
          include_audit_logs: includeAudit,
          include_auth_users: includeAuthUsers,
          ...(sinceIso ? { since: sinceIso } : {}),
          ...(partialList ? { tables: partialList } : {}),
        },
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

  async function handleImportFile(file: File) {
    if (!file) return;
    if (file.size > 600 * 1024 * 1024) {
      toast.error("Arquivo maior que 600 MB. Limite atual: ~500 MB.");
      return;
    }
    setImporting(true);
    setImportProgress({ percent: 0, step: "lendo arquivo…" });
    try {
      const { unzip } = await import("fflate");
      const buf = new Uint8Array(await file.arrayBuffer());
      setImportProgress({ percent: 5, step: "extraindo ZIP…" });
      const entries: Record<string, Uint8Array> = await new Promise((resolve, reject) => {
        unzip(buf, (err, data) => err ? reject(err) : resolve(data as any));
      });

      // Filtra apenas arquivos (não diretórios)
      const files = Object.entries(entries).filter(([_, v]) => v && v.byteLength >= 0);
      const manifestEntry = files.find(([k]) => k === "manifest.json" || k.endsWith("/manifest.json"));
      if (!manifestEntry) throw new Error("manifest.json não encontrado no ZIP");
      const manifestText = new TextDecoder().decode(manifestEntry[1]);
      const manifest = JSON.parse(manifestText);
      if (!String(manifest.backup_version ?? "").startsWith("3.")) {
        throw new Error(`Versão de backup não suportada: ${manifest.backup_version}`);
      }

      // Prefixo (caso o ZIP tenha um diretório raiz)
      const prefix = manifestEntry[0].endsWith("/manifest.json")
        ? manifestEntry[0].slice(0, -"manifest.json".length)
        : "";

      setImportProgress({ percent: 10, step: "criando job…" });
      const { data: initRes, error: initErr } = await supabase.functions.invoke("backup-import", {
        body: { action: "init", manifest },
      });
      if (initErr) throw new Error(await extractEdgeError(initErr, "backup-import:init"));
      const newBackupId = (initRes as any)?.backup_id;
      if (!newBackupId) throw new Error("backup_id não retornado");

      // Envia cada part declarado no manifest
      const parts: { path: string; bytes: number }[] = manifest.parts ?? [];
      const total = parts.length;
      let done = 0;
      for (const p of parts) {
        const key = prefix + p.path;
        const bytes = entries[key];
        if (!bytes) throw new Error(`part ausente no ZIP: ${p.path}`);
        const { data: uploadRes, error: pErr } = await supabase.functions.invoke("backup-import", {
          body: { action: "part", backup_id: newBackupId, rel_path: p.path },
        });
        if (pErr) throw new Error(await extractEdgeError(pErr, "backup-import:part"));
        const uploadPath = (uploadRes as any)?.path;
        const uploadToken = (uploadRes as any)?.token;
        if (!uploadPath || !uploadToken) throw new Error(`URL de upload não retornada para ${p.path}`);

        const { error: upErr } = await supabase.storage
          .from("db-backups")
          .uploadToSignedUrl(uploadPath, uploadToken, bytes, {
            contentType: (uploadRes as any)?.content_type ?? "application/octet-stream",
            upsert: true,
          });
        if (upErr) throw new Error(`upload ${p.path}: ${upErr.message}`);
        done++;
        setImportProgress({
          percent: 10 + Math.floor((done / total) * 85),
          step: `enviando ${done}/${total}: ${p.path}`,
        });
      }

      setImportProgress({ percent: 96, step: "finalizando…" });
      const { error: fErr } = await supabase.functions.invoke("backup-import", {
        body: { action: "finalize", backup_id: newBackupId },
      });
      if (fErr) throw new Error(await extractEdgeError(fErr, "backup-import:finalize"));


      setImportProgress({ percent: 100, step: "concluído" });
      toast.success("Backup importado. Clique em Restaurar para usar.");
      await loadJobs(); await loadAudit();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Falha ao importar: " + msg);
    } finally {
      setImporting(false);
      setTimeout(() => setImportProgress(null), 2000);
    }
  }

  function openRestoreDialog(job: BackupJob) {
    setRestoreTarget(job);
    setRestoreStep(1);
    setRestoreMode("full");
    setRestoreDryRun(true);
    setRestoreMirror(false);
    setRestoreTables(new Set(Object.keys(job.table_counts ?? {})));
    setRestoreReason("");
    setRestorePassword("");
    setRestoreConfirm("");
    setRestoreProgress(null);
    setRestoreMergeAck(false);
    setRestoreOpen(true);
  }

  async function runRestore() {
    if (!restoreTarget) return;
    setRestoreRunning(true);
    let restoreId: string | null = null;
    let plan: PlanItem[] = [];
    try {
      toast.info(restoreDryRun ? "Iniciando simulação (dry-run)…" : (restoreMirror ? "Iniciando restauração em modo ESPELHO…" : "Iniciando restauração…"));
      const { data: planRes, error: planErr } = await supabase.functions.invoke("backup-restore", {
        body: {
          action: "plan",
          backup_id: restoreTarget.id,
          mode: restoreMode,
          tables: restoreMode === "partial" ? Array.from(restoreTables) : undefined,
          dry_run: restoreDryRun,
          mirror: restoreMirror && !restoreDryRun,
          reason: restoreReason,
          password: restorePassword,
        },
      });

      if (planErr) throw new Error(await extractEdgeError(planErr, "backup-restore:plan"));
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
          if (se) throw new Error(await extractEdgeError(se, `backup-restore:step ${t.table}/${part.path}`));
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

      {/* Modo manutenção — destrava forçado para super_admin */}
      {maintenanceActive && isSuperAdmin && (
        <Card className="border-red-400 bg-red-50">
          <CardContent className="pt-4 text-sm text-red-900 flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong>Modo manutenção ATIVO.</strong> Todas as escritas estão bloqueadas para usuários comuns.
                Se um restore travou e não foi finalizado, use o botão ao lado para liberar o sistema.
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setForceUnlockOpen(true)}
              disabled={forceUnlocking}
            >
              {forceUnlocking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              Forçar saída do modo manutenção
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={forceUnlockOpen} onOpenChange={setForceUnlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="w-5 h-5" />
              Forçar saída do modo manutenção
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block">
                Esta ação <strong>desativa imediatamente</strong> o modo manutenção e marca como <code>failed</code> qualquer restore em execução.
              </span>
              <span className="block">
                Use apenas se você tem certeza de que nenhum restore legítimo está rodando neste momento.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="force-reason" className="text-sm">Motivo (opcional)</Label>
            <Textarea
              id="force-reason"
              placeholder="Ex.: restore travou no meio, navegador fechou"
              value={forceUnlockReason}
              onChange={(e) => setForceUnlockReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceUnlockOpen(false)} disabled={forceUnlocking}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleForceUnlock} disabled={forceUnlocking}>
              {forceUnlocking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Desativar manutenção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



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

              <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="incremental"
                    checked={incremental}
                    onCheckedChange={(c) => setIncremental(!!c)}
                    disabled={creating}
                  />
                  <Label htmlFor="incremental" className="text-sm cursor-pointer font-medium">
                    Backup incremental (só linhas alteradas desde a data de corte)
                  </Label>
                </div>
                {incremental && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="since" className="text-xs text-muted-foreground">
                      Data/hora de corte (fuso local — usa <code>updated_at</code> quando disponível,
                      senão <code>created_at</code>; tabelas sem essas colunas vêm completas)
                    </Label>
                    <Input
                      id="since"
                      type="datetime-local"
                      value={sinceLocal}
                      onChange={(e) => setSinceLocal(e.target.value)}
                      disabled={creating}
                      className="max-w-xs"
                    />
                    <p className="text-xs text-amber-700">
                      ⚠️ Backups incrementais NÃO capturam deleções após a data de corte. Combine com um backup completo periódico.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Escopo do backup: seleção parcial de tabelas ── */}
              <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium">Escopo do backup</p>
                    <p className="text-xs text-muted-foreground">
                      {tablesLoading ? "Carregando tabelas…" : (
                        allTables.length === 0 ? "Nenhuma tabela detectada." :
                        selectedTables.size === allTables.length ? `Todas as ${allTables.length} tabelas serão incluídas.` :
                        `${selectedTables.size} de ${allTables.length} tabela(s) selecionada(s) — backup PARCIAL.`
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline"
                      disabled={creating || tablesLoading || allTables.length === 0}
                      onClick={() => setSelectedTables(new Set(allTables))}>
                      Marcar todas
                    </Button>
                    <Button type="button" size="sm" variant="outline"
                      disabled={creating || tablesLoading || selectedTables.size === 0}
                      onClick={() => setSelectedTables(new Set())}>
                      Limpar
                    </Button>
                  </div>
                </div>

                <Input
                  placeholder="Filtrar tabelas por nome…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  disabled={creating || tablesLoading}
                  className="max-w-sm"
                />

                <div className="max-h-72 overflow-auto border rounded bg-background">
                  {tablesLoading ? (
                    <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Carregando…
                    </div>
                  ) : allTables.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">Sem tabelas para exibir.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1 p-2">
                      {allTables
                        .filter((t) => !tableSearch || t.toLowerCase().includes(tableSearch.toLowerCase()))
                        .map((t) => {
                          const checked = selectedTables.has(t);
                          const isSpecial = SPECIAL_TABLES.has(t);
                          return (
                            <label key={t}
                              className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-muted/60 cursor-pointer">
                              <Checkbox
                                checked={checked}
                                disabled={creating}
                                onCheckedChange={(c) => {
                                  setSelectedTables((prev) => {
                                    const next = new Set(prev);
                                    if (c) next.add(t); else next.delete(t);
                                    return next;
                                  });
                                }}
                              />
                              <span className="font-mono truncate flex-1" title={t}>{t}</span>
                              {isSpecial && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-400 text-slate-600">
                                  config
                                </Badge>
                              )}
                            </label>
                          );
                        })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t">
                  <Checkbox
                    id="auth-users"
                    checked={includeAuthUsers}
                    onCheckedChange={(c) => setIncludeAuthUsers(!!c)}
                    disabled={creating}
                  />
                  <Label htmlFor="auth-users" className="text-sm cursor-pointer">
                    Incluir usuários <code>auth.users</code> (necessário para restaurar contas de acesso)
                  </Label>
                </div>

                {(selectedTables.size !== allTables.length || !includeAuthUsers) && (
                  <p className="text-xs text-amber-700">
                    ⚠️ Backup PARCIAL: só restaurará as tabelas listadas
                    {!includeAuthUsers ? " e NÃO recriará contas de usuário" : ""}. Combine com um backup completo para restauração total.
                  </p>
                )}
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
                        {j.manifest?.incremental?.enabled && (
                          <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">
                            INCR desde {j.manifest.incremental.since ? formatDate(j.manifest.incremental.since) : "?"}
                          </Badge>
                        )}
                        {j.manifest?.partial?.enabled && (
                          <Badge variant="outline" className="text-[10px] border-purple-400 text-purple-700">
                            PARCIAL ({j.manifest.partial.selected_tables?.length ?? "?"} tab.)
                          </Badge>
                        )}
                        {j.manifest?.partial && j.manifest.partial.include_auth_users === false && (
                          <Badge variant="outline" className="text-[10px] border-rose-400 text-rose-700">
                            SEM AUTH
                          </Badge>
                        )}
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

          {/* Importar backup externo */}
          <Card className="border-blue-300">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Upload className="w-5 h-5 text-blue-600" />Importar backup (ZIP)</CardTitle>
              <CardDescription>
                Envie um arquivo ZIP gerado pelo próprio sistema (v3). Ele aparecerá na lista abaixo como
                <Badge variant="outline" className="mx-1 text-xs">Importado</Badge>
                e ficará pronto para restaurar. Limite prático: ~500 MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".zip,application/zip"
                  disabled={importing || !canRestore}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = "";
                  }}
                />
                {importing && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
              </div>
              {importProgress && (
                <div className="space-y-1 border rounded-md p-2 bg-blue-50">
                  <div className="flex justify-between text-xs"><span>{importProgress.step}</span><span>{importProgress.percent}%</span></div>
                  <Progress value={importProgress.percent} />
                </div>
              )}
              {!canRestore && <p className="text-xs text-rose-700">Apenas Super Administradores podem importar.</p>}
            </CardContent>
          </Card>


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
                        <div className="font-medium flex items-center gap-2">
                          {formatDate(j.created_at)} · {formatBytes(j.file_size_bytes)}
                          {(j.progress as any)?.imported && (
                            <Badge variant="outline" className="text-xs border-blue-400 text-blue-700">
                              <Upload className="w-3 h-3 mr-1" />Importado
                            </Badge>
                          )}
                        </div>
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
                  {restoreJobs.map((r) => {
                    // Erros podem vir do report (após finalize) ou ainda do progress (em execução)
                    const errorsByTable: Record<string, { processed: number; errors: number }> =
                      r.report?.errors_by_table ?? r.progress?.errors_by_table ?? {};
                    const errorSamples: Array<{ table: string; part: string; message: string; at: string }> =
                      (Array.isArray(r.report?.error_samples) && r.report.error_samples) ||
                      (Array.isArray(r.progress?.error_samples) && r.progress.error_samples) || [];
                    const totalErrors = r.report?.errors ?? r.progress?.errors ?? 0;
                    const totalProcessed = r.report?.processed ?? r.progress?.processed ?? 0;
                    const nulledFkCounts: Record<string, number> =
                      r.report?.nulled_fk_counts ?? r.progress?.nulled_fk_counts ?? {};
                    const nulledFkEntries = Object.entries(nulledFkCounts).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
                    const noLinkTotal: number =
                      r.report?.rows_without_patient_link_total ?? r.progress?.rows_without_patient_link_total ?? 0;
                    const noLinkByTable: Record<string, number> =
                      r.report?.rows_without_patient_link_by_table ?? r.progress?.rows_without_patient_link_by_table ?? {};
                    const noLinkEntries = Object.entries(noLinkByTable).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
                    const tableRows = Object.entries(errorsByTable).sort(
                      ([, a], [, b]) => (b?.errors ?? 0) - (a?.errors ?? 0),
                    );
                    const hasDetails = tableRows.length > 0 || errorSamples.length > 0 || nulledFkEntries.length > 0 || noLinkTotal > 0;

                    return (
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
                          <p className={`text-xs mt-1 ${totalErrors > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                            {totalProcessed} linhas processadas · {totalErrors} erros
                          </p>
                        )}
                        {r.reason && <p className="text-xs italic text-slate-600 mt-1">{r.reason}</p>}
                        {r.error && <p className="text-xs text-rose-700 break-all">Erro: {r.error}</p>}

                        {hasDetails && (
                          <details className="mt-2 group">
                            <summary className="cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900 select-none">
                              Ver detalhes ({tableRows.length} tabela{tableRows.length !== 1 ? "s" : ""} · {errorSamples.length} amostra{errorSamples.length !== 1 ? "s" : ""} · {nulledFkEntries.length} FK anulada{nulledFkEntries.length !== 1 ? "s" : ""}{noLinkTotal > 0 ? ` · ${noLinkTotal} sem vínculo` : ""})
                            </summary>
                            <div className="mt-2 space-y-3">
                              {tableRows.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1">Erros por tabela</p>
                                  <div className="border rounded overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-50">
                                        <tr>
                                          <th className="text-left px-2 py-1 font-medium">Tabela</th>
                                          <th className="text-right px-2 py-1 font-medium">Processados</th>
                                          <th className="text-right px-2 py-1 font-medium">Erros</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {tableRows.map(([t, s]) => (
                                          <tr key={t} className="border-t">
                                            <td className="px-2 py-1 font-mono">{t}</td>
                                            <td className="px-2 py-1 text-right">{s?.processed ?? 0}</td>
                                            <td className={`px-2 py-1 text-right font-semibold ${(s?.errors ?? 0) > 0 ? "text-rose-700" : "text-slate-500"}`}>
                                              {s?.errors ?? 0}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              {errorSamples.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1">
                                    Amostras de erro (últimas {errorSamples.length}, cap 50)
                                  </p>
                                  <ScrollArea className="h-48 border rounded bg-slate-50">
                                    <ul className="divide-y">
                                      {errorSamples.slice().reverse().map((s, i) => (
                                        <li key={i} className="p-2 text-xs">
                                          <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
                                            <span className="font-mono">{s.at ? formatDate(s.at) : "—"}</span>
                                            <Badge variant="outline" className="text-[10px]">{s.table}</Badge>
                                            <span className="font-mono truncate">{s.part}</span>
                                          </div>
                                          <p className="text-rose-700 break-all mt-1">{s.message}</p>
                                        </li>
                                      ))}
                                    </ul>
                                  </ScrollArea>
                                </div>
                              )}
                              {nulledFkEntries.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1">
                                    Campos de FK anulados (linha preservada)
                                  </p>
                                  <div className="border rounded overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead className="bg-amber-50">
                                        <tr>
                                          <th className="text-left px-2 py-1 font-medium">Tabela.coluna</th>
                                          <th className="text-right px-2 py-1 font-medium">Campos anulados</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {nulledFkEntries.map(([k, n]) => (
                                          <tr key={k} className="border-t">
                                            <td className="px-2 py-1 font-mono">{k}</td>
                                            <td className="px-2 py-1 text-right font-semibold text-amber-700">{n}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              {noLinkTotal > 0 && (
                                <div>
                                  <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1">
                                    Linhas sem vínculo de paciente preservadas para revisão ({noLinkTotal})
                                  </p>
                                  <div className="border rounded overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-50">
                                        <tr>
                                          <th className="text-left px-2 py-1 font-medium">Tabela</th>
                                          <th className="text-right px-2 py-1 font-medium">Linhas</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {noLinkEntries.map(([t, n]) => (
                                          <tr key={t} className="border-t">
                                            <td className="px-2 py-1 font-mono">{t}</td>
                                            <td className="px-2 py-1 text-right font-semibold text-slate-700">{n}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
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
                <Checkbox id="dryrun" checked={restoreDryRun} onCheckedChange={(c) => { setRestoreDryRun(!!c); if (c) setRestoreMirror(false); }} />
                <Label htmlFor="dryrun" className="text-sm cursor-pointer flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-blue-600" />
                  <strong>Simulação (dry-run)</strong> — baixa e valida os arquivos sem escrever no banco. <strong>Altamente recomendado</strong>.
                </Label>
              </div>

              <div className={`flex items-start gap-2 border rounded-md p-3 ${restoreMirror ? "bg-rose-100 border-rose-400" : "bg-rose-50 border-rose-300"} ${restoreDryRun ? "opacity-60" : ""}`}>
                <Checkbox
                  id="mirror"
                  checked={restoreMirror}
                  disabled={restoreDryRun}
                  onCheckedChange={(c) => setRestoreMirror(!!c)}
                  className="mt-0.5"
                />
                <Label htmlFor="mirror" className="text-sm cursor-pointer text-rose-900">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4" />Modo ESPELHO (destrutivo)
                  </div>
                  <p className="mt-1 font-normal">
                    <strong>Apaga TODAS as linhas</strong> das tabelas do plano antes de inserir as do backup — o estado do banco fica <strong>idêntico</strong> ao do backup (linhas criadas depois do backup são perdidas). Sem esta opção, o restore é apenas UPSERT por PK (merge).
                  </p>
                  <p className="mt-1 text-xs">IDs originais preservados. Não afeta <code>auth.users</code>. Indisponível em dry-run.</p>
                </Label>
              </div>


              {(() => {
                const isFullBackup =
                  restoreMode === "full" &&
                  !restoreTarget?.manifest?.incremental?.enabled;
                if (restoreDryRun || restoreMirror || !isFullBackup) return null;
                return (
                  <div className="border-2 border-amber-400 bg-amber-50 rounded-md p-3 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-900 space-y-1">
                      <p className="font-bold">Atenção: este restore NÃO devolve o banco ao estado do backup.</p>
                      <p>Sem o <strong>Modo ESPELHO</strong>, o restore apenas mescla (upsert por PK):</p>
                      <ul className="list-disc ml-5 text-xs">
                        <li>Registros do backup <strong>sobrescrevem</strong> os existentes com mesma chave.</li>
                        <li>Registros criados <strong>depois</strong> do backup <strong>permanecem no banco</strong>.</li>
                      </ul>
                      <p className="text-xs">Para reproduzir exatamente o snapshot, marque <strong>"Modo ESPELHO (destrutivo)"</strong> acima.</p>
                    </div>
                  </div>
                );
              })()}

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
                    {!restoreDryRun && restoreMirror && <li className="font-bold text-rose-700">MODO ESPELHO ATIVO: todas as linhas das tabelas do plano serão <strong>APAGADAS (TRUNCATE)</strong> antes da inserção. Linhas criadas após o backup <strong>serão perdidas</strong>.</li>}
                    {!restoreDryRun && !restoreMirror && <li>Linhas do backup serão <strong>UPSERT</strong> (insert ou overwrite) por chave primária. Linhas que existem só no destino <strong>não</strong> são apagadas.</li>}
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
