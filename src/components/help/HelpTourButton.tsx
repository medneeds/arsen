/**
 * HelpTourButton — botão "?" circular discreto no canto inferior esquerdo.
 *
 * Posicionamento: `fixed bottom-5 left-5` (oposto à BatchActionBar, que mora
 * em `bottom-5 right-5`). Zero colisão.
 *
 * Visibilidade: só aparece nas rotas que têm tour cadastrado em
 * `helpTours.ts`. Em outras telas, fica invisível para não poluir.
 *
 * Sem atalho de teclado (decisão de produto).
 */

import { useLocation } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { getHelpTourForPath } from "@/lib/helpTours";
import {
  hasSeenHelpTour,
  useHelpTour,
} from "@/contexts/HelpTourContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function HelpTourButton() {
  const location = useLocation();
  const { open, isOpen } = useHelpTour();
  const tour = getHelpTourForPath(location.pathname);

  // Esconde quando a rota atual não tem tour OU quando o tour já está aberto
  // (evita botão "fantasma" embaixo do overlay).
  if (!tour || isOpen) return null;

  const isFirstTime = !hasSeenHelpTour();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={open}
          aria-label="Abrir ajuda desta página"
          className={cn(
            "fixed bottom-5 left-5 z-[60] flex h-10 w-10 items-center justify-center",
            "rounded-full border border-border bg-slate-200/80 text-slate-700",
            "shadow-md backdrop-blur-sm transition-all",
            "opacity-60 hover:opacity-100 hover:bg-slate-300 hover:scale-105",
            "dark:bg-slate-700/80 dark:text-slate-200 dark:hover:bg-slate-600",
            "print:hidden"
          )}
        >
          <HelpCircle className="h-5 w-5" />
          {isFirstTime && (
            // Pontinho discreto convidando o usuário a clicar na primeira vez.
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <span className="text-xs uppercase tracking-wide">
          Ajuda desta página
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
