import type { ReactNode } from "react";
import { PatientIdentityBar } from "@/components/PatientIdentityBar";
import { cn } from "@/lib/utils";

/**
 * Faixa do paciente dos modulos multiprofissionais.
 *
 * Fonte UNICA da identidade: reaproveita o PatientIdentityBar (o mesmo
 * sub-cabecalho do Monitoramento: leito, nome, setor, alergia, prontuario),
 * ancorado em internacao_id. A direita: rotulo do modulo e 2–3 indicadores.
 *
 * Regra do card com estado: o indicador so fica ambar/vermelho com acao
 * concreta pendente (tone="warning"/"critical"); o resto e neutro.
 */
export interface StripTile {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warning" | "critical";
}

export function ModulePatientStrip({
  patientId,
  moduleLabel,
  tiles = [],
  actions,
}: {
  patientId: string | null;
  moduleLabel: string;
  tiles?: StripTile[];
  actions?: ReactNode;
}) {
  return (
    <PatientIdentityBar
      patientId={patientId}
      className="print:hidden rounded-lg border border-border bg-card/60 px-3 py-3"
      rightSlot={
        <div className="flex items-center gap-2">
          {tiles.map((t) => (
            <div
              key={t.label}
              title={t.hint}
              className={cn(
                "min-w-[7rem] rounded-md border px-2.5 py-1.5",
                t.tone === "critical" && "border-critical/40 bg-critical-soft",
                t.tone === "warning" && "border-warning/40 bg-warning-soft",
                (!t.tone || t.tone === "neutral") && "border-border bg-background",
              )}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">{t.label}</div>
              <div className={cn(
                "text-sm font-semibold leading-tight",
                t.tone === "critical" ? "text-critical-on-soft" : t.tone === "warning" ? "text-warning-on-soft" : "text-foreground",
              )}>{t.value}</div>
            </div>
          ))}
          {actions}
          <p className="pl-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground leading-tight">
            {moduleLabel}
          </p>
        </div>
      }
    />
  );
}
