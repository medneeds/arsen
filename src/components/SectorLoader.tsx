/**
 * Loader de transição de setor — discreto e elegante, na identidade da plataforma.
 *
 * Um anel fino: base quase imperceptível (primary/15) + arco superior girando
 * (border-t-primary). Fundo translúcido com leve blur, para o setor só aparecer
 * quando os dados estiverem 100% carregados — sem flash do setor anterior.
 * Fade-in próprio para nunca dar sensação de "pop" brusco.
 */
import { useEffect, useState } from "react";

interface SectorLoaderProps {
  /** Rótulo curto e discreto (ex.: "Preparando UTI 2"). Opcional. */
  label?: string;
}

export function SectorLoader({ label }: SectorLoaderProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-background/75 backdrop-blur-sm transition-opacity duration-300 ease-out"
      style={{ opacity: visible ? 1 : 0 }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="relative inline-flex h-10 w-10" aria-hidden="true">
        {/* Anel base, quase imperceptível */}
        <span className="absolute inset-0 rounded-full border-2 border-primary/15" />
        {/* Arco superior girando — o "círculo animado" */}
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
      </span>
      {label && (
        <span className="text-xs font-medium tracking-[0.18em] uppercase text-muted-foreground/70">
          {label}
        </span>
      )}
    </div>
  );
}
