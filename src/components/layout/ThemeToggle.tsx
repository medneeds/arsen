import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Alternador de tema claro/escuro, discreto, para o PlatformHeader.
 *
 * - `onDark`: quando o toggle vive sobre o header navy institucional, usa o
 *   estilo branco-translucido (mesma linguagem dos demais botoes do header);
 *   fora dele, usa tokens (funciona nos dois temas).
 * - Guarda de `mounted`: o next-themes so conhece o tema resolvido apos montar;
 *   sem isto o icone pisca no valor errado no primeiro paint.
 */
export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className={cn(
        "h-8 w-8 shadow-sm transition-colors",
        onDark
          ? "bg-white/10 text-primary-foreground border-white/25 hover:bg-white/20 hover:text-primary-foreground"
          : "bg-background text-foreground border-border hover:bg-muted hover:text-primary",
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
