import { Button } from "@/components/ui/button";
import { Pencil, X, Plus, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueuedItem } from "@/hooks/useWizardItemQueue";

interface Props<T> {
  items: QueuedItem<T>[];
  editingUid: string | null;
  onEdit: (uid: string) => void;
  onRemove: (uid: string) => void;
  onAddCurrent: () => void;
  onSaveCurrent: () => void;
  /** Texto do botão "+ Acrescentar" quando não está editando. */
  addLabel?: string;
  /** Texto/cores específicos de cada wizard. */
  accentClassName?: string; // ex: "border-border bg-muted/40 text-foreground"
  /** Texto explicativo curto. */
  hint?: string;
  /** Bloqueia adicionar (ex: form inválido). */
  disableAdd?: boolean;
}

export function WizardItemQueue<T>({
  items,
  editingUid,
  onEdit,
  onRemove,
  onAddCurrent,
  onSaveCurrent,
  addLabel = "Acrescentar item",
  accentClassName = "border-primary/40 bg-primary/5 text-primary",
  hint,
  disableAdd,
}: Props<T>) {
  const hasItems = items.length > 0;
  const isEditing = editingUid !== null;

  return (
    <div className={cn(
      "rounded-md border p-2 space-y-2",
      hasItems ? accentClassName : "border-dashed border-border bg-muted/20 text-muted-foreground"
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider font-medium flex items-center gap-1">
          <ListChecks className="h-3 w-3" />
          {hasItems ? `Itens preparados (${items.length})` : "Nenhum item conjugado ainda"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={isEditing ? onSaveCurrent : onAddCurrent}
          disabled={disableAdd}
          className="h-6 px-2 gap-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          {isEditing ? "Salvar e continuar" : addLabel}
        </Button>
      </div>

      {hasItems && (
        <ul className="space-y-1">
          {items.map((it, idx) => {
            const isCurrent = it.uid === editingUid;
            return (
              <li
                key={it.uid}
                className={cn(
                  "flex items-start gap-2 rounded-md border bg-background/70 px-2 py-2 text-xs",
                  isCurrent ? "border-warning ring-1 ring-warning/40" : "border-border/60"
                )}
              >
                <span className="text-xs font-semibold text-muted-foreground mt-1 shrink-0 w-4">
                  {idx + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{it.label}</p>
                  {it.sublabel && (
                    <p className="text-xs text-muted-foreground truncate">{it.sublabel}</p>
                  )}
                  {isCurrent && (
                    <p className="text-xs text-warning-on-soft mt-1">
                      Editando — ajuste no formulário acima e clique em "Salvar e continuar".
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(it.uid)}
                    className="h-6 w-6 p-0"
                    aria-label="Editar item"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(it.uid)}
                    className="h-6 w-6 p-0 text-critical-on-soft hover:text-critical-on-soft"
                    aria-label="Remover item"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hint && !hasItems && (
        <p className="text-xs leading-snug">{hint}</p>
      )}
    </div>
  );
}
