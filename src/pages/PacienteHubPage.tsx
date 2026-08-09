import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pill, Stethoscope, ClipboardList, FolderOpen, History, ClipboardCheck, Lock, CheckCircle2, AlertTriangle, Printer, ShieldCheck, Timer, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { AdmissionDialog } from "@/components/AdmissionDialog";
import { AdmissionConsultDialog } from "@/components/AdmissionConsultDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { printAdmissionNormaZero } from "@/lib/printAdmission";
import { resolveCurrentBedSector } from "@/lib/resolvePatientHeader";
import { useHospital } from "@/contexts/HospitalContext";
import { usePatientIdentifiers } from "@/hooks/usePatientIdentifiers";
import { useCockpitPatient } from "@/hooks/useCockpitPatient";
import { usePatientPendingItems } from "@/hooks/usePatientPendingItems";
import { PatientCockpit } from "@/components/PatientCockpit";
import { PatientMovementDialog } from "@/components/PatientMovementDialog";
import { getSectorLabel } from "@/lib/sectorUtils";
import type { AdmissionStatus as CanonicalAdmissionStatus } from "@/lib/admissionStatus";

// O tipo local declarava apenas "pre_admitido" | "admitido" | "suspenso", mas
// `setAdmissionStatus` recebe o valor cru de patients.admission_status — que
// em runtime tambem vale obito, alta_dada e os dois de transferencia. O tipo
// mentia, e por isso o card de Sinalizacao nao compilava ao ler esses estados.
// Passa a usar o union canonico de src/lib/admissionStatus.ts, que ja existe
// justamente para ser a fonte unica desses literais (auditoria de 22/07/2026).
type AdmissionStatus = CanonicalAdmissionStatus | "suspenso" | null;

const SAPS_DEADLINE_MS = 24 * 60 * 60 * 1000;

const CLINICAL_ACTIONS = [
  { key: "prescricao", label: "Prescrição", icon: Pill, path: "/prescricao" },
  { key: "evolucao", label: "Evolução", icon: Stethoscope, path: "/evolucao" },
  { key: "requisicoes", label: "Requisições", icon: ClipboardList, path: "/requisicoes" },
  { key: "docs", label: "Docs", icon: FolderOpen, path: "/documentos" },
  { key: "historico", label: "Histórico", icon: History, path: "/historico-paciente" },
];

const formatElapsed = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const draftKeyForRegistry = (registryId: string) => `admission_draft:v2:${registryId}`;

