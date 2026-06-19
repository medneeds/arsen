import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertCircle, Database, Download, History, Loader2, Lock, RefreshCw, ShieldAlert, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PromoteSuperAdminDialog } from "./PromoteSuperAdminDialog";

const CHUNK_DEFAULT = 1000;

type BackupRow = {
  id: string; created_at: string; finished_at: string | null; kind: string;
  tables: string[]; status: string; size_bytes: number; row_counts: Record<string, number>;
  error: string | null; notes: string | null;
};
type RestoreRow = {
  id: string; started_at: string; finished_at: string | null; mode: string;
  tables: string[]; status: string; rows_before: Record<string, number>;
  rows_after: Record<string, number>; error: string | null; reason: string;
};

export function BackupRestoreTab() {
  const { isSuperAdmin, loading: roleLoading } = useIsSuperAdmin();
  const { isAdmin } = useIsAdmin();
  const [tab, setTab] = useState("overview");

  if (roleLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" /> Backup &amp; Restore
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Este recurso é restrito a usuários com o papel <strong>Super Admin</strong>.
            {isAdmin
              ? " Como você é admin atual, pode promover um usuário (incluindo você mesmo) usando o botão abaixo."
              : " Solicite a um admin que faça a promoção."}
          </p>
          {isAdmin && (
            <PromoteSuperAdminDialog
              trigger={
                <Button variant="default">
                  <ShieldAlert className="h-4 w-4 mr-2" /> Promover a Super Admin
                </Button>
              }
            />
          )}
          <ScopeNote />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40">
            <ShieldAlert className="h-3 w-3 mr-1" /> SUPER ADMIN
          </Badge>
          <span className="text-xs text-muted-foreground">Backup &amp; restore completos do banco</span>
        </div>
        {isAdmin && (
          <PromoteSuperAdminDialog
            trigger={
              <Button size="sm" variant="outline">
                <ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Promover outro usuário
              </Button>
            }
          />
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview"><History className="h-3.5 w-3.5 mr-1.5" />Visão geral</TabsTrigger>
          <TabsTrigger value="backup"><Download className="h-3.5 w-3.5 mr-1.5" />Backup</TabsTrigger>
          <TabsTrigger value="restore"><Upload className="h-3.5 w-3.5 mr-1.5" />Restore</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewPanel /></TabsContent>
        <TabsContent value="backup"><BackupPanel onDone={() => setTab("overview")} /></TabsContent>
        <TabsContent value="restore"><RestorePanel onDone={() => setTab("overview")} /></TabsContent>
      </Tabs>

      <ScopeNote />
    </div>
  );
}

function ScopeNote() {
  return (
    <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20">
      <CardContent className="pt-4 text-xs text-amber-900 dark:text-amber-200 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" /> Fora de escopo deste recurso
        </p>
        <ul className="list-disc list-inside space-y-0.5 pl-1">
          <li><code>auth.users</code> (contas/credenciais) — gerenciado pelo Supabase</li>
          <li><code>storage.objects</code> (arquivos) — bucket de imagens, anexos, etc.</li>
          <li>PITR (point-in-time recovery) — depende do plano Supabase</li>
        </ul>
        <p>Para esses casos, abra Lovable Cloud → Database ou contate o suporte Lovable/Supabase.</p>
      </CardContent>
    </Card>
  );
}

// ─── Overview ──────────────────────────────────────────────────────────
function OverviewPanel() {
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [restores, setRestores] = useState<RestoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [listDialog, setListDialog] = useState<null | {
    backupId: string;
    files: Array<{ table: string; path: string; filename: string; url: string | null; size_bytes: number }>;
    expiresIn: number;
  }>(null);

  const refresh = async () => {
    setLoading(true);
    const [{ data: bk }, { data: rs }] = await Promise.all([
      supabase.from("db_backups").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("db_restore_audit").select("*").order("started_at", { ascending: false }).limit(30),
    ]);
    setBackups((bk ?? []) as any);
    setRestores((rs ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const handleDownload = async (backupId: string) => {
    setDownloadingId(backupId);
    try {
      const { data, error } = await supabase.functions.invoke("db-backup", {
        body: { action: "download", backup_id: backupId },
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Resposta vazia");
      if (data.mode === "zip" && data.url) {
        window.location.href = data.url;
        toast.success(`Download iniciado (${fmtBytes(data.size_bytes ?? 0)})`);
      } else if (data.mode === "list" && Array.isArray(data.files)) {
        setListDialog({ backupId, files: data.files, expiresIn: Number(data.expires_in ?? 600) });
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error("Resposta inválida da função");
      }
    } catch (e: any) {
      toast.error(`Falha no download: ${e?.message ?? e}`);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Histórico de backups</CardTitle></CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum backup ainda.</p>
          ) : (
            <ScrollArea className="h-64">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left p-1.5">Data</th>
                    <th className="text-left p-1.5">Tipo</th>
                    <th className="text-left p-1.5">Status</th>
                    <th className="text-right p-1.5">Tabelas</th>
                    <th className="text-right p-1.5">Tamanho</th>
                    <th className="text-right p-1.5 w-20">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.id} className="border-b border-border/50">
                      <td className="p-1.5 tabular-nums">{new Date(b.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-1.5"><Badge variant="outline">{b.kind}</Badge></td>
                      <td className="p-1.5"><StatusBadge status={b.status} /></td>
                      <td className="p-1.5 text-right tabular-nums">{b.tables.length}</td>
                      <td className="p-1.5 text-right tabular-nums">{fmtBytes(b.size_bytes)}</td>
                      <td className="p-1.5 text-right">
                        {b.status === "completed" ? (
                          <Button
                            size="sm" variant="ghost" className="h-7 px-2"
                            disabled={downloadingId === b.id}
                            onClick={() => handleDownload(b.id)}
                            title="Baixar backup"
                          >
                            {downloadingId === b.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Download className="h-3.5 w-3.5" />}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Histórico de restores</CardTitle></CardHeader>
        <CardContent>
          {restores.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum restore ainda.</p>
          ) : (
            <ScrollArea className="h-64">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left p-1.5">Data</th>
                    <th className="text-left p-1.5">Modo</th>
                    <th className="text-left p-1.5">Status</th>
                    <th className="text-right p-1.5">Tabelas</th>
                    <th className="text-left p-1.5">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {restores.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="p-1.5 tabular-nums">{new Date(r.started_at).toLocaleString("pt-BR")}</td>
                      <td className="p-1.5"><Badge variant="outline">{r.mode}</Badge></td>
                      <td className="p-1.5"><StatusBadge status={r.status} /></td>
                      <td className="p-1.5 text-right tabular-nums">{r.tables.length}</td>
                      <td className="p-1.5 truncate max-w-xs" title={r.reason}>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <BackupListDialog dialog={listDialog} onClose={() => setListDialog(null)} />
    </div>
  );
}

function BackupListDialog({
  dialog, onClose,
}: {
  dialog: null | {
    backupId: string;
    files: Array<{ table: string; path: string; filename: string; url: string | null; size_bytes: number }>;
    expiresIn: number;
  };
  onClose: () => void;
}) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number; phase: string }>({ done: 0, total: 0, phase: "" });

  const grouped = useMemo(() => {
    if (!dialog) return [] as Array<{ table: string; files: typeof dialog.files; totalBytes: number }>;
    const map = new Map<string, typeof dialog.files>();
    for (const f of dialog.files) {
      const arr = map.get(f.table) ?? [];
      arr.push(f);
      map.set(f.table, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([table, files]) => ({
        table,
        files: files.sort((x, y) => x.filename.localeCompare(y.filename)),
        totalBytes: files.reduce((s, f) => s + (f.size_bytes ?? 0), 0),
      }));
  }, [dialog]);

  const totalBytes = useMemo(() => grouped.reduce((s, g) => s + g.totalBytes, 0), [grouped]);

  const downloadOne = (url: string | null, filename: string) => {
    if (!url) { toast.error(`Sem URL para ${filename}`); return; }
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAll = async () => {
    if (!dialog) return;
    setDownloadingAll(true);
    try {
      for (const f of dialog.files) {
        downloadOne(f.url, f.filename || f.path.split("/").pop()!);
        await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(`${dialog.files.length} downloads iniciados`);
    } finally {
      setDownloadingAll(false);
    }
  };

  const downloadAsZip = async () => {
    if (!dialog) return;
    const files = dialog.files.filter((f) => !!f.url);
    if (files.length === 0) { toast.error("Nenhum arquivo com URL válida"); return; }

    setZipping(true);
    setZipProgress({ done: 0, total: files.length, phase: "Baixando arquivos..." });

    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const failed: string[] = [];
      const BATCH = 3;
      let done = 0;

      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        await Promise.all(batch.map(async (f) => {
          try {
            const res = await fetch(f.url!);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = new Uint8Array(await res.arrayBuffer());
            // path dentro do zip: <tabela>/<arquivo>
            const inner = `${f.table}/${f.filename || f.path.split("/").pop()!}`;
            zip.file(inner, buf);
          } catch (e) {
            failed.push(`${f.table}/${f.filename}: ${e instanceof Error ? e.message : String(e)}`);
          } finally {
            done += 1;
            setZipProgress({ done, total: files.length, phase: "Baixando arquivos..." });
          }
        }));
      }

      setZipProgress({ done: files.length, total: files.length, phase: "Compactando zip..." });
      const blob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
        (meta) => {
          setZipProgress({
            done: Math.round(meta.percent),
            total: 100,
            phase: `Compactando zip... ${Math.round(meta.percent)}%`,
          });
        },
      );

      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${dialog.backupId.slice(0, 8)}-${stamp}.zip`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      if (failed.length > 0) {
        toast.warning(`Zip gerado com ${failed.length} falha(s)`, {
          description: failed.slice(0, 3).join(" • ") + (failed.length > 3 ? ` • +${failed.length - 3}` : ""),
        });
      } else {
        toast.success(`Zip pronto: ${files.length} arquivos`);
      }
    } catch (e) {
      toast.error(`Falha ao gerar zip: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setZipping(false);
      setZipProgress({ done: 0, total: 0, phase: "" });
    }
  };


  return (
    <Dialog open={!!dialog} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Download por arquivo</DialogTitle>
          <DialogDescription>
            Backup grande demais para empacotamento em .zip. {dialog?.files.length ?? 0} arquivos
            ({fmtBytes(totalBytes)} no total) agrupados por tabela. Links expiram em{" "}
            {Math.round((dialog?.expiresIn ?? 600) / 60)} min.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 border rounded">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground sticky top-0 bg-background z-10">
              <tr className="border-b">
                <th className="text-left p-2">Tabela / Arquivo</th>
                <th className="text-right p-2">Tamanho</th>
                <th className="text-right p-2 w-16">Baixar</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <Fragment key={g.table}>
                  <tr className="bg-muted/40">
                    <td className="p-1.5 font-medium" colSpan={2}>
                      {g.table} <span className="text-muted-foreground font-normal">({g.files.length} arq.)</span>
                    </td>
                    <td className="p-1.5 text-right tabular-nums text-muted-foreground">{fmtBytes(g.totalBytes)}</td>
                  </tr>
                  {g.files.map((f) => (
                    <tr key={f.path} className="border-b border-border/50">
                      <td className="p-1.5 pl-6 font-mono text-[11px] truncate max-w-md" title={f.filename}>{f.filename}</td>
                      <td className="p-1.5 text-right tabular-nums">{fmtBytes(f.size_bytes)}</td>
                      <td className="p-1.5 text-right">
                        <Button size="sm" variant="ghost" className="h-6 px-2"
                          disabled={!f.url}
                          onClick={() => downloadOne(f.url, f.filename || f.path.split("/").pop()!)}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </ScrollArea>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2 items-stretch sm:items-center">
          {zipping && (
            <div className="flex-1 text-xs text-muted-foreground text-left">
              {zipProgress.phase} ({zipProgress.done}/{zipProgress.total})
            </div>
          )}
          <Button variant="outline" onClick={onClose} disabled={zipping}>Fechar</Button>
          <Button variant="outline" onClick={downloadAll} disabled={downloadingAll || zipping || !dialog?.files.length}>
            {downloadingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Baixar separadamente
          </Button>
          <Button onClick={downloadAsZip} disabled={zipping || downloadingAll || !dialog?.files.length}>
            {zipping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Baixar tudo em um único .zip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" :
    status === "running"   ? "bg-blue-500/15 text-blue-700 border-blue-500/40" :
    status === "failed"    ? "bg-rose-500/15 text-rose-700 border-rose-500/40" :
                             "bg-amber-500/15 text-amber-700 border-amber-500/40";
  return <Badge variant="outline" className={color}>{status}</Badge>;
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

// ─── Backup panel ──────────────────────────────────────────────────────
const MAX_CLIENT_RETRIES = 2; // additional retries on top of edge's own retries
const RETRY_PAUSE_MS = 2000;

type TableInfo = { name: string; pk: string[]; size_bytes: number };
type TablePlan = {
  name: string; count: number; pk: string[]; size_bytes: number;
  chunk_limit: number; use_keyset: boolean; pk_column: string | null;
};
type ResumeData = {
  backup_id: string;
  checkpoint: {
    table: string; pk_column: string | null; last_cursor: string | null;
    next_offset: number; next_seq: number; done_for_table: boolean;
  };
  completed_tables: Record<string, number>;
  object_paths: string[];
  size_bytes: number;
};

function isTransientMsg(msg: string): boolean {
  return /non-2xx|Unexpected token|<html|<\!DOCTYPE|5\d\d|timeout|gateway|fetch failed|network|aborted/i
    .test(msg);
}

function BackupPanel({ onDone }: { onDone: () => void }) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "partial" | "resume">("full");
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [lastFailed, setLastFailed] = useState<BackupRow | null>(null);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({
    table: "", done: 0, total: 0, pct: 0,
    attemptLabel: "", log: [] as string[],
  });

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.rpc as any)("get_public_tables_with_pk_and_size");
      const excluded = new Set(["system_maintenance_mode", "db_backups", "db_restore_audit"]);
      setTables((data ?? []).filter((t: any) => !excluded.has(t.name)));
    })();
    refreshLastFailed();
  }, []);

  const refreshLastFailed = async () => {
    const { data } = await supabase
      .from("db_backups")
      .select("*")
      .eq("status", "failed")
      .not("checkpoint", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    setLastFailed(((data ?? [])[0] as any) ?? null);
  };

  const totalSelectedBytes = useMemo(
    () => tables.filter((t) => selected.has(t.name)).reduce((s, t) => s + (t.size_bytes ?? 0), 0),
    [tables, selected],
  );

  const toggle = (n: string) => {
    const s = new Set(selected);
    s.has(n) ? s.delete(n) : s.add(n);
    setSelected(s);
  };

  const openConfirm = (m: "full" | "partial" | "resume") => {
    if (m === "partial" && selected.size === 0) {
      toast.error("Selecione pelo menos uma tabela");
      return;
    }
    if (m === "resume" && !lastFailed) {
      toast.error("Nenhum backup falho com checkpoint para retomar");
      return;
    }
    setMode(m);
    setConfirmOpen(true);
  };

  // Per-chunk client-side retry on top of edge retries
  const invokeChunkWithRetry = async (
    payload: Record<string, unknown>,
    tableName: string,
    onAttempt: (n: number) => void,
  ): Promise<any> => {
    let lastErr: any = null;
    for (let attempt = 1; attempt <= MAX_CLIENT_RETRIES + 1; attempt++) {
      onAttempt(attempt);
      try {
        return await invoke("db-backup", payload);
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt > MAX_CLIENT_RETRIES || !isTransientMsg(msg)) throw e;
        console.warn(`[backup] cliente retry ${attempt}/${MAX_CLIENT_RETRIES + 1} em ${tableName}: ${msg}`);
        setProgress((p) => ({
          ...p,
          log: [...p.log, `  ↻ retry cliente ${attempt}/${MAX_CLIENT_RETRIES + 1}: ${msg.slice(0, 80)}`],
        }));
        await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
      }
    }
    throw lastErr;
  };

  const runBackup = async () => {
    if (!password) { toast.error("Informe a senha"); return; }
    setConfirmOpen(false);
    setRunning(true);
    setProgress({ table: "", done: 0, total: 0, pct: 0, attemptLabel: "", log: [] });

    let backupId: string | null = null;
    let opError: string | null = null;
    let rowCounts: Record<string, number> = {};
    let objectPaths: string[] = [];
    let sizeBytes = 0;
    let tablesPlan: TablePlan[] = [];
    let resume: ResumeData | null = null;

    try {
      if (mode === "resume") {
        const res = await invoke("db-backup", {
          action: "resume", backup_id: lastFailed!.id, password,
        });
        backupId = res.backup_id;
        tablesPlan = res.tables;
        resume = {
          backup_id: res.backup_id,
          checkpoint: res.checkpoint,
          completed_tables: res.completed_tables ?? {},
          object_paths: res.object_paths ?? [],
          size_bytes: res.size_bytes ?? 0,
        };
        rowCounts = { ...resume.completed_tables };
        objectPaths = [...resume.object_paths];
        sizeBytes = resume.size_bytes;
        setProgress((p) => ({
          ...p,
          log: [
            ...p.log,
            `↻ RETOMANDO backup ${backupId} a partir de ${resume!.checkpoint.table} cursor=${resume!.checkpoint.last_cursor ?? "0"} seq=${resume!.checkpoint.next_seq}`,
          ],
        }));
      } else {
        const tablesArr = mode === "full" ? [] : Array.from(selected);
        const startRes = await invoke("db-backup", {
          action: "start", kind: mode, tables: tablesArr, reason, password,
        });
        backupId = startRes.backup_id as string;
        tablesPlan = startRes.tables;
      }

      const totalRows = tablesPlan.reduce((s, t) => s + t.count, 0);
      let doneRows = Object.values(rowCounts).reduce((s, n) => s + (n ?? 0), 0);

      // Determine starting table index when resuming
      let startTableIdx = 0;
      if (resume) {
        startTableIdx = tablesPlan.findIndex((t) => t.name === resume!.checkpoint.table);
        if (startTableIdx < 0) startTableIdx = 0;
      }

      for (let ti = startTableIdx; ti < tablesPlan.length; ti++) {
        const t = tablesPlan[ti];
        setProgress((p) => ({
          ...p,
          table: t.name,
          log: [
            ...p.log,
            `→ ${t.name} (${t.count} linhas, ${fmtBytes(t.size_bytes)}, chunk=${t.chunk_limit}${t.use_keyset ? `, keyset:${t.pk_column}` : ", offset"})`,
          ],
        }));
        if (t.count === 0) { rowCounts[t.name] = 0; continue; }

        let cursor: string | null = null;
        let offset = 0;
        let seq = 0;

        // If resuming on this table, jump to checkpoint
        if (resume && resume.checkpoint.table === t.name && !resume.checkpoint.done_for_table) {
          cursor = resume.checkpoint.last_cursor;
          offset = resume.checkpoint.next_offset;
          seq = resume.checkpoint.next_seq;
          setProgress((p) => ({
            ...p,
            log: [...p.log, `  ↻ checkpoint: cursor=${cursor ?? "0"} offset=${offset} seq=${seq}`],
          }));
        } else if (resume && (rowCounts[t.name] ?? 0) >= t.count && t.count > 0) {
          // Table already fully done in previous run
          setProgress((p) => ({ ...p, log: [...p.log, `  ✓ já concluída (${rowCounts[t.name]} linhas)`] }));
          continue;
        }
        resume = null; // only apply checkpoint to first relevant table

        while (true) {
          const res = await invokeChunkWithRetry(
            {
              action: "chunk",
              backup_id: backupId,
              table: t.name,
              limit: t.chunk_limit,
              pk_column: t.use_keyset ? t.pk_column : undefined,
              cursor: t.use_keyset ? cursor : undefined,
              offset: t.use_keyset ? undefined : offset,
              seq,
            },
            t.name,
            (n) => setProgress((p) => ({
              ...p,
              attemptLabel: n > 1 ? `tentativa ${n}/${MAX_CLIENT_RETRIES + 1}` : "",
            })),
          );
          setProgress((p) => ({ ...p, attemptLabel: "" }));
          if (res.object_path) objectPaths.push(res.object_path);
          sizeBytes += res.bytes ?? 0;
          const written = res.rows_written ?? 0;
          doneRows += written;
          rowCounts[t.name] = (rowCounts[t.name] ?? 0) + written;
          if (t.use_keyset) {
            cursor = res.next_cursor ?? null;
          } else {
            offset = res.next_offset ?? (offset + written);
          }
          seq++;
          const pct = totalRows ? Math.round((doneRows / totalRows) * 100) : 100;
          setProgress((p) => ({ ...p, done: doneRows, total: totalRows, pct }));
          if (res.done) break;
        }
      }

      await invoke("db-backup", {
        action: "finalize", backup_id: backupId, success: true,
        row_counts: rowCounts, size_bytes: sizeBytes, object_paths: objectPaths, error: null,
      });
      toast.success(`Backup concluído (${Object.keys(rowCounts).length} tabelas, ${fmtBytes(sizeBytes)})`);
      onDone();
    } catch (e) {
      opError = e instanceof Error ? e.message : String(e);
      if (backupId) {
        try {
          await invoke("db-backup", {
            action: "finalize", backup_id: backupId, success: false,
            row_counts: rowCounts, size_bytes: sizeBytes, object_paths: objectPaths, error: opError,
          });
        } catch (finErr) {
          console.error("[backup] finalize(failed) também falhou:", finErr);
        }
      }
      toast.error(opError);
      await refreshLastFailed();
    } finally {
      setRunning(false);
      setPassword(""); setReason("");
      setResumeData(null);
    }
  };

  return (
    <div className="space-y-4">
      {lastFailed && !running && (
        <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-start gap-2">
              <RefreshCw className="h-4 w-4 mt-0.5 text-amber-600" />
              <div className="flex-1 text-xs">
                <p className="font-semibold">Backup falho com checkpoint disponível</p>
                <p className="text-muted-foreground">
                  {new Date(lastFailed.created_at).toLocaleString("pt-BR")} · {lastFailed.tables.length} tabelas ·
                  {" "}{fmtBytes(lastFailed.size_bytes)} já gravados · erro: {lastFailed.error?.slice(0, 100) ?? "—"}
                </p>
              </div>
              <Button size="sm" variant="default" onClick={() => openConfirm("resume")}>
                Retomar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4" /> Backup completo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Faz backup de <strong>todas as {tables.length} tabelas</strong> do esquema público (inclui <code>audit_logs</code>).
            Processa em lotes adaptativos ({CHUNK_DEFAULT} linhas por padrão, 200 para tabelas {'>'} 100 MB), com
            retry automático (3 tentativas na edge + 2 no cliente) e checkpoint a cada chunk.
          </p>
          <Button onClick={() => openConfirm("full")} disabled={running}>
            <Download className="h-4 w-4 mr-2" /> Iniciar backup completo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" /> Backup parcial — selecionar tabelas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(tables.map((t) => t.name)))} disabled={running}>
              Marcar todas
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={running}>
              Limpar
            </Button>
            <span className="text-muted-foreground">·</span>
            <Button size="sm" variant="ghost" onClick={() => {
              const big = tables.filter((t) => (t.size_bytes ?? 0) < LARGE_BYTES).map((t) => t.name);
              setSelected(new Set(big));
            }} disabled={running}>
              Só tabelas pequenas (&lt; 100 MB)
            </Button>
          </div>
          <ScrollArea className="h-72 border rounded p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {tables.map((t) => (
                <label key={t.name} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1">
                  <Checkbox checked={selected.has(t.name)} onCheckedChange={() => toggle(t.name)} disabled={running} />
                  <span className="font-mono truncate flex-1">{t.name}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">{fmtBytes(t.size_bytes)}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              <strong>{selected.size}</strong> tabela(s) selecionada(s)
              {selected.size > 0 && <> · ~{fmtBytes(totalSelectedBytes)} estimado</>}
            </span>
            <Button size="sm" variant="secondary" onClick={() => openConfirm("partial")} disabled={running || selected.size === 0}>
              Backup das tabelas selecionadas
            </Button>
          </div>
        </CardContent>
      </Card>

      {running && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span>
                Processando: <strong>{progress.table}</strong>
                {progress.attemptLabel && (
                  <Badge variant="outline" className="ml-2 bg-amber-500/15 text-amber-700 border-amber-500/40">
                    {progress.attemptLabel}
                  </Badge>
                )}
              </span>
              <span className="tabular-nums">{progress.done}/{progress.total} linhas ({progress.pct}%)</span>
            </div>
            <Progress value={progress.pct} />
            <ScrollArea className="h-32 mt-2">
              <pre className="text-[10px] text-muted-foreground">{progress.log.join("\n")}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={
          mode === "resume"
            ? "Confirmar retomada de backup"
            : `Confirmar backup ${mode === "full" ? "completo" : "parcial"}`
        }
        warning={
          mode === "resume"
            ? "Continua do checkpoint salvo, sem refazer os chunks já gravados no Storage."
            : "Esta operação lê todos os dados das tabelas selecionadas e grava em arquivos JSONL no Storage privado."
        }
        password={password} setPassword={setPassword}
        reason={reason} setReason={setReason}
        onConfirm={runBackup}
        busy={running}
      />
    </div>
  );
}

const LARGE_BYTES = 100 * 1024 * 1024;

// ─── Restore panel ─────────────────────────────────────────────────────
function RestorePanel({ onDone }: { onDone: () => void }) {
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string>("");
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ table: "", done: 0, total: 0, pct: 0, log: [] as string[] });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("db_backups")
        .select("*")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(20);
      setBackups((data ?? []) as any);
    })();
  }, []);

  const backup = useMemo(() => backups.find((b) => b.id === selectedBackup), [backups, selectedBackup]);

  const openConfirm = () => {
    if (!backup) { toast.error("Selecione um backup"); return; }
    if (mode === "partial" && selectedTables.size === 0) { toast.error("Selecione tabelas"); return; }
    setConfirmOpen(true);
  };

  const runRestore = async () => {
    if (!password) { toast.error("Informe a senha"); return; }
    if (!backup) return;
    setConfirmOpen(false);
    setRunning(true);
    setProgress({ table: "", done: 0, total: 0, pct: 0, log: ["Ativando modo manutenção…"] });

    let restoreId: string | null = null;
    let opError: string | null = null;
    const rowsAfter: Record<string, number> = {};

    try {
      const tablesArr = mode === "full" ? [] : Array.from(selectedTables);
      const startRes = await invoke("db-restore", {
        action: "start", backup_id: backup.id, mode, tables: tablesArr, reason, password,
      });
      restoreId = startRes.restore_id;
      const ordered: { name: string; pk: string[]; parts: string[]; rows_before: number }[] = startRes.ordered_tables;
      const totalParts = ordered.reduce((s, t) => s + t.parts.length, 0);
      let donePartsAcc = 0;

      for (const t of ordered) {
        setProgress((p) => ({ ...p, table: t.name, log: [...p.log, `→ ${t.name} (${t.parts.length} partes)`] }));
        let rowsForTable = 0;
        for (const part of t.parts) {
          const res = await invoke("db-restore", {
            action: "chunk", restore_id: restoreId, table: t.name, object_path: part,
          });
          rowsForTable += res.rows_processed ?? 0;
          if (res.errors > 0) {
            setProgress((p) => ({ ...p, log: [...p.log, `  ! ${res.errors} erros: ${(res.error_samples ?? []).join(" | ")}`] }));
          }
          donePartsAcc++;
          const pct = totalParts ? Math.round((donePartsAcc / totalParts) * 100) : 100;
          setProgress((p) => ({ ...p, done: donePartsAcc, total: totalParts, pct }));
        }
        rowsAfter[t.name] = rowsForTable;
      }
    } catch (e) {
      opError = e instanceof Error ? e.message : String(e);
      toast.error(opError);
    } finally {
      if (restoreId) {
        try {
          await invoke("db-restore", {
            action: "finalize", restore_id: restoreId, success: !opError,
            row_counts_after: rowsAfter, error: opError,
          });
        } catch (e) {
          toast.error("Falha ao finalizar — modo manutenção pode ter ficado ativo. Verifique.");
        }
      }
      setRunning(false);
      setPassword(""); setReason("");
      if (!opError) {
        toast.success(`Restore concluído (${Object.keys(rowsAfter).length} tabelas)`);
        onDone();
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20">
        <CardContent className="pt-4 text-xs text-rose-900 dark:text-rose-200 flex gap-2 items-start">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Atenção — operação crítica.</p>
            <p>Restore ativa o <strong>Modo Manutenção</strong>: usuários comuns ficam temporariamente impedidos de escrever no sistema. Usa UPSERT por PK (linhas criadas depois do backup permanecem; linhas existentes são sobrescritas).</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Selecionar backup</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {backups.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum backup completo disponível.</p>
          ) : (
            <ScrollArea className="h-56 border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr><th className="p-2 text-left">Selecionar</th><th className="p-2 text-left">Data</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-right">Tabelas</th><th className="p-2 text-right">Tamanho</th></tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.id} className={`border-b ${selectedBackup === b.id ? "bg-blue-500/10" : ""}`}>
                      <td className="p-2"><Checkbox checked={selectedBackup === b.id} onCheckedChange={() => setSelectedBackup(b.id)} disabled={running} /></td>
                      <td className="p-2 tabular-nums">{new Date(b.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2"><Badge variant="outline">{b.kind}</Badge></td>
                      <td className="p-2 text-right tabular-nums">{b.tables.length}</td>
                      <td className="p-2 text-right tabular-nums">{fmtBytes(b.size_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {backup && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Modo de restore</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === "full"} onChange={() => setMode("full")} disabled={running} />
                Completo (todas as {backup.tables.length} tabelas do backup)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === "partial"} onChange={() => setMode("partial")} disabled={running} />
                Parcial
              </label>
            </div>
            {mode === "partial" && (
              <ScrollArea className="h-56 border rounded p-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {backup.tables.map((t) => (
                    <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Checkbox
                        checked={selectedTables.has(t)}
                        onCheckedChange={() => {
                          const s = new Set(selectedTables);
                          s.has(t) ? s.delete(t) : s.add(t);
                          setSelectedTables(s);
                        }}
                        disabled={running}
                      />
                      <span className="font-mono truncate">{t}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
            <Button variant="destructive" onClick={openConfirm} disabled={running}>
              <Upload className="h-4 w-4 mr-2" /> Iniciar restore
            </Button>
          </CardContent>
        </Card>
      )}

      {running && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span>Restaurando: <strong>{progress.table}</strong></span>
              <span className="tabular-nums">{progress.done}/{progress.total} partes ({progress.pct}%)</span>
            </div>
            <Progress value={progress.pct} />
            <ScrollArea className="h-40 mt-2">
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">{progress.log.join("\n")}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Confirmar RESTORE ${mode === "full" ? "completo" : "parcial"}`}
        warning="⚠ O sistema entrará em MODO MANUTENÇÃO durante toda a operação. Escritas de usuários comuns serão BLOQUEADAS até a conclusão (sucesso ou falha)."
        password={password} setPassword={setPassword}
        reason={reason} setReason={setReason}
        onConfirm={runRestore}
        busy={running}
        destructive
      />
    </div>
  );
}

// ─── Confirm dialog ────────────────────────────────────────────────────
function ConfirmDialog({
  open, onClose, title, warning, password, setPassword, reason, setReason, onConfirm, busy, destructive,
}: {
  open: boolean; onClose: () => void; title: string; warning: string;
  password: string; setPassword: (s: string) => void;
  reason: string; setReason: (s: string) => void;
  onConfirm: () => void; busy: boolean; destructive?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className={`h-5 w-5 ${destructive ? "text-rose-500" : "text-amber-500"}`} />
            {title}
          </DialogTitle>
          <DialogDescription className="text-foreground">{warning}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">Sua senha atual</Label>
            <Input id="confirm-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={busy} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-reason">Motivo (opcional)</Label>
            <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} disabled={busy} placeholder="Descreva o motivo desta operação (opcional, mas recomendado para auditoria)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={busy || !password}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── helper ────────────────────────────────────────────────────────────
async function invoke(fn: "db-backup" | "db-restore", body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // Try to extract real error from the response body (FunctionsHttpError swallows it)
    let detail = error.message;
    const ctx: any = (error as any).context;
    if (ctx && typeof ctx.text === "function") {
      try {
        const txt = await ctx.text();
        try {
          const parsed = JSON.parse(txt);
          if (parsed?.error) detail = `${error.message}: ${parsed.error}`;
        } catch {
          if (txt && txt.length < 500) detail = `${error.message}: ${txt}`;
        }
      } catch { /* ignore */ }
    }
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
