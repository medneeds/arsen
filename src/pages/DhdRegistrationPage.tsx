import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function DhdRegistrationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentState, currentHospital } = useHospital();
  const { currentDepartment } = useDepartment();
  
  const [formData, setFormData] = useState({
    patient_name: "",
    patient_age: "",
    diagnosis: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    medication_schedule: "",
    dhd_report: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !currentState || !currentHospital) {
      toast.error("Erro: Dados de autenticação não encontrados");
      return;
    }

    if (!formData.patient_name || !formData.start_date || !formData.medication_schedule) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    try {
      setSaving(true);
      
      const { error } = await supabase.from("dhd_patients").insert({
        patient_name: formData.patient_name,
        patient_age: formData.patient_age || null,
        diagnosis: formData.diagnosis || null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        medication_schedule: formData.medication_schedule,
        dhd_report: formData.dhd_report || null,
        medication_days: [],
        status: "active",
        state_id: currentState.id,
        hospital_unit_id: currentHospital.id,
        department: currentDepartment,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Paciente DHD cadastrado com sucesso!");
      navigate("/dhd");
    } catch (error) {
      console.error("Erro ao cadastrar paciente DHD:", error);
      toast.error("Erro ao cadastrar paciente DHD");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/dhd")}
          className="gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Dashboard
        </Button>
        <h1 className="text-3xl font-bold text-foreground">
          Cadastrar Novo Paciente DHD
        </h1>
        <p className="text-muted-foreground mt-1">
          Preencha os dados para iniciar o programa de desospitalização
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Paciente</CardTitle>
          <CardDescription>
            * Campos obrigatórios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="patient_name">Nome Completo *</Label>
                <Input
                  id="patient_name"
                  value={formData.patient_name}
                  onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                  placeholder="Nome do paciente"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="patient_age">Idade</Label>
                <Input
                  id="patient_age"
                  value={formData.patient_age}
                  onChange={(e) => setFormData({ ...formData, patient_age: e.target.value })}
                  placeholder="Ex: 45 anos"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="medication_schedule">Programação das Medicações *</Label>
              <Input
                id="medication_schedule"
                value={formData.medication_schedule}
                onChange={(e) => setFormData({ ...formData, medication_schedule: e.target.value })}
                placeholder="Ex: SEG, QUA, SEX | 24/24H | Dias Alternados"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Descreva a programação: dias específicos da semana, intervalo de horas, ou padrão personalizado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnóstico / Hipótese Diagnóstica</Label>
              <Textarea
                id="diagnosis"
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                placeholder="Descreva o diagnóstico principal..."
                rows={3}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data de Início *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">Data de Finalização</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.start_date}
                />
                <p className="text-xs text-muted-foreground">
                  Opcional - pode ser definida posteriormente
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dhd_report">Relatório DHD</Label>
              <Textarea
                id="dhd_report"
                value={formData.dhd_report}
                onChange={(e) => setFormData({ ...formData, dhd_report: e.target.value })}
                placeholder="Descreva o plano de desospitalização, medicações programadas, orientações..."
                rows={8}
              />
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dhd")}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Cadastrar Paciente"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}