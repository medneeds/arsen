import { Patient, SectorType } from "@/types/patient";
import { ReactNode } from "react";
import { UtiPatientCard } from "./UtiPatientCard";
import { EmptySectorState } from "@/components/EmptySectorState";
import { Printer, Plus, ChevronDown, ChevronsDownUp, ChevronsUpDown, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { regularBedCount, sectorCapacity } from "@/utils/bedNaming";

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

const DEFAULT_SECTOR_INFO = {
  title: "Leitos",
  subtitle: "Mapa de leitos",
  icon: "",
  gradientClass: "bg-primary/15 border-l-4 border-l-primary",
};

const sectorInfo: Record<string, typeof DEFAULT_SECTOR_INFO> = {
  red:     { title: "UTI 1",   subtitle: "Cuidados Intensivos", icon: "", gradientClass: "bg-primary/15 border-l-4 border-l-primary" },
  yellow:  { title: "UTI 2",   subtitle: "Cuidados Semi-Intensivos", icon: "", gradientClass: "bg-primary/15 border-l-4 border-l-primary" },
  blue:    { title: "UCI 1",   subtitle: "Cuidados Intermediários", icon: "", gradientClass: "bg-primary/15 border-l-4 border-l-primary" },
  outside: { title: "UCI 2",   subtitle: "Cuidados Intermediários", icon: "", gradientClass: "bg-primary/15 border-l-4 border-l-primary" },
  ucc:     { title: "UCC",     subtitle: "Unidade Coronariana", icon: "", gradientClass: "bg-primary/15 border-l-4 border-l-primary" },
  neuro_01:{ title: "Neuro 01",subtitle: "Neurologia", icon: "", gradientClass: "bg-primary/15 border-l-4 border-l-primary" },
  neuro_02:{ title: "Neuro 02",subtitle: "Neurologia", icon: "", gradientClass: "bg-primary/15 border-l-4 border-l-primary" },
  clinica_cirurgica:    { title: "Clínica Cirúrgica",    subtitle: "Internação", icon: "", gradientClass: "bg-primary/15 border-l-4 border-l-primary" },
  enfermaria_transicao: { title: "Enf. Transição",       subtitle: "Internação", icon: "", gradientClass: "bg-primary/15 border-l-4 border-l-primary" },
  enfermaria_vascular:  { title: "Enf. Vascular",        subtitle: "Internação", icon: "", gradientClass: "bg-primary/15 border-l-4 border-l-primary" },
};

interface UtiRowProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  onDelete?: (patientId: string) => void;
  onReleasePreAdmissionBed?: (patientId: string, payload: { reason: string; reasonNote: string }) => void | Promise<void>;
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
          onReleasePreAdmissionBed={props.onReleasePreAdmissionBed}
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
  onReleasePreAdmissionBed,
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
  // Fallback seguro — evita crash quando setor não está mapeado em sectorInfo
  const info = sectorInfo[sector] ?? DEFAULT_SECTOR_INFO;
  const displayTitle = customTitle || info.title;
  const displayIcon = customIcon || info.icon;
  const [internalIsOpen, setInternalIsOpen] = useState(patients.length > 0);
  const [allCardsCollapsed, setAllCardsCollapsed] = useState(true);

  // Header color schemes based on colorVariant
  const headerStyles: Record<ColorVariant, { bg: string; title: string; button: string; chevron: string; counter: string }> = {
    blue: {
      bg: "bg-primary/15 border-l-4 border-l-primary",
      title: "text-primary",
      button: "border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50",
      chevron: "text-primary",
      counter: "border-primary/30 bg-primary/10"
    },
    yellow: {
      bg: "bg-warning-soft/60 border-l-4 border-l-amber-500",
      title: "text-warning-on-soft",
      button: "border-warning/30 text-warning-on-soft hover:bg-warning/10 hover:border-warning/50",
      chevron: "text-warning-on-soft",
      counter: "border-warning/30 bg-warning/10"
    },
    red: {
      bg: "bg-critical-soft/60 border-l-4 border-l-red-500",
      title: "text-critical-on-soft",
      button: "border-critical/30 text-critical-on-soft hover:bg-critical/10 hover:border-critical/50",
      chevron: "text-critical-on-soft",
      counter: "border-critical/30 bg-critical/10"
    },
    green: {
      bg: "bg-released-soft/60 border-l-4 border-l-emerald-500",
      title: "text-released-on-soft",
      button: "border-released/30 text-released-on-soft hover:bg-released/10 hover:border-released/50",
      chevron: "text-released-on-soft",
      counter: "border-released/30 bg-released/10"
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2 print:space-y-1 print:break-inside-avoid">
      <div className={`${headerClass} rounded-lg p-2 border border-border/50 shadow-md print:p-1 print:mb-1 print:rounded-md transition-all duration-200 min-h-[48px] print:h-auto flex items-center`}>
        <div className="flex items-center justify-between w-full gap-3">
          {/* Checkbox de seleção em massa removido do cabeçalho a pedido — não é necessário */}
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity print:pointer-events-none flex-1">
              <ChevronDown className={`h-5 w-5 transition-transform print:hidden ${chevronClass} ${isOpen ? '' : '-rotate-90'}`} />
              <div className="flex items-center gap-2 print:gap-1">
                <span className="text-lg print:text-sm">{displayIcon}</span>
                <h2 className={`text-lg font-semibold print:text-xs ${titleClass}`}>{displayTitle}</h2>
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
              <p className={`text-base font-semibold print:text-xs ${titleClass}`}>
                {regularBedCount(patients)}
                {sectorCapacity(sector) > 0 && (
                  <span className="text-xs font-normal opacity-60">/{sectorCapacity(sector)}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <CollapsibleContent className="space-y-2 print:space-y-1">

        {displayPatients.length === 0 ? (
          <EmptySectorState
            sectorName={displayTitle}
            sectorIcon={typeof customIcon === 'string' ? customIcon : ""}
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
                onReleasePreAdmissionBed={onReleasePreAdmissionBed}
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
