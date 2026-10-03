import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Printer, ClipboardCheck, AlertTriangle, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdmissionForm } from "@/components/admission/AdmissionForm";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { PatientIdentityBar } from "@/components/PatientIdentityBar";
import { PatientCockpit } from "@/components/PatientCockpit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SapsView, type SapsRow } from "@/components/saps3/SapsView";
import { AdmissaoReadOnlyView } from "@/components/admission/AdmissaoReadOnlyView";
import Saps3Page from "@/pages/Saps3Page";
import { printSapsDocument } from "@/lib/printSaps";
import { usePatientLive } from "@/hooks/usePatientLive";
import type { Patient } from "@/types/patient";

// Setores que exigem SAPS 3 (UTI 1 / UTI 2 / UCI 2) — mesmo criterio da alocacao.
const SAPS_SECTORS = ["red", "yellow", "outside"];
const SAPS_SELECT =
  "id, status, pending_since, validado_em, validado_por, escore_box1, escore_box2, escore_box3, escore_total, " +
  "mortalidade_prevista, idade, dias_hospital_antes_uti, origem_admissao, comorbidades, admissao_planejada, " +
  "motivo_admissao, motivo_admissao_detalhe, status_cirurgico, tipo_cirurgia, infeccao_na_admissao, " +
  "escore_glasgow, fc_mais_alta, pas_mais_baixa, temperatura_mais_baixa, bilirrubina_mais_alta, " +
  "creatinina_mais_alta, leucocitos, plaquetas_mais_baixas, ph_mais_baixo, relacao_pao2_fio2, ventilacao_mecanica";

/**
 * Perfis claramente NAO clinicos (porta / recepcao / administrativo) nao podem
 * registrar uma admissao clinica D0. Conservador: bloqueia so o que e
 * inequivocamente de porta/recepcao e permite todos os demais perfis que hoje
 * ja conseguem abrir a admissao pelo Hub.
 */
const DENIED_ACCESS_PROFILES = ["administrativo", "porta", "recepcao"];

interface AdmissaoLocationState {
  patient?: Partial<{
    id: string;
    name: string;
    bed: string;
    sector: string;
    age: string | number;
    department: string;
    patient_registry_id: string | null;
  }>;
  returnTo?: string;
}

