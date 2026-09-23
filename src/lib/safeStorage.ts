/**
 * Acesso a localStorage que NUNCA lanca excecao.
 *
 * Motivo (incidente de 15/09/2026, mapa de leitos):
 * `localStorage.setItem` estourou a cota do navegador ao gravar a lista
 * completa de pacientes. O erro subiu de dentro de um useEffect e, como a
 * aplicacao nao tem ErrorBoundary, o React desmontou a arvore inteira — tela
 * branca, sem mensagem. O mesmo acontecia ao trocar de setor, porque a lista
 * mudava e o efeito rodava de novo.
 *
 * Regra que fica: armazenamento local e CACHE, nunca fonte de verdade. Falhar
 * ao gravar ou ler um cache jamais pode derrubar uma tela clinica. A fonte de
 * verdade e o banco.
 *
 * Cota estourada e previsivel (limite tipico ~5MB por origem) e nao e o unico
 * caso: navegacao privada e politicas de privacidade tambem fazem o acesso
 * lancar excecao.
 */

/** Grava um valor. Retorna false se nao foi possivel — nunca lanca. */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // QuotaExceededError e o caso esperado. Avisa no console para nao virar
    // falha silenciosa, mas segue adiante: o dado real esta no banco.
    console.warn(`[safeStorage] nao foi possivel gravar "${key}":`, error);
    return false;
  }
}

/** Grava um valor serializado em JSON. Retorna false se nao foi possivel. */
export function safeSetJSON(key: string, value: unknown): boolean {
  try {
    return safeSetItem(key, JSON.stringify(value));
  } catch (error) {
    // Serializacao tambem pode falhar (referencia circular, BigInt).
    console.warn(`[safeStorage] nao foi possivel serializar "${key}":`, error);
    return false;
  }
}

/** Le e desserializa. Devolve `fallback` se a chave nao existe ou esta corrompida. */
export function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === "") return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch (error) {
    console.warn(`[safeStorage] conteudo invalido em "${key}", usando padrao:`, error);
    // Remove o lixo para nao repetir o erro a cada carregamento.
    try { localStorage.removeItem(key); } catch { /* ignora */ }
    return fallback;
  }
}

/** Le texto puro. Devolve `fallback` se indisponivel. */
export function safeGetItem(key: string, fallback = ""): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Remove uma chave. Nunca lanca. */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* ignora */ }
}
