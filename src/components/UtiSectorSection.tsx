import { Patient, SectorType } from "@/types/patient";
import { ReactNode } from "react";
import { UtiPatientCard } from "./UtiPatientCard";
import { EmptySectorState } from "@/components/EmptySectorState";
import { Printer, Plus, ChevronDown, ChevronsDownUp, ChevronsUpDown, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type ColorVariant = 'blue' | 'yellow' | 'red' | 'green';

interface UtiSectorSectionProps {
  sector: SectorType;
  patients: Patient[];
  onUpdatePatient: (patient: Patient) => void;
  onDeletePatient?: (patientId: string) => void;
  onReleasePreAdmissionBed?: (patientId: string, payload: { reason: string; reasonNote: string }) => void | Promise<void>;
  onUndeletePatient?: (patient: Patient) => void;
  onPrintSector?: () => void;
  onPrintRound?: () => void;
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
  customIcon?: ReactNode;
  onRefetch?: () => void;
  colorVariant?: ColorVariant;
  allPatients?: Patient[]; // All UTI patients for reallocation across units
  currentUtiUnit?: string; // "UTI 1" or "UTI 2"
}

const sectorInfo = {
  red: {
    title: "Cuidados Intensivos",
    subtitle: "Leitos UTI",
    icon: "🏥",
    gradientClass: "bg-primary/15 dark:bg-primary/25 border-l-4 border-l-primary"
  },
  yellow: {
    title: "Semi-Intensivo",
    subtitle: "Leitos Semi",
    icon: "🟡",
    gradientClass: "bg-primary/15 dark:bg-primary/25 border-l-4 border-l-primary"
  },
  blue: {
    title: "Observação UTI",
    subtitle: "Aguardando vaga",
    icon: "🔵",
    gradientClass: "bg-primary/15 dark:bg-primary/25 border-l-4 border-l-primary"
  }
};

interface UtiRowProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  onDelete?: (patientId: string) => void;
  onPrintPatient?: (patientId: string) => void;
  onRefetch?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (patientId: string) => void;
  colorVariant?: ColorVariant;
  forceCollapsed?: boolean;
  allPatients?: Patient[];
  currentUtiUnit?: string;
}

