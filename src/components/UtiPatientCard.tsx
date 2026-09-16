import { Patient } from "@/types/patient";
import { DischargeStatusRibbon } from "./DischargeStatusRibbon";
import { calcDIH, getEffectiveAdmissionDate } from "@/lib/dihCalc";
import { isExtraBed } from "@/utils/bedNaming";
import { formatDateBR } from "@/utils/dateUtils";
import { isWithin24h } from "@/hooks/useDischargeAlert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Edit, ChevronDown, ChevronRight, Check, X, Plus, GripVertical, Trash2, AlertTriangle, Stethoscope, ClipboardList, FileText, FolderOpen, Pill, Activity, Star, ArrowLeftRight, DoorOpen, Shuffle, UserMinus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BedReleasePreAdmissionDialog } from "./BedReleasePreAdmissionDialog";



// Clinical status options with refined colors - only critical ones are vibrant
const CLINICAL_STATUS_OPTIONS = [
  { value: "gravissimo", label: "GRAVÍSSIMO", color: "bg-critical text-white", borderColor: "border-critical" },
  { value: "grave", label: "GRAVE", color: "bg-critical text-white", borderColor: "border-critical" },
  { value: "grave_estavel", label: "GRAVE, PORÉM ESTÁVEL", color: "bg-warning text-white", borderColor: "border-warning" },
  { value: "potencialmente_grave", label: "POTENCIALMENTE GRAVE", color: "bg-warning text-white", borderColor: "border-warning" },
  { value: "regular", label: "REGULAR", color: "bg-primary text-white", borderColor: "border-border" },
  { value: "paliativado", label: "CUIDADOS PALIATIVOS", color: "bg-primary text-white", borderColor: "border-border" },
  { value: "protocolo_me", label: "EM PROTOCOLO DE ME", color: "bg-primary text-white", borderColor: "border-border" },
] as const;

// Text inputs no longer forced to uppercase
import { cn } from "@/lib/utils";
import { EditPatientDialog } from "./EditPatientDialog";
import { PatientMovementDialog } from "./PatientMovementDialog";
import { SignalInternalTransferDialog } from "./SignalInternalTransferDialog";
import { BedReallocationDialog } from "./BedReallocationDialog";
import { PatientRegistrationDialog } from "./PatientRegistrationDialog";
import { PatientRoundPrintDialog } from "./PatientRoundPrintDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { formatAgeDisplay } from "@/utils/ageDisplay";
import { useNavigate } from "react-router-dom";

type ColorVariant = 'blue' | 'yellow' | 'red' | 'green';

interface UtiPatientCardProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  onDelete?: (patientId: string) => void | Promise<void>;
  onReleasePreAdmissionBed?: (patientId: string, payload: { reason: string; reasonNote: string }) => void | Promise<void>;
  onPrintPatient?: (patientId: string) => void;
  onRefetch?: () => void;
  colorVariant?: ColorVariant;
  forceCollapsed?: boolean;
  allPatients?: Patient[]; // All UTI patients for reallocation
  currentUtiUnit?: string; // "UTI 1" or "UTI 2"
}

