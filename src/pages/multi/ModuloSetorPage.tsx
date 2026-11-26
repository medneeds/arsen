import { useNavigate } from "react-router-dom";
import { BedDouble, Lock, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { usePatients } from "@/hooks/usePatients";
import { getMultiModule, visibleMultiModules, MEU_PLANTAO_PATH, type MultiModuleKey } from "@/config/multiModules";

/**
 * Tela do modulo no contexto do SETOR (sem paciente): lista da nutricao, mapa
 * da fisioterapia, painel do enfermeiro e "Meu plantao" do tecnico.
 *
 * Etapa 2: cabecalho unico (variante setor, com SectorSelector) e a lista de
 * leitos ocupados do setor — mesma fonte do mapa (usePatients, mesmo escopo do
 * Painel Clinico) — levando ao modulo do paciente. Indicadores por leito
 * (pendencias, BH, NEWS2, bundle) entram nas etapas de cada modulo.
 */
export default function ModuloSetorPage({ moduleKey, meuPlantao = false }: { moduleKey: MultiModuleKey; meuPlantao?: boolean }) {
  const mod = getMultiModule(moduleKey);
  const navigate = useNavigate();
  const { role } = useAuth();
  const { currentDepartment, currentSectorCode } = useDepartment();
  const scopedDepartment = currentSectorCode ? undefined : currentDepartment;
  const scopedSector = currentSectorCode || undefined;
  const { patients, isLoading } = usePatients(scopedDepartment, scopedSector);
  const visivel = meuPlantao ? role === "tecnico" || role === "enfermeiro" : visibleMultiModules(role).some((m) => m.key === moduleKey);
  const titulo = meuPlantao ? "Meu plantão" : mod.sectorLabel;
  // Sem setor escolhido o contexto fica vazio: pede o setor em vez de listar o hospital.
  const semSetor = !currentDepartment && !currentSectorCode;

  const ocupados = patients
    .filter((p) => !p.isVacant && p.name)
    .sort((a, b) => String(a.bedNumber).localeCompare(String(b.bedNumber), "pt-BR", { numeric: true }));

  const abrir = (p: (typeof ocupados)[number]) => {
    const qs = new URLSearchParams({
      patientId: p.id,
      patientName: p.name,
      patientBed: String(p.bedNumber ?? ""),
      patientSector: String(p.sector ?? ""),
    });
    navigate(`${mod.path}?${qs.toString()}`);
  };

  return (
    <PageTransition>
      <AppHeader variant="clinical" showSector moduleLabel={titulo} />
      <div className="space-y-4 p-4 md:p-6">
        {!visivel ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" /> Seu perfil não tem acesso a {titulo}.
          </div>
        ) : semSetor ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Selecione o setor no cabeçalho para ver os leitos.
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando leitos…</div>
        ) : ocupados.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Nenhum leito ocupado neste setor.</div>
        ) : (
          <section className="rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
              <span className="text-xs text-muted-foreground">{ocupados.length} leito(s) ocupado(s)</span>
            </header>
            <ul className="divide-y divide-border">
              {ocupados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => abrir(p)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="flex h-9 min-w-[2.75rem] items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-sm font-bold text-primary">
                      {p.bedNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[p.age, primeiroDiagnostico(p.diagnoses)].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                    <BedDouble className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {meuPlantao && visivel && (
          <p className="text-xs text-muted-foreground">
            A escolha dos seus leitos no início do plantão, as tarefas da hora e a checagem entram na etapa de aprazamento e checagem.
          </p>
        )}
      </div>
    </PageTransition>
  );
}

export { MEU_PLANTAO_PATH };

/**
 * Primeiro diagnostico legivel. Ha registros antigos com a lista gravada como
 * texto JSON ('["A","B"]' ou '[]') dentro do array — le como lista.
 */
function primeiroDiagnostico(diagnoses: string[] | undefined): string | null {
  for (const raw of diagnoses ?? []) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    if (t.startsWith("[")) {
      try {
        const arr = JSON.parse(t);
        if (Array.isArray(arr)) {
          const first = arr.map((x) => String(x ?? "").trim()).find(Boolean);
          if (first) return first;
          continue;
        }
      } catch { /* nao era JSON: usa o texto */ }
    }
    return t;
  }
  return null;
}
