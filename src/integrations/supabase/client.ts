// Cliente Supabase da aplicacao.
//
// NOTA: este arquivo nasceu gerado automaticamente. A partir de 18/09/2026 ele
// e mantido a mao por causa do tempo limite abaixo — se algum dia for
// regenerado, esta protecao precisa voltar junto.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { TempoEsgotadoError } from '@/lib/tempoLimite';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * TEMPO LIMITE EM TODA CHAMADA DE REDE (18/09/2026)
 *
 * A auditoria encontrou 721 chamadas `await supabase` no codigo e apenas 5 com
 * tempo limite — todas no login. Em todas as outras, quando o servidor nao
 * responde, a promessa nunca resolve: nenhum `catch` dispara, nenhuma mensagem
 * aparece, e a tela fica em espera muda. Foi exatamente o que aconteceu no dia
 * em que o servidor ficou inalcancavel.
 *
 * Em vez de embrulhar 721 chamadas uma a uma — mudanca enorme e facil de
 * esquecer pela metade —, o relogio vive aqui, no unico ponto por onde todas
 * passam. Nada nas telas precisa mudar: o que antes travava agora REJEITA, e
 * cada tela ja tem seu tratamento de erro.
 *
 * Realtime usa WebSocket e nao passa por aqui — nao e afetado.
 *
 * Upload/download de arquivo tem limite proprio: cortar um envio de documento
 * clinico em 20s numa rede de hospital seria trocar um defeito por outro.
 */
const TEMPO_LIMITE_MS = 20_000;
const TEMPO_LIMITE_ARQUIVO_MS = 120_000;

function urlDe(entrada: RequestInfo | URL): string {
  if (typeof entrada === 'string') return entrada;
  if (entrada instanceof URL) return entrada.href;
  return (entrada as Request).url ?? '';
}

function fetchComTempoLimite(entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = urlDe(entrada);
  const ehArquivo = url.includes('/storage/v1/');
  const limite = ehArquivo ? TEMPO_LIMITE_ARQUIVO_MS : TEMPO_LIMITE_MS;
  const operacao = ehArquivo ? 'transferencia de arquivo' : 'chamada ao servidor';

  const controlador = new AbortController();
  let estourou = false;

  // Preserva um abort que o proprio chamador tenha pedido (supabase.abortSignal).
  const sinalDoChamador = init?.signal;
  if (sinalDoChamador) {
    if (sinalDoChamador.aborted) controlador.abort();
    else sinalDoChamador.addEventListener('abort', () => controlador.abort(), { once: true });
  }

  const relogio = setTimeout(() => {
    estourou = true;
    console.error(`[Arsen] tempo esgotado: ${operacao} (${limite}ms) — ${url}`);
    controlador.abort();
  }, limite);

  return fetch(entrada, { ...init, signal: controlador.signal })
    .catch((erro) => {
      // Converte o AbortError generico em um erro que diz o que houve.
      if (estourou) throw new TempoEsgotadoError(operacao, limite);
      throw erro;
    })
    .finally(() => clearTimeout(relogio));
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: fetchComTempoLimite,
  },
});
