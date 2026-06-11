import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ReceituarioData } from "@/lib/receituario";
import { toast } from "sonner";

/**
 * Hook para criar, ler, atualizar e listar receituários de um paciente.
 * Busca por patient_id (quando disponível) ou por patient_name.
 */
export function useReceituario(
  patientId?: string | null,
  patientName?: string | null,
) {
  const { user } = useAuth();
  const [receituarios, setReceituarios] = useState<ReceituarioData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientId && !patientName) return;
    setLoading(true);
    try {
      let q = supabase
        .from("receituarios")
        .select("*")
        .order("created_at", { ascending: false });

      if (patientId) {
        q = q.eq("patient_id", patientId);
      } else if (patientName) {
        q = q.ilike("patient_name", `%${patientName}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      setReceituarios((data ?? []) as unknown as ReceituarioData[]);
    } catch (err: any) {
      toast.error("Erro ao carregar receituários", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [patientId, patientName]);

  useEffect(() => { fetch(); }, [fetch]);

  /** Salva um novo receituário. Retorna o id criado. */
  const save = useCallback(async (data: ReceituarioData): Promise<string | null> => {
    try {
      const payload = {
        type: data.type,
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

      const { data: row, error } = await supabase
        .from("receituarios")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;
      toast.success("Receituário salvo");
      await fetch();
      return row?.id ?? null;
    } catch (err: any) {
      toast.error("Erro ao salvar receituário", { description: err.message });
      return null;
    }
  }, [user, fetch]);

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
