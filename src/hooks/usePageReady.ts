import { useEffect, useState } from "react";

interface UsePageReadyOptions {
  /** Quando true, a página está carregando. Quando todas falsas, fica pronta. */
  loading: boolean;
  /** Tempo mínimo (ms) que o loader deve permanecer visível. Default 400ms. */
  minDisplayMs?: number;
}

/**
 * Hook padrão para gating de páginas com carregamento.
 * - Garante tempo mínimo de exibição do loader (evita flash)
 * - Retorna `ready=true` somente quando carregamento finalizou E o piso foi atingido
 *
 * Uso:
 *   const ready = usePageReady({ loading: authLoading || patientsLoading });
 *   if (!ready) return <PageLoader message="PREPARANDO UTI 2…" />;
 */
export function usePageReady({ loading, minDisplayMs = 400 }: UsePageReadyOptions): boolean {
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), minDisplayMs);
    return () => clearTimeout(t);
  }, [minDisplayMs]);

  return !loading && minElapsed;
}
