import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowRight, Check, Minus, Pause, Plus, Play, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  computePrescriptionDiff,
  type DiffStatus,
  type PrescriptionDiffEntry,
} from "@/lib/prescriptionDiff";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface PrescriptionVersionMeta {
  id: string;
  version: number;
  status: string;
  created_at: string;
}

interface PrescriptionDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: PrescriptionVersionMeta[];
  /** Versão pré-selecionada como "B" (atual / mais recente) */
  defaultRightId?: string;
}

const STATUS_CONFIG: Record<DiffStatus, { label: string; className: string; icon: any }> = {
  added: {
    label: "Adicionado",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: Plus,
  },
  removed: {
    label: "Removido",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    icon: Minus,
  },
  changed: {
    label: "Alterado",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    icon: RefreshCw,
  },
  suspended: {
    label: "Suspenso",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
    icon: Pause,
  },
  reactivated: {
    label: "Reativado",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    icon: Play,
  },
  unchanged: {
    label: "Inalterado",
    className: "border-border bg-muted/40 text-muted-foreground",
    icon: Check,
  },
};

export function PrescriptionDiffDialog({
  open,
  onOpenChange,
  versions,
  defaultRightId,
}: PrescriptionDiffDialogProps) {
  // Sorted oldest → newest
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => a.version - b.version),
    [versions]
  );

  const initialRight = defaultRightId ?? sortedVersions[sortedVersions.length - 1]?.id;
  const initialLeft =
    sortedVersions.length >= 2
      ? sortedVersions[sortedVersions.length - 2].id
      : sortedVersions[0]?.id;

  const [leftId, setLeftId] = useState<string | undefined>(initialLeft);
  const [rightId, setRightId] = useState<string | undefined>(initialRight);
  const [leftItems, setLeftItems] = useState<any[]>([]);
  const [rightItems, setRightItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"changes" | "all">("changes");

  // Reset selections when reopened
  useEffect(() => {
    if (open) {
      setLeftId(initialLeft);
      setRightId(initialRight);
      setTab("changes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load items for both sides
  useEffect(() => {
    if (!open || !leftId || !rightId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: left, error: el }, { data: right, error: er }] = await Promise.all([
          supabase.from("prescriptions").select("items").eq("id", leftId).maybeSingle(),
          supabase.from("prescriptions").select("items").eq("id", rightId).maybeSingle(),
        ]);
        if (el || er) throw el || er;
        if (cancelled) return;
        setLeftItems(Array.isArray(left?.items) ? (left!.items as any[]) : []);
        setRightItems(Array.isArray(right?.items) ? (right!.items as any[]) : []);
      } catch (err: any) {
        toast.error("Erro ao carregar versões", { description: err?.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, leftId, rightId]);

  const { entries, summary } = useMemo(
    () => computePrescriptionDiff(leftItems, rightItems),
    [leftItems, rightItems]
  );

  const visibleEntries = useMemo(
    () => (tab === "changes" ? entries.filter((e) => e.status !== "unchanged") : entries),
    [entries, tab]
  );

  const leftMeta = sortedVersions.find((v) => v.id === leftId);
  const rightMeta = sortedVersions.find((v) => v.id === rightId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            Comparar versões da prescrição
          </DialogTitle>
          <DialogDescription>
            Selecione duas versões para visualizar as diferenças entre elas.
          </DialogDescription>
        </DialogHeader>

        {/* Version pickers */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Versão anterior (A)
            </label>
            <Select value={leftId} onValueChange={setLeftId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Escolha a versão" />
              </SelectTrigger>
              <SelectContent>
                {sortedVersions.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    v{v.version} —{" "}
                    {format(new Date(v.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    {v.status === "signed" && " ✓"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block mt-4" />
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Versão posterior (B)
            </label>
            <Select value={rightId} onValueChange={setRightId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Escolha a versão" />
              </SelectTrigger>
              <SelectContent>
                {sortedVersions.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    v{v.version} —{" "}
                    {format(new Date(v.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    {v.status === "signed" && " ✓"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          {(["added", "removed", "changed", "suspended", "reactivated", "unchanged"] as DiffStatus[]).map(
            (s) => {
              const count = summary[s];
              if (count === 0) return null;
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              return (
                <span
                  key={s}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
                    cfg.className
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {cfg.label}: {count}
                </span>
              );
            }
          )}
          {summary.total === 0 && !loading && (
            <span className="text-xs text-muted-foreground">Nenhum item nas duas versões.</span>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2 w-full max-w-xs">
            <TabsTrigger value="changes" className="text-xs">
              Apenas mudanças
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              Todos os itens
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="flex-1 min-h-0 mt-3">
            <ScrollArea className="h-[45vh] pr-3">
              {loading ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  Carregando versões…
                </div>
              ) : visibleEntries.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  {tab === "changes"
                    ? "Nenhuma diferença entre as versões selecionadas."
                    : "Sem itens para exibir."}
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleEntries.map((entry, i) => (
                    <DiffEntryRow key={i} entry={entry} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between gap-2">
          <div className="text-[10px] text-muted-foreground">
            {leftMeta && rightMeta && (
              <>
                Comparando <strong>v{leftMeta.version}</strong> →{" "}
                <strong>v{rightMeta.version}</strong>
              </>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffEntryRow({ entry }: { entry: PrescriptionDiffEntry }) {
  const cfg = STATUS_CONFIG[entry.status];
  const Icon = cfg.icon;
  return (
    <div className={cn("rounded-lg border p-2.5", cfg.className)}>
      <div className="flex items-start gap-2">
        <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground truncate">{entry.name}</span>
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">
              {entry.category}
            </Badge>
            <span className="text-[10px] font-medium opacity-80">{cfg.label}</span>
          </div>
          {entry.changes.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {entry.changes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground font-medium min-w-[80px]">{c.label}:</span>
                  <span className="line-through text-muted-foreground/70 truncate">{c.before}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground truncate">{c.after}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
