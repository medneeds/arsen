import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AdmissionForm } from "@/components/admission/AdmissionForm";

interface AdmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    id: string;
    name: string;
    bed: string;
    sector: string;
    age?: string | number;
    department?: string;
    patient_registry_id?: string | null;
  };

  onSuccess?: () => void;
}

/**
 * Wrapper fino sobre <AdmissionForm />. Toda a lógica clínica (rascunho,
 * impressão, submit D0) vive em src/components/admission/AdmissionForm.tsx —
 * usada tambem pela pagina /admissao. Este dialog fica preservado apenas como
 * rollback; a admissao passou a ser aberta como pagina pelo Hub.
 */
export function AdmissionDialog({ open, onOpenChange, patient, onSuccess }: AdmissionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[55rem] max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0">
        <AdmissionForm
          patient={patient}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
