import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, TrendingUp, UserX, Skull, ArrowLeftRight, FileText, RotateCcw, CalendarIcon, Filter, Loader2 } from "lucide-react";
import { ViewPatientSnapshotDialog } from "@/components/ViewPatientSnapshotDialog";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useHospital } from "@/contexts/HospitalContext";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PatientMovement {
  id: string;
  patient_name: string;
  patient_bed: string | null;
  patient_sector: string | null;
  movement_type: "ALTA" | "ÓBITO" | "TRANSFERÊNCIA";
  destination: string | null;
  notes: string | null;
  responsible_doctor: string | null;
  created_at: string;
  patient_snapshot: any;
}

const movementConfig = {
  ALTA: {
    label: "Alta",
    icon: TrendingUp,
    color: "bg-green-500/10 text-green-600 border-green-500/30",
    badgeColor: "bg-green-500 hover:bg-green-600"
  },
  ÓBITO: {
    label: "Óbito",
    icon: Skull,
    color: "bg-red-500/10 text-red-600 border-red-500/30",
    badgeColor: "bg-red-500 hover:bg-red-600"
  },
  TRANSFERÊNCIA: {
    label: "Transferência",
    icon: ArrowLeftRight,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    badgeColor: "bg-blue-500 hover:bg-blue-600"
  }
};

