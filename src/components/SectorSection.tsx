import { Patient, SectorType } from "@/types/patient";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";
import { PatientCard } from "./PatientCard";
import { Activity, Printer, Plus, ChevronDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptySectorState } from "@/components/EmptySectorState";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
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
import { CSS } from '@dnd-kit/utilities'; // kept for type compatibility

interface SectorSectionProps {
  sector: SectorType;
  patients: Patient[];
  onUpdatePatient: (patient: Patient) => void;
  onDeletePatient?: (patientId: string) => void;
  onReleasePreAdmissionBed?: (patientId: string, payload: { reason: string; reasonNote: string }) => void | Promise<void>;
  onUndeletePatient?: (patient: Patient) => void;
  onPrintSector?: () => void;
  onAddExtraBed?: () => void;
  selectionMode?: boolean;
  selectedPatients?: Set<string>;
  onToggleSelection?: (patientId: string) => void;
  onReorderPatients?: (patients: Patient[]) => void;
  onTransfer?: (patientId: string, newSector: Patient['sector']) => void;
  onPrintPatient?: (patientId: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  customTitle?: string;
  customIcon?: string;
  onRefetch?: () => void;
  onQuickView?: (patient: Patient) => void;
}

const sectorInfo: Record<string, { title: string; subtitle: string; icon: string; gradientClass: string }> = {
  red: { title: "UTI 1", subtitle: "Unidade de Terapia Intensiva 1", icon: "🔴", gradientClass: "bg-gradient-critical" },
  yellow: { title: "UTI 2", subtitle: "Unidade de Terapia Intensiva 2", icon: "🟡", gradientClass: "bg-gradient-warning" },
  blue: { title: "UCI 1", subtitle: "Unidade de Cuidados Intermediários 1", icon: "🔵", gradientClass: "bg-gradient-stable" },
  outside: { title: "UCI 2", subtitle: "Unidade de Cuidados Intermediários 2", icon: "🟢", gradientClass: "bg-gradient-stable" },
  ucc: { title: "UCC", subtitle: "Unidade de Cuidados Clínicos", icon: "🟣", gradientClass: "bg-gradient-to-r from-violet-500/20 to-violet-600/10" },
  neuro_01: { title: "Neuro 01", subtitle: "Enfermaria Neuro 01", icon: "🧠", gradientClass: "bg-gradient-to-r from-cyan-500/20 to-cyan-600/10" },
  neuro_02: { title: "Neuro 02", subtitle: "Enfermaria Neuro 02", icon: "🧠", gradientClass: "bg-gradient-to-r from-cyan-500/20 to-cyan-600/10" },
  clinica_cirurgica: { title: "Clínica Cirúrgica", subtitle: "Enfermaria Clínica Cirúrgica", icon: "🏥", gradientClass: "bg-gradient-to-r from-teal-500/20 to-teal-600/10" },
  enfermaria_transicao: { title: "Enf. Transição", subtitle: "Enfermaria de Transição", icon: "🔄", gradientClass: "bg-gradient-to-r from-amber-500/20 to-amber-600/10" },
  enfermaria_vascular: { title: "Enf. Vascular", subtitle: "Enfermaria Vascular", icon: "💗", gradientClass: "bg-gradient-to-r from-pink-500/20 to-pink-600/10" },
  sala_vermelha: { title: "Sala Vermelha", subtitle: "Urgência - Sala Vermelha", icon: "🚨", gradientClass: "bg-gradient-critical" },
  sala_laranja: { title: "Sala Laranja", subtitle: "Urgência - Sala Laranja", icon: "🟠", gradientClass: "bg-gradient-warning" },
  observacao_clinica: { title: "Obs. Clínica", subtitle: "Observação Clínica", icon: "👁️", gradientClass: "bg-gradient-to-r from-sky-500/20 to-sky-600/10" },
  internacao_ue: { title: "Internação UE", subtitle: "Internação UE", icon: "🏨", gradientClass: "bg-gradient-to-r from-indigo-500/20 to-indigo-600/10" },
  ue_vertical: { title: "UE Vertical", subtitle: "UE Vertical", icon: "⬆️", gradientClass: "bg-gradient-to-r from-purple-500/20 to-purple-600/10" },
  ue_horizontal: { title: "UE Horizontal", subtitle: "UE Horizontal", icon: "➡️", gradientClass: "bg-gradient-to-r from-indigo-500/20 to-indigo-600/10" },
  riv: { title: "RIV", subtitle: "Referência de Internação Vascular", icon: "🩸", gradientClass: "bg-gradient-to-r from-rose-500/20 to-rose-600/10" },
  cc_preparo: { title: "CC Preparo", subtitle: "Centro Cirúrgico - Preparo", icon: "⚕️", gradientClass: "bg-gradient-to-r from-slate-500/20 to-slate-600/10" },
  cc_bloco: { title: "CC Bloco", subtitle: "Centro Cirúrgico - Bloco", icon: "🔪", gradientClass: "bg-gradient-to-r from-slate-500/20 to-slate-600/10" },
  cc_rpa: { title: "CC RPA", subtitle: "Centro Cirúrgico - RPA", icon: "💤", gradientClass: "bg-gradient-to-r from-slate-500/20 to-slate-600/10" },
};

interface SortablePatientCardProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  onDelete?: (patientId: string) => void;
  onUndelete?: (patient: Patient) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (patientId: string) => void;
  onTransfer?: (patientId: string, newSector: Patient['sector']) => void;
  onPrintPatient?: (patientId: string) => void;
  onRefetch?: () => void;
  onQuickView?: (patient: Patient) => void;
}

