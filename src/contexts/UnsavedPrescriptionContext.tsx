/**
 * UnsavedPrescriptionContext
 *
 * Compartilha o estado "prescrição com alterações não salvas" entre
 * PrescricaoPage (quem sabe se há alterações) e PatientSidebar / useBlocker
 * (quem precisa interceptar a navegação).
 *
 * Fluxo:
 *   1. PrescricaoPage chama setDirty(true) quando items muda em relação ao
 *      último estado persistido, e setDirty(false) após salvar/validar.
 *   2. PatientSidebar chama isDirty antes de qualquer navigate() — se true,
 *      abre o AlertDialog de confirmação.
 *   3. O AlertDialog oferece "Salvar rascunho e sair" (chama onSaveDraft()
 *      e navega) ou "Sair sem salvar" (navega direto).
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface UnsavedPrescriptionContextValue {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  /** Callback registrado pela PrescricaoPage para salvar o rascunho atual */
  onSaveDraft: (() => Promise<void>) | null;
  registerSaveDraft: (fn: (() => Promise<void>) | null) => void;
}

const UnsavedPrescriptionContext = createContext<UnsavedPrescriptionContextValue>({
  isDirty: false,
  setDirty: () => {},
  onSaveDraft: null,
  registerSaveDraft: () => {},
});

export function UnsavedPrescriptionProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const saveDraftRef = useRef<(() => Promise<void>) | null>(null);

  const setDirty = useCallback((dirty: boolean) => setIsDirty(dirty), []);

  const registerSaveDraft = useCallback((fn: (() => Promise<void>) | null) => {
    saveDraftRef.current = fn;
  }, []);

  // Expõe via getter para evitar re-renders desnecessários no sidebar
  const onSaveDraft = saveDraftRef.current;

  return (
    <UnsavedPrescriptionContext.Provider value={{ isDirty, setDirty, onSaveDraft, registerSaveDraft }}>
      {children}
    </UnsavedPrescriptionContext.Provider>
  );
}

export function useUnsavedPrescription() {
  return useContext(UnsavedPrescriptionContext);
}
