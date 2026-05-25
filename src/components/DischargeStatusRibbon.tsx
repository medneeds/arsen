import { cn } from "@/lib/utils";
import { ArrowRightLeft, CheckCircle2, Cross, Plane } from "lucide-react";

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
 * NOTCH flutuante sobre a borda superior do card.
 * Posicionado em -translate-y-1/2, acima da PatientSection,
 * com glow pulsante p/ estados pendentes (transferência) e
 * pill sólida + ícone p/ desfechos finalizados (alta/óbito).
 *
 * Pré-requisito: o card pai precisa ter `relative` (NÃO precisa de overflow-hidden).
 */
export function DischargeStatusRibbon({ status, className }: DischargeStatusRibbonProps) {
  const known = [
    "alta_dada",
    "obito",
    "transferido",
    "transferencia_interna_pendente",
    "transferencia_externa_pendente",
  ];
  if (!status || !known.includes(status)) return null;

  const config = {
    alta_dada: {
      label: "ALTA HOSPITALAR",
      shortLabel: "ALTA",
      Icon: CheckCircle2,
      gradient: "from-emerald-500 via-emerald-600 to-emerald-700",
      glow: "shadow-[0_4px_14px_-2px_rgba(16,185,129,0.55)]",
      ring: "ring-emerald-300/60",
      pulse: false,
    },
    obito: {
      label: "ÓBITO REGISTRADO",
      shortLabel: "ÓBITO",
      Icon: Cross,
      gradient: "from-slate-700 via-slate-800 to-slate-900",
      glow: "shadow-[0_4px_14px_-2px_rgba(15,23,42,0.7)]",
      ring: "ring-slate-400/60",
      pulse: false,
    },
    transferido: {
      label: "TRANSFERIDO",
      shortLabel: "TRANSF.",
      Icon: ArrowRightLeft,
      gradient: "from-sky-500 via-sky-600 to-sky-700",
      glow: "shadow-[0_4px_14px_-2px_rgba(14,165,233,0.55)]",
      ring: "ring-sky-300/60",
      pulse: false,
    },
    transferencia_interna_pendente: {
      label: "TRANSFERÊNCIA INTERNA SINALIZADA",
      shortLabel: "TRANSF. INTERNA",
      Icon: ArrowRightLeft,
      gradient: "from-sky-500 via-sky-600 to-blue-700",
      glow: "shadow-[0_4px_18px_-2px_rgba(14,165,233,0.7)]",
      ring: "ring-sky-300/70",
      pulse: true,
    },
    transferencia_externa_pendente: {
      label: "TRANSFERÊNCIA EXTERNA SINALIZADA",
      shortLabel: "TRANSF. EXTERNA",
      Icon: Plane,
      gradient: "from-indigo-500 via-indigo-600 to-violet-700",
      glow: "shadow-[0_4px_18px_-2px_rgba(99,102,241,0.7)]",
      ring: "ring-indigo-300/70",
      pulse: true,
    },
  }[status as
    | "alta_dada"
    | "obito"
    | "transferido"
    | "transferencia_interna_pendente"
    | "transferencia_externa_pendente"];

  const { Icon } = config;

  return (
    <div
      aria-label={`Paciente com desfecho: ${config.label}`}
      className={cn(
        // Posiciona ACIMA da borda superior do card, centralizado horizontalmente
        "pointer-events-none absolute top-0 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2",
        "print:static print:translate-x-0 print:translate-y-0 print:mb-1",
        className,
      )}
    >
      <div className="relative">
        {/* Glow pulsante atrás (só para pendentes) */}
        {config.pulse && (
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-gradient-to-r animate-pulse blur-md opacity-70 print:hidden",
              config.gradient,
            )}
            aria-hidden
          />
        )}

        {/* Pill principal */}
        <div
          className={cn(
            "relative flex items-center gap-1.5 rounded-full",
            "bg-gradient-to-r text-white",
            "px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
            "ring-2 ring-white dark:ring-slate-900",
            "shadow-lg print:shadow-none print:ring-0",
            config.gradient,
            config.glow,
            config.pulse && "animate-[pulse_2.4s_ease-in-out_infinite]",
          )}
        >
          {/* Halo interno do ícone */}
          <div className={cn("flex items-center justify-center rounded-full p-0.5 ring-1", config.ring)}>
            <Icon className="h-3 w-3" strokeWidth={2.5} />
          </div>
          <span className="leading-none whitespace-nowrap">{config.shortLabel}</span>
          {config.pulse && (
            <span className="relative flex h-1.5 w-1.5 print:hidden" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
