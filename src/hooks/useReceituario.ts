import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useResolvedRegistryId } from "@/hooks/useResolvedRegistryId";
import type { ReceituarioData } from "@/lib/receituario";
import { toast } from "sonner";
import { asUuidOrNull } from "@/lib/utils";

/**
 * Hook para criar, ler, atualizar e listar receituários de um paciente.
 *
 * MIGRAÇÃO: `receituarios` (mesmo nome) migrou para o schema novo. `patientId`
 * é `internacoes.id`. Colunas: type→tipo, patient_id→internacao_id,
 * patient_registry_id→paciente_id (resolvido via internacoes),
 * hospital_unit_id→hospital_id, items→itens, free_text→texto_livre,
 * signed_by_name→assinado_por_nome, signed_by_crm→assinado_por_crm,
 * created_by→criado_por (profissionais.id, ≠ auth.uid), created_at→criado_em,
 * updated_at→atualizado_em.
 *
 * DEGRADADO (sem coluna no schema novo): patient_name/patient_bed/patient_sector
 * não são persistidos (o cabeçalho do impresso é reconstruído pelo chamador);
 * encounter_id descontinuado (a internação É o atendimento); busca por nome
 * (ilike patient_name) removida. A "busca que segue o paciente entre leitos"
 * agora usa paciente_id.
 */

/** Resolve profissionais.id a partir do auth user id (criado_por ≠ auth.uid). */
async function resolveProfissionalId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from("profissionais")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

function mapRow(r: any, fallbackName?: string | null): ReceituarioData {
  return {
    id: r.id,
    type: r.tipo,
    patient_id: r.internacao_id ?? null,
    patient_name: fallbackName ?? "", // DEGRADADO: não persistido em receituarios
    patient_bed: undefined,           // DEGRADADO: sem coluna
    patient_sector: undefined,        // DEGRADADO: sem coluna
    items: Array.isArray(r.itens) ? r.itens : [],
    free_text: r.texto_livre ?? undefined,
    signed_by_name: r.assinado_por_nome ?? undefined,
    signed_by_crm: r.assinado_por_crm ?? undefined,
    created_at: r.criado_em,
    updated_at: r.atualizado_em,
  };
}

export function useReceituario(
  patientId?: string | null,
  patientName?: string | null,
) {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  // registryId aqui = paciente_id (identidade permanente) resolvido da internação.
  const { registryId: resolvedRegistryId } = useResolvedRegistryId(patientId || null);
  const [receituarios, setReceituarios] = useState<ReceituarioData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      // Vínculo estável por paciente_id (segue o paciente entre internações)
      // quando resolvido; senão pela própria internação.
      let q = supabase
        .from("receituarios")
        .select("*")
        .order("criado_em", { ascending: false });
      if (resolvedRegistryId) {
        q = q.eq("paciente_id", resolvedRegistryId);
      } else {
        q = q.eq("internacao_id", patientId);
      }
      const { data, error } = await q;
      if (error) throw error;
      setReceituarios((data ?? []).map((r) => mapRow(r, patientName)));
    } catch (err: any) {
      toast.error("Não foi possível carregar receituários", { description: err.message });
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
      const criadoPor = await resolveProfissionalId(user?.id);
      const payload: Record<string, any> = {
        tipo: data.type,
        hospital_id: currentHospital.id,
        internacao_id: asUuidOrNull(data.patient_id || "") ?? asUuidOrNull(patientId || ""),
        paciente_id: resolvedRegistryId ?? null,
        itens: data.items as any,
        texto_livre: data.free_text ?? null,
        assinado_por_nome: data.signed_by_name ?? null,
        assinado_por_crm: data.signed_by_crm ?? null,
        criado_por: criadoPor,
      };

      const { data: row, error } = await supabase
        .from("receituarios")
        .insert(payload as any)
        .select("id")
        .single();

      if (error) throw error;
      toast.success("Receituário salvo");
      await fetch();
      return row?.id ?? null;
    } catch (err: any) {
      toast.error("Não foi possível salvar receituário", { description: err.message });
      return null;
    }
  }, [user, currentHospital, resolvedRegistryId, patientId, fetch]);

  /** Atualiza um receituário existente. */
  const update = useCallback(async (id: string, data: Partial<ReceituarioData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("receituarios")
        .update({
          itens: data.items as any,
          texto_livre: data.free_text ?? null,
          assinado_por_nome: data.signed_by_name ?? null,
          assinado_por_crm: data.signed_by_crm ?? null,
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Receituário atualizado");
      await fetch();
      return true;
    } catch (err: any) {
      toast.error("Não foi possível atualizar receituário", { description: err.message });
      return false;
    }
  }, [fetch]);

  return { receituarios, loading, save, update, refresh: fetch };
}