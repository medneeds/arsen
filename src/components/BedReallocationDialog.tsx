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

interface SiblingPatient {
  id: string;
  name: string;
  bed_number: string;
  display_order: number | null;
}

interface BedReallocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  onSuccess?: () => void;
}

export function BedReallocationDialog({ open, onOpenChange, patient, onSuccess }: BedReallocationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [siblings, setSiblings] = useState<SiblingPatient[]>([]);
  const [tab, setTab] = useState<"realocar" | "permutar">("realocar");
  const [selectedBed, setSelectedBed] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<SiblingPatient | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sectorConfig = SECTOR_BED_CONFIG[patient.sector as string];

  // Generate all valid bed numbers for the sector
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

  const occupiedBedNumbers = useMemo(
    () => new Set(siblings.map((s) => s.bed_number)),
    [siblings]
  );

  const availableBeds = useMemo(
    () => allBeds.filter((b) => !occupiedBedNumbers.has(b) && b !== patient.bedNumber),
    [allBeds, occupiedBedNumbers, patient.bedNumber]
  );

  // Load siblings when opening
  useEffect(() => {
    if (!open) return;
    setSelectedBed(null);
    setSelectedPatient(null);
    setTab("realocar");
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, bed_number, display_order")
        .eq("sector", patient.sector)
        .is("deleted_at", null)
        .neq("id", patient.id);
      if (cancel) return;
      if (error) {
        toast.error("Falha ao carregar leitos do setor");
      } else {
        setSiblings((data ?? []).filter((p) => !!p.bed_number) as SiblingPatient[]);
      }
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [open, patient.id, patient.sector]);

  const handleRealocar = async () => {
    if (!selectedBed) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("patients")
      .update({ bed_number: selectedBed, updated_at: new Date().toISOString() })
      .eq("id", patient.id);
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao realocar paciente: " + error.message);
      return;
    }
    toast.success(`Paciente realocado para ${selectedBed}`);
    onSuccess?.();
    onOpenChange(false);
  };

  const handlePermutar = async () => {
    if (!selectedPatient) return;
    setSubmitting(true);
    const tempBed = `__SWAP_${Date.now()}`;
    // 1) Park current patient in temp bed (avoid unique collision if any)
    const step1 = await supabase
      .from("patients")
      .update({ bed_number: tempBed })
      .eq("id", patient.id);
    if (step1.error) {
      setSubmitting(false);
      toast.error("Erro ao iniciar permuta: " + step1.error.message);
      return;
    }
    // 2) Move target patient to current's original bed
    const step2 = await supabase
      .from("patients")
      .update({ bed_number: patient.bedNumber, updated_at: new Date().toISOString() })
      .eq("id", selectedPatient.id);
    if (step2.error) {
      // rollback
      await supabase.from("patients").update({ bed_number: patient.bedNumber }).eq("id", patient.id);
      setSubmitting(false);
      toast.error("Erro na permuta: " + step2.error.message);
      return;
    }
    // 3) Move current patient to target's bed
    const step3 = await supabase
      .from("patients")
      .update({ bed_number: selectedPatient.bed_number, updated_at: new Date().toISOString() })
      .eq("id", patient.id);
    if (step3.error) {
      // rollback both
      await supabase.from("patients").update({ bed_number: selectedPatient.bed_number }).eq("id", selectedPatient.id);
      await supabase.from("patients").update({ bed_number: patient.bedNumber }).eq("id", patient.id);
      setSubmitting(false);
      toast.error("Erro na permuta: " + step3.error.message);
      return;
    }
    setSubmitting(false);
    toast.success(`Permuta concluída: ${patient.bedNumber} ↔ ${selectedPatient.bed_number}`);
    onSuccess?.();
    onOpenChange(false);
  };

  const sectorLabel = sectorConfig?.label ?? patient.sector;

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
            · Setor <span className="font-medium">{sectorLabel}</span> (movimentação interna ao setor)
          </DialogDescription>
        </DialogHeader>

        {!sectorConfig && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" />
            Setor sem configuração de leitos disponível para realocação interna.
          </div>
        )}

        {sectorConfig && (
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "realocar" | "permutar"); setSelectedBed(null); setSelectedPatient(null); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="realocar" className="gap-2">
                <BedDouble className="h-4 w-4" /> Realocar (leito vago)
              </TabsTrigger>
              <TabsTrigger value="permutar" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Permutar (com paciente)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="realocar" className="mt-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando leitos...
                </div>
              ) : availableBeds.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum leito vago neste setor. Use a aba <strong>Permutar</strong> para trocar com outro paciente.
                </div>
              ) : (
                <ScrollArea className="h-[280px] pr-2">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {availableBeds.map((bed) => (
                      <button
                        key={bed}
                        type="button"
                        onClick={() => setSelectedBed(bed)}
                        className={cn(
                          "rounded-lg border p-3 text-center font-mono text-sm transition-all",
                          "hover:border-primary hover:bg-primary/5",
                          selectedBed === bed
                            ? "border-primary bg-primary/10 ring-2 ring-primary/40 font-semibold"
                            : "border-border bg-background"
                        )}
                      >
                        <BedDouble className="mx-auto mb-1 h-4 w-4 text-emerald-600" />
                        {bed}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="permutar" className="mt-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando pacientes...
                </div>
              ) : siblings.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Não há outros pacientes neste setor para permuta.
                </div>
              ) : (
                <ScrollArea className="h-[280px] pr-2">
                  <div className="space-y-1.5">
                    {siblings.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedPatient(s)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-all",
                          "hover:border-primary hover:bg-primary/5",
                          selectedPatient?.id === s.id
                            ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                            : "border-border bg-background"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">{s.bed_number}</Badge>
                          <span className="font-medium uppercase">{s.name}</span>
                        </div>
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
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
          {tab === "realocar" ? (
            <Button onClick={handleRealocar} disabled={!selectedBed || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar realocação{selectedBed ? ` para ${selectedBed}` : ""}
            </Button>
          ) : (
            <Button onClick={handlePermutar} disabled={!selectedPatient || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar permuta{selectedPatient ? ` ${patient.bedNumber} ↔ ${selectedPatient.bed_number}` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
