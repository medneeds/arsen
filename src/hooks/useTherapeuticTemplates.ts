import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function useTherapeuticTemplates() {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["therapeutic-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapeutic_templates")
        .select("*")
        .order("protocol_type", { ascending: true });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        items: Array.isArray(t.items) ? t.items : [],
      })) as TherapeuticTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Omit<TherapeuticTemplate, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase
        .from("therapeutic_templates")
        .insert({
          name: template.name,
          protocol_type: template.protocol_type,
          description: template.description,
          items: template.items as any,
          hospital_unit_id: template.hospital_unit_id,
          state_id: template.state_id,
          is_global: template.is_global,
          created_by: template.created_by,
        });
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
      if (data.name !== undefined) updateData.name = data.name;
      if (data.protocol_type !== undefined) updateData.protocol_type = data.protocol_type;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.items !== undefined) updateData.items = data.items;
      if (data.is_global !== undefined) updateData.is_global = data.is_global;
      
      const { error } = await supabase
        .from("therapeutic_templates")
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
        .from("therapeutic_templates")
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
