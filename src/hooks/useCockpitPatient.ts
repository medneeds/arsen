import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { usePatientLive } from "@/hooks/usePatientLive";
import { usePatientCid } from "@/hooks/usePatientCid";
import type { Patient } from "@/types/patient";

/**
 * Builds a Patient object suitable for <PatientCockpit /> from URL searchParams,
 * enriched with the live patient row (realtime) and current CIDs.
 *
 * Used across clinical modules (Evolução, Prescrição, Requisições, Documentos,
 * Movimentações) so the right-side cockpit stays consistent.
 */
export function useCockpitPatient(): Patient | null {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const patientName =
    searchParams.get("patientName") ||
    searchParams.get("patient") ||
    "";
  const patientBed =
    searchParams.get("patientBed") ||
    searchParams.get("bed") ||
    "";
  const patientSector = searchParams.get("patientSector") || "";

  const { patient: livePatient } = usePatientLive(patientId || null);
  const { cidPrimary, cidSecondary } = usePatientCid(patientId || null);

  return useMemo<Patient | null>(() => {
    if (!patientId && !patientName) return null;

    const cidDiagnoses: string[] = [];
    if (cidPrimary) cidDiagnoses.push(`[Primário] ${cidPrimary}`);
    cidSecondary.forEach((c) => c && cidDiagnoses.push(c));

    if (livePatient) {
      const stored = livePatient.diagnoses || [];
      const merged = [
        ...cidDiagnoses,
        ...stored.filter((d) => !cidDiagnoses.includes(d)),
      ];
      return { ...livePatient, diagnoses: merged };
    }

    return {
      id: patientId || "stub-patient",
      bedNumber: patientBed,
      name: patientName,
      age: "",
      sector: (patientSector as Patient["sector"]) || "outside",
      diagnoses: cidDiagnoses,
      medicalHistory: [],
      relevantExams: [],
      pendencies: [],
      schedule: [],
      admissionHistory: "",
      admissionDate: undefined,
      utiAllergies: [],
      clinicalStatus: "regular",
    } as Patient;
  }, [livePatient, patientId, patientName, patientBed, patientSector, cidPrimary, cidSecondary]);
}
