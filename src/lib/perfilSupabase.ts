/**
 * Ligacao entre o buscador de perfil (logica pura, testavel) e o Supabase.
 *
 * O modulo perfilDoUsuario.ts nao importa o cliente de proposito: assim ele
 * roda no tsx, sem DOM e sem import.meta.env, e a regra de reuso fica coberta
 * por src/tests/perfil-uma-consulta-so.test.ts.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  buscarPerfilDoUsuario,
  COLUNAS_PERFIL,
  type PerfilDoUsuario,
  type RespostaPerfil,
} from "./perfilDoUsuario";

export { limparPerfilEmCache } from "./perfilDoUsuario";
export type { PerfilDoUsuario } from "./perfilDoUsuario";

async function consultar(userId: string): Promise<RespostaPerfil> {
  const { data, error } = await supabase
    .from("profiles")
    .select(COLUNAS_PERFIL)
    .eq("id", userId)
    .maybeSingle();
  return { data: (data as PerfilDoUsuario) ?? null, error };
}

/**
 * Le o perfil do usuario. Chamadas simultaneas compartilham a mesma ida ao
 * servidor; chamadas proximas reaproveitam o resultado por 15s.
 *
 * @param forcar ignora o reuso e vai ao servidor (refreshUserStatus, e depois
 *               de gravar algo no proprio perfil)
 */
export function lerPerfil(userId: string, forcar = false): Promise<RespostaPerfil> {
  return buscarPerfilDoUsuario(userId, consultar, { forcar });
}
