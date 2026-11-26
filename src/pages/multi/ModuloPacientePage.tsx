import { useSearchParams, Link } from "react-router-dom";
import { Construction, Eye, PenLine, Lock } from "lucide-react";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { PageTransition } from "@/components/PageTransition";
import { ModulePatientStrip } from "@/components/multi/ModulePatientStrip";
import { useAuth } from "@/contexts/AuthContext";
import { usePesoReferencia } from "@/hooks/usePesoReferencia";
import { canWriteModule, getMultiModule, visibleMultiModules, type MultiModuleKey } from "@/config/multiModules";

/** O que cada modulo vai receber nas proximas etapas (mostrado enquanto em construcao). */
const ROADMAP: Record<MultiModuleKey, string[]> = {
  nutricao: ["Avaliação (NRS-2002, antropometria, GET, metas)", "Monitoramento diário em terapia intensiva", "Curva de kcal e proteína ofertadas × meta", "PDF Norma Zero NUT-AVA"],
  fisioterapia: ["Evolução com procedimento SIGTAP", "Bundle PAV por turno", "Dias de VM a partir dos dispositivos", "PDF Norma Zero FIS-EVO"],
  enfermagem: ["Balanço hídrico 24h (07→07) com fechamento e validação", "Aprazamento HMDM e checagem pelo técnico", "Prescrição e evolução de enfermagem, SAE e SBAR", "PDFs Norma Zero ENF-BH, ENF-APZ, ENF-EVO, ENF-SBAR"],
};

/**
 * Tela do modulo multiprofissional no contexto do paciente (?patientId=...).
 * Etapa 2: casca com cabecalho unico, faixa do paciente e modo leitura/registro
 * por papel. O conteudo de cada modulo entra nas etapas seguintes.
 */
export default function ModuloPacientePage({ moduleKey }: { moduleKey: MultiModuleKey }) {
  const mod = getMultiModule(moduleKey);
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId");
  const { role } = useAuth();
  const { peso } = usePesoReferencia(patientId);
  const visivel = visibleMultiModules(role).some((m) => m.key === moduleKey);
  const podeRegistrar = canWriteModule(role, moduleKey);

  return (
    <PageTransition>
      <ClinicalHeader moduleLabel={mod.label} />
      <div className="space-y-4 p-4 md:p-6">
        {!visivel ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" /> Seu perfil não tem acesso ao módulo {mod.label}.
          </div>
        ) : !patientId ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            Nenhum paciente selecionado. Escolha um leito em{" "}
            <Link className="font-semibold text-primary underline-offset-2 hover:underline" to={mod.sectorPath}>{mod.sectorLabel}</Link>.
          </div>
        ) : (
          <>
            <ModulePatientStrip
              patientId={patientId}
              moduleLabel={mod.label}
              tiles={[{ label: "Peso de referência", value: peso.texto, hint: "internacoes.peso_kg — mesma fonte da evolução e dos impressos" }]}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {podeRegistrar
                ? <><PenLine className="h-3.5 w-3.5" /> Você registra neste módulo.</>
                : <><Eye className="h-3.5 w-3.5" /> Modo leitura — o registro é feito pela equipe de {mod.label.toLowerCase()}.</>}
            </div>
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Construction className="h-4 w-4 text-muted-foreground" /> Módulo em construção no ambiente de testes
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {ROADMAP[moduleKey].map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          </>
        )}
      </div>
    </PageTransition>
  );
}
