import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { Patient, SectorType, MedicalResponsibility } from "@/types/patient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Clock, Calendar, Edit, Trash2, Copy, ArrowLeftRight, Check, X, GripVertical, Maximize2, TrendingUp, Sparkles, Star, FileText, CheckCircle2, BedDouble, Settings, Zap, CircleCheck, Shuffle, AlertTriangle, Utensils, MessageSquare, XCircle, ClipboardList, ClipboardCheck, Eye, TestTubes, UserMinus, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { EditPatientDialog } from "./EditPatientDialog";
import { PatientMovementDialog } from "./PatientMovementDialog";
import { MedicalResponsibilityDialog } from "./MedicalResponsibilityDialog";
import { MedicalResponsibilityIndicator } from "./MedicalResponsibilityIndicator";
import { InternmentStatusDialog } from "./InternmentStatusDialog";
import { QuickTemplatesDialog } from "./QuickTemplatesDialog";
import { ApplyTemplateDialog } from "./ApplyTemplateDialog";
import { ExamCurvesDialog } from "./ExamCurvesDialog";
import { ExaminusAIDialog } from "./ExaminusAIDialog";
import { AllocationPendingBadge } from "./AllocationPendingBadge";
import { RequestBedAllocationDialog } from "./RequestBedAllocationDialog";
import { DietReleaseDialog } from "./DietReleaseDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBedAllocationRequests } from "@/hooks/useBedAllocationRequests";
import { formatAgeDisplay } from "@/utils/ageDisplay";
import { differenceInDays, differenceInHours, differenceInMinutes, parseISO, isValid, parse } from "date-fns";
import { useSectorStayTimer } from "@/hooks/useSectorStayTimer";
import { calcDIH, formatDIHLabel, formatAdmissionDateBR, getEffectiveAdmissionDate } from "@/lib/dihCalc";
import { usePrivacy, maskName } from "@/contexts/PrivacyContext";
import { useConductHistory } from "@/hooks/useConductHistory";
import { ConductHistoryDialog } from "./ConductHistoryDialog";
import { AdmissionHistoryDialog } from "./AdmissionHistoryDialog";
import { PatientRoundPrintDialog } from "./PatientRoundPrintDialog";
import { BedReallocationDialog } from "./BedReallocationDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { BedReleasePreAdmissionDialog } from "./BedReleasePreAdmissionDialog";
import { SignalInternalTransferDialog } from "./SignalInternalTransferDialog";
import { OperationalRelocationDialog } from "./OperationalRelocationDialog";
import { DischargeStatusRibbon } from "./DischargeStatusRibbon";

// Helper function to format date input as DD/MM/YYYY
const formatDateInput = (value: string): string => {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');
  
  // Format as DD/MM/YYYY
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  }
};

// Helper function to parse text arrays (extracted to avoid duplication)
const parseTextArray = (value: string | null): string[] => {
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.split('\n').filter(line => line.trim());
    }
  }
  return value.split('\n').filter(line => line.trim());
};

// Limpa diagnósticos que vieram como string JSON bruta (ex: ["TCE grave","..."])
const cleanDiagnosisDisplay = (diagnosis: string): string => {
  const trimmed = diagnosis.trim();
  // Se parece com array JSON, tenta parsear e juntar
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.join(' • ');
    } catch {}
  }
  // Remove aspas externas se houver
  return trimmed.replace(/^["']|["']$/g, '');
};

// Helper to extract index from drag-and-drop ID (format: "prefix-X" or "prefix-sub-X")
const extractIndexFromDragId = (id: string | number): number => {
  const parts = String(id).split('-');
  return parseInt(parts[parts.length - 1]);
};

// Helper to safely reorder array items via drag-and-drop
const handleArrayDragReorder = <T,>(
  event: DragEndEvent,
  items: T[],
  onReorder: (reordered: T[]) => void
): void => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  
  const oldIndex = extractIndexFromDragId(active.id);
  const newIndex = extractIndexFromDragId(over.id);
  
  if (isNaN(oldIndex) || isNaN(newIndex) || oldIndex < 0 || newIndex < 0 || 
      oldIndex >= items.length || newIndex >= items.length) {
    return;
  }
  
  onReorder(arrayMove(items, oldIndex, newIndex));
};

// Auto-resize textarea component
interface AutoResizeTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

const AutoResizeTextarea = memo(({ value, onChange, onKeyDown, onBlur, placeholder, className, inputRef }: AutoResizeTextareaProps) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef || internalRef;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Save cursor position before resize
      const { selectionStart, selectionEnd } = textarea;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      // Restore cursor position after resize to prevent jumping
      if (document.activeElement === textarea) {
        textarea.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      placeholder={placeholder}
      className={cn(
        "resize-none overflow-hidden w-full min-h-[20px] text-xs text-foreground border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:outline-none",
        className
      )}
      rows={1}
    />
  );
});

// Helper function to calculate days until discharge
const calculateDaysUntilDischarge = (dateString: string): string | null => {
  if (!dateString || dateString.trim() === '') return null;
  
  try {
    // Try parsing various date formats
    let targetDate: Date | null = null;
    
    // Try ISO format first (YYYY-MM-DD)
    targetDate = parseISO(dateString);
    
    // If invalid, try DD/MM/YYYY format
    if (!isValid(targetDate)) {
      targetDate = parse(dateString, 'dd/MM/yyyy', new Date());
    }
    
    // If still invalid, try DD-MM-YYYY format
    if (!isValid(targetDate)) {
      targetDate = parse(dateString, 'dd-MM-yyyy', new Date());
    }
    
    if (!isValid(targetDate)) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate day calculation
    targetDate.setHours(0, 0, 0, 0);
    
    const days = differenceInDays(targetDate, today);
    
    if (days < 0) {
      return `(${Math.abs(days)} dias atrás)`;
    } else if (days === 0) {
      return '(hoje)';
    } else if (days === 1) {
      return '(amanhã)';
    } else {
      return `(em ${days} dias)`;
    }
  } catch (error) {
    return null;
  }
};

interface PatientCardProps {
  patient: Patient;
  onUpdate: (updatedPatient: Patient) => void;
  onDelete?: (patientId: string) => void;
  onReleasePreAdmissionBed?: (patientId: string, payload: { reason: string; reasonNote: string }) => void | Promise<void>;
  onUndelete?: (patient: Patient) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (patientId: string) => void;
  onTransfer?: (patientId: string, newSector: Patient['sector']) => void;
  onPrintPatient?: (patientId: string) => void;
  onRefetch?: () => void;
  onQuickView?: (patient: Patient) => void;
}

const sectorConfig = {
  red: {
    label: "UTI 1",
    color: "bg-critical/10 border-critical/30 text-critical-foreground",
    badgeColor: "bg-critical text-critical-foreground hover:bg-critical/90"
  },
  yellow: {
    label: "UTI 2",
    color: "bg-warning/10 border-warning/30 text-warning-foreground",
    badgeColor: "bg-warning text-warning-foreground hover:bg-warning/90"
  },
  blue: {
    label: "UCI 1",
    color: "bg-stable/10 border-stable/30 text-stable-foreground",
    badgeColor: "bg-stable text-stable-foreground hover:bg-stable/90"
  },
  outside: {
    label: "UCI 2",
    color: "bg-muted/50 border-muted-foreground/30 text-foreground",
    badgeColor: "bg-muted-foreground text-background hover:bg-muted-foreground/90"
  }
};

const sectorLabels = {
  red: "UTI 1",
  yellow: "UTI 2",
  blue: "UCI 1",
  outside: "UCI 2"
};

interface SortablePendencyItemProps {
  id: string;
  index: number;
  pendency: string;
  isHighlighted?: boolean;
  onToggleHighlight?: () => void;
  sector: Patient['sector'];
}

const SortablePendencyItem = memo(function SortablePendencyItem({ id, index, pendency, isHighlighted, onToggleHighlight, sector }: SortablePendencyItemProps) {
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

  const highlightColors = {
    red: "bg-critical/20 border-critical/50",
    yellow: "bg-warning/20 border-warning/50",
    blue: "bg-stable/20 border-stable/50",
    outside: "bg-muted-foreground/20 border-muted-foreground/50"
  };

  const starColors = {
    red: "fill-critical text-critical",
    yellow: "fill-warning text-warning",
    blue: "fill-stable text-stable",
    outside: "fill-muted-foreground text-muted-foreground"
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "text-xs text-foreground leading-tight print:text-xs print:leading-tight flex items-center gap-2 rounded-md px-2 -mx-1 py-2 group",
        isDragging ? "bg-accent/50 z-50" : "hover:bg-accent/30",
        isHighlighted && `${highlightColors[sector]} border shadow-sm`
      )}
    >
      <div
        className="cursor-grab active:cursor-grabbing print:hidden"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      </div>
      <span className="font-medium text-muted-foreground flex-shrink-0">{index + 1}.</span>
      <span className={cn("flex-1", isHighlighted && "font-semibold")}>{pendency}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleHighlight}
        className="h-5 w-5 p-0 print:hidden opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Star className={cn("h-3 w-3", isHighlighted ? starColors[sector] : "text-muted-foreground")} />
      </Button>
    </li>
  );
});

interface SortablePendencyItemCollapsedProps {
  id: string;
  index: number;
  pendency: string;
  onEdit: () => void;
  onRemove: () => void;
  isLast: boolean;
  onAddNew: () => void;
  editingField: string | null;
  isHighlighted?: boolean;
  onToggleHighlight?: () => void;
  sector: Patient['sector'];
}

const SortablePendencyItemCollapsed = memo(function SortablePendencyItemCollapsed({
  id, 
  index, 
  pendency, 
  onEdit, 
  onRemove, 
  isLast, 
  onAddNew,
  editingField,
  isHighlighted,
  onToggleHighlight,
  sector
}: SortablePendencyItemCollapsedProps) {
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

  const highlightColors = {
    red: "bg-critical/20 border-critical/50",
    yellow: "bg-warning/20 border-warning/50",
    blue: "bg-stable/20 border-stable/50",
    outside: "bg-muted-foreground/20 border-muted-foreground/50"
  };

  const starColors = {
    red: "fill-critical text-critical",
    yellow: "fill-warning text-warning",
    blue: "fill-stable text-stable",
    outside: "fill-muted-foreground text-muted-foreground"
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "text-xs text-foreground leading-snug group/item rounded-md px-1 -mx-1 flex items-start justify-between gap-1 py-1",
        isDragging ? "bg-accent/50 z-50" : "hover:bg-accent/50",
        isHighlighted && `${highlightColors[sector]} border shadow-sm`
      )}
    >
      <div
        className="cursor-grab active:cursor-grabbing print:hidden flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      <span 
        className="break-words flex items-start gap-1 flex-1 cursor-pointer"
        onClick={onEdit}
      >
        <span className="font-medium text-muted-foreground flex-shrink-0">{index + 1}.</span>
        <span className={cn("break-words", isHighlighted && "font-semibold")}>{pendency}</span>
      </span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleHighlight?.();
          }}
          className="opacity-0 group-hover/item:opacity-100 hover:text-primary print:hidden"
        >
          <Star className={cn("h-2.5 w-2.5", isHighlighted ? starColors[sector] : "text-muted-foreground")} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover/item:opacity-100 hover:text-destructive"
        >
          <X className="h-2.5 w-2.5" />
        </button>
        {isLast && editingField !== "pendencies" && (
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onAddNew();
            }}
            className="h-4 w-4 text-muted-foreground hover:text-primary print:hidden p-0"
            title="Adicionar Programação/Pendência"
          >
            <span className="text-xs">+</span>
          </Button>
        )}
      </div>
    </div>
  );
});

interface SortableDiagnosisItemCollapsedProps {
  id: string;
  index: number;
  diagnosis: string;
  isEditing: boolean;
  editValue: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onAddNew: () => void;
  onEditValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  isLast: boolean;
  onGetCid?: (diagnosis: string, index: number) => void;
  loadingCid?: boolean;
  daysCalculation?: string | null;
}

