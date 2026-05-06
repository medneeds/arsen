import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pill, Stethoscope, ClipboardList, FolderOpen, History, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { key: "prescricao", label: "Prescrição", icon: Pill, path: "/prescricao", tone: "from-blue-500/15 to-blue-500/5 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  { key: "evolucao", label: "Evolução", icon: Stethoscope, path: "/evolucao", tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  { key: "requisicoes", label: "Requisições", icon: ClipboardList, path: "/requisicoes", tone: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  { key: "docs", label: "Docs", icon: FolderOpen, path: "/documentos", tone: "from-violet-500/15 to-violet-500/5 text-violet-700 dark:text-violet-300 border-violet-500/30" },
  { key: "historico", label: "Histórico", icon: History, path: "/historico-paciente", tone: "from-slate-500/15 to-slate-500/5 text-slate-700 dark:text-slate-300 border-slate-500/30" },
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
        <div className="w-full max-w-4xl">
          {/* Patient identity */}
          <div className="text-center mb-10 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Paciente selecionado</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              {ctx.patientName || "—"}
            </h1>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {ctx.patientBed && <span className="font-mono px-2 py-0.5 rounded bg-muted">Leito {ctx.patientBed}</span>}
              {sectorLabel && <span>•</span>}
              {sectorLabel && <span className="uppercase">{sectorLabel}</span>}
              {ctx.patientAge && <span>•</span>}
              {ctx.patientAge && <span>{ctx.patientAge} anos</span>}
            </div>
          </div>

          {/* Action grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {ACTIONS.map(({ key, label, icon: Icon, path, tone }) => (
              <button
                key={key}
                onClick={() => goTo(path)}
                className={cn(
                  "group relative flex flex-col items-center justify-center gap-3 p-5 sm:p-6 rounded-2xl",
                  "bg-gradient-to-br border backdrop-blur-sm",
                  "transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.99]",
                  tone,
                )}
              >
                <div className="p-3 rounded-xl bg-background/60 group-hover:bg-background/80 transition-colors">
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide">
                  {label}
                </span>
              </button>
            ))}
          </div>

          <p className="text-center text-[11px] text-muted-foreground/60 mt-8 uppercase tracking-wider">
            Selecione uma ação para acessar o módulo
          </p>
        </div>
      </main>
    </div>
  );
}
