import { cn } from "@/lib/utils";
import { ArrowRightLeft, CheckCircle2, Cross, Plane, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DischargeStatus =
  | "alta_dada"
  | "obito"
  | "transferido"
  | "transferencia_interna_pendente"
  | "transferencia_externa_pendente"
  | undefined
  | null
  | string;

interface DischargeStatusRibbonProps {
  status: DischargeStatus;
  className?: string;
}

/**
 * Pílula INLINE de sinalização de desfecho.
 * Renderizada dentro do card, à esquerda da pílula DIH.
 * - Animação sutil de pulse + ícone com micro-translate (induz ação)
 * - Tooltip explica significado e permissão de desalocação
 * - Hover: elevação leve, sombra e seta indicativa
 */
export function DischargeStatusRibbon({ status, className }: DischargeStatusRibbonProps) {
  const config = {
    alta_dada: {
      label: "ALTA SINALIZADA",
      Icon: CheckCircle2,
      gradient: "from-emerald-500 to-emerald-600",
      glow: "shadow-[0_2px_10px_-2px_rgba(16,185,129,0.55)] hover:shadow-[0_4px_16px_-2px_rgba(16,185,129,0.75)]",
      tooltipTitle: "Alta hospitalar sinalizada",
      tooltipBody: "Documento de alta emitido. Leito liberado para desalocação no mapa.",
    },
    obito: {
      label: "ÓBITO SINALIZADO",
      Icon: Cross,
      gradient: "from-slate-700 to-slate-900",
      glow: "shadow-[0_2px_10px_-2px_rgba(15,23,42,0.65)] hover:shadow-[0_4px_16px_-2px_rgba(15,23,42,0.85)]",
      tooltipTitle: "Óbito sinalizado",
      tooltipBody: "Declaração registrada. Leito liberado para desalocação no mapa.",
    },
    transferido: {
      label: "TRANSFERÊNCIA SINALIZADA",
      Icon: ArrowRightLeft,
      gradient: "from-sky-500 to-sky-700",
      glow: "shadow-[0_2px_10px_-2px_rgba(14,165,233,0.55)] hover:shadow-[0_4px_16px_-2px_rgba(14,165,233,0.75)]",
      tooltipTitle: "Transferência concluída",
      tooltipBody: "Paciente transferido. Leito liberado para desalocação no mapa.",
    },
    transferencia_interna_pendente: {
      label: "TRANSF. INTERNA SINALIZADA",
      Icon: ArrowRightLeft,
      gradient: "from-sky-500 to-blue-700",
      glow: "shadow-[0_2px_10px_-2px_rgba(14,165,233,0.6)] hover:shadow-[0_4px_18px_-2px_rgba(14,165,233,0.85)]",
      tooltipTitle: "Transferência interna sinalizada",
      tooltipBody: "Paciente aguardando relocação para outro setor. Desaloque pelo mapa quando o novo leito estiver definido.",
    },
    transferencia_externa_pendente: {
      label: "TRANSF. EXTERNA SINALIZADA",
      Icon: Plane,
      gradient: "from-indigo-500 to-violet-700",
      glow: "shadow-[0_2px_10px_-2px_rgba(99,102,241,0.6)] hover:shadow-[0_4px_18px_-2px_rgba(99,102,241,0.85)]",
      tooltipTitle: "Transferência externa sinalizada",
      tooltipBody: "Paciente aguardando saída para outra instituição. Confirme a desalocação no mapa após a saída efetiva.",
    },
  } as const;

  const entry = config[status as keyof typeof config];
  if (!entry) return null;
  const { Icon } = entry;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={entry.tooltipTitle}
            className={cn(
              "group relative inline-flex items-center gap-1 rounded-full",
              "bg-gradient-to-r text-white",
              "px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] leading-none",
              "ring-1 ring-white/70 dark:ring-slate-900/70",
              "transition-all duration-200 ease-out",
              "hover:-translate-y-0.5 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              "animate-[pulse_2.6s_ease-in-out_infinite]",
              entry.gradient,
              entry.glow,
              "print:bg-none print:bg-white print:text-black print:ring-1 print:ring-slate-400 print:shadow-none print:animate-none",
              className,
            )}
          >
            <Icon
              className="h-2.5 w-2.5 transition-transform duration-500 ease-in-out group-hover:rotate-12 motion-safe:animate-[pulse_2.6s_ease-in-out_infinite]"
              strokeWidth={2.6}
            />
            <span className="whitespace-nowrap">{entry.label}</span>
            <ChevronRight
              className="h-2.5 w-2.5 -ml-0.5 opacity-70 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:opacity-100 motion-safe:animate-[pulse_1.8s_ease-in-out_infinite] print:hidden"
              strokeWidth={3}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-[240px]">
          <div className="space-y-1">
            <p className="text-xs font-semibold">{entry.tooltipTitle}</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {entry.tooltipBody}
            </p>
            <p className="text-[10px] font-medium text-primary pt-0.5">
              Clique no menu do card para desalocar →
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
