import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ClinicalNavTabs } from "@/components/ClinicalNavTabs";
import { ClinicalModuleTabs } from "@/components/ClinicalModuleTabs";
import { PatientSwitcher } from "@/components/PatientSwitcher";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClinicalHeaderProps {
  /** Current module label, e.g. "Prescrição Médica" */
  moduleLabel?: string;
  /** Show back button to return to previous page */
  showBack?: boolean;
  /** Right-side slot for page-specific actions */
  actions?: ReactNode;
}

export function ClinicalHeader({ moduleLabel, showBack = true, actions }: ClinicalHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="border-b border-primary-foreground/10 bg-gradient-to-r from-primary via-primary/95 to-primary/85 px-2 sm:px-4 py-2 sm:py-3 print:hidden shadow-md shadow-primary/20 relative">
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent" />

      <div className="flex items-center justify-between gap-2">
        {/* Left: Sidebar trigger + breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <SidebarTrigger className="flex-shrink-0 text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/15 border-primary-foreground/25 hover:border-primary-foreground/40 data-[state=open]:bg-primary-foreground/15 transition-all duration-200" />

          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-7 w-7 flex-shrink-0 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Breadcrumb: Sector + Nav / Patient / Module Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
            <ClinicalNavTabs variant="dark" />
            <PatientSwitcher variant="dark" />
            <ClinicalModuleTabs variant="dark" />
          </div>
        </div>

        {/* Right: page-specific actions */}
        {actions && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
