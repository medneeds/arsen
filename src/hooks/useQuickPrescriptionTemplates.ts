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

// MIGRAÇÃO: `prescription_quick_templates` (morta) → `modelos` (tipo='prescricao_rapida').
// Mapa de colunas: name→nome, description→descricao, clinical_category→categoria_clinica,
// items→itens(Json), scope→escopo ('shared'→'global' | 'personal'→'pessoal'),
// created_by(auth.uid)→criado_por(profissionais.id, resolvido), use_count→contagem_uso,
// last_used_at→ultimo_uso_em. DEGRADADO: state_id (sem coluna); hospital_unit_id→hospital_id.
const TIPO = "prescricao_rapida";

async function resolveProfissionalId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase.from("profissionais").select("id").eq("user_id", userId).maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

function mapRow(r: any): QuickPrescriptionTemplate {
  return {
    id: r.id,
    name: r.nome,
    description: r.descricao ?? null,
    clinical_category: r.categoria_clinica ?? "geral",
    items: Array.isArray(r.itens) ? r.itens : [],
    scope: r.escopo === "global" ? "shared" : "personal",
    created_by: r.criado_por ?? null,
    hospital_unit_id: r.hospital_id ?? null,
    state_id: null, // MIGRAÇÃO: sem coluna state_id em modelos
    use_count: r.contagem_uso ?? 0,
    last_used_at: r.ultimo_uso_em ?? null,
    created_at: r.criado_em,
    updated_at: r.atualizado_em,
  };
}

export function useQuickPrescriptionTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<QuickPrescriptionTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("modelos")
        .select("*")
        .eq("tipo", TIPO)
        .order("contagem_uso", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      setTemplates(((data as any[]) || []).map(mapRow));
    } catch (err: any) {
      console.error("[quickTemplates] load error", err);
      toast.error("Não foi possível carregar templates", { description: err.message });
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
        const criadoPor = await resolveProfissionalId(user.id);
        const { data, error } = await supabase
          .from("modelos")
          .insert({
            tipo: TIPO,
            nome: input.name.trim(),
            descricao: input.description?.trim() || null,
            categoria_clinica: input.clinical_category || "geral",
            itens: input.items as any,
            escopo: input.scope === "shared" ? "global" : "pessoal",
            criado_por: criadoPor,
            hospital_id: input.hospital_unit_id || null,
          } as any)
          .select()
          .single();
        if (error) throw error;
        toast.success("Template salvo", { description: input.name });
        await load();
        return mapRow(data);
      } catch (err: any) {
        toast.error("Não foi possível salvar template", { description: err.message });
        return null;
      }
    },
    [user, load],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from("modelos").delete().eq("id", id);
        if (error) throw error;
        toast.success("Template excluído");
        await load();
      } catch (err: any) {
        toast.error("Não foi possível excluir template", { description: err.message });
      }
    },
    [load],
  );

  // MIGRAÇÃO: RPC bump_quick_template_use não existe → incremento best-effort direto.
  const bumpUseCount = useCallback(async (id: string) => {
    try {
      const { data } = await supabase.from("modelos").select("contagem_uso").eq("id", id).maybeSingle();
      const atual = (data as any)?.contagem_uso ?? 0;
      await supabase.from("modelos").update({ contagem_uso: atual + 1, ultimo_uso_em: new Date().toISOString() } as any).eq("id", id);
    } catch {
      // best-effort
    }
  }, []);

  return { templates, loading, reload: load, saveTemplate, deleteTemplate, bumpUseCount };
}
