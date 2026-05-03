import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight, ArrowLeft } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ClinicalNavTabs } from "@/components/ClinicalNavTabs";
import { ClinicalModuleTabs } from "@/components/ClinicalModuleTabs";
import { PatientSwitcher } from "@/components/PatientSwitcher";
import { SectorSelector } from "@/components/SectorSelector";
import { whitelabel } from "@/config/whitelabel";
import { cn } from "@/lib/utils";

interface BreadcrumbBarProps {
  /** Show the sector selector dropdown (default true) */
  showSector?: boolean;
  /** Show clinical nav tabs (Mapa / Painel) (default true) */
  showNavTabs?: boolean;
  /** Show patient switcher (only renders if patient context exists) */
  showPatient?: boolean;
  /** Show clinical module tabs (Prescrição / Evolução / etc.) — only with patient */
  showModules?: boolean;
  /** Show back button */
  showBack?: boolean;
  /** Custom inline label (replaces nav tabs visually but keeps breadcrumb intact) */
  moduleLabel?: string;
  /** Right-side action slot */
  actions?: ReactNode;
  /** Visual variant: 'default' (light card) or 'institutional' (blue gradient border, sticky wide). */
  variant?: "default" | "institutional";
  /** Additional className for the wrapper */
  className?: string;
}

/**
 * Unified clinical breadcrumb bar.
 * Pattern: [SidebarTrigger] [Back] [Hospital] ▸ [Sector ▼] ▸ [NavTabs / Patient / Modules]   [Actions]
 */
export function BreadcrumbBar({
  showSector = true,
  showNavTabs = true,
  showPatient = false,
  showModules = false,
  showBack = false,
  moduleLabel,
  actions,
  variant = "default",
  className,
}: BreadcrumbBarProps) {
  const navigate = useNavigate();
  const isInstitutional = variant === "institutional";

  return (
    <nav
      aria-label="Hierarquia do setor"
      className={cn(
        "print:hidden flex items-center justify-between gap-2 flex-wrap px-2 sm:px-3 py-1.5 shadow-sm",
        isInstitutional
          ? "rounded-xl border border-transparent bg-card/80 backdrop-blur-sm relative"
          : "rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm",
        className,
      )}
      style={
        isInstitutional
          ? {
              backgroundImage:
                "linear-gradient(hsl(var(--card)), hsl(var(--card))), linear-gradient(110deg, hsl(var(--primary)) 0%, hsl(210 70% 22%) 55%, hsl(210 75% 18%) 100%)",
              backgroundOrigin: "border-box",
              backgroundClip: "padding-box, border-box",
              borderWidth: "1.5px",
              borderStyle: "solid",
              borderColor: "transparent",
            }
          : undefined
      }
    >
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 text-[11px] sm:text-xs font-medium tracking-wide min-w-0">
        <SidebarTrigger className="flex-shrink-0 h-9 w-9 sm:h-7 sm:w-7" />

        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground border border-border/50">
          <Building2 className="h-3.5 w-3.5" />
          <span className="uppercase">{whitelabel.institution.hospitalAbbreviation}</span>
        </span>

        {showSector && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <SectorSelector variant="light" />
          </>
        )}

        {showNavTabs && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <ClinicalNavTabs hideSector />
          </>
        )}

        {showPatient && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <PatientSwitcher variant="default" />
          </>
        )}

        {showModules && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <ClinicalModuleTabs variant="default" />
          </>
        )}

        {moduleLabel && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="px-2 py-1 rounded-md bg-primary/10 text-primary uppercase tracking-wide">
              {moduleLabel}
            </span>
          </>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {actions}
        </div>
      )}
    </nav>
  );
}
