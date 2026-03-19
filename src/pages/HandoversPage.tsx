import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { RegisterHandoverDialog } from "@/components/RegisterHandoverDialog";
import { useDepartment } from "@/contexts/DepartmentContext";
import { formatAgeDisplay } from "@/utils/ageDisplay";
import { 
  ClipboardList, 
  Clock, 
  Users, 
  Bed, 
  ChevronDown, 
  Trash2,
  LogOut,
  Loader2,
  Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Patient } from "@/types/patient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SnapshotData {
  timestamp: string;
  patients: Patient[];
  sectors: {
    red: number;
    yellow: number;
    blue: number;
    outside: number;
  };
}

interface HandoverRecord {
  id: string;
  created_at: string;
  created_by: string | null;
  snapshot_data: SnapshotData;
  notes: string | null;
  total_patients: number;
  occupied_beds: number;
  shift_type: string | null;
  handover_from: string | null;
  handover_to: string | null;
  handover_datetime: string;
}

export default function HandoversPage() {
  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [handoverToDelete, setHandoverToDelete] = useState<string | null>(null);
  const [handoverDialogOpen, setHandoverDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { currentDepartment } = useDepartment();

  // Mock patients data for dialog - you can replace with actual data
  const mockPatients: Patient[] = [];

  useEffect(() => {
    fetchHandovers();
  }, [currentDepartment]);

  const fetchHandovers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('shift_handovers')
        .select('*')
        .eq('department', currentDepartment)
        .order('handover_datetime', { ascending: false });

      if (error) throw error;

      setHandovers((data || []) as unknown as HandoverRecord[]);
    } catch (error) {
      console.error("Erro ao buscar passagens:", error);
      toast({
        title: "Erro ao carregar passagens",
        description: "Não foi possível carregar o histórico de passagens",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!handoverToDelete) return;

    try {
      const { error } = await (supabase as any)
        .from('shift_handovers')
        .delete()
        .eq('id', handoverToDelete);

      if (error) throw error;

      toast({
        title: "Passagem deletada",
        description: "Registro removido com sucesso",
      });

      fetchHandovers();
    } catch (error) {
      console.error("Erro ao deletar passagem:", error);
      toast({
        title: "Erro ao deletar passagem",
        description: "Não foi possível remover o registro",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setHandoverToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatHandoverDatetime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSectorLabel = (sector: string) => {
    const labels: Record<string, string> = {
      red: "UTI 1",
      yellow: "UTI 2",
      blue: "UCI 1",
      outside: "UCI 2",
    };
    return labels[sector] || sector;
  };

  const getShiftTypeBadgeColor = (shiftType: string | null) => {
    if (shiftType === "MATUTINO") return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    if (shiftType === "VESPERTINO") return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    if (shiftType === "NOTURNO") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    return "bg-muted text-muted-foreground";
  };

  return (
    <>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
            <ClipboardList className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground uppercase tracking-tight">
              PASSAGENS DE PLANTÃO
            </h1>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">
              Histórico de Registros
            </p>
          </div>
        </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : handovers.length === 0 ? (
              <Alert>
                <Calendar className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma passagem de plantão registrada ainda. Registre a primeira passagem no mapa de pacientes.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {handovers.map((handover) => (
                  <Collapsible key={handover.id}>
                    <Card className="bg-gradient-card border-border/50 shadow-sm hover:shadow-md transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-base font-bold uppercase">
                                {formatHandoverDatetime(handover.handover_datetime)}
                              </CardTitle>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {handover.shift_type && (
                                <Badge className={getShiftTypeBadgeColor(handover.shift_type)}>
                                  {handover.shift_type}
                                </Badge>
                              )}
                              {handover.handover_from && (
                                <Badge variant="outline" className="uppercase text-xs">
                                  DE: {handover.handover_from}
                                </Badge>
                              )}
                              {handover.handover_to && (
                                <Badge variant="outline" className="uppercase text-xs">
                                  PARA: {handover.handover_to}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Bed className="h-3.5 w-3.5" />
                                <span className="uppercase">{handover.occupied_beds} OCUPADOS</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                <span className="uppercase">{handover.total_patients} TOTAL</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-1">
                                <span className="text-xs uppercase">Detalhes</span>
                                <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setHandoverToDelete(handover.id);
                                setDeleteDialogOpen(true);
                              }}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CollapsibleContent>
                        <CardContent className="space-y-4 pt-0">
                          {handover.notes && (
                            <div className="p-3 bg-muted/50 rounded-lg">
                              <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                                Observações
                              </p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">
                                {handover.notes}
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {Object.entries(handover.snapshot_data.sectors).map(([sector, count]) => (
                              <div key={sector} className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                                  {getSectorLabel(sector)}
                                </p>
                                <p className="text-lg font-bold text-foreground">{count}</p>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs uppercase font-semibold text-muted-foreground">
                              Pacientes Registrados ({handover.snapshot_data.patients.filter(p => p.name.trim() !== "").length})
                            </p>
                            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                              {handover.snapshot_data.patients
                                .filter(p => p.name.trim() !== "")
                                .map((patient) => (
                                  <div
                                    key={patient.id}
                                    className="p-2 bg-muted/20 rounded text-xs space-y-1"
                                  >
                                    <div className="font-semibold">
                                      LEITO {patient.bedNumber} - {patient.name}, {formatAgeDisplay(patient.age)}
                                    </div>
                                    {patient.diagnoses.length > 0 && (
                                      <div className="text-muted-foreground">
                                        {patient.diagnoses.join(" • ")}
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>CONFIRMAR EXCLUSÃO</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este registro de passagem de plantão?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              DELETAR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Register Handover Dialog */}
      <RegisterHandoverDialog
        open={handoverDialogOpen}
        onOpenChange={setHandoverDialogOpen}
        patients={mockPatients}
      />
    </>
  );
}
