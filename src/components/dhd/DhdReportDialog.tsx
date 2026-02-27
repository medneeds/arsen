import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePrivacy, maskName } from "@/contexts/PrivacyContext";

interface DhdPatient {
  id: string;
  patient_name: string;
  patient_age: string | null;
  diagnosis: string | null;
  start_date: string;
  end_date: string;
  medication_schedule: string | null;
  dhd_report: string | null;
}

interface DhdReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: DhdPatient;
}

export function DhdReportDialog({ open, onOpenChange, patient }: DhdReportDialogProps) {
  const { namesHidden } = usePrivacy();
  const displayName = maskName(patient.patient_name, namesHidden);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Relatório DHD</DialogTitle>
          <DialogDescription className="uppercase">
            {namesHidden ? <span className="tracking-widest opacity-70">{displayName}</span> : patient.patient_name}
            {patient.patient_age && ` • ${patient.patient_age}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Patient Info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-medium">Data de Início:</p>
                  <p className="font-semibold">
                    {format(parseISO(patient.start_date), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Data de Finalização:</p>
                  <p className="font-semibold">
                    {format(parseISO(patient.end_date), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
              {patient.medication_schedule && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground font-medium text-sm">Programação:</p>
                  <p className="text-sm mt-1 font-semibold">{patient.medication_schedule}</p>
                </div>
              )}
              {patient.diagnosis && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground font-medium text-sm">Diagnóstico:</p>
                  <p className="text-sm mt-1">{patient.diagnosis}</p>
                </div>
              )}
            </div>

            {/* Report Content */}
            <div>
              <h3 className="font-semibold mb-3 text-lg">Plano de Desospitalização</h3>
              {patient.dhd_report ? (
                <div className="prose prose-sm max-w-none bg-background border rounded-lg p-4">
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                    {patient.dhd_report}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum relatório registrado</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}