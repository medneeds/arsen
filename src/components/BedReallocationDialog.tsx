import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRightLeft, BedDouble, Loader2, Shuffle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Patient } from "@/types/patient";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";
import { cn } from "@/lib/utils";

interface SiblingRow {
  id: string;
  name: string;
  bed_number: string;
  is_vacant: boolean | null;
  display_order: number | null;
}

interface BedReallocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  onSuccess?: () => void;
}

type VacantTarget =
  | { kind: "row"; bed_number: string; row: SiblingRow }
  | { kind: "slot"; bed_number: string };

export function BedReallocationDialog({ open, onOpenChange, patient, onSuccess }: BedReallocationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [siblings, setSiblings] = useState<SiblingRow[]>([]);
  const [tab, setTab] = useState<"realocar" | "permutar">("realocar");
  const [selectedTarget, setSelectedTarget] = useState<VacantTarget | null>(null);
  const [selectedSwap, setSelectedSwap] = useState<SiblingRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sectorConfig = SECTOR_BED_CONFIG[patient.sector as string];

  const allBeds = useMemo(() => {
    if (!sectorConfig) return [] as string[];
    const start = sectorConfig.startNumber ?? 1;
    const end = start + sectorConfig.maxRegularBeds - 1;
    const beds: string[] = [];
    for (let i = start; i <= end; i++) {
      beds.push(`${sectorConfig.prefix}${String(i).padStart(2, "0")}`);
    }
    return beds;
  }, [sectorConfig]);

  // Realocar = leitos vagos: linhas vagas (is_vacant OU name vazio) + slots fixos sem linha alguma
  const vacantTargets = useMemo<VacantTarget[]>(() => {
    const byBed = new Map(siblings.map((s) => [s.bed_number, s] as const));
    const results: VacantTarget[] = [];
    for (const bed of allBeds) {
      if (bed === patient.bedNumber) continue;
      const row = byBed.get(bed);
      if (!row) {
        results.push({ kind: "slot", bed_number: bed });
      } else if (row.is_vacant === true || !row.name?.trim()) {
        results.push({ kind: "row", bed_number: bed, row });
      }
    }
    // Inclui também leitos vagos fora do range fixo (ex.: extras) já existentes como linhas
    for (const s of siblings) {
      if (allBeds.includes(s.bed_number)) continue;
      if (s.is_vacant === true || !s.name?.trim()) {
        results.push({ kind: "row", bed_number: s.bed_number, row: s });
      }
    }
    return results.sort((a, b) => a.bed_number.localeCompare(b.bed_number));
  }, [allBeds, siblings, patient.bedNumber]);

  // Permutar = qualquer linha de paciente do setor (vaga ou ocupada), exceto a própria
  const swapCandidates = useMemo(
    () => [...siblings].sort((a, b) => a.bed_number.localeCompare(b.bed_number)),
    [siblings]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedTarget(null);
    setSelectedSwap(null);
    setTab("realocar");
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, bed_number, is_vacant, display_order")
        .eq("sector", patient.sector)
        .neq("id", patient.id);
      if (cancel) return;
      if (error) {
        toast.error("Falha ao carregar leitos do setor");
      } else {
        setSiblings((data ?? []).filter((p) => !!p.bed_number) as SiblingRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [open, patient.id, patient.sector]);

  // Move atômico: se a outra ponta tem linha, swap pelos bed_numbers; senão, simples update.
  const performMove = async (otherRow: SiblingRow | null, targetBed: string) => {
    setSubmitting(true);
    try {
      if (!otherRow) {
        const { error } = await supabase
          .from("patients")
          .update({ bed_number: targetBed, updated_at: new Date().toISOString() })
          .eq("id", patient.id);
        if (error) throw error;
      } else {
        const tempBed = `__SWAP_${Date.now()}`;
        // 1) tira o paciente atual do caminho
        let r = await supabase.from("patients").update({ bed_number: tempBed }).eq("id", patient.id);
        if (r.error) throw r.error;
        // 2) move o outro para o leito original
        r = await supabase
          .from("patients")
          .update({ bed_number: patient.bedNumber, updated_at: new Date().toISOString() })
          .eq("id", otherRow.id);
        if (r.error) {
          await supabase.from("patients").update({ bed_number: patient.bedNumber }).eq("id", patient.id);
          throw r.error;
        }
        // 3) coloca o paciente atual no leito alvo
        r = await supabase
          .from("patients")
          .update({ bed_number: targetBed, updated_at: new Date().toISOString() })
          .eq("id", patient.id);
        if (r.error) {
          await supabase.from("patients").update({ bed_number: otherRow.bed_number }).eq("id", otherRow.id);
          await supabase.from("patients").update({ bed_number: patient.bedNumber }).eq("id", patient.id);
          throw r.error;
        }
      }
      toast.success(
        otherRow && otherRow.name?.trim()
          ? `Permuta concluída: ${patient.bedNumber} ↔ ${targetBed} (com ${otherRow.name})`
          : `Paciente realocado para ${targetBed}`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao mover paciente: " + (e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = () => {
    if (tab === "realocar") {
      if (!selectedTarget) return;
      const otherRow = selectedTarget.kind === "row" ? selectedTarget.row : null;
      performMove(otherRow, selectedTarget.bed_number);
    } else {
      if (!selectedSwap) return;
      performMove(selectedSwap, selectedSwap.bed_number);
    }
  };

  const sectorLabel = sectorConfig?.label ?? patient.sector;
  const canConfirm = tab === "realocar" ? !!selectedTarget : !!selectedSwap;
  const confirmLabel = tab === "realocar"
    ? `Confirmar realocação${selectedTarget ? ` para ${selectedTarget.bed_number}` : ""}`
    : `Confirmar permuta${selectedSwap ? ` ${patient.bedNumber} ↔ ${selectedSwap.bed_number}` : ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 uppercase">
            <Shuffle className="h-5 w-5 text-primary" />
            Realocar / Permutar leito
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold">{patient.name}</span> · Leito atual{" "}
            <Badge variant="outline" className="font-mono">{patient.bedNumber}</Badge>{" "}
            · Setor <span className="font-medium">{sectorLabel}</span> (movimentação interna ao setor — leitos são fixos)
          </DialogDescription>
        </DialogHeader>

        {!sectorConfig && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" />
            Setor sem configuração de leitos disponível para realocação interna.
          </div>
        )}

        {sectorConfig && (
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "realocar" | "permutar"); setSelectedTarget(null); setSelectedSwap(null); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="realocar" className="gap-2">
                <BedDouble className="h-4 w-4" /> Realocar (leito vago)
              </TabsTrigger>
              <TabsTrigger value="permutar" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Permutar (vago ou ocupado)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="realocar" className="mt-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando leitos...
                </div>
              ) : vacantTargets.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum leito vago neste setor. Use a aba <strong>Permutar</strong> para trocar com outro paciente.
                </div>
              ) : (
                <ScrollArea className="h-[280px] pr-2">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {vacantTargets.map((t) => {
                      const isSel = selectedTarget?.bed_number === t.bed_number;
                      return (
                        <button
                          key={t.bed_number}
                          type="button"
                          onClick={() => setSelectedTarget(t)}
                          className={cn(
                            "rounded-lg border p-3 text-center font-mono text-sm transition-all",
                            "hover:border-primary hover:bg-primary/5",
                            isSel
                              ? "border-primary bg-primary/10 ring-2 ring-primary/40 font-semibold"
                              : "border-border bg-background"
                          )}
                        >
                          <BedDouble className="mx-auto mb-1 h-4 w-4 text-emerald-600" />
                          {t.bed_number}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="permutar" className="mt-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando leitos...
                </div>
              ) : swapCandidates.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Não há outros leitos neste setor para permuta.
                </div>
              ) : (
                <ScrollArea className="h-[280px] pr-2">
                  <div className="space-y-1.5">
                    {swapCandidates.map((s) => {
                      const occupied = !!s.name?.trim();
                      const isSel = selectedSwap?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSwap(s)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-all",
                            "hover:border-primary hover:bg-primary/5",
                            isSel
                              ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                              : "border-border bg-background"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Badge variant="outline" className="font-mono shrink-0">{s.bed_number}</Badge>
                            {occupied ? (
                              <span className="font-medium uppercase truncate">{s.name}</span>
                            ) : (
                              <span className="text-emerald-700 dark:text-emerald-400 text-xs uppercase font-semibold">Leito vago</span>
                            )}
                          </div>
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
