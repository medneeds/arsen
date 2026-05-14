import { useState, useEffect, useMemo } from "react";
import { Patient } from "@/types/patient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { ArrowRightLeft, BedDouble, Check, User, MapPin, ClipboardList, Eye, History, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MovementConfirmDialog } from "@/components/MovementConfirmDialog";

interface UtiReallocationDialogProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentUtiUnit?: string; // "UTI 1" or "UTI 2"
  allPatients?: Patient[]; // All patients to find empty beds
}

export function UtiReallocationDialog({
  patient,
  isOpen,
  onClose,
  onSuccess,
  currentUtiUnit = "UTI 1",
  allPatients = [],
}: UtiReallocationDialogProps) {
  const [targetUnit, setTargetUnit] = useState<string>("");
  const [targetBedId, setTargetBedId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const { currentState, currentHospital } = useHospital();
  const { currentDepartment } = useDepartment();

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTargetUnit("");
      setTargetBedId("");
    }
  }, [isOpen]);

  // Get empty beds (beds without patient name) for each unit
  const emptyBeds = useMemo(() => {
    const uti1EmptyBeds = allPatients.filter(p => {
      const isUti1 = p.sector === "red";
      const isEmpty = !p.name || p.name.trim() === "";
      const isNotCurrentPatient = p.id !== patient?.id;
      return isUti1 && isEmpty && isNotCurrentPatient;
    }).sort((a, b) => {
      const numA = parseInt(a.bedNumber) || 0;
      const numB = parseInt(b.bedNumber) || 0;
      return numA - numB;
    });

    const uti2EmptyBeds = allPatients.filter(p => {
      const isUti2 = p.sector === "yellow";
      const isEmpty = !p.name || p.name.trim() === "";
      const isNotCurrentPatient = p.id !== patient?.id;
      return isUti2 && isEmpty && isNotCurrentPatient;
    }).sort((a, b) => {
      const numA = parseInt(a.bedNumber) || 0;
      const numB = parseInt(b.bedNumber) || 0;
      return numA - numB;
    });

    return {
      "UTI 1": uti1EmptyBeds,
      "UTI 2": uti2EmptyBeds,
    };
  }, [allPatients, patient?.id]);

  // Get available beds for selected unit
  const availableBeds = targetUnit ? emptyBeds[targetUnit as keyof typeof emptyBeds] || [] : [];

  // Get selected target bed patient record
  const targetBedPatient = useMemo(() => {
    return allPatients.find(p => p.id === targetBedId);
  }, [allPatients, targetBedId]);

  const handleOpenConfirm = () => {
    if (!patient || !targetBedPatient) return;
    if (!targetUnit) {
      toast({ title: "Campo obrigatório", description: "Selecione a unidade de destino.", variant: "destructive" });
      return;
    }
    if (!targetBedId) {
      toast({ title: "Campo obrigatório", description: "Selecione o leito de destino.", variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    if (!patient || !targetBedPatient) return;

    setIsSubmitting(true);

    try {
      if (!currentHospital || !currentState) {
        throw new Error('Hospital unit and state must be selected');
      }

      const isSameUnit = targetUnit === currentUtiUnit;
      const originalBedNumber = patient.bedNumber;

      // Step 1: Move patient data to the target bed (update target bed with patient data)
      const { error: targetError } = await supabase
        .from('patients')
        .update({
          name: patient.name,
          age: patient.age?.toString() || null,
          diagnoses: patient.diagnoses?.join('\n') || null,
          medical_history: patient.medicalHistory?.join('\n') || null,
          relevant_exams: patient.relevantExams?.join('\n') || null,
          pendencies: patient.pendencies?.join('\n') || null,
          schedule: patient.schedule?.join('\n') || null,
          admission_history: patient.admissionHistory || null,
          admission_date: patient.admissionDate || null,
          highlighted_diagnoses: patient.highlightedDiagnoses || null,
          highlighted_medical_history: patient.highlightedMedicalHistory || null,
          highlighted_pendencies: patient.highlightedPendencies || null,
          highlighted_conducts: patient.highlightedConducts || null,
          uti_admission_date: patient.utiAdmissionDate?.join('\n') || null,
          uti_discharge_prediction: patient.utiDischargePrediction?.join('\n') || null,
          uti_allergies: patient.utiAllergies?.join('\n') || null,
          uti_admission_reason: patient.utiAdmissionReason?.join('\n') || null,
          uti_current_status: patient.utiCurrentStatus?.join('\n') || null,
          uti_devices: patient.utiDevices?.join('\n') || null,
          uti_cultures_antibiotics: patient.utiCulturesAntibiotics?.join('\n') || null,
          uti_specialties: patient.utiSpecialties?.join('\n') || null,
          uti_origin_sector: patient.utiOriginSector?.join('\n') || null,
          uti_daily_conducts: patient.utiDailyConducts?.join('\n') || null,
          clinical_status: patient.clinicalStatus || null,
          psm_status: patient.psmStatus || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetBedPatient.id);

      if (targetError) throw targetError;

      // Step 1.5: Migrar histórico clínico (evoluções, prescrições, exames,
      // culturas, condutas, prontuário, etc.) do leito de ORIGEM para o
      // leito de DESTINO antes de esvaziar a origem. Garante continuidade
      // assistencial sem orfanizar o histórico vinculado ao patient_id antigo.
      const { repointPatientHistory } = await import("@/lib/repointPatientHistory");
      const repoint = await repointPatientHistory(
        patient.id,
        targetBedPatient.id,
        `Realocação UTI: ${originalBedNumber} → ${targetBedPatient.bed_number}`,
      );
      if (!repoint.ok) {
        throw new Error(
          `Falha ao migrar histórico clínico do leito de origem (${repoint.error}). Operação abortada para preservar integridade.`,
        );
      }

      // Step 2: Clear the original bed (make it empty)
      const { error: sourceError } = await supabase
        .from('patients')
        .update({
          name: '',
          age: null,
          diagnoses: null,
          medical_history: null,
          relevant_exams: null,
          pendencies: null,
          schedule: null,
          admission_history: null,
          admission_date: null,
          highlighted_diagnoses: null,
          highlighted_medical_history: null,
          highlighted_pendencies: null,
          highlighted_conducts: null,
          uti_admission_date: null,
          uti_discharge_prediction: null,
          uti_allergies: null,
          uti_admission_reason: null,
          uti_current_status: null,
          uti_devices: null,
          uti_cultures_antibiotics: null,
          uti_specialties: null,
          uti_origin_sector: null,
          uti_daily_conducts: null,
          clinical_status: null,
          psm_status: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', patient.id);

      if (sourceError) throw sourceError;

      // Register movement
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('patient_movements')
        .insert({
          patient_name: patient.name,
          patient_bed: originalBedNumber,
          patient_sector: patient.sector,
          movement_type: isSameUnit ? 'REALOCAÇÃO' : 'TRANSFERÊNCIA',
          destination: `${targetUnit} - Leito ${targetBedPatient.bedNumber}`,
          notes: `Realocação de ${currentUtiUnit} Leito ${originalBedNumber} para ${targetUnit} Leito ${targetBedPatient.bedNumber}`,
          created_by: user?.id,
          patient_snapshot: patient as any,
          department: currentDepartment,
          state_id: currentState.id,
          hospital_unit_id: currentHospital.id,
        });

      toast({
        title: isSameUnit ? "Paciente realocado" : "Paciente transferido",
        description: isSameUnit 
          ? `${patient.name} realocado para o leito ${targetBedPatient.bedNumber}.`
          : `${patient.name} transferido para ${targetUnit}, leito ${targetBedPatient.bedNumber}.`,
      });

      onSuccess?.();
      setConfirmOpen(false);
      handleClose();
    } catch (error) {
      console.error('Error reallocating patient:', error);
      toast({
        title: "Erro ao realocar paciente",
        description: "Não foi possível realocar o paciente. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTargetUnit("");
    setTargetBedId("");
    setConfirmOpen(false);
    onClose();
  };

  if (!patient) return null;

  const totalEmptyBeds = emptyBeds["UTI 1"].length + emptyBeds["UTI 2"].length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <ArrowRightLeft className="h-6 w-6 text-blue-600" />
            <DialogTitle className="text-xl">Realocar Paciente</DialogTitle>
          </div>
          <DialogDescription>
            Selecione um leito vazio disponível para realocar o paciente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current patient info */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Paciente</Label>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{patient.name}</p>
              <p className="text-sm text-muted-foreground">
                {currentUtiUnit} • Leito: {patient.bedNumber}
              </p>
            </div>
          </div>

          {/* Unit selection */}
          <div className="space-y-2">
            <Label htmlFor="targetUnit">Unidade de Destino *</Label>
            <Select value={targetUnit} onValueChange={(value) => {
              setTargetUnit(value);
              setTargetBedId(""); // Reset bed selection when unit changes
            }}>
              <SelectTrigger id="targetUnit">
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTI 1">
                  <div className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-blue-500" />
                    <span>UTI Unidade 1</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {emptyBeds["UTI 1"].length} vago(s)
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="UTI 2">
                  <div className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-amber-500" />
                    <span>UTI Unidade 2</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {emptyBeds["UTI 2"].length} vago(s)
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bed selection - only show empty beds */}
          {targetUnit && (
            <div className="space-y-2">
              <Label htmlFor="targetBed">Leito de Destino *</Label>
              {availableBeds.length > 0 ? (
                <Select value={targetBedId} onValueChange={setTargetBedId}>
                  <SelectTrigger id="targetBed">
                    <SelectValue placeholder="Selecione o leito vago" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBeds.map((bed) => (
                      <SelectItem key={bed.id} value={bed.id}>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Leito {bed.bedNumber}</span>
                          <Badge variant="outline" className="ml-2 text-xs text-green-600 border-green-300">
                            Disponível
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Não há leitos vagos disponíveis em {targetUnit}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Summary of selection */}
          {targetBedPatient && (
            <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400">
                <strong>{patient.name}</strong> será realocado para{' '}
                <strong>{targetUnit} - Leito {targetBedPatient.bedNumber}</strong>
              </p>
            </div>
          )}

          {totalEmptyBeds === 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">
                Não há leitos vagos disponíveis em nenhuma unidade de UTI.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleOpenConfirm}
            disabled={isSubmitting || !targetBedId || availableBeds.length === 0}
          >
            {isSubmitting ? "Realocando..." : "Revisar e confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {patient && targetBedPatient && (
        <MovementConfirmDialog
          open={confirmOpen}
          onOpenChange={(o) => !isSubmitting && setConfirmOpen(o)}
          onConfirm={handleSubmit}
          isSubmitting={isSubmitting}
          title={targetUnit === currentUtiUnit ? "Confirmar realocação interna na UTI" : "Confirmar transferência entre UTIs"}
          confirmLabel={targetUnit === currentUtiUnit ? "Confirmar realocação" : "Confirmar transferência"}
          summary={[
            { icon: User, label: "Paciente", value: patient.name },
            { icon: BedDouble, label: "Origem", value: `${currentUtiUnit} • Leito ${patient.bedNumber}` },
            { icon: MapPin, label: "Destino", value: `${targetUnit} • Leito ${targetBedPatient.bedNumber}` },
          ]}
          consequences={[
            { icon: ArrowRightLeft, text: <>Todos os dados clínicos do paciente (diagnósticos, dispositivos, culturas, condutas, status) serão <strong>copiados para o leito de destino</strong>.</> },
            { icon: BedDouble, text: <>O leito de origem ficará <strong>limpo e disponível</strong> para nova alocação imediatamente.</> },
            { icon: ClipboardList, text: <>A movimentação será registrada como <strong>{targetUnit === currentUtiUnit ? "REALOCAÇÃO" : "TRANSFERÊNCIA"}</strong> na linha do tempo do paciente.</> },
            ...(targetUnit !== currentUtiUnit
              ? [{ icon: AlertTriangle, text: <>Como há mudança de unidade de UTI, a <strong>responsabilidade médica e a equipe assistencial</strong> serão atualizadas conforme escala da unidade destino.</> }]
              : []),
            { icon: Eye, text: <>O paciente continua visível em todos os módulos (mapa, prescrição, evolução, exames).</> },
            { icon: History, text: <>O histórico clínico longitudinal é preservado integralmente.</> },
          ]}
          warnings={targetUnit !== currentUtiUnit
            ? [{ label: "Mudança de unidade", detail: "verifique a escala médica e o handover com a equipe receptora antes de confirmar." }]
            : []}
          finalNote={<>Caso ocorra erro durante a movimentação, repita a operação ou contate o suporte. O sistema mantém integridade transacional.</>}
        />
      )}
    </Dialog>
  );
}
