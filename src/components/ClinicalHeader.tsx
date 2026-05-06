import { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";

interface ClinicalHeaderProps {
  /** Current module label, e.g. "Prescrição Médica" */
  moduleLabel?: string;
  /** Show back button to return to previous page */
  showBack?: boolean;
  /** Right-side slot for page-specific actions */
  actions?: ReactNode;
  /** Inline subtitle hidden on mobile */
  subtitle?: string;
  /** Sticky to top of viewport */
  sticky?: boolean;
}

/**
 * Header for clinical pages with patient context (Prescrição, Evolução,
 * Requisições, Documentos, Ficha de Atendimento, Alta).
 *
 * Thin wrapper around the unified `AppHeader` — kept for backwards
 * compatibility with existing call sites. New pages should prefer
 * importing `AppHeader` directly.
 */
export function ClinicalHeader({
  moduleLabel,
  showBack = true,
  actions,
  subtitle,
  sticky = false,
}: ClinicalHeaderProps) {
  return (
    <AppHeader
      variant="clinical"
      showSector
      showPatient
      showModules
      showBack={showBack}
      moduleLabel={moduleLabel}
      subtitle={subtitle}
      actions={actions}
      sticky={sticky}
    />
  );
}
