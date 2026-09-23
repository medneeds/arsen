import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calendar } from "lucide-react";
import { toast } from "sonner";
import { parseISO, differenceInDays } from "date-fns";
import { DhdPatientCard } from "@/components/dhd/DhdPatientCard";
import { DhdCompletionDialog } from "@/components/dhd/DhdCompletionDialog";

// Shape de view-model consumido pelos cards/dialogs DHD (mantido estável).
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
  created_at: string;
}

// MIGRAÇÃO: pacientes_dhd (schema novo) não tem colunas de nome/idade/programação.
// A identidade do paciente vem, quando existe, da internação vinculada
// (internacao_id → internacoes → pacientes). Sem internação, nome/idade ficam vazios.
function computeAge(dob: string | null | undefined): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return years >= 0 ? `${years} anos` : null;
}

function mapDhdRow(r: any): DhdPatient {
  const pac = r?.internacoes?.pacientes ?? null;
  const nome = pac?.nome_social || pac?.nome_completo || "";
  return {
    id: r.id,
    patient_name: nome, // MIGRAÇÃO: derivado de internacao→paciente (vazio sem vínculo)
    patient_age: computeAge(pac?.data_nascimento), // MIGRAÇÃO: idem
    diagnosis: r.diagnostico ?? null,
    start_date: r.data_inicio,
    end_date: r.data_fim,
    medication_schedule: null, // MIGRAÇÃO: sem coluna equivalente no schema novo
    medication_days: Array.isArray(r.dias_medicacao) ? r.dias_medicacao : [],
    dhd_report: r.relatorio_dhd ?? null,
    status: r.status,
    created_at: r.criado_em,
  };
}

export default function DhdDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentHospital } = useHospital();

  const [patients, setPatients] = useState<DhdPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<DhdPatient | null>(null);

  const fetchPatients = async () => {
    // MIGRAÇÃO: filtros por state_id/department removidos (colunas inexistentes);
    // escopo agora é hospital_id + RLS.
    if (!user || !currentHospital) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("pacientes_dhd")
        .select("*, internacoes(pacientes(nome_completo, nome_social, data_nascimento))")
        .eq("hospital_id", currentHospital.id)
        .eq("status", "active")
        .order("data_fim", { ascending: true });

      if (error) throw error;

      setPatients((data as any[] | null)?.map(mapDhdRow) ?? []);
    } catch (error) {
      console.error("Erro ao buscar pacientes DHD:", error);
      toast.error("Não foi possível carregar pacientes DHD");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [user, currentHospital]);

  const handleMedicationToggle = async (patientId: string, date: string, currentDays: string[]) => {
    try {
      const isMarked = currentDays.includes(date);
      const updatedDays = isMarked
        ? currentDays.filter(d => d !== date)
        : [...currentDays, date];

      const { error } = await supabase
        .from("pacientes_dhd")
        .update({ dias_medicacao: updatedDays })
        .eq("id", patientId);

      if (error) throw error;

      // Check if this is the last day
      const patient = patients.find(p => p.id === patientId);
      if (patient && !isMarked) {
        const endDate = parseISO(patient.end_date);
        const allDaysMarked = updatedDays.length;
        const totalDays = differenceInDays(endDate, parseISO(patient.start_date)) + 1;
        
        if (allDaysMarked === totalDays) {
          setSelectedPatient(patient);
          setCompletionDialogOpen(true);
        }
      }

      fetchPatients();
    } catch (error) {
      console.error("Erro ao atualizar dia de medicação:", error);
      toast.error("Não foi possível marcar dia de medicação");
    }
  };

  const handleCompleteProgram = async () => {
    if (!selectedPatient) return;

    try {
      const { error } = await supabase
        .from("pacientes_dhd")
        .update({ status: "completed" })
        .eq("id", selectedPatient.id);

      if (error) throw error;

      toast.success("Programa DHD finalizado com sucesso");
      setCompletionDialogOpen(false);
      setSelectedPatient(null);
      fetchPatients();
    } catch (error) {
      console.error("Erro ao finalizar programa:", error);
      toast.error("Não foi possível finalizar programa DHD");
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.patient_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            DHD - Desospitalização Hospitalar-Dia
          </h1>
          <p className="text-muted-foreground mt-1">
            Pacientes em programa ativo
          </p>
        </div>
        <Button
          onClick={() => navigate("/dhd/cadastro")}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Paciente DHD
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/dhd/historico")}
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Histórico
        </Button>
      </div>

      {/* Patients Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhum paciente DHD ativo
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm
              ? "Nenhum resultado encontrado para sua busca"
              : "Cadastre um novo paciente para iniciar o programa"}
          </p>
          {!searchTerm && (
            <Button onClick={() => navigate("/dhd/cadastro")} className="gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar Primeiro Paciente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => (
            <DhdPatientCard
              key={patient.id}
              patient={patient}
              onMedicationToggle={handleMedicationToggle}
              onRefresh={fetchPatients}
            />
          ))}
        </div>
      )}

      {/* Completion Dialog */}
      {selectedPatient && (
        <DhdCompletionDialog
          open={completionDialogOpen}
          onOpenChange={setCompletionDialogOpen}
          patientName={selectedPatient.patient_name}
          onComplete={handleCompleteProgram}
        />
      )}
    </div>
  );
}