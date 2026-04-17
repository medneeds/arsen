import { Patient } from "@/types/patient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Bed, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatAgeDisplay } from "@/utils/ageDisplay";

interface ViewPatientSnapshotDialogProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
}

const sectorNames = {
  red: "UTI 1",
  yellow: "UTI 2",
  blue: "UCI 1",
  outside: "UCI 2",
};

const sectorColors = {
  red: "bg-red-500/10 text-red-600 border-red-500/30",
  yellow: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  blue: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  outside: "bg-gray-500/10 text-gray-600 border-gray-500/30",
};

export function ViewPatientSnapshotDialog({
  patient,
  isOpen,
  onClose,
}: ViewPatientSnapshotDialogProps) {
  if (!patient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Dados Históricos do Paciente</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(85vh-8rem)] pr-4">
          <div className="space-y-6">
            {/* Patient Header Info */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <h3 className="patient-id text-xl font-bold">{patient.name}</h3>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Bed className="h-4 w-4" />
                    <span>Leito: {patient.bedNumber}</span>
                  </div>
                  {patient.age && (
                    <span>Idade: {formatAgeDisplay(patient.age)}</span>
                  )}
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={`${sectorColors[patient.sector]} border`}
              >
                {sectorNames[patient.sector]}
              </Badge>
            </div>

            {/* Admission Info */}
            {patient.admissionDate && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Data de Admissão</span>
                </div>
                <p className="text-sm pl-6">
                  {format(new Date(patient.admissionDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}

            <Separator />

            {/* Diagnoses */}
            {patient.diagnoses && patient.diagnoses.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Hipóteses / Diagnósticos</h4>
                <ul className="list-decimal list-inside space-y-1 pl-2">
                  {patient.diagnoses.map((diagnosis, index) => (
                    <li key={index} className="text-sm uppercase">{diagnosis}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Medical History */}
            {patient.medicalHistory && patient.medicalHistory.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Antecedentes</h4>
                <ul className="list-decimal list-inside space-y-1 pl-2">
                  {patient.medicalHistory.map((history, index) => (
                    <li key={index} className="text-sm uppercase">{history}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Relevant Exams */}
            {patient.relevantExams && patient.relevantExams.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Exames</h4>
                <ul className="list-decimal list-inside space-y-1 pl-2">
                  {patient.relevantExams.map((exam, index) => (
                    <li key={index} className="text-sm uppercase">{exam}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pendencies */}
            {patient.pendencies && patient.pendencies.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Programações / Pendências</h4>
                <ul className="list-decimal list-inside space-y-1 pl-2">
                  {patient.pendencies.map((pendency, index) => (
                    <li key={index} className="text-sm uppercase">{pendency}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Admission History */}
            {patient.admissionHistory && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">História Admissional / Anamnese</h4>
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <p className="text-sm whitespace-pre-wrap uppercase">
                    {patient.admissionHistory}
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
