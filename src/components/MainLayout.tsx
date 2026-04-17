import { ReactNode, useState, useEffect } from "react";
import { whitelabel } from "@/config/whitelabel";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { PageTransition } from "@/components/PageTransition";
import { CultureNotifications } from "@/components/CultureNotifications";
import { useIsGestor } from "@/hooks/useIsGestor";
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
          
          <footer className="fixed bottom-2 right-4 z-50 pointer-events-none">
            <p className="text-[10px] text-muted-foreground/40 italic">
              {whitelabel.credits.footerText}
            </p>
          </footer>
        </div>
      </div>

      <GlobalSearchDialog />
      <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
      <CultureNotifications />
    </SidebarProvider>
  );
}
