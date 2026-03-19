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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface RequestUtiAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Map UTI sectors to internal representation
const utiSectorMap: Record<string, Patient['sector']> = {
  "UTI 1": "blue",
  "UTI 2": "yellow",
};

// Editable list item component
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
      if (value.trim() && isLast && onAddNew) {
        onAddNew();
      } else if (onEnterPress) {
        onEnterPress();
      }
    } else if (e.key === 'Tab' && !e.shiftKey && isLast && onTabPress) {
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
        className="h-8 w-8 opacity-0 group-hover/item:opacity-100 transition-opacity text-destructive hover:text-destructive"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function RequestUtiAllocationDialog({ open, onOpenChange }: RequestUtiAllocationDialogProps) {
  const { toast } = useToast();
  const { currentDepartment } = useDepartment();
  const { currentHospital, currentState } = useHospital();
  const { user } = useAuth();
  const { createPatient } = usePatients("UTI");
  const { createRequest } = useBedAllocationRequests();

  // Form state
  const [targetUti, setTargetUti] = useState<"UTI 1" | "UTI 2">("UTI 1");
  const [requestingDoctorName, setRequestingDoctorName] = useState("");
  const [requestingOfficeNumber, setRequestingOfficeNumber] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState("");
  const [patientRecord, setPatientRecord] = useState("");
  const [originSector, setOriginSector] = useState("");
  
  // Clinical data as arrays
  const [diagnoses, setDiagnoses] = useState<string[]>([""]);
  const [antecedentes, setAntecedentes] = useState<string[]>([""]);
  const [exams, setExams] = useState<string[]>([""]);
  const [pendencies, setPendencies] = useState<string[]>([""]);
  const [admissionHistory, setAdmissionHistory] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Refs for focus management
  const doctorNameRef = useRef<HTMLInputElement>(null);
  const diagnosesRefs = useRef<(HTMLInputElement | null)[]>([]);
  const antecedentesRefs = useRef<(HTMLInputElement | null)[]>([]);
  const examsRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pendenciesRefs = useRef<(HTMLInputElement | null)[]>([]);
  const historyRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on doctor name when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        doctorNameRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const resetForm = () => {
    setTargetUti("UTI 1");
    setRequestingDoctorName("");
    setRequestingOfficeNumber("");
    setPatientName("");
    setPatientAge("");
    setPatientSex("");
    setPatientRecord("");
    setOriginSector("");
    setDiagnoses([""]);
    setAntecedentes([""]);
    setExams([""]);
    setPendencies([""]);
    setAdmissionHistory("");
    setIsAdvancedOpen(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // List management helpers
  const addItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, refs: React.MutableRefObject<(HTMLInputElement | null)[]>) => {
    setList([...list, ""]);
    setTimeout(() => {
      refs.current[list.length]?.focus();
    }, 50);
  };

  const updateItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
    const newList = [...list];
    newList[index] = value;
    setList(newList);
  };

  const removeItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    if (list.length > 1) {
      setList(list.filter((_, i) => i !== index));
    } else {
      setList([""]);
    }
  };

  // Focus navigation
  const focusSection = (section: 'diagnoses' | 'antecedentes' | 'exams' | 'pendencias' | 'history') => {
    setTimeout(() => {
      switch (section) {
        case 'diagnoses':
          diagnosesRefs.current[0]?.focus();
          break;
        case 'antecedentes':
          antecedentesRefs.current[0]?.focus();
          break;
        case 'exams':
          examsRefs.current[0]?.focus();
          break;
        case 'pendencias':
          pendenciesRefs.current[0]?.focus();
          break;
        case 'history':
          historyRef.current?.focus();
          break;
      }
    }, 50);
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

    if (!currentHospital?.id || !currentState?.id) {
      toast({
        title: "Erro de configuração",
        description: "Hospital ou estado não selecionado.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const internalSector = utiSectorMap[targetUti];
      
      // Get next bed number for UTI "outside" sector
      const { data: existingPatients } = await supabase
        .from('patients')
        .select('bed_number')
        .eq('department', 'UTI')
        .eq('sector', 'outside');

      const bedNumbers = (existingPatients || [])
        .map(p => parseInt(p.bed_number.substring(1)))
        .filter(n => !isNaN(n));
      const maxBedNumber = bedNumbers.length > 0 ? Math.max(...bedNumbers) : 0;
      const newBedNumber = `S${String(maxBedNumber + 1).padStart(2, '0')}`;

      // Create patient in "outside" sector for UTI department
      const patientData: Omit<Patient, 'id'> = {
        bedNumber: newBedNumber,
        name: patientName.toUpperCase(),
        age: patientAge ? parseInt(patientAge) || patientAge : "",
        sector: "outside",
        diagnoses: diagnoses.filter(d => d.trim()),
        medicalHistory: antecedentes.filter(a => a.trim()),
        relevantExams: exams.filter(e => e.trim()),
        pendencies: pendencies.filter(p => p.trim()),
        schedule: [],
        admissionHistory: admissionHistory,
        admissionDate: new Date().toISOString().slice(0, 16).replace('T', ' '),
        highlightedPendencies: [],
        isDoorPatient: true,
        allocationStatus: 'pending',
        utiOriginSector: originSector ? [originSector.toUpperCase()] : [],
        utiAdmissionDate: [],
        utiDischargePrediction: [],
        utiAllergies: [],
        utiAdmissionReason: [],
        utiCurrentStatus: [],
        utiDevices: [],
        utiCulturesAntibiotics: [],
        utiSpecialties: [],
      };

      // Create patient
      const createdPatient = await createPatient(patientData, "UTI");

      // Create allocation request - passes patientId, sector, bed, doctorName, officeNumber
      const requestedSector = targetUti === "UTI 1" ? "blue" : "yellow";
      await createRequest(
        createdPatient.id,
        requestedSector,
        undefined,
        requestingDoctorName.toUpperCase() || undefined,
        requestingOfficeNumber || undefined
      );

      toast({
        title: "Solicitação enviada",
        description: `Solicitação de leito para ${targetUti} enviada com sucesso.`,
      });

      handleClose();
    } catch (error) {
      console.error("Error submitting UTI allocation request:", error);
      toast({
        title: "Erro ao enviar solicitação",
        description: "Não foi possível enviar a solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-primary" />
            Solicitar Leito UTI
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do paciente para solicitar alocação em uma das UTIs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* UTI Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">UTI de Destino</Label>
            <Select value={targetUti} onValueChange={(v) => setTargetUti(v as "UTI 1" | "UTI 2")}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTI 1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-primary border border-primary/40 bg-primary/10 px-1.5 py-0.5 rounded">1</span>
                    <span>UTI 1</span>
                  </div>
                </SelectItem>
                <SelectItem value="UTI 2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 rounded">2</span>
                    <span>UTI 2</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Requesting Doctor Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Médico Solicitante</Label>
              <Input
                ref={doctorNameRef}
                value={requestingDoctorName}
                onChange={(e) => setRequestingDoctorName(e.target.value)}
                placeholder="Nome do médico"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Setor de Origem</Label>
              <Input
                value={originSector}
                onChange={(e) => setOriginSector(e.target.value)}
                placeholder="Ex: Emergência, Enfermaria..."
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Patient Basic Info */}
          <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="h-4 w-4 text-primary" />
              Dados do Paciente
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] text-muted-foreground">Nome *</Label>
                <Input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nome completo"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Idade</Label>
                <Input
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  placeholder="Ex: 45"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Sexo</Label>
                <Select value={patientSex} onValueChange={setPatientSex}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Clinical Data Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Diagnoses */}
            <div className="space-y-2 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Stethoscope className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-[10px] font-semibold text-muted-foreground">Hipóteses / Diagnósticos</span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => addItem(diagnoses, setDiagnoses, diagnosesRefs)}
                  className="h-5 w-5"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {diagnoses.map((d, i) => (
                  <EditableListItem
                    key={i}
                    index={i}
                    value={d}
                    onChange={(v) => updateItem(diagnoses, setDiagnoses, i, v)}
                    onRemove={() => removeItem(diagnoses, setDiagnoses, i)}
                    placeholder="DIAGNÓSTICO..."
                    isLast={i === diagnoses.length - 1}
                    onAddNew={() => addItem(diagnoses, setDiagnoses, diagnosesRefs)}
                    onTabPress={() => focusSection('antecedentes')}
                  />
                ))}
              </div>
            </div>

            {/* Antecedentes */}
            <div className="space-y-2 p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  <span className="text-[10px] font-semibold text-muted-foreground">Antecedentes / Comorbidades</span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => addItem(antecedentes, setAntecedentes, antecedentesRefs)}
                  className="h-5 w-5"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {antecedentes.map((a, i) => (
                  <EditableListItem
                    key={i}
                    index={i}
                    value={a}
                    onChange={(v) => updateItem(antecedentes, setAntecedentes, i, v)}
                    onRemove={() => removeItem(antecedentes, setAntecedentes, i)}
                    placeholder="ANTECEDENTE..."
                    isLast={i === antecedentes.length - 1}
                    onAddNew={() => addItem(antecedentes, setAntecedentes, antecedentesRefs)}
                    onTabPress={() => focusSection('exams')}
                  />
                ))}
              </div>
            </div>

            {/* Exams */}
            <div className="space-y-2 p-2 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <span className="text-[10px] font-semibold text-muted-foreground">Exames Relevantes</span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => addItem(exams, setExams, examsRefs)}
                  className="h-5 w-5"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {exams.map((e, i) => (
                  <EditableListItem
                    key={i}
                    index={i}
                    value={e}
                    onChange={(v) => updateItem(exams, setExams, i, v)}
                    onRemove={() => removeItem(exams, setExams, i)}
                    placeholder="EXAME..."
                    isLast={i === exams.length - 1}
                    onAddNew={() => addItem(exams, setExams, examsRefs)}
                    onTabPress={() => focusSection('pendencias')}
                  />
                ))}
              </div>
            </div>

            {/* Pendencies */}
            <div className="space-y-2 p-2 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  <span className="text-[10px] font-semibold text-muted-foreground">Programações / Pendências</span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => addItem(pendencies, setPendencies, pendenciesRefs)}
                  className="h-5 w-5"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {pendencies.map((p, i) => (
                  <EditableListItem
                    key={i}
                    index={i}
                    value={p}
                    onChange={(v) => updateItem(pendencies, setPendencies, i, v)}
                    onRemove={() => removeItem(pendencies, setPendencies, i)}
                    placeholder="PENDÊNCIA..."
                    isLast={i === pendencies.length - 1}
                    onAddNew={() => addItem(pendencies, setPendencies, pendenciesRefs)}
                    onTabPress={() => focusSection('history')}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Admission History */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-8 text-xs">
                <span>História Admissional / Anamnese</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", isAdvancedOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Textarea
                ref={historyRef}
                value={admissionHistory}
                onChange={(e) => setAdmissionHistory(e.target.value.toUpperCase())}
                placeholder="HISTÓRIA CLÍNICA COMPLETA, EVOLUÇÃO, CONDUTAS..."
                className="min-h-[120px] text-xs uppercase"
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            <Send className="h-4 w-4" />
            {isSubmitting ? "Enviando..." : "Solicitar Leito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
