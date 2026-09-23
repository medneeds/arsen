/**
 * Uma unica leitura de `profiles` por entrada no sistema.
 *
 * POR QUE ISTO EXISTE (auditoria de 18/09/2026)
 * O caminho de login perguntava a MESMA coisa quatro vezes, para o mesmo
 * usuario, em quatro idas e voltas independentes:
 *
 *   AuthPage        -> id, full_name, access_profile, access_profiles, must_change_password
 *   AuthContext     -> status
 *   ProtectedRoute  -> terms_version, terms_accepted_at   (e BLOQUEIA a tela ate voltar)
 *   ProfileIpGate   -> access_profile, access_profiles
 *
 * O RTT medido ate o servidor e de 246ms, entao eram ~750ms jogados fora no
 * caminho mais sensivel do sistema — com a tela em branco em parte dele.
 *
 * COMO FUNCIONA
 * Uma promessa em voo e compartilhada por quem chegar junto (o caso do login,
 * em que os quatro disparam quase ao mesmo tempo), e o resultado vale por um
 * intervalo curto. O objetivo e colapsar a rajada da entrada, NAO manter perfil
 * em cache pela sessao inteira: dado de permissao e de termos precisa
 * envelhecer rapido.
 *
 * `limparPerfilEmCache()` e chamado no logout — sem isso o proximo usuario no
 * mesmo terminal poderia enxergar o perfil do anterior.
 */

/** Colunas: a uniao do que os quatro consumidores pediam separadamente. */
export const COLUNAS_PERFIL =
  "id, full_name, access_profile, access_profiles, must_change_password, status, terms_version, terms_accepted_at";

export interface PerfilDoUsuario {
  id?: string;
  full_name?: string | null;
  access_profile?: string | null;
  access_profiles?: string[] | null;
  must_change_password?: boolean | null;
  status?: string | null;
  terms_version?: string | null;
  terms_accepted_at?: string | null;
}

export interface RespostaPerfil {
  data: PerfilDoUsuario | null;
  error: unknown;
}

/**
 * Janela curta de reuso. Cobre a rajada do login (os quatro consumidores
 * disparam em menos de um segundo) sem segurar permissao desatualizada.
 */
export const JANELA_DE_REUSO_MS = 15_000;

interface Entrada {
  userId: string;
  emVoo: Promise<RespostaPerfil>;
  concluidoEm: number | null;
  resposta: RespostaPerfil | null;
}

let entrada: Entrada | null = null;

/** Injetavel para teste; em producao e a consulta real do Supabase. */
export type BuscadorDePerfil = (userId: string) => Promise<RespostaPerfil>;

export function limparPerfilEmCache(): void {
  entrada = null;
}

/**
 * Busca o perfil, reaproveitando a chamada em voo ou o resultado recente.
 *
 * @param forcar ignora o cache e vai ao servidor (usado por refreshUserStatus)
 * @param agora  injetavel para teste
 */
export function buscarPerfilDoUsuario(
  userId: string,
  buscador: BuscadorDePerfil,
  opcoes?: { forcar?: boolean; agora?: () => number },
): Promise<RespostaPerfil> {
  const agora = opcoes?.agora ?? (() => Date.now());

  if (!opcoes?.forcar && entrada && entrada.userId === userId) {
    // Alguem ja pediu e ainda nao voltou: entra de carona na mesma promessa.
    if (entrada.concluidoEm === null) return entrada.emVoo;
    // Voltou ha pouco: reaproveita.
    if (agora() - entrada.concluidoEm < JANELA_DE_REUSO_MS && entrada.resposta) {
      return Promise.resolve(entrada.resposta);
    }
  }

  const nova: Entrada = { userId, emVoo: null as never, concluidoEm: null, resposta: null };
  nova.emVoo = buscador(userId).then(
    (resposta) => {
      nova.concluidoEm = agora();
      // Erro nao e memorizado: a proxima tentativa deve ir ao servidor de novo,
      // senao uma falha transitoria de rede ficaria grudada por 15s.
      nova.resposta = resposta.error ? null : resposta;
      if (resposta.error) entrada = null;
      return resposta;
    },
    (erro) => {
      entrada = null;
      throw erro;
    },
  );
  entrada = nova;
  return nova.emVoo;
}
