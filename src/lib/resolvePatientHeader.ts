/**
 * Resolução imperativa (Promise) da identidade do paciente para uso em
 * handlers de impressão de PDF (admissão, evolução, prescrição, requisições,
 * round).
 *
 * MIGRAÇÃO (schema novo): o "paciente" que as telas consomem é, na prática, uma
 * INTERNAÇÃO. `patientId` == `internacoes.id`. A identidade permanente vive em
 * `pacientes` (join internacoes→pacientes). As tabelas antigas patient_registry,
 * patient_encounters e medical_records NÃO existem mais, então toda a lógica de
 * resolução por registry / guarda anti-NI por registry / atendimento por encounter
 * foi degradada — ver MIGRACAO_DEGRADACOES.md. Campos degradados retornam null.
 */
import { supabase } from "@/integrations/supabase/client";
import { detectUnidentified } from "@/lib/unidentifiedDetector";
import { formatAge } from "@/lib/patientAge";

export interface ResolvedPatientHeader {
  /** Nome canônico (pacientes.nome_completo → fallback) */
  name: string;
  socialName: string | null;
  /** Número de Prontuário (pacientes.prontuario) */
  prontuario: string | null;
  /** Código de Atendimento — MIGRAÇÃO: sem coluna no schema novo (sempre null) */
  atendimento: string | null;
  cpf: string | null;
  cns: string | null;
  /** ISO yyyy-mm-dd */
  birthDate: string | null;
  /** Calculada a partir de birthDate no momento da leitura — nunca fica desatualizada. */
  age: string | null;
  sex: string | null;
  motherName: string | null;
  /** Endereço (pacientes.endereco) */
  address: string | null;
  phone: string | null;
  isUnidentified: boolean;
  unidentifiedCode: string | null;
  /** MIGRAÇÃO: sem tabela de registry no schema novo (sempre null) */
  registryId: string | null;
}

/**
 * Lê o leito + setor ATUAIS da INTERNAÇÃO direto do banco (após qualquer
 * relocação/transferência). Use SEMPRE este helper antes de imprimir documentos
 * clínicos — nunca confie em snapshots gravados em evoluções/admissões antigas.
 *
 * MIGRAÇÃO: antes lia `patients.bed_number/sector`; agora resolve via
 * internacoes → leitos(numero) + setores(nome).
 *
 * Retorna `{ bed: null, sector: null }` se a internação não existir mais
 * (alta) ou se a consulta falhar — o caller deve aplicar fallback.
 */
export async function resolveCurrentBedSector(
  patientId: string | null | undefined,
): Promise<{ bed: string | null; sector: string | null }> {
  if (!patientId) return { bed: null, sector: null };
  try {
    const { data } = await supabase
      .from("internacoes")
      .select("leito:leitos(numero), setor:setores(nome)")
      .eq("id", patientId)
      .maybeSingle();
    return {
      bed: (data as any)?.leito?.numero ?? null,
      sector: (data as any)?.setor?.nome ?? null,
    };
  } catch {
    return { bed: null, sector: null };
  }
}

export async function resolvePatientHeader(
  patientId: string | null | undefined,
  fallbackName: string | null | undefined,
  // MIGRAÇÃO: hospitalUnitId e registryIdHint são mantidos na assinatura por
  // compatibilidade, mas não têm mais uso (busca por registry/nome/unidade foi
  // removida — patient_registry não existe no schema novo).
  hospitalUnitId: string | null | undefined,
  registryIdHint?: string | null,
): Promise<ResolvedPatientHeader> {
  const empty: ResolvedPatientHeader = {
    name: fallbackName || "—",
    socialName: null,
    prontuario: null,
    atendimento: null,
    cpf: null,
    cns: null,
    birthDate: null,
    age: null,
    sex: null,
    motherName: null,
    address: null,
    phone: null,
    isUnidentified: false,
    unidentifiedCode: null,
    registryId: null,
  };

  if (!patientId && !fallbackName) return empty;

  let paciente: any = null;

  // Identidade a partir da internação (patientId == internacoes.id) → pacientes.
  if (patientId) {
    try {
      const { data } = await supabase
        .from("internacoes")
        .select("paciente:pacientes(*)")
        .eq("id", patientId)
        .maybeSingle();
      paciente = (data as any)?.paciente ?? null;
    } catch {
      paciente = null;
    }
  }

  if (!paciente) {
    // Sem internação/paciente resolvido: devolve o mínimo com base no fallback,
    // marcando NI pela heurística de nome (sem registry para confirmar).
    const ni = detectUnidentified(fallbackName || "");
    return {
      ...empty,
      isUnidentified: ni.isUnidentified,
    };
  }

  // Nome canônico: nome_social || nome_completo || fallback.
  const canonicalName = paciente.nome_completo || fallbackName || "—";

  // MIGRAÇÃO: is_unidentified/unidentified_code eram colunas de patient_registry.
  // Sem registry, derivamos NI apenas pela heurística de nome; código NI degradado.
  const niDetection = detectUnidentified(canonicalName);

  return {
    name: canonicalName,
    socialName: paciente.nome_social || null,
    prontuario: paciente.prontuario || null,
    atendimento: null, // MIGRAÇÃO: sem encounter_code/atendimento no schema novo
    cpf: paciente.cpf || null,
    cns: paciente.cns || null,
    birthDate: paciente.data_nascimento || null,
    age: formatAge(paciente.data_nascimento),
    sex: paciente.sexo || null,
    motherName: paciente.nome_mae || null,
    address: paciente.endereco || null,
    phone: paciente.telefone || null,
    isUnidentified: niDetection.isUnidentified,
    unidentifiedCode: null, // MIGRAÇÃO: sem coluna de código NI
    registryId: null, // MIGRAÇÃO: sem tabela de registry
  };
}
