import { ReactNode, useState, useEffect } from "react";
import { whitelabel } from "@/config/whitelabel";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { PageTransition } from "@/components/PageTransition";
import { CultureNotifications } from "@/components/CultureNotifications";
import { useIsGestor } from "@/hooks/useIsGestor";
import { MobileMenuFab } from "@/components/MobileMenuFab";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
  onOpenHandover?: () => void;
}

export function MainLayout({ children, onOpenHandover }: MainLayoutProps) {
  useUserPresence();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const isGestor = useIsGestor();

  useKeyboardShortcuts({
    onShowHelp: () => setShowShortcuts(true),
  });

  // Aplica modo somente-leitura no body quando perfil é Gestor.
  // O CSS global em index.css desabilita botões de edição/ações destrutivas.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isGestor) {
      document.body.classList.add("gestor-readonly");
    } else {
      document.body.classList.remove("gestor-readonly");
    }
    return () => {
      document.body.classList.remove("gestor-readonly");
    };
  }, [isGestor]);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className={cn("min-h-screen flex w-full bg-background relative", isGestor && "gestor-readonly-root")}>
        <AppSidebar onOpenHandover={onOpenHandover} />
        
        <div className="flex-1 flex flex-col w-full">
          <main className="flex-1 overflow-auto">
            <PageTransition>
              {children}
            </PageTransition>
          </main>
          
          <footer className="hidden md:block fixed bottom-2 right-4 z-50 pointer-events-none">
            <p className="text-[10px] text-muted-foreground/40 italic">
              {whitelabel.credits.footerText}
            </p>
          </footer>
        </div>

        {/* Trigger global flutuante — sempre visível para abrir/fechar a sidebar em qualquer página */}
        <FloatingSidebarTrigger />
      </div>

      <MobileMenuFab />

      <GlobalSearchDialog />
      <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
      <CultureNotifications />
    </SidebarProvider>
  );
}

/** Botão flutuante persistente que alterna a sidebar — funciona em toda a plataforma */
function FloatingSidebarTrigger() {
  const { state, isMobile } = useSidebar();
  if (isMobile) return null; // mobile já tem o MobileMenuFab
  return (
    <SidebarTrigger
      className={cn(
        "fixed top-3 z-50 h-9 w-9 rounded-full border bg-background/90 shadow-sm backdrop-blur transition-all hover:bg-accent",
        state === "expanded" ? "left-[calc(var(--sidebar-width)+0.75rem)]" : "left-3",
      )}
      aria-label="Alternar menu lateral"
    />
  );
}
