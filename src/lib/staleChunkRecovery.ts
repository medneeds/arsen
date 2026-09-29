/**
 * Auto-recuperacao de "stale chunk" apos deploy.
 *
 * Em SPA com chunks hasheados (lazy()), um deploy novo troca os hashes. Um cliente
 * que ainda tem o index.html antigo pede um /assets/*.js que nao existe mais; o
 * servidor devolve o index.html (text/html) no lugar, e o import dinamico falha
 * ("Failed to fetch dynamically imported module" / vite:preloadError / erro de MIME),
 * caindo no ErrorBoundary ("Esta tela encontrou um erro").
 *
 * Aqui recarregamos UMA vez para buscar o index.html atual com os hashes novos.
 * Guarda por JANELA DE TEMPO (nao flag permanente): tolera deploys sucessivos na
 * mesma aba, mas evita loop apertado quando o proprio index.html vier de cache velho
 * (nesse caso o reload nao resolve e deixamos o ErrorBoundary assumir).
 *
 * ATENCAO (deploy): este e um PALIATIVO. So resolve de fato com o servidor servindo
 * o index.html sem cache (Cache-Control: no-cache) e 404 real para /assets/*.js
 * ausente (sem fallback SPA para arquivos de asset).
 */
const GUARD_KEY = "arsen:chunk-reload-ts";
const WINDOW_MS = 15000;

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk \S+ failed|expected a javascript(?:-or-wasm)? module script/i;

/** Heuristica: a mensagem de erro indica falha de carregamento de chunk/modulo? */
export function isStaleChunkError(message?: string | null): boolean {
  return !!message && CHUNK_ERROR_RE.test(message);
}

/**
 * Recarrega uma unica vez (dentro da janela) para pegar o index.html novo.
 * Retorna true se o reload foi disparado; false se a guarda bloqueou (ja tentou ha
 * pouco) — nesse caso o chamador deve mostrar a tela de erro/saida manual.
 */
export function recoverFromStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) || 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage indisponivel (modo privado/bloqueado) → segue com reload
    // best-effort (sem guarda persistida, mas o navegador nao costuma repetir a
    // falha do mesmo import na mesma navegacao).
  }
  window.location.reload();
  return true;
}
