import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Info } from "lucide-react";

// MIGRAÇÃO: a tabela `states` (catálogo de UF) foi removida no schema novo e
// NÃO tem equivalente. `setores` existe, mas modela setores assistenciais do
// hospital (nome/tipo/ala_id) — semântica totalmente diferente de "estado/UF"
// e exige ala_id (FK real), não sendo um destino honesto para este catálogo.
// Decisão: DEGRADAR (esconder) a página — nenhum acesso a tabela morta, apenas
// um aviso de indisponibilidade. O conceito de UF já foi removido de
// AdminUnitsPage/HospitalContext/AdminCoordinatorsPage.
export default function AdminStatesPage() {
  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Gerenciar Estados
          </h1>
          <p className="text-muted-foreground">
            Cadastro de estados onde a plataforma opera
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Recurso indisponível
            </CardTitle>
            <CardDescription>
              O catálogo de estados (UF) não faz parte desta versão do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              A estrutura de dados foi reorganizada e o conceito de estado/UF não
              é mais utilizado no cadastro de unidades hospitalares. As unidades
              são gerenciadas diretamente em <strong>Gerenciar Unidades
              Hospitalares</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
