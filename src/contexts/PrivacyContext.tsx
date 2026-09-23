import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

interface PrivacyContextType {
  namesHidden: boolean;
  toggleNamesHidden: () => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  namesHidden: false,
  toggleNamesHidden: () => {},
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [namesHidden, setNamesHidden] = useState(false);

  const toggleNamesHidden = useCallback(() => setNamesHidden((prev) => !prev), []);

  // Memoizado — ver o comentario equivalente no AuthContext.
  const valor = useMemo(() => ({ namesHidden, toggleNamesHidden }), [namesHidden, toggleNamesHidden]);

  return (
    <PrivacyContext.Provider value={valor}>
      {children}
    </PrivacyContext.Provider>
  );
}

export const usePrivacy = () => useContext(PrivacyContext);

export function maskName(name: string, hidden: boolean): string {
  if (!hidden || !name || name.trim() === "") return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return name;
  // Show first initial + middle dot for each part, join with spaces
  return parts
    .map((p) => p[0] + "⸱".repeat(Math.min(Math.max(p.length - 1, 2), 4)))
    .join(" ");
}
