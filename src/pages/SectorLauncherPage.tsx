import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bed, Building2, Check, LogOut } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PageLoader } from "@/components/PageLoader";
import { PatientQuickSearch } from "@/components/PatientQuickSearch";
import { usePatientSearchNavigation } from "@/hooks/usePatientSearchNavigation";

import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import {
  useDepartment,
  DEPARTMENT_TO_SECTOR,
  type Department,
} from "@/contexts/DepartmentContext";
import { isDepartmentLocked, LOCKED_TOOLTIP } from "@/config/lockedSectors";
import { SECTOR_ROUTES } from "@/config/clinicalSectors";
import { useSectorNavigation } from "@/hooks/useSectorNavigation";
import { whitelabel } from "@/config/whitelabel";
import { safeGetItem } from "@/lib/safeStorage";
import { cn } from "@/lib/utils";

/**
 * Tela de entrada do perfil clinico: escolha do setor do plantao.
 *
 * Identidade visual: esta e a PRIMEIRA tela depois do login, entao precisa
 * parecer o Arsen e nao um portal a parte. Reaproveita o vocabulario das telas
 * clinicas — faixa institucional com o gradiente navy do BreadcrumbBar, Card
 * com bg-card/80 e backdrop-blur, icones em rounded-lg sobre bg-primary/10 e a
 * mesma grade de quatro colunas do painel de inicio.
 *
 * Nenhuma consulta ao banco para montar a tela: abre instantanea.
 */
export default function SectorLauncherPage() {
  const navigate = useNavigate();
  const { loading: authLoading, signOut, user } = useAuth();
  const { currentHospital } = useHospital();
  const { setCurrentDepartment } = useDepartment();
  const [escolhido, setEscolhido] = useState<Department | null>(null);
  // Setores DIRETO DO BANCO NOVO (alas → setores), agrupados por ala — mesma
  // fonte do seletor do topo. Substitui a lista estática SECTOR_GROUPS.
  const nav = useSectorNavigation();

  /** Setor do ultimo plantao — unico elemento em destaque na grade. */
  const ultimoSetor = useMemo(() => {
    const codigo = safeGetItem("selected_sector", "");
    if (!codigo) return null;
    return (
      (Object.entries(DEPARTMENT_TO_SECTOR).find(([, v]) => v === codigo)?.[0] as
        | Department
        | undefined) ?? null
    );
  }, []);

  const primeiroNome = (() => {
    const nome =
      (user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.username as string | undefined) ||
      "";
    return nome.trim().split(/\s+/)[0] || "";
  })();

  const saudacao = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const entrar = (setor: Department) => {
    if (isDepartmentLocked(setor)) return;
    setEscolhido(setor);
    setCurrentDepartment(setor);
    // Deixa o contexto assentar antes de trocar de rota.
    window.setTimeout(() => navigate(SECTOR_ROUTES[setor] ?? "/"), 120);
  };

  const { irParaSetorDoPaciente, irParaPaciente } = usePatientSearchNavigation({
    onEntrarSetor: setEscolhido,
  });

  if (authLoading) {
    return <PageLoader message="Carregando seu acesso" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        {/* Faixa institucional — mesmo gradiente e tratamento do BreadcrumbBar
            nas telas clinicas, para a entrada pertencer ao mesmo sistema. */}
        <header
          className="relative overflow-hidden rounded-lg sm:rounded-lg shadow-sm px-4 py-4 sm:px-6 sm:py-6"
          style={{
            backgroundImage:
              "linear-gradient(110deg, hsl(var(--primary)) 0%, hsl(210 70% 22%) 55%, hsl(210 75% 18%) 100%)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs sm:text-xs font-medium uppercase tracking-wide text-primary-foreground/70">
                {saudacao}
                {primeiroNome ? `, ${primeiroNome}` : ""}
              </p>
              <h1 className="preserve-case mt-1 text-xl sm:text-2xl font-medium tracking-tight text-primary-foreground">
                Onde você vai atuar hoje?
              </h1>
              <span className="mt-3 inline-flex max-w-full items-center gap-2 rounded-md border border-white/20 bg-white/15 px-3 py-1 text-xs sm:text-xs font-medium text-primary-foreground backdrop-blur">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                <span className="truncate">
                  {currentHospital?.name ?? whitelabel.institution.hospitalName}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle onDark />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="h-9 bg-white/10 text-primary-foreground border border-white/20 backdrop-blur hover:bg-white/20 hover:text-primary-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" aria-hidden />
                Sair
              </Button>
            </div>
          </div>
        </header>

        <PatientQuickSearch
          onIrParaSetor={irParaSetorDoPaciente}
          onIrParaPaciente={irParaPaciente}
        />

        {nav.loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Carregando setores…
          </div>
        ) : nav.isEmpty ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum setor cadastrado para este hospital.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {nav.groups.map((grupo) => (
              <Card
                key={grupo.group}
                className="border-border/60 bg-card/80 backdrop-blur-sm"
              >
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-medium flex items-start gap-2">
                    <span className="h-7 w-7 rounded-lg flex items-center justify-center bg-primary/10 flex-shrink-0">
                      <Bed className="h-4 w-4 text-primary" aria-hidden />
                    </span>
                    <span className="preserve-case leading-tight pt-0.5">{grupo.group}</span>
                  </CardTitle>
                  <p className="pl-9 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {grupo.sectors.length} setores
                  </p>
                </CardHeader>

                <CardContent className="px-3 pb-3">
                  <ul className="grid grid-cols-2 gap-2">
                    {grupo.sectors.map((item) => {
                      const setor = item.name as Department;
                      const bloqueado = isDepartmentLocked(setor);
                      const ultimo = setor === ultimoSetor && !bloqueado;
                      const selecionado = setor === escolhido;
                      const rotulo = item.name;

                      return (
                        <li key={item.name}>
                          <button
                            type="button"
                            disabled={bloqueado}
                            title={bloqueado ? LOCKED_TOOLTIP : rotulo}
                            onClick={() => entrar(setor)}
                            className={cn(
                              "group flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center transition-all",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                              bloqueado
                                ? "cursor-not-allowed border-border/40 bg-muted/30 opacity-60"
                                : ultimo
                                  ? "border-primary/50 bg-primary/5 shadow-sm hover:shadow-md"
                                  : "border-border/60 hover:border-primary/40 hover:bg-muted/40 hover:shadow-md hover:-translate-y-0.5",
                            )}
                          >
                            <span
                              className={cn(
                                "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                                bloqueado
                                  ? "bg-muted text-muted-foreground"
                                  : ultimo
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-primary/10 text-primary group-hover:bg-primary/15",
                              )}
                              aria-hidden
                            >
                              {selecionado ? (
                                <Check className="h-5 w-5" />
                              ) : (
                                <Bed className="h-5 w-5" />
                              )}
                            </span>

                            <span className="flex w-full flex-col items-center gap-0.5">
                              <span className="preserve-case line-clamp-3 text-xs font-medium leading-tight text-foreground">
                                {rotulo}
                              </span>
                              {ultimo && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                                  Último plantão
                                </span>
                              )}
                              {bloqueado && (
                                <span className="text-[10px] text-muted-foreground">
                                  Sem implantação
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="px-1 pb-2 text-xs text-muted-foreground">
          Você pode trocar de setor a qualquer momento pelo seletor no topo das
          telas clínicas.
        </p>
      </div>
    </div>
  );
}
