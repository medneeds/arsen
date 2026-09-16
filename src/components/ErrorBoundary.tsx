import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Captura erros de renderizacao e de efeitos, evitando a TELA BRANCA.
 *
 * Por que existe (15/09/2026): quando um erro escapa de um componente e nao ha
 * ErrorBoundary, o React desmonta a arvore INTEIRA. O usuario ve uma tela
 * branca, sem mensagem, sem caminho de saida. Foi o que aconteceu quando
 * localStorage estourou a cota no mapa de leitos e ao trocar de setor — e foi
 * o mesmo desfecho de outros erros de escopo ao longo de setembro.
 *
 * Num sistema clinico, tela branca sem explicacao e o pior desfecho possivel:
 * o profissional nao sabe se o dado sumiu, se nao salvou ou se o sistema caiu.
 *
 * Este componente NAO corrige bugs. Ele garante que um bug vire uma mensagem
 * com saida, e que o erro fique registrado em vez de desaparecer.
 *
 * Implementacao deliberadamente simples: HTML e classes utilitarias, sem
 * dependencia de componentes de UI, contextos ou icones. O que roda depois de
 * uma falha precisa ser a parte mais confiavel do sistema.
 */

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  detalhesAbertos: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, detalhesAbertos: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Mantem o rastro no console para quem for investigar.
    console.error("[ErrorBoundary] erro nao tratado:", error, info.componentStack);
  }

  private recarregar = () => {
    window.location.reload();
  };

  /**
   * Saida para o caso de cache local corrompido ou cheio — a familia de falhas
   * que motivou este componente. Preserva a sessao: limpa apenas as chaves da
   * aplicacao, nunca as do Supabase (prefixo "sb-"), para nao deslogar quem ja
   * esta no meio de um atendimento.
   */
  private limparCacheLocal = () => {
    try {
      const preservar = (k: string) => k.startsWith("sb-") || k.includes("supabase");
      const chaves = Object.keys(localStorage).filter((k) => !preservar(k));
      chaves.forEach((k) => {
        try { localStorage.removeItem(k); } catch { /* ignora */ }
      });
    } catch { /* ignora */ }
    window.location.reload();
  };

  render() {
    const { error, detalhesAbertos } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <div className="w-full max-w-lg rounded-lg border border-border bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">
            Esta tela encontrou um erro
          </h1>

          <p className="mt-2 text-sm text-foreground">
            O sistema interrompeu o carregamento desta tela. Nenhuma informação
            que já havia sido salva foi perdida — os dados clínicos ficam no
            servidor, não neste computador.
          </p>

          <p className="mt-3 text-sm text-foreground">
            Comece por recarregar. Se o erro voltar, limpe os dados locais desta
            tela: isso apaga apenas preferências guardadas no navegador, como
            setor selecionado e anotações de apoio, e mantém a sua sessão.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.recarregar}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary"
            >
              Recarregar a página
            </button>
            <button
              type="button"
              onClick={this.limparCacheLocal}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Limpar dados locais e recarregar
            </button>
          </div>

          <button
            type="button"
            onClick={() => this.setState({ detalhesAbertos: !detalhesAbertos })}
            className="mt-5 text-xs text-muted-foreground underline hover:text-foreground"
          >
            {detalhesAbertos ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
          </button>

          {detalhesAbertos && (
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-3 text-xs text-foreground">
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
            </pre>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Se o problema continuar, informe o suporte e copie os detalhes
            técnicos acima.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
