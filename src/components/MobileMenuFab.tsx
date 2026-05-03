import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Floating menu button visible only on mobile/tablet (<md).
 * Garante que o menu lateral seja sempre acessível, mesmo em páginas
 * sem header/breadcrumb visível ou com header escuro/customizado.
 */
export function MobileMenuFab() {
  const { toggleSidebar, openMobile } = useSidebar();
  const isMobile = useIsMobile();

  if (!isMobile || openMobile) return null;

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Abrir menu"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      className={cn(
        "md:hidden fixed left-3 z-40",
        "h-12 w-12 rounded-full",
        "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
        "border border-primary/30",
        "flex items-center justify-center",
        "active:scale-95 transition-all duration-200",
        "print:hidden"
      )}
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
