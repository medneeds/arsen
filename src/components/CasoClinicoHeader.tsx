/**
 * Cabecalho do "Caso clinico completo" — compartilhado pelas duas folhas
 * (PrintPatientLayout e PrintPatientPreviewDialog), que antes tinham cada uma
 * a sua faixa, a sua marca d'agua e o seu cartao de paciente (so nome e idade).
 * Modelo assistencial do cabecalho padronizado.
 */
import { useMemo } from "react";
import type { Patient } from "@/types/patient";
import { DocumentHeader } from "@/components/DocumentHeader";
import { useHeaderPatient } from "@/hooks/useHeaderPatient";
import { fmtIsoDate } from "@/lib/headerPatient";
import { formatAgeDisplay } from "@/utils/ageDisplay";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { asUuidOrNull } from "@/lib/utils";
import { format } from "date-fns";

export function CasoClinicoHeader({ patient }: { patient: Patient }) {
  const base = useMemo(
    () => ({
      name: patient.name,
      bed: patient.bedNumber,
      sector: getSectorDisplayLabel(patient.sector) || patient.sectorName || "",
      record: patient.prontuario,
      birthDate: fmtIsoDate(patient.birthDate),
      age: formatAgeDisplay(patient.age),
      sectorAdmission: fmtIsoDate(patient.utiAdmissionDate?.[0] || patient.admissionDate),
      allergies: patient.utiAllergies?.length ? patient.utiAllergies.join(", ") : undefined,
    }),
    [patient],
  );
  const headerPatient = useHeaderPatient(asUuidOrNull(patient.id), base);
  return (
    <>
      <DocumentHeader
        model="assistencial"
        title="Caso clínico completo"
        complement={`Leito ${patient.bedNumber}`}
        emission={format(new Date(), "dd/MM/yyyy HH:mm:ss")}
        width="100%"
        patient={headerPatient}
      />
      <div style={{ height: "4px" }} />
    </>
  );
}
