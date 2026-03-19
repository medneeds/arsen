import { ReactNode, useState } from "react";
import { whitelabel } from "@/config/whitelabel";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { PageTransition } from "@/components/PageTransition";
import { CultureNotifications } from "@/components/CultureNotifications";

interface MainLayoutProps {
  children: ReactNode;
  onOpenHandover?: () => void;
}

export function MainLayout({ children, onOpenHandover }: MainLayoutProps) {
  useUserPresence();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts({
    onShowHelp: () => setShowShortcuts(true),
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background relative">
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
    </SidebarProvider>
  );
}
