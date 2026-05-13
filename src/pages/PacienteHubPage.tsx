import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pill, Stethoscope, ClipboardList, FolderOpen, History, ArrowLeft, ClipboardCheck, Lock, CheckCircle2, AlertTriangle, Printer, ShieldCheck, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { AdmissionDialog } from "@/components/AdmissionDialog";
import { AdmissionConsultDialog } from "@/components/AdmissionConsultDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { printAdmissionNormaZero } from "@/lib/printAdmission";
import { useHospital } from "@/contexts/HospitalContext";

type AdmissionStatus = "pre_admitido" | "admitido" | "suspenso" | null;

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

export default function PacienteHubPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { currentHospital } = useHospital();

  const ctx = useMemo(() => ({
    patientId: params.get("patientId") || "",
    patientName: params.get("patientName") || "",
    patientBed: params.get("patientBed") || "",
    patientSector: params.get("patientSector") || "",
    patientAge: params.get("patientAge") || "",
  }), [params]);

  const [admissionStatus, setAdmissionStatus] = useState<AdmissionStatus>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [admissionOpen, setAdmissionOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [department, setDepartment] = useState<string | null>(null);
  const [sapsPending, setSapsPending] = useState(false);
  const [sapsSince, setSapsSince] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const fetchStatus = async () => {
    if (!ctx.patientId) { setStatusLoading(false); return; }
    setStatusLoading(true);
    const { data } = await supabase
      .from("patients")
      .select("admission_status, department, saps_pending, saps_pending_since, saps_completed_at")
      .eq("id", ctx.patientId)
      .maybeSingle();
    const row: any = data || {};
    setAdmissionStatus((row.admission_status as AdmissionStatus) ?? "admitido");
    setDepartment(row.department ?? null);
    setSapsPending(!!row.saps_pending && !row.saps_completed_at);
    setSapsSince(row.saps_pending_since ?? null);
    setStatusLoading(false);
  };

  useEffect(() => { fetchStatus(); }, [ctx.patientId]);

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

  const handleGoSaps = () => {
    const qs = new URLSearchParams();
    Object.entries(ctx).forEach(([k, v]) => v && qs.set(k, v));
    navigate(`/saps3?${qs.toString()}`);
  };

  const handlePrintAdmission = async () => {
    if (!ctx.patientId) return;
    const { data: ev } = await supabase
      .from("clinical_evolutions")
      .select("soap_data, vital_signs, physical_exam, validated_by_name, created_at")
      .eq("patient_id", ctx.patientId)
      .eq("evolution_type", "admission")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: ah } = await supabase
      .from("admission_histories")
      .select("cid_primary, cid_secondary, clinical_history, initial_conduct")
      .eq("patient_id", ctx.patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const soap: any = (ev as any)?.soap_data || {};
    const vs: any = (ev as any)?.vital_signs || {};
    const pe: any = (ev as any)?.physical_exam || {};
    const a: any = ah || {};

    await printAdmissionNormaZero({
      patient: { name: ctx.patientName, bed: ctx.patientBed, sector: ctx.patientSector, age: ctx.patientAge },
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

  const sectorLabelMap: Record<string, string> = {
    red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2",
    uti_01: "UTI 1", uti_02: "UTI 2", uci_01: "UCI 1", uci_02: "UCI 2",
    ucc: "UCC",
    neuro_01: "Enfermaria Neuro 01", neuro_02: "Enfermaria Neuro 02",
    clinica_cirurgica: "Clínica Cirúrgica", enfermaria_transicao: "Enfermaria de Transição",
    enfermaria_vascular: "Enfermaria Vascular",
    riv: "RIV", cc_preparo: "CC — Preparo", cc_bloco: "CC — Bloco Cirúrgico", cc_rpa: "CC — RPA",
    sala_vermelha: "Sala Vermelha", sala_laranja: "Sala Laranja",
    ue_vertical: "UE Vertical", ue_horizontal: "UE Horizontal",
    observacao_clinica: "Observação Clínica", internacao_ue: "Internação UE",
  };
  const sectorLabel = sectorLabelMap[ctx.patientSector] || ctx.patientSector;

  const ageDisplay = (() => {
    if (!ctx.patientAge) return "";
    const raw = ctx.patientAge.trim();
    return /anos?/i.test(raw) ? raw : `${raw} anos`;
  })();

  const AdmissionIcon = isAdmitted ? CheckCircle2 : ClipboardCheck;
  const lockReason: "preadmission" | "saps_expired" | null =
    isPreAdmitted ? "preadmission" : sapsExpired ? "saps_expired" : null;
  const locked = lockReason !== null;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-2 sm:px-4 pt-3">
        <BreadcrumbBar
          variant="institutional"
          actions={
            <div className="flex items-center gap-1.5">
              {isAdmitted && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 bg-white/95"
                  onClick={handlePrintAdmission}>
                  <Printer className="h-3.5 w-3.5" /> Imprimir Admissão
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 bg-white/95"
                onClick={() => navigate("/painel-clinico")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Painel Clínico
              </Button>
            </div>
          }
        />
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-6xl flex flex-col gap-8">
          {/* Patient identity */}
          <div className="text-center space-y-3">
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-slate-400">
              Paciente Selecionado
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight uppercase">
              {ctx.patientName || "—"}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {ctx.patientBed && (
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold tracking-wider uppercase rounded-sm shadow-sm">
                  Leito {ctx.patientBed}
                </span>
              )}
              {sectorLabel && (
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold tracking-wider uppercase rounded-sm shadow-sm">
                  {sectorLabel}
                </span>
              )}
              {ageDisplay && (
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold tracking-wider uppercase rounded-sm shadow-sm">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
                  "bg-white",
                  isPreAdmitted
                    ? "border-2 border-amber-400 shadow-lg group-hover:scale-[1.02]"
                    : isAdmitted
                    ? "border border-emerald-300 group-hover:scale-[1.02] group-hover:shadow-md"
                    : "border border-slate-200 group-hover:scale-[1.02] group-hover:shadow-md",
                )}>
                  <span className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    isPreAdmitted ? "bg-amber-400" : isAdmitted ? "bg-emerald-400" : "bg-slate-300",
                  )} />
                  <div className={cn(
                    "p-3 rounded-xl mb-3",
                    isPreAdmitted ? "bg-amber-50" : isAdmitted ? "bg-emerald-50" : "bg-slate-100",
                  )}>
                    <AdmissionIcon
                      className={cn(
                        "w-7 h-7",
                        isPreAdmitted ? "text-amber-600" : isAdmitted ? "text-emerald-600" : "text-slate-500",
                      )}
                      strokeWidth={1.75}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-900 tracking-[0.15em] uppercase">
                    Admissão
                  </span>
                  {isPreAdmitted && (
                    <span className="text-[9px] font-semibold text-amber-600 tracking-widest uppercase mt-1">
                      Pendente
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
                  className="absolute top-2 right-2 z-10 inline-flex items-center justify-center h-7 w-7 rounded-md bg-white/95 border border-emerald-200 text-emerald-700 shadow-sm hover:bg-emerald-50 hover:scale-105 transition"
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
                  "bg-slate-50 border",
                  locked
                    ? lockReason === "saps_expired"
                      ? "opacity-60 border-red-200 cursor-not-allowed"
                      : "opacity-40 grayscale border-slate-200 cursor-not-allowed"
                    : "bg-white border-slate-200 hover:scale-[1.02] hover:shadow-md cursor-pointer",
                )}>
                  <span className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    locked
                      ? lockReason === "saps_expired" ? "bg-red-400" : "bg-slate-300"
                      : "bg-blue-400",
                  )} />
                  {locked && (
                    <span className="absolute top-2 right-2">
                      <Lock className={cn(
                        "w-3.5 h-3.5",
                        lockReason === "saps_expired" ? "text-red-500" : "text-slate-400"
                      )} strokeWidth={2} />
                    </span>
                  )}
                  <div className={cn(
                    "p-3 rounded-xl mb-3",
                    locked ? "bg-transparent" : "bg-slate-100 group-hover:bg-blue-50 transition-colors",
                  )}>
                    <Icon
                      className={cn(
                        "w-7 h-7",
                        locked
                          ? lockReason === "saps_expired" ? "text-red-400" : "text-slate-400"
                          : "text-slate-600 group-hover:text-blue-600 transition-colors",
                      )}
                      strokeWidth={1.5}
                    />
                  </div>
                  <span className={cn(
                    "text-[11px] font-bold tracking-[0.15em] uppercase text-center",
                    locked ? "text-slate-600" : "text-slate-900",
                  )}>
                    {label}
                  </span>
                  {lockReason === "saps_expired" && (
                    <span className="text-[9px] font-semibold text-red-600 tracking-widest uppercase mt-1">
                      SAPS Vencida
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] uppercase tracking-[0.3em] font-semibold text-slate-400">
            {isPreAdmitted
              ? "Inicie pela admissão para liberar os demais módulos"
              : sapsExpired
              ? "Finalize a ficha SAPS 3 para reabrir os módulos clínicos"
              : "Selecione uma ação para acessar o módulo"}
          </p>
        </div>
      </main>

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
          }}
          onSuccess={() => {
            setAdmissionOpen(false);
            fetchStatus();
            toast.success("Admissão hospitalar registrada. Módulos clínicos liberados.");
          }}
        />
      )}
    </div>
  );
}
