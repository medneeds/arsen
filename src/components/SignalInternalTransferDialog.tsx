import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { supabase } from "@/integrations/supabase/client";
import { HOSPITAL_SECTOR_GROUPS, sectorLabelFromCode } from "@/lib/hospitalSectors";
import { classifyTransfer, requiresSaps, requiresNewAdmission, classificationLabel, classificationBadgeClass } from "@/lib/sectorComplexity";
import { signalInternalTransfer } from "@/lib/internalTransfer";
import type { Patient } from "@/types/patient";
import { AlertTriangle, ArrowRightLeft, BedDouble, Info } from "lucide-react";

interface Props {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

export function SignalInternalTransferDialog({ patient, open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const [targetSector, setTargetSector] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTargetSector("");
      setReason("");
    }
  }, [open]);

  const classification = useMemo(
    () => (patient && targetSector ? classifyTransfer(patient.sector, targetSector) : null),
    [patient, targetSector],
  );
  const needsSaps = classification ? requiresSaps(classification) : false;
  const needsNewAdmission = classification ? requiresNewAdmission(classification) : false;

  const handleConfirm = async () => {
    if (!patient || !targetSector) return;
    if (!currentHospital || !currentState) {
      toast({ title: "Contexto ausente", description: "Selecione hospital/estado.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await signalInternalTransfer({
        source: patient,
        targetSectorCode: targetSector,
        reason: reason.trim() || undefined,
        currentUserId: user?.id ?? null,
        hospitalUnitId: currentHospital.id,
        stateId: currentState.id,
        department: currentDepartment ?? null,
      });
      if (!res.ok) throw new Error(res.error);
      toast({
        title: "Sinalização enviada",
        description: `Paciente entrou na fila virtual de ${sectorLabelFromCode(targetSector)}. O leito de origem foi liberado.`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao sinalizar", description: err?.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!patient) return null;

  const alreadySignaled =
    patient.admissionStatus === "transferencia_interna_pendente"
    || patient.admissionStatus === "transferencia_externa_pendente";

  if (alreadySignaled) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <DialogTitle>Transferência já sinalizada</DialogTitle>
            </div>
            <DialogDescription>
              Este paciente já tem uma <strong>transferência sinalizada pelo Painel Clínico</strong>.
              Para concluir a desalocação física do leito, feche este aviso e use a opção{" "}
              <strong>"Desalocar leito (transf. sinalizada)"</strong> no menu do leito —
              ela reaproveita o destino já registrado e evita sinalização duplicada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-sky-600" />
            <DialogTitle>Sinalizar transferência interna</DialogTitle>
          </div>
          <DialogDescription>
            O paciente sai do leito atual e entra na <strong>fila virtual</strong> do setor destino, sem ocupar leito físico até a alocação.
            O <strong>mesmo número de atendimento</strong> e todo o histórico clínico são preservados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">{patient.name || "—"}</p>
            <p className="text-muted-foreground text-xs">
              Origem: {sectorLabelFromCode(patient.sector)} • Leito {patient.bedNumber || "—"}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Setor de destino *</Label>
            <Select value={targetSector} onValueChange={setTargetSector}>
              <SelectTrigger><SelectValue placeholder="Escolha o setor destino" /></SelectTrigger>
              <SelectContent>
                {HOSPITAL_SECTOR_GROUPS.map((g) => (
                  <SelectGroup key={g.title}>
                    <SelectLabel>{g.title}</SelectLabel>
                    {g.items.filter((i) => i.key !== patient.sector).map((i) => (
                      <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {classification && (
            <div className={`rounded-md border p-3 text-xs space-y-1 ${needsSaps ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-sky-300 bg-sky-50 dark:bg-sky-950/20"}`}>
              <div className="flex items-center gap-2">
                {needsSaps ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <Info className="h-4 w-4 text-sky-600" />}
                <span className="font-medium">{classificationLabel(classification)}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">{classification}</Badge>
              </div>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                <li>Leito atual será <strong>liberado imediatamente</strong> ao confirmar.</li>
                <li>Paciente aparecerá em <strong>"Aguardando alocação por transferência interna"</strong> no setor destino.</li>
                <li>Encounter e prontuário <strong>preservados</strong> até o desfecho final.</li>
                {needsSaps ? (
                  <li className="text-amber-700 dark:text-amber-400"><strong>Escalada crítica:</strong> após alocação no leito, exigirá <strong>SAPS 3</strong> (timer dispara automaticamente).</li>
                ) : (
                  <li>Alocação no destino será <strong>direta</strong> (sem nova admissão / sem SAPS).</li>
                )}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label>Motivo / observação (opcional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Ex.: necessidade de monitorização contínua / vaga em setor menos complexo..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={submitting || !targetSector}>
            {submitting ? "Sinalizando..." : "Confirmar sinalização"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
