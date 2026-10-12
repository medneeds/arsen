/**
 * Trava de inclusao de itens em prescricao ja validada.
 * `next` traz itens cujo id nao existe em `prev` => e uma INCLUSAO. Atualizacoes que
 * so mapeiam, removem ou reordenam itens (mesmos ids) nao sao inclusao.
 */
export function hasNewItemIds(prev: { id: string }[], next: { id: string }[]): boolean {
  const prevIds = new Set(prev.map((i) => i.id));
  return next.some((i) => !prevIds.has(i.id));
}

/**
 * Estado da trava: so fecha quando TODOS os itens ativos estao validados hoje e o
 * usuario nao abriu o modo "Adicionar itens".
 */
export function isAdditionsGated(allItemsValidated: boolean, addingItems: boolean): boolean {
  return allItemsValidated && !addingItems;
}

/**
 * O modo "Adicionar itens" encerra sozinho: depois de ter havido item pendente
 * (pendingSeen) e tudo voltar a ficar validado (por validacao ou remocao do pendente).
 */
export function shouldExitAddingMode(
  addingItems: boolean,
  allItemsValidated: boolean,
  pendingSeen: boolean,
): boolean {
  return addingItems && allItemsValidated && pendingSeen;
}
