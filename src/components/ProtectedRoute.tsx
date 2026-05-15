import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { LoadingScreen } from "./LoadingScreen";
import { SessionTimeoutProvider } from "./SessionTimeoutProvider";
import { PendingApprovalScreen } from "./PendingApprovalScreen";
import { ConsentTermsDialog, CURRENT_TERMS_VERSION } from "./ConsentTermsDialog";
import { supabase } from "@/integrations/supabase/client";
import { AccessLimitsScreen } from "./AccessLimitsScreen";
import { ProfileIpGate } from "./ProfileIpGate";

// Logins genéricos que não precisam de aprovação (período de transição)
const LEGACY_GENERIC_USERS = [
  "medicoporta@sistema.local",
  "lider@sistema.local",
  "visitante@sistema.local",
  "medicouti@sistema.local",
  "liderped@sistema.local",
  "coordenador@sistema.local",
  "rotina@sistema.local",
  "farmacia@sistema.local",
  "equipemulti@sistema.local",
  "classificacao@sistema.local",
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, status } = useAuth();
  const navigate = useNavigate();
  // Flags persistidos em sessionStorage para que a tela de loading e a
  // seleção de setor apareçam UMA ÚNICA VEZ por sessão (e não a cada
  // navegação entre rotas, que remonta o ProtectedRoute).
  const sessionFlag = (key: string) =>
    typeof window !== "undefined" && sessionStorage.getItem(key) === "1";
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [hasShownLoading, setHasShownLoading] = useState(() => sessionFlag("loading_shown"));
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [checkingTerms, setCheckingTerms] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showAccessLimits, setShowAccessLimits] = useState(false);
  const [accessLimitsShown, setAccessLimitsShown] = useState(() => sessionFlag("access_limits_shown"));

  // Verificar se é um usuário genérico legado (não precisa de aprovação nem termos)
  const isLegacyGenericUser = user?.email && LEGACY_GENERIC_USERS.includes(user.email.toLowerCase());

  // Verificar se usuário já aceitou os termos
  useEffect(() => {
    const checkTermsAcceptance = async () => {
      if (!user || isLegacyGenericUser) {
        setCheckingTerms(false);
        setTermsAccepted(true);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("terms_version, terms_accepted_at")
          .eq("id", user.id)
          .single();

        if (profile?.terms_version === CURRENT_TERMS_VERSION && profile?.terms_accepted_at) {
          setTermsAccepted(true);
        } else {
          setShowTermsDialog(true);
        }
      } catch (error) {
        console.error("Erro ao verificar termos:", error);
        setShowTermsDialog(true);
      } finally {
        setCheckingTerms(false);
      }
    };

    if (user && !loading) {
      checkTermsAcceptance();
    }
  }, [user, loading, isLegacyGenericUser]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    } else if (!loading && user && !hasShownLoading) {
      setShowLoadingScreen(true);
      setHasShownLoading(true);
      try { sessionStorage.setItem("loading_shown", "1"); } catch {}
    }
  }, [user, loading, navigate, hasShownLoading]);

  // Regra única: a tela "Tipo de Acesso / seleção de setor médico" SÓ faz
  // sentido para o perfil clínico assistencial ("medico"). Qualquer outro
  // perfil — gestor, farmácia, NIR, CCIH, imagem, lab, administrativo,
  // classificação de risco, multi — tem painel próprio e vai direto.
  //
  // A fonte de verdade é a sessão atual (escolha do ProfileChooser); cai no
  // localStorage só como fallback para sessões antigas.
  const activeAccessProfile = typeof window !== "undefined"
    ? (sessionStorage.getItem("active_access_profile") || localStorage.getItem("access_profile") || "")
    : "";
  const SECTOR_PICKER_PROFILES = new Set(["medico"]);
  const skipAccessLimits = !SECTOR_PICKER_PROFILES.has(activeAccessProfile);

  if (loading || checkingTerms) {
    return null;
  }

  if (!user) {
    return null;
  }

  if (showLoadingScreen) {
    return <LoadingScreen onComplete={() => {
      setShowLoadingScreen(false);
      // Perfis globais (gestor/admin/painéis dedicados) pulam a tela de seleção de setor.
      if (!isLegacyGenericUser && !accessLimitsShown && !skipAccessLimits) {
        setShowAccessLimits(true);
      } else if (skipAccessLimits) {
        setAccessLimitsShown(true);
        try { sessionStorage.setItem("access_limits_shown", "1"); } catch {}
      }
    }} />;
  }

  // Mostrar diálogo de termos se ainda não aceitou
  if (showTermsDialog && !termsAccepted) {
    return (
      <ConsentTermsDialog
        open={true}
        userId={user.id}
        onAccept={() => {
          setTermsAccepted(true);
          setShowTermsDialog(false);
        }}
      />
    );
  }

  // Tela de limites de acesso
  if (showAccessLimits && !accessLimitsShown) {
    return (
      <AccessLimitsScreen
        onProceed={() => {
          setShowAccessLimits(false);
          setAccessLimitsShown(true);
        }}
      />
    );
  }

  // Usuários genéricos legados têm acesso direto (período de transição)
  // Usuários individuais pendentes veem a tela de espera
  if (status === "pending" && !isLegacyGenericUser) {
    return <PendingApprovalScreen />;
  }

  // Envolver com SessionTimeoutProvider para ativar timeout LGPD/CFM
  return (
    <SessionTimeoutProvider>
      <ProfileIpGate>{children}</ProfileIpGate>
    </SessionTimeoutProvider>
  );
}
