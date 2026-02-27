import { createContext, useContext, useState, ReactNode } from "react";

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

  const toggleNamesHidden = () => setNamesHidden((prev) => !prev);

  return (
    <PrivacyContext.Provider value={{ namesHidden, toggleNamesHidden }}>
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
