import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DhdReportDialog } from "@/components/dhd/DhdReportDialog";

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

export default function DhdHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentState, currentHospital } = useHospital();
  const { currentDepartment } = useDepartment();
  
  const [patients, setPatients] = useState<DhdPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<DhdPatient | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  useEffect(() => {
    fetchCompletedPatients();
  }, [user, currentState, currentHospital, currentDepartment]);

  const fetchCompletedPatients = async () => {
    if (!user || !currentState || !currentHospital) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("dhd_patients")
        .select("*")
        .eq("state_id", currentState.id)
        .eq("hospital_unit_id", currentHospital.id)
        .eq("department", currentDepartment)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPatients(data as any || []);
    } catch (error) {
      console.error("Erro ao buscar histórico DHD:", error);
      toast.error("Erro ao carregar histórico DHD");
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.patient_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewReport = (patient: DhdPatient) => {
    setSelectedPatient(patient);
    setReportDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate("/dhd")}
          className="gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Dashboard
        </Button>
        <h1 className="text-3xl font-bold text-foreground">
          Histórico de Desospitalizações
        </h1>
        <p className="text-muted-foreground mt-1">
          Programas DHD finalizados
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome do paciente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Patients List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhum registro no histórico
          </h3>
          <p className="text-muted-foreground">
            {searchTerm
              ? "Nenhum resultado encontrado para sua busca"
              : "Programas DHD finalizados aparecerão aqui"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPatients.map((patient) => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{patient.patient_name}</CardTitle>
                    <CardDescription className="mt-1">
                      {patient.patient_age && `${patient.patient_age} • `}
                      {format(parseISO(patient.start_date), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                      {format(parseISO(patient.end_date), "dd/MM/yyyy", { locale: ptBR })}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-200">
                    Finalizado
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {patient.diagnosis && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Diagnóstico:</p>
                      <p className="text-sm text-foreground">{patient.diagnosis}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{patient.medication_days.length} dias de medicação registrados</span>
                  </div>
                  {patient.dhd_report && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewReport(patient)}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Ver Relatório
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Report Dialog */}
      {selectedPatient && (
        <DhdReportDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          patient={selectedPatient}
        />
      )}
    </div>
  );
}