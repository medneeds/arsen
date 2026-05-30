import { Loader2 } from "lucide-react";
import socorraoIcon from "@/assets/socorrao-cross-logo.png";

interface SectionLoaderProps {
  message?: string;
  subMessage?: string;
  /** Tamanho do loader: 'sm' para áreas menores, 'md' padrão */
  size?: "sm" | "md";
}

/**
 * Loader de seção — substitui spinners genéricos com o padrão
 * visual institucional do ARSen. Usado em evoluções, requisições,
 * histórico e qualquer área que precisa aguardar dados do servidor
 * antes de exibir conteúdo. Nunca mostra conteúdo parcial ou
 * "piscadas" intermediárias — bloqueia a área até estar pronto.
 */
export function SectionLoader({ message, subMessage, size = "md" }: SectionLoaderProps) {
  const isSmall = size === "sm";

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-xl border border-border/40 bg-card/60 animate-in fade-in duration-300 ${
        isSmall ? "py-10 px-4" : "py-16 px-6"
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Ícone com spinner */}
      <div className="relative">
        <div
          className={`rounded-full border-2 border-transparent border-t-primary animate-spin ${
            isSmall ? "h-10 w-10" : "h-14 w-14"
          }`}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={socorraoIcon}
            alt=""
            aria-hidden="true"
            className={`object-contain opacity-70 ${isSmall ? "h-5 w-5" : "h-7 w-7"}`}
          />
        </div>
      </div>

      {/* Texto */}
      <div className="text-center space-y-1">
        <p className={`font-bold uppercase tracking-[0.15em] text-foreground ${isSmall ? "text-[10px]" : "text-[11px]"}`}>
          {message ?? "Carregando"}
        </p>
        {subMessage && (
          <p className={`text-muted-foreground flex items-center justify-center gap-1.5 ${isSmall ? "text-[10px]" : "text-xs"}`}>
            {subMessage}
            <span className="inline-flex gap-0.5 items-end">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
            </span>
          </p>
        )}
      </div>

      {/* Barra de progresso animada */}
      <div className={`rounded-full bg-border/40 overflow-hidden ${isSmall ? "w-32 h-px" : "w-44 h-0.5"}`}>
        <div className="h-full w-2/5 rounded-full bg-primary/60 animate-shimmer" />
      </div>
    </div>
  );
}
