import { useEffect, useState, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { SessionTimeoutProvider } from "./SessionTimeoutProvider";
// Sob demanda: so aparece para usuario com cadastro pendente, mas arrastava
// framer-motion (22 usos) para o pacote de entrada de TODA a aplicacao.
const PendingApprovalScreen = lazy(() =>
  import("./PendingApprovalScreen").then(m => ({ default: m.PendingApprovalScreen })));
import { ConsentTermsDialog, CURRENT_TERMS_VERSION } from "./ConsentTermsDialog";
import { supabase } from "@/integrations/supabase/client";
import { ProfileIpGate } from "./ProfileIpGate";
import { startIdlePrefetch } from "@/lib/prefetchRoutes";
import { comTempoLimite } from "@/lib/tempoLimite";
import { PageLoader } from "@/components/PageLoader";

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
  const [hasShownLoading, setHasShownLoading] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [checkingTerms, setCheckingTerms] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Persistir no sessionStorage para sobreviver a F5/reload da página.
  // Sem isso, cada reload reseta o estado e força a re-seleção do setor.

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
        // QUINTA chamada de rede do caminho de login, e a mais perigosa: até
        // ela responder, `checkingTerms` fica true e o ProtectedRoute devolve
        // null — TELA EM BRANCO, sem spinner e sem mensagem.
        //
        // Ate 16/09/2026 duas telas amorteciam isso: a de carregamento (800ms)
        // e a de selecao de setor, que esperava um clique. Ambas foram
        // removidas ao unificar o fluxo de setor em /setores. A remocao nao
        // criou a lentidao — tirou o colchao que a escondia, e foi por isso que
        // o problema apareceu naquele momento.
        const { data: profile } = await comTempoLimite(
          supabase
            .from("profiles")
            .select("terms_version, terms_accepted_at")
            .eq("id", user.id)
            .single(),
          "verificar termos de uso",
          10_000,
        );

        if (profile?.terms_version === CURRENT_TERMS_VERSION && profile?.terms_accepted_at) {
          setTermsAccepted(true);
        } else {
          setShowTermsDialog(true);
        }
      } catch (error) {
        // Falha ou tempo esgotado NAO bloqueia o acesso: exibir o dialogo de
        // termos e o comportamento seguro — o medico aceita de novo e segue.
        // Travar a tela em branco por causa de uma consulta de termos deixaria
        // o plantao sem sistema.
        console.error("[Arsen] falha ao verificar termos:", error);
        setShowTermsDialog(true);
      } finally {
        setCheckingTerms(false);
      }
    };

    if (user && !loading) {
      checkTermsAcceptance();
    }
  }, [user, loading, isLegacyGenericUser]);

  // Aquecimento das rotas clinicas: so com sessao. Antes rodava no App, ou
  // seja, ja na tela de login — a rede ficava ocupada baixando 1,18 MB de
  // telas que o usuario ainda nem tinha direito de ver.
  useEffect(() => {
    if (!loading && user) startIdlePrefetch();
  }, [loading, user]);

  useEffect(() => {
    if (!loading && !user) {
      // Limpar flags de sessão ao deslogar
      try { sessionStorage.removeItem("access_limits_shown"); } catch {}
      navigate("/auth");
    } else if (!loading && user && !hasShownLoading) {
      // Sem tela de carregamento aqui: o AuthPage ja mostra uma ao autenticar,
      // e esta aparecia logo depois — dois carregamentos seguidos antes de uma
      // tela (/setores) que nao busca nada e abre instantanea.
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
  // A escolha de setor acontece em /setores, para onde medico e multi pousam
  // depois do login. O AccessLimitsScreen fazia a MESMA pergunta antes, entao
  // o profissional via duas telas de selecao em sequencia -- e a antiga vinha
  // primeiro, precedida de um carregamento. Desligado para todos os perfis.

  // Enquanto a sessao e os termos sao verificados, mostra o splash — nao uma
  // tela BRANCA. Devolver null aqui era o que fazia a plataforma "nao
  // carregar": sem spinner, sem mensagem, sem pista de que algo estava em
  // andamento. Uma tela em branco nao distingue "carregando" de "quebrou".
  if (loading || checkingTerms) {
    return <PageLoader message="Entrando na plataforma…" />;
  }

  // Sem sessao: o efeito acima ja redireciona para /auth. O splash evita o
  // piscar de tela branca durante o redirecionamento.
  if (!user) {
    return <PageLoader message="Entrando na plataforma…" />;
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
    return <Suspense fallback={null}><PendingApprovalScreen /></Suspense>;
  }

  // Envolver com SessionTimeoutProvider para ativar timeout LGPD/CFM
  return (
    <SessionTimeoutProvider>
      <ProfileIpGate>{children}</ProfileIpGate>
    </SessionTimeoutProvider>
  );
}
