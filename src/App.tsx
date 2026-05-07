import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/MainLayout";
import { IpRestricted } from "@/components/IpRestricted";
import { PrivacyProvider } from "@/contexts/PrivacyContext";
import { lazy, Suspense, useState, useEffect } from "react";
import { FloatingThemeToggle } from "@/components/FloatingThemeToggle";
import { PageLoader } from "@/components/PageLoader";
import { startIdlePrefetch } from "@/lib/prefetchRoutes";

// Telas críticas (eager): impactam first paint do app
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import LandingPage from "./pages/LandingPage";

// Demais páginas: lazy para reduzir bundle inicial e uso de memória
const SignupRedirectPage = lazy(() => import("./pages/SignupRedirectPage"));
const PreCadastroPage = lazy(() => import("./pages/PreCadastroPage"));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage"));
const MedicalCodesPage = lazy(() => import("./pages/MedicalCodesPage"));
const HandoversPage = lazy(() => import("./pages/HandoversPage"));
const VersionsPage = lazy(() => import("./pages/VersionsPage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const DocumentosPacientePage = lazy(() => import("./pages/DocumentosPacientePage"));
const SepsisProtocolPage = lazy(() => import("./pages/SepsisProtocolPage"));
const TomografiasPage = lazy(() => import("./pages/TomografiasPage"));
const HemoderivadosPage = lazy(() => import("./pages/HemoderivadosPage"));
const RegulacoesPage = lazy(() => import("./pages/RegulacoesPage"));
const MovementsPage = lazy(() => import("./pages/MovementsPage"));
const IAPage = lazy(() => import("./pages/IAPage"));
const InternmentHistoryPage = lazy(() => import("./pages/InternmentHistoryPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const PriorizacaoCirurgicaPage = lazy(() => import("./pages/PriorizacaoCirurgicaPage"));
const ControleGlicemicoPage = lazy(() => import("./pages/ControleGlicemicoPage"));
const CuidadosPaliativosPage = lazy(() => import("./pages/CuidadosPaliativosPage"));
const FluxoPaliativacaoPage = lazy(() => import("./pages/FluxoPaliativacaoPage"));
const DhdDashboardPage = lazy(() => import("./pages/DhdDashboardPage"));
const DhdRegistrationPage = lazy(() => import("./pages/DhdRegistrationPage"));
const DhdHistoryPage = lazy(() => import("./pages/DhdHistoryPage"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const AdminStatesPage = lazy(() => import("./pages/AdminStatesPage"));
const AdminUnitsPage = lazy(() => import("./pages/AdminUnitsPage"));
const AdminCoordinatorsPage = lazy(() => import("./pages/AdminCoordinatorsPage"));
const TherapeuticTemplatesPage = lazy(() => import("./pages/TherapeuticTemplatesPage"));
const RoundPage = lazy(() => import("./pages/RoundPage"));
const RelatorioPage = lazy(() => import("./pages/RelatorioPage"));
const RequisicaoUnificadaPage = lazy(() => import("./pages/RequisicaoUnificadaPage"));
const PrescricaoPage = lazy(() => import("./pages/PrescricaoPage"));
const EvolucaoPage = lazy(() => import("./pages/EvolucaoPage"));
const MovimentacoesPage = lazy(() => import("./pages/MovimentacoesPage"));
const MedicationCatalogPage = lazy(() => import("./pages/MedicationCatalogPage"));
const GestorPanelPage = lazy(() => import("./pages/GestorPanelPage"));
const ValidacaoFarmaceuticaPage = lazy(() => import("./pages/ValidacaoFarmaceuticaPage"));
const PainelClinicoPage = lazy(() => import("./pages/PainelClinicoPage"));
const PacienteHubPage = lazy(() => import("./pages/PacienteHubPage"));
const SetorImagemPage = lazy(() => import("./pages/SetorImagemPage"));
const SetorLaboratorioPage = lazy(() => import("./pages/SetorLaboratorioPage"));
const Saps3Page = lazy(() => import("./pages/Saps3Page"));
const ClinicalDashboardPage = lazy(() => import("./pages/ClinicalDashboardPage"));
const ProtocolosUtiPage = lazy(() => import("./pages/ProtocolosUtiPage"));
const CcihDashboardPage = lazy(() => import("./pages/CcihDashboardPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const TriageQueuePage = lazy(() => import("./pages/TriageQueuePage"));
const TriageQueueTVPage = lazy(() => import("./pages/TriageQueueTVPage"));
const AltaDesfechoPage = lazy(() => import("./pages/AltaDesfechoPage"));
const EmergenciaSectorPage = lazy(() => import("./pages/EmergenciaSectorPage"));
const MonitoramentoClinicoPage = lazy(() => import("./pages/MonitoramentoClinicoPage"));
const RequisicaoImagensPage = lazy(() => import("./pages/RequisicaoImagensPage"));
const FichaAtendimentoPage = lazy(() => import("./pages/FichaAtendimentoPage"));
const NirDashboardPage = lazy(() => import("./pages/NirDashboardPage"));
const UeVerticalPage = lazy(() => import("./pages/UeVerticalPage"));
const UeHorizontalPage = lazy(() => import("./pages/UeHorizontalPage"));
const DevConsolePage = lazy(() => import("./pages/DevConsolePage"));
const HistoricoPacientePage = lazy(() => import("./pages/HistoricoPacientePage"));
const ApresentacaoPage = lazy(() => import("./pages/ApresentacaoPage"));
const IpAllowlistPage = lazy(() => import("./pages/admin/IpAllowlistPage"));

// React Query: defaults conservadores para reduzir refetch agressivo
// e manter UX fluida em máquinas mais fracas / múltiplos usuários simultâneos.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,        // 5 min: navegação entre páginas usa cache
      gcTime: 30 * 60_000,          // 30 min: mantém dados quentes na sessão
      refetchOnWindowFocus: false,  // evita avalanche de requests ao trocar de aba
      refetchOnMount: false,        // não refetch ao remontar se ainda fresco
      refetchOnReconnect: "always", // reconciliar após queda de rede
      retry: 1,                     // não congelar UI em falhas transientes
    },
  },
});

const PageFallback = () => <PageLoader />;

/** Redirects profile-specific roles to their dedicated panels */
function ProfileHomeRedirect() {
  const profile = typeof window !== "undefined" ? localStorage.getItem("access_profile") || "medico" : "medico";
  if (profile === "ccih") return <Navigate to="/ccih" replace />;
  if (profile === "imagem") return <Navigate to="/setor-imagem" replace />;
  if (profile === "laboratorio") return <Navigate to="/setor-laboratorio" replace />;
  if (profile === "administrativo") return <Navigate to="/recepcao" replace />;
  if (profile === "multi") return <Navigate to="/triagem-fila" replace />;
  if (profile === "nir") return <Navigate to="/nir" replace />;
  if (profile === "gestor") return <Navigate to="/painel-gestor" replace />;
  if (profile === "farmacia") return <Navigate to="/validacao-farmaceutica" replace />;
  if (profile === "classificacao_risco") return <Navigate to="/triagem-fila" replace />;
  return <ClinicalDashboardPage />;
}

const App = () => {
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);

  useEffect(() => {
    startIdlePrefetch();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/welcome" element={<LandingPage />} />
              <Route path="/apresentacao" element={<ApresentacaoPage />} />
              <Route path="/apresentacao-hmdm" element={<ApresentacaoPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/signup" element={<SignupRedirectPage />} />
              <Route path="/sign-up" element={<SignupRedirectPage />} />
              <Route path="/cadastro" element={<SignupRedirectPage />} />
              <Route path="/pre-cadastro" element={<PreCadastroPage />} />
              <Route path="/" element={<ProtectedRoute><ProfileHomeRedirect /></ProtectedRoute>} />
              <Route path="/mapa" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/painel-clinico" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><PainelClinicoPage /></MainLayout></ProtectedRoute>} />
              <Route path="/paciente" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><PacienteHubPage /></MainLayout></ProtectedRoute>} />
              <Route path="/resources" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><ResourcesPage /></MainLayout></ProtectedRoute>} />
              <Route path="/codigos" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><MedicalCodesPage /></MainLayout></ProtectedRoute>} />
              <Route path="/handovers" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><HandoversPage /></MainLayout></ProtectedRoute>} />
              <Route path="/versions" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><VersionsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><MainLayout><DocumentsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/sepsis-protocol" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><SepsisProtocolPage /></MainLayout></ProtectedRoute>} />
              <Route path="/protocolos-uti" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><ProtocolosUtiPage /></MainLayout></ProtectedRoute>} />
              <Route path="/documents/controle-glicemico" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><ControleGlicemicoPage /></MainLayout></ProtectedRoute>} />
              <Route path="/documents/cuidados-paliativos" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><CuidadosPaliativosPage /></MainLayout></ProtectedRoute>} />
              <Route path="/documents/fluxo-paliativacao" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><FluxoPaliativacaoPage /></MainLayout></ProtectedRoute>} />
              <Route path="/documents/tomografias" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><TomografiasPage /></MainLayout></ProtectedRoute>} />
              <Route path="/documents/hemoderivados" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><HemoderivadosPage /></MainLayout></ProtectedRoute>} />
              <Route path="/documents/regulacoes" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RegulacoesPage /></MainLayout></ProtectedRoute>} />
              <Route path="/documents/priorizacao-cirurgica" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><PriorizacaoCirurgicaPage /></MainLayout></ProtectedRoute>} />
              <Route path="/documents/apac" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RequisicaoImagensPage /></MainLayout></ProtectedRoute>} />
              <Route path="/movements" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><MovementsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/ia" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><IAPage /></MainLayout></ProtectedRoute>} />
              <Route path="/internment-history" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><InternmentHistoryPage /></MainLayout></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><DashboardPage /></MainLayout></ProtectedRoute>} />
              <Route path="/dhd" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><DhdDashboardPage /></MainLayout></ProtectedRoute>} />
              <Route path="/dhd/cadastro" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><DhdRegistrationPage /></MainLayout></ProtectedRoute>} />
              <Route path="/dhd/historico" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><DhdHistoryPage /></MainLayout></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute><AuditLogsPage /></ProtectedRoute>} />
              <Route path="/user-management" element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />
              <Route path="/privacy" element={<ProtectedRoute><PrivacyPage /></ProtectedRoute>} />
              <Route path="/admin/states" element={<ProtectedRoute><AdminStatesPage /></ProtectedRoute>} />
              <Route path="/admin/units" element={<ProtectedRoute><AdminUnitsPage /></ProtectedRoute>} />
              <Route path="/admin/coordinators" element={<ProtectedRoute><AdminCoordinatorsPage /></ProtectedRoute>} />
              <Route path="/therapeutic-templates" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><TherapeuticTemplatesPage /></MainLayout></ProtectedRoute>} />
              <Route path="/round" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RoundPage /></MainLayout></ProtectedRoute>} />
              <Route path="/relatorio" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RelatorioPage /></MainLayout></ProtectedRoute>} />
              <Route path="/requisicoes" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RequisicaoUnificadaPage /></MainLayout></ProtectedRoute>} />
              <Route path="/requisicao/laboratorio" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RequisicaoUnificadaPage /></MainLayout></ProtectedRoute>} />
              <Route path="/requisicao/imagens" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RequisicaoUnificadaPage /></MainLayout></ProtectedRoute>} />
              <Route path="/requisicao/parecer" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RequisicaoUnificadaPage /></MainLayout></ProtectedRoute>} />
              <Route path="/monitoramento" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><MonitoramentoClinicoPage /></MainLayout></ProtectedRoute>} />
              <Route path="/documentos" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><DocumentosPacientePage /></MainLayout></ProtectedRoute>} />
              <Route path="/prescricao" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><PrescricaoPage /></MainLayout></ProtectedRoute>} />
              <Route path="/evolucao" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><EvolucaoPage /></MainLayout></ProtectedRoute>} />
              <Route path="/movimentacoes" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><MovimentacoesPage /></MainLayout></ProtectedRoute>} />
              <Route path="/catalogo-medicamentos" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><MedicationCatalogPage /></MainLayout></ProtectedRoute>} />
              <Route path="/painel-gestor" element={<ProtectedRoute><IpRestricted moduleKey="gestor" moduleLabel="Painel Gestor"><GestorPanelPage /></IpRestricted></ProtectedRoute>} />
              <Route path="/validacao-farmaceutica" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><IpRestricted moduleKey="validacao_farmaceutica" moduleLabel="Validação Farmacêutica"><ValidacaoFarmaceuticaPage /></IpRestricted></MainLayout></ProtectedRoute>} />
              <Route path="/setor-imagem" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><SetorImagemPage /></MainLayout></ProtectedRoute>} />
              <Route path="/setor-laboratorio" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><SetorLaboratorioPage /></MainLayout></ProtectedRoute>} />
              <Route path="/saps3" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><Saps3Page /></MainLayout></ProtectedRoute>} />
              <Route path="/ccih" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><CcihDashboardPage /></MainLayout></ProtectedRoute>} />
              <Route path="/nir" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><NirDashboardPage /></MainLayout></ProtectedRoute>} />
              <Route path="/recepcao" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
              <Route path="/triagem-fila" element={<ProtectedRoute><TriageQueuePage /></ProtectedRoute>} />
              <Route path="/triagem-tv" element={<ProtectedRoute><TriageQueueTVPage /></ProtectedRoute>} />
              <Route path="/alta-desfecho" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><AltaDesfechoPage /></MainLayout></ProtectedRoute>} />
              <Route path="/emergencia" element={<ProtectedRoute><EmergenciaSectorPage /></ProtectedRoute>} />
              <Route path="/ue-vertical" element={<ProtectedRoute><UeVerticalPage /></ProtectedRoute>} />
              <Route path="/ue-horizontal" element={<ProtectedRoute><UeHorizontalPage /></ProtectedRoute>} />
              <Route path="/ficha-atendimento" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><FichaAtendimentoPage /></MainLayout></ProtectedRoute>} />
              <Route path="/historico-paciente" element={<ProtectedRoute><HistoricoPacientePage /></ProtectedRoute>} />
              <Route path="/dev-console" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><DevConsolePage /></MainLayout></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <FloatingThemeToggle />
        </TooltipProvider>
      </PrivacyProvider>
    </QueryClientProvider>
  );
};

export default App;
