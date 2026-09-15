import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Check } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import {
  useDepartment,
  DEPARTMENT_TO_SECTOR,
  SECTOR_DISPLAY,
  type Department,
} from "@/contexts/DepartmentContext";
import { isDepartmentLocked, LOCKED_TOOLTIP } from "@/config/lockedSectors";
import { SECTOR_GROUPS, SECTOR_ICONS, SECTOR_ROUTES } from "@/config/clinicalSectors";
import { whitelabel } from "@/config/whitelabel";
import { safeGetItem } from "@/lib/safeStorage";
import { PageLoader } from "@/components/PageLoader";
import { PatientQuickSearch, type PacienteEncontrado } from "@/components/PatientQuickSearch";

/**
 * Tela de entrada do perfil clinico: escolha do setor em que o profissional
 * vai atuar no plantao.
 *
 * Antes: o departamento era fixado no codigo no login (setCurrentDepartment
 * "UTI") e o setor vinha silenciosamente de localStorage, com "red" (UTI 1) de
 * padrao. Quem trabalhava na enfermaria entrava na UTI sem perceber e so
 * descobria ao estranhar a lista de pacientes.
 *
 * Agora a escolha e explicita e acontece uma vez, logo apos o login.
 *
 * Decisoes de desenho:
 * - Agrupamento pela taxonomia do proprio hospital (a mesma de
 *   user_departments), nao uma grade unica de 20 cards. Estrutura visual que
 *   carrega informacao: o grupo diz que tipo de cuidado se presta ali.
 * - Um unico ponto de destaque: o setor do ultimo plantao. O resto fica quieto.
 * - Nenhuma consulta ao banco. A tela abre instantanea, com dado estatico.
 * - Sem animacao de entrada: movimento so responde a acao de quem usa.
 */
export default function SectorLauncherPage() {
  const navigate = useNavigate();
  const { loading: authLoading, signOut, user } = useAuth();
  const { currentHospital } = useHospital();
  const { setCurrentDepartment } = useDepartment();
  const [escolhido, setEscolhido] = useState<Department | null>(null);

  /** Setor do ultimo plantao — o unico elemento em destaque na tela. */
  const ultimoSetor = useMemo(() => {
    const codigo = safeGetItem("selected_sector", "");
    if (!codigo) return null;
    return (
      (Object.entries(DEPARTMENT_TO_SECTOR).find(([, v]) => v === codigo)?.[0] as
        | Department
        | undefined) ?? null
    );
  }, []);

  /**
   * Todos os setores clinicos, sem filtro por permissao.
   *
   * O corpo clinico atua em qualquer setor do hospital: o medico de plantao e
   * chamado onde precisam dele, e nao ha razao para esconder um destino de quem
   * pode atender ali. Filtrar por user_departments tambem criava um modo de
   * falha ruim — usuario com vinculo vazio ou incompleto ficava sem nenhum card
   * e sem conseguir entrar.
   *
   * Setores sem implantacao ativa continuam visiveis, porem desabilitados: e
   * informacao util saber que existem.
   */
  const grupos = SECTOR_GROUPS;

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

  /** Abre o setor do paciente encontrado, sem abrir o painel dele. */
  const irParaSetorDoPaciente = (p: PacienteEncontrado) => {
    if (!p.department) return;
    entrar(p.department);
  };

  /**
   * Vai direto ao painel clinico do paciente. O setor e ajustado ANTES de
   * navegar: sem isso o painel abriria com o contexto do setor anterior e as
   * telas em volta mostrariam a lista de outro lugar.
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

  const entrar = (setor: Department) => {
    if (isDepartmentLocked(setor)) return;
    setEscolhido(setor);
    setCurrentDepartment(setor);
    // Deixa o estado do contexto assentar antes de trocar de rota.
    window.setTimeout(() => navigate(SECTOR_ROUTES[setor] ?? "/"), 120);
  };

  if (authLoading) {
    return <PageLoader message="Carregando seu acesso" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Cabecalho: quem e a pessoa, onde ela esta, e a pergunta da tela. */}
        <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {saudacao}
              {primeiroNome ? `, ${primeiroNome}` : ""}
            </p>
            <h1 className="preserve-case mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Onde você vai atuar hoje?
            </h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              {currentHospital?.name ?? whitelabel.institution.hospitalName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sair
          </button>
        </header>

        <div className="mb-10">
          <PatientQuickSearch
            onIrParaSetor={irParaSetorDoPaciente}
            onIrParaPaciente={irParaPaciente}
          />
        </div>

        <div className="space-y-10">
            {grupos.map((grupo) => (
              <section key={grupo.macro} aria-labelledby={`grupo-${grupo.macro}`}>
                {/* O titulo do grupo carrega informacao clinica: que tipo de
                    cuidado se presta ali. A regra separa sem enfeitar. */}
                <div className="mb-4 flex items-baseline gap-3">
                  <h2
                    id={`grupo-${grupo.macro}`}
                    className="preserve-case text-sm font-semibold text-foreground"
                  >
                    {grupo.label}
                  </h2>
                  <span className="h-px flex-1 bg-border" aria-hidden />
                  <span className="text-xs text-muted-foreground">
                    {grupo.sectors.length}{" "}
                    {grupo.sectors.length === 1 ? "setor" : "setores"}
                  </span>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">{grupo.hint}</p>

                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {grupo.sectors.map((setor) => {
                    const Icone = SECTOR_ICONS[setor];
                    const bloqueado = isDepartmentLocked(setor);
                    const ultimo = setor === ultimoSetor;
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
                          className={[
                            "group flex w-full items-center gap-3 rounded-lg border px-4 py-4 text-left transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            bloqueado
                              ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
                              : ultimo
                                ? "border-accent bg-accent/10 hover:bg-accent/15"
                                : "border-border bg-card hover:border-primary/40 hover:bg-secondary",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                              ultimo
                                ? "bg-accent text-accent-foreground"
                                : "bg-secondary text-primary",
                            ].join(" ")}
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
                            {ultimo && !bloqueado && (
                              <span className="block text-xs text-muted-foreground">
                                Seu último plantão
                              </span>
                            )}
                            {bloqueado && (
                              <span className="block text-xs text-muted-foreground">
                                Sem implantação ativa
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
          ))}
        </div>

        <p className="mt-12 max-w-prose text-xs text-muted-foreground">
          Você pode trocar de setor a qualquer momento pelo seletor no topo das
          telas clínicas.
        </p>
      </div>
    </div>
  );
}
