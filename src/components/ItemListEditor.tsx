import React, { useRef, KeyboardEvent } from "react";
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ItemListEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  readOnly?: boolean;
  maxItems?: number;
  showReorder?: boolean;
  className?: string;
  inputClassName?: string;
  /** Se true, mostra número ordinal à esquerda de cada item */
  numbered?: boolean;
  /** Cor do número ordinal */
  numberColor?: string;
}

/**
 * Editor de lista de itens reutilizável.
 * Usado em hipóteses diagnósticas, antecedentes, plano e pendências.
 * Suporta reordenação por botões ▲▼, adição por Enter e remoção por ×.
 */
export function ItemListEditor({
  items,
  onChange,
  placeholder = "Novo item...",
  addLabel = "Adicionar",
  readOnly = false,
  maxItems = 30,
  showReorder = true,
  className,
  inputClassName,
  numbered = false,
  numberColor = "text-primary",
}: ItemListEditorProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const add = () => {
    if (items.length >= maxItems) return;
    const next = [...items, ""];
    onChange(next);
    setTimeout(() => inputRefs.current[next.length - 1]?.focus(), 50);
  };

  const update = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };

  const remove = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    onChange(next.length > 0 ? next : [""]);
    setTimeout(() => inputRefs.current[Math.max(0, i - 1)]?.focus(), 50);
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...items];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };

  const moveDown = (i: number) => {
    if (i === items.length - 1) return;
    const next = [...items];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (items[i].trim()) add();
    } else if (e.key === "Backspace" && !items[i] && items.length > 1) {
      e.preventDefault();
      remove(i);
    }
  };

  // Garantir sempre ao menos 1 linha
  const list = items.length > 0 ? items : [""];

  return (
    <div className={cn("space-y-1.5", className)}>
      {list.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 group">
          {/* Número ordinal */}
          {numbered && (
            <span className={cn("text-[10px] font-bold w-4 text-right shrink-0 select-none", numberColor)}>
              {i + 1}.
            </span>
          )}

          {/* Botões de reorder */}
          {showReorder && !readOnly && (
            <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={i === 0}
                className="p-0.5 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
                tabIndex={-1}
              >
                <ChevronUp className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={i === list.length - 1}
                className="p-0.5 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
                tabIndex={-1}
              >
                <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Campo de texto */}
          {readOnly ? (
            <span className={cn("flex-1 text-xs text-foreground py-1", !item && "text-muted-foreground italic")}>
              {item || "—"}
            </span>
          ) : (
            <Input
              ref={(el) => { inputRefs.current[i] = el; }}
              value={item}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => handleKey(e, i)}
              placeholder={placeholder}
              className={cn("h-7 text-xs flex-1", inputClassName)}
            />
          )}

          {/* Botão remover */}
          {!readOnly && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-1 rounded hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              tabIndex={-1}
              aria-label="Remover item"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}

      {/* Botão adicionar */}
      {!readOnly && list.length < maxItems && (
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1 pl-1"
        >
          <Plus className="h-3 w-3" />
          {addLabel}
        </button>
      )}
    </div>
  );
}
