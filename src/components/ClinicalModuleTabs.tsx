import React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Pill, NotebookPen, FileText, FolderOpen, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MODULE_TABS = [
  { label: "Prescrição", path: "/prescricao", icon: Pill },
  { label: "Evolução", path: "/evolucao", icon: NotebookPen },
  { label: "Requisições", path: "/requisicoes", icon: FileText },
  { label: "Docs", path: "/documentos", icon: FolderOpen },
  { label: "Movimentações", path: "/movimentacoes", icon: ArrowLeftRight },
];

interface ClinicalModuleTabsProps {
  variant?: "default" | "dark";
}

/**
 * Tabs for switching between clinical modules (Prescrição, Evolução, Requisições, Docs)
 * while preserving patient context via URL search params.
 */
export function ClinicalModuleTabs({ variant = "dark" }: ClinicalModuleTabsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Build query string preserving patient context
  const patientParams = new URLSearchParams();
  const keysToPreserve = ["patientId", "patientName", "patientBed", "patientSector"];
  keysToPreserve.forEach(key => {
    const val = searchParams.get(key);
    if (val) patientParams.set(key, val);
  });
  const queryString = patientParams.toString();
  const hasPatient = !!searchParams.get("patientName");

  // Only show when we have patient context
  if (!hasPatient) return null;

  return (
    <div className={cn(
      "flex gap-1 rounded-lg p-1 border",
      variant === "dark"
        ? "bg-slate-950/60 border-white/20 shadow-inner"
        : "bg-muted border-border/60"
    )}>
      {MODULE_TABS.map(tab => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(`${tab.path}${queryString ? `?${queryString}` : ""}`)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wide transition-all duration-200",
              variant === "dark"
                ? isActive
                  ? "bg-white text-primary shadow-md ring-1 ring-white/40"
                  : "bg-white/15 text-white hover:bg-white/30 ring-1 ring-white/20"
                : isActive
                  ? "bg-background text-primary shadow-sm ring-1 ring-primary/20"
                  : "bg-background/80 text-foreground hover:bg-background hover:text-primary ring-1 ring-border/60"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
