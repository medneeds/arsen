import { ReactNode } from "react";
import { LucideIcon, Building2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface PlatformHeaderProps {
  /** Title of the section / sector */
  title: string;
  /** Optional subtitle line (e.g. unit name + scope) */
  subtitle?: ReactNode;
  /** Icon shown in the identity badge */
  icon?: LucideIcon;
  /** Right-side action buttons (notifications, refresh, export, etc.) */
  actions?: ReactNode;
  /** Variant: 'institutional' = blue wide gradient (default for non-clinical sectors).
   *  'clinical' = lighter, less saturated to avoid distracting medical workflows. */
  variant?: "institutional" | "clinical";
  /** Optional eyebrow label above the title (e.g. "Painel · Gestor") */
  eyebrow?: string;
  className?: string;
}

/**
 * Unified platform header used across all sectors.
 * Wide layout, sticky, dark-blue gradient by default with subtle pattern overlay.
 * Adapts to clinical contexts via `variant="clinical"` to keep medical screens calm.
 */
export function PlatformHeader({
  title,
  subtitle,
  icon: Icon = Building2,
  actions,
  variant = "institutional",
  eyebrow,
  className,
}: PlatformHeaderProps) {
  const isInstitutional = variant === "institutional";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full border-b shadow-sm",
        isInstitutional
          ? "border-primary/30 text-primary-foreground"
          : "border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 text-foreground",
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
      {/* subtle radial highlight for institutional variant */}
      {isInstitutional && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(800px 120px at 15% 0%, hsl(0 0% 100% / 0.18), transparent 60%)",
          }}
        />
      )}

      <div className="relative w-full px-4 md:px-8 py-3 flex items-center gap-3">
        <SidebarTrigger
          className={cn(
            "h-9 w-9 shrink-0 rounded-md",
            isInstitutional
              ? "text-primary-foreground hover:bg-white/10"
              : "text-foreground",
          )}
          aria-label="Alternar menu lateral"
        />

        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border",
            isInstitutional
              ? "bg-white/10 border-white/20 backdrop-blur"
              : "bg-primary/10 border-primary/20",
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              isInstitutional ? "text-primary-foreground" : "text-primary",
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.2em] truncate",
                isInstitutional
                  ? "text-primary-foreground/70"
                  : "text-muted-foreground",
              )}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className={cn(
              "text-base md:text-lg font-bold leading-tight truncate",
              isInstitutional ? "text-primary-foreground" : "text-foreground",
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <div
              className={cn(
                "text-[11px] flex items-center gap-1.5 flex-wrap mt-0.5",
                isInstitutional
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              {subtitle}
            </div>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
