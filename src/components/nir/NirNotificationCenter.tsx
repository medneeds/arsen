import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, AlertTriangle, Activity, Clock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";

export interface NirNotification {
  id: string;
  level: "critical" | "warning" | "info";
  category: "ocupacao" | "sala_vermelha" | "tempo" | "sisreg" | "centro_cirurgico";
  title: string;
  message: string;
  ts: number;
}

interface Props {
  metrics: any;
}

const RED_SECTOR_KEYS = ["sala_vermelha"];

function buildNotifications(metrics: any): NirNotification[] {
  const list: NirNotification[] = [];
  const now = Date.now();

  // Sala Vermelha — qualquer ocupação ≥ 80% dispara crítico
  metrics.occupancyBySector
    ?.filter((s: any) => RED_SECTOR_KEYS.some((k) => s.sector?.toLowerCase().includes(k)))
    .forEach((s: any) => {
      if (s.rate >= 80) {
        list.push({
          id: `red-${s.sector}`,
          level: s.rate >= 100 ? "critical" : "warning",
          category: "sala_vermelha",
          title: s.rate >= 100 ? "Sala Vermelha LOTADA" : "Sala Vermelha em saturação",
          message: `${sectorLabelFromCode(s.sector)} a ${Math.round(s.rate)}% de ocupação (${s.occupied}/${s.total}).`,
          ts: now,
        });
      }
    });

  // Demais setores ≥ 80%
  metrics.occupancyBySector
    ?.filter((s: any) => s.rate >= 80 && !RED_SECTOR_KEYS.some((k) => s.sector?.toLowerCase().includes(k)))
    .forEach((s: any) => {
      list.push({
        id: `sat-${s.sector}`,
        level: s.rate >= 95 ? "critical" : "warning",
        category: "ocupacao",
        title: `Setor saturado — ${sectorLabelFromCode(s.sector)}`,
        message: `Ocupação ${Math.round(s.rate)}% (${s.occupied}/${s.total}). Avaliar redirecionamento.`,
        ts: now,
      });
    });

  // Pacientes parados +24h aguardando vaga
  if (metrics.stuck24h?.length) {
    list.push({
      id: "stuck-24h",
      level: "warning",
      category: "tempo",
      title: `${metrics.stuck24h.length} paciente(s) aguardando vaga há +24h`,
      message: "Revisar fluxo de regulação e prioridades.",
      ts: now,
    });
  }

  // SISREG sem resposta +12h
  if (metrics.sisregStuck?.length) {
    list.push({
      id: "sisreg",
      level: "warning",
      category: "sisreg",
      title: `${metrics.sisregStuck.length} solicitação(ões) SISREG sem resposta +12h`,
      message: "Acionar central de regulação externa.",
      ts: now,
    });
  }

  // Higienização longa
  if (metrics.longCleaning?.length) {
    list.push({
      id: "cleaning",
      level: "info",
      category: "tempo",
      title: `${metrics.longCleaning.length} leito(s) em higienização há +4h`,
      message: "Verificar processo de hotelaria/limpeza.",
      ts: now,
    });
  }

  return list;
}

const LEVEL_STYLES: Record<NirNotification["level"], string> = {
  critical: "border-red-500/40 bg-red-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  info: "border-blue-500/40 bg-blue-500/5",
};

const CATEGORY_ICON: Record<NirNotification["category"], any> = {
  sala_vermelha: AlertTriangle,
  ocupacao: Activity,
  tempo: Clock,
  sisreg: Globe,
  centro_cirurgico: Activity,
};

export function NirNotificationCenter({ metrics }: Props) {
  const notifications = useMemo(() => buildNotifications(metrics), [metrics]);
  const criticalCount = notifications.filter((n) => n.level === "critical").length;
  const warningCount = notifications.filter((n) => n.level === "warning").length;
  const total = notifications.length;

  // Toast/popup automático para notificações novas críticas
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
        <Button variant="outline" size="sm" className="relative h-9 gap-2">
          <Bell className={cn("h-4 w-4", criticalCount > 0 && "text-red-500 animate-pulse")} />
          <span className="text-xs font-medium">Notificações</span>
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
            <p className="text-sm font-semibold">Central de Notificações NIR</p>
            <p className="text-[11px] text-muted-foreground">
              {criticalCount} crítica(s) · {warningCount} alerta(s)
            </p>
          </div>
        </div>
        <ScrollArea className="max-h-96">
          {total === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhuma notificação ativa.
              <p className="text-[11px] mt-1">Tudo dentro das metas.</p>
            </div>
          ) : (
            <ul className="p-2 space-y-1.5">
              {notifications.map((n) => {
                const Icon = CATEGORY_ICON[n.category];
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "rounded-md border p-2.5 flex gap-2.5",
                      LEVEL_STYLES[n.level],
                    )}
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
