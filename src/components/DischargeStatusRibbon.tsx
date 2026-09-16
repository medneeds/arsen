import { cn } from "@/lib/utils";
import { ArrowRightLeft, CheckCircle2, Cross, Plane, MousePointerClick, Info } from "lucide-react";
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
 * Pílula INLINE de sinalização de desfecho (somente informativa).
 * A ação de desalocação é executada exclusivamente pelo menu "Movimentações" do card.
 */
export function DischargeStatusRibbon({ status, className }: DischargeStatusRibbonProps) {
  const config = {
    alta_dada: {
      label: "ALTA SINALIZADA",
      Icon: CheckCircle2,
      gradient: "from-released-soft via-released-soft to-released-soft",
      glow: "shadow-[0_3px_12px_-2px_rgba(16,185,129,0.55)] hover:shadow-[0_6px_20px_-2px_rgba(16,185,129,0.8)]",
      tooltipTitle: "Alta hospitalar sinalizada",
      what: "Documento de alta emitido e validado.",
      next: "Confirme a saída e desaloque o leito pelo menu Movimentações.",
    },
    obito: {
      label: "ÓBITO SINALIZADO",
      Icon: Cross,
      gradient: "from-muted via-muted to-muted",
      glow: "shadow-[0_3px_12px_-2px_rgba(15,23,42,0.65)] hover:shadow-[0_6px_20px_-2px_rgba(15,23,42,0.9)]",
      tooltipTitle: "Óbito sinalizado",
      what: "Declaração de óbito registrada no prontuário.",
      next: "Conclua o protocolo institucional e desaloque o leito pelo menu Movimentações.",
    },
    transferido: {
      label: "TRANSFERÊNCIA SINALIZADA",
      Icon: ArrowRightLeft,
      gradient: "from-muted via-muted to-muted",
      glow: "shadow-[0_3px_12px_-2px_rgba(14,165,233,0.55)] hover:shadow-[0_6px_20px_-2px_rgba(14,165,233,0.8)]",
      tooltipTitle: "Transferência concluída",
      what: "Paciente transferido com saída registrada.",
      next: "Desaloque o leito pelo menu Movimentações para liberar o mapa.",
    },
    transferencia_interna_pendente: {
      label: "TRANSF. INTERNA SINALIZADA",
      Icon: ArrowRightLeft,
      gradient: "from-muted via-muted to-muted",
      glow: "shadow-[0_3px_14px_-2px_rgba(14,165,233,0.6)] hover:shadow-[0_6px_22px_-2px_rgba(14,165,233,0.9)]",
      tooltipTitle: "Transferência interna sinalizada",
      what: "Paciente aguardando relocação para outro setor da instituição.",
      next: "Defina o novo leito e desaloque o atual pelo menu Movimentações.",
    },
    transferencia_externa_pendente: {
      label: "TRANSF. EXTERNA SINALIZADA",
      Icon: Plane,
      gradient: "from-muted via-muted to-muted",
      glow: "shadow-[0_3px_14px_-2px_rgba(99,102,241,0.6)] hover:shadow-[0_6px_22px_-2px_rgba(99,102,241,0.9)]",
      tooltipTitle: "Transferência externa sinalizada",
      what: "Paciente aguardando saída para outra instituição de saúde.",
      next: "Após a saída efetiva, desaloque o leito pelo menu Movimentações.",
    },
  } as const;

  const entry = config[status as keyof typeof config];
  if (!entry) return null;
  const { Icon } = entry;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            aria-label={entry.tooltipTitle}
            className={cn(
              "group relative inline-flex items-center gap-2 rounded-full select-none",
              "bg-gradient-to-r text-white",
              "px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] leading-none",
              "ring-1 ring-white/80",
              "transition-all duration-300 ease-out cursor-help",
              "hover:-translate-y-0.5 hover:scale-[1.04]",
              "discharge-pill-sheen",
              entry.gradient,
              entry.glow,
              "print:bg-none print:bg-white print:text-black print:ring-1 print:ring-ring print:shadow-none print:animate-none",
              className,
            )}
          >
            <Icon
              className="h-3.5 w-3.5 transition-transform duration-500 ease-in-out group-hover:rotate-6"
              strokeWidth={2.6}
            />
            <span className="whitespace-nowrap">{entry.label}</span>
            <Info
              className="h-3 w-3 -ml-1 opacity-70 transition-opacity duration-300 group-hover:opacity-100 print:hidden"
              strokeWidth={2.6}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          className="w-[280px] p-0 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-md"
        >
          {/* Header colorido com o mesmo gradiente da pílula */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 bg-gradient-to-r text-white",
              entry.gradient,
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2.6} />
            <p className="text-xs font-medium leading-tight tracking-wide">
              {entry.tooltipTitle}
            </p>
          </div>

          {/* Corpo didático */}
          <div className="px-3 py-3 space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                O que significa
              </p>
              <p className="text-xs leading-snug text-foreground">{entry.what}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Próximo passo
              </p>
              <p className="text-xs leading-snug text-foreground">{entry.next}</p>
            </div>

            {/* Call-to-action: como desalocar */}
            <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
              <MousePointerClick className="h-3.5 w-3.5 mt-1 shrink-0 text-primary" strokeWidth={2.4} />
              <p className="text-xs leading-snug text-foreground">
                Para desalocar, abra o menu{" "}
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 align-middle">
                  <ArrowRightLeft className="h-2.5 w-2.5 text-primary" strokeWidth={2.8} />
                  <span className="text-xs font-medium text-primary">Movimentações</span>
                </span>{" "}
                no cabeçalho do card.
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
