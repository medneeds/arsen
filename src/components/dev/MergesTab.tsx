import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, ChevronDown, ChevronRight, GitMerge } from "lucide-react";
import { toast } from "sonner";

interface MergeRow {
  id: string;
  source_registry_id: string;
  target_registry_id: string | null;
  action: string;
  source_snapshot: Record<string, unknown> | null;
  target_snapshot: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  performed_by: string | null;
  performed_by_email: string | null;
  created_at: string;
}

export function MergesTab() {
  const [rows, setRows] = useState<MergeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("patient_merge_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows((data ?? []) as MergeRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar mesclagens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = rows.filter((r) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    const snap = JSON.stringify(r.source_snapshot ?? {}).toLowerCase();
    return (
      (r.performed_by_email ?? "").toLowerCase().includes(f) ||
      r.action.toLowerCase().includes(f) ||
      r.source_registry_id.includes(f) ||
      (r.target_registry_id ?? "").includes(f) ||
      snap.includes(f)
    );
  });

  const snapField = (snap: Record<string, unknown> | null, key: string): string => {
    if (!snap) return "—";
    const v = snap[key];
    return v == null || v === "" ? "—" : String(v);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitMerge className="h-4 w-4" />
          <span>Histórico de mesclagens de prontuário. Snapshots arquivados (inclui CPF/CNS originais) ficam disponíveis aqui para sempre.</span>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Input
        placeholder="Filtrar por operador, ação, registry id ou conteúdo do snapshot..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-xl"
      />

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card z-10 border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="w-6"></th>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left">Ação</th>
                  <th className="text-left">Perdedor (arquivado)</th>
                  <th className="text-left">Vencedor</th>
                  <th className="text-left">Operador</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isOpen = expanded.has(r.id);
                  return (
                    <FragmentRow key={r.id} isOpen={isOpen}>
                      <tr
                        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                        onClick={() => toggle(r.id)}
                      >
                        <td className="px-2">
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td>
                          <Badge variant="secondary" className="text-[10px]">{r.action}</Badge>
                        </td>
                        <td className="font-mono truncate max-w-[260px]">
                          {snapField(r.source_snapshot, "full_name")}
                          <span className="text-muted-foreground"> · {r.source_registry_id.slice(0, 8)}</span>
                        </td>
                        <td className="font-mono truncate max-w-[200px]">
                          {r.target_registry_id ? r.target_registry_id.slice(0, 8) : "—"}
                        </td>
                        <td className="truncate max-w-[200px]">{r.performed_by_email ?? "—"}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border bg-muted/20">
                          <td></td>
                          <td colSpan={5} className="p-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                                  Motivo / payload
                                </div>
                                <pre className="text-[11px] bg-background border border-border rounded p-2 overflow-x-auto max-h-64">
{JSON.stringify(r.payload ?? {}, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                                  Snapshot do registro perdedor (arquivado)
                                </div>
                                <pre className="text-[11px] bg-background border border-border rounded p-2 overflow-x-auto max-h-64">
{JSON.stringify(r.source_snapshot ?? {}, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </FragmentRow>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Nenhuma mesclagem registrada.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center">
                      <Loader2 className="h-4 w-4 animate-spin inline" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
