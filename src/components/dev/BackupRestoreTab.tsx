import { useEffect, useMemo, useState } from "react";
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
    </div>
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
function BackupPanel({ onDone }: { onDone: () => void }) {
  const [tables, setTables] = useState<{ name: string; pk: string[] }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ table: "", done: 0, total: 0, pct: 0, log: [] as string[] });

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.rpc as any)("get_public_tables_with_pk");
      const excluded = new Set(["system_maintenance_mode", "db_backups", "db_restore_audit"]);
      setTables((data ?? []).filter((t: any) => !excluded.has(t.name)));
    })();
  }, []);

  const toggle = (n: string) => {
    const s = new Set(selected);
    s.has(n) ? s.delete(n) : s.add(n);
    setSelected(s);
  };

  const openConfirm = (m: "full" | "partial") => {
    if (m === "partial" && selected.size === 0) {
      toast.error("Selecione pelo menos uma tabela");
      return;
    }
    setMode(m);
    setConfirmOpen(true);
  };

  const runBackup = async () => {
    if (!password) { toast.error("Informe a senha"); return; }
    setConfirmOpen(false);
    setRunning(true);
    setProgress({ table: "", done: 0, total: 0, pct: 0, log: [] });

    let backupId: string | null = null;
    let opError: string | null = null;
    const rowCounts: Record<string, number> = {};
    const objectPaths: string[] = [];
    let sizeBytes = 0;

    try {
      const tablesArr = mode === "full" ? [] : Array.from(selected);
      const startRes = await invoke("db-backup", {
        action: "start", kind: mode, tables: tablesArr, reason, password,
      });
      backupId = startRes.backup_id as string;
      const tablesPlan: {
        name: string; count: number; pk: string[]; size_bytes: number;
        chunk_limit: number; use_keyset: boolean; pk_column: string | null;
      }[] = startRes.tables;

      const totalRows = tablesPlan.reduce((s, t) => s + t.count, 0);
      let doneRows = 0;

      for (const t of tablesPlan) {
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
        while (true) {
          const res = await invoke("db-backup", {
            action: "chunk",
            backup_id: backupId,
            table: t.name,
            limit: t.chunk_limit,
            pk_column: t.use_keyset ? t.pk_column : undefined,
            cursor: t.use_keyset ? cursor : undefined,
            offset: t.use_keyset ? undefined : offset,
            seq,
          });
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
      // Garante que o registro não fique 'running' eternamente
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
    } finally {
      setRunning(false);
      setPassword(""); setReason("");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4" /> Backup completo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Faz backup de <strong>todas as {tables.length} tabelas</strong> do esquema público (inclui <code>audit_logs</code>).
            Processa em lotes de {CHUNK} linhas e armazena no bucket privado <code>db-backups</code>.
          </p>
          <Button onClick={() => openConfirm("full")} disabled={running}>
            <Download className="h-4 w-4 mr-2" /> Iniciar backup completo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" /> Backup parcial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScrollArea className="h-72 border rounded p-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {tables.map((t) => (
                <label key={t.name} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1">
                  <Checkbox checked={selected.has(t.name)} onCheckedChange={() => toggle(t.name)} disabled={running} />
                  <span className="font-mono truncate">{t.name}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{selected.size} tabela(s) selecionada(s)</span>
            <Button size="sm" variant="secondary" onClick={() => openConfirm("partial")} disabled={running || selected.size === 0}>
              Backup parcial
            </Button>
          </div>
        </CardContent>
      </Card>

      {running && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span>Processando: <strong>{progress.table}</strong></span>
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
        title={`Confirmar backup ${mode === "full" ? "completo" : "parcial"}`}
        warning="Esta operação lê todos os dados das tabelas selecionadas e grava em arquivos JSONL no Storage privado."
        password={password} setPassword={setPassword}
        reason={reason} setReason={setReason}
        onConfirm={runBackup}
        busy={running}
      />
    </div>
  );
}

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
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}
