import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Archive, ShieldAlert, BedDouble } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ResidualBed = {
  sector: string;
  bed: string;
  currentPatientId: string | null;
  currentPatientName: string | null;
  contaminatedCount: number;
  originPatients: { name: string; patient_id: string | null; count: number }[];
  evolutionIds: string[];
};

type PreviewRow = {
  id: string; patient_name: string; patient_bed: string;
  patient_sector: string; created_at: string;
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
const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR");

export function ResidualHistoryTab() {
  const [beds, setBeds] = useState<ResidualBed[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{ bed: ResidualBed; rows: PreviewRow[] } | null>(null);
  const [executing, setExecuting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await callOps("list_bed_residual_history");
      setBeds(r.beds ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return beds;
    const q = nfd(query);
    return beds.filter((b) =>
      nfd(b.bed).includes(q) ||
      nfd(b.sector).includes(q) ||
      nfd(b.currentPatientName ?? "").includes(q) ||
      b.originPatients.some((o) => nfd(o.name).includes(q))
    );
  }, [beds, query]);

  const openPreview = async (bed: ResidualBed) => {
    try {
      const r = await callOps("archive_bed_residual_history", {
        evolutionIds: bed.evolutionIds,
        dryRun: true,
      });
      setPreview({ bed, rows: r.results ?? [] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na prévia");
    }
  };

  const execute = async () => {
    if (!preview) return;
    setExecuting(true);
    try {
      const r = await callOps("archive_bed_residual_history", {
        evolutionIds: preview.bed.evolutionIds,
        dryRun: false,
        reason: "dev_console_residual_cleanup",
      }, true);
      toast.success(
        `Arquivadas ${r.totals.evolutionsArchived} evolução(ões) residual(is) do leito ${preview.bed.bed}.`,
      );
      setPreview(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao executar");
    } finally { setExecuting(false); }
  };

  const totalEvos = beds.reduce((s, b) => s + b.contaminatedCount, 0);

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
            Detecta <strong>evoluções clínicas</strong> cujo <code className="font-mono">(setor, leito)</code> corresponde
            a um leito <strong>atualmente ocupado por outro paciente</strong> (ou com <code className="font-mono">patient_id</code> nulo).
            São rastros de pacientes anteriores que vazam no cockpit do novo ocupante.
          </p>
          <p>
            A limpeza <strong>arquiva</strong> as evoluções (<code className="font-mono">archived_at</code>, <code className="font-mono">archived_from_patient_id</code>,{" "}
            <code className="font-mono">archive_reason='dev_console_residual_cleanup'</code>). <strong>Nunca apaga</strong> dado clínico — o prontuário do paciente
            original continua acessível pelo histórico longitudinal.
          </p>
          <p>
            <strong>Não toca</strong>: prescrições, requisições, admissões, leito, paciente atual, status. Toda execução é registrada em <code className="font-mono">audit_logs</code> (action <code className="font-mono">DEV_ARCHIVE_RESIDUAL_HISTORY</code>).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <CardTitle className="text-sm whitespace-nowrap">Leitos com evoluções residuais</CardTitle>
            <Badge variant="outline" className="text-xs">
              {filtered.length} leito(s) · {totalEvos} evolução(ões)
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por leito, setor ou paciente…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-64 text-xs"
            />
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="text-left p-2">Leito</th>
                  <th className="text-left">Setor</th>
                  <th className="text-left">Ocupante atual</th>
                  <th className="text-left">Pacientes residuais (origem)</th>
                  <th className="text-center">Evoluções</th>
                  <th className="text-right p-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                  </td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Nenhum leito com evolução residual. ✅
                  </td></tr>
                )}
                {filtered.map((b) => (
                  <tr key={`${b.sector}|${b.bed}`} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2 font-mono flex items-center gap-1.5">
                      <BedDouble className="h-3 w-3 text-muted-foreground" /> {b.bed}
                    </td>
                    <td className="uppercase text-muted-foreground">{b.sector}</td>
                    <td className="font-medium">{b.currentPatientName ?? "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {b.originPatients.map((o, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] font-normal">
                            {o.name} {o.patient_id ? "" : <span className="ml-1 text-amber-600">(NULL)</span>} · {o.count}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="text-center">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {b.contaminatedCount}
                      </Badge>
                    </td>
                    <td className="text-right p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => openPreview(b)}
                      >
                        <Archive className="h-3 w-3" /> Arquivar
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
              <Archive className="h-4 w-4" /> Arquivar evoluções residuais — leito {preview?.bed.bed}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground">
                  Ocupante atual: <strong>{preview?.bed.currentPatientName ?? "—"}</strong> ·{" "}
                  Setor: <strong className="uppercase">{preview?.bed.sector}</strong>
                </p>
                <p className="text-muted-foreground">
                  As evoluções abaixo serão <strong>arquivadas</strong> (não apagadas). Continuam acessíveis no histórico longitudinal do paciente original.
                </p>

                <div className="rounded-md border border-border bg-muted/30 p-2 max-h-[280px] overflow-auto">
                  <table className="w-full text-[11px]">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left p-1">Paciente origem</th>
                        <th className="text-left">Setor</th>
                        <th className="text-left">Leito</th>
                        <th className="text-left">Criada em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview?.rows.map((r) => (
                        <tr key={r.id} className="border-t border-border/40">
                          <td className="p-1">{r.patient_name}</td>
                          <td className="uppercase">{r.patient_sector}</td>
                          <td className="font-mono">{r.patient_bed}</td>
                          <td className="text-[10px]">{fmtDate(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-4 text-[11px] font-medium">
                  <span>Evoluções a arquivar: <strong>{preview?.rows.length ?? 0}</strong></span>
                  <span className="text-muted-foreground">Motivo: <code className="font-mono">dev_console_residual_cleanup</code></span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); execute(); }}
              disabled={executing}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Archive className="h-3.5 w-3.5 mr-1" />}
              Confirmar e arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