const SortableDiagnosisItemCollapsed = memo(function SortableDiagnosisItemCollapsed({
  id, 
  index, 
  diagnosis,
  isEditing,
  editValue,
  onEdit, 
  onSave,
  onCancel,
  onRemove, 
  isLast, 
  onAddNew,
  onEditValueChange,
  onKeyDown,
  inputRef,
  onGetCid,
  loadingCid,
  daysCalculation
}: SortableDiagnosisItemCollapsedProps) {
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

  if (isEditing) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className="text-xs text-foreground leading-snug group/item rounded-md px-1 -mx-1 flex items-start justify-between gap-1 py-1 bg-accent/30 border border-primary"
      >
        <div className="flex-shrink-0 w-3" />
        <div className="flex items-start gap-1 flex-1">
          <span className="font-medium text-muted-foreground flex-shrink-0 pt-[2px]">{index + 1}.</span>
          <AutoResizeTextarea
            inputRef={inputRef}
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onSave}
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onGetCid && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onGetCid(editValue, index)}
              disabled={loadingCid}
              className="h-4 w-4 text-warning hover:bg-warning-soft hover:text-warning-on-soft p-0 transition-colors"
              title="Buscar código CID"
            >
              <Sparkles className={`h-2.5 w-2.5 ${loadingCid ? 'animate-pulse' : ''}`} />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onSave}
            className="h-4 w-4 text-released-on-soft hover:bg-released-soft p-0"
          >
            <Check className="h-2.5 w-2.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancel}
            className="h-4 w-4 text-critical-on-soft hover:bg-critical-soft p-0"
          >
            <X className="h-2.5 w-2.5" />
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li 
      ref={setNodeRef}
      style={style}
      className={cn(
        "text-xs text-foreground leading-snug group/item rounded-md px-1 -mx-1 flex items-start justify-between gap-1 py-1",
        isDragging ? "bg-accent/50 z-50" : "hover:bg-accent/50"
      )}
    >
      <div
        className="cursor-grab active:cursor-grabbing print:hidden flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      <span 
        className="break-words flex items-start gap-1 flex-1 cursor-pointer"
        onClick={onEdit}
      >
        <span className="font-medium text-muted-foreground flex-shrink-0">{index + 1}.</span>
        <span className="break-words">{diagnosis}</span>
        {daysCalculation && (
          <span className="text-xs text-muted-foreground/70 ml-1 font-normal">{daysCalculation}</span>
        )}
      </span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover/item:opacity-100 hover:text-destructive"
        >
          <X className="h-2.5 w-2.5" />
        </button>
        {isLast && (
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onAddNew();
            }}
            className="h-4 w-4 text-muted-foreground hover:text-primary print:hidden p-0"
            title="Adicionar Hipótese/Diagnóstico"
          >
            <span className="text-xs">+</span>
          </Button>
        )}
      </div>
    </li>
  );
});

