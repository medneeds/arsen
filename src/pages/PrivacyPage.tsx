import { MainLayout } from "@/components/MainLayout";
import { DataPrivacyPanel } from "@/components/DataPrivacyPanel";

export default function PrivacyPage() {
  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Privacidade e Proteção de Dados</h1>
          <p className="text-muted-foreground">
            Gerencie seus consentimentos e exerça seus direitos conforme a LGPD
          </p>
        </div>
        <DataPrivacyPanel />
      </div>
    </MainLayout>
  );
}
