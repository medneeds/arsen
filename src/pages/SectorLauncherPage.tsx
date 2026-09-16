import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, LogOut } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import {
  PatientQuickSearch,
  type PacienteEncontrado,
} from "@/components/PatientQuickSearch";

import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import {
  useDepartment,
  DEPARTMENT_TO_SECTOR,
  SECTOR_DISPLAY,
  type Department,
} from "@/contexts/DepartmentContext";
import { isDepartmentLocked, LOCKED_TOOLTIP } from "@/config/lockedSectors";
import {
  SECTOR_GROUPS,
  SECTOR_GROUP_ICONS,
  SECTOR_ICONS,
  SECTOR_ROUTES,
} from "@/config/clinicalSectors";
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

  const irParaSetorDoPaciente = (p: PacienteEncontrado) => {
    if (!p.department) return;
    entrar(p.department);
  };

  /**
   * Painel clinico do paciente. O setor e ajustado ANTES de navegar: sem isso o
   * painel abriria com o contexto do setor anterior e as telas em volta
   * mostrariam a lista de outro lugar.
   */
  const irParaPaciente = (p: PacienteEncontrado) => {
    if (p.department) setCurrentDepartment(p.department);
    const params = new URLSearchParams({
      patientId: p.id,
      patientName: p.name,
      patientBed: p.bedNumber,
      patientSector: p.sectorCode,
    });
    if (p.age) params.set("patientAge", p.age);
    if (p.medicalRecord) params.set("patientRecord", p.medicalRecord);
    window.setTimeout(() => navigate(`/paciente?${params.toString()}`), 120);
  };

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
        </header>

        <PatientQuickSearch
          onIrParaSetor={irParaSetorDoPaciente}
          onIrParaPaciente={irParaPaciente}
        />

        {SECTOR_GROUPS.map((grupo) => {
          const IconeGrupo = SECTOR_GROUP_ICONS[grupo.macro];
          return (
            <Card
              key={grupo.macro}
              className="border-border/60 bg-card/80 backdrop-blur-sm"
            >
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {IconeGrupo && (
                    <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 flex-shrink-0">
                      <IconeGrupo className="h-4 w-4 text-primary" aria-hidden />
                    </span>
                  )}
                  <span className="preserve-case">{grupo.label}</span>
                  <span className="ml-auto text-xs font-medium text-muted-foreground tracking-wider">
                    {grupo.sectors.length} setores
                  </span>
                </CardTitle>
                <p className="text-xs text-muted-foreground pl-8">
                  {grupo.hint}
                </p>
              </CardHeader>

              <CardContent className="px-4 pb-4">
                <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {grupo.sectors.map((setor) => {
                    const Icone = SECTOR_ICONS[setor];
                    const bloqueado = isDepartmentLocked(setor);
                    const ultimo = setor === ultimoSetor && !bloqueado;
                    const selecionado = setor === escolhido;
                    const rotulo =
                      SECTOR_DISPLAY[DEPARTMENT_TO_SECTOR[setor]] ?? setor;

                    return (
                      <li key={setor}>
                        <button
                          type="button"
                          disabled={bloqueado}
                          title={bloqueado ? LOCKED_TOOLTIP : undefined}
                          onClick={() => entrar(setor)}
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            bloqueado
                              ? "cursor-not-allowed border-border/40 bg-muted/30 opacity-60"
                              : ultimo
                                ? "border-primary/40 bg-primary/5 shadow-sm hover:shadow-md"
                                : "border-border/60 hover:border-border hover:bg-muted/40 hover:shadow-md",
                          )}
                        >
                          <span
                            className={cn(
                              "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                              bloqueado
                                ? "bg-muted text-muted-foreground"
                                : ultimo
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-primary/10 text-primary",
                            )}
                            aria-hidden
                          >
                            {selecionado ? (
                              <Check className="h-5 w-5" />
                            ) : Icone ? (
                              <Icone className="h-5 w-5" />
                            ) : null}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="preserve-case block truncate text-sm font-medium text-foreground">
                              {rotulo}
                            </span>
                            {ultimo && (
                              <span className="block text-xs font-medium uppercase tracking-wider text-primary">
                                Último plantão
                              </span>
                            )}
                            {bloqueado && (
                              <span className="block text-xs text-muted-foreground">
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
          );
        })}

        <p className="px-1 pb-2 text-xs text-muted-foreground">
          Você pode trocar de setor a qualquer momento pelo seletor no topo das
          telas clínicas.
        </p>
      </div>
    </div>
  );
}