export default function MovementsPage() {
  const [movements, setMovements] = useState<PatientMovement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<PatientMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  
  // Temporary filter states (before applying)
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(undefined);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(undefined);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  
  // Applied filter states
  const [appliedStartDate, setAppliedStartDate] = useState<Date | undefined>(undefined);
  const [appliedEndDate, setAppliedEndDate] = useState<Date | undefined>(undefined);
  
  const { toast } = useToast();
  const { currentDepartment } = useDepartment();
  const { currentState, currentHospital } = useHospital();

  useEffect(() => {
    fetchMovements();

    // Realtime subscription filtered by department
    const channel = supabase
      .channel('patient_movements_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_movements',
          filter: `department=eq.${currentDepartment}`
        },
        () => {
          fetchMovements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDepartment]);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, activeTab, appliedStartDate, appliedEndDate, movements]);

  const fetchMovements = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_movements')
        .select('*')
        .eq('department', currentDepartment)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements((data as PatientMovement[]) || []);
    } catch (error) {
      console.error('Error fetching movements:', error);
      toast({
        title: "Erro ao carregar movimentações",
        description: "Não foi possível carregar o histórico de movimentações.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const now = new Date();
    
    switch (period) {
      case "today":
        setTempStartDate(now);
        setTempEndDate(now);
        break;
      case "week":
        setTempStartDate(subDays(now, 7));
        setTempEndDate(now);
        break;
      case "month":
        setTempStartDate(subMonths(now, 1));
        setTempEndDate(now);
        break;
      case "quarter":
        setTempStartDate(subMonths(now, 3));
        setTempEndDate(now);
        break;
      case "all":
        setTempStartDate(undefined);
        setTempEndDate(undefined);
        break;
    }
  };

  const handleApplyFilters = () => {
    setAppliedStartDate(tempStartDate);
    setAppliedEndDate(tempEndDate);
    toast({
      title: "Filtros aplicados",
      description: "A visualização foi atualizada com os filtros selecionados.",
    });
  };

  const handleClearFilters = () => {
    setTempStartDate(undefined);
    setTempEndDate(undefined);
    setAppliedStartDate(undefined);
    setAppliedEndDate(undefined);
    setSelectedPeriod("all");
    setSearchTerm("");
    setPendingSearch("");
    toast({
      title: "Filtros limpos",
      description: "Exibindo todas as movimentações.",
    });
  };

  const handleSearch = () => {
    setIsSearching(true);
    setSearchTerm(pendingSearch);
    setTimeout(() => setIsSearching(false), 400);
  };

  const applyFilters = () => {
    let filtered = [...movements];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(movement =>
        movement.patient_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Tab filter
    if (activeTab !== "all") {
      filtered = filtered.filter(movement => movement.movement_type === activeTab);
    }

    // Date filter using APPLIED dates
    if (appliedStartDate || appliedEndDate) {
      filtered = filtered.filter(movement => {
        const movementDate = new Date(movement.created_at);
        if (appliedStartDate && appliedEndDate) {
          return movementDate >= startOfDay(appliedStartDate) && movementDate <= endOfDay(appliedEndDate);
        } else if (appliedStartDate) {
          return movementDate >= startOfDay(appliedStartDate);
        } else if (appliedEndDate) {
          return movementDate <= endOfDay(appliedEndDate);
        }
        return true;
      });
    }

    setFilteredMovements(filtered);
  };

  const getMovementCounts = () => {
    // Apply search and date filters to get base filtered list
    let baseFiltered = [...movements];

    // Search filter
    if (searchTerm) {
      baseFiltered = baseFiltered.filter(movement =>
        movement.patient_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Date filter
    if (appliedStartDate || appliedEndDate) {
      baseFiltered = baseFiltered.filter(movement => {
        const movementDate = new Date(movement.created_at);
        if (appliedStartDate && appliedEndDate) {
          return movementDate >= startOfDay(appliedStartDate) && movementDate <= endOfDay(appliedEndDate);
        } else if (appliedStartDate) {
          return movementDate >= startOfDay(appliedStartDate);
        } else if (appliedEndDate) {
          return movementDate <= endOfDay(appliedEndDate);
        }
        return true;
      });
    }

    return {
      all: baseFiltered.length,
      ALTA: baseFiltered.filter(m => m.movement_type === "ALTA").length,
      ÓBITO: baseFiltered.filter(m => m.movement_type === "ÓBITO").length,
      TRANSFERÊNCIA: baseFiltered.filter(m => m.movement_type === "TRANSFERÊNCIA").length,
    };
  };

  const counts = getMovementCounts();

  const handleReallocatePatient = async (movement: PatientMovement) => {
    if (!movement.patient_snapshot) {
      toast({
        title: "Erro ao realocar",
        description: "Dados do paciente não encontrados.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!currentHospital || !currentState) {
        throw new Error('Hospital unit and state must be selected');
      }

      const snapshot = movement.patient_snapshot;
      
      // Recreate patient in patients table with original data
      const { error: insertError } = await supabase
        .from('patients')
        .insert({
          name: snapshot.name,
          age: snapshot.age,
          bed_number: snapshot.bedNumber,
          sector: snapshot.sector,
          diagnoses: snapshot.diagnoses?.join('\n') || null,
          medical_history: snapshot.medicalHistory?.join('\n') || null,
          relevant_exams: snapshot.relevantExams?.join('\n') || null,
          pendencies: snapshot.pendencies?.join('\n') || null,
          highlighted_pendencies: snapshot.highlightedPendencies || [],
          schedule: snapshot.schedule?.join('\n') || null,
          admission_history: snapshot.admissionHistory || null,
          admission_date: snapshot.admissionDate || new Date().toISOString(),
          department: currentDepartment,
          state_id: currentState.id,
          hospital_unit_id: currentHospital.id,
        });

      if (insertError) throw insertError;

      toast({
        title: "Paciente realocado com sucesso",
        description: `${snapshot.name} foi realocado de volta ao setor ${snapshot.sector}.`,
      });

      fetchMovements();
    } catch (error) {
      console.error('Error reallocating patient:', error);
      toast({
        title: "Erro ao realocar paciente",
        description: "Não foi possível realocar o paciente. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Histórico de Movimentações</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registro de altas, óbitos e transferências de pacientes
            </p>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do paciente..."
                value={pendingSearch}
                onChange={(e) => {
                  setPendingSearch(e.target.value);
                  if (!e.target.value.trim()) {
                    setSearchTerm("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pendingSearch.trim()) {
                    handleSearch();
                  }
                }}
                className="pl-10 uppercase"
              />
            </div>
            {pendingSearch.trim() && (
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                className="h-10 px-5 gap-2 shrink-0 shadow-sm transition-all duration-200"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="text-sm font-medium uppercase">Buscar</span>
              </Button>
            )}
          </div>

          {/* Date Filters */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <h3 className="font-semibold uppercase text-sm">Filtros de Data</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Period Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedPeriod === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePeriodChange("all")}
                  className="uppercase text-xs"
                >
                  Todos
                </Button>
                <Button
                  variant={selectedPeriod === "today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePeriodChange("today")}
                  className="uppercase text-xs"
                >
                  Hoje
                </Button>
                <Button
                  variant={selectedPeriod === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePeriodChange("week")}
                  className="uppercase text-xs"
                >
                  Última Semana
                </Button>
                <Button
                  variant={selectedPeriod === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePeriodChange("month")}
                  className="uppercase text-xs"
                >
                  Último Mês
                </Button>
                <Button
                  variant={selectedPeriod === "quarter" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePeriodChange("quarter")}
                  className="uppercase text-xs"
                >
                  Último Trimestre
                </Button>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium uppercase">Data Inicial</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal uppercase",
                          !tempStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {tempStartDate ? format(tempStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={tempStartDate}
                        onSelect={(date) => {
                          setTempStartDate(date);
                          setSelectedPeriod("custom");
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium uppercase">Data Final</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal uppercase",
                          !tempEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {tempEndDate ? format(tempEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={tempEndDate}
                        onSelect={(date) => {
                          setTempEndDate(date);
                          setSelectedPeriod("custom");
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleApplyFilters}
                  className="flex-1 uppercase font-semibold"
                  size="lg"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Aplicar Filtro
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="flex-1 uppercase"
                  size="lg"
                >
                  Limpar Filtro
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">
                Todas <Badge variant="secondary" className="ml-2">{counts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="ALTA">
                Altas <Badge variant="secondary" className="ml-2">{counts.ALTA}</Badge>
              </TabsTrigger>
              <TabsTrigger value="ÓBITO">
                Óbitos <Badge variant="secondary" className="ml-2">{counts.ÓBITO}</Badge>
              </TabsTrigger>
              <TabsTrigger value="TRANSFERÊNCIA">
                Transferências <Badge variant="secondary" className="ml-2">{counts.TRANSFERÊNCIA}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6 space-y-4">
              {isLoading ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Carregando movimentações...
                  </CardContent>
                </Card>
              ) : filteredMovements.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {searchTerm 
                      ? "Nenhuma movimentação encontrada para esta busca."
                      : "Nenhuma movimentação registrada ainda."}
                  </CardContent>
                </Card>
              ) : (
                filteredMovements.map((movement) => {
                  const config = movementConfig[movement.movement_type];
                  const Icon = config.icon;

                  return (
                    <Card key={movement.id} className={`border ${config.color}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${config.color} border`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg font-semibold">
                                {movement.patient_name}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                {movement.patient_bed && (
                                  <span>Leito: {movement.patient_bed}</span>
                                )}
                                {movement.patient_sector && (
                                  <>
                                    {movement.patient_bed && <span>•</span>}
                                    <span>Setor: {movement.patient_sector}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={config.badgeColor}>
                              {config.label}
                            </Badge>
                            {movement.patient_snapshot && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPatient(movement.patient_snapshot);
                                  setIsSnapshotDialogOpen(true);
                                }}
                                className="h-7 gap-1.5"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Ver Dados
                              </Button>
                            )}
                            {movement.movement_type === "TRANSFERÊNCIA" && movement.patient_snapshot && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReallocatePatient(movement)}
                                className="h-7 gap-1.5"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Realocar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {movement.destination && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[120px]">Destino:</span>
                            <span className="text-sm font-medium uppercase">{movement.destination}</span>
                          </div>
                        )}
                        {movement.responsible_doctor && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[120px]">Médico Resp.:</span>
                            <span className="text-sm font-medium uppercase">{movement.responsible_doctor}</span>
                          </div>
                        )}
                        {movement.notes && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[120px]">Observações:</span>
                            <span className="text-sm uppercase">{movement.notes}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                          <span>Registrado em:</span>
                          <span className="font-medium">
                            {format(new Date(movement.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ScrollToTopButton />

      <ViewPatientSnapshotDialog
        patient={selectedPatient}
        isOpen={isSnapshotDialogOpen}
        onClose={() => {
          setIsSnapshotDialogOpen(false);
          setSelectedPatient(null);
        }}
      />
    </>
  );
}
