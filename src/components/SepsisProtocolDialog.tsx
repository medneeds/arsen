import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, User } from "lucide-react";
import { usePatients } from "@/hooks/usePatients";
import { useNavigate } from "react-router-dom";

interface SepsisProtocolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SepsisProtocolDialog({ open, onOpenChange }: SepsisProtocolDialogProps) {
  const { patients } = usePatients();
  const navigate = useNavigate();
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  const handleLinkedProtocol = () => {
    if (!selectedPatientId) return;
    navigate(`/sepsis-protocol?patientId=${selectedPatientId}`);
    onOpenChange(false);
  };

  const handleBlankProtocol = () => {
    navigate("/sepsis-protocol");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>PROTOCOLO SEPSE ADULTO</DialogTitle>
          <DialogDescription>
            Escolha como deseja preencher o protocolo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">VINCULAR A PACIENTE DO MAPA</h4>
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="SELECIONE UM PACIENTE" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    LEITO {patient.bedNumber} - {patient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              className="w-full" 
              onClick={handleLinkedProtocol}
              disabled={!selectedPatientId}
            >
              <User className="mr-2 h-4 w-4" />
              PREENCHER COM DADOS DO PACIENTE
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">OU</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">DOCUMENTO EM BRANCO</h4>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleBlankProtocol}
            >
              <FileText className="mr-2 h-4 w-4" />
              ABRIR FORMULÁRIO VAZIO
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
