import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type PacienteRow = Tables<"pacientes">;

/**
 * Lê a internação (internacoes.id) com o paciente vinculado e o nº de
 * atendimento (internacoes.numero_atendimento).
 *
 * Tolerante à ordem de deploy: se a coluna numero_atendimento ainda não
 * existir no banco (migration 20261001130000 não aplicada), refaz a consulta
 * sem ela — o cabeçalho continua com prontuário/identidade e o atendimento
 * fica null, como antes.
 */
export async function fetchInternacaoComPaciente(
  internacaoId: string,
): Promise<{ paciente: PacienteRow | null; numeroAtendimento: string | null }> {
  const { data, error } = await supabase
    .from("internacoes")
    .select("numero_atendimento, paciente:pacientes(*)")
    .eq("id", internacaoId)
    .maybeSingle();

  if (!error) {
    return {
      paciente: (data?.paciente as PacienteRow | null) ?? null,
      numeroAtendimento: data?.numero_atendimento || null,
    };
  }

  const { data: fallback } = await supabase
    .from("internacoes")
    .select("paciente:pacientes(*)")
    .eq("id", internacaoId)
    .maybeSingle();

  return { paciente: (fallback?.paciente as PacienteRow | null) ?? null, numeroAtendimento: null };
}

/**
 * Nº de atendimento de várias internações de uma vez ({ internacaoId: nº }).
 * Consulta própria e isolada — de propósito fora das queries grandes (mapa de
 * leitos, ficha): se a coluna ainda não existir no banco, só o nº some (mapa
 * vazio), sem derrubar a tela.
 */
export async function fetchNumerosAtendimento(
  internacaoIds: string[],
): Promise<Record<string, string>> {
  const ids = Array.from(new Set(internacaoIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("internacoes")
    .select("id, numero_atendimento")
    .in("id", ids);
  if (error || !data) return {};

  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.numero_atendimento) map[row.id] = row.numero_atendimento;
  }
  return map;
}
