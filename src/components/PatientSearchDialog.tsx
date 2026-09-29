import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PatientQuickSearch } from "@/components/PatientQuickSearch";
import { usePatientSearchNavigation } from "@/hooks/usePatientSearchNavigation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado ao navegar (ex.: fechar o menu lateral no mobile). */
  onNavigate?: () => void;
}

/**
 * Busca de paciente aberta a partir da sidebar. Reusa o PatientQuickSearch da
 * tela inicial — mesma consulta, mesmos resultados e os mesmos dois destinos
 * (abrir o setor / abrir o painel do paciente).
 */
export function PatientSearchDialog({ open, onOpenChange, onNavigate }: Props) {
  const { irParaSetorDoPaciente, irParaPaciente } = usePatientSearchNavigation({
    onNavegar: () => {
      onOpenChange(false);
      onNavigate?.();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-3 sm:p-4 gap-0">
        <DialogTitle className="sr-only">Procurar um paciente</DialogTitle>
        <DialogDescription className="sr-only">
          Busca por nome ou prontuário entre os pacientes internados do hospital.
        </DialogDescription>
        <PatientQuickSearch
          onIrParaSetor={irParaSetorDoPaciente}
          onIrParaPaciente={irParaPaciente}
        />
      </DialogContent>
    </Dialog>
  );
}
