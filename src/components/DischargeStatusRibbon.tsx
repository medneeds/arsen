import { cn } from "@/lib/utils";
import { ArrowRightLeft, CheckCircle2, Cross, Plane, ArrowLeftRight } from "lucide-react";
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
  /**
   * Quando fornecido, a pílula vira botão clicável que dispara a abertura
   * do menu "Movimentações" do card (sincronizado com o ícone do header).
   */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Pílula INLINE de sinalização de desfecho.
 * - Sincronizada com o ícone "Movimentações" do card (mesma ação).
 * - Tooltip orienta: "Clique no ícone Movimentações para desalocar".
 */
export function DischargeStatusRibbon({ status, className, onClick }: DischargeStatusRibbonProps) {
  const config = {
    alta_dada: {
      label: "ALTA SINALIZADA",
      Icon: CheckCircle2,
      gradient: "from-emerald-600 via-emerald-400 to-emerald-600",
      glow: "shadow-[0_3px_12px_-2px_rgba(16,185,129,0.55)] hover:shadow-[0_6px_20px_-2px_rgba(16,185,129,0.8)]",
      tooltipTitle: "Alta hospitalar sinalizada",
      tooltipBody: "Documento de alta emitido. Leito liberado para desalocação no mapa.",
    },
    obito: {
      label: "ÓBITO SINALIZADO",
      Icon: Cross,
      gradient: "from-slate-800 via-slate-500 to-slate-800",
      glow: "shadow-[0_3px_12px_-2px_rgba(15,23,42,0.65)] hover:shadow-[0_6px_20px_-2px_rgba(15,23,42,0.9)]",
      tooltipTitle: "Óbito sinalizado",
      tooltipBody: "Declaração registrada. Leito liberado para desalocação no mapa.",
    },
    transferido: {
      label: "TRANSFERÊNCIA SINALIZADA",
      Icon: ArrowRightLeft,
      gradient: "from-sky-600 via-sky-400 to-sky-600",
      glow: "shadow-[0_3px_12px_-2px_rgba(14,165,233,0.55)] hover:shadow-[0_6px_20px_-2px_rgba(14,165,233,0.8)]",
      tooltipTitle: "Transferência concluída",
      tooltipBody: "Paciente transferido. Leito liberado para desalocação no mapa.",
    },
    transferencia_interna_pendente: {
      label: "TRANSF. INTERNA SINALIZADA",
      Icon: ArrowRightLeft,
      gradient: "from-blue-700 via-sky-400 to-blue-700",
      glow: "shadow-[0_3px_14px_-2px_rgba(14,165,233,0.6)] hover:shadow-[0_6px_22px_-2px_rgba(14,165,233,0.9)]",
      tooltipTitle: "Transferência interna sinalizada",
      tooltipBody: "Paciente aguardando relocação. Desaloque pelo menu Movimentações quando o novo leito estiver definido.",
    },
    transferencia_externa_pendente: {
      label: "TRANSF. EXTERNA SINALIZADA",
      Icon: Plane,
      gradient: "from-violet-700 via-indigo-400 to-violet-700",
      glow: "shadow-[0_3px_14px_-2px_rgba(99,102,241,0.6)] hover:shadow-[0_6px_22px_-2px_rgba(99,102,241,0.9)]",
      tooltipTitle: "Transferência externa sinalizada",
      tooltipBody: "Paciente aguardando saída para outra instituição. Confirme a desalocação no menu Movimentações após a saída efetiva.",
    },
  } as const;

  const entry = config[status as keyof typeof config];
  if (!entry) return null;
  const { Icon } = entry;
  const isInteractive = typeof onClick === "function";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={isInteractive ? `${entry.tooltipTitle} — abrir menu Movimentações` : entry.tooltipTitle}
            className={cn(
              "group relative inline-flex items-center gap-1.5 rounded-full",
              "bg-gradient-to-r text-white",
              "px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] leading-none",
              "ring-1 ring-white/80 dark:ring-slate-900/70",
              "transition-all duration-300 ease-out",
              "hover:-translate-y-0.5 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              isInteractive ? "cursor-pointer" : "cursor-help",
              "discharge-pill-sheen",
              entry.gradient,
              entry.glow,
              "print:bg-none print:bg-white print:text-black print:ring-1 print:ring-slate-400 print:shadow-none print:animate-none",
              className,
            )}
          >
            <Icon
              className="h-3.5 w-3.5 transition-transform duration-500 ease-in-out group-hover:rotate-6"
              strokeWidth={2.6}
            />
            <span className="whitespace-nowrap">{entry.label}</span>
            <ArrowLeftRight
              className="h-3 w-3 -ml-0.5 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:scale-110 group-hover:opacity-100 print:hidden"
              strokeWidth={3}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-[260px]">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold">{entry.tooltipTitle}</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {entry.tooltipBody}
            </p>
            <p className="flex items-center gap-1.5 text-[10px] font-medium text-primary pt-0.5">
              {isInteractive ? "Clique aqui ou no" : "Clique no"} ícone
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5">
                <ArrowLeftRight className="h-3 w-3" strokeWidth={2.6} />
                <span className="font-semibold">Movimentações</span>
              </span>
              para desalocar
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
