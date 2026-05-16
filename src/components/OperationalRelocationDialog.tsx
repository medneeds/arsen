import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Patient } from "@/types/patient";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useToast } from "@/hooks/use-toast";
import { executeOperationalRelocation } from "@/lib/bedLifecycle";
import { ArrowRightLeft, BedDouble, Loader2, Wrench, AlertTriangle } from "lucide-react";
import { MovementConfirmDialog } from "@/components/MovementConfirmDialog";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";

const REASONS = [
  { value: "reforma", label: "Reforma / obra no quarto" },
  { value: "manutencao", label: "Manutenção do leito ou equipamentos" },
  { value: "isolamento", label: "Mudança por isolamento / precaução" },
  { value: "conforto", label: "Conforto do paciente / acompanhante" },
  { value: "ajuste_censo", label: "Ajuste de censo / reorganização operacional" },
  { value: "outro", label: "Outro motivo operacional" },
];

interface VacantBed {
  id: string;
  bed_number: string;
  sector: string;
}

export interface OperationalRelocationDialogProps {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function OperationalRelocationDialog({
  patient,
  open,
  onOpenChange,
  onSuccess,
}: OperationalRelocationDialogProps) {
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { toast } = useToast();

  const [vacantBeds, setVacantBeds] = useState<VacantBed[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetSector, setTargetSector] = useState<string>("");
  const [targetBedId, setTargetBedId] = useState<string>("");
  const [reasonValue, setReasonValue] = useState<string>("reforma");
  const [reasonNote, setReasonNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetSector("");
    setTargetBedId("");
    setReasonValue("reforma");
    setReasonNote("");
    setConfirmOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !currentHospital || !patient) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, bed_number, sector, name")
        .eq("hospital_unit_id", currentHospital.id)
        .or("name.is.null,name.eq.")
        .neq("id", patient.id);
      if (cancelled) return;
      if (error) {
        console.error("[OperationalReloc] erro ao buscar leitos vagos", error);
      }
      const rows = (data ?? [])
        .filter((r: any) => !r.name || String(r.name).trim() === "")
        .map((r: any) => ({ id: r.id, bed_number: r.bed_number, sector: r.sector }));
      setVacantBeds(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, currentHospital, patient]);

  const sectors = useMemo(() => {
    const set = new Set(vacantBeds.map((b) => b.sector).filter(Boolean));
    return Array.from(set).sort();
  }, [vacantBeds]);

  const bedsForSector = useMemo(
    () => vacantBeds
      .filter((b) => b.sector === targetSector)
      .sort((a, b) => {
        const na = parseInt(a.bed_number) || 0;
        const nb = parseInt(b.bed_number) || 0;
        return na - nb;
      }),
    [vacantBeds, targetSector],
  );

  const targetBed = vacantBeds.find((b) => b.id === targetBedId);
  const reasonLabel = REASONS.find((r) => r.value === reasonValue)?.label ?? reasonValue;
  const fullReason = reasonNote.trim()
    ? `${reasonLabel} — ${reasonNote.trim()}`
    : reasonLabel;

  const needsNote = reasonValue === "outro" && reasonNote.trim().length < 5;

