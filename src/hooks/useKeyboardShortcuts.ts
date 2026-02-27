import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export interface ShortcutGroup {
  label: string;
  shortcuts: { keys: string[]; description: string }[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: "Navegação Principal",
    shortcuts: [
      { keys: ["Alt", "M"], description: "Ir para o Mapa" },
      { keys: ["Alt", "P"], description: "Movimentações de Pacientes" },
      { keys: ["Alt", "R"], description: "Solicitações de Internação" },
      { keys: ["Alt", "H"], description: "Histórico de Internações" },
      { keys: ["Alt", "C"], description: "Códigos Médicos" },
      { keys: ["Alt", "D"], description: "Documentos" },
      { keys: ["Alt", "I"], description: "Examinus AI" },
      { keys: ["Alt", "V"], description: "Versões" },
      { keys: ["Alt", "T"], description: "Templates Terapêuticos" },
    ],
  },
  {
    label: "Ações Rápidas",
    shortcuts: [
      { keys: ["Ctrl/⌘", "K"], description: "Busca global de pacientes" },
      { keys: ["Alt", "K"], description: "Exibir atalhos de teclado" },
    ],
  },
];

interface UseKeyboardShortcutsOptions {
  onShowHelp: () => void;
}

export function useKeyboardShortcuts({ onShowHelp }: UseKeyboardShortcutsOptions) {
  const navigate = useNavigate();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      if (!e.altKey) return;

      const key = e.key.toLowerCase();

      const routeMap: Record<string, string> = {
        m: "/",
        p: "/movements",
        r: "/resources",
        h: "/internment-history",
        c: "/codigos",
        d: "/documents",
        i: "/ia",
        v: "/versions",
        t: "/therapeutic-templates",
        k: "__help__",
      };

      const route = routeMap[key];
      if (route) {
        e.preventDefault();
        if (route === "__help__") {
          onShowHelp();
        } else {
          navigate(route);
        }
      }
    },
    [navigate, onShowHelp]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
