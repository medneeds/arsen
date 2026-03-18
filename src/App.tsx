import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/MainLayout";
import { PrivacyProvider } from "@/contexts/PrivacyContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useState } from "react";
import ResourcesPage from "./pages/ResourcesPage";
import MedicalCodesPage from "./pages/MedicalCodesPage";
import HandoversPage from "./pages/HandoversPage";
import VersionsPage from "./pages/VersionsPage";
import DocumentsPage from "./pages/DocumentsPage";
import SepsisProtocolPage from "./pages/SepsisProtocolPage";
import TomografiasPage from "./pages/TomografiasPage";
import HemoderivadosPage from "./pages/HemoderivadosPage";
import RegulacoesPage from "./pages/RegulacoesPage";
import OpmePage from "./pages/OpmePage";
import AltoCustoPage from "./pages/AltoCustoPage";
import SadtPage from "./pages/SadtPage";
import MovementsPage from "./pages/MovementsPage";
import AuthPage from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";
import IAPage from "./pages/IAPage";
import InternmentHistoryPage from "./pages/InternmentHistoryPage";
import DashboardPage from "./pages/DashboardPage";
import PriorizacaoCirurgicaPage from "./pages/PriorizacaoCirurgicaPage";
import ControleGlicemicoPage from "./pages/ControleGlicemicoPage";
import CuidadosPaliativosPage from "./pages/CuidadosPaliativosPage";
import FluxoPaliativacaoPage from "./pages/FluxoPaliativacaoPage";
import DhdDashboardPage from "./pages/DhdDashboardPage";
import DhdRegistrationPage from "./pages/DhdRegistrationPage";
import DhdHistoryPage from "./pages/DhdHistoryPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import UserManagementPage from "./pages/UserManagementPage";
import PrivacyPage from "./pages/PrivacyPage";
import AdminStatesPage from "./pages/AdminStatesPage";
import AdminUnitsPage from "./pages/AdminUnitsPage";
import AdminCoordinatorsPage from "./pages/AdminCoordinatorsPage";
import TherapeuticTemplatesPage from "./pages/TherapeuticTemplatesPage";
import RoundPage from "./pages/RoundPage";
import RelatorioPage from "./pages/RelatorioPage";
import RequisicaoUnificadaPage from "./pages/RequisicaoUnificadaPage";
import PrescricaoPage from "./pages/PrescricaoPage";
import EvolucaoPage from "./pages/EvolucaoPage";
import MedicationCatalogPage from "./pages/MedicationCatalogPage";
import GestorPanelPage from "./pages/GestorPanelPage";
import ValidacaoFarmaceuticaPage from "./pages/ValidacaoFarmaceuticaPage";
import PainelClinicoPage from "./pages/PainelClinicoPage";
import SetorImagemPage from "./pages/SetorImagemPage";

const queryClient = new QueryClient();

const App = () => {
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  
  return (
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/painel-clinico"
            element={
              <ProtectedRoute>
                <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                  <PainelClinicoPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/resources"
            element={
              <ProtectedRoute>
                <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                  <ResourcesPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
        <Route
          path="/codigos"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <MedicalCodesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/handovers"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <HandoversPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/versions"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <VersionsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <MainLayout>
                <DocumentsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sepsis-protocol"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <SepsisProtocolPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/controle-glicemico"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <ControleGlicemicoPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/cuidados-paliativos"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <CuidadosPaliativosPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/fluxo-paliativacao"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <FluxoPaliativacaoPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/tomografias"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <TomografiasPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/hemoderivados"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <HemoderivadosPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/regulacoes"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <RegulacoesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/opme"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <OpmePage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/alto-custo"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <AltoCustoPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/sadt"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <SadtPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/priorizacao-cirurgica"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <PriorizacaoCirurgicaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/movements"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <MovementsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ia"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <IAPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/internment-history"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <InternmentHistoryPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <DashboardPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dhd"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <DhdDashboardPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dhd/cadastro"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <DhdRegistrationPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dhd/historico"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <DhdHistoryPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-management"
          element={
            <ProtectedRoute>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/privacy"
          element={
            <ProtectedRoute>
              <PrivacyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/states"
          element={
            <ProtectedRoute>
              <AdminStatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/units"
          element={
            <ProtectedRoute>
              <AdminUnitsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/coordinators"
          element={
            <ProtectedRoute>
              <AdminCoordinatorsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/therapeutic-templates"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <TherapeuticTemplatesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/round"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <RoundPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/relatorio"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <RelatorioPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/requisicoes"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <RequisicaoUnificadaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/requisicao/laboratorio" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RequisicaoUnificadaPage /></MainLayout></ProtectedRoute>} />
        <Route path="/requisicao/imagens" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RequisicaoUnificadaPage /></MainLayout></ProtectedRoute>} />
        <Route path="/requisicao/parecer" element={<ProtectedRoute><MainLayout onOpenHandover={() => setIsHandoverOpen(true)}><RequisicaoUnificadaPage /></MainLayout></ProtectedRoute>} />
        <Route
          path="/prescricao"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <PrescricaoPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/evolucao"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <EvolucaoPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogo-medicamentos"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <MedicationCatalogPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-gestor"
          element={
            <ProtectedRoute>
              <GestorPanelPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/validacao-farmaceutica"
          element={
            <ProtectedRoute>
              <MainLayout onOpenHandover={() => setIsHandoverOpen(true)}>
                <ValidacaoFarmaceuticaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
      </PrivacyProvider>
  </QueryClientProvider>
  );
};

export default App;
