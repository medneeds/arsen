import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SHORTCUT_GROUPS } from "@/hooks/useKeyboardShortcuts";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="h-5 w-5 text-primary" />
            Atalhos de Teclado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </h4>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded border border-border bg-muted text-[11px] font-mono font-medium text-muted-foreground shadow-sm">
                            {key}
                          </kbd>
                          {i < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground mx-0.5 text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Pressione <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Alt</kbd> + <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">K</kbd> a qualquer momento para exibir este painel
        </p>
      </DialogContent>
    </Dialog>
  );
}
