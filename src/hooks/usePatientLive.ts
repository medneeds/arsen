import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/types/patient";
import { formatAge } from "@/lib/patientAge";
import { ADMISSION_STATUS } from "@/lib/admissionStatus";
import { fetchPendingInternalTransferInternacaoIds } from "@/lib/internalTransfer";

/**
 * Deriva a tarja de sinalizacao (admissionStatus) a partir da MESMA fonte que o
 * usePatients — para o cockpit nao ficar cego a transferencia ativa no
 * deep-link/F5 (uma tela sabia algo que a outra nao sabia). Regras identicas:
 *  - Transferencia INTERNA: vem de logs_auditoria (nao tem status proprio; o
 *    CHECK colapsa em "ativa") — tem prioridade sobre o status.
 *  - SAIDAS (alta/obito/transf. externa): a internacao fica ABERTA ate a
 *    liberacao fisica (Opcao A), com o desfecho em internacoes.status.
 */
function deriveAdmissionStatus(
  internmentStatus: string | null | undefined,
  isPendingInternalTransfer: boolean,
): Patient["admissionStatus"] {
  if (isPendingInternalTransfer) return ADMISSION_STATUS.INTERNAL_TRANSFER_PENDING;
  switch (internmentStatus) {
    case "alta":
      return ADMISSION_STATUS.DISCHARGE_GIVEN;
    case "obito":
      return ADMISSION_STATUS.DEATH;
    case "transferida":
      return ADMISSION_STATUS.EXTERNAL_TRANSFER_PENDING;
    default:
      return undefined; // "ativa"/"cancelada" → sem tarja
  }
}

/**
 * Subscribes to a single internação (paciente internado) in real time.
 * Used by the clinical Cockpit so any change made in the
 * Painel Clínico (or elsewhere) reflects instantly on the
 * sidebar of /evolucao, /prescricao, etc.
 *
 * MIGRAÇÃO: `patientId` agora é `internacoes.id`. Os dados do paciente
 * vêm do join internacoes → pacientes/leitos/setores. A idade é calculada
 * a partir de pacientes.data_nascimento (nunca desatualiza), então o antigo
 * cache de birth_date por patient_registry deixou de ser necessário.
 */
const INTERNACAO_SELECT = `
  id, status, data_entrada, data_alta,
  queixa_principal, historia_clinica, hipotese_diagnostica, conduta_inicial,
  exames_relevantes, pendencias, agenda, setor_classificacao_id, leito_id, paciente_id,
  paciente:pacientes(id, nome_completo, nome_social, data_nascimento),
  leito:leitos(numero),
  setor:setores(nome)
`;

function rowToPatient(row: any): Patient {
  const splitLines = (v: string | null | undefined) =>
    v ? v.split("\n").filter(Boolean) : [];
  const pac = row.paciente || {};
  const leito = row.leito || {};
  const setor = row.setor || {};
  return {
    id: row.id,
    bedNumber: leito.numero || "",
    name: pac.nome_social || pac.nome_completo || "",
    // Idade calculada a partir de pacientes.data_nascimento (nunca fica desatualizada).
    age: formatAge(pac.data_nascimento) || "",
    sector: setor.nome || "",
    diagnoses: splitLines(row.hipotese_diagnostica),
    medicalHistory: splitLines(row.historia_clinica),
    relevantExams: splitLines(row.exames_relevantes),
    pendencies: splitLines(row.pendencias),
    // Plano Terapeutico: conduta_inicial (fonte canonica da Evolucao).
    therapeuticPlan: splitLines(row.conduta_inicial),
    schedule: splitLines(row.agenda),
    admissionDate: row.data_entrada || undefined,
    admittedAt: row.data_entrada || undefined,
    internmentStatus: row.status || undefined,
    // MIGRAÇÃO: sem coluna nova — degradados para default (ver MIGRACAO_DEGRADACOES.md).
    admissionHistory: "",
    clinicalStatus: "regular",
    admissionStatus: undefined,
    medicalResponsibility: undefined,
    // MIGRAÇÃO: bloco UTI não existe no schema novo — arrays vazios / undefined.
    utiAllergies: [],
    utiDevices: [],
    utiDailyConducts: [],
    utiDischargePrediction: [],
    utiCulturesAntibiotics: [],
    utiCurrentStatus: [],
    utiAdmissionDate: undefined,
    utiAdmissionReason: undefined,
    utiOriginSector: undefined,
    utiSpecialties: [],
  } as Patient;
}

