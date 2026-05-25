/**
 * Dialog didático com slides navegáveis (setas + dots + swipe touch + teclado)
 * para cada FAQ. Renderiza FaqVisualBlock como ilustração e mantém o conteúdo
 * compacto para não poluir.
 */
import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FaqEntry, SlideTone } from "@/data/faqContent";
import { FaqVisualBlock } from "./FaqVisualBlock";

interface Props {
  entry: FaqEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TONE_ACCENT: Record<SlideTone, string> = {
  neutral: "from-slate-500/10 to-transparent",
  info: "from-blue-500/10 to-transparent",
  warning: "from-amber-500/10 to-transparent",
  success: "from-emerald-500/10 to-transparent",
  danger: "from-red-500/10 to-transparent",
};

const TONE_DOT: Record<SlideTone, string> = {
  neutral: "bg-slate-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-red-500",
};

export function HelpSlideshowDialog({ entry, open, onOpenChange }: Props) {
  const [idx, setIdx] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    if (open) setIdx(0);
  }, [open, entry?.id]);

  const slides = entry?.slides ?? [];
  const total = slides.length;
  const slide = slides[idx];

  const go = useCallback(
    (delta: number) => {
      setIdx((cur) => Math.min(Math.max(cur + delta, 0), total - 1));
    },
    [total],
  );

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (!entry) return null;

  const tone: SlideTone = slide?.tone ?? entry.tone;
  const Icon = entry.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden gap-0 border-border/60"
        onPointerDownOutside={(e) => {
          // permite fechar clicando fora
        }}
      >
        {/* Header */}
        <div className={cn("relative px-6 pt-6 pb-4 bg-gradient-to-b", TONE_ACCENT[entry.tone])}>
          <div className="flex items-start gap-3 pr-8">
            <div className="h-10 w-10 rounded-xl bg-background border border-border/60 grid place-items-center shadow-sm flex-shrink-0">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight">
                {entry.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {idx + 1} de {total} · {entry.short}
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 h-7 w-7 grid place-items-center rounded-md hover:bg-muted/60 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Slide body */}
        <div
          className="px-6 py-5 min-h-[320px] flex flex-col"
          onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStart == null) return;
            const dx = e.changedTouches[0].clientX - touchStart;
            if (dx > 50) go(-1);
            else if (dx < -50) go(1);
            setTouchStart(null);
          }}
        >
          {slide && (
            <div key={idx} className="animate-in fade-in slide-in-from-right-2 duration-300 flex-1 flex flex-col">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} />
                {slide.title}
              </h3>
              <div className="text-[13px] text-muted-foreground whitespace-pre-line leading-relaxed mb-4">
                {slide.body}
              </div>
              {slide.visual && (
                <div className="flex-1 grid place-items-center pt-2">
                  <FaqVisualBlock visual={slide.visual} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer / navigation */}
        <div className="px-6 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => go(-1)}
            disabled={idx === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Ir para slide ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === idx ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                )}
              />
            ))}
          </div>

          {idx === total - 1 ? (
            <Button size="sm" onClick={() => onOpenChange(false)} className="gap-1">
              Entendi
            </Button>
          ) : (
            <Button size="sm" onClick={() => go(1)} className="gap-1">
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
