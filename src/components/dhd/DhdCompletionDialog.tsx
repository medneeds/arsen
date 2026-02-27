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
import { CheckCircle2 } from "lucide-react";

interface DhdCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  onComplete: () => void;
}

export function DhdCompletionDialog({
  open,
  onOpenChange,
  patientName,
  onComplete,
}: DhdCompletionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <AlertDialogTitle className="text-xl">
              Programa DHD Concluído!
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Todos os dias de medicação foram completados para <strong>{patientName}</strong>.
            <br />
            <br />
            Deseja finalizar o programa e mover o paciente para o histórico?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Manter no Dashboard</AlertDialogCancel>
          <AlertDialogAction
            onClick={onComplete}
            className="bg-green-600 hover:bg-green-700"
          >
            Finalizar Programa
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}