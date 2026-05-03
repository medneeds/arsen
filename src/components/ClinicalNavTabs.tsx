import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LayoutDashboard, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDepartment, SECTOR_DISPLAY } from "@/contexts/DepartmentContext";
import { useIsGestor } from "@/hooks/useIsGestor";

const ALL_TABS = [
  { label: "Mapa de leitos", path: "/mapa", icon: LayoutDashboard },
  { label: "Painel clínico", path: "/painel-clinico", icon: ClipboardCheck },
];

interface ClinicalNavTabsProps {
  variant?: "default" | "dark";
  /** Hide the leading sector badge (use when caller already renders it) */
  hideSector?: boolean;
}

export function ClinicalNavTabs({ variant = "default", hideSector = false }: ClinicalNavTabsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentSectorLabel } = useDepartment();
  const isGestor = useIsGestor();

  // Gestor não acessa o Painel Clínico — apenas o Mapa de Leitos
  const tabs = isGestor ? ALL_TABS.filter((t) => t.path !== "/painel-clinico") : ALL_TABS;

  // Use patient-specific sector from URL if available, otherwise use the global department context
  const patientSector = searchParams.get("patientSector");
  const sectorLabel = patientSector
    ? (SECTOR_DISPLAY[patientSector] || patientSector)
    : currentSectorLabel;

  return (
    <div className="flex items-center gap-1.5">
      {/* Sector badge */}
      {!hideSector && sectorLabel && (
        <>
          <span className={cn(
            "text-[11px] font-semibold px-2 py-1 rounded-md whitespace-nowrap",
            variant === "dark"
              ? "bg-white/15 text-white/90"
              : "bg-primary/10 text-primary"
          )}>
            {sectorLabel}
          </span>
          <span className={cn("text-xs", variant === "dark" ? "text-white/30" : "text-muted-foreground/40")}>/</span>
        </>
      )}

      <div className={cn(
        "flex gap-1 rounded-lg p-1 border",
        variant === "dark"
          ? "bg-slate-950/60 border-white/20 shadow-inner"
          : "bg-muted border-border/60"
      )}>
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
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
    </div>
  );
}