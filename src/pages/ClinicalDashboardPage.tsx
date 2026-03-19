import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { ClinicalNavTabs } from "@/components/ClinicalNavTabs";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useHospital } from "@/contexts/HospitalContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  BedDouble,
  CalendarClock,
  ClipboardList,
  ArrowRightLeft,
  Activity,
  Users,
  TrendingUp,
  Clock,
  Stethoscope,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface AlertItem {
  id: string;
  type: "discharge" | "device" | "transfer" | "culture" | "bed_request" | "critical";
  title: string;
  description: string;
  patient?: string;
  bed?: string;
  sector?: string;
  timestamp?: string;
  severity: "critical" | "warning" | "info";
}

interface OccupancyData {
  sector: string;
  label: string;
  total: number;
  occupied: number;
}

const SECTOR_LABELS: Record<string, string> = {
  red: "UTI 1",
  yellow: "UTI 2",
  blue: "UCI 1",
  outside: "UCI 2",
};

function DashboardHeader({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <header
      className="border-b border-white/10 bg-gradient-to-r from-[#0a1628] via-[#0f2847] to-[#1a3a5c] backdrop-blur-xl fixed top-0 right-0 z-50 shadow-lg transition-[left] duration-200 ease-linear"
      style={{
        left: isMobile ? 0 : (state === "collapsed" ? "var(--sidebar-width-icon)" : "var(--sidebar-width)"),
      }}
    >
      {children}
    </header>
  );
}

