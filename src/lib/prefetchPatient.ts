import type { QueryClient } from "@tanstack/react-query";
import { fetchPatientLive, patientLiveQueryKey } from "@/hooks/usePatientLive";
import { fetchPatientIdentifiers, patientIdentifiersQueryKey } from "@/hooks/usePatientIdentifiers";

/**
 * PERFORMANCE: aquece o cache do react-query de UM paciente — as MESMAS queries
 * usadas pelos modulos (patient-live + patient-identifiers), com as MESMAS
 * queryKeys/queryFns dos hooks usePatientLive/usePatientIdentifiers.
 *
 * Chamado ao passar o mouse / selecionar o paciente no Painel/Mapa: quando o
 * usuario abre um modulo (Admissao/Prescricao/Evolucao...), os dados ja estao no
 * cache -> abertura instantanea, sem buscar do zero. O staleTime do QueryClient
 * (5min) evita refetch desnecessario; prefetchQuery nao refaz se ja estiver fresco.
 */
export function prefetchPatient(
  qc: QueryClient,
  patientId: string | null | undefined,
  patientName?: string | null,
): void {
  if (!patientId) return;
  const name = patientName ?? null;
  void qc.prefetchQuery({
    queryKey: patientLiveQueryKey(patientId),
    queryFn: () => fetchPatientLive(patientId),
  });
  void qc.prefetchQuery({
    queryKey: patientIdentifiersQueryKey(patientId, name),
    queryFn: () => fetchPatientIdentifiers(patientId, name),
  });
}

/**
 * Aquece o cache de TODOS os pacientes de um setor (ex.: ao abrir a UTI-2) — assim
 * selecionar qualquer paciente do setor abre instantaneo. Os itens sao {id, name}.
 * react-query deduplica e respeita o staleTime, entao chamar de novo nao refaz os
 * que ja estao frescos.
 */
export function prefetchPatients(
  qc: QueryClient,
  patients: { id: string | null | undefined; name?: string | null }[],
): void {
  patients.forEach((p) => prefetchPatient(qc, p.id, p.name));
}
