/**
 * HelpTourOverlay — tour de ajuda contextual da página atual.
 *
 * Comportamento:
 *  - Backdrop escuro com leve blur (modo "focused tour").
 *  - Tooltip centralizada com título, corpo, contador e botões Anterior/Próximo/Fechar.
 *  - Esc fecha. Clique no backdrop NÃO fecha (evita fechar sem querer).
 *
 * Camada puramente visual: não chama hooks de dados, não persiste nada além
 * de um flag em localStorage para lembrar que o usuário já abriu pelo menos
 * uma vez (sem mudar a lógica — só usado para um ponto sutil no botão).
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getHelpTourForPath } from "@/lib/helpTours";
import { useHelpTour } from "@/contexts/HelpTourContext";

export function HelpTourOverlay() {
  const { isOpen, currentStep, close, next, prev, setStep } = useHelpTour();
  const location = useLocation();
  const tour = getHelpTourForPath(location.pathname);

  // Esc fecha o tour.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close, next, prev]);

  if (!isOpen || !tour) return null;

  const total = tour.steps.length;
  const step = tour.steps[Math.min(currentStep, total - 1)];
  const isFirst = currentStep === 0;
  const isLast = currentStep >= total - 1;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-tour-title"
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 fade-in-0 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="help-tour-title"
                className="text-sm font-semibold uppercase tracking-wide truncate"
              >
                {tour.title}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {tour.subtitle}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={close}
            aria-label="Fechar ajuda"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Corpo do passo */}
        <div className="px-5 py-5">
          <h3 className="text-base font-semibold mb-2">{step.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {step.body}
          </p>
        </div>

        {/* Indicador de progresso (dots) */}
        <div className="flex items-center justify-center gap-1.5 pb-3">
          {tour.steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Ir para passo ${i + 1}`}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === currentStep
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50")
              }
            />
          ))}
        </div>

        {/* Rodapé / navegação */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {currentStep + 1} / {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prev}
              disabled={isFirst}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            {isLast ? (
              <Button size="sm" onClick={close} className="h-8">
                Entendi
              </Button>
            ) : (
              <Button size="sm" onClick={next} className="h-8">
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