export function PatientCard({ patient, onUpdate, onDelete, onReleasePreAdmissionBed, onUndelete, selectionMode = false, isSelected = false, onToggleSelection, onTransfer, onPrintPatient, onRefetch, onQuickView }: PatientCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReleasePreAdmissionOpen, setIsReleasePreAdmissionOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [movementType, setMovementType] = useState<"ALTA" | "ÓBITO" | "TRANSFERÊNCIA" | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingArrayIndex, setEditingArrayIndex] = useState<number>(-1);
  const [expandedSection, setExpandedSection] = useState<'diagnoses' | 'exams' | 'medicalHistory' | 'pendencies' | null>(null);
  const [loadingCid, setLoadingCid] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const movementTriggerRef = useRef<HTMLButtonElement>(null);
  const config = sectorConfig[patient.sector as keyof typeof sectorConfig] ?? sectorConfig.outside;
  const { toast: toastHook } = useToast();
  const { currentDepartment } = useDepartment();
  const navigate = useNavigate();
  const [medicalResponsibilityDialogOpen, setMedicalResponsibilityDialogOpen] = useState(false);
  const [localMedicalResponsibility, setLocalMedicalResponsibility] = useState(patient.medicalResponsibility);
  const [internmentStatusDialogOpen, setInternmentStatusDialogOpen] = useState(false);
  const [quickTemplatesDialogOpen, setQuickTemplatesDialogOpen] = useState(false);
  const [applyTemplateDialogOpen, setApplyTemplateDialogOpen] = useState(false);
  const [examCurvesDialogOpen, setExamCurvesDialogOpen] = useState(false);
  const [examinusAIDialogOpen, setExaminusAIDialogOpen] = useState(false);
  const [bedAllocationDialogOpen, setBedAllocationDialogOpen] = useState(false);
  const [dietDialogOpen, setDietDialogOpen] = useState(false);
  const [conductHistoryDialogOpen, setConductHistoryDialogOpen] = useState(false);
  const [admissionHistoryDialogOpen, setAdmissionHistoryDialogOpen] = useState(false);
  const [roundPrintDialogOpen, setRoundPrintDialogOpen] = useState(false);
  const [reallocationDialogOpen, setReallocationDialogOpen] = useState(false);
  const [signalTransferOpen, setSignalTransferOpen] = useState(false);
  const [relocationDialogOpen, setRelocationDialogOpen] = useState(false);
  const { history: conductHistory, isLoading: conductHistoryLoading, recordChange } = useConductHistory(patient.id);
  const { role, user } = useAuth();
  const { requests } = useBedAllocationRequests();
  const stayTimer = useSectorStayTimer(patient.admissionDate);
  const { namesHidden } = usePrivacy();
  const displayName = maskName(patient.name, namesHidden);
  
  // Find allocation request for this patient and calculate elapsed time
  const allocationTimeElapsed = useMemo(() => {
    if (!patient.allocationStatus || patient.allocationStatus === 'approved' || !patient.isDoorPatient) {
      return null;
    }
    
    const patientRequest = requests.find(r => r.patient_id === patient.id);
    if (!patientRequest?.created_at) return null;
    
    const createdAt = new Date(patientRequest.created_at);
    const now = new Date();
    
    const minutes = differenceInMinutes(now, createdAt);
    const hours = differenceInHours(now, createdAt);
    const days = differenceInDays(now, createdAt);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}min`;
    return `${minutes}min`;
  }, [patient.id, patient.allocationStatus, patient.isDoorPatient, requests]);
  
  // Check if porta or visitante user can edit this patient
  const canEdit = useMemo(() => {
    // Visitante users cannot edit any patient
    if (role === 'visitante') return false;
    // Porta users can only edit patients they created
    if (role === 'porta') return patient.createdBy === user?.id;
    // Other roles can edit all patients
    return true;
  }, [role, user?.id, patient.createdBy]);
  
  // Sync local medical responsibility with patient prop changes
  useEffect(() => {
    setLocalMedicalResponsibility(patient.medicalResponsibility);
  }, [patient.medicalResponsibility]);
  
  // Cor do setor no mapa: identificacao, nao estado clinico. Usa o cinza
  // estrutural com variacao de intensidade em vez de vermelho/amarelo/azul —
  // aquelas cores pertencem ao sinal clinico e, usadas aqui, competiam com
  // alertas de verdade dentro do mesmo cartao.
  const sectorColorMap = useMemo(() => ({
    red: "hsl(210 65% 28%)",
    yellow: "hsl(210 40% 46%)",
    blue: "hsl(210 25% 60%)",
    outside: "hsl(215 12% 55%)"
  }), []);

  /**
   * Etapas da solicitacao de internacao.
   *
   * Antes cada etapa tinha uma familia de cor propria — ambar, verde, azul,
   * vermelho e roxo — para representar momentos de UM MESMO fluxo. Cinco cores
   * nao comunicam cinco significados aqui: comunicam desorganizacao, e um
   * cartao com varias delas ao mesmo tempo vira mosaico.
   *
   * Agora seguem o sistema: o que ESPERA acao e atencao (ambar), o que foi
   * CONCLUIDO e liberado (verde), o que exige decisao IMEDIATA e critico
   * (vermelho). Destino (UTI x enfermaria) e informacao do rotulo, nao da cor.
   *
   * Emoji removido dos rotulos: o icone ao lado ja cumpre a funcao, e emoji
   * em prontuario nao acompanha o tom de um documento clinico.
   */
  const internmentStatusConfig = useMemo(() => ({
    SOLICITACAO_PENDENTE: {
      label: "Solicitação pendente",
      icon: Clock,
      color: "text-warning-on-soft",
      bgColor: "bg-warning-soft",
      borderColor: "border-warning-border",
    },
    PSM_FAVORAVEL: {
      label: "Internação PSM favorável",
      icon: CheckCircle2,
      color: "text-released-on-soft",
      bgColor: "bg-released-soft",
      borderColor: "border-released-border",
    },
    AGUARDANDO_VAGA: {
      label: "Aguardando alocação no SIGA",
      icon: BedDouble,
      color: "text-warning-on-soft",
      bgColor: "bg-warning-soft",
      borderColor: "border-warning-border",
    },
    IR_PARA_UTI: {
      label: "Ir para leito de UTI",
      icon: BedDouble,
      color: "text-critical-on-soft",
      bgColor: "bg-critical-soft",
      borderColor: "border-critical-border",
    },
    IR_PARA_ENFERMARIA: {
      label: "Ir para leito de enfermaria",
      icon: BedDouble,
      color: "text-released-on-soft",
      bgColor: "bg-released-soft",
      borderColor: "border-released-border",
    },
  }), []);

  // Get sector color based on patient sector
  const sectorColor = useMemo(() => {
    switch (patient.sector) {
      case 'red':
        return sectorColorMap.red;
      case 'yellow':
        return sectorColorMap.yellow;
      case 'blue':
        return sectorColorMap.blue;
      case 'outside':
        return sectorColorMap.outside;
      default:
        return sectorColorMap.blue;
    }
  }, [patient.sector, sectorColorMap]);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const handleCopyName = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(patient.name);
      toastHook({
        title: "Nome copiado",
        description: `"${patient.name}" foi copiado para a área de transferência.`,
      });
    } catch (err) {
      toastHook({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o nome.",
        variant: "destructive",
      });
    }
  }, [patient.name, toastHook]);

  const getCidCode = useCallback(async (diagnosis: string, index: number) => {
    if (!diagnosis.trim()) {
      toast.error("Digite um diagnóstico antes de buscar o CID");
      return;
    }

    setLoadingCid(index);
    try {
      const { data, error } = await supabase.functions.invoke('get-cid-code', {
        body: { diagnosis }
      });

      if (error) throw error;

      if (data?.cidCode) {
        const diagnosisWithCid = `${diagnosis} (${data.cidCode})`;
        
        // Se estiver em modo de edição, atualiza o valor de edição e salva automaticamente
        if (editingField === "diagnoses" && editingArrayIndex === index) {
          setEditValue(diagnosisWithCid);
          
          // Salva automaticamente
          const updatedPatient = { ...patient };
          updatedPatient.diagnoses = patient.diagnoses.map((d, i) => 
            i === index ? diagnosisWithCid : d
          );
          onUpdate(updatedPatient);
          
          // Cancela o modo de edição
          setEditingField(null);
          setEditValue("");
          setEditingArrayIndex(-1);
        } else {
          // Caso não esteja em edição, atualiza diretamente
          const updatedDiagnoses = patient.diagnoses.map((d, i) => 
            i === index ? diagnosisWithCid : d
          );
          onUpdate({ ...patient, diagnoses: updatedDiagnoses });
        }
        
        toast.success(`CID ${data.cidCode} adicionado`);
      }
    } catch (error) {
      console.error('Error getting CID code:', error);
      toast.error("Não foi possível buscar código CID");
    } finally {
      setLoadingCid(null);
    }
  }, [patient, editingField, editingArrayIndex, onUpdate]);

  const handleTransfer = useCallback((newSector: Patient['sector']) => {
    if (onTransfer && newSector !== patient.sector) {
      onTransfer(patient.id, newSector);
    }
  }, [onTransfer, patient.id, patient.sector]);

  const startEditing = useCallback((field: string, currentValue: string, index: number = -1) => {
    const readOnlyInlineFields = new Set(["name", "age", "bedNumber", "admissionDate"]);
    if (readOnlyInlineFields.has(field)) {
      toast.error("Campo somente leitura no mapa de leitos");
      return;
    }
    // Hipóteses/Diagnósticos são sincronizados pela admissão e evolução clínica.
    if (field === "diagnoses") {
      toast.info("Hipóteses são sincronizadas pela admissão / evolução clínica. Edite na evolução do paciente.");
      return;
    }

    // Porta users can only edit patients they created
    if (!canEdit) {
      toast.error("Você só pode editar pacientes que você criou");
      return;
    }
    setEditingField(field);
    setEditValue(currentValue);
    setEditingArrayIndex(index);
  }, [canEdit]);

  const cancelEditing = useCallback(() => {
    setEditingField(null);
    setEditValue("");
    setEditingArrayIndex(-1);
  }, []);

  const saveInlineEdit = async () => {
    if (!editingField) return;

    // GUARDA FIXA: identificação do leito/paciente é IMUTÁVEL pelo mapa de leitos.
    // Idade vem do cadastro; leito muda apenas por realocação/transferência; nome pelo prontuário.
    if (["name", "age", "bedNumber", "admissionDate"].includes(editingField)) {
      setEditingField(null);
      setEditValue("");
      toastHook({
        title: "Edição bloqueada",
        description: "Nome, idade, leito e admissão são campos somente leitura no mapa de leitos.",
        variant: "destructive",
      });
      return;
    }

    const updatedPatient = { ...patient };
    
    if (editingField === "name") {
      updatedPatient.name = editValue;
      // Auto-set admission date when name is first added
      if (!patient.admissionDate && editValue.trim()) {
        updatedPatient.admissionDate = new Date().toISOString();
      }
    } else if (editingField === "admissionDate") {
      // Edição inline da data de admissão é BLOQUEADA.
      // Caminho único: Edição Avançada → AdmissionDateEditor (com motivo + histórico auditado).
      setEditingField(null);
      setEditValue("");
      toastHook({
        title: "Edição bloqueada",
        description: "A data de admissão só pode ser alterada por Edição Avançada (com motivo e histórico).",
        variant: "destructive",
      });
      return;
    } else if (editingField === "diagnoses") {
      if (editingArrayIndex === -2) {
        // Adding new
        if (editValue.trim()) {
          updatedPatient.diagnoses = [...patient.diagnoses, editValue];
        }
      } else {
        updatedPatient.diagnoses = patient.diagnoses.map((d, i) => 
          i === editingArrayIndex ? editValue : d
        );
      }
    } else if (editingField === "medicalHistory") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.medicalHistory = [...patient.medicalHistory, editValue];
        }
      } else {
        updatedPatient.medicalHistory = patient.medicalHistory.map((h, i) => 
          i === editingArrayIndex ? editValue : h
        );
      }
    } else if (editingField === "relevantExams") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.relevantExams = [...patient.relevantExams, editValue];
        }
      } else {
        updatedPatient.relevantExams = patient.relevantExams.map((e, i) => 
          i === editingArrayIndex ? editValue : e
        );
      }
    } else if (editingField === "pendencies") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.pendencies = [...patient.pendencies, editValue];
        }
      } else {
        updatedPatient.pendencies = patient.pendencies.map((p, i) => 
          i === editingArrayIndex ? editValue : p
        );
      }
    } else if (editingField === "utiAdmissionDate") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.utiAdmissionDate = [...(patient.utiAdmissionDate || []), editValue];
        }
      } else {
        updatedPatient.utiAdmissionDate = (patient.utiAdmissionDate || []).map((item, i) => 
          i === editingArrayIndex ? editValue : item
        );
      }
    } else if (editingField === "utiDischargePrediction") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.utiDischargePrediction = [...(patient.utiDischargePrediction || []), editValue];
        }
      } else {
        updatedPatient.utiDischargePrediction = (patient.utiDischargePrediction || []).map((item, i) => 
          i === editingArrayIndex ? editValue : item
        );
      }
    } else if (editingField === "utiAllergies") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.utiAllergies = [...(patient.utiAllergies || []), editValue];
        }
      } else {
        updatedPatient.utiAllergies = (patient.utiAllergies || []).map((item, i) => 
          i === editingArrayIndex ? editValue : item
        );
      }
    } else if (editingField === "utiAdmissionReason") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.utiAdmissionReason = [...(patient.utiAdmissionReason || []), editValue];
        }
      } else {
        updatedPatient.utiAdmissionReason = (patient.utiAdmissionReason || []).map((item, i) => 
          i === editingArrayIndex ? editValue : item
        );
      }
    } else if (editingField === "utiCurrentStatus") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.utiCurrentStatus = [...(patient.utiCurrentStatus || []), editValue];
        }
      } else {
        updatedPatient.utiCurrentStatus = (patient.utiCurrentStatus || []).map((item, i) => 
          i === editingArrayIndex ? editValue : item
        );
      }
    } else if (editingField === "utiDevices") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.utiDevices = [...(patient.utiDevices || []), editValue];
        }
      } else {
        updatedPatient.utiDevices = (patient.utiDevices || []).map((item, i) => 
          i === editingArrayIndex ? editValue : item
        );
      }
    } else if (editingField === "utiSpecialties") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.utiSpecialties = [...(patient.utiSpecialties || []), editValue];
        }
      } else {
        updatedPatient.utiSpecialties = (patient.utiSpecialties || []).map((item, i) => 
          i === editingArrayIndex ? editValue : item
        );
      }
    } else if (editingField === "utiCulturesAntibiotics") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.utiCulturesAntibiotics = [...(patient.utiCulturesAntibiotics || []), editValue];
        }
      } else {
        updatedPatient.utiCulturesAntibiotics = (patient.utiCulturesAntibiotics || []).map((item, i) => 
          i === editingArrayIndex ? editValue : item
        );
      }
    } else if (editingField === "utiOriginSector") {
      if (editingArrayIndex === -2) {
        if (editValue.trim()) {
          updatedPatient.utiOriginSector = [...(patient.utiOriginSector || []), editValue];
        }
      } else {
        updatedPatient.utiOriginSector = (patient.utiOriginSector || []).map((item, i) => 
          i === editingArrayIndex ? editValue : item
        );
      }
    }

    // Record conduct history for tracked fields
    const trackedFields = ["diagnoses", "medicalHistory", "relevantExams", "pendencies", "schedule", "admissionHistory"];
    if (editingField && trackedFields.includes(editingField)) {
      const getFieldValue = (p: typeof patient, field: string): string => {
        const val = (p as any)[field];
        return Array.isArray(val) ? val.join("\n") : (val || "");
      };
      const oldVal = getFieldValue(patient, editingField);
      const newVal = getFieldValue(updatedPatient, editingField);
      if (oldVal !== newVal) {
        recordChange({ fieldName: editingField, oldValue: oldVal || null, newValue: newVal || null });
      }
    }

    onUpdate(updatedPatient);
    setEditingField(null);
    setEditValue("");
    setEditingArrayIndex(-1);
    
    toastHook({
      title: "Campo atualizado",
      description: "As alterações foram salvas com sucesso.",
    });
  };

  const saveAndContinueAdding = () => {
    if (!editingField || !editValue.trim()) return;

    const updatedPatient = { ...patient };
    
    if (editingField === "diagnoses") {
      updatedPatient.diagnoses = [...patient.diagnoses, editValue];
    } else if (editingField === "medicalHistory") {
      updatedPatient.medicalHistory = [...patient.medicalHistory, editValue];
    } else if (editingField === "relevantExams") {
      updatedPatient.relevantExams = [...patient.relevantExams, editValue];
    } else if (editingField === "pendencies") {
      updatedPatient.pendencies = [...patient.pendencies, editValue];
    }

    // Record conduct history for addition
    const trackedAddFields = ["diagnoses", "medicalHistory", "relevantExams", "pendencies", "schedule"];
    if (editingField && trackedAddFields.includes(editingField)) {
      recordChange({
        fieldName: editingField,
        oldValue: null,
        newValue: `[ADICIONADO] ${editValue}`,
      });
    }

    onUpdate(updatedPatient);
    setEditValue("");
    // Incrementa o index para refletir o novo item adicionado
    setEditingArrayIndex(-2);
    
    toastHook({
      title: "Item adicionado",
      description: "Continue adicionando ou use Tab para próxima coluna.",
    });
  };

  const removeArrayItem = (field: "diagnoses" | "medicalHistory" | "relevantExams" | "pendencies" | "utiAdmissionDate" | "utiDischargePrediction" | "utiAllergies" | "utiAdmissionReason" | "utiCurrentStatus" | "utiDevices" | "utiSpecialties" | "utiCulturesAntibiotics" | "utiOriginSector", index: number) => {
    // Hipóteses/Diagnósticos são imutáveis no mapa — sincronizadas via evolução clínica.
    if (field === "diagnoses") {
      toast.info("Hipóteses são sincronizadas pela evolução clínica. Edite na evolução do paciente.");
      return;
    }
    const updatedPatient = { ...patient };

    if (field === "medicalHistory") {
      updatedPatient.medicalHistory = patient.medicalHistory.filter((_, i) => i !== index);
    } else if (field === "relevantExams") {
      updatedPatient.relevantExams = patient.relevantExams.filter((_, i) => i !== index);
    } else if (field === "pendencies") {
      updatedPatient.pendencies = patient.pendencies.filter((_, i) => i !== index);
      // Atualiza os índices dos highlights após remoção
      if (updatedPatient.highlightedPendencies && updatedPatient.highlightedPendencies.length > 0) {
        updatedPatient.highlightedPendencies = updatedPatient.highlightedPendencies
          .map(idx => idx > index ? idx - 1 : idx)
          .filter(idx => idx !== index);
      }
    } else if (field === "utiAdmissionDate") {
      updatedPatient.utiAdmissionDate = (patient.utiAdmissionDate || []).filter((_, i) => i !== index);
    } else if (field === "utiDischargePrediction") {
      updatedPatient.utiDischargePrediction = (patient.utiDischargePrediction || []).filter((_, i) => i !== index);
    } else if (field === "utiAllergies") {
      updatedPatient.utiAllergies = (patient.utiAllergies || []).filter((_, i) => i !== index);
    } else if (field === "utiAdmissionReason") {
      updatedPatient.utiAdmissionReason = (patient.utiAdmissionReason || []).filter((_, i) => i !== index);
    } else if (field === "utiCurrentStatus") {
      updatedPatient.utiCurrentStatus = (patient.utiCurrentStatus || []).filter((_, i) => i !== index);
    } else if (field === "utiDevices") {
      updatedPatient.utiDevices = (patient.utiDevices || []).filter((_, i) => i !== index);
    } else if (field === "utiSpecialties") {
      updatedPatient.utiSpecialties = (patient.utiSpecialties || []).filter((_, i) => i !== index);
    } else if (field === "utiCulturesAntibiotics") {
      updatedPatient.utiCulturesAntibiotics = (patient.utiCulturesAntibiotics || []).filter((_, i) => i !== index);
    } else if (field === "utiOriginSector") {
      updatedPatient.utiOriginSector = (patient.utiOriginSector || []).filter((_, i) => i !== index);
    }

    // Record conduct history for removal
    const trackedRemoveFields = ["diagnoses", "medicalHistory", "relevantExams", "pendencies", "schedule"];
    if (trackedRemoveFields.includes(field)) {
      const removedItem = (patient as any)[field]?.[index];
      if (removedItem) {
        recordChange({
          fieldName: field,
          oldValue: `[REMOVIDO] ${removedItem}`,
          newValue: null,
        });
      }
    }

    onUpdate(updatedPatient);
    toastHook({
      title: "Item removido",
      description: "O item foi removido com sucesso.",
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Extract index from ID (format: "pendency-X")
      const activeIdParts = String(active.id).split('-');
      const overIdParts = String(over.id).split('-');
      const oldIndex = parseInt(activeIdParts[activeIdParts.length - 1]);
      const newIndex = parseInt(overIdParts[overIdParts.length - 1]);

      if (isNaN(oldIndex) || isNaN(newIndex) || oldIndex < 0 || newIndex < 0 || 
          oldIndex >= patient.pendencies.length || newIndex >= patient.pendencies.length) {
        return;
      }

      // Atualiza os índices dos highlights após reordenação
      let updatedHighlights = [...(patient.highlightedPendencies || [])];
      if (updatedHighlights.length > 0) {
        updatedHighlights = updatedHighlights.map(idx => {
          if (idx === oldIndex) return newIndex;
          if (oldIndex < newIndex && idx > oldIndex && idx <= newIndex) return idx - 1;
          if (oldIndex > newIndex && idx >= newIndex && idx < oldIndex) return idx + 1;
          return idx;
        });
      }

      const updatedPatient = {
        ...patient,
        pendencies: arrayMove(patient.pendencies, oldIndex, newIndex),
        highlightedPendencies: updatedHighlights,
      };

      onUpdate(updatedPatient);
      toastHook({
        title: "Ordem atualizada",
        description: "A ordem das programações foi reorganizada.",
      });
    }
  };

  const handleDragEndDiagnoses = (_event: DragEndEvent) => {
    // Hipóteses/Diagnósticos são imutáveis no mapa — sem reordenação manual.
    return;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Enter: salva e continua na mesma coluna (próximo item do array ou apenas salva)
      if (editingArrayIndex === -2 && (editingField === "diagnoses" || editingField === "medicalHistory" || editingField === "relevantExams" || editingField === "pendencies")) {
        saveAndContinueAdding();
      } else {
        saveInlineEdit();
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Tab: salva e move para a próxima coluna
      saveInlineEdit();
      
      // Determina qual é a próxima coluna
      setTimeout(() => {
        if (editingField === "name") {
          // Idade é somente leitura (atualizada via cadastro). Pula direto p/ diagnósticos.
          if (patient.diagnoses.length > 0) {
            startEditing("diagnoses", patient.diagnoses[0], 0);
          } else {
            startEditing("diagnoses", "", -2);
          }
        } else if (editingField === "diagnoses") {
          if (patient.medicalHistory.length > 0) {
            startEditing("medicalHistory", patient.medicalHistory[0], 0);
          } else {
            startEditing("medicalHistory", "", -2);
          }
        } else if (editingField === "medicalHistory") {
          if (patient.relevantExams.length > 0) {
            startEditing("relevantExams", patient.relevantExams[0], 0);
          } else {
            startEditing("relevantExams", "", -2);
          }
        } else if (editingField === "relevantExams") {
          if (patient.pendencies.length > 0) {
            startEditing("pendencies", patient.pendencies[0], 0);
          } else {
            startEditing("pendencies", "", -2);
          }
        }
      }, 50);
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const checkboxColor = {
    red: "border-critical data-[state=checked]:bg-critical data-[state=checked]:border-critical",
    yellow: "border-warning data-[state=checked]:bg-warning data-[state=checked]:border-warning",
    blue: "border-stable data-[state=checked]:bg-stable data-[state=checked]:border-stable",
    outside: "border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:border-muted-foreground"
  }[patient.sector];

  // Allocation Status Bar configuration
  const allocationStatusBarConfig = useMemo(() => {
    if (!patient.allocationStatus || patient.allocationStatus === 'approved' || !patient.isDoorPatient) {
      return null;
    }
    
    // Find the allocation request to get the requested sector
    const patientRequest = requests.find(r => r.patient_id === patient.id);
    const requestedSector = patientRequest?.requested_sector || '';
    
    // Map sector to color class
    const sectorColorClass = {
      'red': 'sector-red',
      'yellow': 'sector-yellow', 
      'blue': 'sector-blue',
      'Sala de Cuidados Especiais': 'sector-red',
      'Observação Amarela': 'sector-yellow',
      'Observação Azul': 'sector-blue',
    }[requestedSector] || 'sector-blue';
    
    // Map sector to display name
    const sectorDisplayName = {
      'red': 'Sala de Cuidados Especiais',
      'yellow': 'Observação Amarela',
      'blue': 'Observação Azul',
      'Sala de Cuidados Especiais': 'Sala de Cuidados Especiais',
      'Observação Amarela': 'Observação Amarela',
      'Observação Azul': 'Observação Azul',
    }[requestedSector] || requestedSector;
    
    const statusConfigs = {
      pending: {
        label: "Aguardando",
        statusClass: "status-pending",
        iconClass: "icon-pending",
        icon: Clock,
      },
      discussing: {
        label: "Em discussão",
        statusClass: "status-discussing",
        iconClass: "icon-discussing",
        icon: MessageSquare,
      },
      rejected: {
        label: "Negado",
        statusClass: "status-rejected",
        iconClass: "icon-rejected",
        icon: XCircle,
      },
    };
    
    const statusConfig = statusConfigs[patient.allocationStatus as keyof typeof statusConfigs];
    if (!statusConfig) return null;
    
    return {
      ...statusConfig,
      sectorColorClass,
      sectorDisplayName,
    };
  }, [patient.allocationStatus, patient.isDoorPatient, patient.id, requests]);

  return (
    <>
      <div className="relative">
        {/* Allocation Status Bar - Above Card */}
        {allocationStatusBarConfig && (
          <div 
            className={cn(
              "allocation-status-bar py-1 px-3 flex items-center justify-center gap-2 cursor-pointer transition-all print:hidden",
              allocationStatusBarConfig.sectorColorClass
            )}
            onClick={() => {
              // Trigger the same dialog as AllocationPendingBadge
              const badge = document.querySelector(`[data-patient-id="${patient.id}"] .allocation-badge-trigger`);
              if (badge) (badge as HTMLElement).click();
            }}
          >
            {/* Status */}
            {allocationStatusBarConfig.icon === Clock && <Clock className={cn("h-3.5 w-3.5 relative z-10", allocationStatusBarConfig.iconClass)} />}
            {allocationStatusBarConfig.icon === MessageSquare && <MessageSquare className={cn("h-3.5 w-3.5 relative z-10", allocationStatusBarConfig.iconClass)} />}
            {allocationStatusBarConfig.icon === XCircle && <XCircle className={cn("h-3.5 w-3.5 relative z-10", allocationStatusBarConfig.iconClass)} />}
            <span className={cn("text-xs font-medium relative z-10", allocationStatusBarConfig.statusClass)}>
              {allocationStatusBarConfig.label}
            </span>
            
            {/* Separator */}
            <span className="separator relative z-10">•</span>
            
            {/* Destination */}
            <span className="text-xs font-medium relative z-10 status-destination">
              Para: {allocationStatusBarConfig.sectorDisplayName}
            </span>
            
            {/* Time */}
            {allocationTimeElapsed && (
              <>
                <span className="separator relative z-10">•</span>
                <span className="text-xs font-medium relative z-10 status-time">
                  Há {allocationTimeElapsed}
                </span>
              </>
            )}
          </div>
        )}
        
        <Card 
          data-patient-id={patient.id}
          className={cn(
            "relative transition-all duration-200 hover:shadow-md print:shadow-none print:break-inside-avoid print:mb-0 print:w-full", 
            config.color,
            isSelected && "ring-2 ring-primary",
            isDeleting && "animate-[slide-out-left_0.3s_ease-out_forwards]",
            allocationStatusBarConfig && "rounded-t-none",
            patient.admissionStatus === 'alta_dada' && "ring-1 ring-released/40 bg-released-soft/30 grayscale-[15%] opacity-95",
            patient.admissionStatus === 'obito' && "ring-1 ring-ring/50 bg-muted/50 grayscale-[35%] opacity-90",
            patient.admissionStatus === 'transferencia_interna_pendente' && "ring-1 ring-ring/50 bg-muted/30",
            patient.admissionStatus === 'transferencia_externa_pendente' && "ring-1 ring-ring/50 bg-muted/30"
          )}
        >
        
        <div className="p-3 md:p-2 print:p-2">
          <div className="flex items-start justify-between gap-3 md:gap-2 print:gap-1">
            {selectionMode && onToggleSelection && (
              <div className="flex items-center justify-center print:hidden flex-shrink-0">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelection(patient.id)}
                  className={cn("h-6 w-6 md:h-5 md:w-5", checkboxColor)}
                />
              </div>
            )}
            <div className="flex-1 flex flex-col gap-3 md:grid md:grid-cols-18 md:gap-2 md:items-start">
              {/* Mobile: Leito + Paciente na mesma linha */}
              <div className="flex items-start gap-3 md:contents">
                {/* Leito - ultra compacto */}
                <div className="flex flex-col shrink-0 md:col-span-1">
                  <span className="text-xs md:text-xs font-medium text-muted-foreground mb-1">Leito</span>
                  <Badge className={cn("patient-id w-fit text-sm md:text-xs py-1 md:py-0 px-2 md:px-1 font-semibold leading-tight", config.badgeColor)}>
                    {patient.bedNumber}
                  </Badge>
                  <div className="flex flex-col gap-1 mt-1">
                    {localMedicalResponsibility?.type ? (
                      <MedicalResponsibilityIndicator
                        responsibility={localMedicalResponsibility}
                        sectorColor={sectorColorMap[patient.sector]}
                        onClick={() => setMedicalResponsibilityDialogOpen(true)}
                        compact
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMedicalResponsibilityDialogOpen(true)}
                        className="h-5 w-5 p-0 print:hidden rounded-full border border-dashed transition-all duration-300 flex items-center justify-center hover:scale-125 hover:rotate-90"
                        style={{
                          color: sectorColorMap[patient.sector],
                          borderColor: sectorColorMap[patient.sector],
                          opacity: 0.5,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.backgroundColor = `${sectorColorMap[patient.sector]}30`;
                          e.currentTarget.style.borderStyle = 'solid';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.5';
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderStyle = 'dashed';
                        }}
                        title="Adicionar responsável médico"
                      >
                        <span className="text-sm font-semibold transition-transform duration-300">+</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Nome e Idade - mais espaço para nome completo */}
                <div className="flex flex-col flex-1 min-w-0 md:col-span-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs md:text-xs font-medium text-muted-foreground">Paciente</span>
                  {stayTimer && currentDepartment !== "UTI" && (
                    <div 
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0 rounded-full text-xs font-medium border print:hidden",
                        stayTimer.level !== "normal" && stayTimer.colorClasses
                      )}
                      style={stayTimer.level === "normal" ? {
                        color: sectorColorMap[patient.sector],
                        backgroundColor: `${sectorColorMap[patient.sector]}15`,
                        borderColor: `${sectorColorMap[patient.sector]}40`,
                      } : undefined}
                      title={`Permanência no setor: ${stayTimer.display}${stayTimer.level === "warning" ? " >24h" : stayTimer.level === "orange" ? " >48h" : stayTimer.level === "critical" || stayTimer.level === "pulsing" ? " >72h" : ""}`}
                    >
                      <Clock className="h-2 w-2" />
                      <span>{stayTimer.displayShort}</span>
                    </div>
                  )}
                </div>
                <div className="group/name relative">
                  <div className="flex items-start gap-1">
                    <div className="flex-1 min-w-0">
                      {editingField === "name" ? (
                        <div className="flex items-start gap-1">
                          <AutoResizeTextarea
                            inputRef={inputRef}
                            value={editValue}
                            onChange={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              const start = target.selectionStart ?? 0;
                              const end = target.selectionEnd ?? 0;
                              setEditValue(e.target.value);
                              requestAnimationFrame(() => {
                                target.setSelectionRange(start, end);
                              });
                            }}
                            onKeyDown={handleKeyDown}
                            onBlur={saveInlineEdit}
                            className="h-6 text-sm font-medium"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={saveInlineEdit}
                            className="h-6 w-6 text-released-on-soft hover:bg-released-soft"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                            className="h-6 w-6 text-critical-on-soft hover:bg-critical-soft"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {/* Internment Status Icon - Based on Pendencies Content */}
                          {(() => {
                            const pendenciesText = patient.pendencies?.join(' ').toUpperCase() || '';
                            
                            // Check for AGUARDANDO PSM - show clock icon
                            if (pendenciesText.includes('AGUARDANDO PSM')) {
                              return (
                                <div title="Aguardando PSM">
                                  <Clock className="h-4 w-4 text-warning flex-shrink-0" />
                                </div>
                              );
                            }
                            
                            // Check for approved internment statuses - show green check
                            if (pendenciesText.includes('PSM FAVORÁVEL') || 
                                pendenciesText.includes('PSM FAVORAVEL') ||
                                pendenciesText.includes('IR PARA LEITO DE UTI') ||
                                pendenciesText.includes('IR PARA LEITO DE ENFERMARIA') ||
                                pendenciesText.includes('IR PARA O CENTRO CIRÚRGICO') ||
                                pendenciesText.includes('IR PARA O CENTRO CIRURGICO')) {
                              return (
                                <div title="Solicitação de Internação Aprovada">
                                  <CircleCheck className="h-4 w-4 text-released flex-shrink-0" />
                                </div>
                              );
                            }
                            
                            return null;
                          })()}
                          
                          {/* PSM Desfavorável Alert Icon - Manual or Auto-detected */}
                          {(patient.psmStatus === 'desfavoravel' || 
                            patient.pendencies.some(p => 
                              p.toUpperCase().includes('PSM DESFAVORAVEL') || 
                              p.toUpperCase().includes('PSM DESFAVORÁVEL')
                            )
                          ) && (
                            <div 
                              title="PSM Desfavorável: Auditoria não indica internação no momento"
                              className="flex items-center"
                            >
                              <AlertTriangle className="h-4 w-4 text-critical flex-shrink-0 animate-pulse" />
                            </div>
                          )}
                           
                           <p 
                            className={cn(
                              "patient-id font-medium text-base md:text-sm text-foreground leading-tight break-words rounded-md px-1 -mx-1",
                              canEdit && "cursor-pointer hover:bg-accent/50"
                            )}
                            onClick={() => canEdit && setIsEditDialogOpen(true)}
                            title={canEdit ? "Editar dados do paciente" : undefined}
                          >
                            {namesHidden ? (
                              <span className="tracking-widest opacity-70 transition-all duration-300">{displayName}</span>
                            ) : patient.name ? patient.name : <span className="preserve-case text-muted-foreground italic">Clique para adicionar nome</span>}
                          </p>
                          
                          {/* Allocation Pending Badge - Hidden when status bar is visible, kept for dialog functionality */}
                          <div className={cn(allocationStatusBarConfig && "sr-only")}>
                            <AllocationPendingBadge patient={patient} onStatusChange={onRefetch} />
                          </div>
                        </div>
                      )}
                      
                      <p
                        className="text-sm md:text-xs text-muted-foreground mt-1 px-1 -mx-1 whitespace-normal break-words cursor-default"
                        title="Idade é atualizada automaticamente pelo cadastro do paciente"
                      >
                        {patient.age ? formatAgeDisplay(patient.age) : <span className="italic opacity-70">Idade não cadastrada</span>}
                      </p>
                    </div>
                    {!editingField && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCopyName}
                        className="h-5 w-5 opacity-60 group-hover/name:opacity-100 transition-opacity print:hidden hover:bg-primary/10 hover:text-primary flex-shrink-0 text-muted-foreground"
                        title="Copiar nome"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              </div>
              {/* Fim do wrapper mobile Leito+Paciente */}



            {/* Hipóteses / Diagnósticos - apenas para outros departamentos */}
            {role !== 'farmacia' && (
              <div className="flex flex-col md:col-span-3 relative">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Hipóteses / Diagnósticos</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setExpandedSection('diagnoses')}
                  className="h-2.5 w-2.5 p-0 text-muted-foreground/40 hover:text-primary opacity-50 hover:opacity-100 transition-opacity print:hidden"
                  title="Visualizar expandido"
                >
                  <Maximize2 className="h-[2.5px] w-[2.5px]" />
                </Button>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEndDiagnoses}
              >
                <SortableContext
                  items={patient.diagnoses.map((_, i) => `diagnosis-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <ol className="text-xs text-foreground space-y-1 print:text-xs list-none pl-0">
                    {patient.diagnoses.map((diagnosis, idx) => (
                      <SortableDiagnosisItemCollapsed
                        key={`diagnosis-${idx}`}
                        id={`diagnosis-${idx}`}
                        index={idx}
                        diagnosis={cleanDiagnosisDisplay(diagnosis)}
                        isEditing={editingField === "diagnoses" && editingArrayIndex === idx}
                        editValue={editValue}
                        onEdit={() => startEditing("diagnoses", diagnosis, idx)}
                        onSave={saveInlineEdit}
                        onCancel={cancelEditing}
                        onRemove={() => removeArrayItem("diagnoses", idx)}
                        onAddNew={() => startEditing("diagnoses", "", -2)}
                        onEditValueChange={(val) => setEditValue(val)}
                        onKeyDown={handleKeyDown}
                        inputRef={inputRef}
                        isLast={idx === patient.diagnoses.length - 1}
                        onGetCid={(diagnosis, index) => getCidCode(diagnosis, index)}
                        loadingCid={loadingCid === idx}
                      />
                    ))}
                  </ol>
                </SortableContext>

                {editingField === "diagnoses" && editingArrayIndex === -2 ? (
                  <li className="text-xs text-foreground leading-snug rounded-md px-1 -mx-1 flex items-start justify-between gap-1 py-1 bg-accent/30 border border-primary">
                    <div className="flex-shrink-0 w-3" />
                    <div className="flex items-center gap-1 flex-1">
                      <span className="font-medium text-muted-foreground flex-shrink-0">{patient.diagnoses.length + 1}.</span>
                      <AutoResizeTextarea
                        inputRef={inputRef}
                        value={editValue}
                        onChange={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          const start = target.selectionStart ?? 0;
                          const end = target.selectionEnd ?? 0;
                          setEditValue(e.target.value);
                          requestAnimationFrame(() => {
                            target.setSelectionRange(start, end);
                          });
                        }}
                        onKeyDown={handleKeyDown}
                        className="text-xs text-foreground flex-1 border-0 bg-transparent p-0 focus-visible:ring-0 resize-none"
                        placeholder="Nova hipótese"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={saveInlineEdit}
                        className="h-4 w-4 text-released-on-soft hover:bg-released-soft p-0"
                      >
                        <Check className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={cancelEditing}
                        className="h-4 w-4 text-critical-on-soft hover:bg-critical-soft p-0"
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </li>
                ) : null}
                
                {patient.diagnoses.length === 0 && editingField !== "diagnoses" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing("diagnoses", "", -2)}
                    className="h-5 w-5 text-muted-foreground hover:text-primary print:hidden"
                    title="Adicionar Hipótese/Diagnóstico"
                  >
                    <span className="text-xs">+</span>
                  </Button>
                )}
              </DndContext>
              </div>
            )}

            {/* Antecedentes - apenas para outros departamentos */}
            {role !== 'farmacia' && (
              <div className="flex flex-col md:col-span-3 relative">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Antecedentes</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setExpandedSection('medicalHistory')}
                  className="h-2.5 w-2.5 p-0 text-muted-foreground/40 hover:text-primary opacity-50 hover:opacity-100 transition-opacity print:hidden"
                  title="Visualizar expandido"
                >
                  <Maximize2 className="h-[2.5px] w-[2.5px]" />
                </Button>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event: DragEndEvent) => {
                  const { active, over } = event;
                  if (over && active.id !== over.id) {
                    const oldIndex = patient.medicalHistory.findIndex((_, i) => `history-${i}` === active.id);
                    const newIndex = patient.medicalHistory.findIndex((_, i) => `history-${i}` === over.id);
                    const reordered = arrayMove(patient.medicalHistory, oldIndex, newIndex);
                    onUpdate({ ...patient, medicalHistory: reordered });
                  }
                }}
              >
                <SortableContext
                  items={patient.medicalHistory.map((_, i) => `history-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <ol className="text-xs text-foreground space-y-1 print:text-xs list-none pl-0">
                    {patient.medicalHistory.map((history, idx) => (
                      <SortableDiagnosisItemCollapsed
                        key={`history-${idx}`}
                        id={`history-${idx}`}
                        index={idx}
                        diagnosis={history}
                        isEditing={editingField === "medicalHistory" && editingArrayIndex === idx}
                        editValue={editValue}
                        onEdit={() => startEditing("medicalHistory", history, idx)}
                        onSave={saveInlineEdit}
                        onCancel={cancelEditing}
                        onRemove={() => removeArrayItem("medicalHistory", idx)}
                        onAddNew={() => startEditing("medicalHistory", "", -2)}
                        onEditValueChange={(val) => setEditValue(val)}
                        onKeyDown={handleKeyDown}
                        inputRef={inputRef}
                        isLast={idx === patient.medicalHistory.length - 1}
                      />
                    ))}
                  </ol>
                </SortableContext>

                {editingField === "medicalHistory" && editingArrayIndex === -2 ? (
                  <li className="text-xs text-foreground leading-snug rounded-md px-1 -mx-1 flex items-start justify-between gap-1 py-1 bg-accent/30 border border-primary">
                    <div className="flex-shrink-0 w-3" />
                    <div className="flex items-center gap-1 flex-1">
                      <span className="font-medium text-muted-foreground flex-shrink-0">{patient.medicalHistory.length + 1}.</span>
                      <AutoResizeTextarea
                        inputRef={inputRef}
                        value={editValue}
                        onChange={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          const start = target.selectionStart ?? 0;
                          const end = target.selectionEnd ?? 0;
                          setEditValue(e.target.value);
                          requestAnimationFrame(() => {
                            target.setSelectionRange(start, end);
                          });
                        }}
                        onKeyDown={handleKeyDown}
                        className="text-xs text-foreground flex-1 border-0 bg-transparent p-0 focus-visible:ring-0 resize-none"
                        placeholder="Novo antecedente"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={saveInlineEdit}
                        className="h-4 w-4 text-released-on-soft hover:bg-released-soft p-0"
                      >
                        <Check className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={cancelEditing}
                        className="h-4 w-4 text-critical-on-soft hover:bg-critical-soft p-0"
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </li>
                ) : null}
                
                {patient.medicalHistory.length === 0 && editingField !== "medicalHistory" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing("medicalHistory", "", -2)}
                    className="h-5 w-5 text-muted-foreground hover:text-primary print:hidden"
                    title="Adicionar Antecedente Mórbido"
                  >
                    <span className="text-xs">+</span>
                  </Button>
                )}
              </DndContext>
              </div>
            )}


            {/* Programações / Pendências - apenas para outros departamentos */}
            {role !== 'farmacia' && (
              <div className="flex flex-col md:col-span-5 relative">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Programações / Pendências</span>
                  
                   <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setQuickTemplatesDialogOpen(true)}
                    className="h-4 w-4 p-0 hover:bg-accent transition-all print:hidden"
                    style={{ color: sectorColorMap[patient.sector] }}
                    title="Templates Rápidos"
                   >
                    <Zap className="h-1.5 w-1.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setApplyTemplateDialogOpen(true)}
                    className="h-4 w-4 p-0 hover:bg-accent transition-all print:hidden"
                    style={{ color: sectorColorMap[patient.sector] }}
                    title="Templates Terapêuticos (Protocolos)"
                   >
                    <FileText className="h-1.5 w-1.5" />
                  </Button>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                  <SortableContext
                    items={patient.pendencies.map((_, i) => `pendency-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {patient.pendencies.map((pendency, idx) => (
                      editingField === "pendencies" && editingArrayIndex === idx ? (
                        <div key={idx} className="text-xs text-foreground leading-snug rounded-md px-1 -mx-1 flex items-start justify-between gap-1 py-1 bg-accent/30 border border-primary">
                          <div className="flex-shrink-0 w-3" />
                          <div className="flex items-start gap-1 flex-1">
                            <span className="font-medium text-muted-foreground flex-shrink-0 mt-1">{idx + 1}.</span>
                            <textarea
                              ref={inputRef as any}
                              value={editValue}
                              onChange={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                const start = target.selectionStart;
                                const end = target.selectionEnd;
                                setEditValue(e.target.value);
                                // Restaura a posição do cursor após a atualização
                                requestAnimationFrame(() => {
                                  target.setSelectionRange(start, end);
                                });
                              }}
                              onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
                                  e.preventDefault();
                                  if (editingArrayIndex === -2) {
                                    saveAndContinueAdding();
                                  } else {
                                    saveInlineEdit();
                                  }
                                } else if (e.key === 'Escape') {
                                  cancelEditing();
                                }
                              }}
                              onBlur={saveInlineEdit}
                              className="min-h-[40px] text-xs flex-1 text-foreground resize-y border-0 bg-transparent p-0 focus-visible:ring-0"
                              rows={2}
                            />
                          </div>
                          <div className="flex items-start gap-1 flex-shrink-0 mt-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={saveInlineEdit}
                              className="h-4 w-4 text-released-on-soft hover:bg-released-soft p-0"
                            >
                              <Check className="h-2.5 w-2.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={cancelEditing}
                              className="h-4 w-4 text-critical-on-soft hover:bg-critical-soft p-0"
                            >
                              <X className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <SortablePendencyItemCollapsed
                          key={`pendency-${idx}`}
                          id={`pendency-${idx}`}
                          index={idx}
                          pendency={pendency}
                          onEdit={() => startEditing("pendencies", pendency, idx)}
                          onRemove={() => removeArrayItem("pendencies", idx)}
                          isLast={idx === patient.pendencies.length - 1}
                          onAddNew={() => startEditing("pendencies", "", -2)}
                          editingField={editingField}
                          isHighlighted={patient.highlightedPendencies?.includes(idx)}
                          sector={patient.sector}
                          onToggleHighlight={() => {
                            const highlighted = patient.highlightedPendencies || [];
                            const updatedHighlighted = highlighted.includes(idx)
                              ? highlighted.filter(i => i !== idx)
                              : [...highlighted, idx];
                            onUpdate({ ...patient, highlightedPendencies: updatedHighlighted });
                          }}
                        />
                      )
                    ))}
                  </SortableContext>
                  
                  {editingField === "pendencies" && editingArrayIndex === -2 ? (
                    <div className="text-xs text-foreground leading-snug rounded-md px-1 -mx-1 flex items-start justify-between gap-1 py-1 bg-accent/30 border border-primary">
                      <div className="flex-shrink-0 w-3" />
                      <div className="flex items-start gap-1 flex-1">
                        <span className="font-medium text-muted-foreground flex-shrink-0 mt-1">{patient.pendencies.length + 1}.</span>
                        <AutoResizeTextarea
                          inputRef={inputRef}
                          value={editValue}
                          onChange={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            const start = target.selectionStart ?? 0;
                            const end = target.selectionEnd ?? 0;
                            setEditValue(e.target.value);
                            // Restaura a posição do cursor após a atualização
                            requestAnimationFrame(() => {
                              target.setSelectionRange(start, end);
                            });
                          }}
                          onKeyDown={handleKeyDown}
                          onBlur={saveInlineEdit}
                          className="text-xs text-foreground flex-1 border-0 bg-transparent p-0 focus-visible:ring-0 resize-none"
                          placeholder="Nova pendência"
                        />
                      </div>
                      <div className="flex items-start gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={saveInlineEdit}
                          className="h-4 w-4 text-released-on-soft hover:bg-released-soft p-0"
                        >
                          <Check className="h-2.5 w-2.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={cancelEditing}
                          className="h-4 w-4 text-critical-on-soft hover:bg-critical-soft p-0"
                        >
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  
                  {patient.pendencies.length === 0 && editingField !== "pendencies" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEditing("pendencies", "", -2)}
                      className="h-5 w-5 text-muted-foreground hover:text-primary print:hidden"
                      title="Adicionar Programação/Pendência"
                    >
                      <span className="text-xs">+</span>
                    </Button>
                  )}
                </div>
              </DndContext>
              </div>
            )}
            </div>

          {/* Action Buttons Column - Integrated Design */}
          <div className="flex-shrink-0 flex flex-col gap-2 md:gap-2 print:hidden items-center">
            {/* Edição Avançada - Primary Action with Sector Identity */}
            {canEdit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditDialogOpen(true);
              }}
              className={cn(
                "h-10 w-10 md:h-8 md:w-8 rounded-lg transition-all duration-300 hover:scale-110 shadow-sm",
                "border border-transparent hover:border-current",
                "relative overflow-hidden group"
              )}
              style={{
                backgroundColor: `${sectorColor}15`,
                color: sectorColor,
              }}
              title="Edição Avançada"
            >
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{ backgroundColor: sectorColor }}
              />
              <Edit className="h-5 w-5 md:h-4 md:w-4 relative z-10" />
            </Button>
            )}

            {/* Sinais Vitais — acesso direto ao painel de monitoramento */}
            {patient.name && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => navigate(`/monitoramento?patientId=${patient.id}`)}
                className={cn(
                  "h-10 w-10 md:h-8 md:w-8 rounded-lg transition-all duration-300 hover:scale-110 shadow-sm",
                  "border border-transparent hover:border-current",
                  "relative overflow-hidden group print:hidden"
                )}
                style={{ backgroundColor: `${sectorColor}10`, color: sectorColor }}
                title="Sinais vitais"
                aria-label="Sinais vitais"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-300" style={{ backgroundColor: sectorColor }} />
                <Activity className="h-5 w-5 md:h-4 md:w-4 relative z-10 transition-transform duration-300 group-hover:scale-110" />
              </Button>
            )}

            {/* Actions Menu - Secondary Action */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={movementTriggerRef}
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-10 w-10 md:h-8 md:w-8 rounded-lg transition-all duration-300 hover:scale-110 shadow-sm",
                    "border border-transparent hover:border-current",
                    "relative overflow-hidden group"
                  )}
                  style={{
                    backgroundColor: `${sectorColor}10`,
                    color: sectorColor,
                  }}
                  title="Movimentação do leito"
                  aria-label="Movimentação do leito"
                >
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-300"
                    style={{ backgroundColor: sectorColor }}
                  />
                  <ArrowLeftRight className="h-5 w-5 md:h-4 md:w-4 relative z-10 transition-transform duration-300 group-hover:scale-110" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                side="bottom"
                alignOffset={-5}
                sideOffset={8}
                className="w-[280px] max-h-[min(75vh,600px)] p-0 bg-background/95 backdrop-blur-sm border border-border/50 shadow-md rounded-lg overflow-hidden"
              >
                <div className="p-2 space-y-1 overflow-y-auto max-h-[min(75vh,600px)] overscroll-contain">
                  
                    {/* SOLICITAR LEITO - Porta Users Only (Primary for porta) */}
                    {role === 'porta' && patient.sector === 'outside' && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setBedAllocationDialogOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium bg-muted hover:from-muted transition-colors cursor-pointer"
                      >
                        <BedDouble className="h-4 w-4 text-foreground" />
                        <span className="text-foreground">Solicitar Leito</span>
                      </DropdownMenuItem>
                    )}

                    {/* Non-porta users see regular menu */}
                    {role !== 'porta' && (
                      <>
                    {/* ============ BLOCO MOVIMENTAÇÃO ============
                        Único escopo do menu no Mapa de Leitos: mover o paciente entre leitos
                        ou desocupar o leito. Ações clínicas (alta/óbito/transferências) são
                        sinalizadas pelo Painel Clínico (Cockpit). */}
                    {patient.name && (
                      <div className="mb-1 rounded-lg border border-border/60 bg-muted/30 p-2 space-y-1">
                        <div className="flex items-center gap-2 px-2 pt-1 pb-1">
                          <Shuffle className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Movimentação
                          </span>
                        </div>

                        {/* REMANEJAR LEITO (mesmo setor) — permuta/realocação operacional */}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setRelocationDialogOpen(true);
                          }}
                          className="group/item flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer border border-transparent hover:border-border/60 hover:bg-gradient-to-r hover:from-muted hover:to-transparent transition-all duration-200 hover:translate-x-0.5 hover:shadow-sm focus:bg-muted"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted group-hover/item:bg-secondary transition-colors">
                            <ArrowLeftRight className="h-3.5 w-3.5 text-foreground" />
                          </div>
                          <div className="flex flex-col items-start min-w-0">
                            <span className="text-foreground leading-tight">
                              Remanejar leito <span className="text-xs font-normal text-foreground/70">(mesmo setor)</span>
                            </span>
                            <span className="text-xs font-normal text-muted-foreground leading-tight">
                              Realocar ou permutar entre leitos vagos do setor
                            </span>
                          </div>
                        </DropdownMenuItem>

                        {/* DESALOCAR LEITO — botão único.
                            Comportamento varia conforme estado:
                            • Sinalização ativa (transf. interna/externa) → conclui a movimentação.
                            • Alta/óbito assinados → libera leito (senha + auditoria).
                            • Sem sinalização → abre orientação didática com bloqueio duro
                              direcionando ao Painel Clínico (sem atalho excepcional). */}
                        {onReleasePreAdmissionBed && (role === 'admin' || role === 'medico') && (() => {
                          const isPostOutcome = patient.admissionStatus === 'alta_dada' || patient.admissionStatus === 'obito';
                          const isSignaled = patient.admissionStatus === 'transferencia_interna_pendente' || patient.admissionStatus === 'transferencia_externa_pendente';
                          const sub = isPostOutcome
                            ? 'Pós-alta/óbito — confirmação por senha, preserva prontuário'
                            : isSignaled
                              ? 'Conclui a sinalização feita no Painel Clínico'
                              : patient.admissionStatus === 'admitido'
                                ? 'Bloqueado — sinalize a movimentação no Painel Clínico'
                                : 'Bloqueado — sinalize a movimentação no Painel Clínico';
                          const tone = isSignaled ? 'emerald' : 'amber';
                          const isDisabled = !isSignaled && !isPostOutcome;
                          return (
                            <DropdownMenuItem
                              disabled={isDisabled}
                              onSelect={(e) => {
                                if (isDisabled) { e.preventDefault(); return; }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isDisabled) return;
                                setIsReleasePreAdmissionOpen(true);
                              }}
                              title={isDisabled ? 'Sinalize a movimentação no Painel Clínico antes de desalocar o leito.' : undefined}
                              className={cn(
                                "group/item flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium border border-transparent transition-all duration-200",
                                isDisabled
                                  ? "cursor-not-allowed opacity-50"
                                  : "cursor-pointer hover:translate-x-0.5 hover:shadow-sm",
                                !isDisabled && (tone === 'emerald'
                                  ? "hover:border-released-border/60 hover:bg-gradient-to-r hover:from-released-soft hover:to-transparent focus:bg-released-soft"
                                  : "hover:border-warning-border/60 hover:bg-gradient-to-r hover:from-warning-soft hover:to-transparent focus:bg-warning-soft")
                              )}
                            >
                              <div className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                                tone === 'emerald'
                                  ? "bg-released-soft group-hover/item:bg-released"
                                  : "bg-warning-soft group-hover/item:bg-warning"
                              )}>
                                {tone === 'emerald'
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-released-on-soft" />
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
                          Aqui executamos apenas a <strong>movimentação física</strong> do leito.
                        </p>
                      </div>
                    )}


                    {/* Elegant Divider */}
                    <div className="h-px bg-transparent my-2" />

                    {/* HISTÓRIA ADMISSIONAL */}
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdmissionHistoryDialogOpen(true);
                      }}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer"
                    >
                      <ClipboardList className="h-4 w-4 text-released-on-soft" />
                      <span>História Admissional</span>
                    </DropdownMenuItem>

                    {/* HISTÓRICO DE CONDUTAS */}
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setConductHistoryDialogOpen(true);
                      }}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer"
                    >
                      <Clock className="h-4 w-4 text-foreground" />
                      <span>Histórico de Condutas</span>
                    </DropdownMenuItem>

                    {/* SOLICITAR EXAME - Navigate to Requisições with patient data */}
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/requisicoes', { 
                          state: { 
                            patientId: patient.id, 
                            patientName: patient.name, 
                            patientBed: patient.bedNumber, 
                            patientSector: patient.sector 
                          } 
                        });
                      }}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer"
                    >
                      <TestTubes className="h-4 w-4 text-foreground" />
                      <span>Solicitar Exame</span>
                    </DropdownMenuItem>

                    {/* ROUND DIÁRIO - Navigate to Round with patient context */}
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        const params = new URLSearchParams({
                          patientId: patient.id,
                          patientName: patient.name,
                          patientBed: patient.bedNumber,
                          patientSector: patient.sector,
                          patientAge: patient.age?.toString() || "",
                        });
                        navigate(`/round?${params.toString()}`);
                      }}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer"
                    >
                      <ClipboardCheck className="h-4 w-4 text-foreground" />
                      <span>Round Diário</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setDietDialogOpen(true);
                      }}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer"
                    >
                      <Utensils className="h-4 w-4 text-released-on-soft" />
                      <span>Liberar Dieta</span>
                    </DropdownMenuItem>

                    {/* PSM STATUS - Collapsible with three options */}
                    <Collapsible className="group">
                      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-sm font-medium hover:bg-accent/60 transition-all duration-200 group-data-[state=open]:bg-accent/40">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-left text-foreground">Status do PSM</span>
                        {patient.psmStatus && (
                          <span className={cn(
                            "text-xs font-medium px-2 py-1 rounded-md",
                            patient.psmStatus === 'favoravel' && "bg-released-soft text-released-on-soft",
                            patient.psmStatus === 'aguardando' && "bg-warning-soft text-warning-on-soft",
                            patient.psmStatus === 'desfavoravel' && "bg-critical-soft text-critical-on-soft"
                          )}>
                            {patient.psmStatus === 'favoravel' ? 'Favorável' : patient.psmStatus === 'aguardando' ? 'Aguardando' : 'Desfavorável'}
                          </span>
                        )}
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1 space-y-1 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            const newStatus = patient.psmStatus === 'favoravel' ? null : 'favoravel';
                            onUpdate({ ...patient, psmStatus: newStatus });
                            toast.success(newStatus === 'favoravel' 
                              ? 'PSM marcado como favorável' 
                              : 'Status PSM removido');
                          }}
                          className={cn(
                            "ml-6 flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-released-soft transition-colors cursor-pointer",
                            patient.psmStatus === 'favoravel' && "bg-released-soft"
                          )}
                        >
                          <CheckCircle2 className={cn(
                            "h-3.5 w-3.5",
                            patient.psmStatus === 'favoravel' 
                              ? "text-released" 
                              : "text-released-on-soft"
                          )} />
                          <span className={cn(
                            patient.psmStatus === 'favoravel' && "text-released-on-soft font-medium"
                          )}>
                            Favorável
                          </span>
                          {patient.psmStatus === 'favoravel' && <Check className="h-4 w-4 ml-auto text-released" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            const newStatus = patient.psmStatus === 'aguardando' ? null : 'aguardando';
                            onUpdate({ ...patient, psmStatus: newStatus });
                            toast.success(newStatus === 'aguardando' 
                              ? 'PSM marcado como aguardando' 
                              : 'Status PSM removido');
                          }}
                          className={cn(
                            "ml-6 flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-warning-soft transition-colors cursor-pointer",
                            patient.psmStatus === 'aguardando' && "bg-warning-soft"
                          )}
                        >
                          <Clock className={cn(
                            "h-3.5 w-3.5",
                            patient.psmStatus === 'aguardando' 
                              ? "text-warning" 
                              : "text-warning-on-soft"
                          )} />
                          <span className={cn(
                            patient.psmStatus === 'aguardando' && "text-warning-on-soft font-medium"
                          )}>
                            Aguardando
                          </span>
                          {patient.psmStatus === 'aguardando' && <Check className="h-4 w-4 ml-auto text-warning" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            const newStatus = patient.psmStatus === 'desfavoravel' ? null : 'desfavoravel';
                            onUpdate({ ...patient, psmStatus: newStatus });
                            toast.success(newStatus === 'desfavoravel' 
                              ? 'PSM marcado como desfavorável' 
                              : 'Status PSM removido');
                          }}
                          className={cn(
                            "ml-6 flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-critical-soft transition-colors cursor-pointer",
                            patient.psmStatus === 'desfavoravel' && "bg-critical-soft"
                          )}
                        >
                          <XCircle className={cn(
                            "h-3.5 w-3.5",
                            patient.psmStatus === 'desfavoravel' 
                              ? "text-critical" 
                              : "text-critical-on-soft"
                          )} />
                          <span className={cn(
                            patient.psmStatus === 'desfavoravel' && "text-critical-on-soft font-medium"
                          )}>
                            Desfavorável
                          </span>
                          {patient.psmStatus === 'desfavoravel' && <Check className="h-4 w-4 ml-auto text-critical" />}
                        </DropdownMenuItem>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Exclusão de paciente removida — fluxo de saída ocorre no Painel Clínico (Cockpit). */}

                      </>
                    )}
                    
                  </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </div>
        </div>

      </Card>
      </div>

      <EditPatientDialog
        patient={patient}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={onUpdate}
      />

      <PatientMovementDialog
        patient={patient}
        movementType={movementType}
        isOpen={movementDialogOpen}
        onClose={() => {
          setMovementDialogOpen(false);
          setMovementType(null);
        }}
        onSuccess={() => {
          onRefetch?.();
        }}
      />

      <SignalInternalTransferDialog
        patient={patient}
        open={signalTransferOpen}
        onOpenChange={setSignalTransferOpen}
        onSuccess={() => onRefetch?.()}
      />

      <OperationalRelocationDialog
        patient={patient}
        open={relocationDialogOpen}
        onOpenChange={setRelocationDialogOpen}
        onSuccess={() => onRefetch?.()}
      />



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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="">
          <AlertDialogHeader>
            <AlertDialogTitle className=" text-lg font-medium">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className=" text-base">
              Tem certeza que deseja excluir o leito <strong className=" font-semibold">{patient.bedNumber}</strong> do paciente <strong className=" font-semibold">{patient.name}</strong>?
              <br />
              <span className=" text-destructive font-medium mt-2 inline-block">Esta ação não poderá ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={async () => {
                if (!onDelete) return;
                const deletedPatient = { ...patient };
                setIsDeleting(true);

                // Wait for animation to complete before actually deleting
                setTimeout(async () => {
                  try {
                    await onDelete(patient.id);
                    // Antes: este toast de sucesso disparava incondicionalmente,
                    // mesmo quando onDelete falhava (não era aguardado) — o usuário
                    // via "Paciente excluído" mesmo quando a exclusão não ocorreu.
                    toastHook({
                      title: "Paciente excluído",
                      description: `Leito ${patient.bedNumber} - ${patient.name} foi removido.`,
                      action: onUndelete ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onUndelete(deletedPatient)}
                          className="ml-auto"
                        >
                          Desfazer
                        </Button>
                      ) : undefined,
                    });
                  } catch (err: any) {
                    console.error("[PatientCard] falha ao excluir leito/paciente:", err);
                    setIsDeleting(false); // desfaz a animação de saída — a exclusão não ocorreu
                    toastHook({
                      title: "Não foi possível excluir",
                      description: err?.message || "Erro inesperado. Tente novamente ou avise o suporte.",
                      variant: "destructive",
                    });
                  }
                }, 300);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium shadow-md"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog expandido para Hipóteses / Diagnósticos */}
      <Dialog open={expandedSection === 'diagnoses'} onOpenChange={() => setExpandedSection(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-background border-2">
          <DialogHeader className="border-b border-border/50 pb-4 flex-shrink-0 bg-primary/5 -m-6 p-6 mb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-lg flex items-center justify-center font-semibold text-xl shadow-md",
                  config.badgeColor
                )}>
                  {patient.bedNumber}
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold tracking-tight bg-foreground bg-clip-text text-transparent">
                    {displayName}
                  </span>
                  <span className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {formatAgeDisplay(patient.age)}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Admissão: {new Date(patient.admissionDate).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/30">
              <h3 className="text-xl font-semibold text-primary tracking-wide flex items-center gap-2">
                <div className="w-1 h-6 bg-primary rounded-full" />
                Hipóteses / Diagnósticos
              </h3>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-6 pr-2 px-6">
            {patient.diagnoses.length > 0 ? (
              <div className="space-y-3">
                {patient.diagnoses.map((diagnosis, idx) => (
                  <div 
                    key={idx} 
                    className="flex gap-4 items-start group animate-fade-in hover-scale"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-semibold text-lg shadow-md group-hover:shadow-md transition-all">
                      {idx + 1}
                    </div>
                    <div className="flex-1 bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group-hover:bg-card">
                      {editingField === "diagnoses" && editingArrayIndex === idx ? (
                        <div className="flex items-center gap-2">
                          <AutoResizeTextarea
                            inputRef={inputRef}
                            value={editValue}
                            onChange={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              const start = target.selectionStart ?? 0;
                              const end = target.selectionEnd ?? 0;
                              setEditValue(e.target.value);
                              requestAnimationFrame(() => {
                                target.setSelectionRange(start, end);
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                saveInlineEdit();
                              } else if (e.key === 'Escape') {
                                cancelEditing();
                              }
                            }}
                            className="text-base font-medium bg-background/50 border-primary/50 resize-none"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={saveInlineEdit}
                            className="h-9 w-9 text-released-on-soft hover:bg-released-soft hover:text-released-on-soft flex-shrink-0"
                          >
                            <Check className="h-5 w-5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                            className="h-9 w-9 text-critical-on-soft hover:bg-critical-soft hover:text-critical-on-soft flex-shrink-0"
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-base text-foreground leading-relaxed font-medium flex-1">
                            {diagnosis}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startEditing("diagnoses", diagnosis, idx)}
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeArrayItem("diagnoses", idx)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <span className="text-4xl"></span>
                </div>
                <p className="text-lg font-medium">Nenhuma hipótese ou diagnóstico registrado</p>
                <p className="text-sm mt-2">Adicione a primeira hipótese diagnóstica</p>
              </div>
            )}
            <Button
              onClick={() => startEditing("diagnoses", "", patient.diagnoses.length)}
              className="mt-4 w-full bg-primary hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-md transition-all"
              size="lg"
            >
              <span className="text-lg mr-2">+</span>
              Adicionar Nova Hipótese / Diagnóstico
            </Button>
            
            {/* História Admissional / Anamnese */}
            {patient.admissionHistory && (
              <div className="mt-6 pt-6 border-t border-border/30">
                <h4 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  História Admissional / Anamnese
                </h4>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {patient.admissionHistory}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog expandido para Exames */}
      <Dialog open={expandedSection === 'exams'} onOpenChange={() => setExpandedSection(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-background border-2">
          <DialogHeader className="border-b border-border/50 pb-4 flex-shrink-0 bg-primary/5 -m-6 p-6 mb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-lg flex items-center justify-center font-semibold text-xl shadow-md",
                  config.badgeColor
                )}>
                  {patient.bedNumber}
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold tracking-tight bg-foreground bg-clip-text text-transparent">
                    {displayName}
                  </span>
                  <span className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {formatAgeDisplay(patient.age)}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Admissão: {new Date(patient.admissionDate).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/30">
              <h3 className="text-xl font-semibold text-primary tracking-wide flex items-center gap-2">
                <div className="w-1 h-6 bg-primary rounded-full" />
                Exames
              </h3>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-6 pr-2 px-6">
            {patient.relevantExams.length > 0 ? (
              <div className="space-y-3">
                {patient.relevantExams.map((exam, idx) => (
                  <div 
                    key={idx} 
                    className="flex gap-4 items-start group animate-fade-in hover-scale"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-semibold text-lg shadow-md group-hover:shadow-md transition-all">
                      {idx + 1}
                    </div>
                    <div className="flex-1 bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group-hover:bg-card">
                      {editingField === "relevantExams" && editingArrayIndex === idx ? (
                        <div className="flex items-center gap-2">
                          <AutoResizeTextarea
                            inputRef={inputRef}
                            value={editValue}
                            onChange={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              const start = target.selectionStart ?? 0;
                              const end = target.selectionEnd ?? 0;
                              setEditValue(e.target.value);
                              requestAnimationFrame(() => {
                                target.setSelectionRange(start, end);
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                saveInlineEdit();
                              } else if (e.key === 'Escape') {
                                cancelEditing();
                              }
                            }}
                            className="text-base font-medium bg-background/50 border-primary/50 resize-none"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={saveInlineEdit}
                            className="h-9 w-9 text-released-on-soft hover:bg-released-soft hover:text-released-on-soft flex-shrink-0"
                          >
                            <Check className="h-5 w-5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                            className="h-9 w-9 text-critical-on-soft hover:bg-critical-soft hover:text-critical-on-soft flex-shrink-0"
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-base text-foreground leading-relaxed font-medium flex-1">
                            {exam}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startEditing("relevantExams", exam, idx)}
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeArrayItem("relevantExams", idx)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <span className="text-4xl"></span>
                </div>
                <p className="text-lg font-medium">Nenhum exame registrado</p>
                <p className="text-sm mt-2">Adicione o primeiro exame complementar</p>
              </div>
            )}
            <Button
              onClick={() => startEditing("relevantExams", "", patient.relevantExams.length)}
              className="mt-4 w-full bg-primary hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-md transition-all"
              size="lg"
            >
              <span className="text-lg mr-2">+</span>
              Adicionar Novo Exame
            </Button>
            
            {/* História Admissional / Anamnese */}
            {patient.admissionHistory && (
              <div className="mt-6 pt-6 border-t border-border/30">
                <h4 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  História Admissional / Anamnese
                </h4>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {patient.admissionHistory}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog expandido para Antecedentes */}
      <Dialog open={expandedSection === 'medicalHistory'} onOpenChange={() => setExpandedSection(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-background border-2">
          <DialogHeader className="border-b border-border/50 pb-4 flex-shrink-0 bg-primary/5 -m-6 p-6 mb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-lg flex items-center justify-center font-semibold text-xl shadow-md",
                  config.badgeColor
                )}>
                  {patient.bedNumber}
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold tracking-tight bg-foreground bg-clip-text text-transparent">
                    {displayName}
                  </span>
                  <span className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {formatAgeDisplay(patient.age)}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Admissão: {new Date(patient.admissionDate).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/30">
              <h3 className="text-xl font-semibold text-primary tracking-wide flex items-center gap-2">
                <div className="w-1 h-6 bg-primary rounded-full" />
                Antecedentes
              </h3>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-6 pr-2 px-6">
            {patient.medicalHistory.length > 0 ? (
              <div className="space-y-3">
                {patient.medicalHistory.map((history, idx) => (
                  <div 
                    key={idx} 
                    className="flex gap-4 items-start group animate-fade-in hover-scale"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-semibold text-lg shadow-md group-hover:shadow-md transition-all">
                      {idx + 1}
                    </div>
                    <div className="flex-1 bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group-hover:bg-card">
                      {editingField === "medicalHistory" && editingArrayIndex === idx ? (
                        <div className="flex items-center gap-2">
                          <AutoResizeTextarea
                            inputRef={inputRef}
                            value={editValue}
                            onChange={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              const start = target.selectionStart ?? 0;
                              const end = target.selectionEnd ?? 0;
                              setEditValue(e.target.value);
                              requestAnimationFrame(() => {
                                target.setSelectionRange(start, end);
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                saveInlineEdit();
                              } else if (e.key === 'Escape') {
                                cancelEditing();
                              }
                            }}
                            className="text-base font-medium bg-background/50 border-primary/50 resize-none"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={saveInlineEdit}
                            className="h-9 w-9 text-released-on-soft hover:bg-released-soft hover:text-released-on-soft flex-shrink-0"
                          >
                            <Check className="h-5 w-5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                            className="h-9 w-9 text-critical-on-soft hover:bg-critical-soft hover:text-critical-on-soft flex-shrink-0"
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-base text-foreground leading-relaxed font-medium flex-1">
                            {history}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startEditing("medicalHistory", history, idx)}
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeArrayItem("medicalHistory", idx)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <span className="text-4xl"></span>
                </div>
                <p className="text-lg font-medium">Nenhum antecedente registrado</p>
                <p className="text-sm mt-2">Adicione o primeiro antecedente mórbido</p>
              </div>
            )}
            <Button
              onClick={() => startEditing("medicalHistory", "", patient.medicalHistory.length)}
              className="mt-4 w-full bg-primary hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-md transition-all"
              size="lg"
            >
              <span className="text-lg mr-2">+</span>
              Adicionar Novo Antecedente
            </Button>
            
            {/* História Admissional / Anamnese */}
            {patient.admissionHistory && (
              <div className="mt-6 pt-6 border-t border-border/30">
                <h4 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  História Admissional / Anamnese
                </h4>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {patient.admissionHistory}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog expandido para Programações / Pendências */}
      <Dialog open={expandedSection === 'pendencies'} onOpenChange={() => setExpandedSection(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-background border-2">
          <DialogHeader className="border-b border-border/50 pb-4 flex-shrink-0 bg-primary/5 -m-6 p-6 mb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-lg flex items-center justify-center font-semibold text-xl shadow-md",
                  config.badgeColor
                )}>
                  {patient.bedNumber}
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold tracking-tight bg-foreground bg-clip-text text-transparent">
                    {displayName}
                  </span>
                  <span className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {formatAgeDisplay(patient.age)}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Admissão: {new Date(patient.admissionDate).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/30">
              <h3 className="text-xl font-semibold text-primary tracking-wide flex items-center gap-2">
                <div className="w-1 h-6 bg-primary rounded-full" />
                Programações / Pendências
              </h3>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-6 pr-2 px-6">
            {patient.pendencies.length > 0 ? (
              <div className="space-y-3">
                {patient.pendencies.map((pendency, idx) => (
                  <div 
                    key={idx} 
                    className="flex gap-4 items-start group animate-fade-in hover-scale"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-semibold text-lg shadow-md group-hover:shadow-md transition-all">
                      {idx + 1}
                    </div>
                    <div className="flex-1 bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group-hover:bg-card">
                      {editingField === "pendencies" && editingArrayIndex === idx ? (
                        <div className="flex items-center gap-2">
                          <AutoResizeTextarea
                            inputRef={inputRef}
                            value={editValue}
                            onChange={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              const start = target.selectionStart ?? 0;
                              const end = target.selectionEnd ?? 0;
                              setEditValue(e.target.value);
                              requestAnimationFrame(() => {
                                target.setSelectionRange(start, end);
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                saveInlineEdit();
                              } else if (e.key === 'Escape') {
                                cancelEditing();
                              }
                            }}
                            className="text-base font-medium bg-background/50 border-primary/50 resize-none"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={saveInlineEdit}
                            className="h-9 w-9 text-released-on-soft hover:bg-released-soft hover:text-released-on-soft flex-shrink-0"
                          >
                            <Check className="h-5 w-5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                            className="h-9 w-9 text-critical-on-soft hover:bg-critical-soft hover:text-critical-on-soft flex-shrink-0"
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-base text-foreground leading-relaxed font-medium flex-1">
                            {pendency}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startEditing("pendencies", pendency, idx)}
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeArrayItem("pendencies", idx)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <span className="text-4xl"></span>
                </div>
                <p className="text-lg font-medium">Nenhuma programação ou pendência registrada</p>
                <p className="text-sm mt-2">Adicione a primeira programação ou pendência</p>
              </div>
            )}
            <Button
              onClick={() => startEditing("pendencies", "", patient.pendencies.length)}
              className="mt-4 w-full bg-primary hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-md transition-all"
              size="lg"
            >
              <span className="text-lg mr-2">+</span>
              Adicionar Nova Programação / Pendência
            </Button>
            
            {/* História Admissional / Anamnese */}
            {patient.admissionHistory && (
              <div className="mt-6 pt-6 border-t border-border/30">
                <h4 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  História Admissional / Anamnese
                </h4>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {patient.admissionHistory}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Medical Responsibility Dialog */}
      <MedicalResponsibilityDialog
        open={medicalResponsibilityDialogOpen}
        onOpenChange={setMedicalResponsibilityDialogOpen}
        currentResponsibility={localMedicalResponsibility}
        onSave={(responsibility) => {
          setLocalMedicalResponsibility(responsibility);
          onUpdate({ ...patient, medicalResponsibility: responsibility });
          toastHook({
            title: "Responsabilidade atualizada",
            description: "As informações de responsabilidade médica foram salvas.",
          });
        }}
        sectorColor={sectorColorMap[patient.sector]}
      />

      {/* Internment Status Dialog */}
      <InternmentStatusDialog
        isOpen={internmentStatusDialogOpen}
        onClose={() => setInternmentStatusDialogOpen(false)}
        patientId={patient.id}
        patientName={patient.name}
        currentStatus={patient.internmentStatus || null}
        currentNotes={patient.internmentNotes || null}
        onSuccess={() => {
          // Reload patient data
          onUpdate(patient);
        }}
      />

      {/* Apply Therapeutic Template Dialog */}
      <ApplyTemplateDialog
        open={applyTemplateDialogOpen}
        onOpenChange={setApplyTemplateDialogOpen}
        patientName={patient.name}
        onApply={async (templateItems: string[]) => {
          if (!templateItems || templateItems.length === 0) return;
          try {
            const currentPendencies = patient.pendencies || [];
            const updatedPendencies = [...currentPendencies, ...templateItems];
            const pendenciesString = updatedPendencies.join('\n');
            // MIGRAÇÃO: patients → internacoes (pendencies → pendencias). patient.id é internacoes.id.
            // Não enviar updated_at (coluna inexistente); atualizado_em é gerenciado por trigger.
            const { error } = await supabase
              .from('internacoes')
              .update({ pendencias: pendenciesString })
              .eq('id', patient.id);
            if (error) throw error;
            toast.success(`${templateItems.length} item(ns) do protocolo adicionado(s)`);
            // MIGRAÇÃO: re-fetch de `patients.*` + remap removido (tabela morta) —
            // mescla local no view-model preserva os demais campos vindos do join upstream.
            onUpdate({ ...patient, pendencies: updatedPendencies });
          } catch (error) {
            console.error('Error:', error);
            toast.error('Erro ao aplicar template terapêutico');
          }
        }}
      />

      {/* Quick Templates Dialog */}
      <QuickTemplatesDialog
        open={quickTemplatesDialogOpen}
        onOpenChange={setQuickTemplatesDialogOpen}
        patientName={patient.name}
        onAddTemplates={async (templates: string[]) => {
          if (!templates || templates.length === 0) return;

          try {
            // Get current pendencies and add new templates
            const currentPendencies = patient.pendencies || [];
            const updatedPendencies = [...currentPendencies, ...templates];
            const pendenciesString = updatedPendencies.join('\n');

            // MIGRAÇÃO: patients → internacoes (pendencies → pendencias). patient.id é internacoes.id.
            // Não enviar updated_at (coluna inexistente); atualizado_em é gerenciado por trigger.
            const { error } = await supabase
              .from('internacoes')
              .update({ pendencias: pendenciesString })
              .eq('id', patient.id);

            if (error) throw error;

            toast.success(`${templates.length} template(s) adicionado(s)`);

            // MIGRAÇÃO: re-fetch de `patients.*` + remap removido (tabela morta) —
            // mescla local no view-model preserva os demais campos vindos do join upstream.
            onUpdate({ ...patient, pendencies: updatedPendencies });
          } catch (error) {
            console.error('Error:', error);
            toast.error('Erro ao adicionar templates');
          }
        }}
      />

      {/* Exam Curves Dialog */}
      <ExamCurvesDialog
        open={examCurvesDialogOpen}
        onOpenChange={setExamCurvesDialogOpen}
        patientName={patient.name}
        onAddCurves={async (curves: string[]) => {
          if (!curves || curves.length === 0) return;

          try {
            // Get current exams and add new curves
            const currentExams = patient.relevantExams || [];
            const updatedExams = [...currentExams, ...curves];
            const examsString = updatedExams.join('\n');

            // MIGRAÇÃO: patients → internacoes (relevant_exams → exames_relevantes). patient.id é internacoes.id.
            // Não enviar updated_at (coluna inexistente); atualizado_em é gerenciado por trigger.
            const { error } = await supabase
              .from('internacoes')
              .update({ exames_relevantes: examsString })
              .eq('id', patient.id);

            if (error) throw error;

            toast.success(`${curves.length} curva(s) adicionada(s)`);

            // MIGRAÇÃO: re-fetch de `patients.*` + remap removido (tabela morta) —
            // mescla local no view-model preserva os demais campos vindos do join upstream.
            onUpdate({ ...patient, relevantExams: updatedExams });
          } catch (error) {
            console.error('Error:', error);
            toast.error('Erro ao adicionar curvas de exames');
          }
        }}
      />

      {/* Examinus AI Dialog */}
      <ExaminusAIDialog
        open={examinusAIDialogOpen}
        onOpenChange={setExaminusAIDialogOpen}
        currentExams={patient.relevantExams}
        sectorColor={sectorColorMap[patient.sector]}
        onImportExams={async (newExams: string[]) => {
          try {
            const examsString = newExams.join('\n');

            // MIGRAÇÃO: patients → internacoes (relevant_exams → exames_relevantes). patient.id é internacoes.id.
            // Não enviar updated_at (coluna inexistente); atualizado_em é gerenciado por trigger.
            const { error } = await supabase
              .from('internacoes')
              .update({ exames_relevantes: examsString })
              .eq('id', patient.id);

            if (error) throw error;

            // MIGRAÇÃO: re-fetch de `patients.*` + remap removido (tabela morta) —
            // mescla local no view-model (ExaminusAI substitui a lista inteira de exames).
            onUpdate({ ...patient, relevantExams: newExams });
          } catch (error) {
            console.error('Error:', error);
            toast.error('Erro ao importar exames');
          }
        }}
      />

      <RequestBedAllocationDialog
        open={bedAllocationDialogOpen}
        onOpenChange={setBedAllocationDialogOpen}
        patient={patient}
      />

      <DietReleaseDialog
        isOpen={dietDialogOpen}
        onClose={() => setDietDialogOpen(false)}
        patient={patient}
      />

      <ConductHistoryDialog
        open={conductHistoryDialogOpen}
        onOpenChange={setConductHistoryDialogOpen}
        history={conductHistory}
        isLoading={conductHistoryLoading}
        patientName={patient.name}
      />
      <AdmissionHistoryDialog
        patient={patient}
        open={admissionHistoryDialogOpen}
        onOpenChange={setAdmissionHistoryDialogOpen}
      />
      {roundPrintDialogOpen && (
        <PatientRoundPrintDialog
          open={roundPrintDialogOpen}
          onOpenChange={setRoundPrintDialogOpen}
          patientId={patient.id}
          patientName={patient.name}
          patientSector={patient.sector as any}
          patientBed={patient.bedNumber}
          patientAge={patient.age}
        />
      )}
      {reallocationDialogOpen && (
        <BedReallocationDialog
          open={reallocationDialogOpen}
          onOpenChange={setReallocationDialogOpen}
          patient={patient}
          onSuccess={() => onRefetch?.()}
        />
      )}
    </>
  );
}
