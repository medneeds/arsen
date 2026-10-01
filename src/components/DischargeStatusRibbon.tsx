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
  /** Modo compacto para os cards do mapa/painel: rotulo abreviado e padding
   *  menor, para nao espremer DIH/TPS. O texto completo continua no tooltip e na
   *  aba de Movimentacoes. */
  compact?: boolean;
}

// Rotulos abreviados para os cards (modo compact). O texto completo fica no
// tooltip da pilula e na aba de Sinalizacoes/Movimentacoes.
const SHORT_LABELS: Record<string, string> = {
  alta_dada: "ALTA",
  obito: "ÓBITO",
  transferido: "TRANSF.",
  transferencia_interna_pendente: "TRANSF. INT.",
  transferencia_externa_pendente: "TRANSF. EXT.",
};

/**
 * Pílula INLINE de sinalização de desfecho (somente informativa).
 * A ação de desalocação é executada exclusivamente pelo menu "Movimentações" do card.
 */
export function DischargeStatusRibbon({ status, className, compact = false }: DischargeStatusRibbonProps) {
  const config = {
    alta_dada: {
      label: "ALTA SINALIZADA",
      Icon: CheckCircle2,
      pill: "bg-released-soft text-released-on-soft ring-1 ring-released-border",
      tooltipTitle: "Alta hospitalar sinalizada",
      what: "Documento de alta emitido e validado.",
      next: "Confirme a saída e desaloque o leito pelo menu Movimentações.",
    },
    obito: {
      label: "ÓBITO SINALIZADO",
      Icon: Cross,
      pill: "bg-muted text-foreground ring-1 ring-border",
      tooltipTitle: "Óbito sinalizado",
      what: "Declaração de óbito registrada no prontuário.",
      next: "Conclua o protocolo institucional e desaloque o leito pelo menu Movimentações.",
    },
    transferido: {
      label: "TRANSFERÊNCIA SINALIZADA",
      Icon: ArrowRightLeft,
      pill: "bg-muted text-foreground ring-1 ring-border",
      tooltipTitle: "Transferência concluída",
      what: "Paciente transferido com saída registrada.",
      next: "Desaloque o leito pelo menu Movimentações para liberar o mapa.",
    },
    transferencia_interna_pendente: {
      label: "TRANSF. INTERNA SINALIZADA",
      Icon: ArrowRightLeft,
      pill: "bg-muted text-foreground ring-1 ring-border",
      tooltipTitle: "Transferência interna sinalizada",
      what: "Paciente aguardando relocação para outro setor da instituição.",
      next: "Defina o novo leito e desaloque o atual pelo menu Movimentações.",
    },
    transferencia_externa_pendente: {
      label: "TRANSF. EXTERNA SINALIZADA",
      Icon: Plane,
      pill: "bg-muted text-foreground ring-1 ring-border",
      tooltipTitle: "Transferência externa sinalizada",
      what: "Paciente aguardando saída para outra instituição de saúde.",
      next: "Após a saída efetiva, desaloque o leito pelo menu Movimentações.",
    },
  } as const;

  const entry = config[status as keyof typeof config];
  if (!entry) return null;
  const { Icon } = entry;
  const labelText = compact ? (SHORT_LABELS[status as string] ?? entry.label) : entry.label;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            aria-label={entry.tooltipTitle}
            className={cn(
              "group relative inline-flex items-center rounded-full select-none",
              compact ? "gap-1 px-2 py-0.5" : "gap-2 px-3 py-1",
              "text-xs font-semibold uppercase tracking-[0.08em] leading-none",
              "shadow-sm transition-colors duration-200 ease-out cursor-help",
              entry.pill,
              "print:bg-white print:text-black print:ring-1 print:ring-ring print:shadow-none",
              className,
            )}
          >
            <Icon
              className="h-3.5 w-3.5 transition-transform duration-500 ease-in-out group-hover:rotate-6"
              strokeWidth={2.6}
            />
            <span className="whitespace-nowrap">{labelText}</span>
            {!compact && (
              <Info
                className="h-3 w-3 -ml-1 opacity-70 transition-opacity duration-300 group-hover:opacity-100 print:hidden"
                strokeWidth={2.6}
              />
            )}
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
              "flex items-center gap-2 px-3 py-2",
              entry.pill,
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
