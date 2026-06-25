import React, { useRef, KeyboardEvent, useMemo } from "react";
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { parsePendency, setPendencyDone } from "@/lib/pendencyMarker";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  /** Se true, habilita drag-and-drop (handle visível). Substitui os botões ▲▼. */
  draggable?: boolean;
  /** Se true, mostra uma checkbox à direita de cada item (estado persistido no próprio texto via `[x] `). */
  checkable?: boolean;
}

/**
 * Editor de lista de itens reutilizável.
 * Usado em hipóteses diagnósticas, antecedentes, plano e pendências.
 * Suporta reordenação por botões ▲▼, drag-and-drop (opcional), adição por Enter e remoção por ×.
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
  draggable = false,
  checkable = false,
}: ItemListEditorProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // IDs estáveis para o DnD — não usar índice (quebra animação ao reordenar).
  const idsRef = useRef<string[]>([]);
  const list = items.length > 0 ? items : [""];
  // Garante 1 id por linha; cresce/encolhe conforme a lista muda.
  while (idsRef.current.length < list.length) {
    idsRef.current.push(
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `row-${Math.random().toString(36).slice(2)}-${Date.now()}-${idsRef.current.length}`
    );
  }
  if (idsRef.current.length > list.length) {
    idsRef.current.length = list.length;
  }
  const ids = idsRef.current;

  const add = () => {
    if (items.length >= maxItems) return;
    const next = [...items, ""];
    onChange(next);
    setTimeout(() => inputRefs.current[next.length - 1]?.focus(), 50);
  };

  const update = (i: number, val: string) => {
    const next = [...items];
    if (checkable) {
      const { done } = parsePendency(items[i] ?? "");
      next[i] = setPendencyDone(val, done);
    } else {
      next[i] = val;
    }
    onChange(next);
  };

  const toggleCheck = (i: number, done: boolean) => {
    const next = [...items];
    next[i] = setPendencyDone(items[i] ?? "", done);
    onChange(next);
  };

  const remove = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    // mantém ids alinhados
    idsRef.current.splice(i, 1);
    onChange(next.length > 0 ? next : [""]);
    setTimeout(() => inputRefs.current[Math.max(0, i - 1)]?.focus(), 50);
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...items];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    [idsRef.current[i - 1], idsRef.current[i]] = [idsRef.current[i], idsRef.current[i - 1]];
    onChange(next);
  };

  const moveDown = (i: number) => {
    if (i === items.length - 1) return;
    const next = [...items];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    [idsRef.current[i], idsRef.current[i + 1]] = [idsRef.current[i + 1], idsRef.current[i]];
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

  // ---- DnD ---------------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    idsRef.current = arrayMove(idsRef.current, oldIndex, newIndex);
    onChange(arrayMove(items.length > 0 ? items : [""], oldIndex, newIndex));
  };

  const showArrowReorder = showReorder && !draggable && !readOnly;
  const showDragHandle = draggable && !readOnly;

  const renderRow = (item: string, i: number, dragProps?: {
    setNodeRef?: (el: HTMLElement | null) => void;
    style?: React.CSSProperties;
    attributes?: Record<string, unknown>;
    listeners?: Record<string, unknown>;
    isDragging?: boolean;
  }) => (
    <div
      ref={dragProps?.setNodeRef}
      style={dragProps?.style}
      className={cn(
        "flex items-center gap-1.5 group rounded-sm",
        dragProps?.isDragging && "bg-muted/60 shadow-sm ring-1 ring-border z-10 relative"
      )}
    >
      {/* Drag handle */}
      {showDragHandle && (
        <button
          type="button"
          aria-label="Arrastar para reordenar"
          className={cn(
            "shrink-0 p-0.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted touch-none",
            "cursor-grab active:cursor-grabbing opacity-40 group-hover:opacity-100 transition-opacity"
          )}
          tabIndex={-1}
          {...(dragProps?.attributes ?? {})}
          {...(dragProps?.listeners ?? {})}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}

      {/* Número ordinal */}
      {numbered && (
        <span className={cn("text-[10px] font-bold w-4 text-right shrink-0 select-none", numberColor)}>
          {i + 1}.
        </span>
      )}

      {/* Botões de reorder (legado, só quando draggable=false) */}
      {showArrowReorder && (
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
  );

  const rows = (
    <>
      {list.map((item, i) => {
        if (!showDragHandle) {
          return <React.Fragment key={ids[i] ?? i}>{renderRow(item, i)}</React.Fragment>;
        }
        return <SortableRow key={ids[i]} id={ids[i]} index={i} item={item} render={renderRow} />;
      })}
    </>
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {showDragHandle ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {rows}
          </SortableContext>
        </DndContext>
      ) : (
        rows
      )}

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

interface SortableRowProps {
  id: string;
  index: number;
  item: string;
  render: (
    item: string,
    i: number,
    dragProps: {
      setNodeRef: (el: HTMLElement | null) => void;
      style: React.CSSProperties;
      attributes: Record<string, unknown>;
      listeners: Record<string, unknown>;
      isDragging: boolean;
    }
  ) => React.ReactNode;
}

function SortableRow({ id, index, item, render }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return <>{render(item, index, {
    setNodeRef,
    style,
    attributes: attributes as unknown as Record<string, unknown>,
    listeners: (listeners ?? {}) as Record<string, unknown>,
    isDragging,
  })}</>;
}
