import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * MIGRAÇÃO: field_text_templates → modelos (tipo='texto_campo').
 * Mapeamento de colunas:
 *   name→nome, body→conteudo, scope→escopo_campo, is_shared→escopo
 *   ('global' quando compartilhado, senão 'pessoal'), hospital_unit_id→hospital_id,
 *   use_count→contagem_uso, last_used_at→ultimo_uso_em, created_at→criado_em,
 *   updated_at→atualizado_em, created_by→criado_por/profissional_id (profissionais.id,
 *   resolvido via user_id).
 * DEGRADADO: `user_id` (antes auth.uid) não tem coluna equivalente — modelos usa
 *   `criado_por` (= profissionais.id, ≠ auth.uid), que é o que expomos no campo
 *   `user_id`. A visibilidade "meus + compartilhados" fica a cargo da RLS.
 * A interface exportada `FieldTemplate` é preservada.
 */

const TIPO_MODELO = "texto_campo";

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

function mapModelo(m: any): FieldTemplate {
  return {
    id: m.id,
    user_id: m.criado_por ?? "", // MIGRAÇÃO: profissionais.id (não mais auth.uid)
    scope: m.escopo_campo ?? "",
    name: m.nome,
    body: m.conteudo ?? "",
    is_shared: m.escopo === "global",
    hospital_unit_id: m.hospital_id ?? null,
    use_count: m.contagem_uso ?? 0,
    last_used_at: m.ultimo_uso_em ?? null,
    created_at: m.criado_em,
    updated_at: m.atualizado_em,
  };
}

/**
 * Modelos de texto por campo (escopo livre, ex.: "evolution.subjective").
 * Cada usuário vê seus próprios + os marcados como compartilhados (via RLS).
 */
export function useFieldTemplates(scope: string) {
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["field-templates", scope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modelos")
        .select("*")
        .eq("tipo", TIPO_MODELO)
        .eq("escopo_campo", scope)
        .order("contagem_uso", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapModelo);
    },
    enabled: !!scope,
  });

  const create = useMutation({
    mutationFn: async (input: { name: string; body: string; is_shared?: boolean; hospital_unit_id?: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sem sessão");
      const criadoPor = await resolveProfissionalId(uid);
      const { error } = await supabase.from("modelos").insert({
        tipo: TIPO_MODELO,
        escopo_campo: scope,
        nome: input.name.trim(),
        conteudo: input.body,
        escopo: input.is_shared ? "global" : "pessoal",
        hospital_id: input.hospital_unit_id ?? null,
        criado_por: criadoPor,
        profissional_id: criadoPor,
      } as any);
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
      const { error } = await supabase.from("modelos").delete().eq("id", id);
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
        .from("modelos")
        .update({ contagem_uso: (t.use_count ?? 0) + 1, ultimo_uso_em: new Date().toISOString() })
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