function SortablePatientCard(props: SortablePatientCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.patient.id });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition: transition ?? 'transform 200ms ease',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center gap-2 print:block print:w-full"
      data-patient-id={props.patient.id}
    >
      <button
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded flex-shrink-0 print:hidden"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1 print:w-full">
        <PatientCard {...props} />
      </div>
    </div>
  );
}

export function SectorSection({ 
  sector, 
  patients, 
  onUpdatePatient, 
  onDeletePatient,
  onReleasePreAdmissionBed,
  onUndeletePatient, 
  onPrintSector, 
  onAddExtraBed, 
  selectionMode = false, 
  selectedPatients = new Set(), 
  onToggleSelection, 
  onReorderPatients, 
  onTransfer, 
  onPrintPatient,
  isOpen: controlledIsOpen,
  onOpenChange,
  customTitle,
  customIcon,
  onRefetch,
  onQuickView
}: SectorSectionProps) {
  const info = sectorInfo[sector] || { title: sector, subtitle: sector, icon: "🏥", gradientClass: "bg-gradient-stable" };
  const displayTitle = customTitle || info.title;
  const displayIcon = customIcon || info.icon;
  const [internalIsOpen, setInternalIsOpen] = useState(patients.length > 0);
  
  // Auto-expand when patients are added, auto-collapse when all removed
  useEffect(() => {
    // Só atualizar se não houver controle externo
    if (controlledIsOpen === undefined) {
      setInternalIsOpen(patients.length > 0);
    }
  }, [patients.length, controlledIsOpen]);
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;
  
  const displayPatients = patients;

  // Check if all patients in this section are selected
  const allPatientsSelected = patients.length > 0 && patients.every(p => selectedPatients.has(p.id));
  const somePatientsSelected = patients.some(p => selectedPatients.has(p.id));

  const handleSelectAllSection = () => {
    if (!onToggleSelection) return;
    
    if (allPatientsSelected) {
      // Deselect all patients in this section
      patients.forEach(p => onToggleSelection(p.id));
    } else {
      // Select all patients in this section
      patients.forEach(p => {
        if (!selectedPatients.has(p.id)) {
          onToggleSelection(p.id);
        }
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorderPatients) {
      const oldIndex = displayPatients.findIndex((p) => p.id === active.id);
      const newIndex = displayPatients.findIndex((p) => p.id === over.id);
      
      const reorderedPatients = arrayMove(displayPatients, oldIndex, newIndex);
      onReorderPatients(reorderedPatients);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-3 mb-4 print:space-y-0.5 print:mb-1 print:break-inside-avoid">
      <div className={`${info.gradientClass} rounded-xl p-2 border border-border/50 shadow-md print:p-1 print:mb-0.5 print:rounded-md transition-all duration-200 min-h-[48px] print:h-auto flex items-center`}>
        <div className="flex items-center justify-between w-full gap-3">
          {selectionMode && patients.length > 0 && (
            <div className="flex items-center print:hidden" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={allPatientsSelected}
                onCheckedChange={handleSelectAllSection}
                className={`h-5 w-5 border-2 ${
                  sector === 'red' 
                    ? 'border-critical data-[state=checked]:bg-critical data-[state=checked]:border-critical' 
                    : sector === 'yellow' 
                    ? 'border-warning data-[state=checked]:bg-warning data-[state=checked]:border-warning' 
                    : 'border-stable data-[state=checked]:bg-stable data-[state=checked]:border-stable'
                }`}
                aria-label={`Selecionar todos os pacientes de ${info.title}`}
              />
            </div>
          )}
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity print:pointer-events-none flex-1">
              <ChevronDown className={`h-5 w-5 transition-transform print:hidden ${isOpen ? '' : '-rotate-90'}`} />
              <div className="flex items-center gap-2 print:gap-1">
                <span className="text-lg print:text-sm">{displayIcon}</span>
                <h2 className="text-lg font-bold text-foreground print:text-[10px]">{displayTitle}</h2>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2">
            {onAddExtraBed && (
              <Button
                variant="outline"
                size="icon"
                onClick={onAddExtraBed}
                className="h-8 w-8 print:hidden"
                title="Adicionar leito extra"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            {onPrintSector && (
              <Button
                variant="outline"
                size="icon"
                onClick={onPrintSector}
                className="h-8 w-8 print:hidden"
              >
                <Printer className="h-3.5 w-3.5" />
              </Button>
            )}
            <div className="flex items-center justify-center h-8 min-w-[2rem] px-2 bg-card/80 backdrop-blur-sm rounded-lg border border-border/50 print:h-6 print:min-w-[1.5rem]">
              <p className="text-base font-bold text-foreground print:text-[10px]">
                {patients.length}
                {SECTOR_BED_CONFIG[sector] && SECTOR_BED_CONFIG[sector].maxRegularBeds !== Infinity && (
                  <span className="text-xs font-normal text-muted-foreground">/{SECTOR_BED_CONFIG[sector].maxRegularBeds}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <CollapsibleContent className="space-y-1.5 print:space-y-0.5">
        {displayPatients.length === 0 ? (
          <EmptySectorState
            sectorName={displayTitle}
            sectorIcon={displayIcon}
            onAddBed={onAddExtraBed}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayPatients.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {displayPatients.map((patient) => (
                <SortablePatientCard
                  key={patient.id}
                  patient={patient}
                  onUpdate={onUpdatePatient}
                  onDelete={onDeletePatient}
                  onUndelete={onUndeletePatient}
                  selectionMode={selectionMode}
                  isSelected={selectedPatients.has(patient.id)}
                  onToggleSelection={onToggleSelection}
                  onTransfer={onTransfer}
                  onPrintPatient={onPrintPatient}
                  onRefetch={onRefetch}
                  onQuickView={onQuickView}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
