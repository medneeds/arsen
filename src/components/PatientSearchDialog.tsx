import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PatientRegistrySearch } from "@/components/PatientRegistrySearch";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado ao navegar (ex.: fechar o menu lateral no mobile). */
  onNavigate?: () => void;
}

/**
 * Busca de paciente aberta a partir da sidebar. Busca por PESSOA (nome,
 * prontuário, CPF ou CNS) e inclui quem NÃO tem atendimento ativo:
 *  - COM atendimento ativo → hub do paciente no setor;
 *  - SEM atendimento ativo → Histórico (consulta read-only do prontuário).
 */
export function PatientSearchDialog({ open, onOpenChange, onNavigate }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-3 sm:p-4 gap-0">
        <DialogTitle className="sr-only">Procurar um paciente</DialogTitle>
        <DialogDescription className="sr-only">
          Busca por nome, prontuário, CPF ou CNS — inclui pacientes sem atendimento ativo.
        </DialogDescription>
        <PatientRegistrySearch
          onNavigate={() => {
            onOpenChange(false);
            onNavigate?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
