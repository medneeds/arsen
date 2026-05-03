import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, AlertTriangle, Activity, Pill, FileText, TrendingDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface GestorMetricsForNotifications {
  occupancyRate: number;
  bedStats: { total: number; occupied: number; vacant: number; doorPatients: number };
  criticalAlerts: any[]; // alertas clínicos críticos do painel
  pendingRequests: number;
  prescriptionStats?: { total: number; validated: number };
}

interface Props {
  data: GestorMetricsForNotifications;
}

interface GNotification {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  message: string;
  icon: any;
}

const LEVEL_STYLES: Record<GNotification["level"], string> = {
  critical: "border-red-500/40 bg-red-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  info: "border-blue-500/40 bg-blue-500/5",
};

function buildNotifications(d: GestorMetricsForNotifications): GNotification[] {
  const list: GNotification[] = [];

  if (d.occupancyRate >= 95) {
    list.push({
      id: "occ-95",
      level: "critical",
      title: "Hospital próximo da capacidade máxima",
      message: `Ocupação de ${d.occupancyRate}% (${d.bedStats.occupied}/${d.bedStats.total} leitos). Avaliar redirecionamento e altas prioritárias.`,
      icon: TrendingDown,
    });
  } else if (d.occupancyRate >= 85) {
    list.push({
      id: "occ-85",
      level: "warning",
      title: "Ocupação elevada",
      message: `Hospital a ${d.occupancyRate}% de ocupação. Monitorar fluxo de altas.`,
      icon: Activity,
    });
  }

  if (d.bedStats.doorPatients > 0) {
    list.push({
      id: "door-patients",
      level: d.bedStats.doorPatients >= 5 ? "critical" : "warning",
      title: `${d.bedStats.doorPatients} paciente(s) em "porta"`,
      message: "Pacientes aguardando vaga. Acionar regulação interna (NIR).",
      icon: Users,
    });
  }

  const critical = d.criticalAlerts?.filter((a) => a.severity === "critical") || [];
  if (critical.length > 0) {
    list.push({
      id: "clin-critical",
      level: "critical",
      title: `${critical.length} alerta(s) clínico(s) crítico(s)`,
      message: "Pacientes graves identificados nos setores. Verificar painel de alertas.",
      icon: AlertTriangle,
    });
  }

  if (d.pendingRequests >= 10) {
    list.push({
      id: "pending-req",
      level: "warning",
      title: `${d.pendingRequests} solicitações pendentes`,
      message: "Volume elevado de solicitações aguardando alocação.",
      icon: FileText,
    });
  }

  if (d.prescriptionStats && d.prescriptionStats.total > 0) {
    const unvalidated = d.prescriptionStats.total - d.prescriptionStats.validated;
    const ratio = unvalidated / d.prescriptionStats.total;
    if (ratio > 0.5 && unvalidated >= 5) {
      list.push({
        id: "presc-validation",
        level: "info",
        title: `${unvalidated} prescrição(ões) sem validação farmacêutica`,
        message: "Acompanhar produtividade da farmácia clínica.",
        icon: Pill,
      });
    }
  }

  return list;
}

export function GestorNotificationCenter({ data }: Props) {
  const notifications = useMemo(() => buildNotifications(data), [data]);
  const criticalCount = notifications.filter((n) => n.level === "critical").length;
  const total = notifications.length;
  const seenRef = useRef<Set<string>>(new Set());
  const [autoOpen, setAutoOpen] = useState(false);

  useEffect(() => {
    const newCriticals = notifications.filter(
      (n) => n.level === "critical" && !seenRef.current.has(n.id),
    );
    if (newCriticals.length > 0) {
      newCriticals.forEach((n) => {
        seenRef.current.add(n.id);
        toast.error(n.title, { description: n.message, duration: 8000 });
      });
      setAutoOpen(true);
    }
  }, [notifications]);

  return (
    <Popover open={autoOpen || undefined} onOpenChange={(o) => { if (!o) setAutoOpen(false); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-9 gap-2 bg-white/95 text-foreground border-border hover:bg-white hover:text-foreground dark:bg-background dark:text-foreground">
          <Bell className={cn("h-4 w-4", criticalCount > 0 && "text-red-500 animate-pulse")} />
          <span className="text-xs font-medium hidden md:inline">Notificações</span>
          {total > 0 && (
            <Badge
              variant={criticalCount > 0 ? "destructive" : "secondary"}
              className="h-5 px-1.5 text-[10px]"
            >
              {total}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div>
            <p className="text-sm font-semibold">Notificações do Gestor</p>
            <p className="text-[11px] text-muted-foreground">
              {criticalCount} crítica(s) · {total - criticalCount} alerta(s)
            </p>
          </div>
        </div>
        <ScrollArea className="max-h-96">
          {total === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhuma notificação ativa.
              <p className="text-[11px] mt-1">Operação dentro das metas.</p>
            </div>
          ) : (
            <ul className="p-2 space-y-1.5">
              {notifications.map((n) => {
                const Icon = n.icon;
                return (
                  <li
                    key={n.id}
                    className={cn("rounded-md border p-2.5 flex gap-2.5", LEVEL_STYLES[n.level])}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        n.level === "critical" && "text-red-500",
                        n.level === "warning" && "text-amber-500",
                        n.level === "info" && "text-blue-500",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
