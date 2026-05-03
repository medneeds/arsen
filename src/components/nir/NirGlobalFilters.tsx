import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar, Building2, Flag, RefreshCw, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { NirFilters, NirPeriod, SectorScope } from "@/hooks/useNirMetrics";

interface Props {
  filters: NirFilters;
  onChange: (next: NirFilters) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const PERIODS: { key: NirPeriod; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
];

const SCOPES: { key: SectorScope; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "uti", label: "UTI/UCI" },
  { key: "enfermaria", label: "Enfermaria" },
  { key: "emergencia", label: "Emergência" },
];

const PRIORITIES: { key: NirFilters["priority"]; label: string; tone: string; hint: string }[] = [
  { key: "all", label: "Todas", tone: "", hint: "Sem filtro de prioridade" },
  { key: "vermelha", label: "P1 · Vermelha", tone: "text-red-600", hint: "Emergente — vaga imediata (UTI, Sala Vermelha, instabilidade hemodinâmica)" },
  { key: "amarela", label: "P2 · Amarela", tone: "text-amber-600", hint: "Urgente — vaga em até 4h (semi-eletivo, agravamento previsível)" },
  { key: "verde", label: "P3 · Verde", tone: "text-emerald-600", hint: "Eletiva / agendável (transferência de conforto, alta administrativa)" },
];

export function NirGlobalFilters({ filters, onChange, onRefresh, isLoading }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border bg-card">
      {/* Período */}
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Período:</span>
        <div className="flex rounded-md border overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => onChange({ ...filters, period: p.key })}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors",
                filters.period === p.key ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Setor */}
      <div className="flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Setor:</span>
        <div className="flex rounded-md border overflow-hidden">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              onClick={() => onChange({ ...filters, sectorScope: s.key })}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors",
                filters.sectorScope === s.key ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prioridade */}
      <div className="flex items-center gap-1.5">
        <Flag className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Prioridade:</span>
        <div className="flex rounded-md border overflow-hidden">
          {PRIORITIES.map((p) => (
            <button
              key={p.key}
              onClick={() => onChange({ ...filters, priority: p.key })}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors",
                filters.priority === p.key ? "bg-primary text-primary-foreground" : cn("bg-background hover:bg-accent", p.tone),
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      <Badge variant="outline" className="text-[10px] gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Atualização automática 60s
      </Badge>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading} className="h-7">
        <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isLoading && "animate-spin")} />
        Atualizar
      </Button>
    </div>
  );
}
