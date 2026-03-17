import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import {
  Bed, Activity, AlertTriangle, Users, TrendingUp, Clock,
  Pill, FileText, BarChart3, ArrowUpDown, HeartPulse, Thermometer,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BedStats {
  total: number;
  occupied: number;
  vacant: number;
  doorPatients: number;
  bySector: Record<string, { total: number; occupied: number }>;
}

interface CriticalAlert {
  id: string;
  patientName: string;
  bed: string;
  sector: string;
  type: string;
  detail: string;
  severity: "critical" | "warning" | "info";
}

export default function GestorPanelPage() {
  const { currentHospital: selectedUnit } = useHospital();
  const [bedStats, setBedStats] = useState<BedStats>({ total: 0, occupied: 0, vacant: 0, doorPatients: 0, bySector: {} });
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [medicationCount, setMedicationCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!selectedUnit) return;
    setLoading(true);

    try {
      // Fetch patients for bed stats
      const { data: patients } = await supabase
        .from("patients")
        .select("id, name, bed_number, sector, is_vacant, is_door_patient, clinical_status, diagnoses, relevant_exams")
        .eq("hospital_unit_id", selectedUnit.id);

      if (patients) {
        const occupied = patients.filter(p => !p.is_vacant && p.name?.trim());
        const vacant = patients.filter(p => p.is_vacant || !p.name?.trim());
        const doorPatients = patients.filter(p => p.is_door_patient);

        const bySector: Record<string, { total: number; occupied: number }> = {};
        patients.forEach(p => {
          if (!bySector[p.sector]) bySector[p.sector] = { total: 0, occupied: 0 };
          bySector[p.sector].total++;
          if (!p.is_vacant && p.name?.trim()) bySector[p.sector].occupied++;
        });

        setBedStats({
          total: patients.length,
          occupied: occupied.length,
          vacant: vacant.length,
          doorPatients: doorPatients.length,
          bySector,
        });

        // Generate critical alerts from patient data
        const alerts: CriticalAlert[] = [];
        occupied.forEach(p => {
          if (p.clinical_status === "gravíssimo" || p.clinical_status === "crítico") {
            alerts.push({
              id: p.id,
              patientName: p.name,
              bed: p.bed_number,
              sector: p.sector,
              type: "Estado Clínico",
              detail: `Paciente em estado ${p.clinical_status}`,
              severity: "critical",
            });
          }
          if (p.relevant_exams && (
            p.relevant_exams.toLowerCase().includes("crítico") ||
            p.relevant_exams.toLowerCase().includes("urgente") ||
            p.relevant_exams.toLowerCase().includes("alerta")
          )) {
            alerts.push({
              id: p.id + "-exam",
              patientName: p.name,
              bed: p.bed_number,
              sector: p.sector,
              type: "Exame Crítico",
              detail: "Resultado de exame com valor crítico identificado",
              severity: "warning",
            });
          }
        });
        setCriticalAlerts(alerts);
      }

      // Fetch recent movements
      const { data: movements } = await supabase
        .from("patient_movements")
        .select("*")
        .eq("hospital_unit_id", selectedUnit.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setRecentMovements(movements || []);

      // Fetch medication catalog count
      const { count } = await supabase
        .from("medication_catalog")
        .select("id", { count: "exact", head: true });
      setMedicationCount(count || 0);

      // Fetch pending bed allocation requests
      const { count: pendCount } = await supabase
        .from("bed_allocation_requests")
        .select("id", { count: "exact", head: true })
        .eq("hospital_unit_id", selectedUnit.id)
        .eq("status", "pending");
      setPendingRequests(pendCount || 0);

    } catch (err) {
      console.error("Error fetching gestor data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedUnit]);

  const occupancyRate = bedStats.total > 0 ? Math.round((bedStats.occupied / bedStats.total) * 100) : 0;

  const kpiCards = [
    {
      title: "Taxa de Ocupação",
      value: `${occupancyRate}%`,
      subtitle: `${bedStats.occupied}/${bedStats.total} leitos`,
      icon: Bed,
      color: occupancyRate > 85 ? "text-destructive" : occupancyRate > 70 ? "text-amber-500" : "text-emerald-500",
      bg: occupancyRate > 85 ? "bg-destructive/10" : occupancyRate > 70 ? "bg-amber-500/10" : "bg-emerald-500/10",
    },
    {
      title: "Leitos Vagos",
      value: bedStats.vacant.toString(),
      subtitle: "Disponíveis para alocação",
      icon: ArrowUpDown,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Pacientes Porta",
      value: bedStats.doorPatients.toString(),
      subtitle: "Aguardando leito",
      icon: Users,
      color: bedStats.doorPatients > 0 ? "text-amber-500" : "text-muted-foreground",
      bg: bedStats.doorPatients > 0 ? "bg-amber-500/10" : "bg-muted/30",
    },
    {
      title: "Alertas Críticos",
      value: criticalAlerts.filter(a => a.severity === "critical").length.toString(),
      subtitle: `${criticalAlerts.length} alertas totais`,
      icon: AlertTriangle,
      color: criticalAlerts.length > 0 ? "text-destructive" : "text-muted-foreground",
      bg: criticalAlerts.length > 0 ? "bg-destructive/10" : "bg-muted/30",
    },
    {
      title: "Solicitações Pendentes",
      value: pendingRequests.toString(),
      subtitle: "Alocação de leitos",
      icon: Clock,
      color: pendingRequests > 0 ? "text-amber-500" : "text-muted-foreground",
      bg: pendingRequests > 0 ? "bg-amber-500/10" : "bg-muted/30",
    },
    {
      title: "Catálogo de Medicações",
      value: medicationCount.toString(),
      subtitle: "Itens cadastrados",
      icon: Pill,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
  ];

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-amber-500" />
              </div>
              Painel do Gestor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão consolidada — {selectedUnit?.name || "Unidade"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchData(); toast.success("Dados atualizados"); }}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((kpi, i) => (
            <motion.div
              key={kpi.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-2", kpi.bg)}>
                    <kpi.icon className={cn("h-4 w-4", kpi.color)} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{kpi.title}</p>
                  <p className="text-[9px] text-muted-foreground/70 mt-0.5">{kpi.subtitle}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="leitos" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="leitos" className="gap-1.5 text-xs"><Bed className="h-3.5 w-3.5" />Gestão de Leitos</TabsTrigger>
            <TabsTrigger value="alertas" className="gap-1.5 text-xs"><AlertTriangle className="h-3.5 w-3.5" />Alertas Críticos</TabsTrigger>
            <TabsTrigger value="movimentacoes" className="gap-1.5 text-xs"><ArrowUpDown className="h-3.5 w-3.5" />Movimentações</TabsTrigger>
          </TabsList>

          {/* Bed Management Tab */}
          <TabsContent value="leitos" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(bedStats.bySector).map(([sector, stats]) => {
                const sectorOccupancy = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
                return (
                  <Card key={sector} className="border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <div className={cn(
                            "h-3 w-3 rounded-full",
                            sector.includes("VERM") || sector.includes("red") ? "bg-red-500" :
                            sector.includes("AMAR") || sector.includes("yellow") ? "bg-amber-500" :
                            sector.includes("AZUL") || sector.includes("blue") ? "bg-blue-500" :
                            "bg-muted-foreground"
                          )} />
                          {sector}
                        </span>
                        <Badge variant={sectorOccupancy > 85 ? "destructive" : "secondary"} className="text-[10px]">
                          {sectorOccupancy}%
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-2xl font-bold">{stats.occupied}</span>
                        <span className="text-sm text-muted-foreground">/ {stats.total} leitos</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            sectorOccupancy > 85 ? "bg-destructive" : sectorOccupancy > 70 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${sectorOccupancy}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {stats.total - stats.occupied} vago{stats.total - stats.occupied !== 1 ? "s" : ""}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
              {Object.keys(bedStats.bySector).length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Bed className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum dado de leitos disponível</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Critical Alerts Tab */}
          <TabsContent value="alertas" className="space-y-3">
            {criticalAlerts.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center">
                  <HeartPulse className="h-10 w-10 mx-auto mb-3 text-emerald-500 opacity-50" />
                  <p className="text-sm text-muted-foreground">Nenhum alerta crítico no momento</p>
                </CardContent>
              </Card>
            ) : (
              criticalAlerts.map((alert, i) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={cn(
                    "border-l-4",
                    alert.severity === "critical" ? "border-l-destructive" : "border-l-amber-500"
                  )}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                        alert.severity === "critical" ? "bg-destructive/10" : "bg-amber-500/10"
                      )}>
                        <AlertTriangle className={cn(
                          "h-4 w-4",
                          alert.severity === "critical" ? "text-destructive" : "text-amber-500"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate">{alert.patientName}</p>
                          <Badge variant="outline" className="text-[9px] flex-shrink-0">
                            {alert.sector} · Leito {alert.bed}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{alert.type}: {alert.detail}</p>
                      </div>
                      <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"} className="text-[9px] uppercase flex-shrink-0">
                        {alert.severity === "critical" ? "Crítico" : "Atenção"}
                      </Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </TabsContent>

          {/* Movements Tab */}
          <TabsContent value="movimentacoes" className="space-y-3">
            {recentMovements.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center">
                  <ArrowUpDown className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm text-muted-foreground">Nenhuma movimentação recente</p>
                </CardContent>
              </Card>
            ) : (
              recentMovements.map((mov, i) => (
                <motion.div
                  key={mov.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="border-border/50">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        mov.movement_type === "ALTA" ? "bg-emerald-500/10" :
                        mov.movement_type === "ÓBITO" ? "bg-destructive/10" :
                        "bg-primary/10"
                      )}>
                        <Activity className={cn(
                          "h-4 w-4",
                          mov.movement_type === "ALTA" ? "text-emerald-500" :
                          mov.movement_type === "ÓBITO" ? "text-destructive" :
                          "text-primary"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{mov.patient_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {mov.movement_type} {mov.destination ? `→ ${mov.destination}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[9px] flex-shrink-0">
                        {mov.patient_sector} · {mov.patient_bed}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground flex-shrink-0">
                        {new Date(mov.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}