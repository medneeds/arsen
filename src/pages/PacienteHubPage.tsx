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
  { key: "prescricao", label: "Prescrição", icon: Pill, path: "/prescricao", accent: "bg-blue-500" },
  { key: "evolucao", label: "Evolução", icon: Stethoscope, path: "/evolucao", accent: "bg-emerald-500" },
  { key: "requisicoes", label: "Requisições", icon: ClipboardList, path: "/requisicoes", accent: "bg-amber-500" },
  { key: "docs", label: "Docs", icon: FolderOpen, path: "/documentos", accent: "bg-violet-500" },
  { key: "historico", label: "Histórico", icon: History, path: "/historico-paciente", accent: "bg-slate-500" },
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
    // Sem status definido (paciente legado/fictício antes da migração) → trata como admitido
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

  // Card "Admissão" — primeiro item, comportamento varia conforme status
  const admissionAccent = isPreAdmitted ? "bg-amber-500" : isAdmitted ? "bg-emerald-500" : "bg-slate-400";
  const AdmissionIcon = isAdmitted ? CheckCircle2 : ClipboardCheck;

  return (
    <div className="flex flex-col h-full">
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
        <div className="w-full max-w-6xl">
          {/* Patient identity */}
          <div className="text-center mb-6 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
              Paciente selecionado
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground uppercase">
              {ctx.patientName || "—"}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:text-sm">
              {ctx.patientBed && (
                <span className="font-mono px-2 py-0.5 rounded border border-border bg-muted/50 text-foreground">
                  LEITO {ctx.patientBed}
                </span>
              )}
              {sectorLabel && (
                <span className="font-mono px-2 py-0.5 rounded border border-border bg-muted/50 text-foreground uppercase">
                  {sectorLabel}
                </span>
              )}
              {ageDisplay && (
                <span className="font-mono px-2 py-0.5 rounded border border-border bg-muted/50 text-foreground uppercase">
                  {ageDisplay}
                </span>
              )}
            </div>
          </div>

          {/* Banner de pré-admissão */}
          {isPreAdmitted && !statusLoading && (
            <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600"></span>
              </span>
              <div className="flex-1 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                <strong className="uppercase tracking-wide">Paciente pré-admitido.</strong>{" "}
                Conclua a <strong>admissão hospitalar</strong> para liberar prescrição, evolução, requisições, docs e histórico.
              </div>
            </div>
          )}

          {/* Action grid — 6 colunas em desktop, Admissão primeiro */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Card ADMISSÃO */}
            <button
              onClick={() => setAdmissionOpen(true)}
              disabled={statusLoading}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-3 p-5 sm:p-6 rounded-xl",
                "bg-card border overflow-hidden transition-all duration-200 active:translate-y-0",
                "hover:-translate-y-0.5 hover:shadow-lg",
                isPreAdmitted
                  ? "border-amber-400 ring-2 ring-amber-300/60 animate-pulse-slow"
                  : "border-border hover:border-foreground/20",
              )}
            >
              <span className={cn("absolute top-0 left-0 right-0 h-1.5 opacity-90 group-hover:opacity-100 transition-opacity", admissionAccent)} />
              <div className={cn(
                "p-2.5 rounded-lg transition-colors",
                isPreAdmitted ? "bg-amber-100 dark:bg-amber-900/40" : isAdmitted ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-muted/60",
              )}>
                <AdmissionIcon className={cn(
                  "h-5 w-5 sm:h-6 sm:w-6 transition-colors",
                  isPreAdmitted ? "text-amber-700 dark:text-amber-300" : isAdmitted ? "text-emerald-700 dark:text-emerald-300" : "text-foreground/80",
                )} strokeWidth={1.75} />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-foreground/90">
                Admissão
              </span>
              {isPreAdmitted && (
                <span className="text-[9px] uppercase tracking-[0.15em] text-amber-700 dark:text-amber-300 font-bold">
                  Pendente
                </span>
              )}
              {isAdmitted && (
                <span className="text-[9px] uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400 font-bold">
                  Concluída
                </span>
              )}
            </button>

            {/* Demais ações — bloqueadas se pré-admitido */}
            {CLINICAL_ACTIONS.map(({ key, label, icon: Icon, path, accent }) => {
              const locked = isPreAdmitted;
              return (
                <button
                  key={key}
                  onClick={() => locked ? handleLockedClick() : goTo(path)}
                  aria-disabled={locked}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-3 p-5 sm:p-6 rounded-xl",
                    "bg-card border border-border overflow-hidden transition-all duration-200 active:translate-y-0",
                    locked
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/20",
                  )}
                >
                  <span className={cn("absolute top-0 left-0 right-0 h-1.5 opacity-80 transition-opacity", accent, locked && "opacity-30")} />
                  <div className="p-2.5 rounded-lg bg-muted/60 group-hover:bg-muted transition-colors relative">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-foreground/80 transition-colors" strokeWidth={1.75} />
                    {locked && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white rounded-full p-0.5 shadow">
                        <Lock className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-foreground/90">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-center text-[10px] text-muted-foreground/60 mt-8 uppercase tracking-[0.2em]">
            {isPreAdmitted ? "Inicie pela ADMISSÃO para liberar os demais módulos" : "Selecione uma ação para acessar o módulo"}
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
