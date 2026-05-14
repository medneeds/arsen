import { useCallback, useState } from "react";

/**
 * Fila genérica para wizards que precisam empilhar vários itens
 * antes de despachar tudo em um único `onAdd` para a prescrição.
 *
 * Padrão usado por HydrationWizard, ReplacementWizard e (futuramente)
 * outros assistentes que beneficiam de "preparar N coisas e enviar de uma vez".
 */
export interface QueuedItem<T> {
  /** ID local da fila (não confundir com id final do MedicationEntry) */
  uid: string;
  /** Snapshot do estado do form no momento do "+ Acrescentar" */
  snapshot: T;
  /** Pré-visualização curta exibida na fila (ex: "SF 0,9% 500mL · 6/6h") */
  label: string;
  /** Sublabel opcional com dose/instrução resumida */
  sublabel?: string;
}

export function useWizardItemQueue<T>() {
  const [items, setItems] = useState<QueuedItem<T>[]>([]);
  const [editingUid, setEditingUid] = useState<string | null>(null);

  const push = useCallback((snapshot: T, label: string, sublabel?: string) => {
    const uid = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItems(prev => [...prev, { uid, snapshot, label, sublabel }]);
    return uid;
  }, []);

  const update = useCallback((uid: string, snapshot: T, label: string, sublabel?: string) => {
    setItems(prev => prev.map(it => (it.uid === uid ? { ...it, snapshot, label, sublabel } : it)));
  }, []);

  const remove = useCallback((uid: string) => {
    setItems(prev => prev.filter(it => it.uid !== uid));
    setEditingUid(prev => (prev === uid ? null : prev));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setEditingUid(null);
  }, []);

  const startEditing = useCallback((uid: string) => setEditingUid(uid), []);
  const stopEditing = useCallback(() => setEditingUid(null), []);

  return {
    items,
    count: items.length,
    editingUid,
    push,
    update,
    remove,
    clear,
    startEditing,
    stopEditing,
  };
}
