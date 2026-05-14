import { cn } from "@/lib/utils";

type DischargeStatus = "alta_dada" | "obito" | "transferido" | undefined | null | string;

interface DischargeStatusRibbonProps {
  status: DischargeStatus;
  className?: string;
}

/**
 * Fita diagonal no canto superior direito do card do paciente
 * sinalizando desfecho registrado (Alta / Óbito / Transferência).
 *
 * Visual: faixa 45°, alta visibilidade no mapa de leitos sem alterar
 * dimensões do card (posicionada absolute dentro de container relative).
 *
 * Pré-requisito: o card pai precisa ter `relative` e `overflow-hidden`.
 */
export function DischargeStatusRibbon({ status, className }: DischargeStatusRibbonProps) {
  if (status !== "alta_dada" && status !== "obito" && status !== "transferido") return null;

  const config = {
    alta_dada: { label: "ALTA", bg: "bg-emerald-600" },
    obito: { label: "ÓBITO", bg: "bg-slate-700" },
    transferido: { label: "TRANSF.", bg: "bg-sky-600" },
  }[status as "alta_dada" | "obito" | "transferido"];

  return (
    <div
      aria-label={`Paciente com desfecho: ${config.label}`}
      className={cn(
        "pointer-events-none absolute top-[10px] -right-[28px] z-10 rotate-45",
        "px-7 py-[2px] text-[9px] font-bold tracking-[0.12em] text-white shadow-md print:shadow-none",
        config.bg,
        className,
      )}
    >
      {config.label}
    </div>
  );
}
