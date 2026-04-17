import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BedDouble, Activity, Lock, Clock, AlertTriangle, LogOut,
  RefreshCw, TrendingUp, Stethoscope,
} from "lucide-react";
import type { NirMetrics } from "@/hooks/useNirMetrics";

interface Props {
  metrics: NirMetrics;
}

const occupancyTone = (rate: number) => {
  if (rate >= 95) return { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "CRÍTICO" };
  if (rate >= 80) return { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "ALERTA" };
  return { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "OK" };
};

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  badge?: string;
}

const toneClasses: Record<string, { bg: string; border: string; text: string }> = {
  neutral: { bg: "bg-card", border: "border-border", text: "text-foreground" },
  success: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
  warning: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
  danger: { bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-600 dark:text-red-400" },
  info: { bg: "bg-blue-500/5", border: "border-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
};

function KpiCard({ icon: Icon, label, value, hint, tone = "neutral", badge }: KpiCardProps) {
  const t = toneClasses[tone];
  return (
    <Card className={cn("border", t.border, t.bg)}>
      <CardContent className="py-3 px-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={cn("h-3.5 w-3.5", t.text)} />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">{label}</p>
            </div>
            <p className={cn("text-2xl font-bold leading-tight", t.text)}>{value}</p>
            {hint && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{hint}</p>}
          </div>
          {badge && (
            <Badge variant="outline" className={cn("text-[9px] h-4 shrink-0", t.text, t.border)}>
              {badge}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function NirKpiStrip({ metrics }: Props) {
  const tone = occupancyTone(metrics.occupancyRate);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
      <KpiCard
        icon={Activity}
        label="Ocupação geral"
        value={`${metrics.occupancyRate}%`}
        hint={`${metrics.occupied}/${metrics.total} leitos`}
        tone={metrics.occupancyRate >= 95 ? "danger" : metrics.occupancyRate >= 80 ? "warning" : "success"}
        badge={tone.label}
      />
      <KpiCard
        icon={BedDouble}
        label="Vagos UTI/UCI"
        value={metrics.vacantByType.uti}
        hint={`${metrics.vacantByType.enfermaria} enf · ${metrics.vacantByType.emergencia} emerg`}
        tone={metrics.vacantByType.uti === 0 ? "danger" : metrics.vacantByType.uti < 3 ? "warning" : "success"}
      />
      <KpiCard
        icon={LogOut}
        label="Alta dada"
        value={metrics.dischargeReady}
        hint="aguardando liberação adm."
        tone={metrics.dischargeReady > 0 ? "warning" : "neutral"}
      />
      <KpiCard
        icon={Lock}
        label="Bloqueados"
        value={metrics.blocked}
        hint={metrics.blockedAvgHours > 0 ? `média ${metrics.blockedAvgHours}h bloqueado` : "—"}
        tone={metrics.blocked > 5 ? "danger" : metrics.blocked > 0 ? "warning" : "neutral"}
      />
      <KpiCard
        icon={RefreshCw}
        label="Higienização"
        value={metrics.cleaning}
        hint={metrics.longCleaning.length > 0 ? `${metrics.longCleaning.length} há +4h` : "fluxo normal"}
        tone={metrics.longCleaning.length > 0 ? "warning" : "neutral"}
      />
      <KpiCard
        icon={Clock}
        label="Pendentes"
        value={metrics.pending + metrics.inAnalysis}
        hint={`${metrics.pending} pend · ${metrics.inAnalysis} análise`}
        tone={metrics.pending + metrics.inAnalysis > 10 ? "warning" : "info"}
      />
      <KpiCard
        icon={AlertTriangle}
        label="Represados +24h"
        value={metrics.stuck24h.length}
        hint={metrics.stuck48hUti.length > 0 ? `${metrics.stuck48hUti.length} UTI +48h` : "dentro do SLA"}
        tone={metrics.stuck24h.length > 0 ? "danger" : "success"}
      />
      <KpiCard
        icon={TrendingUp}
        label="Tempo médio NIR"
        value={metrics.avgResponseMin > 0 ? `${metrics.avgResponseMin}min` : "—"}
        hint={`aprovação ${metrics.approvalRate}%`}
        tone="info"
      />
    </div>
  );
}