  const handleOpenConfirm = () => {
    if (!patient) return;
    if (!targetSector) {
      toast({ title: "Selecione o setor de destino", variant: "destructive" });
      return;
    }
    if (!targetBedId) {
      toast({ title: "Selecione o leito de destino", variant: "destructive" });
      return;
    }
    if (needsNote) {
      toast({
        title: "Detalhe o motivo",
        description: 'Ao selecionar "Outro motivo" descreva o que aconteceu (mínimo 5 caracteres).',
        variant: "destructive",
      });
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!patient || !targetBed || !currentHospital || !currentState) return;
    setSubmitting(true);
    try {
      const result = await executeOperationalRelocation({
        sourcePatientId: patient.id,
        targetPatientId: targetBed.id,
        reason: fullReason,
        hospitalUnitId: currentHospital.id,
        stateId: currentState.id,
        department: currentDepartment,
      });
      if (!result.ok) throw new Error(result.error);
      toast({
        title: "Remanejamento concluído",
        description: `${patient.name} movido para ${sectorLabelFromCode(targetBed.sector)} • Leito ${targetBed.bed_number}.`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[OperationalReloc] erro", err);
      toast({
        title: "Erro ao remanejar",
        description: err?.message ?? "Não foi possível concluir o remanejamento.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  if (!patient) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Remanejamento operacional</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Mudança de leito por motivo administrativo — sem decisão clínica.
                  O histórico do paciente é preservado integralmente.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Paciente */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Paciente
              </Label>
              <div className="p-3 bg-muted/60 rounded-lg">
                <p className="font-medium text-sm uppercase">{patient.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 uppercase">
                  {sectorLabelFromCode(patient.sector) || patient.sector} • Leito {patient.bedNumber}
                </p>
              </div>
            </div>

            {/* Setor destino */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Setor de destino *</Label>
              <Select value={targetSector} onValueChange={(v) => { setTargetSector(v); setTargetBedId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Carregando leitos vagos..." : "Selecione o setor"} />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>
                      <div className="flex items-center gap-2">
                        <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{sectorLabelFromCode(s) || s}</span>
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {vacantBeds.filter((b) => b.sector === s).length} vago(s)
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                  {!loading && sectors.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Nenhum leito vago nesta unidade.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Leito destino */}
            {targetSector && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider">Leito vago *</Label>
                <Select value={targetBedId} onValueChange={setTargetBedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o leito" />
                  </SelectTrigger>
                  <SelectContent>
                    {bedsForSector.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        Leito {b.bed_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Motivo */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Motivo operacional *</Label>
              <Select value={reasonValue} onValueChange={setReasonValue}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">
                Observação {reasonValue === "outro"
                  ? <span className="text-destructive normal-case">(obrigatória)</span>
                  : <span className="text-muted-foreground normal-case font-normal">(opcional)</span>}
              </Label>
              <Textarea
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Descreva brevemente o que aconteceu — fica visível na auditoria."
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-foreground leading-relaxed">
                Esta ação <strong>não substitui</strong> transferência clínica.
                Para mudanças por decisão médica, use o <strong>Painel Clínico</strong> do paciente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleOpenConfirm} disabled={submitting || loading} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Revisar e confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {targetBed && (
        <MovementConfirmDialog
          open={confirmOpen}
          onOpenChange={(o) => !submitting && setConfirmOpen(o)}
          onConfirm={handleConfirm}
          isSubmitting={submitting}
          title="Confirmar remanejamento operacional"
          confirmLabel="Confirmar remanejamento"
          tone="primary"
          summary={[
            { icon: BedDouble, label: "Origem", value: `${sectorLabelFromCode(patient.sector) || patient.sector} • Leito ${patient.bedNumber}` },
            { icon: ArrowRightLeft, label: "Destino", value: `${sectorLabelFromCode(targetBed.sector) || targetBed.sector} • Leito ${targetBed.bed_number}` },
            { icon: Wrench, label: "Motivo", value: fullReason, fullWidth: true },
          ]}
          consequences={[
            { icon: ArrowRightLeft, text: <>Todos os <strong>dados clínicos</strong> e o <strong>histórico longitudinal</strong> (evoluções, prescrições, exames, culturas, condutas) são <strong>preservados e migrados</strong> para o leito de destino.</> },
            { icon: BedDouble, text: <>O leito de origem fica <strong>vago</strong> imediatamente, disponível para nova alocação.</> },
            { icon: AlertTriangle, text: <>Esta movimentação é registrada como <strong>REMANEJAMENTO OPERACIONAL</strong> e <strong>não gera tarja clínica</strong> no mapa.</> },
          ]}
          finalNote={<>Confirme apenas se for movimentação <strong>administrativa</strong>, sem mudança de plano clínico.</>}
        />
      )}
    </>
  );
}
