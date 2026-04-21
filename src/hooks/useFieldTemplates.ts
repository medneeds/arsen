import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FieldTemplate {
  id: string;
  user_id: string;
  scope: string;
  name: string;
  body: string;
  is_shared: boolean;
  hospital_unit_id: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Modelos de texto por campo (escopo livre, ex.: "evolution.subjective").
 * Cada usuário vê seus próprios + os marcados como compartilhados.
 */
export function useFieldTemplates(scope: string) {
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["field-templates", scope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_text_templates")
        .select("*")
        .eq("scope", scope)
        .order("use_count", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FieldTemplate[];
    },
    enabled: !!scope,
  });

  const create = useMutation({
    mutationFn: async (input: { name: string; body: string; is_shared?: boolean; hospital_unit_id?: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sem sessão");
      const { error } = await supabase.from("field_text_templates").insert({
        user_id: uid,
        scope,
        name: input.name.trim(),
        body: input.body,
        is_shared: !!input.is_shared,
        hospital_unit_id: input.hospital_unit_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["field-templates", scope] });
      toast.success("Modelo salvo");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar modelo"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("field_text_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["field-templates", scope] });
      toast.success("Modelo removido");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const touch = useMutation({
    mutationFn: async (t: FieldTemplate) => {
      // Apenas o dono pode atualizar (RLS bloqueia outros). Silencioso em caso de erro.
      const { error } = await supabase
        .from("field_text_templates")
        .update({ use_count: (t.use_count ?? 0) + 1, last_used_at: new Date().toISOString() })
        .eq("id", t.id);
      if (error) {
        // ignora 401/permissão para modelos compartilhados de outros usuários
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["field-templates", scope] });
    },
  });

  return { templates, isLoading, create, remove, touch };
}
