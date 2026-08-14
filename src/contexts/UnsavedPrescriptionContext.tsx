/**
 * UnsavedClinicalContext
 *
 * Context genérico de "alterações não salvas" — usado por qualquer página
 * clínica (Prescrição, Evolução) para comunicar dirty state aos componentes
 * de navegação (AppSidebar, PatientSidebar, ClinicalModuleTabs).
 *
 * Cada página registra seu próprio dirty state e callback de salvar.
 * O sidebar lê isDirty (OR de todas as páginas) e usa o onSaveDraft
 * da página ativa para salvar antes de navegar.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type PageKey = 'prescricao' | 'evolucao';

interface PageState {
  dirty: boolean;
  saveDraft: (() => Promise<void>) | null;
  label: string; // usado no texto do popup
}

interface UnsavedClinicalContextValue {
  /** true se QUALQUER página registrada tiver alterações não salvas */
  isDirty: boolean;
  /** label da página dirty (para o texto do popup) */
  dirtyLabel: string;
  setPageDirty: (page: PageKey, dirty: boolean) => void;
  registerPageSaveDraft: (page: PageKey, fn: (() => Promise<void>) | null) => void;
  /** Callback de salvar da página dirty ativa */
  onSaveDraft: (() => Promise<void>) | null;
  // ── retrocompatibilidade com código existente da Prescrição ──
  setDirty: (dirty: boolean) => void;
  registerSaveDraft: (fn: (() => Promise<void>) | null) => void;
}

const UnsavedClinicalContext = createContext<UnsavedClinicalContextValue>({
  isDirty: false,
  dirtyLabel: 'prescrição',
  setPageDirty: () => {},
  registerPageSaveDraft: () => {},
  onSaveDraft: null,
  setDirty: () => {},
  registerSaveDraft: () => {},
});

const PAGE_LABELS: Record<PageKey, string> = {
  prescricao: 'prescrição',
  evolucao: 'evolução',
};

export function UnsavedPrescriptionProvider({ children }: { children: React.ReactNode }) {
  const [pageStates, setPageStates] = useState<Partial<Record<PageKey, boolean>>>({});
  const saveDraftRefs = useRef<Partial<Record<PageKey, (() => Promise<void>) | null>>>({});

  const setPageDirty = useCallback((page: PageKey, dirty: boolean) => {
    setPageStates(prev => ({ ...prev, [page]: dirty }));
  }, []);

  const registerPageSaveDraft = useCallback((page: PageKey, fn: (() => Promise<void>) | null) => {
    saveDraftRefs.current[page] = fn;
  }, []);

  // OR de todos os dirty states
  const dirtyPage = (Object.entries(pageStates) as [PageKey, boolean][]).find(([, v]) => v)?.[0];
  const isDirty = !!dirtyPage;
  const dirtyLabel = dirtyPage ? PAGE_LABELS[dirtyPage] : 'prescrição';
  const onSaveDraft = dirtyPage ? (saveDraftRefs.current[dirtyPage] ?? null) : null;

  // Retrocompatibilidade — prescrição usa setDirty/registerSaveDraft diretamente
  const setDirty = useCallback((dirty: boolean) => setPageDirty('prescricao', dirty), [setPageDirty]);
  const registerSaveDraft = useCallback((fn: (() => Promise<void>) | null) => {
    registerPageSaveDraft('prescricao', fn);
  }, [registerPageSaveDraft]);

  return (
    <UnsavedClinicalContext.Provider value={{
      isDirty, dirtyLabel, setPageDirty, registerPageSaveDraft, onSaveDraft,
      setDirty, registerSaveDraft,
    }}>
      {children}
    </UnsavedClinicalContext.Provider>
  );
}

export function useUnsavedPrescription() {
  return useContext(UnsavedClinicalContext);
}

/** Hook específico para páginas clínicas registrarem seu dirty state */
export function useUnsavedClinical(page: PageKey) {
  const ctx = useContext(UnsavedClinicalContext);
  return {
    setDirty: (dirty: boolean) => ctx.setPageDirty(page, dirty),
    registerSaveDraft: (fn: (() => Promise<void>) | null) => ctx.registerPageSaveDraft(page, fn),
  };
}
