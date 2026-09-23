export type MedicalRecordMode = "legacy" | "auto";

interface UseMedicalRecordModeResult {
  mode: MedicalRecordMode;
  loading: boolean;
  unitCode: string | null;
}

/**
 * MIGRAÇÃO: hospital_units → hospitais. A tabela `hospitais` do schema novo NÃO
 * possui as colunas `medical_record_mode` nem `unit_code` (não há geração
 * automática de prontuário no backend novo). Ambos DEGRADADOS:
 *   - `mode` fixo em "legacy" (exige número de prontuário manual);
 *   - `unitCode` sempre null.
 * A assinatura é preservada — os consumidores (AdminDashboardPage,
 * PatientRegistrationDialog) só leem `mode`.
 */
export function useMedicalRecordMode(hospitalUnitId?: string | null): UseMedicalRecordModeResult {
  void hospitalUnitId; // mantido por compatibilidade; sem uso (colunas inexistentes no schema novo)
  return { mode: "legacy", loading: false, unitCode: null };
}
