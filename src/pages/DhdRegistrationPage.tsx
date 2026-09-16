import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
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
  const { currentHospital } = useHospital();

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
    
    if (!user || !currentHospital) {
      toast.error("Erro: Dados de autenticação não encontrados");
      return;
    }

    // MIGRAÇÃO: data_fim (end_date) virou coluna NOT NULL em pacientes_dhd, então
    // agora é obrigatória. patient_name/medication_schedule não têm coluna no schema
    // novo (ver abaixo) — a validação passa a exigir início/fim/diagnóstico.
    if (!formData.start_date || !formData.end_date) {
      toast.error("Por favor, preencha as datas de início e finalização");
      return;
    }

    try {
      setSaving(true);

      // MIGRAÇÃO: pacientes_dhd não possui colunas para patient_name, patient_age,
      // medication_schedule, state_id, hospital_unit_id nem department. Esses campos
      // do formulário legado NÃO são persistidos (removidos do payload). A identidade
      // do paciente, quando houver, é dada por internacao_id (não capturado por este
      // formulário livre). hospital_unit_id → hospital_id; created_by → criado_por.
      const { error } = await supabase.from("pacientes_dhd").insert({
        diagnostico: formData.diagnosis || null,
        data_inicio: formData.start_date,
        data_fim: formData.end_date,
        relatorio_dhd: formData.dhd_report || null,
        dias_medicacao: [],
        status: "active",
        hospital_id: currentHospital.id,
        criado_por: user.id,
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