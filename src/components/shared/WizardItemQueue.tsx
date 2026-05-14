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
  accentClassName?: string; // ex: "border-blue-300 bg-blue-50/40 text-blue-700"
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
        <p className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1">
          <ListChecks className="h-3 w-3" />
          {hasItems ? `Itens preparados (${items.length})` : "Nenhum item conjugado ainda"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={isEditing ? onSaveCurrent : onAddCurrent}
          disabled={disableAdd}
          className="h-6 px-2 gap-1 text-[11px]"
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
                  "flex items-start gap-2 rounded border bg-background/70 px-2 py-1.5 text-xs",
                  isCurrent ? "border-amber-400 ring-1 ring-amber-400/40" : "border-border/60"
                )}
              >
                <span className="text-[10px] font-bold text-muted-foreground mt-0.5 shrink-0 w-4">
                  {idx + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{it.label}</p>
                  {it.sublabel && (
                    <p className="text-[10px] text-muted-foreground truncate">{it.sublabel}</p>
                  )}
                  {isCurrent && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                      ✎ Editando — ajuste no formulário acima e clique em "Salvar e continuar".
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
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
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
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
        <p className="text-[10px] leading-snug">{hint}</p>
      )}
    </div>
  );
}
