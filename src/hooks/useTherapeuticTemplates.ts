import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * MIGRAÇÃO: therapeutic_templates → modelos (tipo='protocolo_terapeutico').
 * Mapeamento de colunas:
 *   name→nome, protocol_type→tipo_protocolo, description→descricao,
 *   items→itens (Json), hospital_unit_id→hospital_id, created_by→criado_por
 *   (profissionais.id, resolvido via user_id), created_at→criado_em,
 *   updated_at→atualizado_em, is_global→escopo ('global' vs 'local').
 * DEGRADADO: state_id não tem coluna equivalente em modelos → sempre null.
 * A interface exportada `TherapeuticTemplate` é preservada.
 */

const TIPO_MODELO = "protocolo_terapeutico";

export interface TherapeuticTemplate {
  id: string;
  name: string;
  protocol_type: string;
  description: string | null;
  items: string[];
  hospital_unit_id: string | null;
  state_id: string | null;
  is_global: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

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

function mapModelo(m: any): TherapeuticTemplate {
  return {
    id: m.id,
    name: m.nome,
    protocol_type: m.tipo_protocolo ?? "",
    description: m.descricao ?? null,
    items: Array.isArray(m.itens) ? m.itens : [],
    hospital_unit_id: m.hospital_id ?? null,
    state_id: null, // DEGRADADO: sem coluna em modelos
    is_global: m.escopo === "global",
    created_by: m.criado_por ?? null,
    created_at: m.criado_em,
    updated_at: m.atualizado_em,
  };
}

export function useTherapeuticTemplates() {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["therapeutic-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modelos")
        .select("*")
        .eq("tipo", TIPO_MODELO)
        .order("tipo_protocolo", { ascending: true });
      if (error) throw error;
      return (data || []).map(mapModelo);
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Omit<TherapeuticTemplate, "id" | "created_at" | "updated_at">) => {
      // created_by chega como auth user id → resolver para profissionais.id.
      const criadoPor = await resolveProfissionalId(template.created_by);
      const { error } = await supabase
        .from("modelos")
        .insert({
          tipo: TIPO_MODELO,
          nome: template.name,
          tipo_protocolo: template.protocol_type,
          descricao: template.description,
          itens: template.items as any,
          hospital_id: template.hospital_unit_id,
          escopo: template.is_global ? "global" : "local",
          criado_por: criadoPor,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["therapeutic-templates"] });
      toast.success("Template criado com sucesso");
    },
    onError: () => toast.error("Erro ao criar template"),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...data }: Partial<TherapeuticTemplate> & { id: string }) => {
      const updateData: any = {};
      if (data.name !== undefined) updateData.nome = data.name;
      if (data.protocol_type !== undefined) updateData.tipo_protocolo = data.protocol_type;
      if (data.description !== undefined) updateData.descricao = data.description;
      if (data.items !== undefined) updateData.itens = data.items;
      if (data.is_global !== undefined) updateData.escopo = data.is_global ? "global" : "local";

      const { error } = await supabase
        .from("modelos")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["therapeutic-templates"] });
      toast.success("Template atualizado");
    },
    onError: () => toast.error("Erro ao atualizar template"),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("modelos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["therapeutic-templates"] });
      toast.success("Template removido");
    },
    onError: () => toast.error("Erro ao remover template"),
  });

  return { templates, isLoading, createTemplate, updateTemplate, deleteTemplate };
}
