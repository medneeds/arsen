import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Bed, Send, ChevronDown, User, Stethoscope, FileText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useBedAllocationRequests } from "@/hooks/useBedAllocationRequests";
import { usePatients } from "@/hooks/usePatients";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Patient } from "@/types/patient";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RequestNewAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetSector: "Cuidados Especiais" | "Observação Amarela" | "Observação Azul";
}

const sectorToInternalSector: Record<string, Patient['sector']> = {
  "Cuidados Especiais": "red",
  "Observação Amarela": "yellow",
  "Observação Azul": "blue",
};

// Editable list item component (similar to PatientCard style)
interface EditableListItemProps {
  index: number;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  placeholder?: string;
  isLast?: boolean;
  onAddNew?: () => void;
  onEnterPress?: () => void;
  onTabPress?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

function EditableListItem({ 
  index, 
  value, 
  onChange, 
  onRemove, 
  placeholder, 
  isLast, 
  onAddNew,
  onEnterPress,
  onTabPress,
  inputRef 
}: EditableListItemProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If has content and is last item, add new item
      if (value.trim() && isLast && onAddNew) {
        onAddNew();
      } else if (onEnterPress) {
        // Move to next section or field
        onEnterPress();
      }
    } else if (e.key === 'Tab' && !e.shiftKey && isLast && onTabPress) {
      // Tab on last item of section → jump to next section
      e.preventDefault();
      onTabPress();
    }
  };

  return (
    <div className="flex items-start gap-1.5 group/item">
      <span className="text-[10px] font-semibold text-muted-foreground pt-2 w-4 flex-shrink-0">{index + 1}.</span>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-8 text-xs flex-1"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onRemove}
        className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      {isLast && onAddNew && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onAddNew}
          className="h-8 w-8 text-muted-foreground hover:text-primary flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function RequestNewAllocationDialog({
  open,
  onOpenChange,
  targetSector,
}: RequestNewAllocationDialogProps) {
  // Refs for keyboard navigation
  const doctorNameRef = useRef<HTMLInputElement>(null);
  const officeNumberRef = useRef<HTMLInputElement>(null);
  const patientNameRef = useRef<HTMLInputElement>(null);
  const patientAgeRef = useRef<HTMLInputElement>(null);
  const admissionHistoryRef = useRef<HTMLTextAreaElement>(null);
  
  // Refs for list sections (to focus first input of each section)
  const diagnosesFirstRef = useRef<HTMLInputElement>(null);
  const medicalHistoryFirstRef = useRef<HTMLInputElement>(null);
  const examsFirstRef = useRef<HTMLInputElement>(null);
  const pendenciesFirstRef = useRef<HTMLInputElement>(null);
  
  // Doctor info
  const [doctorName, setDoctorName] = useState("");
  const [officeNumber, setOfficeNumber] = useState("");
  
  // Patient identification
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  
  // Clinical data - using arrays for list-style editing
  const [diagnosesList, setDiagnosesList] = useState<string[]>([""]);
  const [medicalHistoryList, setMedicalHistoryList] = useState<string[]>([""]);
  const [relevantExamsList, setRelevantExamsList] = useState<string[]>([""]);
  const [pendenciesList, setPendenciesList] = useState<string[]>([""]);
  const [admissionHistory, setAdmissionHistory] = useState("");
  
  // Section states - clinical data collapsed by default for faster workflow
  const [clinicalOpen, setClinicalOpen] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createRequest } = useBedAllocationRequests();
  const { createPatient } = usePatients();
  const { currentDepartment } = useDepartment();
  const { currentHospital, currentState } = useHospital();
  const { user } = useAuth();
  const { toast } = useToast();

  // Auto-focus on doctor name when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        doctorNameRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Keyboard navigation handler
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, nextRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef.current) {
        nextRef.current.focus();
      }
    }
  };

  const resetForm = () => {
    setPatientName("");
    setPatientAge("");
    setDoctorName("");
    setOfficeNumber("");
    setDiagnosesList([""]);
    setMedicalHistoryList([""]);
    setRelevantExamsList([""]);
    setPendenciesList([""]);
    setAdmissionHistory("");
  };

  // Helper functions for list management
  const updateListItem = (
    list: string[], 
    setList: React.Dispatch<React.SetStateAction<string[]>>, 
    index: number, 
    value: string
  ) => {
    const newList = [...list];
    newList[index] = value;
    setList(newList);
  };

  const removeListItem = (
    list: string[], 
    setList: React.Dispatch<React.SetStateAction<string[]>>, 
    index: number
  ) => {
    if (list.length === 1) {
      setList([""]);
    } else {
      setList(list.filter((_, i) => i !== index));
    }
  };

  const addListItem = (
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    focusRef?: React.RefObject<HTMLInputElement>
  ) => {
    setList(prev => [...prev, ""]);
    // Focus the new input after state updates
    setTimeout(() => {
      // Find the last input in the container
      const container = focusRef?.current?.closest('.space-y-1\\.5');
      if (container) {
        const inputs = container.querySelectorAll('input');
        const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
        lastInput?.focus();
      }
    }, 50);
  };

  // Focus next section helper
  const focusNextSection = (currentSection: 'diagnoses' | 'medicalHistory' | 'exams' | 'pendencies') => {
    setTimeout(() => {
      switch (currentSection) {
        case 'diagnoses':
          medicalHistoryFirstRef.current?.focus();
          break;
        case 'medicalHistory':
          examsFirstRef.current?.focus();
          break;
        case 'exams':
          pendenciesFirstRef.current?.focus();
          break;
        case 'pendencies':
          admissionHistoryRef.current?.focus();
          break;
      }
    }, 50);
  };

  // Convert list to string for database storage
  const listToString = (list: string[]): string | null => {
    const filtered = list.map(item => item.trim()).filter(Boolean);
    return filtered.length > 0 ? filtered.join('\n') : null;
  };

  const handleSubmit = async () => {
    if (!patientName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do paciente.",
        variant: "destructive",
      });
      return;
    }

    if (!doctorName.trim()) {
      toast({
        title: "Nome do médico obrigatório",
        description: "Por favor, informe o nome do médico solicitante.",
        variant: "destructive",
      });
      return;
    }

    if (!currentHospital || !currentState) {
      toast({
        title: "Erro",
        description: "Hospital ou estado não selecionado.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // First, create a door patient in the "outside" sector
      const sectorPrefix = 'F';
      
      // Get highest bed number for outside sector
      const { data: existingBeds } = await supabase
        .from('patients')
        .select('bed_number')
        .eq('sector', 'outside')
        .eq('department', currentDepartment)
        .eq('hospital_unit_id', currentHospital.id);
      
      const bedNumbers = (existingBeds || [])
        .map(p => parseInt(p.bed_number.substring(1)))
        .filter(n => !isNaN(n));
      
      const maxBedNumber = bedNumbers.length > 0 ? Math.max(...bedNumbers) : 0;
      const newBedNumber = `${sectorPrefix}${String(maxBedNumber + 1).padStart(2, '0')}`;

      // Parse text fields into arrays (split by newlines) - legacy helper for other uses
      const parseTextToArray = (text: string): string | null => {
        const items = text.split('\n').map(item => item.trim()).filter(Boolean);
        return items.length > 0 ? items.join('\n') : null;
      };

      // Convert lists to database format
      const diagnosesData = listToString(diagnosesList);
      const medicalHistoryData = listToString(medicalHistoryList);
      const relevantExamsData = listToString(relevantExamsList);
      const pendenciesData = listToString(pendenciesList);

      // Create the door patient with all clinical data
      const { data: newPatient, error: createError } = await supabase
        .from('patients')
        .insert({
          bed_number: newBedNumber,
          name: patientName.toUpperCase(),
          age: patientAge || null,
          sector: 'outside',
          department: currentDepartment,
          state_id: currentState.id,
          hospital_unit_id: currentHospital.id,
          is_door_patient: true,
          allocation_status: 'pending',
          medical_responsibility: { type: 'porta' },
          created_by: user?.id || null,
          // Clinical data from lists
          diagnoses: diagnosesData,
          medical_history: medicalHistoryData,
          relevant_exams: relevantExamsData,
          pendencies: pendenciesData,
          admission_history: admissionHistory.trim() || null,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Create the allocation request with doctor info
      const result = await createRequest(
        newPatient.id, 
        targetSector, 
        undefined, 
        doctorName.toUpperCase(), 
        officeNumber || undefined
      );
      
      if (result) {
        toast({
          title: "Solicitação enviada",
          description: `Paciente ${patientName} cadastrado e solicitação de alocação em ${targetSector} enviada ao líder.`,
        });
        onOpenChange(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating allocation request:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a solicitação.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSectorColor = () => {
    switch (targetSector) {
      case "Cuidados Especiais": return "text-red-500";
      case "Observação Amarela": return "text-yellow-500";
      case "Observação Azul": return "text-blue-500";
      default: return "";
    }
  };

  const getSectorBgColor = () => {
    switch (targetSector) {
      case "Cuidados Especiais": return "bg-red-500/10 border-red-500/30";
      case "Observação Amarela": return "bg-yellow-500/10 border-yellow-500/30";
      case "Observação Azul": return "bg-blue-500/10 border-blue-500/30";
      default: return "bg-muted/50";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0">
        {/* Allow scrolling the entire popup (header + content + footer) */}
        <div className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Bed className="h-5 w-5 text-primary" />
              Solicitar Alocação de Leito
            </DialogTitle>
            <DialogDescription>
              Cadastre o paciente com todos os dados clínicos e solicite alocação em{" "}
              <span className={`font-semibold ${getSectorColor()}`}>{targetSector}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6">
            <div className="space-y-4 py-4">
            {/* Target Sector Banner */}
            <div className={`p-3 rounded-lg border ${getSectorBgColor()}`}>
              <p className="text-sm font-medium">
                <strong>Setor solicitado:</strong>{" "}
                <span className={`font-semibold ${getSectorColor()}`}>{targetSector}</span>
              </p>
            </div>

            {/* Doctor Info Section */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-primary tracking-wide">Médico Solicitante</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="doctor-name" className="text-xs">Nome do Médico</Label>
                    <Badge variant="destructive" className="h-4 text-[10px] px-1.5">Obrigatório</Badge>
                  </div>
                  <Input
                    ref={doctorNameRef}
                    id="doctor-name"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, officeNumberRef)}
                    placeholder="Dr. Nome"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="office-number" className="text-xs">Nº Consultório</Label>
                    <Badge variant="secondary" className="h-4 text-[10px] px-1.5 opacity-60">Opcional</Badge>
                  </div>
                  <Input
                    ref={officeNumberRef}
                    id="office-number"
                    value={officeNumber}
                    onChange={(e) => setOfficeNumber(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, patientNameRef)}
                    placeholder="Ex: 01"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Patient Identification Section */}
            <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-muted-foreground tracking-wide">Identificação do Paciente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="patient-name" className="text-xs">Nome do Paciente</Label>
                    <Badge variant="destructive" className="h-4 text-[10px] px-1.5">Obrigatório</Badge>
                  </div>
                  <Input
                    ref={patientNameRef}
                    id="patient-name"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value.toUpperCase())}
                    onKeyDown={(e) => handleKeyDown(e, patientAgeRef)}
                    placeholder="NOME COMPLETO"
                    className="uppercase h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="patient-age" className="text-xs">Idade</Label>
                    <Badge variant="secondary" className="h-4 text-[10px] px-1.5 opacity-60">Opcional</Badge>
                  </div>
                  <Input
                    ref={patientAgeRef}
                    id="patient-age"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setClinicalOpen(true);
                      }
                    }}
                    placeholder="Ex: 45 anos"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Clinical Data Section - Collapsible (collapsed by default for faster workflow) */}
            <Collapsible open={clinicalOpen} onOpenChange={setClinicalOpen}>
              <div className="rounded-lg border overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full p-4 flex items-center justify-between bg-accent/30 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-accent-foreground" />
                      <span className="text-sm font-semibold text-accent-foreground uppercase tracking-wide">
                        Dados Clínicos
                      </span>
                      <Badge variant="secondary" className="h-4 text-[10px] px-1.5 opacity-60">Opcional</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {!clinicalOpen && (
                        <span className="text-xs text-muted-foreground">Clique para expandir</span>
                      )}
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${clinicalOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="max-h-[350px] overflow-y-auto">
                    <div className="p-4 space-y-4 bg-background">
                      {/* Diagnoses - List style */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium flex items-center gap-2">
                          Hipóteses / Diagnósticos
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => addListItem(setDiagnosesList, diagnosesFirstRef)}
                            className="h-5 w-5 text-muted-foreground hover:text-primary"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </Label>
                        <div className="space-y-1.5">
                          {diagnosesList.map((item, index) => (
                            <EditableListItem
                              key={index}
                              index={index}
                              value={item}
                              inputRef={index === 0 ? diagnosesFirstRef : undefined}
                              onChange={(value) => updateListItem(diagnosesList, setDiagnosesList, index, value)}
                              onRemove={() => removeListItem(diagnosesList, setDiagnosesList, index)}
                              placeholder="Digite o diagnóstico..."
                              isLast={index === diagnosesList.length - 1}
                              onAddNew={() => addListItem(setDiagnosesList, diagnosesFirstRef)}
                              onEnterPress={() => {
                                if (!item.trim()) {
                                  focusNextSection('diagnoses');
                                }
                              }}
                              onTabPress={() => focusNextSection('diagnoses')}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Medical History - List style */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium flex items-center gap-2">
                          Antecedentes
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => addListItem(setMedicalHistoryList, medicalHistoryFirstRef)}
                            className="h-5 w-5 text-muted-foreground hover:text-primary"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </Label>
                        <div className="space-y-1.5">
                          {medicalHistoryList.map((item, index) => (
                            <EditableListItem
                              key={index}
                              index={index}
                              value={item}
                              inputRef={index === 0 ? medicalHistoryFirstRef : undefined}
                              onChange={(value) => updateListItem(medicalHistoryList, setMedicalHistoryList, index, value)}
                              onRemove={() => removeListItem(medicalHistoryList, setMedicalHistoryList, index)}
                              placeholder="Digite o antecedente..."
                              isLast={index === medicalHistoryList.length - 1}
                              onAddNew={() => addListItem(setMedicalHistoryList, medicalHistoryFirstRef)}
                              onEnterPress={() => {
                                if (!item.trim()) {
                                  focusNextSection('medicalHistory');
                                }
                              }}
                              onTabPress={() => focusNextSection('medicalHistory')}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Relevant Exams - List style */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium flex items-center gap-2">
                          Exames
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => addListItem(setRelevantExamsList, examsFirstRef)}
                            className="h-5 w-5 text-muted-foreground hover:text-primary"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </Label>
                        <div className="space-y-1.5">
                          {relevantExamsList.map((item, index) => (
                            <EditableListItem
                              key={index}
                              index={index}
                              value={item}
                              inputRef={index === 0 ? examsFirstRef : undefined}
                              onChange={(value) => updateListItem(relevantExamsList, setRelevantExamsList, index, value)}
                              onRemove={() => removeListItem(relevantExamsList, setRelevantExamsList, index)}
                              placeholder="Digite o exame..."
                              isLast={index === relevantExamsList.length - 1}
                              onAddNew={() => addListItem(setRelevantExamsList, examsFirstRef)}
                              onEnterPress={() => {
                                if (!item.trim()) {
                                  focusNextSection('exams');
                                }
                              }}
                              onTabPress={() => focusNextSection('exams')}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Pendencies - List style */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium flex items-center gap-2">
                          Programações / Pendências
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => addListItem(setPendenciesList, pendenciesFirstRef)}
                            className="h-5 w-5 text-muted-foreground hover:text-primary"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </Label>
                        <div className="space-y-1.5">
                          {pendenciesList.map((item, index) => (
                            <EditableListItem
                              key={index}
                              index={index}
                              value={item}
                              inputRef={index === 0 ? pendenciesFirstRef : undefined}
                              onChange={(value) => updateListItem(pendenciesList, setPendenciesList, index, value)}
                              onRemove={() => removeListItem(pendenciesList, setPendenciesList, index)}
                              placeholder="Digite a pendência..."
                              isLast={index === pendenciesList.length - 1}
                              onAddNew={() => addListItem(setPendenciesList, pendenciesFirstRef)}
                              onEnterPress={() => {
                                if (!item.trim()) {
                                  focusNextSection('pendencies');
                                }
                              }}
                              onTabPress={() => focusNextSection('pendencies')}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Admission History - Textarea for longer text */}
                      <div className="space-y-1.5">
                        <Label htmlFor="admission-history" className="text-xs font-medium">
                          História Admissional / Anamnese
                        </Label>
                        <Textarea
                          ref={admissionHistoryRef}
                          id="admission-history"
                          value={admissionHistory}
                          onChange={(e) => setAdmissionHistory(e.target.value)}
                          placeholder="Descreva a história admissional do paciente..."
                          className="min-h-[100px] text-sm resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!patientName.trim() || !doctorName.trim() || isSubmitting}
              className="bg-primary"
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? "Enviando..." : "Criar e Solicitar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