export function usePatientLive(patientId: string | null) {
  const queryClient = useQueryClient();

  // PERFORMANCE: migrado de useState/useEffect para react-query. Agora os dados
  // do paciente (identidade/leito/setor/status) ficam no cache compartilhado
  // (queryKey por internacao_id), entao alternar entre modulos (Admissao ->
  // Prescricao -> Evolucao...) REAPROVEITA o load em vez de buscar do zero a cada
  // montagem. staleTime/gcTime vem do QueryClient (5min/30min). O realtime abaixo
  // invalida a query quando a internacao/logs mudam, mantendo os dados frescos.
  const query = useQuery({
    queryKey: ["patient-live", patientId],
    enabled: !!patientId,
    queryFn: async (): Promise<Patient | null> => {
      if (!patientId) return null;
      // Em paralelo: a internacao (dados do paciente), a fila de transferencia
      // interna pendente (MESMA fonte do usePatients, para a tarja) e a entrada no
      // setor atual (ultimo conclusao_transferencia_interna, para o TPS).
      const [{ data, error }, pendingIds, sectorEntry] = await Promise.all([
        supabase.from("internacoes").select(INTERNACAO_SELECT).eq("id", patientId).maybeSingle(),
        fetchPendingInternalTransferInternacaoIds().catch(() => new Set<string>()),
        (async (): Promise<string | null> => {
          try {
            const { data } = await supabase
              .from("logs_auditoria")
              .select("criado_em")
              .eq("internacao_id", patientId)
              .eq("tipo_evento", "conclusao_transferencia_interna")
              .order("criado_em", { ascending: false })
              .limit(1)
              .maybeSingle();
            return (data as { criado_em: string | null } | null)?.criado_em ?? null;
          } catch {
            return null;
          }
        })(),
      ]);
      if (error || !data) return null;
      const p = rowToPatient(data);
      p.admissionStatus = deriveAdmissionStatus(
        // internmentStatus carrega, em runtime, o internacoes.status cru.
        p.internmentStatus as unknown as string | null,
        pendingIds.has(patientId),
      );
      // TPS: entrada no setor atual; fallback data_entrada (=admissionDate).
      p.sectorSince = sectorEntry ?? p.admissionDate ?? null;
      return p;
    },
  });

  useEffect(() => {
    if (!patientId) return;
    // MIGRAÇÃO: realtime em "internacoes" (antes "patients"), filtrando id=eq.<internacaoId>.
    // O payload nao traz os joins, entao invalidamos a query (refetch completo) a
    // cada evento, mantendo o view-model consistente no cache compartilhado.
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["patient-live", patientId] });
    const channel = supabase
      .channel(`patient-live-${patientId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "internacoes", filter: `id=eq.${patientId}` },
        invalidate)
      // Tarja de transferencia interna vem de logs_auditoria (nao mexe em
      // internacoes.status), entao a sinalizacao/cancelamento so viraria ao vivo
      // com este listener — mesma fonte do usePatients.
      .on("postgres_changes",
        { event: "*", schema: "public", table: "logs_auditoria", filter: `internacao_id=eq.${patientId}` },
        invalidate)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, queryClient]);

  return {
    patient: query.data ?? null,
    loading: query.isLoading,
    refresh: async () => { await query.refetch(); },
  };
}
