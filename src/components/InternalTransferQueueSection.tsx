import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowRightLeft, BedDouble, ChevronDown, ChevronUp, AlertTriangle, Clock, X, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useInternalTransferQueue, type InternalTransferRequestRow } from "@/hooks/useInternalTransferQueue";
import { usePatients } from "@/hooks/usePatients";
import { completeInternalTransfer, cancelInternalTransferRequest } from "@/lib/internalTransfer";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";
import { classificationLabel } from "@/lib/sectorComplexity";

interface Props {
  sectorCode: string;
}

export function InternalTransferQueueSection({ sectorCode }: Props) {
  const { toast } = useToast();
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { rows, refresh } = useInternalTransferQueue(sectorCode);
  const { patients } = usePatients();
  const [target, setTarget] = useState<InternalTransferRequestRow | null>(null);
  const [bedId, setBedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(true);

  const availableBeds = useMemo(
    () => (patients ?? [])
      .filter((p) => p.sector === target?.target_sector_code && (!p.name || p.name.trim() === ""))
      .sort((a, b) => (parseInt(a.bedNumber) || 0) - (parseInt(b.bedNumber) || 0)),
    [patients, target?.target_sector_code],
  );

  const handleAllocate = async () => {
    if (!target || !bedId) return;
    const bed = (patients ?? []).find((p) => p.id === bedId);
    if (!bed) return;
    if (!currentHospital || !currentState) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await completeInternalTransfer({
        requestId: target.id,
        targetBedRow: bed,
        currentUserId: user?.id ?? null,
        hospitalUnitId: currentHospital.id,
        stateId: currentState.id,
        department: currentDepartment ?? null,
      });
      if (!res.ok) throw new Error(res.error);
      toast({
        title: target.requires_saps ? "Paciente pré-admitido (SAPS pendente)" : "Paciente alocado",
        description: `Leito ${bed.bedNumber} • ${sectorLabelFromCode(bed.sector)}.`,
      });
      setTarget(null);
      setBedId("");
      refresh();
    } catch (err: any) {
      toast({ title: "Erro ao alocar", description: err?.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (row: InternalTransferRequestRow) => {
    const reason = window.prompt("Motivo do cancelamento da transferência interna sinalizada:");
    if (!reason || reason.trim().length < 5) return;
    const { data: { user } } = await supabase.auth.getUser();
    const res = await cancelInternalTransferRequest(row.id, reason.trim(), user?.id ?? null);
    if (!res.ok) {
      toast({ title: "Erro", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Sinalização cancelada", description: "O paciente foi removido da fila virtual. Realoque manualmente se necessário." });
    refresh();
  };

  if (rows.length === 0) return null;

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="print:hidden">
        <Card className="border-sky-300 dark:border-sky-700 bg-sky-50/50 dark:bg-sky-950/20">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                <span className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                  AGUARDANDO ALOCAÇÃO POR TRANSFERÊNCIA INTERNA
                </span>
                <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
              </div>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded-md border bg-background p-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium text-sm">{r.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Origem: {sectorLabelFromCode(r.source_sector ?? "")} • Leito {r.source_bed ?? "—"}
                      {r.encounter_code && <> • Atend. {r.encounter_code}</>}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{classificationLabel(r.classification)}</Badge>
                      {r.requires_saps && (
                        <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500/90"><AlertTriangle className="h-3 w-3 mr-0.5" />SAPS após alocação</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]"><Clock className="h-3 w-3 mr-0.5" />{new Date(r.signaled_at).toLocaleString("pt-BR")}</Badge>
                    </div>
                    {r.reason && <p className="text-[11px] text-muted-foreground mt-1 italic">"{r.reason}"</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => { setTarget(r); setBedId(""); }}>
                      <BedDouble className="h-3.5 w-3.5 mr-1" />
                      {r.requires_saps ? "Pré-admitir" : "Alocação direta"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(r)} title="Cancelar sinalização">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={!!target} onOpenChange={(v) => !submitting && !v && setTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              {target?.requires_saps ? "Pré-admitir no leito" : "Alocação direta no leito"}
            </DialogTitle>
            <DialogDescription>
              {target?.requires_saps
                ? "Escalada para setor crítico — após alocar o leito, o paciente entrará com status SAPS pendente e o timer de cobrança será iniciado."
                : "Alocação direta — o paciente vai para o leito escolhido mantendo o mesmo nº de atendimento e prontuário. Sem nova admissão / sem SAPS."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md bg-muted p-3 text-xs">
              <p className="font-medium text-sm">{target?.patient_name}</p>
              <p className="text-muted-foreground">
                De: {sectorLabelFromCode(target?.source_sector ?? "")} • Leito {target?.source_bed ?? "—"}
              </p>
              <p className="text-muted-foreground">Para: {target?.target_sector_label}</p>
            </div>
            <div className="space-y-2">
              <Label>Leito disponível *</Label>
              {availableBeds.length === 0 ? (
                <p className="text-xs text-destructive">Nenhum leito vago neste setor.</p>
              ) : (
                <Select value={bedId} onValueChange={setBedId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o leito" /></SelectTrigger>
                  <SelectContent>
                    {availableBeds.map((b) => (
                      <SelectItem key={b.id} value={b.id}>Leito {b.bedNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleAllocate} disabled={submitting || !bedId}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {submitting ? "Alocando..." : "Confirmar alocação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