export default function PacienteHubPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { currentHospital } = useHospital();

  // Cockpit — mesma fonte (searchParams) e mesma variante "fixed" das outras
  // sete paginas de paciente. O Hub era a UNICA sem ele, e era justamente onde
  // o usuario comeca: para sinalizar uma movimentacao ou desfecho ele
  // precisava abrir um modulo clinico qualquer so para alcancar o cockpit que
  // mora la.
  const cockpitPatient = useCockpitPatient();
  const [movementOpen, setMovementOpen] = useState(false);



  const ctx = useMemo(() => ({
    patientId: params.get("patientId") || "",
    patientName: params.get("patientName") || "",
    patientBed: params.get("patientBed") || "",
    patientSector: params.get("patientSector") || "",
    patientAge: params.get("patientAge") || "",
    // Pré-preenchidos pelo caller para evitar delay de fetchStatus
    initialAdmissionStatus: (params.get("admissionStatus") || null) as AdmissionStatus,
  }), [params]);

  const identifiers = usePatientIdentifiers(ctx.patientId, ctx.patientName, currentHospital?.id || null);
  const registryId = identifiers.registry?.id ?? null;

  /**
   * Requisicoes pendentes — reusa o hook que a aba "Exames" do cockpit ja usa,
   * com assinatura realtime. Nenhuma consulta nova: a contagem que aparece no
   * card e exatamente a mesma que o cockpit mostra, e atualiza sozinha quando
   * o laboratorio conclui um exame.
   */
  const { summary: pendingSummary } = usePatientPendingItems(
    ctx.patientId || null,
    ctx.patientName || null,
    currentHospital?.id || null,
  );
  const pendingRequests = pendingSummary.pendingExams + pendingSummary.pendingCultures;

  /**
   * Houve evolucao hoje? Consulta leve (select id, limit 1).
   *
   * Filtra por patient_registry_id quando existe, e so cai em patient_id na falta
   * dele: `patients` e a tabela de LEITOS, entao patient_id muda a cada
   * transferencia — o mesmo detalhe que ja causou bug de reabertura de
   * atendimento neste projeto. patient_registry_id acompanha a pessoa.
   */
  const [evolvedToday, setEvolvedToday] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ctx.patientId && !registryId) { setEvolvedToday(null); return; }
      const inicioDoDia = new Date();
      inicioDoDia.setHours(0, 0, 0, 0);
      let q = supabase
        .from("clinical_evolutions")
        .select("id")
        .gte("created_at", inicioDoDia.toISOString())
        .limit(1);
      q = registryId ? q.eq("patient_registry_id", registryId) : q.eq("patient_id", ctx.patientId);
      const { data, error } = await q;
      if (cancelled) return;
      // Erro nao vira "nao evoluiu": ficaria afirmando algo falso sobre o
      // prontuario. Sem resposta confiavel, o card fica neutro.
      setEvolvedToday(error ? null : (data?.length ?? 0) > 0);
    })();
    return () => { cancelled = true; };
  }, [ctx.patientId, registryId]);

  // Usar status passado pela URL como valor inicial — evita flash de bloqueio
  const [admissionStatus, setAdmissionStatus] = useState<AdmissionStatus>(
    ctx.initialAdmissionStatus ?? null
  );

  /**
   * Estado de sinalizacao do paciente, para o card refletir a realidade em vez
   * de ser so um atalho. O card de Admissao ja faz isso ("Concluida"), e e o
   * que transforma o Hub de lancador em painel de situacao: quem abre a tela
   * ve, sem clicar, que aquele paciente ja tem obito ou alta sinalizados.
   *
   * Le do `admissionStatus` do PROPRIO hub, nao do cockpitPatient: o hub ja
   * busca esse campo e aplica a regra de effectiveStatus (pre_admitido que ja
   * tem admissao vira admitido). Usar a outra fonte criaria duas verdades para
   * o mesmo dado na mesma tela.
   */
  const signalState = (() => {
    switch (admissionStatus) {
      case "obito":
        return { label: "Óbito sinalizado", tone: "danger" as const };
      case "alta_dada":
        return { label: "Alta sinalizada", tone: "info" as const };
      case "transferencia_externa_pendente":
        return { label: "Transf. externa", tone: "warn" as const };
      case "transferencia_interna_pendente":
        return { label: "Transf. interna", tone: "warn" as const };
      default:
        return null;
    }
  })();
  const [statusLoading, setStatusLoading] = useState(!ctx.initialAdmissionStatus);
  const [admissionOpen, setAdmissionOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [department, setDepartment] = useState<string | null>(null);
  const [sapsPending, setSapsPending] = useState(false);
  const [sapsSince, setSapsSince] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [hasDraft, setHasDraft] = useState(false);

  // Detecta rascunho local de admissão para o paciente atual
  useEffect(() => {
    if (!registryId) {
      setHasDraft(false);
      return;
    }
    const check = () => {
      try {
        setHasDraft(!!localStorage.getItem(draftKeyForRegistry(registryId)));
      } catch { setHasDraft(false); }
    };
    check();
    const onStorage = (e: StorageEvent) => {
      if (e.key === draftKeyForRegistry(registryId)) check();
    };
    window.addEventListener("storage", onStorage);
    const t = setInterval(check, 1500);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(t); };
  }, [registryId, admissionOpen]);

  const fetchStatus = async () => {
    if (!ctx.patientId) { setStatusLoading(false); return; }
    setStatusLoading(true);
    const { data } = await supabase
      .from("patients")
      .select("admission_status, department, saps_pending, saps_pending_since, saps_completed_at")
      .eq("id", ctx.patientId)
      .maybeSingle();
    const row: any = data || {};
    let effectiveStatus: AdmissionStatus = (row.admission_status as AdmissionStatus) ?? "admitido";
    setDepartment(row.department ?? null);

    // Defesa em profundidade (self-heal admissão):
    // Se patients.admission_status='pre_admitido' mas existe admission_histories
    // ATIVA (não arquivada) com CID primário E HDA preenchidos, a admissão clínica
    // foi de fato concluída — promove para 'admitido' na UI e cura o flag silenciosamente.
    // Mesmo padrão do self-heal de SAPS abaixo. Não toca movimentação nem layout.
    if (effectiveStatus === "pre_admitido") {
      const regId = identifiers.registry?.id;
      if (regId) {
        const { data: ah } = await supabase
          .from("admission_histories")
          .select("id, cid_primary, clinical_history")
          .eq("patient_registry_id", regId)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const a: any = ah || null;
        if (a && a.cid_primary && a.clinical_history && String(a.clinical_history).trim().length > 0) {
          effectiveStatus = "admitido";
          supabase
            .from("patients")
            .update({ admission_status: "admitido" } as any)
            .eq("id", ctx.patientId)
            .then(() => { /* self-heal silencioso */ });
        }
      }
    }

    setAdmissionStatus(effectiveStatus);

    let stillPending = !!row.saps_pending && !row.saps_completed_at;

    // Defesa em profundidade: se patients.saps_pending estiver preso (residual),
    // checa se existe ficha SAPS 3 'completed' do paciente — se sim, libera o gate
    // clínico e cura o flag silenciosamente (self-heal).
    if (stillPending) {
      const { data: sapsRow } = await supabase
        .from("saps3_assessments" as any)
        .select("id")
        .eq("patient_id", ctx.patientId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sapsRow) {
        stillPending = false;
        supabase
          .from("patients")
          .update({ saps_pending: false, saps_completed_at: new Date().toISOString() } as any)
          .eq("id", ctx.patientId)
          .then(() => { /* self-heal silencioso */ });
      }
    }

    setSapsPending(stillPending);
    setSapsSince(row.saps_pending_since ?? null);
    setStatusLoading(false);
  };

  useEffect(() => { fetchStatus(); }, [ctx.patientId, registryId]);

  // Cronômetro vivo
  useEffect(() => {
    if (!sapsPending) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sapsPending]);

  const isPreAdmitted = admissionStatus === "pre_admitido";
  const isAdmitted = admissionStatus === "admitido";

  // Cálculo SAPS
  const sapsElapsedMs = sapsSince ? now - new Date(sapsSince).getTime() : 0;
  const sapsExpired = sapsPending && sapsElapsedMs > SAPS_DEADLINE_MS;
  const sapsRemainingMs = SAPS_DEADLINE_MS - sapsElapsedMs;

  const goTo = (path: string) => {
    const qs = new URLSearchParams();
    Object.entries(ctx).forEach(([k, v]) => v && qs.set(k, v));
    navigate(`${path}?${qs.toString()}`);
  };

  const handleLockedClick = (reason: "preadmission" | "saps_expired") => {
    if (reason === "preadmission") {
      toast.warning("Conclua a admissão hospitalar para liberar este módulo", {
        description: "Clique em ADMISSÃO para iniciar o registro D0.",
      });
    } else {
      toast.error("Ficha SAPS 3 vencida — módulos clínicos bloqueados", {
        description: "Finalize a SAPS 3 para reabrir prescrição, evolução, requisições, docs e histórico.",
      });
    }
  };

  const handleGoSaps = async () => {
    const qs = new URLSearchParams();
    Object.entries(ctx).forEach(([k, v]) => v && qs.set(k, v));
    // Busca a ficha SAPS pendente do paciente para abrir direto no formulário (caminho A)
    if (ctx.patientId || ctx.patientName) {
      try {
        let sapsId: string | null = null;

        // Tentativa 1: por patient_id (ideal)
        if (ctx.patientId) {
          const { data } = await supabase
            .from("saps3_assessments" as any)
            .select("id")
            .eq("patient_id", ctx.patientId)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          sapsId = (data as any)?.id || null;
        }

        // Tentativa 2 (fallback p/ fichas legadas com patient_id NULL): por nome
        if (!sapsId && ctx.patientName) {
          const { data } = await supabase
            .from("saps3_assessments" as any)
            .select("id")
            .ilike("patient_name", ctx.patientName.trim())
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          sapsId = (data as any)?.id || null;
        }

        if (sapsId) qs.set("completeSapsId", sapsId);
        else qs.set("fromAllocation", "true"); // fallback caminho B
      } catch {
        qs.set("fromAllocation", "true");
      }
    }
    navigate(`/saps3?${qs.toString()}`);
  };

  const handlePrintAdmission = async () => {
    if (!ctx.patientId || !registryId) return;
    const { data: ev } = await supabase
      .from("clinical_evolutions")
      .select("soap_data, vital_signs, physical_exam, validated_by_name, created_at")
      .eq("patient_registry_id", registryId)
      .eq("evolution_type", "admission")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: ah } = await supabase
      .from("admission_histories")
      .select("cid_primary, cid_secondary, clinical_history, initial_conduct")
      .eq("patient_registry_id", registryId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const soap: any = (ev as any)?.soap_data || {};
    const vs: any = (ev as any)?.vital_signs || {};
    const pe: any = (ev as any)?.physical_exam || {};
    const a: any = ah || {};

    // Leito/setor ATUAIS (após relocações), com fallback para o que veio em ctx.
    const live = await resolveCurrentBedSector(ctx.patientId);
    await printAdmissionNormaZero({
      patient: {
        name: ctx.patientName,
        bed: live.bed || ctx.patientBed,
        sector: live.sector || ctx.patientSector,
        age: ctx.patientAge,
      },
      identifiers: {
        prontuario: identifiers.prontuario,
        atendimento: identifiers.atendimento,
        socialName: identifiers.registry?.socialName || null,
        cpf: identifiers.registry?.cpf || null,
        cns: identifiers.registry?.cns || null,
        birthDate: identifiers.registry?.birthDate || null,
        sex: identifiers.registry?.sex || null,
        motherName: identifiers.registry?.motherName || null,
        address: [
          identifiers.registry?.address,
          identifiers.registry?.neighborhood,
          identifiers.registry?.city && identifiers.registry?.state
            ? `${identifiers.registry.city}/${identifiers.registry.state}`
            : identifiers.registry?.city || identifiers.registry?.state,
        ].filter(Boolean).join(" — ") || null,
        phone: identifiers.registry?.phone || null,
      },
      hospitalName: currentHospital?.name,
      doctorName: (ev as any)?.validated_by_name || "Médico Assistente",
      isUti: ["red", "yellow", "blue", "outside", "uti_01", "uti_02", "uci_01", "uci_02"].includes(ctx.patientSector),
      hda: a.clinical_history || soap.subjective || "",
      vitals: { pa: vs.pa, fc: vs.fc, fr: vs.fr, spo2: vs.spo2, tax: vs.temp, dx: vs.dx },
      exam: { general: pe.general, cv: pe.cardiovascular, resp: pe.respiratory, abd: pe.abdomen, ext: pe.extremities },
      plan: a.initial_conduct || soap.plan || "",
      cidPrimary: a.cid_primary || "",
      cidSecondary: a.cid_secondary,
      dischargePredictionLabel: "—",
      sapsPending,
    });
  };

  const sectorLabel = getSectorLabel(ctx.patientSector);

  const ageDisplay = (() => {
    if (!ctx.patientAge) return "";
    const raw = ctx.patientAge.trim();
    return /anos?/i.test(raw) ? raw : `${raw} anos`;
  })();

  const AdmissionIcon = isAdmitted ? CheckCircle2 : ClipboardCheck;
  // Rascunho de admissão salvo libera os demais módulos (sem bloqueio).
  // SAPS pendente/vencida segue apenas como alerta — não bloqueia evolução/prescrição/etc.
  const lockReason: "preadmission" | "saps_expired" | null =
    isPreAdmitted && !hasDraft ? "preadmission" : null;
  const locked = lockReason !== null;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-2 sm:px-4 pt-3">
        <BreadcrumbBar variant="institutional" />
      </div>

      <div className="flex-1 flex overflow-hidden">
      <main className="flex-1 flex items-center justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-6xl xl:max-w-7xl flex flex-col gap-8">
          {/* Patient identity */}
          <div className="text-center space-y-3">
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-muted-foreground">
              Paciente Selecionado
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight uppercase">
              {ctx.patientName || "—"}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {ctx.patientBed && (
                <span className="px-3 py-1 bg-card border border-border text-muted-foreground text-[11px] font-bold tracking-wider uppercase rounded-sm shadow-sm">
                  Leito {ctx.patientBed}
                </span>
              )}
              {sectorLabel && (
                <span className="px-3 py-1 bg-card border border-border text-muted-foreground text-[11px] font-bold tracking-wider uppercase rounded-sm shadow-sm">
                  {sectorLabel}
                </span>
              )}
              {ageDisplay && (
                <span className="px-3 py-1 bg-card border border-border text-muted-foreground text-[11px] font-bold tracking-wider uppercase rounded-sm shadow-sm">
                  {ageDisplay}
                </span>
              )}
            </div>
          </div>

          {/* Banner pré-admissão */}
          {isPreAdmitted && !statusLoading && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-4 flex items-center gap-4 shadow-sm">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <p className="text-amber-900 text-sm tracking-wide">
                <span className="font-bold uppercase text-xs">Paciente Pré-Admitido.</span>{" "}
                Conclua a <span className="font-semibold underline decoration-amber-300 decoration-2 underline-offset-2">admissão hospitalar</span> para liberar prescrição, evolução, requisições, docs e histórico.
              </p>
            </div>
          )}

          {/* Banner SAPS pendente */}
          {isAdmitted && sapsPending && !statusLoading && (
            <div className={cn(
              "rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm",
              sapsExpired
                ? "bg-red-50/80 border-red-300"
                : "bg-amber-50/80 border-amber-300"
            )}>
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md shrink-0",
                sapsExpired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              )}>
                {sapsExpired ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-bold uppercase tracking-wide",
                  sapsExpired ? "text-red-800" : "text-amber-900"
                )}>
                  Ficha SAPS 3 — {sapsExpired ? "PRAZO EXPIRADO" : "Pendente"}
                </p>
                <p className={cn(
                  "text-xs flex items-center gap-1.5 mt-0.5",
                  sapsExpired ? "text-red-700" : "text-amber-800"
                )}>
                  <Timer className="h-3.5 w-3.5" />
                  {sapsExpired ? (
                    <>Pendente há <strong className="font-mono">{formatElapsed(sapsElapsedMs)}</strong> — módulos clínicos bloqueados até a finalização.</>
                  ) : (
                    <>Pendente há <strong className="font-mono">{formatElapsed(sapsElapsedMs)}</strong> • restam <strong className="font-mono">{formatElapsed(Math.max(0, sapsRemainingMs))}</strong> do prazo de 24 h.</>
                  )}
                </p>
              </div>
              <Button size="sm" onClick={handleGoSaps}
                className={cn(
                  "gap-1.5 uppercase tracking-wide text-xs",
                  sapsExpired ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700",
                  "text-white"
                )}>
                <ShieldCheck className="h-3.5 w-3.5" /> Finalizar SAPS 3
              </Button>
            </div>
          )}

          {/* Action grid — 6 cards aspect-square, harmônicos */}
          {/*
            SETE cards (6 modulos + Sinalizacao), reproporcionados:
              base  2 colunas -> 3 linhas de 2 + 1
              sm    4 colunas -> 4 + 3
              xl    7 colunas -> linha unica, e o container abre para max-w-7xl
                                 para os cards nao encolherem (7 em 1152px
                                 daria ~151px cada; em 1280px, ~169px)
            gap menor no mobile (gap-3) porque com 2 colunas o respiro lateral
            ja vem do padding da pagina.

            Sete cards em UMA linha so a partir de xl. O cockpit "fixed" e
            sticky (entra no fluxo, nao sobrepoe): ocupa 44px recolhido e ate
            384px expandido no hover. Com lg:grid-cols-6, passar o mouse nele
            encolhia os cards ~22% num notebook de 1280px — reflow visivel a
            cada hover. Em duas linhas de tres o efeito some.
          */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
            {/* ADMISSÃO — gate */}
            <div className="relative group">
              <button
                onClick={() => isAdmitted ? setConsultOpen(true) : setAdmissionOpen(true)}
                disabled={statusLoading}
                className="relative w-full text-left disabled:cursor-wait"
              >
                {isPreAdmitted && (
                  <span className="absolute -inset-0.5 bg-amber-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-700 animate-pulse pointer-events-none" />
                )}
                <div className={cn(
                  "relative flex flex-col items-center justify-center aspect-square rounded-lg overflow-hidden transition-transform",
                  "bg-card",
                  isPreAdmitted
                    ? "border-2 border-amber-400 shadow-lg group-hover:scale-[1.02]"
                    : isAdmitted
                    ? "border border-emerald-300 group-hover:scale-[1.02] group-hover:shadow-md"
                    : "border border-border group-hover:scale-[1.02] group-hover:shadow-md",
                )}>
                  <span className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    isPreAdmitted ? "bg-amber-400" : isAdmitted ? "bg-emerald-400" : "bg-muted-foreground/30",
                  )} />
                  <div className={cn(
                    "p-3 rounded-xl mb-3",
                    isPreAdmitted ? "bg-amber-50" : isAdmitted ? "bg-emerald-50" : "bg-muted",
                  )}>
                    <AdmissionIcon
                      className={cn(
                        "w-7 h-7",
                        isPreAdmitted ? "text-amber-600" : isAdmitted ? "text-emerald-600" : "text-muted-foreground",
                      )}
                      strokeWidth={1.75}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-foreground tracking-[0.15em] uppercase">
                    Admissão
                  </span>
                  {isPreAdmitted && (
                    <span className="text-[9px] font-semibold text-amber-600 tracking-widest uppercase mt-1">
                      {hasDraft ? "Rascunho em andamento" : "Pendente"}
                    </span>
                  )}
                  {isAdmitted && (
                    <span className="text-[9px] font-semibold text-emerald-600 tracking-widest uppercase mt-1">
                      Concluída
                    </span>
                  )}
                </div>
              </button>

              {/* Atalho rápido: imprimir admissão direto pelo card */}
              {isAdmitted && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handlePrintAdmission(); }}
                  title="Imprimir admissão (Norma Zero)"
                  aria-label="Imprimir admissão"
                  className="absolute top-2 right-2 z-10 inline-flex items-center justify-center h-7 w-7 rounded-md bg-card/95 border border-emerald-200 text-emerald-700 shadow-sm hover:bg-emerald-50 hover:scale-105 transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Demais ações */}
            {CLINICAL_ACTIONS.map(({ key, label, icon: Icon, path }) => (
              <button
                key={key}
                onClick={() => locked ? handleLockedClick(lockReason!) : goTo(path)}
                aria-disabled={locked}
                className="relative group text-left"
              >
                <div className={cn(
                  "relative flex flex-col items-center justify-center aspect-square rounded-lg overflow-hidden transition-all",
                  "bg-card border",
                  locked
                    ? "opacity-40 grayscale border-border cursor-not-allowed"
                    : "bg-card border-border hover:scale-[1.02] hover:shadow-md cursor-pointer",
                )}>
                  <span className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    locked ? "bg-muted-foreground/30" : "bg-primary/70",
                  )} />
                  {locked && (
                    <span className="absolute top-2 right-2">
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} />
                    </span>
                  )}
                  <div className={cn(
                    "p-3 rounded-xl mb-3",
                    locked ? "bg-transparent" : "bg-muted group-hover:bg-primary/10 transition-colors",
                  )}>
                    <Icon
                      className={cn(
                        "w-7 h-7",
                        locked ? "text-muted-foreground/40" : "text-muted-foreground group-hover:text-primary transition-colors",
                      )}
                      strokeWidth={1.5}
                    />
                  </div>
                  <span className={cn(
                    "text-[11px] font-bold tracking-[0.15em] uppercase text-center",
                    locked ? "text-foreground/50" : "text-foreground",
                  )}>
                    {label}
                  </span>

                  {/*
                    Sub-rotulo de estado. Regra deliberada: so alarma quando ha
                    ACAO CONCRETA pendente. Ausencia NAO alarma — marcar de
                    ambar todo paciente ainda nao evoluido acenderia o painel
                    inteiro as 8h da manha, e alerta que acende sempre vira
                    ruido, o oposto do que uma passagem de plantao precisa.
                  */}
                  {!locked && key === "evolucao" && evolvedToday === true && (
                    <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase mt-1">
                      Evoluída hoje
                    </span>
                  )}
                  {!locked && key === "requisicoes" && pendingRequests > 0 && (
                    <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-500 tracking-widest uppercase mt-1">
                      {pendingRequests} pendente{pendingRequests > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </button>
            ))}

            {/*
              Sinalizacao — 7o card. Fecha o arco cronologico da estadia:
              Admissao (entrada) -> modulos de trabalho -> Sinalizacao (saida).
              Por isso vem por ultimo, e nao no meio dos modulos.

              Nao e duplicata do botao do cockpit: aqui e o ATALHO para abrir o
              fluxo; la, alem disso, vivem as acoes de estado (Suspender obito,
              Suspender alta, Cancelar transferencia), que o card nao cobre.
              O cockpit tambem fica recolhido por padrao (44px), entao nao ha
              dois botoes competindo na mesma tela.

              O card e o unico do grid que muda de cor conforme o estado — de
              proposito: obito e alta sinalizados sao informacao que precisa
              saltar aos olhos antes de qualquer clique.
            */}
            <button
              onClick={() => locked ? handleLockedClick(lockReason!) : setMovementOpen(true)}
              aria-disabled={locked}
              title="Sinalizar movimentação interna, transferência, alta ou óbito"
              className="relative group text-left"
            >
              <div className={cn(
                "relative flex flex-col items-center justify-center aspect-square rounded-lg overflow-hidden transition-all",
                "bg-card border",
                locked
                  ? "opacity-40 grayscale border-border cursor-not-allowed"
                  : [
                      "cursor-pointer hover:scale-[1.02] hover:shadow-md",
                      signalState?.tone === "danger" && "border-red-300 dark:border-red-500/40",
                      signalState?.tone === "info" && "border-sky-300 dark:border-sky-500/40",
                      signalState?.tone === "warn" && "border-amber-300 dark:border-amber-500/40",
                      !signalState && "border-border",
                    ],
              )}>
                <span className={cn(
                  "absolute top-0 left-0 right-0 h-1",
                  locked ? "bg-muted-foreground/30"
                    : signalState?.tone === "danger" ? "bg-red-400"
                    : signalState?.tone === "info" ? "bg-sky-400"
                    : signalState?.tone === "warn" ? "bg-amber-400"
                    : "bg-primary/70",
                )} />
                {locked && (
                  <span className="absolute top-2 right-2">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} />
                  </span>
                )}
                <div className={cn(
                  "p-3 rounded-xl mb-3 transition-colors",
                  locked ? "bg-transparent"
                    : signalState?.tone === "danger" ? "bg-red-50 dark:bg-red-950/30"
                    : signalState?.tone === "info" ? "bg-sky-50 dark:bg-sky-950/30"
                    : signalState?.tone === "warn" ? "bg-amber-50 dark:bg-amber-950/30"
                    : "bg-muted group-hover:bg-primary/10",
                )}>
                  <ArrowLeftRight
                    className={cn(
                      "w-7 h-7 transition-transform duration-200",
                      !locked && "group-hover:translate-x-0.5",
                      locked ? "text-muted-foreground/40"
                        : signalState?.tone === "danger" ? "text-red-600 dark:text-red-400"
                        : signalState?.tone === "info" ? "text-sky-600 dark:text-sky-400"
                        : signalState?.tone === "warn" ? "text-amber-600 dark:text-amber-500"
                        : "text-muted-foreground group-hover:text-primary",
                    )}
                    strokeWidth={1.5}
                  />
                </div>
                <span className={cn(
                  "text-[11px] font-bold tracking-[0.15em] uppercase text-center px-1",
                  locked ? "text-foreground/50" : "text-foreground",
                )}>
                  Sinalização
                </span>
                {signalState && !locked && (
                  <span className={cn(
                    "text-[9px] font-semibold tracking-widest uppercase mt-1 text-center px-1 leading-tight",
                    signalState.tone === "danger" && "text-red-600 dark:text-red-400",
                    signalState.tone === "info" && "text-sky-600 dark:text-sky-400",
                    signalState.tone === "warn" && "text-amber-600 dark:text-amber-500",
                  )}>
                    {signalState.label}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] uppercase tracking-[0.3em] font-semibold text-muted-foreground">
            {isPreAdmitted
              ? "Inicie pela admissão para liberar os demais módulos"
              : sapsExpired
              ? "Finalize a ficha SAPS 3 para reabrir os módulos clínicos"
              : "Selecione uma ação para acessar o módulo"}
          </p>
        </div>
      </main>

      {/* Patient Cockpit — fixed right sidebar (mesma variante das demais paginas) */}
      {cockpitPatient && <PatientCockpit patient={cockpitPatient} />}
      </div>

      {/* Fluxo de movimentacoes e desfechos, aberto pelo card de Sinalizacao.
          Mesmo dialogo que o cockpit usa — um caminho de codigo so. */}
      <PatientMovementDialog
        patient={cockpitPatient}
        movementType={null}
        isOpen={movementOpen}
        onClose={() => setMovementOpen(false)}
        onSuccess={() => setMovementOpen(false)}
      />

      {ctx.patientId && (
        <AdmissionDialog
          open={admissionOpen}
          onOpenChange={setAdmissionOpen}
          patient={{
            id: ctx.patientId,
            name: ctx.patientName,
            bed: ctx.patientBed,
            sector: ctx.patientSector,
            age: ctx.patientAge,
            department: department || undefined,
            // 🔒 patient_registry_id é essencial para vincular a evolução de admissão
            // ao prontuário permanente do paciente. Sem isso, clinical_evolutions
            // fica sem o campo registry e fica inacessível pelo hook useEvolutions.
            patient_registry_id: identifiers.registry?.id ?? undefined,
          }}
          onSuccess={() => {
            setAdmissionOpen(false);
            fetchStatus();
            toast.success("Admissão hospitalar registrada. Módulos clínicos liberados.");
          }}
        />
      )}

      {ctx.patientId && (
        <AdmissionConsultDialog
          open={consultOpen}
          onOpenChange={setConsultOpen}
          patient={{
            id: ctx.patientId,
            name: ctx.patientName,
            bed: ctx.patientBed,
            sector: ctx.patientSector,
            age: ctx.patientAge,
            patient_registry_id: identifiers.registry?.id ?? undefined,
          }}
          onChanged={fetchStatus}
        />
      )}
    </div>
  );
}
