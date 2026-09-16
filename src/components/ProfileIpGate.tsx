import { ReactNode, useEffect, useState } from "react";
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
  const [activeProfile, setActiveProfile] = useState("");

  // MIGRAÇÃO: `profiles.access_profile`/`access_profiles` (tabela morta) não têm
  // coluna equivalente em `profissionais` — o conceito de "perfil de acesso"
  // (multi-perfil) foi degradado em toda a app. O perfil ativo passa a ser lido
  // apenas do que já foi persistido em sessionStorage/localStorage por outros
  // fluxos (login/troca de perfil). Sem perfil definido → não aplica gate.
  useEffect(() => {
    if (!user?.id) {
      setActiveProfile("");
      return;
    }
    if (typeof window === "undefined") return;
    const sessionProfile = sessionStorage.getItem("active_access_profile");
    const stored = localStorage.getItem("access_profile");
    setActiveProfile(sessionProfile || stored || "");
  }, [user?.id]);

  // Sem usuário ou sem perfil definido → não bloqueia (deixa fluxos públicos passarem)
  if (!user || !activeProfile) return <>{children}</>;

  return (
    <IpRestricted moduleKey={activeProfile} moduleLabel={activeProfile}>
      {children}
    </IpRestricted>
  );
}
