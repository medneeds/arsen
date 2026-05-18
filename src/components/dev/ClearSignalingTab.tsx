import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw, Eraser, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SignalingRow = {
  id: string;
  name: string;
  bed_number: string | null;
  sector: string | null;
  admission_status: string | null;
  movementsCount: number;
  documentsCount: number;
  lastMovementType: string | null;
  lastSignalAt: string | null;
  updated_at: string | null;
};

type PreviewResult = {
  patientId: string; name: string; bed: string | null; sector: string | null;
  previousStatus: string | null;
  movementsToDelete: number; documentsToDelete: number;
  statusReset: boolean;
};

const callOps = async (action: string, params: Record<string, unknown> = {}, confirm = false) => {
  const { data, error } = await supabase.functions.invoke("dev-console-ops", {
    body: { action, params, confirm },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
};

const nfd = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "—";

export function ClearSignalingTab() {
  const [rows, setRows] = useState<SignalingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ results: PreviewResult[]; totals: { movementsDeleted: number; documentsDeleted: number; patientsAffected: number } } | null>(null);
  const [executing, setExecuting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await callOps("list_patients_with_signaling");
      setRows(r.patients ?? []);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = nfd(query);
    return rows.filter((r) =>
      nfd(r.name).includes(q) ||
      nfd(r.bed_number ?? "").includes(q) ||
      nfd(r.sector ?? "").includes(q)
    );
  }, [rows, query]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const openPreview = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const r = await callOps("clear_patient_signaling", { patientIds: ids, dryRun: true });
      setPreview({ results: r.results ?? [], totals: r.totals });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na prévia");
    }
  };

  const execute = async () => {
    if (!preview) return;
    setExecuting(true);
    try {
      const ids = preview.results.map((r) => r.patientId);
      const r = await callOps("clear_patient_signaling", { patientIds: ids, dryRun: false }, true);
      toast.success(
        `Limpeza concluída: ${r.totals.patientsAffected} paciente(s), ${r.totals.movementsDeleted} movimentação(ões), ${r.totals.documentsDeleted} documento(s) removido(s).`,
      );
      setPreview(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao executar");
    } finally { setExecuting(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4" /> Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-amber-900/80 dark:text-amber-100/80 space-y-1.5">
          <p>
            Esta ação remove <strong>somente</strong> as sinalizações de saída ainda pendentes:
            movimentações <code className="font-mono">ALTA</code> / <code className="font-mono">ÓBITO</code> / <code className="font-mono">TRANSFERÊNCIA</code> com <code className="font-mono">release_status='pending_release'</code> e documentos de alta/óbito.
          </p>
          <p>
            O <code className="font-mono">admission_status</code> volta para <code className="font-mono">admitido</code> apenas quando o status atual for de saída.
            Status <code className="font-mono">pre_admitido</code>, <code className="font-mono">admitido</code> ou qualquer outro são preservados.
          </p>
          <p>
            <strong>Não toca</strong>: leito, prontuário, evolução, prescrição, requisição, admissão, encounter, registry. Toda execução é registrada em <code className="font-mono">audit_logs</code> (action <code className="font-mono">DEV_CLEAR_SIGNALING</code>).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <CardTitle className="text-sm whitespace-nowrap">Pacientes com sinalização ativa</CardTitle>
            <Badge variant="outline" className="text-xs">{filtered.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por nome, leito ou setor…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-64 text-xs"
            />
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              disabled={selected.size === 0}
              onClick={() => openPreview(Array.from(selected))}
            >
              <Eraser className="h-3.5 w-3.5" /> Limpar selecionados ({selected.size})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="p-2 w-8">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left">Leito</th>
                  <th className="text-left">Setor</th>
                  <th className="text-left">Status</th>
                  <th className="text-center">Mov. pend.</th>
                  <th className="text-center">Docs</th>
                  <th className="text-left">Última sinalização</th>
                  <th className="text-right p-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                  </td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">
                    Nenhum paciente com sinalização ativa.
                  </td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2">
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggle(r.id)}
                      />
                    </td>
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="font-mono">{r.bed_number ?? "—"}</td>
                    <td className="text-muted-foreground">{r.sector ?? "—"}</td>
                    <td>
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {r.admission_status ?? "—"}
                      </Badge>
                    </td>
                    <td className="text-center">{r.movementsCount}</td>
                    <td className="text-center">{r.documentsCount}</td>
                    <td className="text-muted-foreground">
                      {r.lastMovementType ? <span className="font-mono text-[10px]">{r.lastMovementType}</span> : "—"}
                      <div className="text-[10px]">{fmtDate(r.lastSignalAt)}</div>
                    </td>
                    <td className="text-right p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => openPreview([r.id])}
                      >
                        <Eraser className="h-3 w-3" /> Limpar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eraser className="h-4 w-4" /> Confirmar limpeza de sinalizações
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground">
                  Esta ação remove <strong>somente</strong> sinalizações de saída pendentes.
                  Leito, prontuário, evolução, prescrição, requisição e admissão <strong>não são afetados</strong>.
                  Registrada em audit_logs.
                </p>

                <div className="rounded-md border border-border bg-muted/30 p-2 max-h-[280px] overflow-auto">
                  <table className="w-full text-[11px]">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left p-1">Paciente</th>
                        <th className="text-left">Leito</th>
                        <th className="text-center">Movs</th>
                        <th className="text-center">Docs</th>
                        <th className="text-left">Status → após</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview?.results.map((r) => (
                        <tr key={r.patientId} className="border-t border-border/40">
                          <td className="p-1">{r.name}</td>
                          <td className="font-mono">{r.bed ?? "—"}</td>
                          <td className="text-center">{r.movementsToDelete}</td>
                          <td className="text-center">{r.documentsToDelete}</td>
                          <td className="font-mono text-[10px]">
                            {r.previousStatus ?? "—"} {r.statusReset ? "→ admitido" : "(preservado)"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-4 text-[11px] font-medium">
                  <span>Pacientes: <strong>{preview?.totals.patientsAffected ?? 0}</strong></span>
                  <span>Movimentações: <strong>{preview?.totals.movementsDeleted ?? 0}</strong></span>
                  <span>Documentos: <strong>{preview?.totals.documentsDeleted ?? 0}</strong></span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); execute(); }}
              disabled={executing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Eraser className="h-3.5 w-3.5 mr-1" />}
              Confirmar e executar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
