import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { LoadingScreen } from "./LoadingScreen";
import { SessionTimeoutProvider } from "./SessionTimeoutProvider";
import { PendingApprovalScreen } from "./PendingApprovalScreen";
import { ConsentTermsDialog, CURRENT_TERMS_VERSION } from "./ConsentTermsDialog";
import { supabase } from "@/integrations/supabase/client";
import { AccessLimitsScreen } from "./AccessLimitsScreen";

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
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, status } = useAuth();
  const navigate = useNavigate();
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [hasShownLoading, setHasShownLoading] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [checkingTerms, setCheckingTerms] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showAccessLimits, setShowAccessLimits] = useState(false);
  const [accessLimitsShown, setAccessLimitsShown] = useState(false);

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
    }
  }, [user, loading, navigate, hasShownLoading]);

  if (loading || checkingTerms) {
    return null;
  }

  if (!user) {
    return null;
  }

  if (showLoadingScreen) {
    return <LoadingScreen onComplete={() => setShowLoadingScreen(false)} />;
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

  // Usuários genéricos legados têm acesso direto (período de transição)
  // Usuários individuais pendentes veem a tela de espera
  if (status === "pending" && !isLegacyGenericUser) {
    return <PendingApprovalScreen />;
  }

  // Envolver com SessionTimeoutProvider para ativar timeout LGPD/CFM
  return (
    <SessionTimeoutProvider>
      {children}
    </SessionTimeoutProvider>
  );
}
