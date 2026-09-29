import { Patient } from "@/types/patient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MovimentacaoForm } from "@/components/movimentacao/MovimentacaoForm";
import type { AnyMovementType } from "@/data/movementFlow";

interface PatientMovementDialogProps {
  patient: Patient | null;
  /** Accepts new subtype ids OR legacy values ("ALTA" | "ÓBITO" | "TRANSFERÊNCIA") for back-compat. */
  movementType: AnyMovementType | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * WRAPPER FINO (rollback). O fluxo multi-etapa de sinalizacao de movimentacao
 * foi extraido para <MovimentacaoForm> e passou a viver na pagina /movimentar
 * (aba "Movimentacao"), no mesmo padrao da admissao. Este componente deixou de
 * ser usado por qualquer gatilho vivo; e mantido, com a MESMA assinatura de
 * props de antes, apenas para permitir rollback rapido para o formato de pop-up
 * (basta voltar a renderiza-lo). A logica e as escritas sao as do formulario —
 * um unico caminho de codigo.
 */
export function PatientMovementDialog({
  patient,
  movementType,
  isOpen,
  onClose,
  onSuccess,
}: PatientMovementDialogProps) {
  if (!patient) return null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader className="sr-only">
          <DialogTitle>Sinalizar Movimentação</DialogTitle>
        </DialogHeader>
        <MovimentacaoForm
          patient={patient}
          movementType={movementType}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
