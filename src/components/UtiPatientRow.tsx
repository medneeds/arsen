import { Patient } from "@/types/patient";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Edit, MoreVertical, Check, X, Plus, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditPatientDialog } from "./EditPatientDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface UtiPatientRowProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  onDelete?: (patientId: string) => void;
  onPrintPatient?: (patientId: string) => void;
  onRefetch?: () => void;
}

interface FieldConfig {
  key: keyof Patient;
  label: string;
  isArray: boolean;
  line: 1 | 2;
  minWidth: string;
}

const fields: FieldConfig[] = [
  { key: "bedNumber", label: "Leito", isArray: false, line: 1, minWidth: "70px" },
  { key: "name", label: "Paciente", isArray: false, line: 1, minWidth: "160px" },
  { key: "utiOriginSector", label: "Setor de Origem", isArray: true, line: 1, minWidth: "120px" },
  { key: "utiAdmissionDate", label: "Admissão UTI", isArray: true, line: 1, minWidth: "110px" },
  { key: "utiDischargePrediction", label: "Previsão de Alta", isArray: true, line: 1, minWidth: "110px" },
  { key: "utiAllergies", label: "Alergias", isArray: true, line: 1, minWidth: "120px" },
  { key: "utiAdmissionReason", label: "Motivo Admissão", isArray: true, line: 1, minWidth: "150px" },
  { key: "diagnoses", label: "Hipóteses / Diagnósticos", isArray: true, line: 2, minWidth: "180px" },
  { key: "utiCurrentStatus", label: "Quadro Atual", isArray: true, line: 2, minWidth: "150px" },
  { key: "utiSpecialties", label: "Especialidades", isArray: true, line: 2, minWidth: "130px" },
  { key: "utiDevices", label: "Dispositivos", isArray: true, line: 2, minWidth: "130px" },
  { key: "relevantExams", label: "Exames", isArray: true, line: 2, minWidth: "150px" },
  { key: "utiCulturesAntibiotics", label: "Culturas / ATB", isArray: true, line: 2, minWidth: "150px" },
  { key: "pendencies", label: "Programações / Pendências", isArray: true, line: 2, minWidth: "180px" },
];

const getFieldValue = (patient: Patient, key: keyof Patient): string => {
  const value = patient[key];
  if (Array.isArray(value)) {
    return value.filter(v => typeof v === 'string').join("; ");
  }
  return (value as string) || "";
};

const getFieldArray = (patient: Patient, key: keyof Patient): string[] => {
  const value = patient[key];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return value ? [value as string] : [];
};

// Sortable Item Component
interface SortableItemProps {
  id: string;
  index: number;
  value: string;
  onEdit: (newValue: string) => void;
  onDelete: () => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
}

function SortableItem({ id, index, value, onEdit, onDelete, isEditing, onStartEdit, onStopEdit }: SortableItemProps) {
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

  const handleSave = () => {
    onEdit(localValue);
    onStopEdit();
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "flex items-center gap-1 group py-0.5",
        isDragging && "z-50"
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing p-0.5 opacity-40 hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <span className="text-primary/70 font-medium text-xs min-w-[16px]">{index + 1}.</span>
      
      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className="flex-1 text-sm bg-white dark:bg-slate-800 border border-primary/30 rounded px-1.5 py-0.5 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') onStopEdit();
            }}
            onBlur={handleSave}
            onClick={(e) => e.stopPropagation()}
          />
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handleSave}>
            <Check className="h-3 w-3 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onStopEdit}>
            <X className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      ) : (
        <>
          <span 
            className="flex-1 text-sm break-words cursor-pointer hover:text-primary transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
          >
            {value}
          </span>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
}

interface FieldCellProps {
  field: FieldConfig;
  patient: Patient;
  onUpdateField: (key: keyof Patient, value: string | string[]) => void;
}

