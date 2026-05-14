import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Patient } from "@/types/patient";
import { useToast } from "@/hooks/use-toast";
import { Department } from "@/contexts/DepartmentContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useAuth } from "@/contexts/AuthContext";

export function usePatients(department?: Department, sector?: string) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentState, currentHospital } = useHospital();
  const { user } = useAuth();

  const fetchPatients = async () => {
    try {
      if (!currentHospital || !currentState) {
        setIsLoading(false);
        return;
      }

      let query = supabase
        .from('patients')
        .select('*')
        .eq('hospital_unit_id', currentHospital.id)
        .eq('state_id', currentState.id);
      
      if (sector) {
        query = query.eq('sector', sector);
      } else if (department) {
        query = query.eq('department', department);
      }
      
      const { data, error } = await query.order('display_order').order('bed_number');

      if (error) throw error;

      const mappedPatients: Patient[] = (data || []).map(p => ({
        id: p.id,
        bedNumber: p.bed_number,
        name: p.name || '',
        age: p.age || '',
        sector: p.sector as 'red' | 'yellow' | 'blue' | 'outside',
        diagnoses: p.diagnoses ? p.diagnoses.split('\n').filter(Boolean) : [],
        medicalHistory: p.medical_history ? p.medical_history.split('\n').filter(Boolean) : [],
        relevantExams: p.relevant_exams ? p.relevant_exams.split('\n').filter(Boolean) : [],
        pendencies: p.pendencies ? p.pendencies.split('\n').filter(Boolean) : [],
        highlightedPendencies: p.highlighted_pendencies || [],
        highlightedDiagnoses: (p as any).highlighted_diagnoses || [],
        highlightedMedicalHistory: (p as any).highlighted_medical_history || [],
        highlightedConducts: (p as any).highlighted_conducts || [],
        schedule: p.schedule ? p.schedule.split('\n').filter(Boolean) : [],
        admissionHistory: p.admission_history || '',
        admissionDate: p.admission_date || '',
        medicalResponsibility: (p.medical_responsibility as unknown) as Patient['medicalResponsibility'],
        // UTI fields
        utiAdmissionDate: p.uti_admission_date ? p.uti_admission_date.split('\n').filter(Boolean).map(date => {
          // Convert ISO timestamp to DD/MM/YYYY format if needed
          try {
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
              const day = String(parsedDate.getDate()).padStart(2, '0');
              const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
              const year = parsedDate.getFullYear();
              return `${day}/${month}/${year}`;
            }
          } catch (e) {
            // If parsing fails, return as is
          }
          return date;
        }) : [],
        utiDischargePrediction: p.uti_discharge_prediction ? p.uti_discharge_prediction.split('\n').filter(Boolean) : [],
        utiAllergies: p.uti_allergies ? p.uti_allergies.split('\n').filter(Boolean) : [],
        utiAdmissionReason: p.uti_admission_reason ? p.uti_admission_reason.split('\n').filter(Boolean) : [],
        utiCurrentStatus: p.uti_current_status ? p.uti_current_status.split('\n').filter(Boolean) : [],
        utiDevices: p.uti_devices ? p.uti_devices.split('\n').filter(Boolean) : [],
        utiCulturesAntibiotics: p.uti_cultures_antibiotics ? p.uti_cultures_antibiotics.split('\n').filter(Boolean) : [],
        utiSpecialties: p.uti_specialties ? p.uti_specialties.split('\n').filter(Boolean) : [],
        utiOriginSector: p.uti_origin_sector ? p.uti_origin_sector.split('\n').filter(Boolean) : [],
        utiDailyConducts: (p as any).uti_daily_conducts ? (p as any).uti_daily_conducts.split('\n').filter(Boolean) : [],
        displayOrder: p.display_order ?? 0,
        isDoorPatient: p.is_door_patient ?? false,
        allocationStatus: p.allocation_status as Patient['allocationStatus'],
        createdBy: p.created_by || undefined,
        psmStatus: p.psm_status as Patient['psmStatus'],
        clinicalStatus: (p as any).clinical_status as Patient['clinicalStatus'],
        isVacant: (p as any).is_vacant ?? false,
        admissionStatus: ((p as any).admission_status as Patient['admissionStatus']) ?? ((p as any).is_vacant ? undefined : 'admitido'),
        admittedAt: (p as any).admitted_at ?? null,
      }));

      // Sort by display_order first, then by bed_number as tiebreaker
      const sortedPatients = mappedPatients.sort((a, b) => {
        const orderDiff = (a.displayOrder || 0) - (b.displayOrder || 0);
        if (orderDiff !== 0) return orderDiff;
        // Tiebreaker: sort by bed number numerically
        const extractNumber = (bedNumber: string) => {
          const match = bedNumber.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };
        return extractNumber(a.bedNumber) - extractNumber(b.bedNumber);
      });

      setPatients(sortedPatients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Erro ao carregar pacientes",
        description: "Não foi possível carregar os dados dos pacientes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePatient = async (patientId: string, updates: Partial<Patient>) => {
    try {
      const dbUpdates: any = {};
      
      if (updates.bedNumber !== undefined) dbUpdates.bed_number = updates.bedNumber;
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.age !== undefined) dbUpdates.age = typeof updates.age === 'number' ? updates.age.toString() : updates.age;
      if (updates.sector !== undefined) dbUpdates.sector = updates.sector;
      if (updates.diagnoses !== undefined) dbUpdates.diagnoses = updates.diagnoses.join('\n');
      if (updates.medicalHistory !== undefined) dbUpdates.medical_history = updates.medicalHistory.join('\n');
      if (updates.relevantExams !== undefined) dbUpdates.relevant_exams = updates.relevantExams.join('\n');
      if (updates.pendencies !== undefined) dbUpdates.pendencies = updates.pendencies.join('\n');
      if (updates.highlightedPendencies !== undefined) dbUpdates.highlighted_pendencies = updates.highlightedPendencies;
      if (updates.highlightedDiagnoses !== undefined) dbUpdates.highlighted_diagnoses = updates.highlightedDiagnoses;
      if (updates.highlightedMedicalHistory !== undefined) dbUpdates.highlighted_medical_history = updates.highlightedMedicalHistory;
      if (updates.highlightedConducts !== undefined) dbUpdates.highlighted_conducts = updates.highlightedConducts;
      if (updates.schedule !== undefined) dbUpdates.schedule = updates.schedule.join('\n');
      if (updates.admissionHistory !== undefined) dbUpdates.admission_history = updates.admissionHistory || null;
      // admission_date é IMUTÁVEL via updatePatient genérico.
      // Só pode ser alterado por:
      //   1. createPatient (primeira admissão / alocação)
      //   2. AdmissionDateEditor (Edição Avançada, com auditoria em patient_admission_date_history)
      // Qualquer save do mapa de leitos (compacto/detalhado) NÃO toca admission_date.
      if (updates.medicalResponsibility !== undefined) dbUpdates.medical_responsibility = updates.medicalResponsibility;
      if (updates.displayOrder !== undefined) dbUpdates.display_order = updates.displayOrder;
      // UTI fields
      if (updates.utiAdmissionDate !== undefined) {
        // Convert DD/MM/YYYY format back to ISO format for database storage
        if (updates.utiAdmissionDate.length === 0) {
          dbUpdates.uti_admission_date = null;
        } else {
          dbUpdates.uti_admission_date = updates.utiAdmissionDate.map(date => {
            try {
              // Check if it's already in DD/MM/YYYY format
              const parts = date.split('/');
              if (parts.length === 3) {
                const [day, month, year] = parts;
                const isoDate = new Date(`${year}-${month}-${day}`);
                if (!isNaN(isoDate.getTime())) {
                  return isoDate.toISOString();
                }
              }
            } catch (e) {
              // If parsing fails, return as is
            }
            return date;
          }).join('\n');
        }
      }
      if (updates.utiDischargePrediction !== undefined) dbUpdates.uti_discharge_prediction = updates.utiDischargePrediction.length > 0 ? updates.utiDischargePrediction.join('\n') : null;
      if (updates.utiAllergies !== undefined) dbUpdates.uti_allergies = updates.utiAllergies.length > 0 ? updates.utiAllergies.join('\n') : null;
      if (updates.utiAdmissionReason !== undefined) dbUpdates.uti_admission_reason = updates.utiAdmissionReason.length > 0 ? updates.utiAdmissionReason.join('\n') : null;
      if (updates.utiCurrentStatus !== undefined) dbUpdates.uti_current_status = updates.utiCurrentStatus.length > 0 ? updates.utiCurrentStatus.join('\n') : null;
      if (updates.utiDevices !== undefined) dbUpdates.uti_devices = updates.utiDevices.length > 0 ? updates.utiDevices.join('\n') : null;
      if (updates.utiCulturesAntibiotics !== undefined) dbUpdates.uti_cultures_antibiotics = updates.utiCulturesAntibiotics.length > 0 ? updates.utiCulturesAntibiotics.join('\n') : null;
      if (updates.utiSpecialties !== undefined) dbUpdates.uti_specialties = updates.utiSpecialties.length > 0 ? updates.utiSpecialties.join('\n') : null;
      if (updates.utiOriginSector !== undefined) dbUpdates.uti_origin_sector = updates.utiOriginSector.length > 0 ? updates.utiOriginSector.join('\n') : null;
      if (updates.utiDailyConducts !== undefined) dbUpdates.uti_daily_conducts = updates.utiDailyConducts.length > 0 ? updates.utiDailyConducts.join('\n') : null;
      if (updates.psmStatus !== undefined) dbUpdates.psm_status = updates.psmStatus;
      if (updates.clinicalStatus !== undefined) dbUpdates.clinical_status = updates.clinicalStatus;
      if (updates.isVacant !== undefined) dbUpdates.is_vacant = updates.isVacant;

      console.log('Updating patient:', patientId, 'with data:', dbUpdates);

      const { error } = await supabase
        .from('patients')
        .update(dbUpdates)
        .eq('id', patientId);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      // Update local state
      setPatients(prev => prev.map(p => 
        p.id === patientId ? { ...p, ...updates } : p
      ));

      toast({
        title: "Paciente atualizado",
        description: "As informações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Error updating patient:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const createPatient = async (patient: Omit<Patient, 'id'>, departmentValue?: Department) => {
    try {
      if (!currentHospital || !currentState) {
        throw new Error('Hospital unit and state must be selected');
      }

      const dbData: any = {
        bed_number: patient.bedNumber,
        name: patient.name,
        age: typeof patient.age === 'number' ? patient.age.toString() : patient.age,
        sector: patient.sector,
        diagnoses: patient.diagnoses.join('\n'),
        medical_history: patient.medicalHistory.join('\n'),
        relevant_exams: patient.relevantExams.join('\n'),
        pendencies: patient.pendencies.join('\n'),
        highlighted_pendencies: patient.highlightedPendencies || [],
        schedule: patient.schedule.join('\n'),
        admission_history: patient.admissionHistory,
        admission_date: patient.admissionDate,
        department: departmentValue || department || 'URGÊNCIA E EMERGÊNCIA ADULTO',
        state_id: currentState.id,
        hospital_unit_id: currentHospital.id,
        medical_responsibility: patient.medicalResponsibility || null,
        created_by: user?.id || null,
      };

      // Add UTI fields if they exist
      if (patient.utiAdmissionDate && patient.utiAdmissionDate.length > 0) {
        dbData.uti_admission_date = patient.utiAdmissionDate.map(date => {
          try {
            const parts = date.split('/');
            if (parts.length === 3) {
              const [day, month, year] = parts;
              const isoDate = new Date(`${year}-${month}-${day}`);
              if (!isNaN(isoDate.getTime())) {
                return isoDate.toISOString();
              }
            }
          } catch (e) {
            // If parsing fails, return as is
          }
          return date;
        }).join('\n');
      }
      if (patient.utiDischargePrediction && patient.utiDischargePrediction.length > 0) dbData.uti_discharge_prediction = patient.utiDischargePrediction.join('\n');
      if (patient.utiAllergies && patient.utiAllergies.length > 0) dbData.uti_allergies = patient.utiAllergies.join('\n');
      if (patient.utiAdmissionReason && patient.utiAdmissionReason.length > 0) dbData.uti_admission_reason = patient.utiAdmissionReason.join('\n');
      if (patient.utiCurrentStatus && patient.utiCurrentStatus.length > 0) dbData.uti_current_status = patient.utiCurrentStatus.join('\n');
      if (patient.utiDevices && patient.utiDevices.length > 0) dbData.uti_devices = patient.utiDevices.join('\n');
      if (patient.utiCulturesAntibiotics && patient.utiCulturesAntibiotics.length > 0) dbData.uti_cultures_antibiotics = patient.utiCulturesAntibiotics.join('\n');
      if (patient.utiSpecialties && patient.utiSpecialties.length > 0) dbData.uti_specialties = patient.utiSpecialties.join('\n');
      if (patient.utiOriginSector && patient.utiOriginSector.length > 0) dbData.uti_origin_sector = patient.utiOriginSector.join('\n');
      if (patient.utiDailyConducts && patient.utiDailyConducts.length > 0) dbData.uti_daily_conducts = patient.utiDailyConducts.join('\n');

      const { data, error } = await supabase
        .from('patients')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;

      const newPatient: Patient = {
        id: data.id,
        bedNumber: data.bed_number,
        name: data.name || '',
        age: data.age || '',
        sector: data.sector as 'red' | 'yellow' | 'blue' | 'outside',
        diagnoses: data.diagnoses ? data.diagnoses.split('\n').filter(Boolean) : [],
        medicalHistory: data.medical_history ? data.medical_history.split('\n').filter(Boolean) : [],
        relevantExams: data.relevant_exams ? data.relevant_exams.split('\n').filter(Boolean) : [],
        pendencies: data.pendencies ? data.pendencies.split('\n').filter(Boolean) : [],
        highlightedPendencies: data.highlighted_pendencies || [],
        schedule: data.schedule ? data.schedule.split('\n').filter(Boolean) : [],
        admissionHistory: data.admission_history || '',
        admissionDate: data.admission_date || '',
        medicalResponsibility: (data.medical_responsibility as unknown) as Patient['medicalResponsibility'],
        // UTI fields
        utiAdmissionDate: data.uti_admission_date ? data.uti_admission_date.split('\n').filter(Boolean).map(date => {
          try {
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
              const day = String(parsedDate.getDate()).padStart(2, '0');
              const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
              const year = parsedDate.getFullYear();
              return `${day}/${month}/${year}`;
            }
          } catch (e) {
            // If parsing fails, return as is
          }
          return date;
        }) : [],
        utiDischargePrediction: data.uti_discharge_prediction ? data.uti_discharge_prediction.split('\n').filter(Boolean) : [],
        utiAllergies: data.uti_allergies ? data.uti_allergies.split('\n').filter(Boolean) : [],
        utiAdmissionReason: data.uti_admission_reason ? data.uti_admission_reason.split('\n').filter(Boolean) : [],
        utiCurrentStatus: data.uti_current_status ? data.uti_current_status.split('\n').filter(Boolean) : [],
        utiDevices: data.uti_devices ? data.uti_devices.split('\n').filter(Boolean) : [],
        utiCulturesAntibiotics: data.uti_cultures_antibiotics ? data.uti_cultures_antibiotics.split('\n').filter(Boolean) : [],
        utiSpecialties: data.uti_specialties ? data.uti_specialties.split('\n').filter(Boolean) : [],
        utiOriginSector: data.uti_origin_sector ? data.uti_origin_sector.split('\n').filter(Boolean) : [],
        utiDailyConducts: (data as any).uti_daily_conducts ? (data as any).uti_daily_conducts.split('\n').filter(Boolean) : [],
        createdBy: data.created_by || undefined,
        isVacant: (data as any).is_vacant ?? false,
      };

      // Add to local state immediately for instant UI update
      setPatients(prev => [...prev, newPatient]);

      toast({
        title: "Leito criado",
        description: `Leito ${newPatient.bedNumber} adicionado com sucesso.`,
      });

      return newPatient;
    } catch (error) {
      console.error('Error creating patient:', error);
      toast({
        title: "Erro ao criar leito",
        description: "Não foi possível adicionar o leito.",
        variant: "destructive",
      });
      throw error;
    }
  };

  // IMPORTANT: leitos são fixos. "Excluir" não remove a linha — apenas esvazia o paciente,
  // mantendo o leito disponível como vago no mapa. Assim, qualquer chamada antiga de
  // delete simplesmente desaloca o paciente.
  const deletePatient = async (patientId: string, options = { showToast: true, updateLocalState: true }) => {
    try {
      console.log('Vacating bed (clearing patient data) for:', patientId);

      const vacantPayload = {
        name: '',
        age: null as any,
        diagnoses: null,
        medical_history: null,
        relevant_exams: null,
        pendencies: null,
        schedule: null,
        admission_history: null,
        admission_date: null,
        medical_responsibility: null,
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
        internment_status: null,
        internment_notes: null,
        clinical_status: null,
        is_palliative: false,
        isolation_precautions: null,
        hospital_discharge_prediction: null,
        psm_status: null,
        allocation_status: null,
        is_door_patient: false,
        is_vacant: true,
        patient_registry_id: null,
        medical_record: null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('patients')
        .update(vacantPayload)
        .eq('id', patientId);

      if (error) {
        console.error('Supabase vacate error:', error);
        throw error;
      }

      if (options.updateLocalState) {
        setPatients(prev => prev.map(p => (
          p.id === patientId
            ? ({ ...p, name: '', diagnoses: [], medicalHistory: [], relevantExams: [], pendencies: [], schedule: [], admissionHistory: '' } as unknown as Patient)
            : p
        )));
      }

      if (options.showToast) {
        toast({
          title: "Leito desocupado",
          description: "Os dados do paciente foram removidos. O leito permanece disponível no mapa.",
        });
      }
    } catch (error) {
      console.error('Error vacating bed:', error);
      if (options.showToast) {
        toast({
          title: "Erro ao desocupar",
          description: "Não foi possível esvaziar o leito.",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  /**
   * Libera o leito de um paciente que ainda NÃO concluiu a admissão hospitalar
   * (admissionStatus === 'pre_admitido'). Diferente de `deletePatient`:
   *  - Registra a ação em `patient_movements` (movement_type = 'LIBERAÇÃO PRÉ-ADMISSÃO')
   *    com snapshot e vínculo ao prontuário, garantindo auditoria.
   *  - PRESERVA `patient_registry_id` no histórico do movimento — o prontuário
   *    do paciente continua existindo e pode ser reaberto a qualquer momento.
   *  - Zera apenas os campos clínicos do leito, deixando-o disponível para
   *    nova alocação no mapa.
   */
  const releaseBedPreAdmission = async (
    patientId: string,
    opts: { reason?: string; reasonNote?: string } = {},
  ) => {
    try {
      const target = patients.find((p) => p.id === patientId);
      const dbRow = target as any;
      if (!currentHospital || !currentState) {
        throw new Error('Hospital e estado precisam estar selecionados.');
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const patientDepartment = (dbRow?.department as string) || department || 'URGÊNCIA E EMERGÊNCIA ADULTO';

      // Busca o registro atual para snapshot + patient_registry_id
      const { data: full } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .maybeSingle();

      const isPostDischargeRelease =
        (full as any)?.admission_status === 'alta_dada' || (full as any)?.admission_status === 'obito';

      // 1) Audita a ação
      const reasonLabel = opts.reason || 'Liberação de pré-admissão';
      const noteLines = [reasonLabel, opts.reasonNote].filter(Boolean).join(' — ');
      const { error: movementError } = await supabase.from('patient_movements').insert({
        patient_id: patientId,
        patient_registry_id: (full as any)?.patient_registry_id ?? null,
        patient_name: (full as any)?.name || target?.name || '',
        patient_bed: (full as any)?.bed_number || target?.bedNumber || null,
        patient_sector: (full as any)?.sector || target?.sector || null,
        movement_type: isPostDischargeRelease ? 'LIBERAÇÃO PÓS-ALTA/ÓBITO' : 'LIBERAÇÃO PRÉ-ADMISSÃO',
        destination: 'PRONTUÁRIO PRESERVADO — LEITO LIBERADO',
        notes: noteLines || null,
        responsible_doctor: null,
        created_by: authUser?.id ?? null,
        patient_snapshot: full as any,
        department: patientDepartment,
        state_id: currentState.id,
        hospital_unit_id: currentHospital.id,
      });
      if (movementError) throw movementError;

      // 2) Zera os campos clínicos do leito (preserva o leito no mapa)
      const vacantPayload = {
        name: '',
        age: null as any,
        diagnoses: null,
        medical_history: null,
        relevant_exams: null,
        pendencies: null,
        schedule: null,
        admission_history: null,
        admission_date: null,
        medical_responsibility: null,
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
        internment_status: null,
        internment_notes: null,
        clinical_status: null,
        is_palliative: false,
        isolation_precautions: null,
        hospital_discharge_prediction: null,
        psm_status: null,
        allocation_status: null,
        is_door_patient: false,
        is_vacant: true,
        // Importante: zeramos os ponteiros no leito, mas o registry continua intacto no banco
        patient_registry_id: null,
        medical_record: null,
        admission_status: null,
        admitted_at: null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('patients')
        .update(vacantPayload)
        .eq('id', patientId);
      if (error) throw error;

      setPatients((prev) =>
        prev.map((p) =>
          p.id === patientId
            ? ({
                ...p,
                name: '',
                diagnoses: [],
                medicalHistory: [],
                relevantExams: [],
                pendencies: [],
                schedule: [],
                admissionHistory: '',
                age: '',
                medicalResponsibility: undefined,
                utiAdmissionDate: [],
                utiDischargePrediction: [],
                utiAllergies: [],
                utiAdmissionReason: [],
                utiCurrentStatus: [],
                utiDevices: [],
                utiCulturesAntibiotics: [],
                utiSpecialties: [],
                utiOriginSector: [],
                utiDailyConducts: [],
                psmStatus: null,
                clinicalStatus: null,
                admissionDate: '',
                admissionStatus: undefined,
                admittedAt: null,
                isVacant: true,
              } as unknown as Patient)
            : p,
        ),
      );

      toast({
        title: 'Leito liberado',
        description: isPostDischargeRelease
          ? 'Leito desocupado no mapa. O prontuário do paciente foi preservado e continua disponível no histórico.'
          : 'Pré-admissão removida do mapa. O prontuário do paciente foi preservado e continua disponível no histórico.',
      });
    } catch (error) {
      console.error('Error releasing pre-admission bed:', error);
      toast({
        title: 'Erro ao liberar leito',
        description: 'Não foi possível liberar a pré-admissão.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const reorderPatients = async (reorderedPatients: Patient[]) => {
    // Update display_order for each patient based on new position
    const updates = reorderedPatients.map((patient, index) => ({
      id: patient.id,
      display_order: index,
    }));

    // Update local state IMMEDIATELY (optimistic update)
    setPatients(prev => {
      const updatedPatients = prev.map(p => {
        const orderUpdate = updates.find(u => u.id === p.id);
        return orderUpdate ? { ...p, displayOrder: orderUpdate.display_order } : p;
      });
      return updatedPatients.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    });

    // Persist to database in parallel (background)
    try {
      await Promise.all(
        updates.map(update =>
          supabase
            .from('patients')
            .update({ display_order: update.display_order })
            .eq('id', update.id)
        )
      );
    } catch (error) {
      console.error('Error persisting reorder:', error);
      toast({
        title: "Erro ao reordenar",
        description: "Não foi possível salvar a nova ordem.",
        variant: "destructive",
      });
    }
  };

  // Helper function to map database record to Patient object
  const mapRecordToPatient = (record: any): Patient => ({
    id: record.id,
    bedNumber: record.bed_number,
    name: record.name || '',
    age: record.age || '',
    sector: record.sector as 'red' | 'yellow' | 'blue' | 'outside',
    diagnoses: record.diagnoses ? record.diagnoses.split('\n').filter(Boolean) : [],
    medicalHistory: record.medical_history ? record.medical_history.split('\n').filter(Boolean) : [],
    relevantExams: record.relevant_exams ? record.relevant_exams.split('\n').filter(Boolean) : [],
    pendencies: record.pendencies ? record.pendencies.split('\n').filter(Boolean) : [],
    highlightedPendencies: record.highlighted_pendencies || [],
    highlightedDiagnoses: record.highlighted_diagnoses || [],
    highlightedMedicalHistory: record.highlighted_medical_history || [],
    highlightedConducts: record.highlighted_conducts || [],
    schedule: record.schedule ? record.schedule.split('\n').filter(Boolean) : [],
    admissionHistory: record.admission_history || '',
    admissionDate: record.admission_date || '',
    medicalResponsibility: (record.medical_responsibility as unknown) as Patient['medicalResponsibility'],
    utiAdmissionDate: record.uti_admission_date ? record.uti_admission_date.split('\n').filter(Boolean).map((date: string) => {
      try {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          const day = String(parsedDate.getDate()).padStart(2, '0');
          const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const year = parsedDate.getFullYear();
          return `${day}/${month}/${year}`;
        }
      } catch (e) {}
      return date;
    }) : [],
    utiDischargePrediction: record.uti_discharge_prediction ? record.uti_discharge_prediction.split('\n').filter(Boolean) : [],
    utiAllergies: record.uti_allergies ? record.uti_allergies.split('\n').filter(Boolean) : [],
    utiAdmissionReason: record.uti_admission_reason ? record.uti_admission_reason.split('\n').filter(Boolean) : [],
    utiCurrentStatus: record.uti_current_status ? record.uti_current_status.split('\n').filter(Boolean) : [],
    utiDevices: record.uti_devices ? record.uti_devices.split('\n').filter(Boolean) : [],
    utiCulturesAntibiotics: record.uti_cultures_antibiotics ? record.uti_cultures_antibiotics.split('\n').filter(Boolean) : [],
    utiSpecialties: record.uti_specialties ? record.uti_specialties.split('\n').filter(Boolean) : [],
    utiOriginSector: record.uti_origin_sector ? record.uti_origin_sector.split('\n').filter(Boolean) : [],
    utiDailyConducts: record.uti_daily_conducts ? record.uti_daily_conducts.split('\n').filter(Boolean) : [],
    displayOrder: record.display_order ?? 0,
    isDoorPatient: record.is_door_patient ?? false,
    allocationStatus: record.allocation_status as Patient['allocationStatus'],
    createdBy: record.created_by || undefined,
    psmStatus: record.psm_status as Patient['psmStatus'],
    clinicalStatus: record.clinical_status as Patient['clinicalStatus'],
    isVacant: record.is_vacant ?? false,
    admissionStatus: (record.admission_status as Patient['admissionStatus']) ?? (record.is_vacant ? undefined : 'admitido'),
    admittedAt: record.admitted_at ?? null,
  });

  useEffect(() => {
    if (!currentHospital || !currentState) return;

    fetchPatients();

    // Subscribe to realtime changes with simplified filter
    const channelName = `patients-changes-${currentHospital.id}-${sector || department || 'all'}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patients',
          filter: `hospital_unit_id=eq.${currentHospital.id}`,
        },
        (payload) => {
          console.log('Realtime patient change:', payload.eventType, payload);
          
          const eventType = payload.eventType;
          
          if (eventType === 'INSERT') {
            const newRecord = payload.new as any;
            if (sector && newRecord.sector !== sector) return;
            if (!sector && department && newRecord.department !== department) return;
            
            const newPatient = mapRecordToPatient(newRecord);
            setPatients(prev => {
              if (prev.some(p => p.id === newPatient.id)) return prev;
              return [...prev, newPatient].sort((a, b) => {
                const orderDiff = (a.displayOrder || 0) - (b.displayOrder || 0);
                if (orderDiff !== 0) return orderDiff;
                const extractNum = (bn: string) => { const m = bn.match(/\d+/); return m ? parseInt(m[0], 10) : 0; };
                return extractNum(a.bedNumber) - extractNum(b.bedNumber);
              });
            });
          } else if (eventType === 'UPDATE') {
            const updatedRecord = payload.new as any;
            if (sector && updatedRecord.sector !== sector) {
              setPatients(prev => prev.filter(p => p.id !== updatedRecord.id));
              return;
            }
            if (!sector && department && updatedRecord.department !== department) {
              setPatients(prev => prev.filter(p => p.id !== updatedRecord.id));
              return;
            }
            
            const updatedPatient = mapRecordToPatient(updatedRecord);
            setPatients(prev => {
              // Check if patient exists in current list
              const exists = prev.some(p => p.id === updatedPatient.id);
              if (exists) {
                // Update in-place without re-sorting to preserve current position
                return prev.map(p => p.id === updatedPatient.id ? updatedPatient : p);
              } else {
                // Patient was moved to this department, add to list and sort
                const sortFn = (a: Patient, b: Patient) => {
                  const orderDiff = (a.displayOrder || 0) - (b.displayOrder || 0);
                  if (orderDiff !== 0) return orderDiff;
                  const extractNum = (bn: string) => { const m = bn.match(/\d+/); return m ? parseInt(m[0], 10) : 0; };
                  return extractNum(a.bedNumber) - extractNum(b.bedNumber);
                };
                return [...prev, updatedPatient].sort(sortFn);
              }
            });
          } else if (eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setPatients(prev => prev.filter(p => p.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        console.log('Patients realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [department, sector, currentHospital, currentState]);

  return {
    patients,
    isLoading,
    updatePatient,
    createPatient,
    deletePatient,
    releaseBedPreAdmission,
    reorderPatients,
    refetch: fetchPatients,
  };
}
