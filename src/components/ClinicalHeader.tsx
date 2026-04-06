import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ClinicalNavTabs } from "@/components/ClinicalNavTabs";
import { ClinicalModuleTabs } from "@/components/ClinicalModuleTabs";
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
    <div className="border-b border-border/50 bg-gradient-to-r from-[#0a1628] via-[#0f2847] to-[#1a3a5c] px-2 sm:px-4 py-2 sm:py-3 print:hidden">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Sidebar trigger + breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <SidebarTrigger className="flex-shrink-0 text-white hover:text-white hover:bg-white/25 border-white/30 hover:border-white/50 data-[state=open]:bg-white/25 transition-all duration-200" />

          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-7 w-7 flex-shrink-0 text-white/70 hover:text-white hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Breadcrumb: Institution / Nav Tabs / Module Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-white/90 whitespace-nowrap">Socorrão I</span>
            <span className="text-white/30 text-xs">/</span>
            <ClinicalNavTabs variant="dark" />
            {/* Module-level tabs (Prescrição / Evolução / Requisições) */}
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
