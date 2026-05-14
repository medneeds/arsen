import { useEffect, useState } from "react";
import { AlertTriangle, Bed, ClipboardList, FileText, Info, Stethoscope, UserMinus, UserCheck } from "lucide-react";
import { MovementConfirmDialog, type MovementBlocker, type MovementWarning } from "./MovementConfirmDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Patient } from "@/types/patient";

const REASON_OPTIONS = [
  { value: "paciente_saiu", label: "Paciente saiu antes da admissão (evasão / saída a pedido)" },
  { value: "alocacao_indevida", label: "Alocação indevida no leito (paciente errado)" },
  { value: "redirecionado_outro_setor", label: "Redirecionado para outro setor antes da admissão" },
  { value: "obito_pre_admissao", label: "Óbito antes da admissão hospitalar" },
  { value: "transferido_externo", label: "Transferido para outra unidade antes da admissão" },
  { value: "outro", label: "Outro motivo" },
];

export interface BedReleasePreAdmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient | null;
  onConfirm: (payload: { reason: string; reasonNote: string }) => Promise<void> | void;
}

export function BedReleasePreAdmissionDialog({ open, onOpenChange, patient, onConfirm }: BedReleasePreAdmissionDialogProps) {
  const [reason, setReason] = useState<string>("paciente_saiu");
  const [reasonNote, setReasonNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("paciente_saiu");
      setReasonNote("");
      setSubmitting(false);
    }
  }, [open]);

  if (!patient) return null;

  // Bloqueio: já está admitido formalmente
  const blockers: MovementBlocker[] =
    patient.admissionStatus === "admitido"
      ? [
          {
            label: "Paciente já admitido oficialmente",
            reason:
              "A admissão hospitalar foi concluída. Use o fluxo de Alta Médica → Alta Administrativa para liberar o leito.",
          },
        ]
      : [];

  // Bloqueio: motivo "outro" exige nota
  if (reason === "outro" && reasonNote.trim().length < 5) {
    blockers.push({
      label: "Detalhe o motivo",
      reason: 'Ao selecionar "Outro motivo" é obrigatório descrever o que aconteceu (mínimo 5 caracteres).',
    });
  }

  const warnings: MovementWarning[] =
    reason === "obito_pre_admissao"
      ? [
          {
            label: "Óbito antes da admissão",
            detail:
              "Mesmo sem admissão hospitalar formal, registre o óbito pelo fluxo da Alta/Desfecho para gerar a Declaração de Óbito.",
          },
        ]
      : [];

  const reasonLabel = REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason;

  const handleConfirm = async () => {
    if (blockers.length > 0) return;
    setSubmitting(true);
    try {
      await onConfirm({ reason: reasonLabel, reasonNote: reasonNote.trim() });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MovementConfirmDialog
      open={open}
      onOpenChange={(v) => (!submitting ? onOpenChange(v) : undefined)}
      onConfirm={handleConfirm}
      isSubmitting={submitting}
      title="Liberar leito (pré-admissão)"
      description="O paciente ainda não concluiu a admissão hospitalar — você pode desocupar o leito sem apagar o prontuário."
      tone="warning"
      confirmLabel="Liberar leito agora"
      cancelLabel="Voltar"
      summary={[
        { icon: UserMinus, label: "Paciente", value: patient.name || "—" },
        { icon: Bed, label: "Leito atual", value: patient.bedNumber || "—" },
        { icon: Stethoscope, label: "Setor", value: (patient as any).department || patient.sector || "—" },
        { icon: ClipboardList, label: "Status atual", value: patient.admissionStatus === "admitido" ? "Admitido" : "Pré-admitido" },
        { icon: FileText, label: "Motivo selecionado", value: reasonLabel, fullWidth: true },
      ]}
      blockers={blockers}
      warnings={warnings}
      consequences={[
        { icon: Bed, text: <><strong>O leito volta para vago</strong> no mapa, disponível para nova alocação imediatamente.</> },
        { icon: UserCheck, text: <>O <strong>prontuário do paciente é preservado</strong> — nada do que foi cadastrado na recepção/triagem é apagado. Quando o paciente voltar, será nova admissão vinculada ao mesmo prontuário.</> },
        { icon: FileText, text: <>A ação é <strong>auditada em Movimentações</strong> como "Liberação Pré-admissão", com motivo, autor e snapshot do leito.</> },
        { icon: Info, text: <>Esta ação <strong>não substitui</strong> a alta médica. Pacientes já admitidos só podem deixar o leito pelo fluxo Alta Médica → Alta Administrativa.</> },
      ]}
      finalNote={
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold mb-2 block">Motivo da liberação</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-1.5">
              {REASON_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-start gap-2">
                  <RadioGroupItem value={opt.value} id={`release-reason-${opt.value}`} className="mt-0.5" />
                  <Label htmlFor={`release-reason-${opt.value}`} className="text-xs font-normal cursor-pointer leading-snug">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">
              Observação {reason === "outro" ? <span className="text-destructive">(obrigatória)</span> : <span className="text-muted-foreground font-normal">(opcional)</span>}
            </Label>
            <Textarea
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="Descreva brevemente o que aconteceu — visível na auditoria."
              rows={2}
              className="text-xs"
            />
          </div>
        </div>
      }
    />
  );
}