function UtiRow(props: UtiRowProps) {
  return (
    <div
      className="flex items-center gap-1 md:gap-2"
      data-patient-id={props.patient.id}
    >
      {props.selectionMode && (
        <Checkbox
          checked={props.isSelected}
          onCheckedChange={() => props.onToggleSelection?.(props.patient.id)}
          className="flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <UtiPatientCard
          patient={props.patient}
          onUpdate={props.onUpdate}
          onDelete={props.onDelete}
          onPrintPatient={props.onPrintPatient}
          onRefetch={props.onRefetch}
          colorVariant={props.colorVariant}
          forceCollapsed={props.forceCollapsed}
          allPatients={props.allPatients}
          currentUtiUnit={props.currentUtiUnit}
        />
      </div>
    </div>
  );
}

export function UtiSectorSection({ 
  sector, 
  patients, 
  onUpdatePatient, 
  onDeletePatient,
  onUndeletePatient, 
  onPrintSector, 
  onPrintRound,
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
  colorVariant = 'blue',
  allPatients = [],
  currentUtiUnit
}: UtiSectorSectionProps) {
  const info = sectorInfo[sector];
  const displayTitle = customTitle || info.title;
  const displayIcon = customIcon || info.icon;
  const [internalIsOpen, setInternalIsOpen] = useState(patients.length > 0);
  const [allCardsCollapsed, setAllCardsCollapsed] = useState(true);

  // Header color schemes based on colorVariant
  const headerStyles: Record<ColorVariant, { bg: string; title: string; button: string; chevron: string; counter: string }> = {
    blue: {
      bg: "bg-primary/15 dark:bg-primary/25 border-l-4 border-l-primary",
      title: "text-primary dark:text-primary",
      button: "border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50",
      chevron: "text-primary",
      counter: "border-primary/30 bg-primary/10"
    },
    yellow: {
      bg: "bg-amber-100/60 dark:bg-amber-900/30 border-l-4 border-l-amber-500",
      title: "text-amber-700 dark:text-amber-400",
      button: "border-amber-400/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-400/50",
      chevron: "text-amber-600 dark:text-amber-400",
      counter: "border-amber-400/30 bg-amber-500/10"
    },
    red: {
      bg: "bg-red-100/60 dark:bg-red-900/30 border-l-4 border-l-red-500",
      title: "text-red-700 dark:text-red-400",
      button: "border-red-400/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:border-red-400/50",
      chevron: "text-red-600 dark:text-red-400",
      counter: "border-red-400/30 bg-red-500/10"
    },
    green: {
      bg: "bg-emerald-100/60 dark:bg-emerald-900/30 border-l-4 border-l-emerald-500",
      title: "text-emerald-700 dark:text-emerald-400",
      button: "border-emerald-400/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400/50",
      chevron: "text-emerald-600 dark:text-emerald-400",
      counter: "border-emerald-400/30 bg-emerald-500/10"
    }
  };
  const headerClass = headerStyles[colorVariant].bg;
  const titleClass = headerStyles[colorVariant].title;
  const buttonClass = headerStyles[colorVariant].button;
  const chevronClass = headerStyles[colorVariant].chevron;
  const counterClass = headerStyles[colorVariant].counter;
  
  useEffect(() => {
    if (controlledIsOpen === undefined) {
      setInternalIsOpen(patients.length > 0);
    }
  }, [patients.length, controlledIsOpen]);
  
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;
  
  const displayPatients = patients;

  const allPatientsSelected = patients.length > 0 && patients.every(p => selectedPatients.has(p.id));

  const handleSelectAllSection = () => {
    if (!onToggleSelection) return;
    
    if (allPatientsSelected) {
      patients.forEach(p => onToggleSelection(p.id));
    } else {
      patients.forEach(p => {
        if (!selectedPatients.has(p.id)) {
          onToggleSelection(p.id);
        }
      });
    }
  };

  // Drag-and-drop for beds removed - beds are fixed, vacancy toggle used instead

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2 print:space-y-0.5 print:break-inside-avoid">
      <div className={`${headerClass} rounded-xl p-2 border border-border/50 shadow-md print:p-1 print:mb-0.5 print:rounded-md transition-all duration-200 min-h-[48px] print:h-auto flex items-center`}>
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
              <ChevronDown className={`h-5 w-5 transition-transform print:hidden ${chevronClass} ${isOpen ? '' : '-rotate-90'}`} />
              <div className="flex items-center gap-2 print:gap-1">
                <span className="text-lg print:text-sm">{displayIcon}</span>
                <h2 className={`text-lg font-bold print:text-[10px] ${titleClass}`}>{displayTitle}</h2>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2">
            {patients.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAllCardsCollapsed(!allCardsCollapsed)}
                className={`h-8 w-8 print:hidden ${buttonClass}`}
                title={allCardsCollapsed ? "Expandir todos os pacientes" : "Retrair todos os pacientes"}
              >
                {allCardsCollapsed ? (
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {onAddExtraBed && (
              <Button
                variant="outline"
                size="icon"
                onClick={onAddExtraBed}
                className={`h-8 w-8 print:hidden ${buttonClass}`}
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
                className={`h-8 w-8 print:hidden ${buttonClass}`}
                title="Imprimir mapa do setor"
              >
                <Printer className="h-3.5 w-3.5" />
              </Button>
            )}
            {onPrintRound && (
              <Button
                variant="outline"
                size="icon"
                onClick={onPrintRound}
                className={`h-8 w-8 print:hidden ${buttonClass}`}
                title="Imprimir Round Multiprofissional do setor"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
              </Button>
            )}
            <div className={`flex items-center justify-center h-8 w-8 backdrop-blur-sm rounded-lg border print:h-6 print:w-6 ${counterClass}`}>
              <p className={`text-base font-bold print:text-[10px] ${titleClass}`}>{patients.length}</p>
            </div>
          </div>
        </div>
      </div>

      <CollapsibleContent className="space-y-2 print:space-y-0.5">

        {displayPatients.length === 0 ? (
          <EmptySectorState
            sectorName={displayTitle}
            sectorIcon={typeof customIcon === 'string' ? customIcon : "🏥"}
            onAddBed={onAddExtraBed}
          />
        ) : (
          <div className="space-y-2">
            {displayPatients.map((patient) => (
              <UtiRow
                key={patient.id}
                patient={patient}
                onUpdate={onUpdatePatient}
                onDelete={onDeletePatient}
                onPrintPatient={onPrintPatient}
                onRefetch={onRefetch}
                selectionMode={selectionMode}
                isSelected={selectedPatients.has(patient.id)}
                onToggleSelection={onToggleSelection}
                colorVariant={colorVariant}
                forceCollapsed={allCardsCollapsed}
                allPatients={allPatients}
                currentUtiUnit={currentUtiUnit}
              />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
