import { BedDouble } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grid animado de selecao de leito — fonte visual UNICA para os fluxos de
 * alocacao (pre-admitir, transferencia interna, pos-transferencia externa).
 * Extraido do AdmitPatientDialog para unificar a experiencia (livre / ocupado /
 * leito extra) entre os fluxos que antes usavam seletores divergentes (dropdowns).
 *
 * Generico por `id`: no pre-admitir o id e o NUMERO do leito; na transferencia o
 * id e o leito_id (e `label` carrega o numero exibido). Assim o mesmo grid serve
 * aos dois sem acoplar ao formato de dados de cada fluxo.
 */
export interface BedOption {
  /** Chave/selecao: numero (pre-admitir) ou leito_id (transferencia). */
  id: string;
  /** Rotulo exibido (numero do leito), ou "EXTRA". */
  label: string;
  status: "livre" | "ocupado" | "extra";
}

interface BedSelectorGridProps {
  beds: BedOption[];
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
  /** Altura maxima da area rolavel (default 180px, como no pre-admitir). */
  maxHeightClass?: string;
}

export function BedSelectorGrid({
  beds,
  value,
  onChange,
  className,
  maxHeightClass = "max-h-[180px]",
}: BedSelectorGridProps) {
  return (
    <div className={cn("rounded-md border bg-muted/30 p-2 overflow-y-auto", maxHeightClass, className)}>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {beds.map((bed) => {
          const isSel = value === bed.id;
          if (bed.status === "extra") {
            return (
              <button
                key={bed.id}
                type="button"
                onClick={() => onChange(bed.id)}
                className={cn(
                  "rounded-md border px-2 py-2 text-xs font-medium transition-all flex flex-col items-center gap-1",
                  isSel
                    ? "border-warning bg-warning/15 text-warning-on-soft ring-2 ring-warning/30"
                    : "border-dashed border-warning/40 text-warning-on-soft hover:bg-warning/10",
                )}
              >
                <BedDouble className="h-3 w-3" />
                {bed.label}
              </button>
            );
          }
          const isOccupied = bed.status === "ocupado";
          return (
            <button
              key={bed.id}
              type="button"
              disabled={isOccupied}
              onClick={() => onChange(bed.id)}
              className={cn(
                "rounded-md border px-2 py-2 text-xs font-medium transition-all flex flex-col items-center gap-1 leading-tight",
                isOccupied
                  ? "border-destructive/30 bg-destructive/10 text-destructive/70 cursor-not-allowed"
                  : isSel
                    ? "border-released bg-released/15 text-released-on-soft ring-2 ring-released/30"
                    : "border-released/30 bg-released/5 text-released-on-soft hover:bg-released/15",
              )}
            >
              <BedDouble className="h-3 w-3" />
              {bed.label}
              <span className="text-xs font-normal opacity-80">
                {isOccupied ? "Ocupado" : "Livre"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
