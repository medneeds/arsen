import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DhdPatient {
  id: string;
  patient_name: string;
  patient_age: string | null;
  diagnosis: string | null;
  start_date: string;
  end_date: string;
  medication_schedule: string | null;
  medication_days: string[] | any;
  dhd_report: string | null;
  status: string;
}

interface EditDhdPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: DhdPatient;
  onUpdate: () => void;
}

export function EditDhdPatientDialog({
  open,
  onOpenChange,
  patient,
  onUpdate,
}: EditDhdPatientDialogProps) {
  const [formData, setFormData] = useState({
    patient_name: patient.patient_name,
    patient_age: patient.patient_age || "",
    diagnosis: patient.diagnosis || "",
    start_date: patient.start_date,
    end_date: patient.end_date,
    medication_schedule: patient.medication_schedule || "",
    dhd_report: patient.dhd_report || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patient_name || !formData.start_date || !formData.medication_schedule) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    try {
      setSaving(true);

      // MIGRAÇÃO: pacientes_dhd não tem colunas patient_name/patient_age/
      // medication_schedule → removidos do payload (não persistidos). Os inputs do
      // diálogo permanecem para não quebrar o layout, mas só diagnostico/datas/
      // relatorio_dhd são gravados. end_date agora é NOT NULL (data_fim).
      const { error } = await supabase
        .from("pacientes_dhd")
        .update({
          diagnostico: formData.diagnosis || null,
          data_inicio: formData.start_date,
          data_fim: formData.end_date,
          relatorio_dhd: formData.dhd_report || null,
        })
        .eq("id", patient.id);

      if (error) throw error;

      toast.success("Paciente DHD atualizado com sucesso");
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao atualizar paciente DHD:", error);
      toast.error("Não foi possível atualizar paciente DHD");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Editar Paciente DHD</DialogTitle>
          <DialogDescription>
            Atualize as informações do paciente em desospitalização
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit_patient_name">Nome Completo *</Label>
              <Input
                id="edit_patient_name"
                value={formData.patient_name}
                onChange={(e) =>
                  setFormData({ ...formData, patient_name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_patient_age">Idade</Label>
              <Input
                id="edit_patient_age"
                value={formData.patient_age}
                onChange={(e) =>
                  setFormData({ ...formData, patient_age: e.target.value })
                }
                placeholder="Ex: 45 anos"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_medication_schedule">Programação das Medicações *</Label>
            <Input
              id="edit_medication_schedule"
              value={formData.medication_schedule}
              onChange={(e) =>
                setFormData({ ...formData, medication_schedule: e.target.value })
              }
              placeholder="Ex: SEG, QUA, SEX | 24/24H | Dias Alternados"
              required
            />
            <p className="text-xs text-muted-foreground">
              Descreva a programação: dias específicos da semana, intervalo de horas, ou padrão personalizado
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_diagnosis">Diagnóstico / Hipótese Diagnóstica</Label>
            <Textarea
              id="edit_diagnosis"
              value={formData.diagnosis}
              onChange={(e) =>
                setFormData({ ...formData, diagnosis: e.target.value })
              }
              placeholder="Descreva o diagnóstico principal..."
              rows={3}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit_start_date">Data de Início *</Label>
              <Input
                id="edit_start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_end_date">Data de Finalização</Label>
              <Input
                id="edit_end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                min={formData.start_date}
              />
              <p className="text-xs text-muted-foreground">
                Opcional - pode ser definida posteriormente
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_dhd_report">Relatório DHD</Label>
            <Textarea
              id="edit_dhd_report"
              value={formData.dhd_report}
              onChange={(e) =>
                setFormData({ ...formData, dhd_report: e.target.value })
              }
              placeholder="Descreva o plano de desospitalização, medicações programadas, orientações..."
              rows={6}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
