import React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Pill, NotebookPen, FileText, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const MODULE_TABS = [
  { label: "Prescrição", path: "/prescricao", icon: Pill },
  { label: "Evolução", path: "/evolucao", icon: NotebookPen },
  { label: "Requisições", path: "/requisicao-unificada", icon: FileText },
  { label: "Docs", path: "/documentos", icon: FolderOpen },
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
      "flex gap-0.5 rounded-lg p-0.5",
      variant === "dark" ? "bg-white/10" : "bg-muted/50"
    )}>
      {MODULE_TABS.map(tab => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(`${tab.path}${queryString ? `?${queryString}` : ""}`)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200",
              variant === "dark"
                ? isActive
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/10"
                : isActive
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
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
