import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Faixa } from "@/lib/saps3";

const sinal = (p: number) => (p > 0 ? `+${p}` : String(p));

interface ItemCompactoProps {
  titulo: string;
  /** Orientação curta, mostrada só com o item aberto. */
  dica?: string;
  /** Resposta atual em uma linha; null = sem resposta. */
  resumo: string | null;
  pontos: number | null;
  aberto: boolean;
  onAlternar: () => void;
  pendente?: boolean;
  /** data-saps-anchor para o checklist rolar até o item. */
  ancora?: string;
  children: ReactNode;
}

/**
 * Linha recolhida do SAPS 3: título + resposta + pontos. Um toque abre as
 * opções; aberto, ocupa a largura toda da grade para as faixas respirarem.
 */
export function ItemCompacto({ titulo, dica, resumo, pontos, aberto, onAlternar, pendente, ancora, children }: ItemCompactoProps) {
  const respondido = resumo != null;
  return (
    <div
      data-saps-anchor={ancora}
      className={cn(
        "rounded-lg border transition-colors",
        aberto ? "border-primary/50 bg-card shadow-sm lg:col-span-2" : "border-border/60",
        !aberto && pendente && "border-warning-border bg-warning-soft/30",
      )}
    >
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      >
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
            respondido ? "bg-primary text-primary-foreground" : "border border-muted-foreground/40",
          )}
          aria-hidden
        >
          {respondido && <Check className="h-3 w-3" />}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground normal-case truncate">{titulo}</span>
        <span className={cn("min-w-0 max-w-[55%] truncate text-xs normal-case", respondido ? "text-foreground" : "text-muted-foreground")}>
          {resumo ?? "Selecionar"}
        </span>
        {pontos != null && (
          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-medium text-primary">
            {sinal(pontos)}
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && (
        <div className="space-y-2 border-t border-border/60 px-3 pb-3 pt-2">
          {dica && <p className="text-xs text-muted-foreground normal-case">{dica}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

interface FaixaSelectorProps {
  titulo: string;
  dica?: string;
  faixas: Faixa[];
  /** Faixa efetiva (derivada do valor digitado, se houver). */
  selecionada: string | null;
  onSelecionar: (id: string) => void;
  aberto: boolean;
  onAlternar: () => void;
  /** Enter no campo de valor: confirma e segue para o próximo item. */
  onConcluir?: () => void;
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
  /** Faixas em coluna (rótulos longos). */
  vertical?: boolean;
  pendente?: boolean;
}

/** Item do SAPS 3 por faixa, recolhível. Um toque na faixa responde e fecha. */
export function FaixaSelector({
  titulo,
  dica,
  faixas,
  selecionada,
  onSelecionar,
  aberto,
  onAlternar,
  onConcluir,
  valor,
  vertical,
  pendente,
}: FaixaSelectorProps) {
  const faixa = faixas.find((f) => f.id === selecionada) ?? null;
  const resumo = faixa
    ? valor?.texto
      ? `${valor.texto}${valor.unidade ? ` ${valor.unidade}` : ""} · ${faixa.rotulo}`
      : faixa.rotulo
    : null;

  return (
    <ItemCompacto
      titulo={titulo}
      dica={dica}
      resumo={resumo}
      pontos={faixa ? faixa.pontos : null}
      aberto={aberto}
      onAlternar={onAlternar}
      pendente={pendente}
    >
      {valor && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            autoFocus
            inputMode={valor.inputMode ?? "decimal"}
            value={valor.texto}
            onChange={(e) => valor.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConcluir?.();
              }
            }}
            placeholder={valor.placeholder ?? "valor"}
            className={cn("h-8 w-32", valor.foraDaFaixa && "border-critical focus-visible:ring-critical")}
            aria-label={`${titulo} — valor exato (opcional)`}
          />
          {valor.unidade && <span className="text-xs text-muted-foreground">{valor.unidade}</span>}
          <span className="text-xs text-muted-foreground normal-case">
            {valor.foraDaFaixa ? (
              <span className="text-critical-on-soft">Valor fora da faixa plausível — confira.</span>
            ) : (
              "opcional · Enter confirma"
            )}
          </span>
        </div>
      )}
      <div className={cn("grid gap-1.5", vertical ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {faixas.map((f) => {
          const ativa = selecionada === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelecionar(f.id)}
              aria-pressed={ativa}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                ativa ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border bg-card hover:bg-muted/50",
              )}
            >
              <span className="normal-case">{f.rotulo}</span>
              <span className={cn("shrink-0 font-mono text-xs font-medium", ativa ? "text-primary" : "text-muted-foreground")}>
                {sinal(f.pontos)}
              </span>
            </button>
          );
        })}
      </div>
    </ItemCompacto>
  );
}
