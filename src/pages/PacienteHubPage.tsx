import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pill, Stethoscope, ClipboardList, FolderOpen, History, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { cn } from "@/lib/utils";

const ACTIONS = [
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

  const goTo = (path: string) => {
    const qs = new URLSearchParams();
    Object.entries(ctx).forEach(([k, v]) => v && qs.set(k, v));
    navigate(`${path}?${qs.toString()}`);
  };

  const sectorLabelMap: Record<string, string> = {
    red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2", ucc: "UCC",
  };
  const sectorLabel = sectorLabelMap[ctx.patientSector] || ctx.patientSector;

  // Normaliza idade: evita duplicar "anos" se já vier no parâmetro
  const ageDisplay = (() => {
    if (!ctx.patientAge) return "";
    const raw = ctx.patientAge.trim();
    return /anos?/i.test(raw) ? raw : `${raw} anos`;
  })();

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
        <div className="w-full max-w-5xl">
          {/* Patient identity — Norma Zero: tipografia institucional, sem cor decorativa */}
          <div className="text-center mb-10 space-y-3">
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

          {/* Action grid — superfícies neutras, accent fino institucional */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {ACTIONS.map(({ key, label, icon: Icon, path, accent }) => (
              <button
                key={key}
                onClick={() => goTo(path)}
                className={cn(
                  "group relative flex flex-col items-center justify-center gap-3 p-5 sm:p-6 rounded-xl",
                  "bg-card border border-border overflow-hidden",
                  "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-foreground/20 active:translate-y-0",
                )}
              >
                {/* Accent superior fino */}
                <span className={cn("absolute top-0 left-0 right-0 h-0.5 opacity-70 group-hover:opacity-100 transition-opacity", accent)} />
                <div className="p-2.5 rounded-lg bg-muted/60 group-hover:bg-muted transition-colors">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-foreground/80 group-hover:text-foreground transition-colors" strokeWidth={1.75} />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-foreground/90">
                  {label}
                </span>
              </button>
            ))}
          </div>

          <p className="text-center text-[10px] text-muted-foreground/60 mt-8 uppercase tracking-[0.2em]">
            Selecione uma ação para acessar o módulo
          </p>
        </div>
      </main>
    </div>
  );
}
