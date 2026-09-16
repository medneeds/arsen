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
  const { user, loading, status, role } = useAuth();
  const navigate = useNavigate();
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [hasShownLoading, setHasShownLoading] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [checkingTerms, setCheckingTerms] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showAccessLimits, setShowAccessLimits] = useState(false);
  // 🔒 Persistir no sessionStorage para sobreviver a F5/reload da página.
  // Sem isso, cada reload reseta o estado e força a re-seleção do setor.
  const [accessLimitsShown, setAccessLimitsShown] = useState(() => {
    try {
      return sessionStorage.getItem("access_limits_shown") === "1";
    } catch { return false; }
  });

  // Verificar se é um usuário genérico legado (não precisa de aprovação nem termos)
  const isLegacyGenericUser = user?.email && LEGACY_GENERIC_USERS.includes(user.email.toLowerCase());

  // Verificar se usuário já aceitou os termos
  useEffect(() => {
    const checkTermsAcceptance = async () => {
      // super_admin não passa pelo fluxo de termos (tabela profiles não existe mais no schema novo).
      if (!user || isLegacyGenericUser || role === "super_admin") {
        setCheckingTerms(false);
        setTermsAccepted(true);
        return;
      }

      try {
        // Schema refatorado: consentimento vive em consentimentos_usuario
        // (antes: profiles.terms_version + user_consents).
        const { data: consents, error } = await supabase
          .from("consentimentos_usuario")
          .select("tipo_consentimento")
          .eq("usuario_id", user.id)
          .eq("versao_consentimento", CURRENT_TERMS_VERSION)
          .is("revogado_em", null);
        if (error) throw error;
        const tipos = new Set((consents ?? []).map((c) => c.tipo_consentimento));
        const aceitouTudo = ["terms_of_use", "privacy_policy", "data_processing"].every((t) => tipos.has(t));
        if (aceitouTudo) {
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
  }, [user, loading, isLegacyGenericUser, role]);

  useEffect(() => {
    if (!loading && !user) {
      // Limpar flags de sessão ao deslogar
      try { sessionStorage.removeItem("access_limits_shown"); } catch {}
      navigate("/auth");
    } else if (!loading && user && !hasShownLoading) {
      setShowLoadingScreen(true);
      setHasShownLoading(true);
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

  // super_admin: sem hospital, setor, termos, fila de aprovação nem IP-gate — acesso direto.
  if (role === "super_admin") {
    return <SessionTimeoutProvider>{children}</SessionTimeoutProvider>;
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
          try { sessionStorage.setItem("access_limits_shown", "1"); } catch {}
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
