/**
 * Sincronizacao das pendencias entre Evolucao, painel lateral e Painel Clinico.
 * Fonte unica: internacoes.pendencias (uma pendencia por linha; marcador "[x] " /
 * "[ ] " no inicio, ver pendencyMarker.ts). As funcoes puras abaixo identificam a
 * pendencia pelo TEXTO (nao pelo indice), para que duas telas com listas em ordens
 * ou tamanhos diferentes nao marquem o item errado.
 */
import { parsePendency, setPendencyDone } from "./pendencyMarker.ts";

const norm = (t: string): string => t.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Marca/desmarca a pendencia de `text` em `lines`. Devolve a lista nova, ou null
 * quando nao ha o que mudar (pendencia inexistente ou ja no estado pedido).
 */
export function applyPendencyDone(lines: string[], text: string, done: boolean): string[] | null {
  const key = norm(text);
  if (!key) return null;
  const idx = lines.findIndex((l) => norm(parsePendency(l).text) === key && parsePendency(l).done !== done);
  if (idx === -1) return null;
  const next = [...lines];
  next[idx] = setPendencyDone(lines[idx], done);
  return next;
}

/**
 * Traz para a lista local (ex.: formulario da Evolucao) o que mudou na fonte unica:
 * adota o estado marcado/desmarcado dos itens de mesmo texto e acrescenta itens novos
 * que so existem na fonte. NUNCA apaga item local (pode ser digitacao ainda nao
 * salva). `alreadySeen` (textos normalizados ja trazidos antes da fonte) evita
 * re-acrescentar um item que o usuario removeu do formulario e ainda nao salvou.
 * Devolve a MESMA referencia de `local` quando nada muda.
 */
export function mergeLiveIntoLocal(local: string[], live: string[], alreadySeen?: Set<string>): string[] {
  const liveClean = live.filter((l) => l && l.trim());
  const liveByText = new Map<string, string>();
  for (const l of liveClean) liveByText.set(norm(parsePendency(l).text), l);
  let changed = false;
  const merged = local.map((l) => {
    const m = liveByText.get(norm(parsePendency(l).text));
    if (m === undefined) return l;
    const wanted = parsePendency(m).done;
    if (parsePendency(l).done === wanted) return l;
    changed = true;
    return setPendencyDone(l, wanted);
  });
  const localKeys = new Set(local.map((l) => norm(parsePendency(l).text)));
  for (const l of liveClean) {
    const k = norm(parsePendency(l).text);
    if (!localKeys.has(k) && !(alreadySeen && alreadySeen.has(k))) {
      merged.push(l);
      changed = true;
    }
  }
  return changed ? merged : local;
}

/**
 * Compara duas versoes da mesma lista e devolve as pendencias cujo unico ajuste foi
 * marcar/desmarcar (mesmo texto na mesma posicao, estado diferente).
 */
export function diffPendencyToggles(prev: string[], next: string[]): { text: string; done: boolean }[] {
  const out: { text: string; done: boolean }[] = [];
  const n = Math.min(prev.length, next.length);
  for (let i = 0; i < n; i++) {
    const a = parsePendency(prev[i]);
    const b = parsePendency(next[i]);
    if (a.text.trim() && norm(a.text) === norm(b.text) && a.done !== b.done) out.push({ text: b.text, done: b.done });
  }
  return out;
}

/** Textos normalizados de uma lista (para o conjunto `alreadySeen`). */
export function pendencyKeys(lines: string[]): Set<string> {
  return new Set(lines.filter((l) => l && l.trim()).map((l) => norm(parsePendency(l).text)));
}
