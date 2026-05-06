import { ReactNode } from "react";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  /** Module label shown as a chip (e.g. "Prescrição Médica") */
  moduleLabel?: string;
  /** Inline subtitle, hidden on mobile to save space */
  subtitle?: string;
  /** Show back button */
  showBack?: boolean;
  /** Show sector dropdown */
  showSector?: boolean;
  /** Show clinical nav tabs (Mapa / Painel) */
  showNavTabs?: boolean;
  /** Show patient switcher */
  showPatient?: boolean;
  /** Show clinical module tabs */
  showModules?: boolean;
  /** Right-side action slot (filters, badges, primary CTA) */
  actions?: ReactNode;
  /**
   * Visual variant:
   *  - "clinical": institutional gradient (patient flows)
   *  - "default": light card (dashboards / management)
   */
  variant?: "clinical" | "default";
  /** Sticky to viewport top under safe-area inset */
  sticky?: boolean;
  /** Extra className on the outer wrapper */
  className?: string;
}

/**
 * Unified app header used across the platform.
 *
 * Responsibilities:
 * 1. Render the breadcrumb bar (sidebar trigger, sector, patient context, module chip).
 * 2. Apply safe-area top padding on iOS notched devices.
 * 3. Optionally stick to the top of the viewport so the header stays visible
 *    while inner content scrolls.
 *
 * Hierarchy is preserved on desktop; on mobile the breadcrumb collapses to a
 * single horizontally-scrollable row (handled inside `BreadcrumbBar`).
 */
export function AppHeader({
  moduleLabel,
  subtitle,
  showBack = true,
  showSector = true,
  showNavTabs = false,
  showPatient = false,
  showModules = false,
  actions,
  variant = "clinical",
  sticky = false,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "print:hidden px-2 sm:px-4",
        sticky && "sticky top-0 z-30 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60",
        className,
      )}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 0.75rem)",
        paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
        paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
      }}
    >
      <BreadcrumbBar
        variant={variant === "clinical" ? "institutional" : "default"}
        showBack={showBack}
        showSector={showSector}
        showNavTabs={showNavTabs}
        showPatient={showPatient}
        showModules={showModules}
        moduleLabel={moduleLabel}
        actions={actions}
      />
      {subtitle && (
        <p className="hidden sm:block px-1.5 mt-1 text-[11px] text-muted-foreground tracking-wide truncate">
          {subtitle}
        </p>
      )}
    </header>
  );
}