const ClinicalDashboardPage = () => {
  const { user } = useAuth();
  const { currentDepartment } = useDepartment();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [activeSector, setActiveSector] = useState<string>(() => {
    return localStorage.getItem("selected_sector") || "red";
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyData[]>([]);
  const [pendingBedRequests, setPendingBedRequests] = useState(0);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSectorChange = (sector: string) => {
    setActiveSector(sector);
    localStorage.setItem("selected_sector", sector);
  };

  const fetchDashboardData = async () => {
    try {
      const hospitalUnitId = localStorage.getItem("selected_hospital_unit");
      const stateId = localStorage.getItem("selected_state");
      if (!hospitalUnitId || !stateId) return;

      // Parallel fetches
      const [patientsRes, bedRequestsRes, movementsRes] = await Promise.all([
        supabase
          .from("patients")
          .select("*")
          .eq("hospital_unit_id", hospitalUnitId)
          .eq("state_id", stateId)
          .eq("department", currentDepartment),
        supabase
          .from("bed_allocation_requests")
          .select("*")
          .eq("hospital_unit_id", hospitalUnitId)
          .eq("state_id", stateId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("patient_movements")
          .select("*")
          .eq("hospital_unit_id", hospitalUnitId)
          .eq("state_id", stateId)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const allPatients = patientsRes.data || [];
      const bedRequests = bedRequestsRes.data || [];
      const allMovements = movementsRes.data || [];

      // Filter by active sector
      const patients = allPatients.filter((p) => p.sector === activeSector);
      const movements = allMovements.filter((m) => m.patient_sector === activeSector);

      // Build occupancy data for active sector only
      const sectorPatients = patients;
      const occupied = sectorPatients.filter((p) => p.name && p.name.trim() !== "").length;
      const occData: OccupancyData[] = [{
        sector: activeSector,
        label: SECTOR_LABELS[activeSector] || activeSector,
        total: sectorPatients.length,
        occupied,
      }];

      // Also build global occupancy for the overview cards
      const sectors = ["red", "yellow", "blue", "outside"];
      const allOccData: OccupancyData[] = sectors.map((s) => {
        const sp = allPatients.filter((p) => p.sector === s);
        const occ = sp.filter((p) => p.name && p.name.trim() !== "").length;
        return { sector: s, label: SECTOR_LABELS[s] || s, total: sp.length, occupied: occ };
      });
      setOccupancy(allOccData);
      setPendingBedRequests(bedRequests.length);
      setRecentMovements(movements);

      // Build alerts
      const newAlerts: AlertItem[] = [];

      // Discharge predictions
      patients.forEach((p) => {
        if (p.uti_discharge_prediction && p.name && p.name.trim() !== "") {
          newAlerts.push({
            id: `discharge-${p.id}`,
            type: "discharge",
            title: "Previsão de alta",
            description: p.uti_discharge_prediction,
            patient: p.name,
            bed: p.bed_number,
            sector: SECTOR_LABELS[p.sector] || p.sector,
            severity: "info",
          });
        }
      });

      // Patients with empty devices (pending fill)
      patients.forEach((p) => {
        if (p.name && p.name.trim() !== "" && currentDepartment === "UTI" && (!p.uti_devices || p.uti_devices.trim() === "")) {
          newAlerts.push({
            id: `device-${p.id}`,
            type: "device",
            title: "Dispositivo pendente",
            description: `Dispositivos não preenchidos para ${p.name}`,
            patient: p.name,
            bed: p.bed_number,
            sector: SECTOR_LABELS[p.sector] || p.sector,
            severity: "warning",
          });
        }
      });

      // Pending cultures
      patients.forEach((p) => {
        if (p.name && p.name.trim() !== "" && p.uti_cultures_antibiotics && p.uti_cultures_antibiotics.toLowerCase().includes("pendente")) {
          newAlerts.push({
            id: `culture-${p.id}`,
            type: "culture",
            title: "Resultado de cultura pendente",
            description: `Cultura pendente para ${p.name}`,
            patient: p.name,
            bed: p.bed_number,
            sector: SECTOR_LABELS[p.sector] || p.sector,
            severity: "warning",
          });
        }
      });

      // Critical patients
      patients.forEach((p) => {
        if (p.clinical_status === "gravíssimo" && p.name && p.name.trim() !== "") {
          newAlerts.push({
            id: `critical-${p.id}`,
            type: "critical",
            title: "Paciente gravíssimo",
            description: `${p.name} em estado gravíssimo`,
            patient: p.name,
            bed: p.bed_number,
            sector: SECTOR_LABELS[p.sector] || p.sector,
            severity: "critical",
          });
        }
      });

      // Allocation status: transfer
      patients.forEach((p) => {
        if (p.allocation_status === "aguardando_transferencia" && p.name && p.name.trim() !== "") {
          newAlerts.push({
            id: `transfer-${p.id}`,
            type: "transfer",
            title: "Aguardando transferência",
            description: `${p.name} aguardando transferência`,
            patient: p.name,
            bed: p.bed_number,
            sector: SECTOR_LABELS[p.sector] || p.sector,
            severity: "warning",
          });
        }
      });

      // Bed requests
      bedRequests.forEach((req) => {
        newAlerts.push({
          id: `bed-${req.id}`,
          type: "bed_request",
          title: "Solicitação de leito",
          description: `Pedido para ${req.requested_sector}${req.requesting_doctor_name ? ` por ${req.requesting_doctor_name}` : ""}`,
          timestamp: req.created_at,
          severity: "info",
        });
      });

      // Sort: critical first, then warning, then info
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      newAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      setAlerts(newAlerts);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentDepartment, activeSector]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Sector-specific occupancy
  const activeSectorOcc = occupancy.find(s => s.sector === activeSector);
  const totalOccupied = activeSectorOcc?.occupied ?? 0;
  const totalBeds = activeSectorOcc?.total ?? 0;
  const occupancyRate = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;

  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const warningAlerts = alerts.filter((a) => a.severity === "warning");
  const infoAlerts = alerts.filter((a) => a.severity === "info");

  const severityConfig = {
    critical: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-600 dark:text-red-400", icon: AlertTriangle, badge: "bg-red-500/20 text-red-700 dark:text-red-300" },
    warning: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-600 dark:text-amber-400", icon: Clock, badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
    info: { bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-600 dark:text-blue-400", icon: CalendarClock, badge: "bg-blue-500/20 text-blue-700 dark:text-blue-300" },
  };

  const movementTypeLabels: Record<string, { label: string; color: string }> = {
    admission: { label: "Admissão", color: "text-emerald-600 dark:text-emerald-400" },
    discharge: { label: "Alta", color: "text-blue-600 dark:text-blue-400" },
    transfer: { label: "Transferência", color: "text-amber-600 dark:text-amber-400" },
    death: { label: "Óbito", color: "text-red-600 dark:text-red-400" },
  };

  return (
    <MainLayout>
      <DashboardHeader>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <SidebarTrigger className="flex-shrink-0 text-white hover:text-white hover:bg-white/25 border-white/30 hover:border-white/50 data-[state=open]:bg-white/25 transition-all duration-200" />
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-white/90 whitespace-nowrap">Socorrão I</span>
                <span className="text-white/30 text-xs">/</span>
                <Select value={activeSector} onValueChange={handleSectorChange}>
                  <SelectTrigger className="h-7 w-auto gap-1 bg-white/10 border-white/20 text-xs text-white font-medium px-2.5 focus:ring-0 focus:ring-offset-0 hover:bg-white/20 transition-colors [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-white/60 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SECTOR_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="text-xs font-medium">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-white/30 text-xs">/</span>
                <ClinicalNavTabs variant="dark" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40 transition-all duration-200"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </div>
          </div>
        </div>
      </DashboardHeader>

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 pt-[70px] sm:pt-[70px]">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-[60vh]"
            >
              <div className="flex flex-col items-center gap-3">
                <Activity className="h-8 w-8 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">Carregando painel clínico...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-5"
            >
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card className="border-border/60 bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground tracking-wider">Ocupação {SECTOR_LABELS[activeSector]}</p>
                          <p className="text-2xl font-bold text-foreground mt-1">{occupancyRate}%</p>
                          <p className="text-[10px] text-muted-foreground">{totalOccupied}/{totalBeds} leitos</p>
                        </div>
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center",
                          occupancyRate > 85 ? "bg-red-500/15" : occupancyRate > 60 ? "bg-amber-500/15" : "bg-emerald-500/15"
                        )}>
                          <BedDouble className={cn(
                            "h-5 w-5",
                            occupancyRate > 85 ? "text-red-500" : occupancyRate > 60 ? "text-amber-500" : "text-emerald-500"
                          )} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <Card className="border-border/60 bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground tracking-wider">Alertas</p>
                          <p className="text-2xl font-bold text-foreground mt-1">{criticalAlerts.length + warningAlerts.length}</p>
                          <p className="text-[10px] text-muted-foreground">{criticalAlerts.length} crítico(s)</p>
                        </div>
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center",
                          criticalAlerts.length > 0 ? "bg-red-500/15" : "bg-emerald-500/15"
                        )}>
                          <AlertTriangle className={cn(
                            "h-5 w-5",
                            criticalAlerts.length > 0 ? "text-red-500" : "text-emerald-500"
                          )} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card className="border-border/60 bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground tracking-wider">Solicitações</p>
                          <p className="text-2xl font-bold text-foreground mt-1">{pendingBedRequests}</p>
                          <p className="text-[10px] text-muted-foreground">pedido(s) de leito</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/10">
                          <ClipboardList className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <Card className="border-border/60 bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground tracking-wider">Movimentações</p>
                          <p className="text-2xl font-bold text-foreground mt-1">{recentMovements.length}</p>
                          <p className="text-[10px] text-muted-foreground">últimas registradas</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-violet-500/15">
                          <ArrowRightLeft className="h-5 w-5 text-violet-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Occupancy by Sector */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
                  <CardHeader className="pb-3 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Ocupação por setor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {occupancy.map((s) => {
                        const rate = s.total > 0 ? Math.round((s.occupied / s.total) * 100) : 0;
                        return (
                          <div key={s.sector} className={cn("flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-all", s.sector === activeSector ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30" : "bg-muted/30 border-border/40 opacity-60")} onClick={() => handleSectorChange(s.sector)}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">{s.label}</span>
                              <span className={cn(
                                "text-xs font-bold",
                                rate > 85 ? "text-red-500" : rate > 60 ? "text-amber-500" : "text-emerald-500"
                              )}>{rate}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${rate}%` }}
                                transition={{ duration: 0.8, delay: 0.4 }}
                                className={cn(
                                  "h-full rounded-full transition-colors",
                                  rate > 85 ? "bg-red-500" : rate > 60 ? "bg-amber-500" : "bg-emerald-500"
                                )}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{s.occupied} de {s.total} leitos</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Two-column layout: Alerts + Movements */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Clinical Alerts */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="lg:col-span-2"
                >
                  <Card className="border-border/60 bg-card/80 backdrop-blur-sm h-full">
                    <CardHeader className="pb-3 pt-4 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-primary" />
                          Alertas clínicos e solicitações
                        </CardTitle>
                        {alerts.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                            {alerts.length}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {alerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                            <Activity className="h-6 w-6 text-emerald-500" />
                          </div>
                          <p className="text-sm font-medium text-foreground">Tudo sob controle</p>
                          <p className="text-xs text-muted-foreground mt-1">Nenhum alerta clínico no momento</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                          {alerts.slice(0, 12).map((alert, i) => {
                            const config = severityConfig[alert.severity];
                            const Icon = config.icon;
                            return (
                              <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 + i * 0.05 }}
                                className={cn(
                                  "flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-accent/30",
                                  config.bg
                                )}
                              >
                                <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.text)} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn("text-xs font-semibold", config.text)}>{alert.title}</span>
                                    {alert.bed && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                        {alert.bed}
                                      </Badge>
                                    )}
                                    {alert.sector && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                        {alert.sector}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{alert.description}</p>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Recent Movements */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card className="border-border/60 bg-card/80 backdrop-blur-sm h-full">
                    <CardHeader className="pb-3 pt-4 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-primary" />
                        Atividade recente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {recentMovements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Users className="h-6 w-6 text-muted-foreground/50 mb-2" />
                          <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                          {recentMovements.map((mov, i) => {
                            const typeConfig = movementTypeLabels[mov.movement_type] || { label: mov.movement_type, color: "text-foreground" };
                            return (
                              <motion.div
                                key={mov.id}
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.45 + i * 0.05 }}
                                className="flex items-start gap-2.5 py-2 px-2.5 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/40"
                              >
                                <div className="h-2 w-2 rounded-full bg-primary/60 mt-1.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("text-[11px] font-semibold", typeConfig.color)}>
                                      {typeConfig.label}
                                    </span>
                                    {mov.patient_bed && (
                                      <span className="text-[9px] text-muted-foreground">• {mov.patient_bed}</span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-foreground/80 truncate">{mov.patient_name}</p>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">
                                    {formatDistanceToNow(new Date(mov.created_at), { addSuffix: true, locale: ptBR })}
                                  </p>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Quick access buttons */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-wrap gap-2"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/mapa")}
                  className="text-xs gap-1.5 h-8"
                >
                  <BedDouble className="h-3.5 w-3.5" />
                  Abrir mapa de leitos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/painel-clinico")}
                  className="text-xs gap-1.5 h-8"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Abrir painel clínico
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </MainLayout>
  );
};

export default ClinicalDashboardPage;
