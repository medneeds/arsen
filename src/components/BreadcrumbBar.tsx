import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
  // Com paciente + abas de modulo (desktop): barra maior, abas em linha propria de largura total.
  const big = showModules && showPatient;
  const chevron = cn("hidden sm:inline-block flex-shrink-0", big ? "h-[13px] w-[13px]" : "h-3.5 w-3.5", isInstitutional ? "text-primary-foreground/80" : "text-muted-foreground/50");

  return (
    <nav
      aria-label="Hierarquia do setor"
      className={cn(
        "print:hidden flex items-center justify-between gap-2 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 shadow-sm rounded-lg sm:rounded-lg backdrop-blur-sm",
        big && "sm:px-3.5 sm:pt-2.5 sm:pb-0",
        // Mobile: nowrap + horizontal scroll keeps the bar to a single row.
        // Desktop: wraps as before so all chips stay visible.
        "flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible scrollbar-none",
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
      <div className={cn("flex items-center flex-nowrap sm:flex-wrap gap-x-1.5 sm:gap-x-2 gap-y-1.5 text-[11px] sm:text-xs font-medium tracking-wide min-w-0", big && "sm:gap-x-2.5")}>
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
              "h-8 w-8 sm:h-7 sm:w-7 flex-shrink-0",
              isInstitutional
                ? "text-primary-foreground/90 hover:text-primary-foreground hover:bg-white/10"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Hospital chip — desktop only (mobile saves space; hospital lives in sidebar/login) */}
        <span
          className={cn(
            "hidden sm:inline-flex items-center gap-2 rounded-md border font-medium",
            big ? "px-3 py-1.5" : "px-3 py-1",
            isInstitutional
              ? "bg-white/25 text-white border-white/40 backdrop-blur shadow-md font-semibold"
              : "bg-muted/60 text-muted-foreground border-border/50",
          )}
        >
          <Building2 className={big ? "h-[13px] w-[13px]" : "h-3.5 w-3.5"} />
          <span className="uppercase tracking-wider">{whitelabel.institution.hospitalAbbreviation}</span>
        </span>

        {showSector && (
          <>
            <ChevronRight className={chevron} />
            <SectorSelector variant={isInstitutional ? "dark" : "light"} large={big} />
          </>
        )}

        {/* Nav tabs (Mapa/Painel) — desktop only on patient flows to avoid 2nd row on mobile */}
        {showNavTabs && (
          <>
            {!showPatient && <ChevronRight className={chevron} />}
            <span className={cn(showPatient ? "hidden sm:inline-flex" : "inline-flex")}>
              <ClinicalNavTabs hideSector />
            </span>
          </>
        )}

        {showPatient && (
          <>
            <ChevronRight className={chevron} />
            <PatientSwitcher variant={isInstitutional ? "dark" : "default"} large={big} />
          </>
        )}

        {/* Chip do modulo atual. Quando as abas de modulo estao visiveis (desktop),
            o chip e REDUNDANTE com a aba ja destacada — entao fica so no mobile
            (onde as abas sao ocultas e o chip carrega o contexto). Sem abas de
            modulo, o chip aparece normalmente. */}
        {moduleLabel && (
          <>
            <ChevronRight className={cn("h-3.5 w-3.5 flex-shrink-0", showModules ? "hidden" : "hidden sm:inline-block", isInstitutional ? "text-primary-foreground/80" : "text-muted-foreground/50")} />
            <span
              className={cn(
                "px-2 py-1 rounded-md uppercase tracking-wide text-xs whitespace-nowrap flex-shrink-0",
                showModules && "sm:hidden",
                isInstitutional ? "bg-white/15 text-primary-foreground border border-white/20" : "bg-primary/10 text-primary",
              )}
            >
              {moduleLabel}
            </span>
          </>
        )}
      </div>

      <div className={cn(
        "flex items-center gap-2 flex-shrink-0",
        isInstitutional && "institutional-actions"
      )}>
        {/* Botao "Duvidas Frequentes" movido para a sidebar (rodape). */}
        {actions}
      </div>

      {/* Abas de modulo — desktop: linha propria de largura total; no mobile o chip do modulo carrega o contexto */}
      {showModules && (
        <div className="hidden sm:block basis-full w-full">
          <ClinicalModuleTabs variant={isInstitutional ? "dark" : "default"} layout="bar" />
        </div>
      )}
    </nav>
  );
}
