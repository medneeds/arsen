import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Clock, CheckCircle2, BedDouble, AlertTriangle, X } from "lucide-react";

interface InternmentStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  currentStatus: string | null;
  currentNotes: string | null;
  onSuccess?: () => void;
}

const statusConfig = {
  SOLICITACAO_PENDENTE: {
    label: "🕐 Solicitação Pendente",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
  },
  PSM_FAVORAVEL: {
    label: "✅ Solicitada Internação PSM Favorável",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
  },
  AGUARDANDO_VAGA: {
    label: "🏥 Aguardando Alocação no SIGA Vaga",
    icon: BedDouble,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
  },
  IR_PARA_UTI: {
    label: "🚨 IR PARA LEITO DE UTI",
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
  },
  IR_PARA_ENFERMARIA: {
    label: "🏥 IR PARA LEITO DE ENFERMARIA",
    icon: BedDouble,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
  },
};

export function InternmentStatusDialog({
  isOpen,
  onClose,
  patientId,
  patientName,
  currentStatus,
  currentNotes,
  onSuccess,
}: InternmentStatusDialogProps) {
  const [status, setStatus] = useState<string>(currentStatus || "");
  const [notes, setNotes] = useState(currentNotes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSubmitting(true);

    try {
      // Get current patient data to update pendencies
      const { data: patientData, error: fetchError } = await supabase
        .from("patients")
        .select("pendencies")
        .eq("id", patientId)
        .single();

      if (fetchError) throw fetchError;

      // Parse existing pendencies
      let currentPendencies: string[] = [];
      if (patientData.pendencies) {
        try {
          currentPendencies = JSON.parse(patientData.pendencies);
        } catch {
          currentPendencies = [];
        }
      }

      // Map status to pendency text
      const statusToPendencyText: Record<string, string> = {
        PSM_FAVORAVEL: "SOLICITADA INTERNAÇÃO (PSM FAVORÁVEL)",
        IR_PARA_UTI: "IR PARA LEITO DE UTI",
        IR_PARA_ENFERMARIA: "IR PARA LEITO DE ENFERMARIA",
        AGUARDANDO_VAGA: "AGUARDANDO ALOCAÇÃO NO SIGA VAGA",
        SOLICITACAO_PENDENTE: "SOLICITAÇÃO DE INTERNAÇÃO PENDENTE"
      };

      // Add corresponding text to pendencies if status is being set and not already in list
      if (status && statusToPendencyText[status]) {
        const autoAddText = statusToPendencyText[status];
        if (!currentPendencies.includes(autoAddText)) {
          currentPendencies.push(autoAddText);
        }
      }

      // Update patient with new status and updated pendencies
      const { error } = await supabase
        .from("patients")
        .update({
          internment_status: status || null,
          internment_notes: notes || null,
          pendencies: JSON.stringify(currentPendencies),
        })
        .eq("id", patientId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: "Status de internação atualizado com sucesso",
      });

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Error updating internment status:", error);
      toast({
        title: "ERRO",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("patients")
        .update({
          internment_status: null,
          internment_notes: null,
        })
        .eq("id", patientId);

      if (error) throw error;

      toast({
        title: "STATUS REMOVIDO",
        description: "Status de internação foi removido",
      });

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Error clearing internment status:", error);
      toast({
        title: "ERRO",
        description: "Não foi possível remover o status",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStatus(currentStatus || "");
    setNotes(currentNotes || "");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl uppercase">
            Status de Internação
          </DialogTitle>
          <DialogDescription className="uppercase">
            Gerenciar status de solicitação de internação para{" "}
            <span className="font-semibold">{patientName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status" className="uppercase text-xs font-semibold">
              Status da Solicitação
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status" className="uppercase">
                <SelectValue placeholder="SELECIONE O STATUS" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={key} value={key} className="uppercase">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="uppercase text-xs font-semibold">
              Observações (opcional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.toUpperCase())}
              placeholder="ADICIONE OBSERVAÇÕES SOBRE A SOLICITAÇÃO..."
              className="min-h-[100px] uppercase resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {currentStatus && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={isSubmitting}
              className="gap-2 uppercase"
            >
              <X className="h-4 w-4" />
              Remover Status
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="uppercase"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || !status}
            className="uppercase"
          >
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
