import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Faixa } from "@/lib/saps3";

interface FaixaSelectorProps {
  titulo: string;
  /** Uma linha de orientação (ex.: "pior valor na 1ª hora"). */
  dica?: string;
  faixas: Faixa[];
  /** Faixa efetiva (derivada do valor digitado, se houver). */
  selecionada: string | null;
  onSelecionar: (id: string) => void;
  /** Campo opcional de valor exato: ao digitar, a faixa é marcada sozinha. */
  valor?: {
    texto: string;
    onChange: (texto: string) => void;
    placeholder?: string;
    unidade?: string;
    inputMode?: "numeric" | "decimal";
    /** Valor digitado fora da faixa plausível — pede conferência. */
    foraDaFaixa?: boolean;
  };
  /** Faixas em coluna única (rótulos longos). */
  vertical?: boolean;
  /** Item obrigatório ainda sem resposta. */
  pendente?: boolean;
}

const sinal = (p: number) => (p > 0 ? `+${p}` : String(p));

/**
 * Item do SAPS 3 preenchido por faixa: botões com o intervalo e os pontos,
 * mais um campo opcional de valor exato. Um toque resolve o item.
 */
export function FaixaSelector({
  titulo,
  dica,
  faixas,
  selecionada,
  onSelecionar,
  valor,
  vertical,
  pendente,
}: FaixaSelectorProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        pendente ? "border-warning-border bg-warning-soft/30" : "border-border/60",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground normal-case">{titulo}</p>
          {dica && <p className="text-xs text-muted-foreground normal-case">{dica}</p>}
        </div>
        {valor && (
          <div className="flex items-center gap-1.5">
            <Input
              inputMode={valor.inputMode ?? "decimal"}
              value={valor.texto}
              onChange={(e) => valor.onChange(e.target.value)}
              placeholder={valor.placeholder ?? "valor"}
              className={cn(
                "h-8 w-28 text-right",
                valor.foraDaFaixa && "border-critical focus-visible:ring-critical",
              )}
              aria-label={`${titulo} — valor exato (opcional)`}
            />
            {valor.unidade && <span className="text-xs text-muted-foreground">{valor.unidade}</span>}
          </div>
        )}
      </div>

      {valor?.foraDaFaixa && (
        <p className="text-xs text-critical-on-soft normal-case">
          Valor fora da faixa plausível — confira a digitação.
        </p>
      )}

      <div className={cn("grid gap-2", vertical ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {faixas.map((f) => {
          const ativa = selecionada === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelecionar(f.id)}
              aria-pressed={ativa}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                ativa
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                  : "border-border bg-card hover:bg-muted/50",
              )}
            >
              <span className="normal-case">{f.rotulo}</span>
              <span
                className={cn(
                  "shrink-0 font-mono text-xs font-medium",
                  ativa ? "text-primary" : "text-muted-foreground",
                )}
              >
                {sinal(f.pontos)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
