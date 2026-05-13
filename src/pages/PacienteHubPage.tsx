import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pill, Stethoscope, ClipboardList, FolderOpen, History, ArrowLeft, ClipboardCheck, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { AdmissionDialog } from "@/components/AdmissionDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AdmissionStatus = "pre_admitido" | "admitido" | "suspenso" | null;

const CLINICAL_ACTIONS = [
  { key: "prescricao", label: "Prescrição", icon: Pill, path: "/prescricao" },
  { key: "evolucao", label: "Evolução", icon: Stethoscope, path: "/evolucao" },
  { key: "requisicoes", label: "Requisições", icon: ClipboardList, path: "/requisicoes" },
  { key: "docs", label: "Docs", icon: FolderOpen, path: "/documentos" },
  { key: "historico", label: "Histórico", icon: History, path: "/historico-paciente" },
];

export default function PacienteHubPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

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
  const [department, setDepartment] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!ctx.patientId) { setStatusLoading(false); return; }
    setStatusLoading(true);
    const { data } = await supabase
      .from("patients")
      .select("admission_status, department")
      .eq("id", ctx.patientId)
      .maybeSingle();
    setAdmissionStatus(((data as any)?.admission_status as AdmissionStatus) ?? "admitido");
    setDepartment((data as any)?.department ?? null);
    setStatusLoading(false);
  };

  useEffect(() => { fetchStatus(); }, [ctx.patientId]);

  const isPreAdmitted = admissionStatus === "pre_admitido";
  const isAdmitted = admissionStatus === "admitido";

  const goTo = (path: string) => {
    const qs = new URLSearchParams();
    Object.entries(ctx).forEach(([k, v]) => v && qs.set(k, v));
    navigate(`${path}?${qs.toString()}`);
  };

  const handleLockedClick = () => {
    toast.warning("Conclua a admissão hospitalar para liberar este módulo", {
      description: "Clique em ADMISSÃO para iniciar o registro D0.",
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
  const locked = isPreAdmitted;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-2 sm:px-4 pt-3">
        <BreadcrumbBar
          variant="institutional"
          actions={
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 bg-white/95"
              onClick={() => navigate("/painel-clinico")}>
              <ArrowLeft className="h-3.5 w-3.5" /> Painel Clínico
            </Button>
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

          {/* Action grid — 6 cards aspect-square, harmônicos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* ADMISSÃO — gate */}
            <button
              onClick={() => setAdmissionOpen(true)}
              disabled={statusLoading}
              className="relative group cursor-pointer text-left disabled:cursor-wait"
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

            {/* Demais ações */}
            {CLINICAL_ACTIONS.map(({ key, label, icon: Icon, path }) => (
              <button
                key={key}
                onClick={() => locked ? handleLockedClick() : goTo(path)}
                aria-disabled={locked}
                className="relative group text-left"
              >
                <div className={cn(
                  "relative flex flex-col items-center justify-center aspect-square rounded-lg overflow-hidden transition-all",
                  "bg-slate-50 border border-slate-200",
                  locked
                    ? "opacity-40 grayscale cursor-not-allowed"
                    : "bg-white hover:scale-[1.02] hover:shadow-md cursor-pointer",
                )}>
                  <span className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    locked ? "bg-slate-300" : "bg-blue-400",
                  )} />
                  {locked && (
                    <span className="absolute top-2 right-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
                    </span>
                  )}
                  <div className={cn(
                    "p-3 rounded-xl mb-3",
                    locked ? "bg-transparent" : "bg-slate-100 group-hover:bg-blue-50 transition-colors",
                  )}>
                    <Icon
                      className={cn(
                        "w-7 h-7",
                        locked ? "text-slate-400" : "text-slate-600 group-hover:text-blue-600 transition-colors",
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
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] uppercase tracking-[0.3em] font-semibold text-slate-400">
            {isPreAdmitted
              ? "Inicie pela admissão para liberar os demais módulos"
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
