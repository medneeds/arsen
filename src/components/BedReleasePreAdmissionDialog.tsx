import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bed, ClipboardList, FileText, Info, Stethoscope, UserMinus, UserCheck } from "lucide-react";
import { MovementConfirmDialog, type MovementBlocker, type MovementWarning } from "./MovementConfirmDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";
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

const PRE_ADMISSION_REASONS = [
  { value: "paciente_saiu", label: "Paciente saiu antes da admissão (evasão / saída a pedido)" },
  { value: "alocacao_indevida", label: "Alocação indevida no leito (paciente errado)" },
  { value: "redirecionado_outro_setor", label: "Redirecionado para outro setor antes da admissão" },
  { value: "obito_pre_admissao", label: "Óbito antes da admissão hospitalar" },
  { value: "transferido_externo", label: "Transferido para outra unidade antes da admissão" },
  { value: "outro", label: "Outro motivo" },
];

const POST_DISCHARGE_REASONS = [
  { value: "alta_concluida", label: "Alta médica já registrada — liberar leito para limpeza/nova alocação" },
  { value: "obito_concluido", label: "Óbito já registrado — liberar leito para preparo/remoção" },
  { value: "transferencia_externa_concluida", label: "Transferência externa já efetivada — leito disponível" },
  { value: "outro", label: "Outro motivo" },
];

export interface BedReleasePreAdmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient | null;
  onConfirm: (payload: { reason: string; reasonNote: string }) => Promise<void> | void;
}

export function BedReleasePreAdmissionDialog({ open, onOpenChange, patient, onConfirm }: BedReleasePreAdmissionDialogProps) {
  const [step, setStep] = useState<"notice" | "form">("notice");
  const [reason, setReason] = useState<string>("paciente_saiu");
  const [reasonNote, setReasonNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("notice");
      setReason("paciente_saiu");
      setReasonNote("");
      setSubmitting(false);
    }
  }, [open]);

  if (!patient) return null;

  const alreadyAdmitted = patient.admissionStatus === "admitido";

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
    <>
      {/* ETAPA 1: Notificação de consciência (intermediária) */}
      <AlertDialog
        open={open && step === "notice"}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-full bg-amber-100 dark:bg-amber-950/40 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <AlertDialogTitle className="text-base">Atenção: liberar leito sem alta</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs leading-relaxed text-foreground">
                <p>
                  Você está prestes a <strong>desocupar o leito {patient.bedNumber || "—"}</strong> ocupado por{" "}
                  <strong>{patient.name || "este paciente"}</strong>.
                </p>
                {alreadyAdmitted ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
                    <p className="font-semibold">Esta ação não está disponível.</p>
                    <p className="mt-1">
                      O paciente já foi <strong>admitido oficialmente</strong>. Liberação só pode ocorrer pelo fluxo
                      <strong> Alta Médica → Alta Administrativa</strong>.
                    </p>
                  </div>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    <li>O <strong>prontuário do paciente é preservado</strong> (nada é apagado).</li>
                    <li>O <strong>leito volta a ficar vago</strong> e disponível para nova alocação.</li>
                    <li>A ação é <strong>auditada</strong> em Movimentações com motivo, autor e horário.</li>
                    <li>Use somente para pacientes que <strong>ainda não concluíram a admissão</strong> (evasão, alocação indevida, redirecionamento, etc.).</li>
                  </ul>
                )}
                <p className="pt-1 text-muted-foreground">
                  Na próxima etapa você deverá <strong>selecionar o motivo</strong> e revisar os detalhes antes de confirmar.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {!alreadyAdmitted && (
              <AlertDialogAction onClick={() => setStep("form")}>
                Entendi, continuar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ETAPA 2: Formulário detalhado com motivo + consequências */}
      <MovementConfirmDialog
        open={open && step === "form"}
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
    </>
  );
}
