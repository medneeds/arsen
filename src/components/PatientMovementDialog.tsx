import { useState } from "react";
import { Patient } from "@/types/patient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useHospital } from "@/contexts/HospitalContext";
import { TrendingUp, Skull, ArrowLeftRight } from "lucide-react";

interface PatientMovementDialogProps {
  patient: Patient | null;
  movementType: "ALTA" | "ÓBITO" | "TRANSFERÊNCIA" | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const movementConfig = {
  ALTA: {
    title: "Registrar Alta",
    description: "Registre a alta do paciente do serviço de emergência",
    icon: TrendingUp,
    color: "text-green-600",
    showDestination: false,
  },
  ÓBITO: {
    title: "Registrar Óbito",
    description: "Registre o óbito do paciente",
    icon: Skull,
    color: "text-red-600",
    showDestination: false,
  },
  TRANSFERÊNCIA: {
    title: "Registrar Transferência",
    description: "Registre a transferência do paciente para outro setor",
    icon: ArrowLeftRight,
    color: "text-blue-600",
    showDestination: true,
  },
};

const transferDestinations = [
  "UTI",
  "UTI NEONATAL",
  "UTI PEDIÁTRICA",
  "ENFERMARIA",
  "ENFERMARIA PEDIÁTRICA",
  "HEMODINÂMICA",
  "CENTRO CIRÚRGICO",
  "INSTITUTO VOLTA VIDA (IVV)",
  "PSIQUIATRIA (INSTITUTO VOLTA VIDA)",
  "OUTRO HOSPITAL",
];

export function PatientMovementDialog({
  patient,
  movementType,
  isOpen,
  onClose,
  onSuccess,
}: PatientMovementDialogProps) {
  const [destination, setDestination] = useState("");
  const [customDestination, setCustomDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [responsibleDoctor, setResponsibleDoctor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { currentState, currentHospital } = useHospital();

  const config = movementType ? movementConfig[movementType] : null;
  const Icon = config?.icon;

  const handleSubmit = async () => {
    if (!patient || !movementType) return;

    if (movementType === "TRANSFERÊNCIA" && !destination && !customDestination) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, selecione ou especifique o destino da transferência.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (!currentHospital || !currentState) {
        throw new Error('Hospital unit and state must be selected');
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      const finalDestination = destination === "OUTRO" ? customDestination : destination;

      // Get patient's department from the patient object
      const patientDepartment = (patient as any).department || 'URGÊNCIA E EMERGÊNCIA ADULTO';

      const { error } = await supabase
        .from('patient_movements')
        .insert({
          patient_name: patient.name,
          patient_bed: patient.bedNumber,
          patient_sector: patient.sector,
          movement_type: movementType,
          destination: finalDestination || null,
          notes: notes || null,
          responsible_doctor: responsibleDoctor || null,
          created_by: user?.id,
          patient_snapshot: patient as any,
          department: patientDepartment,
          state_id: currentState.id,
          hospital_unit_id: currentHospital.id,
        });

      if (error) throw error;

      toast({
        title: `${config?.title} realizado com sucesso`,
        description: `${movementType.toLowerCase()} registrado(a) no histórico.`,
      });

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Error creating movement:', error);
      toast({
        title: "Erro ao registrar movimentação",
        description: "Não foi possível registrar a movimentação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setDestination("");
    setCustomDestination("");
    setNotes("");
    setResponsibleDoctor("");
    onClose();
  };

  if (!config || !patient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {Icon && <Icon className={`h-6 w-6 ${config.color}`} />}
            <DialogTitle className="text-xl">{config.title}</DialogTitle>
          </div>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Paciente</Label>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{patient.name}</p>
              <p className="text-sm text-muted-foreground">
                Leito: {patient.bedNumber} • Setor: {patient.sector}
              </p>
            </div>
          </div>

          {config.showDestination && (
            <div className="space-y-2">
              <Label htmlFor="destination">Destino da Transferência *</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger id="destination">
                  <SelectValue placeholder="Selecione o destino" />
                </SelectTrigger>
                <SelectContent>
                  {transferDestinations.map((dest) => (
                    <SelectItem key={dest} value={dest}>
                      {dest}
                    </SelectItem>
                  ))}
                  <SelectItem value="OUTRO">OUTRO (especificar)</SelectItem>
                </SelectContent>
              </Select>
              {destination === "OUTRO" && (
                <Input
                  placeholder="Especifique o destino"
                  value={customDestination}
                  onChange={(e) => setCustomDestination(e.target.value.toUpperCase())}
                  className="mt-2"
                />
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="responsibleDoctor">Médico Responsável</Label>
            <Input
              id="responsibleDoctor"
              placeholder="Digite o nome do médico responsável (opcional)"
              value={responsibleDoctor}
              onChange={(e) => setResponsibleDoctor(e.target.value.toUpperCase())}
              className="uppercase"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Adicione observações sobre esta movimentação (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value.toUpperCase())}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
