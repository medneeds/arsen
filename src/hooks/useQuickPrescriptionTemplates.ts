import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface QuickTemplateItem {
  name: string;
  presentation?: string;
  dose?: string;
  route?: string;
  posology?: string;
  schedule?: string;
  instructions?: string;
  category: string;
  flags?: string[];
  highAlert?: boolean;
  diluent?: string;
  diluentVolume?: string;
  infusionTime?: string;
  quantity?: string;
  quantityUnit?: string;
  [key: string]: any;
}

export interface QuickPrescriptionTemplate {
  id: string;
  name: string;
  description: string | null;
  clinical_category: string;
  items: QuickTemplateItem[];
  scope: "personal" | "shared";
  created_by: string | null;
  hospital_unit_id: string | null;
  state_id: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useQuickPrescriptionTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<QuickPrescriptionTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prescription_quick_templates" as any)
        .select("*")
        .order("use_count", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      setTemplates(((data as any[]) || []).map((r) => ({
        ...r,
        items: Array.isArray(r.items) ? r.items : [],
      })) as QuickPrescriptionTemplate[]);
    } catch (err: any) {
      console.error("[quickTemplates] load error", err);
      toast.error("Erro ao carregar templates", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveTemplate = useCallback(
    async (input: {
      name: string;
      description?: string;
      clinical_category?: string;
      items: QuickTemplateItem[];
      scope: "personal" | "shared";
      hospital_unit_id?: string | null;
      state_id?: string | null;
    }) => {
      if (!user) {
        toast.error("Usuário não autenticado");
        return null;
      }
      try {
        const { data, error } = await supabase
          .from("prescription_quick_templates" as any)
          .insert({
            name: input.name.trim(),
            description: input.description?.trim() || null,
            clinical_category: input.clinical_category || "geral",
            items: input.items as any,
            scope: input.scope,
            created_by: user.id,
            hospital_unit_id: input.hospital_unit_id || null,
            state_id: input.state_id || null,
          })
          .select()
          .single();
        if (error) throw error;
        toast.success("Template salvo", { description: input.name });
        await load();
        return data as any;
      } catch (err: any) {
        toast.error("Erro ao salvar template", { description: err.message });
        return null;
      }
    },
    [user, load],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("prescription_quick_templates" as any)
          .delete()
          .eq("id", id);
        if (error) throw error;
        toast.success("Template excluído");
        await load();
      } catch (err: any) {
        toast.error("Erro ao excluir template", { description: err.message });
      }
    },
    [load],
  );

  const bumpUseCount = useCallback(async (id: string) => {
    try {
      await supabase.rpc("bump_quick_template_use" as any, { _template_id: id });
    } catch {
      // best-effort
    }
  }, []);

  return { templates, loading, reload: load, saveTemplate, deleteTemplate, bumpUseCount };
}
