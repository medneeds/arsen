import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Patient } from "@/types/patient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useHospital } from "@/contexts/HospitalContext";

export interface PatientVersion {
  id: string;
  created_at: string;
  created_by: string | null;
  description: string;
  snapshot_data: Patient[];
}

export function usePatientVersions() {
  const [versions, setVersions] = useState<PatientVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { currentState, currentHospital } = useHospital();

  const fetchVersions = async (department?: string) => {
    try {
      setIsLoading(true);

      if (!currentHospital || !currentState) {
        setIsLoading(false);
        return;
      }
      
      let query = supabase
        .from('patient_versions')
        .select('*')
        .eq('hospital_unit_id', currentHospital.id)
        .eq('state_id', currentState.id)
        .order('created_at', { ascending: false });
      
      if (department) {
        query = query.eq('department', department);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mappedVersions: PatientVersion[] = (data || []).map(v => ({
        id: v.id,
        created_at: v.created_at,
        created_by: v.created_by,
        description: v.description,
        snapshot_data: v.snapshot_data as unknown as Patient[],
      }));

      setVersions(mappedVersions);
    } catch (error) {
      console.error('Error fetching versions:', error);
      toast({
        title: "Erro ao carregar versões",
        description: "Não foi possível carregar as versões salvas.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveVersion = async (patients: Patient[], department: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      if (!currentHospital || !currentState) {
        throw new Error("Hospital unit and state must be selected");
      }

      const description = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

      const { data, error } = await supabase
        .from('patient_versions')
        .insert({
          created_by: user.id,
          description,
          snapshot_data: patients as any,
          department: department,
          state_id: currentState.id,
          hospital_unit_id: currentHospital.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newVersion: PatientVersion = {
        id: data.id,
        created_at: data.created_at,
        created_by: data.created_by,
        description: data.description,
        snapshot_data: data.snapshot_data as unknown as Patient[],
      };

      setVersions(prev => [newVersion, ...prev]);

      toast({
        title: "Versão salva",
        description: `Versão de ${description} salva com sucesso.`,
      });

      return data;
    } catch (error) {
      console.error('Error saving version:', error);
      toast({
        title: "Erro ao salvar versão",
        description: "Não foi possível salvar a versão.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteVersion = async (versionId: string) => {
    try {
      const { error } = await supabase
        .from('patient_versions')
        .delete()
        .eq('id', versionId);

      if (error) throw error;

      setVersions(prev => prev.filter(v => v.id !== versionId));

      toast({
        title: "Versão deletada",
        description: "A versão foi removida com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting version:', error);
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover a versão.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    versions,
    isLoading,
    fetchVersions,
    saveVersion,
    deleteVersion,
  };
}
