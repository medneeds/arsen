import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Coordena o botao "Duvidas" entre cabecalho e sidebar.
 * Telas com BreadcrumbBar mostram o botao no cabecalho; nelas a sidebar o esconde.
 * Telas sem BreadcrumbBar continuam com o botao na sidebar.
 */
interface HeaderHelpContextValue {
  headerHasHelp: boolean;
  setHeaderHasHelp: (value: boolean) => void;
}

const HeaderHelpContext = createContext<HeaderHelpContextValue>({
  headerHasHelp: false,
  setHeaderHasHelp: () => {},
});

export function HeaderHelpProvider({ children }: { children: ReactNode }) {
  const [headerHasHelp, setHeaderHasHelp] = useState(false);
  const value = useMemo(() => ({ headerHasHelp, setHeaderHasHelp }), [headerHasHelp]);
  return <HeaderHelpContext.Provider value={value}>{children}</HeaderHelpContext.Provider>;
}

export function useHeaderHelp() {
  return useContext(HeaderHelpContext);
}

/** Chamado pelo cabecalho: registra que ele exibe o botao enquanto estiver montado. */
export function useRegisterHeaderHelp() {
  const { setHeaderHasHelp } = useHeaderHelp();
  useLayoutEffect(() => {
    setHeaderHasHelp(true);
    return () => setHeaderHasHelp(false);
  }, [setHeaderHasHelp]);
}
