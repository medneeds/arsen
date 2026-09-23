/**
 * Tempo limite para chamadas de rede.
 *
 * POR QUE ISTO EXISTE (18/09/2026)
 * O login travava no botão "Entrando..." indefinidamente. O caminho de
 * autenticação faz QUATRO chamadas de rede em sequência — resolve_login,
 * signInWithPassword, getSession e a busca de perfil/role — e nenhuma tinha
 * tempo limite.
 *
 * Quando uma delas não respondia, a promessa simplesmente nunca resolvia:
 * o `catch` nunca era acionado, nenhuma mensagem aparecia e o botão ficava
 * preso. Do ponto de vista de quem está no plantão, o sistema "não carrega" —
 * sem nenhuma pista do que fazer.
 *
 * Uma espera infinita é pior que um erro: com erro, a pessoa tenta de novo ou
 * chama o suporte. Sem nada, ela fica olhando para o botão.
 *
 * Nota: isto não conserta a causa da lentidão do servidor. Conserta o
 * comportamento da interface diante dela — que é um defeito por si só.
 */

export class TempoEsgotadoError extends Error {
  constructor(public readonly operacao: string, public readonly ms: number) {
    super(`A operação "${operacao}" não respondeu em ${Math.round(ms / 1000)}s`);
    this.name = "TempoEsgotadoError";
  }
}

/**
 * Corre a promessa contra um relógio. Se o tempo esgotar, rejeita com
 * TempoEsgotadoError em vez de esperar para sempre.
 *
 * @param operacao  nome legível, usado na mensagem e no log
 * @param ms        tempo limite; 12s por padrão, folgado o bastante para um
 *                  servidor lento e curto o bastante para não parecer travado
 */
export function comTempoLimite<T>(
  promessa: PromiseLike<T>,
  operacao: string,
  ms = 12_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const relogio = setTimeout(() => {
      console.error(`[Arsen] tempo esgotado: ${operacao} (${ms}ms)`);
      reject(new TempoEsgotadoError(operacao, ms));
    }, ms);

    Promise.resolve(promessa).then(
      (valor) => { clearTimeout(relogio); resolve(valor); },
      (erro)  => { clearTimeout(relogio); reject(erro); },
    );
  });
}

/** Mensagem para o usuário, no tom do sistema: o que houve e o que fazer. */
export function mensagemDeFalhaDeRede(erro: unknown): string {
  if (erro instanceof TempoEsgotadoError) {
    return "O servidor não respondeu a tempo. Verifique sua conexão e tente novamente.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}
