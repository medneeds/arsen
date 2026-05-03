import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SLA Badge — Service Level Agreement visual indicator.
 *
 * Conta o tempo desde `startAt` até `endAt` (ou agora, se ainda em aberto)
 * e aplica cores de acordo com os limiares (default: 60 / 120 / 180 minutos).
 *
 * Verde: dentro do alvo • Amarelo: atenção • Laranja: estourado • Vermelho: crítico
 *
 * Uso típico:
 *   <SlaBadge startAt={encounter.created_at}
 *             endAt={encounter.first_medical_attendance_at}
 *             label="1º atend." />
 */
export interface SlaBadgeProps {
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  /** Limiares em minutos: [amarelo, laranja, vermelho] */
  thresholds?: [number, number, number];
  label?: string;
  className?: string;
  /** Mostrar ícone de relógio */
  showIcon?: boolean;
  /** Tamanho compacto */
  compact?: boolean;
}

const formatElapsed = (mins: number): string => {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
};

export function SlaBadge({
  startAt,
  endAt,
  thresholds = [60, 120, 180],
  label,
  className,
  showIcon = true,
  compact = false,
}: SlaBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  // Atualiza a cada 30s só se ainda está em aberto
  useEffect(() => {
    if (endAt || !startAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [startAt, endAt]);

  if (!startAt) return null;

  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : now;
  const elapsedMin = Math.max(0, Math.floor((end - start) / 60_000));

  const [yellow, orange, red] = thresholds;

  let level: "green" | "yellow" | "orange" | "red" = "green";
  if (elapsedMin >= red) level = "red";
  else if (elapsedMin >= orange) level = "orange";
  else if (elapsedMin >= yellow) level = "yellow";

  const styles: Record<typeof level, string> = {
    green: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
    yellow: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
    orange: "bg-orange-500/20 text-orange-700 border-orange-500/40 dark:text-orange-400",
    red: "bg-destructive/15 text-destructive border-destructive/40 animate-pulse",
  };

  const tooltip = endAt
    ? `Concluído em ${formatElapsed(elapsedMin)}`
    : `Em aberto há ${formatElapsed(elapsedMin)} • SLA ${yellow}/${orange}/${red}min`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "gap-1 border font-mono tabular-nums",
            compact ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-xs",
            styles[level],
            className,
          )}
        >
          {showIcon && <Clock className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />}
          {label && <span className="font-sans font-medium">{label}</span>}
          <span>{formatElapsed(elapsedMin)}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
