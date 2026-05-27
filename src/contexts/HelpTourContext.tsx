/**
 * HelpTourContext — estado global mínimo do tour de ajuda.
 *
 * Camada puramente de UI: guarda apenas `isOpen` e `currentStep`. Não
 * persiste dados clínicos, não acessa banco, não cria efeitos colaterais
 * fora do `localStorage` (usado só para lembrar "primeira abertura").
 *
 * O conteúdo do tour vem de `getHelpTourForPath(pathname)` em
 * `src/lib/helpTours.ts` — esse contexto não conhece o conteúdo, só navega.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type HelpTourState = {
  isOpen: boolean;
  currentStep: number;
  open: () => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  setStep: (i: number) => void;
};

const HelpTourContext = createContext<HelpTourState | null>(null);

const SEEN_KEY = "help_tour_seen";

export function HelpTourProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const open = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* localStorage indisponível — ignora silenciosamente */
    }
  }, []);

  const close = useCallback(() => setIsOpen(false), []);
  const next = useCallback(() => setCurrentStep((s) => s + 1), []);
  const prev = useCallback(() => setCurrentStep((s) => Math.max(0, s - 1)), []);
  const setStep = useCallback((i: number) => setCurrentStep(Math.max(0, i)), []);

  const value = useMemo(
    () => ({ isOpen, currentStep, open, close, next, prev, setStep }),
    [isOpen, currentStep, open, close, next, prev, setStep]
  );

  return (
    <HelpTourContext.Provider value={value}>{children}</HelpTourContext.Provider>
  );
}

export function useHelpTour() {
  const ctx = useContext(HelpTourContext);
  if (!ctx) {
    throw new Error("useHelpTour deve ser usado dentro de <HelpTourProvider>");
  }
  return ctx;
}

export function hasSeenHelpTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}
