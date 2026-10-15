import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { Button } from "@/components/ui/button";

/**
 * Moldura padrao dos ambientes de QUALIDADE — mesma identidade do usuario medico:
 * barra azul institucional (SidebarTrigger + HMDM a esquerda) + acoes a direita,
 * com o botao "Inicio" (volta ao dashboard de indicadores). Abaixo, o cabecalho
 * da pagina (icone + titulo) e o conteudo. Mantem o layout coeso entre as telas
 * de Indicadores, Gestao de Leitos e Repositorio.
 */
export function QualidadeShell({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: typeof Home;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-full flex-col">
      <div className="p-2 sm:p-3">
        <BreadcrumbBar
          variant="institutional"
          showSector={false}
          showNavTabs={false}
          actions={
            <div className="flex items-center gap-2">
              {actions}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/indicadores-qualidade")}
                className="h-9 gap-2 border-white/40 bg-white/95 text-foreground shadow-sm hover:bg-white hover:text-primary"
                title="Voltar ao painel de indicadores"
              >
                <Home className="h-4 w-4" /> Início
              </Button>
            </div>
          }
        />
      </div>

      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 pb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
