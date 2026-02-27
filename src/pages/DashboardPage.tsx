import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import { 
  CalendarIcon, Download, Users, FileText, UserCheck, 
  UserX, ArrowRightLeft, TrendingUp, Activity, BarChart3, Filter, X, Loader2
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDepartment } from "@/contexts/DepartmentContext";
import { PrintableDashboard } from "@/components/PrintableDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";

const COLORS = ['#ef4444', '#eab308', '#3b82f6', '#6b7280', '#8b5cf6', '#ec4899'];

// Sector color mapping based on hospital identity
const SECTOR_COLORS: Record<string, string> = {
  'Cuidados Especiais': '#ef4444',     // Red
  'Observação Amarela': '#eab308',      // Yellow
  'Observação Azul': '#3b82f6',         // Blue
  'Fora das Alas': '#6b7280',           // Gray
};

const DashboardPage = () => {
  const { currentDepartment } = useDepartment();
  const [isLoading, setIsLoading] = useState(false);
  
  // Temporary filter states (before applying)
  const [tempDateRange, setTempDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [tempSelectedDepartment, setTempSelectedDepartment] = useState<string>(currentDepartment);
  
  // Applied filter states
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [selectedDepartment, setSelectedDepartment] = useState<string>(currentDepartment);
  const [comparisonPeriod, setComparisonPeriod] = useState<string>("previous");
  
  // Update department filter when current department changes
  useEffect(() => {
    setTempSelectedDepartment(currentDepartment);
    setSelectedDepartment(currentDepartment);
    
    // Show toast instructing user to apply filters
    toast({
      title: "SETOR ALTERADO",
      description: "Clique em 'APLICAR FILTRO' para visualizar os dados do novo setor",
      duration: 4000,
    });
  }, [currentDepartment]);
  
  // KPIs State
  const [kpis, setKpis] = useState({
    internmentRequests: 0,
    activePatients: 0,
    discharges: 0,
    deaths: 0,
    transfers: 0,
    comparison: {
      internmentRequests: 0,
      activePatients: 0,
      discharges: 0,
      deaths: 0,
      transfers: 0
    }
  });

  // Charts Data State
  const [movementsOverTime, setMovementsOverTime] = useState<any[]>([]);
  const [sectorDistribution, setSectorDistribution] = useState<any[]>([]);
  const [movementsByType, setMovementsByType] = useState<any[]>([]);
  const [bedOccupancy, setBedOccupancy] = useState<any[]>([]);
  const [requestsByDestination, setRequestsByDestination] = useState<any[]>([]);

  const departments = [
    { value: "all", label: "Todos os Setores" },
    { value: "URGÊNCIA E EMERGÊNCIA ADULTO", label: "Urgência e Emergência Adulto" },
    { value: "URGÊNCIA E EMERGÊNCIA PEDIÁTRICA", label: "Urgência e Emergência Pediátrica" },
    { value: "UTI", label: "UTI" },
    { value: "POSTO INTERNAÇÃO", label: "Posto Internação" }
  ];

  useEffect(() => {
    fetchDashboardData();
    
    // Real-time subscriptions
    const movementsChannel = supabase
      .channel('dashboard-movements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_movements' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    const requestsChannel = supabase
      .channel('dashboard-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internment_requests' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    const patientsChannel = supabase
      .channel('dashboard-patients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(movementsChannel);
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(patientsChannel);
    };
  }, [dateRange, selectedDepartment, comparisonPeriod]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchKPIs(),
        fetchMovementsOverTime(),
        fetchSectorDistribution(),
        fetchMovementsByType(),
        fetchBedOccupancy(),
        fetchRequestsByDestination()
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKPIs = async () => {
    const departmentFilter = selectedDepartment === "all" ? {} : { department: selectedDepartment };
    
    // Current period
    const { data: requests } = await supabase
      .from('internment_requests')
      .select('*')
      .match(departmentFilter)
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    const { data: patients } = await supabase
      .from('patients')
      .select('*')
      .match(departmentFilter);

    const { data: discharges } = await supabase
      .from('patient_movements')
      .select('*')
      .match(departmentFilter)
      .eq('movement_type', 'ALTA')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    const { data: deaths } = await supabase
      .from('patient_movements')
      .select('*')
      .match(departmentFilter)
      .eq('movement_type', 'ÓBITO')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    const { data: transfers } = await supabase
      .from('patient_movements')
      .select('*')
      .match(departmentFilter)
      .eq('movement_type', 'TRANSFERÊNCIA')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    // Comparison period
    const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    const comparisonFrom = subDays(dateRange.from, daysDiff);
    const comparisonTo = dateRange.from;

    const { data: compRequests } = await supabase
      .from('internment_requests')
      .select('*')
      .match(departmentFilter)
      .gte('created_at', comparisonFrom.toISOString())
      .lte('created_at', comparisonTo.toISOString());

    const { data: compDischarges } = await supabase
      .from('patient_movements')
      .select('*')
      .match(departmentFilter)
      .eq('movement_type', 'ALTA')
      .gte('created_at', comparisonFrom.toISOString())
      .lte('created_at', comparisonTo.toISOString());

    const { data: compDeaths } = await supabase
      .from('patient_movements')
      .select('*')
      .match(departmentFilter)
      .eq('movement_type', 'ÓBITO')
      .gte('created_at', comparisonFrom.toISOString())
      .lte('created_at', comparisonTo.toISOString());

    const { data: compTransfers } = await supabase
      .from('patient_movements')
      .select('*')
      .match(departmentFilter)
      .eq('movement_type', 'TRANSFERÊNCIA')
      .gte('created_at', comparisonFrom.toISOString())
      .lte('created_at', comparisonTo.toISOString());

    setKpis({
      internmentRequests: requests?.length || 0,
      activePatients: patients?.length || 0,
      discharges: discharges?.length || 0,
      deaths: deaths?.length || 0,
      transfers: transfers?.length || 0,
      comparison: {
        internmentRequests: compRequests?.length || 0,
        activePatients: 0,
        discharges: compDischarges?.length || 0,
        deaths: compDeaths?.length || 0,
        transfers: compTransfers?.length || 0
      }
    });
  };

  const fetchMovementsOverTime = async () => {
    const departmentFilter = selectedDepartment === "all" ? {} : { department: selectedDepartment };
    
    const { data } = await supabase
      .from('patient_movements')
      .select('*')
      .match(departmentFilter)
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())
      .order('created_at');

    if (data) {
      const groupedByDate = data.reduce((acc: any, movement: any) => {
        const date = format(new Date(movement.created_at), 'dd/MM', { locale: ptBR });
        if (!acc[date]) {
          acc[date] = { date, ALTA: 0, ÓBITO: 0, TRANSFERÊNCIA: 0 };
        }
        acc[date][movement.movement_type]++;
        return acc;
      }, {});

      setMovementsOverTime(Object.values(groupedByDate));
    }
  };

  const fetchSectorDistribution = async () => {
    const departmentFilter = selectedDepartment === "all" ? {} : { department: selectedDepartment };
    
    const { data } = await supabase
      .from('patients')
      .select('sector')
      .match(departmentFilter);

    if (data) {
      const sectorCounts = data.reduce((acc: any, patient: any) => {
        const sector = patient.sector === 'red' ? 'Cuidados Especiais' :
                      patient.sector === 'yellow' ? 'Observação Amarela' :
                      patient.sector === 'blue' ? 'Observação Azul' : 'Fora das Alas';
        acc[sector] = (acc[sector] || 0) + 1;
        return acc;
      }, {});

      setSectorDistribution(
        Object.entries(sectorCounts).map(([name, value]) => ({ name, value }))
      );
    }
  };

  const fetchMovementsByType = async () => {
    const departmentFilter = selectedDepartment === "all" ? {} : { department: selectedDepartment };
    
    const { data } = await supabase
      .from('patient_movements')
      .select('movement_type')
      .match(departmentFilter)
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (data) {
      const typeCounts = data.reduce((acc: any, movement: any) => {
        acc[movement.movement_type] = (acc[movement.movement_type] || 0) + 1;
        return acc;
      }, {});

      setMovementsByType(
        Object.entries(typeCounts).map(([type, count]) => ({ type, count }))
      );
    }
  };

  const fetchBedOccupancy = async () => {
    const departmentFilter = selectedDepartment === "all" ? {} : { department: selectedDepartment };
    
    const { data } = await supabase
      .from('patients')
      .select('sector, created_at')
      .match(departmentFilter)
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())
      .order('created_at');

    if (data) {
      const groupedByDate = data.reduce((acc: any, patient: any) => {
        const date = format(new Date(patient.created_at), 'dd/MM', { locale: ptBR });
        if (!acc[date]) {
          acc[date] = { date, ocupação: 0 };
        }
        acc[date].ocupação++;
        return acc;
      }, {});

      setBedOccupancy(Object.values(groupedByDate));
    }
  };

  const fetchRequestsByDestination = async () => {
    const departmentFilter = selectedDepartment === "all" ? {} : { department: selectedDepartment };
    
    const { data } = await supabase
      .from('patient_movements')
      .select('destination')
      .match(departmentFilter)
      .eq('movement_type', 'TRANSFERÊNCIA')
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString());

    if (data) {
      // Filter out pediatric destinations when in adult department and vice versa
      const filteredData = data.filter((movement: any) => {
        const dest = movement.destination || '';
        
        // If in adult department, exclude pediatric destinations
        if (selectedDepartment === 'URGÊNCIA E EMERGÊNCIA ADULTO') {
          return !dest.toLowerCase().includes('pediátr');
        }
        
        // If in pediatric department, exclude adult destinations
        if (selectedDepartment === 'URGÊNCIA E EMERGÊNCIA PEDIÁTRICA') {
          return !dest.toLowerCase().includes('adulto');
        }
        
        return true;
      });
      
      const destCounts = filteredData.reduce((acc: any, movement: any) => {
        const dest = movement.destination || 'Não especificado';
        acc[dest] = (acc[dest] || 0) + 1;
        return acc;
      }, {});

      setRequestsByDestination(
        Object.entries(destCounts).map(([destination, count]) => ({ destination, count }))
      );
    }
  };

  const handleExportPDF = () => {
    toast({
      title: "GERANDO PDF",
      description: "Preparando documento para impressão...",
    });
    
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleExportExcel = () => {
    toast({
      title: "EXPORTAÇÃO EM DESENVOLVIMENTO",
      description: "Funcionalidade de exportação Excel será implementada em breve",
    });
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const handleApplyFilters = () => {
    setDateRange(tempDateRange);
    setSelectedDepartment(tempSelectedDepartment);
    toast({
      title: "FILTROS APLICADOS COM SUCESSO",
      description: "Dashboard atualizado com os novos filtros",
    });
  };

  const handleClearFilters = () => {
    const defaultDateRange = {
      from: subDays(new Date(), 30),
      to: new Date()
    };
    setTempDateRange(defaultDateRange);
    setDateRange(defaultDateRange);
    setTempSelectedDepartment(currentDepartment);
    setSelectedDepartment(currentDepartment);
    toast({
      title: "FILTROS LIMPOS",
      description: "Filtros restaurados aos valores padrão",
    });
  };

  const KPICard = ({ 
    title, 
    value, 
    icon: Icon, 
    comparison 
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    comparison: number;
  }) => {
    const change = calculatePercentageChange(value, comparison);
    const isPositive = change >= 0;

    return (
      <Card className="relative overflow-hidden border-border/50 shadow-lg backdrop-blur-sm bg-gradient-card hover:shadow-glow transition-all duration-500 hover:scale-105 group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-foreground/70 group-hover:text-foreground transition-colors">
            {title}
          </CardTitle>
          <div className="rounded-lg bg-primary/10 p-2 group-hover:bg-primary/20 transition-colors duration-300">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            {value}
          </div>
          <div className={cn(
            "text-xs flex items-center gap-1.5 font-medium px-2 py-1 rounded-full w-fit",
            isPositive 
              ? "bg-green-500/10 text-green-700 dark:text-green-400" 
              : "bg-red-500/10 text-red-700 dark:text-red-400"
          )}>
            <TrendingUp className={cn("h-3.5 w-3.5", !isPositive && "rotate-180")} />
            <span>{Math.abs(change)}%</span>
            <span className="text-muted-foreground">vs anterior</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 animate-fade-in relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card shadow-glow animate-scale-in">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">ATUALIZANDO DASHBOARD</p>
              <p className="text-sm text-muted-foreground">Carregando dados do setor...</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="container mx-auto p-6 space-y-8 dashboard-screen-content">{/* Changed: Added dashboard-screen-content class */}
        {/* Header com gradiente */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-8 shadow-glow animate-scale-in">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,white)]" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-white hover:bg-white/20 transition-colors" />
                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight uppercase text-white">
                  Dashboard de Gestão
                </h1>
              </div>
              <p className="text-white/80 text-sm ml-[100px]">
                {selectedDepartment === "URGÊNCIA E EMERGÊNCIA ADULTO" && "Visão geral da Urgência e Emergência Adulto"}
                {selectedDepartment === "URGÊNCIA E EMERGÊNCIA PEDIÁTRICA" && "Visão geral da Urgência e Emergência Pediátrica"}
                {selectedDepartment === "UTI" && "Visão geral da Unidade de Terapia Intensiva"}
                {selectedDepartment === "POSTO INTERNAÇÃO" && "Visão geral do Posto de Internação"}
                {selectedDepartment === "all" && "Visão geral de todos os setores"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleExportPDF} 
                variant="secondary" 
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-105"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <Button 
                onClick={handleExportExcel} 
                variant="secondary" 
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-105"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Filters com estilo aprimorado */}
        <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-card/95 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-semibold uppercase tracking-wide text-foreground/80 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    Setor
                  </label>
                  <Select value={tempSelectedDepartment} onValueChange={setTempSelectedDepartment}>
                    <SelectTrigger className="border-border/50 focus:ring-primary/30 transition-all duration-300 hover:border-primary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.value} value={dept.value}>
                          {dept.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold uppercase tracking-wide text-foreground/80 flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                    Data Inicial
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left font-normal border-border/50 hover:border-primary/50 transition-all duration-300"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {format(tempDateRange.from, "PPP", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={tempDateRange.from}
                        onSelect={(date) => date && setTempDateRange({ ...tempDateRange, from: date })}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold uppercase tracking-wide text-foreground/80 flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                    Data Final
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left font-normal border-border/50 hover:border-primary/50 transition-all duration-300"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {format(tempDateRange.to, "PPP", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={tempDateRange.to}
                        onSelect={(date) => date && setTempDateRange({ ...tempDateRange, to: date })}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Filter Action Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="uppercase gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all duration-300"
                >
                  <X className="h-4 w-4" />
                  Limpar Filtro
                </Button>
                <Button
                  onClick={handleApplyFilters}
                  className="uppercase gap-2 bg-gradient-primary hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  <Filter className="h-4 w-4" />
                  Aplicar Filtro
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs com animações escalonadas */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <KPICard 
              title="Pedidos de Internação" 
              value={kpis.internmentRequests} 
              icon={FileText}
              comparison={kpis.comparison.internmentRequests}
            />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <KPICard 
              title="Pacientes Ativos" 
              value={kpis.activePatients} 
              icon={Users}
              comparison={kpis.comparison.activePatients}
            />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <KPICard 
              title="Altas" 
              value={kpis.discharges} 
              icon={UserCheck}
              comparison={kpis.comparison.discharges}
            />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <KPICard 
              title="Óbitos" 
              value={kpis.deaths} 
              icon={UserX}
              comparison={kpis.comparison.deaths}
            />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <KPICard 
              title="Transferências" 
              value={kpis.transfers} 
              icon={ArrowRightLeft}
              comparison={kpis.comparison.transfers}
            />
          </div>
        </div>

        {/* Charts Grid com estilo premium */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Movements Over Time */}
          <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-gradient-card hover:shadow-glow transition-all duration-500 animate-fade-in" style={{ animationDelay: '0.7s' }}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="uppercase text-lg font-bold">Movimentações ao Longo do Tempo</CardTitle>
              </div>
              <CardDescription className="text-sm">Altas, Óbitos e Transferências por período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={movementsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }}
                    iconType="circle"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ALTA" 
                    stroke="#22c55e" 
                    strokeWidth={3} 
                    dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ÓBITO" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="TRANSFERÊNCIA" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sector Distribution */}
          <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-gradient-card hover:shadow-glow transition-all duration-500 animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="uppercase text-lg font-bold">Distribuição por Setor</CardTitle>
              </div>
              <CardDescription className="text-sm">Pacientes ativos distribuídos por ala</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sectorDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={{
                      stroke: 'hsl(var(--muted-foreground))',
                      strokeWidth: 1
                    }}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  >
                    {sectorDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={SECTOR_COLORS[entry.name] || COLORS[index % COLORS.length]}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Movements by Type */}
          <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-gradient-card hover:shadow-glow transition-all duration-500 animate-fade-in" style={{ animationDelay: '0.9s' }}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="uppercase text-lg font-bold">Movimentações por Tipo</CardTitle>
              </div>
              <CardDescription className="text-sm">Comparação de volumes entre categorias</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={movementsByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="type" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    cursor={{ fill: 'hsl(var(--accent))' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[8, 8, 0, 0]}
                    className="hover:opacity-80 transition-opacity"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bed Occupancy */}
          <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-gradient-card hover:shadow-glow transition-all duration-500 animate-fade-in" style={{ animationDelay: '1s' }}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="uppercase text-lg font-bold">Ocupação de Leitos</CardTitle>
              </div>
              <CardDescription className="text-sm">Evolução temporal da ocupação</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={bedOccupancy}>
                  <defs>
                    <linearGradient id="colorOcupacao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ocupação" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    fill="url(#colorOcupacao)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Requests by Destination - Full width */}
        <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-gradient-card hover:shadow-glow transition-all duration-500 animate-fade-in" style={{ animationDelay: '1.1s' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="uppercase text-lg font-bold">Transferências por Destino</CardTitle>
            </div>
            <CardDescription className="text-sm">Principais destinos de transferência de pacientes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={requestsByDestination} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  type="number" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  dataKey="destination" 
                  type="category" 
                  width={180}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  cursor={{ fill: 'hsl(var(--accent))' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))"
                  radius={[0, 8, 8, 0]}
                  className="hover:opacity-80 transition-opacity"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Printable Dashboard - Hidden on screen, visible in print */}
      <PrintableDashboard
        department={selectedDepartment}
        dateRange={dateRange}
        kpis={{
          requests: {
            value: kpis.internmentRequests,
            previousValue: kpis.comparison.internmentRequests,
            change: calculatePercentageChange(kpis.internmentRequests, kpis.comparison.internmentRequests)
          },
          activePatients: {
            value: kpis.activePatients,
            previousValue: kpis.comparison.activePatients,
            change: calculatePercentageChange(kpis.activePatients, kpis.comparison.activePatients)
          },
          discharges: {
            value: kpis.discharges,
            previousValue: kpis.comparison.discharges,
            change: calculatePercentageChange(kpis.discharges, kpis.comparison.discharges)
          },
          deaths: {
            value: kpis.deaths,
            previousValue: kpis.comparison.deaths,
            change: calculatePercentageChange(kpis.deaths, kpis.comparison.deaths)
          },
          transfers: {
            value: kpis.transfers,
            previousValue: kpis.comparison.transfers,
            change: calculatePercentageChange(kpis.transfers, kpis.comparison.transfers)
          }
        }}
        movementsOverTime={movementsOverTime}
        sectorDistribution={sectorDistribution}
        movementsByType={movementsByType}
        bedOccupancy={bedOccupancy}
        requestsByDestination={requestsByDestination}
      />
    </div>
  );
};

export default DashboardPage;
