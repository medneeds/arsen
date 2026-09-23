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

// MIGRAÇÃO: `patient_versions` (tabela morta) → `logs_auditoria` com
// tipo_evento = 'versao_paciente'. O snapshot da lista de pacientes e a
// descrição/departamento ficam guardados em `dados_novos` (Json). Campos sem
// coluna equivalente foram degradados:
//  - `department` (filtro): logs_auditoria não tem coluna department; guardado
//    dentro de `dados_novos.department` mas NÃO usado para filtrar (best-effort
//    em memória, para não perder o dado).
//  - `state_id`/`hospital_unit_id`: substituídos por `logs_auditoria.hospital_id`.
const VERSAO_TIPO_EVENTO = 'versao_paciente';

export function usePatientVersions() {
  const [versions, setVersions] = useState<PatientVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { currentHospital } = useHospital();

  const mapRow = (row: any): PatientVersion => {
    const dados = (row?.dados_novos as any) || {};
    return {
      id: row.id,
      created_at: row.criado_em,
      created_by: row.ator_user_id ?? null,
      description: dados.description || row.motivo || '',
      snapshot_data: (dados.snapshot as Patient[]) || [],
    };
  };

  const fetchVersions = async (department?: string) => {
    try {
      setIsLoading(true);

      if (!currentHospital) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('logs_auditoria')
        .select('*')
        .eq('tipo_evento', VERSAO_TIPO_EVENTO)
        .eq('hospital_id', currentHospital.id)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      let mappedVersions: PatientVersion[] = ((data || []) as any[]).map(mapRow);

      // MIGRAÇÃO: sem coluna `department` em logs_auditoria — filtro best-effort
      // pelo valor guardado em dados_novos.department.
      if (department) {
        mappedVersions = mappedVersions.filter((_v, i) => {
          const dep = ((data as any[])[i]?.dados_novos as any)?.department;
          return dep === undefined || dep === department;
        });
      }

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

      if (!currentHospital) {
        throw new Error("Hospital unit and state must be selected");
      }

      const description = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

      // MIGRAÇÃO (profissionais.id ≠ auth.uid): resolve profissional_id via user_id.
      const { data: prof } = await supabase
        .from('profissionais')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data, error } = await supabase
        .from('logs_auditoria')
        .insert({
          tipo_evento: VERSAO_TIPO_EVENTO,
          nome_tabela: 'internacoes',
          ator_user_id: user.id,
          profissional_id: (prof as any)?.id ?? null,
          hospital_id: currentHospital.id,
          motivo: description,
          dados_novos: { snapshot: patients, department, description } as any,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const newVersion: PatientVersion = mapRow(data);

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
        .from('logs_auditoria')
        .delete()
        .eq('id', versionId)
        .eq('tipo_evento', VERSAO_TIPO_EVENTO);

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