function FieldCell({ field, patient, onUpdateField }: FieldCellProps) {
  const items = field.isArray ? getFieldArray(patient, field.key) : [];
  const singleValue = !field.isArray ? getFieldValue(patient, field.key) : "";
  const hasContent = field.isArray ? items.length > 0 : !!singleValue;
  
  const [isEditingSingle, setIsEditingSingle] = useState(false);
  const [singleEditValue, setSingleEditValue] = useState(singleValue);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItemValue, setNewItemValue] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (isAddingNew && newInputRef.current) {
      newInputRef.current.focus();
    }
  }, [isAddingNew]);

  useEffect(() => {
    if (isEditingSingle && singleInputRef.current) {
      singleInputRef.current.focus();
    }
  }, [isEditingSingle]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((_, i) => `item-${i}` === active.id);
      const newIndex = items.findIndex((_, i) => `item-${i}` === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      onUpdateField(field.key, newItems);
    }
  };

  const handleAddItem = () => {
    if (newItemValue.trim()) {
      onUpdateField(field.key, [...items, newItemValue.trim()]);
      setNewItemValue("");
      setIsAddingNew(false);
    }
  };

  const handleEditItem = (index: number, newValue: string) => {
    const newItems = [...items];
    newItems[index] = newValue;
    onUpdateField(field.key, newItems);
  };

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onUpdateField(field.key, newItems);
  };

  const handleSaveSingle = () => {
    onUpdateField(field.key, singleEditValue);
    setIsEditingSingle(false);
  };

  const isSpecialField = field.key === "bedNumber" || field.key === "name";

  return (
    <div 
      className={cn(
        "flex flex-col py-2 px-3 rounded-md border transition-all duration-200 flex-shrink-0",
        "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-700/40",
        field.key === "bedNumber" && "bg-primary/5 dark:bg-primary/10 border-primary/20",
        field.key === "name" && "bg-slate-100/50 dark:bg-slate-700/30",
      )}
      style={{ minWidth: field.minWidth, maxWidth: "350px" }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {field.label}
        </span>
        {field.isArray && (
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-primary/60 hover:text-primary"
            onClick={() => setIsAddingNew(true)}
            title="Adicionar item"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      
      <div className={cn(
        "text-sm text-foreground/90",
        field.key === "bedNumber" && "text-base font-bold text-primary",
        field.key === "name" && "font-semibold"
      )}>
        {field.isArray ? (
          <div className="space-y-0.5">
            {items.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map((_, i) => `item-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((item, idx) => (
                    <SortableItem
                      key={`item-${idx}`}
                      id={`item-${idx}`}
                      index={idx}
                      value={item}
                      onEdit={(newValue) => handleEditItem(idx, newValue)}
                      onDelete={() => handleDeleteItem(idx)}
                      isEditing={editingItemIndex === idx}
                      onStartEdit={() => setEditingItemIndex(idx)}
                      onStopEdit={() => setEditingItemIndex(null)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : !isAddingNew ? (
              <span 
                className="text-muted-foreground/50 cursor-pointer hover:text-muted-foreground"
                onClick={() => setIsAddingNew(true)}
              >
                Clique para adicionar
              </span>
            ) : null}
            
            {isAddingNew && (
              <div className="flex items-center gap-1 mt-1">
                <input
                  ref={newInputRef}
                  type="text"
                  value={newItemValue}
                  onChange={(e) => setNewItemValue(e.target.value)}
                  placeholder="Novo item..."
                  className="flex-1 text-sm bg-white dark:bg-slate-800 border border-primary/30 rounded px-2 py-1 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddItem();
                    if (e.key === 'Escape') {
                      setIsAddingNew(false);
                      setNewItemValue("");
                    }
                  }}
                  onBlur={handleAddItem}
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleAddItem}>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6" 
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewItemValue("");
                  }}
                >
                  <X className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Single value field
          isEditingSingle ? (
            <div className="flex items-center gap-1">
              <input
                ref={singleInputRef}
                type="text"
                value={singleEditValue}
                onChange={(e) => setSingleEditValue(e.target.value)}
                className="flex-1 text-sm bg-white dark:bg-slate-800 border border-primary/30 rounded px-2 py-1 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSingle();
                  if (e.key === 'Escape') setIsEditingSingle(false);
                }}
                onBlur={handleSaveSingle}
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveSingle}>
                <Check className="h-3.5 w-3.5 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingSingle(false)}>
                <X className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          ) : (
            <span 
              className="cursor-pointer hover:text-primary transition-colors"
              onClick={() => {
                setSingleEditValue(singleValue);
                setIsEditingSingle(true);
              }}
            >
              {hasContent ? singleValue : <span className="text-muted-foreground/50">-</span>}
            </span>
          )
        )}
      </div>
    </div>
  );
}

export function UtiPatientRow({ 
  patient, 
  onUpdate, 
  onDelete,
  onPrintPatient,
  onRefetch 
}: UtiPatientRowProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const line1Fields = fields.filter(f => f.line === 1);
  const line2Fields = fields.filter(f => f.line === 2);

  const handleUpdateField = (key: keyof Patient, value: string | string[]) => {
    const updatedPatient = {
      ...patient,
      [key]: value
    };
    onUpdate(updatedPatient);
  };

  return (
    <>
      <div className="bg-card border border-border/50 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
        <div className="flex">
          {/* Fixed Actions Column */}
          <div className="flex flex-col items-center justify-center gap-1 px-2 py-2 border-r border-border/30 bg-slate-50/50 dark:bg-slate-800/20 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditDialogOpen(true)}
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              title="Edição avançada"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {onPrintPatient && (
                  <DropdownMenuItem onClick={() => onPrintPatient(patient.id)}>
                    Imprimir
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(patient.id)}
                    className="text-destructive"
                  >
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Line 1 - Top Section */}
            <div className="overflow-x-auto scrollbar-thin-bottom p-2">
              <div className="flex gap-1.5" style={{ width: "max-content", minWidth: "100%" }}>
                {line1Fields.map((field) => (
                  <FieldCell 
                    key={field.key} 
                    field={field} 
                    patient={patient}
                    onUpdateField={handleUpdateField}
                  />
                ))}
              </div>
            </div>
            
            {/* Separator with strategic scrollbar position */}
            <div className="h-px bg-border/30 mx-2" />
            
            {/* Line 2 - Bottom Section */}
            <div className="overflow-x-auto scrollbar-thin-bottom p-2">
              <div className="flex gap-1.5" style={{ width: "max-content", minWidth: "100%" }}>
                {line2Fields.map((field) => (
                  <FieldCell 
                    key={field.key} 
                    field={field} 
                    patient={patient}
                    onUpdateField={handleUpdateField}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditPatientDialog
        patient={patient}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={(updatedPatient) => {
          onUpdate(updatedPatient);
          setIsEditDialogOpen(false);
        }}
      />
    </>
  );
}