// Calculate days in UTI
function calculateDaysInUti(admissionDate: string[] | undefined): number {
  const dateStr = admissionDate?.[0];
  if (!dateStr) return 0;
  const dih = calcDIH(dateStr);
  return dih ?? 0;
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
      bg: "bg-muted/60 border-l-2 border-l-blue-500 pl-2",
      number: "text-foreground",
      text: "text-foreground",
      star: "fill-blue-500 text-muted-foreground"
    },
    yellow: {
      bg: "bg-warning-soft/60 border-l-2 border-l-amber-500 pl-2",
      number: "text-warning-on-soft",
      text: "text-warning-on-soft",
      star: "fill-amber-500 text-warning"
    },
    red: {
      bg: "bg-critical-soft/60 border-l-2 border-l-red-500 pl-2",
      number: "text-critical-on-soft",
      text: "text-critical-on-soft",
      star: "fill-red-500 text-critical"
    },
    green: {
      bg: "bg-released-soft/60 border-l-2 border-l-emerald-500 pl-2",
      number: "text-released-on-soft",
      text: "text-released-on-soft",
      star: "fill-emerald-500 text-released"
    }
  };
  const hStyles = highlightStyles[highlightColorVariant];

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "flex items-center gap-1 group py-1 rounded-md px-1 -mx-1 transition-all duration-150",
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
        "font-medium text-xs min-w-[14px] flex-shrink-0 tabular-nums",
        isHighlighted ? hStyles.number : "text-muted-foreground"
      )}>{index + 1}.</span>
      
      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className="flex-1 text-xs bg-background border border-primary/30 rounded-md px-2 py-1 outline-none font-medium tracking-tight"
            onKeyDown={handleKeyDownInternal}
            onBlur={handleSave}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : (
        <>
          <span 
            className={cn(
              "flex-1 text-xs break-words cursor-pointer hover:text-primary transition-colors leading-relaxed tracking-tight",
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
    <div className={cn("rounded-md p-2", colorClass)}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-medium text-muted-foreground tracking-wide">{label}</span>
            {items.length > 0 && (
              <Badge variant="secondary" className="h-3.5 px-1 text-xs font-medium">{items.length}</Badge>
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
      
      <div className="space-y-1">
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
            className="text-xs text-muted-foreground/50 cursor-pointer hover:text-muted-foreground italic pl-1"
            onClick={() => setIsAddingNew(true)}
          >
            {placeholder}
          </span>
        ) : null}
        
        {hiddenCount > 0 && (
          <span className="text-xs text-muted-foreground pl-4 italic">+{hiddenCount} mais</span>
        )}
        
        {isAddingNew && (
          <div className="flex items-center gap-1 mt-1 pt-1 border-t border-border/30">
            <input
              ref={newInputRef}
              type="text"
              value={newItemValue}
              onChange={(e) => setNewItemValue(e.target.value)}
              placeholder="Novo item..."
              className="flex-1 text-xs bg-background border border-primary/30 rounded-md px-2 py-1 outline-none font-medium tracking-tight placeholder:font-normal placeholder:text-muted-foreground/50"
              onKeyDown={handleNewItemKeyDown}
              onBlur={() => handleAddItem(false)}
            />
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleAddItem(false)}>
              <Check className="h-3 w-3 text-released-on-soft" />
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
            className={cn("h-5 text-xs p-0 mt-2", iconColorClass)}
            onClick={(e) => {
              e.stopPropagation();
              setIsAddingNew(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        )}
      </div>
    </div>
  );
}

function ReadOnlyArray({
  items,
  label,
  placeholder = "—",
  colorClass,
  icon,
}: {
  items: string[];
  label: string;
  placeholder?: string;
  colorClass?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("rounded-md p-2 cursor-default", colorClass)}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-muted-foreground tracking-wide">{label}</span>
          {items.length > 0 && (
            <Badge variant="secondary" className="h-3.5 px-1 text-xs font-medium">{items.length}</Badge>
          )}
        </div>
      </div>
      {items.length > 0 ? (
        <ol className="space-y-1">
          {items.map((item, index) => (
            <li key={`${label}-${index}`} className="flex items-start gap-1 text-xs leading-snug text-foreground">
              <span className="mt-px text-xs font-medium text-muted-foreground">{index + 1}.</span>
              <span className="break-words">{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <span className="text-xs text-muted-foreground/60 italic pl-1">{placeholder}</span>
      )}
    </div>
  );
}

function ReadOnlyTextarea({ value, placeholder = "—" }: { value: string; placeholder?: string }) {
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      setHasOverflow(contentRef.current.scrollHeight > 48);
    }
  }, [value]);

  return (
    <div className="relative cursor-default" title="Importada automaticamente da admissão validada.">
      <div
        ref={contentRef}
        className={cn(
          "text-xs whitespace-pre-wrap overflow-hidden text-foreground",
          !isTextExpanded && hasOverflow ? "max-h-[48px]" : "max-h-none"
        )}
      >
        {value || <span className="text-muted-foreground/60 italic text-xs">{placeholder}</span>}
      </div>
      {hasOverflow && !isTextExpanded && (
        <div className="absolute bottom-5 left-0 right-0 h-4 bg-muted/30 pointer-events-none" />
      )}
      {hasOverflow && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-2 text-xs font-medium text-muted-foreground hover:text-primary mt-1"
          onClick={(e) => {
            e.stopPropagation();
            setIsTextExpanded(!isTextExpanded);
          }}
        >
          {isTextExpanded ? (
            <>
              <ChevronDown className="h-3 w-3 mr-1 rotate-180" />
              Retrair
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
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
  onReleasePreAdmissionBed,
  onPrintPatient,
  onRefetch,
  colorVariant = 'blue',
  forceCollapsed,
  allPatients = [],
  currentUtiUnit
}: UtiPatientCardProps) {
  const { role } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Movement dialog states
  const [movementType, setMovementType] = useState<"ALTA" | "ÓBITO" | "TRANSFERÊNCIA" | null>(null);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const navigate = useNavigate();
  const [isReallocationDialogOpen, setIsReallocationDialogOpen] = useState(false);
  const [isSignalTransferOpen, setIsSignalTransferOpen] = useState(false);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [isRoundPrintDialogOpen, setIsRoundPrintDialogOpen] = useState(false);
  const [isReleasePreAdmissionOpen, setIsReleasePreAdmissionOpen] = useState(false);
  const [isDeleteExtraOpen, setIsDeleteExtraOpen] = useState(false);
  const [isDeletingExtra, setIsDeletingExtra] = useState(false);
  const movementTriggerRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  const isExtra = isExtraBed(patient.bedNumber);
  // Leito extra vago pode ser excluído por qualquer perfil autenticado (operação de layout do setor).
  // Leito extra ocupado segue protegido — precisa desalocar o paciente antes.
  const canDeleteExtra = isExtra && (patient.isVacant || role === 'admin' || role === 'medico');

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
    // Alta/óbito/transferência externa só sinalizam o desfecho.
    // O leito permanece ocupado até a liberação física pelo fluxo pós-alta/óbito.
    setIsMovementDialogOpen(false);
    setMovementType(null);
    onRefetch?.();
  };

  const handleReallocationSuccess = () => {
    setIsReallocationDialogOpen(false);
    onRefetch?.();
  };

  // Color schemes based on variant
  const colorSchemes: Record<ColorVariant, Record<string, string>> = {
    blue: {
      card: "bg-muted border-primary/20",
      bedBg: "bg-primary/10 border-primary/20",
      bedText: "text-primary",
      col1: "bg-muted/70 border-border/50",
      col1Icon: "text-muted-foreground",
      col2: "bg-muted/70 border-border/50",
      col2Icon: "text-muted-foreground",
      col3: "bg-muted/70 border-border/50",
      col3Icon: "text-muted-foreground",
      col4: "bg-muted/70 border-border/50",
      col4Icon: "text-muted-foreground",
    },
    yellow: {
      card: "bg-warning-soft/50 border-warning/30",
      bedBg: "bg-warning-soft border-warning-border/50",
      bedText: "text-warning-on-soft",
      col1: "bg-warning-soft/50 border-warning-border/50",
      col1Icon: "text-warning",
      col2: "bg-warning-soft/50 border-warning-border/50",
      col2Icon: "text-warning",
      col3: "bg-warning-soft/50 border-warning-border/50",
      col3Icon: "text-warning",
      col4: "bg-warning-soft/50 border-warning-border/50",
      col4Icon: "text-warning",
    },
    red: {
      card: "bg-critical-soft/50 border-critical/30",
      bedBg: "bg-critical-soft border-critical-border/50",
      bedText: "text-critical-on-soft",
      col1: "bg-critical-soft/50 border-critical-border/50",
      col1Icon: "text-critical",
      col2: "bg-critical-soft/50 border-critical-border/50",
      col2Icon: "text-critical",
      col3: "bg-critical-soft/50 border-critical-border/50",
      col3Icon: "text-critical",
      col4: "bg-critical-soft/50 border-critical-border/50",
      col4Icon: "text-critical",
    },
    green: {
      card: "bg-released-soft/50 border-released/30",
      bedBg: "bg-released-soft border-released-border/50",
      bedText: "text-released-on-soft",
      col1: "bg-released-soft/50 border-released-border/50",
      col1Icon: "text-released",
      col2: "bg-released-soft/50 border-released-border/50",
      col2Icon: "text-released",
      col3: "bg-released-soft/50 border-released-border/50",
      col3Icon: "text-released",
      col4: "bg-released-soft/50 border-released-border/50",
      col4Icon: "text-released",
    }
  };

  const colors = colorSchemes[colorVariant];

  const daysInUti = useMemo(() => {
    const eff = getEffectiveAdmissionDate({
      utiAdmissionDate: patient.utiAdmissionDate,
      admittedAt: patient.admittedAt,
      admissionDate: patient.admissionDate,
      sector: patient.sector,
    });
    return calcDIH(eff) ?? 0;
  }, [patient.utiAdmissionDate, patient.admittedAt, patient.admissionDate, patient.sector]);

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

  // Vacancy is governed automatically by the auto_vacate_on_discharge DB trigger
  // (clearing patient.name => is_vacant=true; setting name => is_vacant=false).
  // Manual toggling is intentionally disabled here.

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
  // Exibe somente a data; remove sufixo "(N dias)" quando presente
  // Formata previsão de alta para padrão brasileiro DD/MM/YYYY (preserva sufixo D+N)
  const previsaoAltaDate = formatDateBR(previsaoAlta[0] || "");
  // Rótulo de admissão dinâmico por setor (ex.: "Admissão UCC", "Admissão UTI 1")
  const admissionLabel = `Admissão ${derivedUtiUnit}`;
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
        className={cn(
          "relative border rounded-lg shadow-md hover:shadow-md transition-all duration-200",
          colors.card,
          patient.admissionStatus === 'alta_dada' && "ring-1 ring-released/40 bg-released-soft/30 grayscale-[15%] opacity-95",
          patient.admissionStatus === 'obito' && "ring-1 ring-ring/50 bg-muted/50 grayscale-[35%] opacity-90",
          patient.admissionStatus === 'transferencia_interna_pendente' && "ring-1 ring-ring/50 bg-muted/30",
          patient.admissionStatus === 'transferencia_externa_pendente' && "ring-1 ring-ring/50 bg-muted/30",
        )}
        data-patient-id={patient.id}
      >
        
        {/* VACANT BED VIEW */}
        {patient.isVacant ? (
          <div className="flex items-center justify-between p-2 gap-1">
            <div className="flex items-center gap-2">
              {/* Bed Number */}
              <div className={cn("shrink-0 px-2 py-1 rounded-md border", colors.bedBg)}>
                <span className={cn("patient-id text-xs font-semibold", colors.bedText)}>{patient.bedNumber}</span>
              </div>
              {/* Vacant Message */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <DoorOpen className="h-4 w-4" />
                <span className="text-sm font-medium italic">Leito Vago</span>
              </div>
            </div>
            {/* Botão inline de exclusão de leito extra (apenas leitos extras, fora dos fixos do setor) */}
            {canDeleteExtra && onDelete && (
              <button
                type="button"
                onClick={() => setIsDeleteExtraOpen(true)}
                className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground/60 hover:text-white hover:bg-critical hover:scale-110 transition-all duration-150"
                title="Excluir leito extra"
                aria-label="Excluir leito extra"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          /* OCCUPIED BED VIEW - Normal card */
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          {/* Header - Collapsed View - FULLY EDITABLE */}
          <div className="flex items-stretch">
            {/* Main Content - Collapsed View */}
            <div className="flex-1 p-2 space-y-2 min-w-0">
              {/* Row 1: Identification Header - Mobile optimized */}
              <div className="flex flex-wrap items-center gap-1 md:gap-2">
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
                
                {/* Bed Number - Compact (fixed by bed map allocation) */}
                <div className={cn("shrink-0 px-2 py-1 rounded-md border", colors.bedBg)}>
                  <span
                    className={cn("patient-id block text-xs font-semibold min-w-8 md:min-w-10 text-center cursor-default", colors.bedText)}
                    title="Leito fixo no mapa. Alterações ocorrem apenas por realocação/transferência."
                  >
                    {patient.bedNumber || "LEITO"}
                  </span>
                </div>
                
                {/* Patient Name + Age - Flexible grow */}
                <div className="flex-1 flex items-baseline gap-1 md:gap-2 min-w-0">
                  {namesHidden ? (
                    <span className="patient-id text-xs md:text-sm font-medium truncate tracking-widest opacity-70">{displayName}</span>
                  ) : (
                    /* Nome do paciente é IMUTÁVEL pelo mapa de leitos.
                       Edição só é permitida via cockpit de prontuário (Edição Avançada → Ficha cadastral),
                       que sincroniza patients.name e registra no histórico. */
                    <span
                      className="patient-id text-xs md:text-sm font-medium truncate cursor-default"
                      title="O nome do paciente é fixo no mapa de leitos. Para alterar, use Edição Avançada → Ficha cadastral."
                    >
                      {patient.name || <span className="italic text-muted-foreground">SEM NOME</span>}
                    </span>
                  )}
                  <div
                    className="shrink-0 text-xs md:text-xs text-muted-foreground cursor-default"
                    title="Idade atualizada automaticamente pelo cadastro do paciente."
                  >
                    {patient.age ? formatAgeDisplay(patient.age) : "IDADE"}
                  </div>
                </div>

                {/* Mobile: Chips wrap to second line */}
                <div className="flex items-center gap-1 flex-wrap md:flex-nowrap w-full md:w-auto mt-1 md:mt-0">
                  {/* Classificação clínica (bola de gravidade) removida do mapa de leitos */}

                  {/* Pílula de desfecho sinalizado — informativa; ação somente pelo menu Movimentações */}
                  <DischargeStatusRibbon status={patient.admissionStatus} />

                  {/* Days in UTI - Fixed width for consistent alignment */}
                  {(() => {
                    const dihLevel: "green" | "yellow" | "red" =
                      daysInUti <= 7 ? "green" : daysInUti <= 10 ? "yellow" : "red";
                    const containerCls =
                      dihLevel === "red"
                        ? "bg-critical-soft border-critical/50"
                        : dihLevel === "yellow"
                        ? "bg-warning-soft border-warning-border/50"
                        : "bg-released-soft border-released/50";
                    const textCls =
                      dihLevel === "red"
                        ? "text-critical-on-soft"
                        : dihLevel === "yellow"
                        ? "text-warning-on-soft"
                        : "text-released-on-soft";
                    return (
                      <div
                        className={cn(
                          "shrink-0 flex items-center justify-center gap-1 w-[70px] md:w-[80px] px-2 py-1 rounded-md border",
                          containerCls
                        )}
                        title="DIH — Verde ≤7 dias · Amarelo 8–10 · Vermelho >10"
                      >
                        <span className={cn("text-xs font-semibold", textCls)}>DIH:</span>
                        <span className={cn("text-xs font-semibold min-w-[20px] text-center", textCls)}>
                          {daysInUti}
                        </span>
                        {dihLevel === "red" ? (
                          <span title="Longa permanência" className="sr-only">
                            DIH crítico
                          </span>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* UTI Admission Date — somente leitura (edite via Edição Avançada) */}
                  <div
                    className="hidden md:flex shrink-0 items-center gap-1 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md cursor-not-allowed"
                    title="Edite em Edição Avançada"
                  >
                    <span className="text-xs">{admissionLabel}:</span>
                    <span className="text-xs font-medium w-20 truncate">
                      {patient.utiAdmissionDate?.[0] || "—"}
                    </span>
                  </div>

                  {/* Discharge Prediction — somente leitura (edite via Edição Avançada / Evolução) */}
                  <div
                    className="hidden md:flex shrink-0 items-center gap-1 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md cursor-not-allowed"
                    title="Edite em Edição Avançada ou via Evolução Médica"
                  >
                    <span className="text-xs">Previsão de Alta:</span>
                    <span className="text-xs font-medium w-20 truncate">
                      {previsaoAltaDate || "—"}
                    </span>
                  </div>

                  {/* Critical badge removido — alertas críticos tratados em outro local */}
                </div>
              </div>

              {/* Row 2: 4 columns on desktop, 2x2 grid on mobile - Collapsible */}
              {!isCollapsed && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1 md:gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className={cn("rounded-lg p-1 md:p-2 shadow-sm border backdrop-blur-sm hover:shadow-md transition-shadow-sm", colors.col1)}>
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
                  <div className={cn("rounded-lg p-1 md:p-2 shadow-sm border backdrop-blur-sm hover:shadow-md transition-shadow-sm", colors.col2)}>
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
                  <div className={cn("rounded-lg p-1 md:p-2 shadow-sm border backdrop-blur-sm hover:shadow-md transition-shadow-sm", colors.col3)}>
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
                  <div className={cn("rounded-lg p-1 md:p-2 shadow-sm border backdrop-blur-sm hover:shadow-md transition-all", colors.col4)}>
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
              "flex items-center justify-center gap-1 px-1 py-1 border-l border-border/30 bg-muted/20 transition-all",
              isCollapsed ? "flex-row" : "flex-col"
            )}>
              {canDeleteExtra && onDelete && (
                <button
                  type="button"
                  onClick={() => setIsDeleteExtraOpen(true)}
                  className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground/60 hover:text-white hover:bg-critical hover:scale-110 transition-all duration-150"
                  title="Excluir leito extra"
                  aria-label="Excluir leito extra"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
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
                  <Button ref={movementTriggerRef} variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110 group" title="Movimentação do leito" aria-label="Movimentação do leito">
                    <ArrowLeftRight className="h-3 w-3 transition-transform duration-300 group-hover:scale-110" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover/95 backdrop-blur-sm border shadow-md z-50 w-64 p-2">
                  {/* ============ BLOCO MOVIMENTAÇÃO ============ */}
                  {patient.name ? (
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2 space-y-1">
                      <div className="flex items-center gap-2 px-2 pt-1 pb-1">
                        <Shuffle className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Movimentação
                        </span>
                      </div>

                      {/* MONITORAMENTO DE SINAIS (acesso direto — antes indisponivel na UTI) */}
                      <DropdownMenuItem
                        onClick={() => navigate(`/monitoramento?patientId=${patient.id}`)}
                        className="group/item flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer border border-transparent hover:border-released-border/60 hover:bg-gradient-to-r hover:from-released-soft hover:to-transparent transition-all duration-200 hover:translate-x-0.5 hover:shadow-sm"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-released-soft group-hover/item:bg-released transition-colors">
                          <Activity className="h-3.5 w-3.5 text-released-on-soft" />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-released-on-soft leading-tight">
                            Monitoramento de sinais
                          </span>
                          <span className="text-xs font-normal text-muted-foreground leading-tight">
                            Registrar e acompanhar sinais vitais
                          </span>
                        </div>
                      </DropdownMenuItem>

                      {/* REMANEJAR LEITO (mesmo setor) */}
                      <DropdownMenuItem
                        onClick={() => setIsReallocationDialogOpen(true)}
                        className="group/item flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer border border-transparent hover:border-border/60 hover:bg-gradient-to-r hover:from-muted hover:to-transparent transition-all duration-200 hover:translate-x-0.5 hover:shadow-sm"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted group-hover/item:bg-secondary transition-colors">
                          <ArrowLeftRight className="h-3.5 w-3.5 text-foreground" />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-foreground leading-tight">
                            Remanejar leito <span className="text-xs font-normal text-foreground/70">(mesmo setor)</span>
                          </span>
                          <span className="text-xs font-normal text-muted-foreground leading-tight">
                            Realocar ou permutar entre leitos da unidade
                          </span>
                        </div>
                      </DropdownMenuItem>

                      {/* DESALOCAR LEITO — botão único. Comportamento varia conforme estado:
                          sinalização ativa → conclui; alta/óbito → libera; sem sinalização → bloqueio
                          duro com orientação para sinalizar no Painel Clínico (sem atalho excepcional). */}
                      {onReleasePreAdmissionBed && (role === 'admin' || role === 'medico') && (() => {
                        const isPostOutcome = patient.admissionStatus === 'alta_dada' || patient.admissionStatus === 'obito';
                        const isSignaled = patient.admissionStatus === 'transferencia_interna_pendente' || patient.admissionStatus === 'transferencia_externa_pendente';
                        const sub = isPostOutcome
                          ? 'Pós-alta/óbito — confirmação por senha, preserva prontuário'
                          : isSignaled
                            ? 'Conclui a sinalização feita no Painel Clínico'
                            : 'Bloqueado — sinalize a movimentação no Painel Clínico';
                        const tone = isSignaled ? 'emerald' : 'amber';
                        const isDisabled = !isSignaled && !isPostOutcome;
                        return (
                          <DropdownMenuItem
                            disabled={isDisabled}
                            onSelect={(e) => { if (isDisabled) e.preventDefault(); }}
                            onClick={() => { if (!isDisabled) setIsReleasePreAdmissionOpen(true); }}
                            title={isDisabled ? 'Sinalize a movimentação no Painel Clínico antes de desalocar o leito.' : undefined}
                            className={cn(
                              "group/item flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium border border-transparent transition-all duration-200",
                              isDisabled
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer hover:translate-x-0.5 hover:shadow-sm",
                              !isDisabled && (tone === 'emerald'
                                ? "hover:border-released-border/60 hover:bg-gradient-to-r hover:from-released-soft hover:to-transparent"
                                : "hover:border-warning-border/60 hover:bg-gradient-to-r hover:from-warning-soft hover:to-transparent")
                            )}
                          >
                            <div className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                              tone === 'emerald'
                                ? "bg-released-soft group-hover/item:bg-released"
                                : "bg-warning-soft group-hover/item:bg-warning"
                            )}>
                              {tone === 'emerald'
                                ? <Check className="h-3.5 w-3.5 text-released-on-soft" />
                                : <UserMinus className="h-3.5 w-3.5 text-warning-on-soft" />}
                            </div>
                            <div className="flex flex-col items-start min-w-0">
                              <span className={cn(
                                "leading-tight",
                                tone === 'emerald' ? "text-released-on-soft" : "text-warning-on-soft"
                              )}>
                                Desalocar leito
                              </span>
                              <span className="text-xs font-normal text-muted-foreground leading-tight">
                                {sub}
                              </span>
                            </div>
                          </DropdownMenuItem>
                        );
                      })()}


                      <p className="px-3 pt-1 text-xs leading-snug text-muted-foreground/80 border-t border-border/40 mt-1">
                        Altas, óbitos e transferências são <strong>sinalizadas no Painel Clínico</strong>.
                      </p>
                    </div>
                  ) : (
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-3 py-2">
                      Leito vago — sem ações disponíveis.
                    </DropdownMenuLabel>
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
              
              {/* CRÍTICO - Patient safety items */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-critical" />
                  <span className="text-xs font-semibold text-critical-on-soft tracking-wider">Crítico</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <InlineEditableArray
                    items={dispositivos}
                    onUpdate={(items) => handleUpdateField("utiDevices", items)}
                    label="Dispositivos"
                    colorClass="bg-critical-soft/50 border border-critical-border/30"
                    alwaysShowAll
                  />
                  <ReadOnlyArray
                    items={alergias}
                    label="Alergias"
                    placeholder="Sincronizadas com a prescrição"
                    colorClass="bg-critical-soft/50 border border-critical-border/30"
                  />
                  <InlineEditableArray
                    items={culturasAtb}
                    onUpdate={(items) => handleUpdateField("utiCulturesAntibiotics", items)}
                    label="Culturas / ATB"
                    icon={<Pill className="h-3 w-3 text-critical" />}
                    colorClass="bg-critical-soft/50 border border-critical-border/30"
                    alwaysShowAll
                  />
                </div>
              </div>

              {/* CLÍNICO - Clinical evolution */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground tracking-wider">Clínico</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <InlineEditableArray
                    items={especialidades}
                    onUpdate={(items) => handleUpdateField("utiSpecialties", items)}
                    label="Especialidades"
                    colorClass="bg-muted/50 border border-border/50"
                    alwaysShowAll
                  />
                  <InlineEditableArray
                    items={exames}
                    onUpdate={(items) => handleUpdateField("relevantExams", items)}
                    label="Exames"
                    colorClass="bg-muted/50 border border-border/50"
                    alwaysShowAll
                  />
                </div>
              </div>

              {/* HISTÓRIA - Admission history */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground tracking-wider">História admissional</span>
                </div>
                <div className="bg-muted/30 border border-border/30 rounded-md p-2">
                  <ReadOnlyTextarea
                    value={patient.admissionHistory || ""}
                    placeholder="Importada da admissão validada"
                  />
                </div>
              </div>

              {/* ADMINISTRATIVO */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground tracking-wider">Administrativo</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <ReadOnlyArray
                    items={setorOrigem}
                    label="Setor de origem"
                    placeholder="Importado da admissão"
                    colorClass="bg-muted/30 border border-border/30"
                  />
                  <ReadOnlyArray
                    items={motivoAdmissao}
                    label="Motivo da admissão"
                    placeholder="Importado da admissão"
                    colorClass="bg-muted/30 border border-border/30"
                  />
                  <div className="bg-muted/30 border border-border/30 rounded-md p-2 cursor-not-allowed" title="Edite em Edição Avançada">
                    <span className="text-xs font-medium text-muted-foreground tracking-wide block mb-1">{admissionLabel}</span>
                    <span className="text-sm font-medium block min-h-[20px]">
                      {getFieldArray("utiAdmissionDate")[0] || "—"}
                    </span>
                  </div>
                  <div className="bg-muted/30 border border-border/30 rounded-md p-2 cursor-not-allowed" title="Edite em Edição Avançada ou via Evolução Médica">
                    <span className="text-xs font-medium text-muted-foreground tracking-wide block mb-1">Previsão de alta</span>
                    <span className="text-sm font-medium block min-h-[20px]">
                      {previsaoAltaDate || "—"}
                    {isWithin24h(previsaoAlta[0]) && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-warning/15 border border-warning/40 px-2 py-1 text-xs font-medium text-warning-on-soft">
                        Alta amanhã
                      </span>
                    )}
                    </span>
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

      {/* Reallocation Dialog — abas Realocar (leito vago) e Permutar (paciente) */}
      <BedReallocationDialog
        open={isReallocationDialogOpen}
        onOpenChange={(o) => !o && setIsReallocationDialogOpen(false)}
        patient={patient}
        onSuccess={handleReallocationSuccess}
      />

      {/* Sinalização de transferência interna (etapa 1 de 2) — fila virtual no destino */}
      <SignalInternalTransferDialog
        patient={patient}
        open={isSignalTransferOpen}
        onOpenChange={setIsSignalTransferOpen}
        onSuccess={handleReallocationSuccess}
      />




      {/* Cadastro de Paciente (a partir de leito vago no mapa) */}
      <PatientRegistrationDialog
        open={isRegisterDialogOpen}
        onOpenChange={setIsRegisterDialogOpen}
        onSuccess={() => setIsRegisterDialogOpen(false)}
        defaultDestinationSector={derivedUtiUnit}
      />

      {/* Round Multiprofissional — impressão em branco ou preenchido */}
      {isRoundPrintDialogOpen && (
        <PatientRoundPrintDialog
          open={isRoundPrintDialogOpen}
          onOpenChange={setIsRoundPrintDialogOpen}
          patientId={patient.id}
          patientName={patient.name || ""}
          patientSector={patient.sector || derivedUtiUnit}
          patientBed={patient.bedNumber || ""}
          patientAge={patient.age}
          patientRecord={(patient as any).medicalRecord ?? null}
          patientDiagnoses={Array.isArray(diagnosticos) && diagnosticos.length > 0 ? diagnosticos : undefined}
          patientAllergies={Array.isArray(alergias) && alergias.length > 0 ? alergias : undefined}
        />
      )}

      <BedReleasePreAdmissionDialog
        open={isReleasePreAdmissionOpen}
        onOpenChange={setIsReleasePreAdmissionOpen}
        patient={patient}
        userRole={role}
        onConfirm={async (payload) => {
          if (onReleasePreAdmissionBed) {
            await onReleasePreAdmissionBed(patient.id, payload);
          }
        }}
      />

      <AlertDialog open={isDeleteExtraOpen} onOpenChange={setIsDeleteExtraOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir leito extra {patient.bedNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o leito extra <strong>{patient.bedNumber}</strong> deste setor.
              {patient.name ? (
                <> O paciente <strong>{patient.name}</strong> também será removido. </>
              ) : (
                <> O leito está vago e será removido com segurança. </>
              )}
              Leitos fixos do setor não podem ser excluídos — apenas leitos extras (maca extra). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingExtra}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingExtra}
              onClick={async () => {
                setIsDeletingExtra(true);
                try {
                  if (onDelete) {
                    await onDelete(patient.id);
                  }
                  setIsDeleteExtraOpen(false);
                  toast({
                    title: "Leito extra excluído",
                    description: `${patient.bedNumber} foi removido do setor.`,
                  });
                } catch (err: any) {
                  // Antes: erro aqui travava a tela sem aviso (diálogo não
                  // fechava, nenhum feedback) — parecia "não dá pra excluir"
                  // mesmo quando o motivo era claro (ex: leito ocupado).
                  console.error("[UtiPatientCard] falha ao excluir leito extra:", err);
                  toast({
                    title: "Não foi possível excluir o leito",
                    description: err?.message || "Erro inesperado. Tente novamente ou avise o suporte.",
                    variant: "destructive",
                  });
                } finally {
                  setIsDeletingExtra(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingExtra ? "Excluindo…" : "Excluir leito"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}