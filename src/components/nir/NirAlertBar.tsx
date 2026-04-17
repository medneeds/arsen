import { AlertTriangle, Activity, Sparkles, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NirMetrics } from "@/hooks/useNirMetrics";

interface Props {
  metrics: NirMetrics;
  onOpenAlert: (kind: "stuck24h" | "saturated" | "cleaning" | "sisreg") => void;
}

interface AlertItem {
  key: "stuck24h" | "saturated" | "cleaning" | "sisreg";
  icon: React.ElementType;
  count: number;
  label: string;
  detail: string;
  tone: "red" | "amber" | "orange" | "purple";
}

const toneStyles: Record<AlertItem["tone"], string> = {
  red: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-500/15",
  amber: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15",
  orange: "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300 hover:bg-orange-500/15",
  purple: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/15",
};

export function NirAlertBar({ metrics, onOpenAlert }: Props) {
  const utiSector = metrics.occupancyBySector.find((s) => s.sector.toLowerCase().includes("uti"));
  const utiSaturated = utiSector && utiSector.rate >= 95;

  const alerts: AlertItem[] = [
    {
      key: "stuck24h",
      icon: AlertTriangle,
      count: metrics.stuck24h.length,
      label: "Aguardando vaga +24h",
      detail: metrics.stuck48hUti.length > 0 ? `${metrics.stuck48hUti.length} UTI +48h` : "ver lista crítica",
      tone: "red",
    },
    {
      key: "saturated",
      icon: Activity,
      count: utiSector?.rate ?? 0,
      label: utiSector ? `${utiSector.sector.toUpperCase()} ocupação` : "Ocupação UTI",
      detail: utiSaturated ? "saturação ≥95%" : "operacional",
      tone: utiSaturated ? "red" : "amber",
    },
    {
      key: "cleaning",
      icon: Sparkles,
      count: metrics.longCleaning.length,
      label: "Higienização +4h",
      detail: "atraso operacional",
      tone: "orange",
    },
    {
      key: "sisreg",
      icon: Globe,
      count: metrics.sisregStuck.length,
      label: "SISREG sem resposta +12h",
      detail: "pendente regulação externa",
      tone: "purple",
    },
  ];

  // Hide silent alerts (no signal)
  const visible = alerts.filter((a) => a.count > 0 || (a.key === "saturated" && (a.count as number) > 0));
  if (visible.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-700 dark:text-emerald-300">
        <Sparkles className="h-3.5 w-3.5" />
        Nenhum alerta crítico no momento — fluxo regulatório dentro do SLA.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((a) => (
        <Button
          key={a.key}
          variant="outline"
          size="sm"
          onClick={() => onOpenAlert(a.key)}
          className={cn("h-auto py-2 px-3 gap-2 border", toneStyles[a.tone])}
        >
          <a.icon className="h-4 w-4 shrink-0" />
          <div className="flex flex-col items-start text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold leading-none">
                {a.key === "saturated" ? `${a.count}%` : a.count}
              </span>
              <span className="text-[11px] font-medium">{a.label}</span>
            </div>
            <span className="text-[10px] opacity-80 leading-tight">{a.detail}</span>
          </div>
          <Badge variant="outline" className="ml-1 h-4 text-[9px] border-current">VER</Badge>
        </Button>
      ))}
    </div>
  );
}