export default function AdmissaoPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  // ─── Contexto do paciente — reidratado dos MESMOS search params das outras
  // paginas de modulo (patientSector = CODIGO do setor: red/yellow/uti_01...).
  const patientId = searchParams.get("patientId") || "";
  const patientName = searchParams.get("patientName") || "";
  const patientBed = searchParams.get("patientBed") || "";
  const patientSector = searchParams.get("patientSector") || "";
  const patientAge = searchParams.get("patientAge") || "";
  const state = (location.state ?? null) as AdmissaoLocationState | null;

  // ─── Guarda de permissao — mesmo mecanismo do App.tsx (access_profile em
  // localStorage) + role do AuthContext. Perfil de porta/recepcao nao admite.
  const accessProfile = typeof window !== "undefined"
    ? (localStorage.getItem("access_profile") || "medico")
    : "medico";
  const denied = DENIED_ACCESS_PROFILES.includes(accessProfile) || role === "porta";

  // ─── patient: search params como base, enriquecido pelo state quando presente
  // (state tem prioridade nos campos que trouxer). O AdmissionForm resolve
  // idade/registry por patient.id via usePatientIdentifiers — sem fetch aqui.
  const patient = useMemo(() => {
    const base = {
      id: patientId,
      name: patientName || "",
      bed: patientBed || "",
      sector: patientSector || "",
      age: patientAge || undefined,
      patient_registry_id: null as string | null,
    };
    return state?.patient ? { ...base, ...state.patient } : base;
  }, [patientId, patientName, patientBed, patientSector, patientAge, state]);

  const returnTo = state?.returnTo || (patientId ? `/paciente?patientId=${patientId}` : "/mapa");

  // Linha viva da internacao — traz o admissionStatus derivado (transferencia/
  // saida). Sem isso a tarja de sinalizacao do cockpit sumia na Admissao, porque
  // o cockpitPatient era montado so a partir dos params (sem admissionStatus).
  const { patient: livePatient } = usePatientLive(patient.id || null);

  // ─── Aba SAPS 3 dentro da Admissao (UTI 1/2, UCI 2) — visualizacao completa
  // read-only da ficha ja gravada + impressao apos validacao. A ficha e editada
  // na /saps3; aqui e consulta.
  // Abre SEMPRE na aba Admissao: o tipo de admissao e a tela primaria, e o SAPS
  // e etapa da via Cuidados Intensivos (fica acessivel pela aba, sem preemptar o
  // topo). A navegacao vinda do SAPS validado ja chega para registrar a admissao.
  const [activeTab, setActiveTab] = useState<"admissao" | "saps">("admissao");
  const [sapsRow, setSapsRow] = useState<SapsRow | null>(null);
  // Forca o refetch da sapsRow apos o embute salvar/validar (onEmbeddedDone).
  const [sapsReloadTick, setSapsReloadTick] = useState(0);
  const requiresSaps = SAPS_SECTORS.includes(patient.sector);

  useEffect(() => {
    if (!patientId) { setSapsRow(null); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("avaliacoes_saps3")
        .select(SAPS_SELECT)
        .eq("internacao_id", patientId)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancel) setSapsRow((data as unknown as SapsRow) ?? null);
    })();
    return () => { cancel = true; };
  }, [patientId, activeTab, sapsReloadTick]);

  const showSapsTab = requiresSaps || !!sapsRow;
  // Admissao D0 ja registrada? Internacao ativa COM conteudo clinico (hipotese ou
  // historia). MULTI-ADMISSAO: isso NAO bloqueia mais o formulario — a aba Admissao
  // sempre mostra o AdmissionForm editavel (nova admissao de via a qualquer
  // momento). admissionDone passa a servir apenas para exibir o aviso discreto e
  // liberar a consulta read-only da admissao anterior (AdmissaoReadOnlyView).
  const admissionDone =
    (livePatient?.internmentStatus as unknown as string | null) === "ativa" &&
    (((livePatient?.diagnoses?.length ?? 0) > 0) || ((livePatient?.medicalHistory?.length ?? 0) > 0));
  // Consulta read-only da admissao anterior (opcional) — nao e mais o default.
  const [showPrevious, setShowPrevious] = useState(false);
  const sapsValidada = sapsRow?.status === "validada";

  // Paciente para o Cockpit do trilho direito — mesma harmonizacao dos demais
  // modulos (stub a partir dos params; o Cockpit resolve o resto por id).
  const cockpitPatient: Patient = useMemo(() => ({
    id: patient.id || "admissao-stub",
    bedNumber: patient.bed,
    name: patient.name,
    age: patient.age ? String(patient.age).replace(/\s*anos?$/i, "") : "",
    sector: (patient.sector as Patient["sector"]) || "outside",
    diagnoses: [],
    medicalHistory: [],
    relevantExams: [],
    pendencies: [],
    schedule: [],
    admissionHistory: "",
    admissionDate: "",
    utiAllergies: [],
    clinicalStatus: "regular",
    admissionStatus: livePatient?.admissionStatus,
  }), [patient, livePatient]);

  // ─── Guarda de permissao: perfil de porta/recepcao -> acesso negado
  useEffect(() => {
    if (denied) {
      toast.error("Acesso negado: seu perfil não pode registrar admissões clínicas");
      navigate(returnTo, { replace: true });
    }
  }, [denied, navigate, returnTo]);

  // ─── Guarda de contexto: sem patientId algum (deep-link sem contexto) volta.
  useEffect(() => {
    if (!denied && !patientId) {
      toast.info("Abra a admissão pelo painel do paciente");
      navigate(returnTo, { replace: true });
    }
  }, [denied, patientId, navigate, returnTo]);

  if (denied || !patientId) return null;

  return (
    <div className="print:p-2">
      {/* Shell institucional harmonizado — mesmo cabecalho/abas dos demais modulos */}
      <ClinicalHeader moduleLabel="Admissão" />

      <div className="flex print:block">
        <div className="flex-1 min-w-0 p-3 sm:p-4">
          {/* Sub-cabecalho padrao de identidade (setor resolvido via usePatientLive). */}
          <PatientIdentityBar
            patientId={patientId}
            className="print:hidden rounded-lg border border-border bg-card/60 px-3 py-3 mb-3"
            rightSlot={
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground leading-tight">
                ADMISSÃO
              </p>
            }
          />
          {/* SAPS 3 nao e mais aba solta no topo: o acesso vem de DENTRO da via
              "Cuidados Intensivos" no AdmissionForm (onOpenSaps -> activeTab "saps").
              Aqui so renderizamos o conteudo da ficha quando aberto, com "voltar". */}
          {activeTab === "saps" && showSapsTab ? (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setActiveTab("admissao")} className="h-7 gap-1 text-xs">
                    <ClipboardCheck className="h-3.5 w-3.5" /> Voltar à admissão
                  </Button>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">Ficha SAPS 3</h2>
                </div>
                <div className="flex items-center gap-2">
                  {sapsValidada && sapsRow && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => printSapsDocument(sapsRow, {
                        patientName: patient.name,
                        patientBed: patient.bed,
                        patientSector: patient.sector,
                      })}
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                    </Button>
                  )}
                  {/* Ficha VALIDADA nao pode ser editada — so consulta (SapsView
                      abaixo) e impressao. Quando NAO validada, o formulario e
                      embutido inline (sem abrir a pagina /saps3). */}
                </div>
              </div>
              {sapsValidada && sapsRow ? (
                <SapsView row={sapsRow} />
              ) : (
                // Embute a ficha de preenchimento/validacao do SAPS 3 inline.
                // embedCompleteSapsId: id da ficha pendente (se houver) -> update;
                // sem ele, insere nova ficha ligada a internacao existente, sem
                // alocar leito. onEmbeddedDone re-busca a sapsRow.
                <Saps3Page
                  embedded
                  embedPatientId={patientId}
                  embedPatientName={patientName}
                  embedPatientBed={patientBed}
                  embedPatientSector={patientSector}
                  embedCompleteSapsId={sapsRow?.id}
                  onEmbeddedDone={() => setSapsReloadTick((t) => t + 1)}
                  onEmbeddedGoToAdmission={() => setActiveTab("admissao")}
                />
              )}
            </div>
          ) : (
            // MULTI-ADMISSAO: a aba Admissao SEMPRE mostra o AdmissionForm editavel.
            // Um paciente pode receber varias admissoes (vias) em momentos distintos
            // — cada validacao insere uma nova evolucao __evolution_type:"admission"
            // (novo D0 na timeline do MESMO atendimento) e atualiza os campos da
            // internacao com os mais recentes. As admissoes anteriores permanecem no
            // Historico. Quando ja ha admissao previa, mostramos um aviso discreto e
            // o seed (seedAdmissionFromHistory, interno ao form) pre-preenche a nova.
            <div className="space-y-3">
              {admissionDone && (
                <div className="rounded-lg border border-warning-border bg-warning-soft/40 px-3 py-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 print:hidden">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning-on-soft" />
                  <span className="text-xs text-warning-on-soft">
                    Paciente já admitido — esta é uma <strong>nova admissão de via</strong>; a anterior permanece no histórico.
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPrevious((s) => !s)}
                    className="ml-auto h-7 gap-1 text-xs text-warning-on-soft hover:text-warning-on-soft"
                  >
                    <History className="h-3.5 w-3.5" />
                    {showPrevious ? "Ocultar admissão anterior" : "Ver admissão anterior"}
                  </Button>
                </div>
              )}
              {admissionDone && showPrevious && (
                <div className="rounded-lg border bg-card p-4">
                  <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
                    Admissão anterior (D0) — consulta
                  </h2>
                  <AdmissaoReadOnlyView internacaoId={patientId} />
                </div>
              )}
              <div className="rounded-lg border bg-card overflow-hidden">
                <AdmissionForm
                  embedded
                  patient={patient}
                  sapsRow={sapsRow}
                  onOpenSaps={() => setActiveTab("saps")}
                  onClose={() => navigate(returnTo)}
                  onSuccess={() => toast.success("Admissão hospitalar registrada. Módulos clínicos liberados.")}
                />
              </div>
            </div>
          )}
        </div>

        {/* Cockpit no trilho direito — igual a Evolucao/Prescricao */}
        <PatientCockpit patient={cockpitPatient} />
      </div>
    </div>
  );
}
