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
        "print:hidden flex items-center justify-between gap-2 flex-wrap px-2 sm:px-3 py-1.5 shadow-sm rounded-xl backdrop-blur-sm",
        isInstitutional
          ? "border border-primary/30 text-primary-foreground"
          : "border border-border/60 bg-card/60",
        className,
      )}
      style={
        isInstitutional
          ? {
              backgroundImage:
                "linear-gradient(110deg, hsl(var(--primary)) 0%, hsl(210 70% 22%) 55%, hsl(210 75% 18%) 100%)",
            }
          : undefined
      }
    >
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 text-[11px] sm:text-xs font-medium tracking-wide min-w-0">
        <SidebarTrigger
          className={cn(
            "flex-shrink-0 h-9 w-9 sm:h-7 sm:w-7",
            isInstitutional && "text-primary-foreground hover:bg-white/10",
          )}
        />

        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className={cn(
              "h-7 w-7 flex-shrink-0",
              isInstitutional
                ? "text-primary-foreground/90 hover:text-primary-foreground hover:bg-white/10"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border",
            isInstitutional
              ? "bg-white/10 text-primary-foreground border-white/20 backdrop-blur"
              : "bg-muted/60 text-muted-foreground border-border/50",
          )}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span className="uppercase">{whitelabel.institution.hospitalAbbreviation}</span>
        </span>

        {showSector && (
          <>
            <ChevronRight className={cn("h-3.5 w-3.5", isInstitutional ? "text-primary-foreground/60" : "text-muted-foreground/50")} />
            <SectorSelector variant={isInstitutional ? "dark" : "light"} />
          </>
        )}

        {showNavTabs && (
          <>
            <ChevronRight className={cn("h-3.5 w-3.5", isInstitutional ? "text-primary-foreground/60" : "text-muted-foreground/50")} />
            <ClinicalNavTabs hideSector />
          </>
        )}

        {showPatient && (
          <>
            <ChevronRight className={cn("h-3.5 w-3.5", isInstitutional ? "text-primary-foreground/60" : "text-muted-foreground/50")} />
            <PatientSwitcher variant="default" />
          </>
        )}

        {showModules && (
          <>
            <ChevronRight className={cn("h-3.5 w-3.5", isInstitutional ? "text-primary-foreground/60" : "text-muted-foreground/50")} />
            <ClinicalModuleTabs variant="default" />
          </>
        )}

        {moduleLabel && (
          <>
            <ChevronRight className={cn("h-3.5 w-3.5", isInstitutional ? "text-primary-foreground/60" : "text-muted-foreground/50")} />
            <span
              className={cn(
                "px-2 py-1 rounded-md uppercase tracking-wide",
                isInstitutional ? "bg-white/15 text-primary-foreground border border-white/20" : "bg-primary/10 text-primary",
              )}
            >
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
