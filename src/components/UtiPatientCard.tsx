import { Patient } from "@/types/patient";
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Edit, ChevronDown, ChevronRight, MoreVertical, Check, X, Plus, GripVertical, Trash2, AlertTriangle, Stethoscope, ClipboardList, Clock, FileText, FolderOpen, Pill, Activity, Heart, User, Star, Printer, TrendingUp, Skull, ArrowRightLeft, ArrowLeftRight, BedDouble, DoorOpen, UserPlus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Clinical status options with refined colors - only critical ones are vibrant
const CLINICAL_STATUS_OPTIONS = [
  { value: "gravissimo", label: "GRAVÍSSIMO", color: "bg-red-600 text-white", borderColor: "border-red-600" },
  { value: "grave", label: "GRAVE", color: "bg-red-500 text-white", borderColor: "border-red-500" },
  { value: "grave_estavel", label: "GRAVE, PORÉM ESTÁVEL", color: "bg-amber-600 text-white", borderColor: "border-amber-600" },
  { value: "potencialmente_grave", label: "POTENCIALMENTE GRAVE", color: "bg-amber-500 text-white", borderColor: "border-amber-500" },
  { value: "regular", label: "REGULAR", color: "bg-slate-500 text-white", borderColor: "border-slate-500" },
  { value: "paliativado", label: "CUIDADOS PALIATIVOS", color: "bg-violet-600 text-white", borderColor: "border-violet-600" },
  { value: "protocolo_me", label: "EM PROTOCOLO DE ME", color: "bg-gray-800 text-white", borderColor: "border-gray-800" },
] as const;

// Text inputs no longer forced to uppercase
import { cn } from "@/lib/utils";
import { EditPatientDialog } from "./EditPatientDialog";
import { PatientMovementDialog } from "./PatientMovementDialog";
import { UtiReallocationDialog } from "./UtiReallocationDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePrivacy, maskName } from "@/contexts/PrivacyContext";

type ColorVariant = 'blue' | 'yellow' | 'red' | 'green';

interface UtiPatientCardProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  onDelete?: (patientId: string) => void;
  onPrintPatient?: (patientId: string) => void;
  onRefetch?: () => void;
  colorVariant?: ColorVariant;
  forceCollapsed?: boolean;
  allPatients?: Patient[]; // All UTI patients for reallocation
  currentUtiUnit?: string; // "UTI 1" or "UTI 2"
}

// Calculate days in UTI
function calculateDaysInUti(admissionDate: string[] | undefined): number {
  if (!admissionDate || admissionDate.length === 0) return 0;
  const dateStr = admissionDate[0];
  if (!dateStr) return 0;
  
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      if (!isNaN(d.getTime())) {
        return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    return 0;
  }
  return Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
}

// Sortable Item for drag-and-drop with optional highlight
interface SortableItemProps {
  id: string;
  index: number;
  value: string;
  onEdit: (newValue: string) => void;
  onDelete: () => void;
  showDragHandle?: boolean;
  isHighlighted?: boolean;
  onToggleHighlight?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  autoFocus?: boolean;
  highlightColorVariant?: 'blue' | 'yellow' | 'red' | 'green';
}

