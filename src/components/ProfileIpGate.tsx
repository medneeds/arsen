import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { lerPerfil } from "@/lib/perfilSupabase";
import { IpRestricted } from "./IpRestricted";
import { safeSetItem } from "@/lib/safeStorage";

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

  useEffect(() => {
    if (!user?.id) {
      setActiveProfile("");
      return;
    }

    let cancelled = false;
    // Auditoria 18/09/2026: era a quarta consulta identica a `profiles` no
    // caminho de entrada. Agora todas passam por lerPerfil, que colapsa a
    // rajada do login numa unica ida ao servidor.
    lerPerfil(user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as { access_profile?: string | null; access_profiles?: string[] | null } | null;
        const profiles = row?.access_profiles?.length
          ? row.access_profiles.filter(Boolean)
          : (row?.access_profile ? [row.access_profile] : []);
        const sessionProfile = typeof window !== "undefined"
          ? sessionStorage.getItem("active_access_profile")
          : null;
        const chosen = sessionProfile && profiles.includes(sessionProfile)
          ? sessionProfile
          : (row?.access_profile || profiles[0] || "");

        if (chosen && typeof window !== "undefined") {
          sessionStorage.setItem("active_access_profile", chosen);
          sessionStorage.setItem("available_access_profiles", JSON.stringify(profiles));
          safeSetItem("access_profile", chosen);
        }
        setActiveProfile(chosen);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Sem usuário ou sem perfil definido → não bloqueia (deixa fluxos públicos passarem)
  if (!user || !activeProfile) return <>{children}</>;

  return (
    <IpRestricted moduleKey={activeProfile} moduleLabel={activeProfile}>
      {children}
    </IpRestricted>
  );
}
