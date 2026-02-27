import { useState } from "react";
import { Bed, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useBedAllocationRequests } from "@/hooks/useBedAllocationRequests";
import { Patient } from "@/types/patient";

interface RequestBedAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
}

export function RequestBedAllocationDialog({
  open,
  onOpenChange,
  patient,
}: RequestBedAllocationDialogProps) {
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createRequest } = useBedAllocationRequests();

  const sectors = [
    { value: "Cuidados Especiais", label: "Sala de Cuidados Especiais (Vermelha)", color: "text-red-500" },
    { value: "Observação Amarela", label: "Observação Amarela", color: "text-yellow-500" },
    { value: "Observação Azul", label: "Observação Azul", color: "text-blue-500" },
  ];

  const handleSubmit = async () => {
    if (!selectedSector) return;

    setIsSubmitting(true);
    try {
      const result = await createRequest(patient.id, selectedSector);
      if (result) {
        onOpenChange(false);
        setSelectedSector("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasAllocationPending = patient.allocationStatus === "pending" || patient.allocationStatus === "discussing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-primary" />
            Solicitar Alocação de Leito
          </DialogTitle>
          <DialogDescription>
            Solicite a alocação do paciente em um dos setores de observação.
            O líder será notificado para aprovar.
          </DialogDescription>
        </DialogHeader>

        {hasAllocationPending ? (
          <div className="py-4">
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-500 font-medium">
                {patient.allocationStatus === "pending" 
                  ? "Já existe uma solicitação pendente para este paciente."
                  : "Solicitação aguardando discussão do caso."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">Paciente:</p>
                <p className="text-lg font-semibold">{patient.name}</p>
                {patient.age && (
                  <p className="text-sm text-muted-foreground">Idade: {patient.age}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Setor de destino</Label>
                <Select value={selectedSector} onValueChange={setSelectedSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((sector) => (
                      <SelectItem key={sector.value} value={sector.value}>
                        <span className={sector.color}>{sector.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!patient.admissionHistory && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm text-amber-500">
                    ⚠️ Recomendado: Preencha a História Admissional na Edição Avançada antes de solicitar a alocação.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!selectedSector || isSubmitting}
                className="bg-primary"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