function SortableItem({ id, index, value, onEdit, onDelete, showDragHandle = true, isHighlighted, onToggleHighlight, onKeyDown, autoFocus, highlightColorVariant = 'blue' }: SortableItemProps) {
  const [isEditing, setIsEditing] = useState(autoFocus || false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      setIsEditing(true);
    }
  }, [autoFocus]);

  const handleSave = () => {
    if (localValue.trim()) {
      onEdit(localValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
      onKeyDown?.(e);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleSave();
      onKeyDown?.(e);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // Highlight color styles based on variant
  const highlightStyles: Record<string, { bg: string; number: string; text: string; star: string }> = {
    blue: {
      bg: "bg-blue-100/60 dark:bg-blue-800/30 border-l-2 border-l-blue-500 dark:border-l-blue-400 pl-1.5",
      number: "text-blue-600 dark:text-blue-300",
      text: "text-blue-800 dark:text-blue-100",
      star: "fill-blue-500 text-blue-500"
    },
    yellow: {
      bg: "bg-amber-100/60 dark:bg-amber-800/30 border-l-2 border-l-amber-500 dark:border-l-amber-400 pl-1.5",
      number: "text-amber-600 dark:text-amber-300",
      text: "text-amber-800 dark:text-amber-100",
      star: "fill-amber-500 text-amber-500"
    },
    red: {
      bg: "bg-red-100/60 dark:bg-red-800/30 border-l-2 border-l-red-500 dark:border-l-red-400 pl-1.5",
      number: "text-red-600 dark:text-red-300",
      text: "text-red-800 dark:text-red-100",
      star: "fill-red-500 text-red-500"
    },
    green: {
      bg: "bg-emerald-100/60 dark:bg-emerald-800/30 border-l-2 border-l-emerald-500 dark:border-l-emerald-400 pl-1.5",
      number: "text-emerald-600 dark:text-emerald-300",
      text: "text-emerald-800 dark:text-emerald-100",
      star: "fill-emerald-500 text-emerald-500"
    }
  };
  const hStyles = highlightStyles[highlightColorVariant];

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "flex items-center gap-1 group py-1 rounded-sm px-1 -mx-0.5 transition-all duration-150",
        isDragging && "z-50 shadow-sm",
        isHighlighted ? hStyles.bg : "hover:bg-muted/30"
      )}
    >
      {showDragHandle && (
        <button
          className="cursor-grab active:cursor-grabbing p-0 opacity-30 hover:opacity-80 transition-opacity flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
        </button>
      )}
      <span className={cn(
        "font-semibold text-[10px] min-w-[14px] flex-shrink-0 tabular-nums",
        isHighlighted ? hStyles.number : "text-muted-foreground"
      )}>{index + 1}.</span>
      
      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className="flex-1 text-[11px] bg-background border border-primary/30 rounded px-1.5 py-0.5 outline-none font-medium tracking-tight"
            onKeyDown={handleKeyDownInternal}
            onBlur={handleSave}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : (
        <>
          <span 
            className={cn(
              "flex-1 text-[11px] break-words cursor-pointer hover:text-primary transition-colors leading-relaxed tracking-tight",
              isHighlighted ? hStyles.text : "text-foreground/90"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            {value}
          </span>
          {onToggleHighlight && (
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggleHighlight();
              }}
            >
              <Star className={cn(
                "h-2.5 w-2.5 transition-colors",
                isHighlighted ? hStyles.star : "text-muted-foreground"
              )} />
            </Button>
          )}
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-2.5 w-2.5 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
}

// Inline editable array field with full functionality
interface InlineEditableArrayProps {
  items: string[];
  onUpdate: (items: string[]) => void;
  placeholder?: string;
  showNumbers?: boolean;
  colorClass?: string;
  maxCollapsedItems?: number;
  label?: string;
  icon?: React.ReactNode;
  alwaysShowAll?: boolean;
  highlightedIndices?: number[];
  onUpdateHighlights?: (indices: number[]) => void;
  // Combined update for items + highlights (prevents race conditions on delete)
  onUpdateBoth?: (items: string[], highlights: number[]) => void;
  onEnterPress?: () => void;
  onTabPress?: () => void;
  fieldId?: string;
  isActive?: boolean;
  iconColorClass?: string;
  highlightColorVariant?: 'blue' | 'yellow' | 'red' | 'green';
}

function InlineEditableArray({ 
  items, 
  onUpdate, 
  placeholder = "Clique para adicionar",
  showNumbers = true,
  colorClass,
  maxCollapsedItems,
  label,
  icon,
  alwaysShowAll = false,
  highlightedIndices = [],
  onUpdateHighlights,
  onUpdateBoth,
  onEnterPress,
  onTabPress,
  fieldId,
  isActive,
  iconColorClass = "text-primary/60 hover:text-primary",
  highlightColorVariant = 'blue'
}: InlineEditableArrayProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItemValue, setNewItemValue] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);

  // Stable IDs per item (required by dnd-kit). We keep an internal parallel array of ids
  // and reorder it together with items.
  const makeId = () => {
    const prefix = fieldId || 'item';
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  };

  const [itemIds, setItemIds] = useState<string[]>(() => items.map(() => makeId()));
  
  // Track previous items length to detect external changes vs internal changes
  const prevItemsLengthRef = useRef(items.length);
  const isInternalChangeRef = useRef(false);

  // Keep ids array length in sync with items length
  useEffect(() => {
    // If this is an internal change (we already handled it), skip
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      prevItemsLengthRef.current = items.length;
      return;
    }
    
    setItemIds((prev) => {
      if (prev.length === items.length) return prev;
      if (prev.length < items.length) {
        // Items were added externally
        const toAdd = items.length - prev.length;
        return [...prev, ...Array.from({ length: toAdd }, () => makeId())];
      }
      // Items were removed externally - trim from end
      return prev.slice(0, items.length);
    });
    
    prevItemsLengthRef.current = items.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Activate adding mode when this column becomes active
  useEffect(() => {
    if (isActive) {
      setIsAddingNew(true);
    }
  }, [isActive]);

  useEffect(() => {
    if (isAddingNew && newInputRef.current) {
      newInputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = itemIds.findIndex(id => id === active.id);
      const newIndex = itemIds.findIndex(id => id === over.id);
      
      if (oldIndex === -1 || newIndex === -1) return;
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      const newIds = arrayMove(itemIds, oldIndex, newIndex);
      
      // Reorder highlights correctly: map old highlight indices to new positions
      let newHighlights: number[] = [];
      if (onUpdateHighlights && highlightedIndices.length > 0) {
        newHighlights = highlightedIndices.map(idx => {
          if (idx === oldIndex) return newIndex;
          if (oldIndex < newIndex) {
            // Item moved down: indices between shift up by 1
            if (idx > oldIndex && idx <= newIndex) return idx - 1;
          } else {
            // Item moved up: indices between shift down by 1
            if (idx >= newIndex && idx < oldIndex) return idx + 1;
          }
          return idx;
        });
      }
      
      // Update both items and highlights in a single batch
      isInternalChangeRef.current = true;
      setItemIds(newIds);
      
      // Use combined update to prevent race conditions
      if (onUpdateBoth && highlightedIndices.length > 0) {
        onUpdateBoth(newItems, newHighlights);
      } else {
        onUpdate(newItems);
        if (onUpdateHighlights && highlightedIndices.length > 0) {
          onUpdateHighlights(newHighlights);
        }
      }
    }
  };

  const handleAddItem = (continueAdding: boolean = false) => {
    if (newItemValue.trim()) {
      isInternalChangeRef.current = true;
      setItemIds((prev) => [...prev, makeId()]);
      onUpdate([...items, newItemValue.trim()]);
      setNewItemValue("");
      if (!continueAdding) {
        setIsAddingNew(false);
      }
    } else {
      setIsAddingNew(false);
    }
  };

  const handleNewItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Enter: salva e continua adicionando na mesma coluna
      handleAddItem(true);
      onEnterPress?.();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab: salva e move para próxima coluna
      handleAddItem(false);
      onTabPress?.();
    } else if (e.key === 'Escape') {
      setIsAddingNew(false);
      setNewItemValue("");
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Enter pressed on existing item - start adding new
      setIsAddingNew(true);
    } else if (e.key === 'Tab') {
      // Tab pressed - move to next column
      onTabPress?.();
    }
  };

  const toggleHighlight = (index: number) => {
    if (!onUpdateHighlights) return;
    const isHighlighted = highlightedIndices.includes(index);
    if (isHighlighted) {
      onUpdateHighlights(highlightedIndices.filter(i => i !== index));
    } else {
      onUpdateHighlights([...highlightedIndices, index]);
    }
  };

  const displayItems = maxCollapsedItems && !alwaysShowAll ? items.slice(0, maxCollapsedItems) : items;
  const hiddenCount = maxCollapsedItems && !alwaysShowAll ? Math.max(0, items.length - maxCollapsedItems) : 0;

  return (
    <div className={cn("rounded-md p-1.5", colorClass)}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">{label}</span>
            {items.length > 0 && (
              <Badge variant="secondary" className="h-3.5 px-1 text-[9px] font-medium">{items.length}</Badge>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-4 w-4", iconColorClass)}
            onClick={(e) => {
              e.stopPropagation();
              setIsAddingNew(true);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      <div className="space-y-0.5">
        {items.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itemIds.slice(0, displayItems.length)} strategy={verticalListSortingStrategy}>
              {displayItems.map((item, displayIdx) => {
                // displayIdx is the index in displayItems, which may be limited
                // For all operations, we need the real index in the full items array
                const realIdx = displayIdx; // Since displayItems = items.slice(0, maxCollapsedItems), displayIdx === realIdx for displayed items
                
                return (
                  <SortableItem
                    key={itemIds[realIdx]}
                    id={itemIds[realIdx]}
                    index={realIdx}
                    value={item}
                    onEdit={(newValue) => {
                      const newItems = [...items];
                      newItems[realIdx] = newValue;
                      onUpdate(newItems);
                    }}
                    onDelete={() => {
                      isInternalChangeRef.current = true;
                      setItemIds((prev) => prev.filter((_, i) => i !== realIdx));
                      const newItems = items.filter((_, i) => i !== realIdx);
                      const newHighlights = highlightedIndices
                        .filter(i => i !== realIdx)
                        .map(i => i > realIdx ? i - 1 : i);
                      
                      // Use combined update to prevent race conditions
                      if (onUpdateBoth) {
                        onUpdateBoth(newItems, newHighlights);
                      } else {
                        onUpdate(newItems);
                        if (onUpdateHighlights) {
                          onUpdateHighlights(newHighlights);
                        }
                      }
                    }}
                    showDragHandle={showNumbers}
                    isHighlighted={highlightedIndices.includes(realIdx)}
                    onToggleHighlight={onUpdateHighlights ? () => toggleHighlight(realIdx) : undefined}
                    onKeyDown={handleItemKeyDown}
                    highlightColorVariant={highlightColorVariant}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        ) : !isAddingNew ? (
          <span 
            className="text-[11px] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground italic pl-0.5"
            onClick={() => setIsAddingNew(true)}
          >
            {placeholder}
          </span>
        ) : null}
        
        {hiddenCount > 0 && (
          <span className="text-[10px] text-muted-foreground pl-5 italic">+{hiddenCount} mais</span>
        )}
        
        {isAddingNew && (
          <div className="flex items-center gap-1 mt-1 pt-1 border-t border-border/30">
            <input
              ref={newInputRef}
              type="text"
              value={newItemValue}
              onChange={(e) => setNewItemValue(e.target.value)}
              placeholder="Novo item..."
              className="flex-1 text-[11px] bg-background border border-primary/30 rounded px-1.5 py-1 outline-none font-medium tracking-tight placeholder:font-normal placeholder:text-muted-foreground/50"
              onKeyDown={handleNewItemKeyDown}
              onBlur={() => handleAddItem(false)}
            />
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleAddItem(false)}>
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-5 w-5" 
              onClick={() => {
                setIsAddingNew(false);
                setNewItemValue("");
              }}
            >
              <X className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        )}
        
        {!label && !isAddingNew && items.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className={cn("h-5 text-[10px] p-0 mt-1.5", iconColorClass)}
            onClick={(e) => {
              e.stopPropagation();
              setIsAddingNew(true);
            }}
          >
            <Plus className="h-3 w-3 mr-0.5" /> Adicionar
          </Button>
        )}
      </div>
    </div>
  );
}

// Single value inline editable field
interface InlineEditableFieldProps {
  value: string;
  onUpdate: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function InlineEditableField({ value, onUpdate, placeholder = "-", className }: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = () => {
    onUpdate(localValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className={cn("bg-background border border-primary/30 rounded px-1.5 py-0.5 outline-none text-sm w-full", className)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') setIsEditing(false);
        }}
        onBlur={handleSave}
      />
    );
  }

  return (
    <span 
      className={cn("cursor-pointer hover:text-primary transition-colors", className)}
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      {value || <span className="text-muted-foreground/50">{placeholder}</span>}
    </span>
  );
}

// Collapsible inline editable textarea for longer text - optimized for space
interface InlineEditableTextareaProps {
  value: string;
  onUpdate: (value: string) => void;
  placeholder?: string;
}

function InlineEditableTextarea({ value, onUpdate, placeholder = "-" }: InlineEditableTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check if content overflows the collapsed height
  const [hasOverflow, setHasOverflow] = useState(false);
  
  useEffect(() => {
    if (contentRef.current && !isEditing) {
      const element = contentRef.current;
      // Check if content height exceeds collapsed max height (48px = ~3 lines)
      setHasOverflow(element.scrollHeight > 48);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = () => {
    onUpdate(localValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
        }}
        className="w-full bg-background border border-primary/30 rounded px-2 py-1.5 outline-none text-xs min-h-[80px] max-h-[300px] resize-y overflow-auto"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsEditing(false);
        }}
        onBlur={handleSave}
        onClick={(e) => e.stopPropagation()}
        style={{ resize: 'vertical' }}
      />
    );
  }

  return (
    <div className="relative">
      <div 
        ref={contentRef}
        className={cn(
          "cursor-pointer hover:text-primary transition-all duration-200 text-xs whitespace-pre-wrap overflow-hidden",
          !isTextExpanded && hasOverflow ? "max-h-[48px]" : "max-h-none"
        )}
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        {value || <span className="text-muted-foreground/50 italic text-xs">{placeholder}</span>}
      </div>
      
      {/* Gradient fade when collapsed with overflow */}
      {hasOverflow && !isTextExpanded && !isEditing && (
        <div className="absolute bottom-5 left-0 right-0 h-4 bg-gradient-to-t from-muted/30 to-transparent pointer-events-none" />
      )}
      
      {/* Expand/Collapse button - only show if content overflows */}
      {hasOverflow && !isEditing && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground hover:text-primary mt-0.5"
          onClick={(e) => {
            e.stopPropagation();
            setIsTextExpanded(!isTextExpanded);
          }}
        >
          {isTextExpanded ? (
            <>
              <ChevronDown className="h-3 w-3 mr-0.5 rotate-180" />
              Retrair
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-0.5" />
              Expandir
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export function UtiPatientCard({ 
  patient, 
  onUpdate, 
  onDelete,
  onPrintPatient,
  onRefetch,
  colorVariant = 'blue',
  forceCollapsed,
  allPatients = [],
  currentUtiUnit
}: UtiPatientCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Movement dialog states
  const [movementType, setMovementType] = useState<"ALTA" | "ÓBITO" | "TRANSFERÊNCIA" | null>(null);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isReallocationDialogOpen, setIsReallocationDialogOpen] = useState(false);

  // Derive current UTI unit from colorVariant if not provided
  const derivedUtiUnit = currentUtiUnit || (colorVariant === 'blue' ? 'UTI 1' : 'UTI 2');
  const { namesHidden } = usePrivacy();
  const displayName = maskName(patient.name, namesHidden);

  // Sync with forceCollapsed prop when it changes
  useEffect(() => {
    if (forceCollapsed !== undefined) {
      setIsCollapsed(forceCollapsed);
    }
  }, [forceCollapsed]);
  const [activeColumn, setActiveColumn] = useState<'diagnoses' | 'antecedentes' | 'condutas' | 'pendencias' | null>(null);

  // Movement handlers
  const handleMovement = (type: "ALTA" | "ÓBITO" | "TRANSFERÊNCIA") => {
    setMovementType(type);
    setIsMovementDialogOpen(true);
  };

  const handleMovementSuccess = async () => {
    // Clear patient data after discharge/death/transfer (but keep the bed slot)
    // Mark the bed as vacant after movement
    const emptyPatient: Patient = {
      ...patient,
      name: "",
      age: "",
      diagnoses: [],
      medicalHistory: [],
      pendencies: [],
      relevantExams: [],
      schedule: [],
      admissionHistory: "",
      admissionDate: "",
      internmentNotes: null,
      internmentStatus: null,
      utiOriginSector: [],
      utiAdmissionDate: [],
      utiAdmissionReason: [],
      utiAllergies: [],
      utiCurrentStatus: [],
      utiDevices: [],
      utiSpecialties: [],
      utiCulturesAntibiotics: [],
      utiDailyConducts: [],
      utiDischargePrediction: [],
      highlightedDiagnoses: [],
      highlightedMedicalHistory: [],
      highlightedPendencies: [],
      highlightedConducts: [],
      medicalResponsibility: undefined,
      clinicalStatus: null,
      psmStatus: null,
      isVacant: true, // Mark bed as vacant after movement
    };
    
    // Update the patient - this persists to database
    onUpdate(emptyPatient);
    
    // Close dialog
    setIsMovementDialogOpen(false);
    setMovementType(null);
    
    // Note: Don't call onRefetch here as it may race with the update
    // The realtime subscription will handle syncing the data
  };

  const handleReallocationSuccess = () => {
    setIsReallocationDialogOpen(false);
    onRefetch?.();
  };

  // Color schemes based on variant
  const colorSchemes: Record<ColorVariant, Record<string, string>> = {
    blue: {
      card: "bg-slate-100 dark:bg-slate-900/80 border-primary/20",
      bedBg: "bg-primary/10 border-primary/20",
      bedText: "text-primary",
      col1: "bg-blue-100/70 dark:bg-blue-900/35 border-blue-300/50 dark:border-blue-700/45",
      col1Icon: "text-blue-500 dark:text-blue-300",
      col2: "bg-blue-100/70 dark:bg-blue-900/35 border-blue-300/50 dark:border-blue-700/45",
      col2Icon: "text-blue-500 dark:text-blue-300",
      col3: "bg-blue-100/70 dark:bg-blue-900/35 border-blue-300/50 dark:border-blue-700/45",
      col3Icon: "text-blue-500 dark:text-blue-300",
      col4: "bg-blue-100/70 dark:bg-blue-900/35 border-blue-300/50 dark:border-blue-700/45",
      col4Icon: "text-blue-500 dark:text-blue-300",
    },
    yellow: {
      card: "bg-amber-50/50 dark:bg-amber-950/30 border-amber-400/30",
      bedBg: "bg-amber-100 dark:bg-amber-900/40 border-amber-300/50 dark:border-amber-700/40",
      bedText: "text-amber-700 dark:text-amber-400",
      col1: "bg-amber-100/50 dark:bg-amber-900/30 border-amber-200/50 dark:border-amber-700/40",
      col1Icon: "text-amber-500 dark:text-amber-300",
      col2: "bg-amber-100/50 dark:bg-amber-900/30 border-amber-200/50 dark:border-amber-700/40",
      col2Icon: "text-amber-500 dark:text-amber-300",
      col3: "bg-amber-100/50 dark:bg-amber-900/30 border-amber-200/50 dark:border-amber-700/40",
      col3Icon: "text-amber-500 dark:text-amber-300",
      col4: "bg-amber-100/50 dark:bg-amber-900/30 border-amber-200/50 dark:border-amber-700/40",
      col4Icon: "text-amber-500 dark:text-amber-300",
    },
    red: {
      card: "bg-red-50/50 dark:bg-red-950/30 border-red-400/30",
      bedBg: "bg-red-100 dark:bg-red-900/40 border-red-300/50 dark:border-red-700/40",
      bedText: "text-red-700 dark:text-red-400",
      col1: "bg-red-100/50 dark:bg-red-900/30 border-red-200/50 dark:border-red-700/40",
      col1Icon: "text-red-500 dark:text-red-300",
      col2: "bg-red-100/50 dark:bg-red-900/30 border-red-200/50 dark:border-red-700/40",
      col2Icon: "text-red-500 dark:text-red-300",
      col3: "bg-red-100/50 dark:bg-red-900/30 border-red-200/50 dark:border-red-700/40",
      col3Icon: "text-red-500 dark:text-red-300",
      col4: "bg-red-100/50 dark:bg-red-900/30 border-red-200/50 dark:border-red-700/40",
      col4Icon: "text-red-500 dark:text-red-300",
    },
    green: {
      card: "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-400/30",
      bedBg: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300/50 dark:border-emerald-700/40",
      bedText: "text-emerald-700 dark:text-emerald-400",
      col1: "bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-200/50 dark:border-emerald-700/40",
      col1Icon: "text-emerald-500 dark:text-emerald-300",
      col2: "bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-200/50 dark:border-emerald-700/40",
      col2Icon: "text-emerald-500 dark:text-emerald-300",
      col3: "bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-200/50 dark:border-emerald-700/40",
      col3Icon: "text-emerald-500 dark:text-emerald-300",
      col4: "bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-200/50 dark:border-emerald-700/40",
      col4Icon: "text-emerald-500 dark:text-emerald-300",
    }
  };

  const colors = colorSchemes[colorVariant];

  const daysInUti = useMemo(() => calculateDaysInUti(patient.utiAdmissionDate), [patient.utiAdmissionDate]);

  const getFieldArray = (key: keyof Patient): string[] => {
    const value = patient[key];
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    if (typeof value === 'string' && value.includes('\n')) {
      return value.split('\n').filter(v => v.trim() !== '');
    }
    return value ? [value as string] : [];
  };

  const handleUpdateField = (key: keyof Patient, value: string | string[] | number[]) => {
    onUpdate({
      ...patient,
      [key]: value
    });
  };

  // Toggle bed vacancy status
  const handleToggleVacancy = (isVacant: boolean) => {
    onUpdate({
      ...patient,
      isVacant
    });
  };

  // Combined update for items + highlights to prevent race conditions on delete/drag
  const handleUpdateBothFields = (
    itemsKey: keyof Patient, 
    items: string[], 
    highlightsKey: keyof Patient, 
    highlights: number[]
  ) => {
    onUpdate({
      ...patient,
      [itemsKey]: items,
      [highlightsKey]: highlights
    });
  };

  // Tab navigation between columns: diagnoses → antecedentes → condutas → pendencias
  const handleTabFromColumn = (column: 'diagnoses' | 'antecedentes' | 'condutas' | 'pendencias') => {
    const columnOrder: ('diagnoses' | 'antecedentes' | 'condutas' | 'pendencias')[] = ['diagnoses', 'antecedentes', 'condutas', 'pendencias'];
    const currentIndex = columnOrder.indexOf(column);
    const nextIndex = (currentIndex + 1) % columnOrder.length;
    setActiveColumn(columnOrder[nextIndex]);
  };

  // Field data
  const antecedentes = getFieldArray("medicalHistory");
  const pendencias = getFieldArray("pendencies");
  const previsaoAlta = getFieldArray("utiDischargePrediction");
  const condutasDia = getFieldArray("utiDailyConducts");
  const dispositivos = getFieldArray("utiDevices");
  const culturasAtb = getFieldArray("utiCulturesAntibiotics");
  const alergias = getFieldArray("utiAllergies");
  const diagnosticos = getFieldArray("diagnoses");
  const especialidades = getFieldArray("utiSpecialties");
  const exames = getFieldArray("relevantExams");
  const setorOrigem = getFieldArray("utiOriginSector");
  const motivoAdmissao = getFieldArray("utiAdmissionReason");

  // Count critical items for badge
  const criticalCount = dispositivos.length + culturasAtb.length + alergias.length;

  return (
    <>
      <div 
        className={cn("border rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-200", colors.card)}
        data-patient-id={patient.id}
      >
        {/* VACANT BED VIEW */}
        {patient.isVacant ? (
          <div className="flex items-center justify-between p-2 md:p-3">
            <div className="flex items-center gap-2">
              {/* Bed Number */}
              <div className={cn("shrink-0 px-1.5 py-0.5 rounded border", colors.bedBg)}>
                <span className={cn("text-xs font-bold", colors.bedText)}>{patient.bedNumber}</span>
              </div>
              {/* Vacant Message */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <DoorOpen className="h-4 w-4" />
                <span className="text-sm font-medium italic">Leito Vago</span>
              </div>
            </div>
            {/* Actions for vacant bed */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleVacancy(false)}
                className={cn(
                  "h-7 text-xs gap-1.5",
                  colorVariant === 'blue' 
                    ? "border-primary/40 text-primary hover:bg-primary/10" 
                    : "border-amber-500/40 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                )}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Liberar para Preenchimento
              </Button>
              {onDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border shadow-lg z-50 w-40">
                    <DropdownMenuItem 
                      onClick={() => onDelete(patient.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Leito
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ) : (
          /* OCCUPIED BED VIEW - Normal card */
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          {/* Header - Collapsed View - FULLY EDITABLE */}
          <div className="flex items-stretch">
            {/* Main Content - Collapsed View */}
            <div className="flex-1 p-1.5 md:p-1.5 space-y-1.5 md:space-y-1 min-w-0">
              {/* Row 1: Identification Header - Mobile optimized */}
              <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
                {/* Collapse/Expand Toggle Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="shrink-0 h-5 w-5 p-0 text-muted-foreground hover:text-foreground transition-colors"
                  title={isCollapsed ? "Expandir subseções" : "Retrair subseções"}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                
                {/* Bed Number - Compact */}
                <div className={cn("shrink-0 px-1.5 py-0.5 rounded border", colors.bedBg)}>
                  <InlineEditableField
                    value={patient.bedNumber}
                    onUpdate={(v) => handleUpdateField("bedNumber", v)}
                    placeholder="LEITO"
                    className={cn("text-xs font-bold w-8 md:w-10 text-center", colors.bedText)}
                  />
                </div>
                
                {/* Patient Name + Age - Flexible grow */}
                <div className="flex-1 flex items-baseline gap-1 md:gap-1.5 min-w-0">
                  {namesHidden ? (
                    <span className="text-xs md:text-sm font-semibold truncate tracking-widest opacity-70">{displayName}</span>
                  ) : (
                    <InlineEditableField
                      value={patient.name}
                      onUpdate={(v) => handleUpdateField("name", v)}
                      placeholder="NOME DO PACIENTE"
                      className="text-xs md:text-sm font-semibold truncate"
                    />
                  )}
                  <div className="shrink-0 flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground">
                    <InlineEditableField
                      value={String(patient.age || "").replace(/\s*anos?\s*$/i, "")}
                      onUpdate={(v) => handleUpdateField("age", v)}
                      placeholder="IDADE"
                      className="w-8 text-center"
                    />
                    {patient.age && <span>anos</span>}
                  </div>
                </div>

                {/* Mobile: Chips wrap to second line */}
                <div className="flex items-center gap-1 flex-wrap md:flex-nowrap w-full md:w-auto mt-1 md:mt-0">
                  {/* Clinical Status - Discreet color dot */}
                  <Select
                    value={patient.clinicalStatus || ""}
                    onValueChange={(v) => handleUpdateField("clinicalStatus", v)}
                  >
                    <SelectTrigger 
                      className="shrink-0 h-5 w-5 p-0 border-0 bg-transparent shadow-none focus:ring-0 [&>svg]:hidden"
                      onClick={(e) => e.stopPropagation()}
                      title={patient.clinicalStatus 
                        ? CLINICAL_STATUS_OPTIONS.find(o => o.value === patient.clinicalStatus)?.label 
                        : "Classificação"
                      }
                    >
                      <div className={cn(
                        "w-3 h-3 rounded-full border-2 transition-colors mx-auto",
                        patient.clinicalStatus 
                          ? CLINICAL_STATUS_OPTIONS.find(o => o.value === patient.clinicalStatus)?.color || "bg-muted border-muted-foreground/30"
                          : "bg-muted border-muted-foreground/30"
                      )} />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINICAL_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2.5 h-2.5 rounded-full", option.color)} />
                            <span className="text-xs font-medium">{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Days in UTI - Fixed width for consistent alignment */}
                  <div className={cn(
                    "shrink-0 flex items-center justify-center gap-1 w-[70px] md:w-[80px] px-2 py-0.5 rounded-md border",
                    daysInUti > 4 
                      ? "bg-red-100 dark:bg-red-900/40 border-red-400/50 dark:border-red-600/50" 
                      : colorVariant === 'yellow' 
                        ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300/50 dark:border-amber-600/40" 
                        : "bg-primary/15 dark:bg-primary/25 border-primary/30"
                  )}>
                    <span className={cn(
                      "text-[9px] font-bold", 
                      daysInUti > 4 
                        ? "text-red-700 dark:text-red-300" 
                        : colorVariant === 'yellow' 
                          ? "text-amber-700 dark:text-amber-400" 
                          : "text-primary"
                    )}>
                      DIH:
                    </span>
                    <span className={cn(
                      "text-xs font-bold min-w-[20px] text-center", 
                      daysInUti > 4 
                        ? "text-red-700 dark:text-red-300" 
                        : colorVariant === 'yellow' 
                          ? "text-amber-700 dark:text-amber-400" 
                          : "text-primary"
                    )}>
                      {daysInUti}
                    </span>
                    {daysInUti > 4 ? (
                      <span title="Longa permanência">
                        <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                      </span>
                    ) : (
                      <span className="w-3" /> 
                    )}
                  </div>

                  {/* UTI Admission Date */}
                  <div className="hidden md:flex shrink-0 items-center gap-1 text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    <span className="text-[9px]">Admissão UTI:</span>
                    <InlineEditableField
                      value={patient.utiAdmissionDate?.[0] || ""}
                      onUpdate={(v) => handleUpdateField("utiAdmissionDate", v ? [v] : [])}
                      placeholder="DD/MM/AAAA"
                      className="text-[10px] font-medium w-20"
                    />
                  </div>

                  {/* Discharge Prediction */}
                  <div className="hidden md:flex shrink-0 items-center gap-1 text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    <span className="text-[9px]">Previsão de Alta:</span>
                    <InlineEditableField
                      value={previsaoAlta[0] || ""}
                      onUpdate={(v) => handleUpdateField("utiDischargePrediction", v ? [v] : [])}
                      placeholder="DD/MM/AAAA"
                      className="text-[10px] font-medium w-20"
                    />
                  </div>

                  {/* Critical badge - Only alert when needed */}
                  {criticalCount > 0 && (
                    <Badge variant="destructive" className="shrink-0 h-4 gap-0.5 text-[8px] md:text-[9px] px-1">
                      <AlertTriangle className="h-2 w-2" />
                      {criticalCount}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Row 2: 4 columns on desktop, 2x2 grid on mobile - Collapsible */}
              {!isCollapsed && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1 md:gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className={cn("rounded-lg p-1 md:p-1.5 shadow-sm border backdrop-blur-sm hover:shadow-md transition-shadow", colors.col1)}>
                    <InlineEditableArray
                      items={diagnosticos}
                      onUpdate={(items) => handleUpdateField("diagnoses", items)}
                      label="Hipóteses / Diagnósticos"
                      icon={<Stethoscope className={cn("h-2.5 w-2.5", colors.col1Icon)} />}
                      iconColorClass={colors.col1Icon}
                      alwaysShowAll
                      highlightedIndices={patient.highlightedDiagnoses || []}
                      onUpdateHighlights={(indices) => handleUpdateField("highlightedDiagnoses", indices)}
                      onUpdateBoth={(items, highlights) => handleUpdateBothFields("diagnoses", items, "highlightedDiagnoses", highlights)}
                      fieldId="diagnoses"
                      isActive={activeColumn === 'diagnoses'}
                      onTabPress={() => handleTabFromColumn('diagnoses')}
                      onEnterPress={() => setActiveColumn('diagnoses')}
                      highlightColorVariant={colorVariant}
                    />
                  </div>
                  <div className={cn("rounded-lg p-1 md:p-1.5 shadow-sm border backdrop-blur-sm hover:shadow-md transition-shadow", colors.col2)}>
                    <InlineEditableArray
                      items={antecedentes}
                      onUpdate={(items) => handleUpdateField("medicalHistory", items)}
                      label="Antecedentes / Comorbidades"
                      icon={<Activity className={cn("h-2.5 w-2.5", colors.col2Icon)} />}
                      iconColorClass={colors.col2Icon}
                      alwaysShowAll
                      highlightedIndices={patient.highlightedMedicalHistory || []}
                      onUpdateHighlights={(indices) => handleUpdateField("highlightedMedicalHistory", indices)}
                      onUpdateBoth={(items, highlights) => handleUpdateBothFields("medicalHistory", items, "highlightedMedicalHistory", highlights)}
                      fieldId="antecedentes"
                      isActive={activeColumn === 'antecedentes'}
                      onTabPress={() => handleTabFromColumn('antecedentes')}
                      onEnterPress={() => setActiveColumn('antecedentes')}
                      highlightColorVariant={colorVariant}
                    />
                  </div>
                  <div className={cn("rounded-lg p-1 md:p-1.5 shadow-sm border backdrop-blur-sm hover:shadow-md transition-shadow", colors.col3)}>
                    <InlineEditableArray
                      items={condutasDia}
                      onUpdate={(items) => handleUpdateField("utiDailyConducts", items)}
                      label="Plano Terapêutico"
                      icon={<FileText className={cn("h-2.5 w-2.5", colors.col3Icon)} />}
                      iconColorClass={colors.col3Icon}
                      alwaysShowAll
                      highlightedIndices={patient.highlightedConducts || []}
                      onUpdateHighlights={(indices) => handleUpdateField("highlightedConducts", indices)}
                      onUpdateBoth={(items, highlights) => handleUpdateBothFields("utiDailyConducts", items, "highlightedConducts", highlights)}
                      fieldId="condutas"
                      isActive={activeColumn === 'condutas'}
                      onTabPress={() => handleTabFromColumn('condutas')}
                      onEnterPress={() => setActiveColumn('condutas')}
                      highlightColorVariant={colorVariant}
                    />
                  </div>
                  <div className={cn("rounded-lg p-1 md:p-1.5 shadow-sm border backdrop-blur-sm hover:shadow-md transition-all", colors.col4)}>
                    <InlineEditableArray
                      items={pendencias}
                      onUpdate={(items) => handleUpdateField("pendencies", items)}
                      label="Programações / Pendências"
                      icon={<ClipboardList className={cn("h-2.5 w-2.5", colors.col4Icon)} />}
                      iconColorClass={colors.col4Icon}
                      alwaysShowAll
                      highlightedIndices={patient.highlightedPendencies || []}
                      onUpdateHighlights={(indices) => handleUpdateField("highlightedPendencies", indices)}
                      onUpdateBoth={(items, highlights) => handleUpdateBothFields("pendencies", items, "highlightedPendencies", highlights)}
                      fieldId="pendencias"
                      isActive={activeColumn === 'pendencias'}
                      onTabPress={() => handleTabFromColumn('pendencias')}
                      onEnterPress={() => setActiveColumn('pendencias')}
                      highlightColorVariant={colorVariant}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right Actions + Expand Button - Horizontal when collapsed, Vertical when expanded */}
            <div className={cn(
              "flex items-center justify-center gap-0.5 px-1 py-1 border-l border-border/30 bg-muted/20 transition-all",
              isCollapsed ? "flex-row" : "flex-col"
            )}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditDialogOpen(true)}
                className="h-6 w-6 text-muted-foreground hover:text-primary"
                title="Edição avançada"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border shadow-lg z-50 w-48">
                  {/* Print option */}
                  {onPrintPatient && (
                    <DropdownMenuItem onClick={() => onPrintPatient(patient.id)}>
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir Caso
                    </DropdownMenuItem>
                  )}

                  {/* Mark as vacant - always visible for occupied beds */}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleToggleVacancy(true)}>
                    <DoorOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                    Marcar como Vago
                  </DropdownMenuItem>
                  
                  {/* Only show movement options if patient has data */}
                  {patient.name && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Realocação</DropdownMenuLabel>
                      
                      <DropdownMenuItem onClick={() => setIsReallocationDialogOpen(true)}>
                        <BedDouble className="h-4 w-4 mr-2 text-blue-500" />
                        Realocar Leito/UTI
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Movimentações</DropdownMenuLabel>
                      
                      <DropdownMenuItem onClick={() => handleMovement("ALTA")}>
                        <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                        Alta
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem onClick={() => handleMovement("TRANSFERÊNCIA")}>
                        <ArrowLeftRight className="h-4 w-4 mr-2 text-blue-500" />
                        Transferência
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem onClick={() => handleMovement("ÓBITO")}>
                        <Skull className="h-4 w-4 mr-2 text-red-500" />
                        Óbito
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDelete(patient.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir Leito
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Expanded Content - Complete UTI fields */}
          <CollapsibleContent>
            <div className="border-t border-border/30 p-3 space-y-3 bg-muted/5">
              
              {/* 🔴 CRÍTICO - Patient safety items */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-[10px] font-bold text-red-600 tracking-wider">Crítico</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <InlineEditableArray
                    items={dispositivos}
                    onUpdate={(items) => handleUpdateField("utiDevices", items)}
                    label="Dispositivos"
                    colorClass="bg-red-50/50 dark:bg-red-900/10 border border-red-200/30 dark:border-red-800/20"
                    alwaysShowAll
                  />
                  <InlineEditableArray
                    items={alergias}
                    onUpdate={(items) => handleUpdateField("utiAllergies", items)}
                    label="Alergias"
                    colorClass="bg-red-50/50 dark:bg-red-900/10 border border-red-200/30 dark:border-red-800/20"
                    alwaysShowAll
                  />
                  <InlineEditableArray
                    items={culturasAtb}
                    onUpdate={(items) => handleUpdateField("utiCulturesAntibiotics", items)}
                    label="Culturas / ATB"
                    icon={<Pill className="h-3 w-3 text-red-400" />}
                    colorClass="bg-red-50/50 dark:bg-red-900/10 border border-red-200/30 dark:border-red-800/20"
                    alwaysShowAll
                  />
                </div>
              </div>

              {/* 🔵 CLÍNICO - Clinical evolution */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">CLÍNICO</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <InlineEditableArray
                    items={especialidades}
                    onUpdate={(items) => handleUpdateField("utiSpecialties", items)}
                    label="ESPECIALIDADES"
                    colorClass="bg-muted/50 border border-border/50"
                    alwaysShowAll
                  />
                  <InlineEditableArray
                    items={exames}
                    onUpdate={(items) => handleUpdateField("relevantExams", items)}
                    label="EXAMES"
                    colorClass="bg-muted/50 border border-border/50"
                    alwaysShowAll
                  />
                </div>
              </div>

              {/* 📝 HISTÓRIA - Admission history */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">HISTÓRIA ADMISSIONAL</span>
                </div>
                <div className="bg-muted/30 border border-border/30 rounded-md p-2">
                  <InlineEditableTextarea
                    value={patient.admissionHistory || ""}
                    onUpdate={(v) => handleUpdateField("admissionHistory", v)}
                    placeholder="HISTÓRIA ADMISSIONAL / ANAMNESE..."
                  />
                </div>
              </div>

              {/* 📁 ADMINISTRATIVO */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">ADMINISTRATIVO</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <InlineEditableArray
                    items={setorOrigem}
                    onUpdate={(items) => handleUpdateField("utiOriginSector", items)}
                    label="SETOR DE ORIGEM"
                    colorClass="bg-muted/30 border border-border/30"
                    alwaysShowAll
                  />
                  <InlineEditableArray
                    items={motivoAdmissao}
                    onUpdate={(items) => handleUpdateField("utiAdmissionReason", items)}
                    label="MOTIVO DA ADMISSÃO"
                    colorClass="bg-muted/30 border border-border/30"
                    alwaysShowAll
                  />
                  <div className="bg-muted/30 border border-border/30 rounded-md p-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">ADMISSÃO UTI</span>
                    <InlineEditableField
                      value={getFieldArray("utiAdmissionDate")[0] || ""}
                      onUpdate={(v) => handleUpdateField("utiAdmissionDate", v ? [v] : [])}
                      placeholder="DD/MM/AAAA"
                      className="text-sm"
                    />
                  </div>
                  <div className="bg-muted/30 border border-border/30 rounded-md p-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">PREVISÃO DE ALTA</span>
                    <InlineEditableField
                      value={previsaoAlta[0] || ""}
                      onUpdate={(v) => handleUpdateField("utiDischargePrediction", v ? [v] : [])}
                      placeholder="DD/MM/AAAA"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        )}
      </div>

      <EditPatientDialog
        patient={patient}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={(updatedPatient) => {
          onUpdate(updatedPatient);
          setIsEditDialogOpen(false);
        }}
      />

      {/* Movement Dialog */}
      <PatientMovementDialog
        patient={patient}
        movementType={movementType}
        isOpen={isMovementDialogOpen}
        onClose={() => {
          setIsMovementDialogOpen(false);
          setMovementType(null);
        }}
        onSuccess={handleMovementSuccess}
      />

      {/* Reallocation Dialog */}
      <UtiReallocationDialog
        patient={patient}
        isOpen={isReallocationDialogOpen}
        onClose={() => setIsReallocationDialogOpen(false)}
        onSuccess={handleReallocationSuccess}
        currentUtiUnit={derivedUtiUnit}
        allPatients={allPatients}
      />
    </>
  );
}
