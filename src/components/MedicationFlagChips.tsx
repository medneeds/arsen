import { Sun, Filter, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { deriveIvMedicationFlags } from "@/lib/ivMedicationFlags";

interface MedicationFlagChipsProps {
  name: string;
  className?: string;
  size?: "xs" | "sm";
}

/**
 * Chips discretos que exibem flags assistenciais derivadas do nome do medicamento:
 * - Fotoproteção (fotossensível)
 * - Filtro em linha
 * - BIC obrigatória
 *
 * Sprint A — derivação heurística por nome. Quando o catálogo HMDM ganhar
 * colunas dedicadas, basta trocar a fonte em deriveIvMedicationFlags.
 */
export function MedicationFlagChips({ name, className, size = "xs" }: MedicationFlagChipsProps) {
  const flags = deriveIvMedicationFlags(name);
  const items: Array<{ key: string; icon: typeof Sun; label: string; tip: string }> = [];

  if (flags.photoprotection) {
    items.push({ key: "photo", icon: Sun, label: "Foto", tip: "Fotossensível — proteger da luz (envoltório âmbar / equipo opaco)" });
  }
  if (flags.requiresFilter) {
    items.push({ key: "filter", icon: Filter, label: "Filtro", tip: "Necessita filtro em linha (geralmente 0,22 µm)" });
  }
  if (flags.requiresPump) {
    items.push({ key: "pump", icon: Zap, label: "BIC obrig.", tip: "Exige bomba de infusão contínua" });
  }

  if (items.length === 0) return null;

  const iconSize = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";
  const textSize = size === "xs" ? "text-[9px]" : "text-[10px]";

  return (
    <span className={cn("inline-flex items-center gap-1 flex-wrap", className)}>
      {items.map(it => {
        const Icon = it.icon;
        return (
          <Tooltip key={it.key}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 px-1 py-px rounded border border-border/50 bg-muted/40 text-muted-foreground font-medium leading-none cursor-help",
                  textSize
                )}
              >
                <Icon className={iconSize} />
                {it.label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[220px]">
              {it.tip}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}
