import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { IpRestricted } from "./IpRestricted";

/**
 * Lê o perfil de acesso ativo do usuário (escolhido no ProfileChooser
 * ou fallback) e aplica a restrição de IP correspondente, se o módulo
 * estiver com `enforce=true` em module_ip_settings.
 *
 * Isso faz com que o toggle "Exigir IP" da página /dev-console funcione
 * para QUALQUER perfil (medico, ccih, imagem, lab, etc.), e não só para
 * as 4 rotas que já estavam envolvidas individualmente.
 */
export function ProfileIpGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const activeProfile =
    typeof window !== "undefined"
      ? sessionStorage.getItem("active_access_profile") ||
        localStorage.getItem("access_profile") ||
        ""
      : "";

  // Sem usuário ou sem perfil definido → não bloqueia (deixa fluxos públicos passarem)
  if (!user || !activeProfile) return <>{children}</>;

  return (
    <IpRestricted moduleKey={activeProfile} moduleLabel={activeProfile}>
      {children}
    </IpRestricted>
  );
}
