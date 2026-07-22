import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useResolvedRegistryId } from "@/hooks/useResolvedRegistryId";
import type { ReceituarioData } from "@/lib/receituario";
import { toast } from "sonner";
import { resolveActiveEncounterId } from "@/lib/resolveActiveEncounter";

/**
 * Hook para criar, ler, atualizar e listar receituários de um paciente.
 * Busca por patient_registry_id (vínculo estável — segue o paciente entre
 * leitos) com fallback para patient_id/patient_name. Antes buscava só por
 * patient_id (linha-leito): após uma transferência interna, o receituário
 * ficava invisível no leito novo. Auditoria 22/07/2026.
 */
export function useReceituario(
  patientId?: string | null,
  patientName?: string | null,
) {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const { registryId: resolvedRegistryId } = useResolvedRegistryId(patientId || null);
  const [receituarios, setReceituarios] = useState<ReceituarioData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientId && !patientName) return;
    setLoading(true);
    try {
      // Busca primária por patient_id (coluna garantida). O vínculo por
      // patient_registry_id (segue o paciente entre leitos) é aplicado só se a
      // coluna existir no banco — senão cai para patient_id sem quebrar.
      // Migration 20260722150000 adiciona a coluna; enquanto não aplicada, o
      // fallback mantém a tela funcionando. (Correção 22/07/2026.)
      const runQuery = async (useRegistry: boolean) => {
        let q = supabase
          .from("receituarios")
          .select("*")
          .order("created_at", { ascending: false });
        if (useRegistry && resolvedRegistryId && patientId) {
          q = q.or(`patient_registry_id.eq.${resolvedRegistryId},and(patient_registry_id.is.null,patient_id.eq.${patientId})`);
        } else if (patientId) {
          q = q.eq("patient_id", patientId);
        } else if (patientName) {
          q = q.ilike("patient_name", `%${patientName}%`);
        }
        return q;
      };

      let { data, error } = await runQuery(true);
      // 42703 = undefined_column → a coluna patient_registry_id ainda não existe
      // neste banco. Refaz a busca só por patient_id, sem erro para o usuário.
      if (error && (error.code === "42703" || /patient_registry_id.*does not exist/i.test(error.message))) {
        ({ data, error } = await runQuery(false));
      }
      if (error) throw error;
      setReceituarios((data ?? []) as unknown as ReceituarioData[]);
    } catch (err: any) {
      toast.error("Erro ao carregar receituários", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [patientId, patientName, resolvedRegistryId]);

  useEffect(() => { fetch(); }, [fetch]);

  /** Salva um novo receituário. Retorna o id criado. */
  const save = useCallback(async (data: ReceituarioData): Promise<string | null> => {
    try {
      if (!currentHospital?.id) {
        toast.error("Selecione a unidade hospitalar antes de salvar o receituário");
        return null;
      }
      const payload: Record<string, any> = {
        type: data.type,
        hospital_unit_id: currentHospital.id,
        patient_id: data.patient_id ?? null,
        patient_name: data.patient_name,
        patient_bed: data.patient_bed ?? null,
        patient_sector: data.patient_sector ?? null,
        items: data.items as any,
        free_text: data.free_text ?? null,
        signed_by_name: data.signed_by_name ?? null,
        signed_by_crm: data.signed_by_crm ?? null,
        created_by: user?.id ?? null,
      };
      // Carimba o vínculo estável (segue o paciente entre leitos) — igual às
      // demais tabelas clínicas. Só inclui se resolvido; a coluna existe no
      // banco a partir da migration 20260722150000. (22/07/2026.)
      if (resolvedRegistryId) payload.patient_registry_id = resolvedRegistryId;
      if (data.patient_id) {
        const encId = await resolveActiveEncounterId(data.patient_id);
        if (encId) payload.encounter_id = encId;
      }

      const insertReceituario = async (p: Record<string, any>) =>
        supabase.from("receituarios").insert(p as any).select("id").single();

      let { data: row, error } = await insertReceituario(payload);
      // Se a coluna registry/encounter ainda não existe neste banco (42703),
      // remove os campos novos e reinsere — o save nunca falha por isso.
      if (error && (error.code === "42703" || /patient_registry_id|encounter_id/i.test(error.message))) {
        const { patient_registry_id, encounter_id, ...legacy } = payload;
        ({ data: row, error } = await insertReceituario(legacy));
      }

      if (error) throw error;
      toast.success("Receituário salvo");
      await fetch();
      return row?.id ?? null;
    } catch (err: any) {
      toast.error("Erro ao salvar receituário", { description: err.message });
      return null;
    }
  }, [user, currentHospital, fetch]);

  /** Atualiza um receituário existente. */
  const update = useCallback(async (id: string, data: Partial<ReceituarioData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("receituarios")
        .update({
          items: data.items as any,
          free_text: data.free_text ?? null,
          signed_by_name: data.signed_by_name ?? null,
          signed_by_crm: data.signed_by_crm ?? null,
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Receituário atualizado");
      await fetch();
      return true;
    } catch (err: any) {
      toast.error("Erro ao atualizar receituário", { description: err.message });
      return false;
    }
  }, [fetch]);

  return { receituarios, loading, save, update, refresh: fetch };
}