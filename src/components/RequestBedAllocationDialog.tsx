import { useState } from "react";
import { Bed, Send, User, MapPin, ClipboardList, Eye, Clock } from "lucide-react";
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
import { MovementConfirmDialog } from "@/components/MovementConfirmDialog";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { createRequest } = useBedAllocationRequests();

  const sectors = [
    { value: "UTI 1", label: "UTI 1", color: "text-red-500" },
    { value: "UTI 2", label: "UTI 2", color: "text-yellow-500" },
    { value: "UCI 1", label: "UCI 1", color: "text-blue-500" },
    { value: "UCI 2", label: "UCI 2", color: "text-muted-foreground" },
  ];

  const handleSubmit = async () => {
    if (!selectedSector) return;

    setIsSubmitting(true);
    try {
      const result = await createRequest(patient.id, selectedSector);
      if (result) {
        setConfirmOpen(false);
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
                onClick={() => setConfirmOpen(true)}
                disabled={!selectedSector || isSubmitting}
                className="bg-primary"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? "Enviando..." : "Revisar e enviar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>

      <MovementConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => !isSubmitting && setConfirmOpen(o)}
        onConfirm={handleSubmit}
        isSubmitting={isSubmitting}
        title="Confirmar pedido de alocação de leito"
        confirmLabel="Enviar pedido"
        summary={[
          { icon: User, label: "Paciente", value: patient.name },
          { icon: Bed, label: "Leito atual", value: `${patient.bedNumber || "—"} • ${patient.sector || "—"}` },
          { icon: MapPin, label: "Setor solicitado", value: selectedSector || "—" },
        ]}
        consequences={[
          { icon: ClipboardList, text: <>Será criado um <strong>pedido de alocação</strong> no NIR/regulação para o setor <strong>{selectedSector}</strong>.</> },
          { icon: Clock, text: <>O paciente <strong>NÃO é movido agora</strong>. Ele permanece no leito atual e entra na <strong>fila de regulação</strong>, aguardando aprovação do líder do setor destino.</> },
          { icon: Eye, text: <>Você poderá acompanhar o status (pendente / em discussão / aprovado / negado) no card do paciente e no painel NIR.</> },
          { icon: User, text: <>Quando o pedido for aprovado, a alocação efetiva no leito será feita por etapa separada pela equipe de regulação.</> },
        ]}
        warnings={!patient.admissionHistory
          ? [{ label: "História admissional não preenchida", detail: "recomenda-se preencher antes de enviar para facilitar a análise do líder." }]
          : []}
        finalNote={<>O pedido pode ser cancelado enquanto estiver pendente. Confirme apenas se o setor solicitado estiver correto.</>}
      />
    </Dialog>
  );
}
