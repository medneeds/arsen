import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns true when the current user is browsing in "gestor" mode.
 * Gestor profiles have read-only access to the bed map and the consolidated
 * panel, but cannot edit clinical data nor open the Painel Clínico tab.
 */
export function useIsGestor(): boolean {
  const { role } = useAuth();
  if (typeof window === "undefined") return false;
  const accessProfile = localStorage.getItem("access_profile");
  // Apenas o perfil explícito de gestor restringe edição.
  // Admin segue com permissão completa.
  return accessProfile === "gestor" && role !== "admin";
}
