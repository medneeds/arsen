import { ReactNode } from "react";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";

interface ClinicalHeaderProps {
  /** Current module label, e.g. "Prescrição Médica" */
  moduleLabel?: string;
  /** Show back button to return to previous page */
  showBack?: boolean;
  /** Right-side slot for page-specific actions */
  actions?: ReactNode;
}

/**
 * Header for clinical pages with patient context (Prescrição, Evolução, Requisições, Docs, Ficha).
 * Uses the unified light BreadcrumbBar with patient + modules visible.
 */
export function ClinicalHeader({ moduleLabel, showBack = true, actions }: ClinicalHeaderProps) {
  return (
    <div className="px-2 sm:px-4 pt-3 print:hidden">
      <BreadcrumbBar
        variant="institutional"
        showSector
        showNavTabs={false}
        showPatient
        showModules
        showBack={showBack}
        moduleLabel={moduleLabel}
        actions={actions}
      />
    </div>
  );
}
