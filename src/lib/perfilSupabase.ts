/**
 * Ligacao entre o buscador de perfil (logica pura, testavel) e o Supabase.
 *
 * O modulo perfilDoUsuario.ts nao importa o cliente de proposito: assim ele
 * roda no tsx, sem DOM e sem import.meta.env, e a regra de reuso fica coberta
 * por src/tests/perfil-uma-consulta-so.test.ts.
 *
 * MIGRAÇÃO: `profiles` não existe no schema novo (ver AuthContext/ProtectedRoute/
 * ProfileIpGate, todos já migrados para `profissionais`). Esta função não é mais
 * chamada em nenhum caminho de produção — degradada para no-op de sucesso,
 * preservando a assinatura para não quebrar `lerPerfil` nem os testes de
 * `buscarPerfilDoUsuario` (que injetam seu próprio buscador).
 */
import {
  buscarPerfilDoUsuario,
  type PerfilDoUsuario,
  type RespostaPerfil,
} from "./perfilDoUsuario";

export { limparPerfilEmCache } from "./perfilDoUsuario";
export type { PerfilDoUsuario } from "./perfilDoUsuario";

async function consultar(_userId: string): Promise<RespostaPerfil> {
  return { data: null as PerfilDoUsuario | null, error: null };
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
