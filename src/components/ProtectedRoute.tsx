import { useEffect, useState, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { SessionTimeoutProvider } from "./SessionTimeoutProvider";
// Sob demanda: so aparece para usuario com cadastro pendente, mas arrastava
// framer-motion (22 usos) para o pacote de entrada de TODA a aplicacao.
const PendingApprovalScreen = lazy(() =>
  import("./PendingApprovalScreen").then(m => ({ default: m.PendingApprovalScreen })));
import { ConsentTermsDialog, CURRENT_TERMS_VERSION } from "./ConsentTermsDialog";
import { toast } from "sonner";
import { ProfileIpGate } from "./ProfileIpGate";
import { startIdlePrefetch } from "@/lib/prefetchRoutes";
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
  const { user, loading, status, role } = useAuth();
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
      // super_admin não passa pelo fluxo de termos (tabela profiles não existe mais no schema novo).
      if (!user || isLegacyGenericUser || role === "super_admin") {
        setCheckingTerms(false);
        setTermsAccepted(true);
        return;
      }

      // Auditoria 18/09/2026 — duas correcoes aqui:
      //
      // 1) era a terceira consulta identica a `profiles` no caminho de entrada;
      //    agora passa por lerPerfil, que colapsa a rajada do login.
      //
      // 2) o `catch` antigo abria o dialogo de TERMOS quando a consulta falhava.
      //    Com o servidor fora do ar, o medico de plantao recebia um pedido de
      //    aceite de termos em vez de "nao foi possivel conectar" — a tela
      //    mentia sobre a causa, e aceitar ali tentaria gravar num servidor que
      //    nao responde. Falha de leitura agora deixa passar sem travar o
      //    acesso ao prontuario, e registra o erro.
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
        console.error("[Arsen] falha ao verificar termos:", error);
        // DIVERGENCIA RESOLVIDA NO REBASE (18/09/2026) — o commit 7924d17d
        // abria o dialogo de termos aqui, com a intencao de NAO bloquear o
        // acesso. Só que abrir o dialogo bloqueia: mais abaixo,
        // `if (showTermsDialog && !termsAccepted)` devolve o dialogo NO LUGAR
        // dos filhos. E o unico jeito de sair dele e aceitar, o que dispara um
        // insert no mesmo servidor que acabou de falhar — o medico fica preso
        // num dialogo que nao tem como concluir.
        //
        // Por isso: falha de leitura nao abre o dialogo e nao trava o plantao.
        // NAO marcamos termsAccepted — nada e registrado como aceito —, apenas
        // deixamos passar e a checagem roda de novo na proxima entrada.
        setShowTermsDialog(false);
        toast.error("Nao foi possivel verificar os termos de uso", {
          description: "Servidor indisponivel. O acesso segue liberado e a verificacao sera refeita.",
        });
      } finally {
        setCheckingTerms(false);
      }
    };

    if (user && !loading) {
      checkTermsAcceptance();
    }
  }, [user, loading, isLegacyGenericUser, role]);

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

  // super_admin: sem hospital, setor, termos, fila de aprovação nem IP-gate — acesso direto.
  if (role === "super_admin") {
    return <SessionTimeoutProvider>{children}</SessionTimeoutProvider>;
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
