import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/types/patient";
import { formatAge } from "@/lib/patientAge";

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
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOnce = useCallback(async () => {
    if (!patientId) { setPatient(null); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("internacoes")
      .select(INTERNACAO_SELECT)
      .eq("id", patientId)
      .maybeSingle();
    if (!error && data) {
      setPatient(rowToPatient(data));
    }
    setLoading(false);
  }, [patientId]);

  // 🔒 Reset imediato ao trocar de paciente — evita que dados stale do
  // paciente anterior apareçam no cockpit/cabeçalho durante o fetch.
  useEffect(() => {
    setPatient(null);
    setLoading(true);
  }, [patientId]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  useEffect(() => {
    if (!patientId) return;
    // MIGRAÇÃO: realtime em "internacoes" (antes "patients"), filtrando id=eq.<internacaoId>.
    // O payload de realtime não traz os joins (paciente/leito/setor), então refazemos
    // o fetch completo a cada evento para manter o view-model consistente.
    const channel = supabase
      .channel(`patient-live-${patientId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "internacoes", filter: `id=eq.${patientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") { setPatient(null); return; }
          fetchOnce();
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, fetchOnce]);

  return { patient, loading, refresh: fetchOnce };
}
