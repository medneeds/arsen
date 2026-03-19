import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Monitor,
  Phone,
  Play,
  User,
  Users,
  Volume2,
} from "lucide-react";

interface TriagePatient {
  id: string;
  encounter_code: string;
  patient_name: string;
  triage_status: string;
  destination_sector: string;
  called_at?: string;
  created_at: string;
  registry_id?: string;
}

const TriageQueuePage = () => {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const [patients, setPatients] = useState<TriagePatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [callingId, setCallingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentHospital?.id) return;
    loadQueue();

    const channel = supabase
      .channel("triage-queue-multi")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_encounters",
          filter: `hospital_unit_id=eq.${currentHospital.id}`,
        },
        () => loadQueue()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentHospital?.id]);

  const loadQueue = async () => {
    if (!currentHospital?.id) return;
    try {
      const { data, error } = await supabase
        .from("patient_encounters")
        .select("id, encounter_code, patient_name, triage_status, destination_sector, called_at, created_at, registry_id")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("destination_sector", "triagem")
        .eq("status", "active")
        .in("triage_status", ["aguardando_chamada", "chamado", "em_triagem"])
        .order("created_at", { ascending: true });

      if (error) throw error;
      setPatients((data as TriagePatient[]) || []);
    } catch (err) {
      console.error("Error loading triage queue:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCall = async (patient: TriagePatient) => {
    setCallingId(patient.id);
    try {
      const { error } = await supabase
        .from("patient_encounters")
        .update({
          triage_status: "chamado",
          called_at: new Date().toISOString(),
          called_by: user?.id,
        } as any)
        .eq("id", patient.id);

      if (error) throw error;
      toast.success(`${patient.patient_name} chamado no painel!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao chamar paciente");
    } finally {
      setCallingId(null);
    }
  };

  const handleStartTriage = async (patient: TriagePatient) => {
    try {
      const { error } = await supabase
        .from("patient_encounters")
        .update({ triage_status: "em_triagem" } as any)
        .eq("id", patient.id);

      if (error) throw error;
      toast.success(`Triagem iniciada para ${patient.patient_name}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao iniciar triagem");
    }
  };

  const handleCompleteTriage = async (patient: TriagePatient) => {
    try {
      const { error } = await supabase
        .from("patient_encounters")
        .update({ triage_status: "triado" } as any)
        .eq("id", patient.id);

      if (error) throw error;
      toast.success(`Triagem concluída para ${patient.patient_name}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao concluir triagem");
    }
  };

  const openTVScreen = () => {
    window.open("/triagem-tv", "_blank", "noopener,noreferrer");
  };

  const waiting = patients.filter(p => p.triage_status === "aguardando_chamada");
  const called = patients.filter(p => p.triage_status === "chamado");
  const inTriage = patients.filter(p => p.triage_status === "em_triagem");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aguardando_chamada": return "bg-amber-500";
      case "chamado": return "bg-blue-500 animate-pulse";
      case "em_triagem": return "bg-purple-500";
      default: return "bg-muted";
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-screen bg-background">
        <header className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Fila de Triagem</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary">
              {waiting.length} aguardando · {called.length} chamados · {inTriage.length} em triagem
            </Badge>
            <Button variant="outline" size="sm" onClick={openTVScreen}>
              <Monitor className="h-4 w-4 mr-1" />
              Abrir Painel TV
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Called patients */}
            {called.length > 0 && (
              <Card className="border-blue-300 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-600">
                    <Volume2 className="h-4 w-4 animate-pulse" />
                    Chamados ({called.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {called.map(patient => (
                    <div key={patient.id} className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{patient.patient_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{patient.encounter_code}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleCall(patient)}>
                          <Bell className="h-3 w-3 mr-1" />
                          Chamar novamente
                        </Button>
                        <Button size="sm" onClick={() => handleStartTriage(patient)}>
                          <Play className="h-3 w-3 mr-1" />
                          Iniciar Triagem
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* In triage */}
            {inTriage.length > 0 && (
              <Card className="border-purple-300 dark:border-purple-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-purple-600">
                    <Play className="h-4 w-4" />
                    Em Triagem ({inTriage.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {inTriage.map(patient => (
                    <div key={patient.id} className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <User className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{patient.patient_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{patient.encounter_code}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleCompleteTriage(patient)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Concluir Triagem
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Waiting */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Aguardando Chamada ({waiting.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {waiting.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhum paciente aguardando triagem</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-2">
                      {waiting.map((patient, index) => (
                        <motion.div
                          key={patient.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-sm font-bold text-amber-600">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{patient.patient_name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-mono">{patient.encounter_code}</span>
                                <span>·</span>
                                <span>{format(new Date(patient.created_at), "HH:mm", { locale: ptBR })}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleCall(patient)}
                            disabled={callingId === patient.id}
                          >
                            {callingId === patient.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Bell className="h-3 w-3 mr-1" />
                            )}
                            Chamar
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default TriageQueuePage;
