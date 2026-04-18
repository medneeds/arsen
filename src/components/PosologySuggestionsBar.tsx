import { useState } from "react";
import { Sparkles, X, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PosologyProtocol } from "@/lib/posologyProtocols";
import { cn } from "@/lib/utils";

interface PosologySuggestionsBarProps {
  medicationName: string;
  protocols: PosologyProtocol[];
  onApply: (protocol: PosologyProtocol) => void;
  onDismiss: () => void;
  className?: string;
}

/**
 * Barra inline que aparece logo após adicionar um item à prescrição,
 * sugerindo protocolos comuns. Aplicar = preenche dose, via, posologia,
 * diluente etc. com 1 clique.
 */
export function PosologySuggestionsBar({
  medicationName,
  protocols,
  onApply,
  onDismiss,
  className,
}: PosologySuggestionsBarProps) {
  const [expanded, setExpanded] = useState(true);

  if (protocols.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm",
        "animate-in fade-in slide-in-from-top-1 duration-200",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-primary truncate">
            Protocolos sugeridos para {medicationName}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {protocols.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Ocultar" : "Ver"}
            <ChevronRight
              className={cn(
                "h-3 w-3 ml-1 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onDismiss}
            aria-label="Dispensar sugestões"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <TooltipProvider delayDuration={200}>
            {protocols.map((p, idx) => (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onApply(p)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border border-primary/40",
                      "bg-background hover:bg-primary hover:text-primary-foreground",
                      "px-2.5 py-1 text-xs font-medium transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-primary/40",
                    )}
                  >
                    <span>{p.label}</span>
                    <span className="opacity-70 font-normal">
                      {p.dose} · {p.route} · {p.posology}
                    </span>
                    {p.evidence && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 h-3.5 leading-none"
                      >
                        {p.evidence}
                      </Badge>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1 text-xs">
                    {p.indication && (
                      <p className="font-medium">{p.indication}</p>
                    )}
                    <p>
                      <strong>Dose:</strong> {p.dose}
                    </p>
                    <p>
                      <strong>Via:</strong> {p.route} · {p.posology}
                    </p>
                    {p.diluent && (
                      <p>
                        <strong>Diluente:</strong> {p.diluent} {p.diluentVolume}
                      </p>
                    )}
                    {p.infusionTime && (
                      <p>
                        <strong>Infundir em:</strong> {p.infusionTime} min
                      </p>
                    )}
                    {p.instructions && (
                      <p className="opacity-80">{p.instructions}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
