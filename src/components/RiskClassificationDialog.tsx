import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, Clock, CheckCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskClassificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preAdmission: {
    id: string;
    patient_name: string;
    birth_date?: string;
    sex?: string;
  } | null;
  onSuccess?: () => void;
}

const RISK_LEVELS = [
  {
    value: "vermelho",
    label: "EMERGÊNCIA",
    description: "Risco de morte imediato. Atendimento imediato.",
    color: "bg-red-600 hover:bg-red-700 text-white border-red-700",
    selectedColor: "ring-4 ring-red-400 bg-red-600 text-white",
    icon: AlertTriangle,
    time: "0 min",
  },
  {
    value: "laranja",
    label: "MUITO URGENTE",
    description: "Risco de deterioração rápida. Até 10 minutos.",
    color: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600",
    selectedColor: "ring-4 ring-orange-300 bg-orange-500 text-white",
    icon: AlertTriangle,
    time: "10 min",
  },
  {
    value: "amarelo",
    label: "URGENTE",
    description: "Condição grave, sem risco imediato. Até 60 minutos.",
    color: "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-600",
    selectedColor: "ring-4 ring-yellow-300 bg-yellow-500 text-black",
    icon: Clock,
    time: "60 min",
  },
  {
    value: "verde",
    label: "POUCO URGENTE",
    description: "Condição estável. Até 120 minutos.",
    color: "bg-green-600 hover:bg-green-700 text-white border-green-700",
    selectedColor: "ring-4 ring-green-300 bg-green-600 text-white",
    icon: CheckCircle,
    time: "120 min",
  },
  {
    value: "azul",
    label: "NÃO URGENTE",
    description: "Sem risco. Até 240 minutos.",
    color: "bg-blue-600 hover:bg-blue-700 text-white border-blue-700",
    selectedColor: "ring-4 ring-blue-300 bg-blue-600 text-white",
    icon: Info,
    time: "240 min",
  },
] as const;

export function RiskClassificationDialog({ open, onOpenChange, preAdmission, onSuccess }: RiskClassificationDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!selected || !preAdmission) return;

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("pre_admissions")
        .update({
          risk_classification: selected,
          risk_classified_at: new Date().toISOString(),
          risk_classified_by: userData?.user?.id || null,
          status: "classificado",
          notes: notes.trim() || preAdmission.patient_name ? notes.trim() : null,
        })
        .eq("id", preAdmission.id);

      if (error) throw error;

      const level = RISK_LEVELS.find(r => r.value === selected);
      toast({
        title: `✅ Classificação: ${level?.label}`,
        description: `${preAdmission.patient_name} classificado com sucesso`,
      });

      setSelected(null);
      setNotes("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Erro ao classificar", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setSelected(null);
    setNotes("");
    onOpenChange(false);
  };

  const age = preAdmission?.birth_date
    ? Math.floor((Date.now() - new Date(preAdmission.birth_date + 'T12:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Classificação de Risco — Manchester
          </DialogTitle>
          {preAdmission && (
            <p className="text-sm text-muted-foreground">
              {preAdmission.patient_name}
              {age !== null && ` • ${age} anos`}
              {preAdmission.sex && ` • ${preAdmission.sex === 'M' ? 'Masculino' : preAdmission.sex === 'F' ? 'Feminino' : 'Outro'}`}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-2">
          {RISK_LEVELS.map(level => {
            const Icon = level.icon;
            const isSelected = selected === level.value;
            return (
              <button
                key={level.value}
                onClick={() => setSelected(level.value)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                  isSelected ? level.selectedColor : level.color,
                  "cursor-pointer"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{level.label}</div>
                  <div className="text-xs opacity-90">{level.description}</div>
                </div>
                <div className="text-xs font-mono font-bold shrink-0">{level.time}</div>
              </button>
            );
          })}
        </div>

        <div>
          <Label className="text-xs">Observações clínicas</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Sintomas, queixas, sinais vitais..."
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!selected || isSaving}>
            Classificar Paciente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
