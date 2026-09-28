import { supabase } from "@/integrations/supabase/client";
import { toSexoDb } from "@/lib/sexo";

/**
 * Alocacao de uma pre-admissao em leito: garantir leito -> garantir paciente ->
 * criar internacao -> ocupar o leito -> marcar a pre-admissao como admitida.
 *
 * Fonte UNICA para os dois caminhos de entrada:
 *  - AdmitPatientDialog, setores sem SAPS 3 (aloca direto);
 *  - Saps3Page, setores com SAPS 3 (UTI 1, UTI 2, UCI 2), que recebe a
 *    pre-admissao do dialogo.
 *
 * Antes (28/09/2026) este codigo vivia so no dialogo. Na migracao para o schema
 * novo a alocacao foi retirada do SAPS, mas o dialogo continuou entregando a UTI
 * para o SAPS concluir: cada tela achava que a outra alocava, e nenhum paciente
 * entrava em UTI 1/UTI 2/UCI 2 por esse fluxo — com ou sem SAPS preenchido.
 */

export interface PreAdmissionFull {
  id: string;
  /** MIGRAÇÃO: paciente já criado no cadastro da pré-admissão (dados_extraidos_ia.paciente_id). */
  paciente_id?: string | null;
  patient_name: string;
  social_name?: string | null;
  birth_date: string | null;
  sex: string | null;
  medical_record: string | null;
  cpf: string | null;
  cns: string | null;
  mother_name: string | null;
  phone: string | null;
  destination_sector: string | null;
  status: string;
  risk_classification: string | null;
  chief_complaint: string | null;
  vital_signs: any;
  glasgow_score: number | null;
  glasgow_detail: any;
  airway_patent: boolean | null;
  airway_obstruction: boolean | null;
  airway_intubated: boolean | null;
  allergies: string | null;
  flu_symptoms: boolean | null;
  flu_symptoms_detail: string | null;
  peripheral_perfusion: string | null;
  pulse_quality: string | null;
  pain_scale: number | null;
  oxygen_therapy: boolean | null;
  oxygen_therapy_detail: string | null;
  triage_notes: string | null;
  notes: string | null;
  created_at: string;
}

// MIGRAÇÃO: pre_admissoes só tem colunas de identificação/triagem básicas
// (nome_paciente, cpf, cns, data_nascimento, classificacao_risco, setor_destino_id,
// dados_extraidos_ia Json, status, data_hora). Todo o bloco clínico rico do modelo
// antigo (vital_signs, glasgow, allergies, chief_complaint, airway_*, oxygen_therapy,
// triage_notes, sex, mother_name, phone, medical_record, social_name, notes...) NÃO
// tem coluna → é lido de `dados_extraidos_ia` (Json) quando presente, senão degrada a
// null e a seção correspondente da UI simplesmente não renderiza.
export function mapPreAdmissao(raw: any): PreAdmissionFull {
  const ia = (raw?.dados_extraidos_ia as any) || {};
  const pick = <T,>(k: string): T | null => (ia[k] ?? null);
  return {
    id: raw.id,
    paciente_id: pick<string>("paciente_id"),
    patient_name: raw.nome_paciente,
    social_name: pick<string>("social_name"),
    birth_date: raw.data_nascimento ?? null,
    sex: pick<string>("sex"),
    medical_record: pick<string>("medical_record"),
    cpf: raw.cpf ?? null,
    cns: raw.cns ?? null,
    mother_name: pick<string>("mother_name"),
    phone: pick<string>("phone"),
    destination_sector: null, // setor_destino_id é id, não label → degradado
    status: raw.status,
    risk_classification: raw.classificacao_risco ?? null,
    chief_complaint: pick<string>("chief_complaint"),
    vital_signs: ia.vital_signs ?? null,
    glasgow_score: pick<number>("glasgow_score"),
    glasgow_detail: ia.glasgow_detail ?? null,
    airway_patent: pick<boolean>("airway_patent"),
    airway_obstruction: pick<boolean>("airway_obstruction"),
    airway_intubated: pick<boolean>("airway_intubated"),
    allergies: pick<string>("allergies"),
    flu_symptoms: pick<boolean>("flu_symptoms"),
    flu_symptoms_detail: pick<string>("flu_symptoms_detail"),
    peripheral_perfusion: pick<string>("peripheral_perfusion"),
    pulse_quality: pick<string>("pulse_quality"),
    pain_scale: pick<number>("pain_scale"),
    oxygen_therapy: pick<boolean>("oxygen_therapy"),
    oxygen_therapy_detail: pick<string>("oxygen_therapy_detail"),
    triage_notes: pick<string>("triage_notes"),
    notes: pick<string>("notes"),
    created_at: raw.criado_em ?? raw.data_hora ?? new Date().toISOString(),
  };
}

/** Carrega a pre-admissao completa pelo id; null se nao existir. */
export async function carregarPreAdmissao(id: string): Promise<PreAdmissionFull | null> {
  const { data, error } = await supabase.from("pre_admissoes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapPreAdmissao(data) : null;
}

// MIGRAÇÃO: Patient.sector ← setores.nome (usePatientLive) → o código do setor está em setores.nome.
export async function resolveSetorId(code: string): Promise<string | null> {
  if (!code) return null;
  try {
    const { data } = await supabase
      .from("setores")
      .select("id")
      .eq("nome", code)
      .maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

export interface AlocarPreAdmissaoParams {
  preAdmissao: PreAdmissionFull;
  /** Código do setor (ex.: "red"), casado com setores.nome. */
  sectorCode: string;
  /** Leito FINAL (EXTRA já resolvido para EXTRAn pelo chamador). */
  bed: string;
  dataEntrada: Date;
  pendencias: string | null;
  /** profissionais.id de quem registra (não é o auth.uid). */
  registradoPor: string | null;
}

/** Aloca a pre-admissao no leito e devolve o id da internacao criada. */
export async function alocarPreAdmissaoNoLeito({
  preAdmissao: fullData,
  sectorCode,
  bed: finalBed,
  dataEntrada,
  pendencias,
  registradoPor,
}: AlocarPreAdmissaoParams): Promise<{ internacaoId: string; setorId: string }> {
  // MIGRAÇÃO: a mega-tabela `patients` (leito+paciente) foi substituída por
  // leitos + pacientes + internacoes. Admitir = garantir leito → garantir paciente →
  // criar internação apontando para ambos → marcar leito ocupado.
  const setorId = await resolveSetorId(sectorCode);
  if (!setorId) {
    throw new Error(`Setor "${sectorCode}" não encontrado no cadastro (setores). Configure o setor antes de admitir.`);
  }

  // 1) Leito: localiza a linha do leito pelo (setor_id, numero); cria se não existir
  //    (ex.: leitos EXTRA dinâmicos). Bloqueia se já estiver ocupado.
  const { data: existingLeito } = await supabase
    .from("leitos")
    .select("id, status")
    .eq("setor_id", setorId)
    .eq("numero", finalBed)
    .maybeSingle();

  if (existingLeito && existingLeito.status === "ocupado") {
    throw new Error(`Leito ${finalBed} já está ocupado. Atualize o mapa e selecione outro leito.`);
  }

  let leitoId = (existingLeito as any)?.id ?? null;
  if (!leitoId) {
    const { data: newLeito, error: leitoErr } = await supabase
      .from("leitos")
      .insert({
        setor_id: setorId,
        numero: finalBed,
        status: "livre",
        tipo: finalBed.startsWith("EXTRA") ? "maca" : "leito",
      })
      .select("id")
      .single();
    if (leitoErr) throw leitoErr;
    leitoId = (newLeito as any).id;
  }

  // MIGRAÇÃO: arquivamento defensivo (RPC archive_patient_bed_data) REMOVIDO — a RPC não
  // existe no backend novo e a colisão de ocupante não ocorre (leito só ocupa via internação).

  // 2) Paciente: REAPROVEITA o paciente já criado no cadastro da pré-admissão
  //    (dados_extraidos_ia.paciente_id); senão por CPF; senão pelo prontuário
  //    já gravado (medical_record). Só cria um novo se nada casar — evita o
  //    "duplicate key pacientes_prontuario_key" que ocorria ao recriar o paciente.
  let pacienteId: string | null = fullData.paciente_id ?? null;
  if (pacienteId) {
    // Confirma que o paciente ainda existe (id pode estar obsoleto).
    const { data: byId } = await supabase.from("pacientes").select("id").eq("id", pacienteId).maybeSingle();
    pacienteId = (byId as any)?.id ?? null;
  }
  if (!pacienteId && fullData.cpf) {
    const { data: existingPac } = await supabase
      .from("pacientes")
      .select("id")
      .eq("cpf", fullData.cpf)
      .maybeSingle();
    pacienteId = (existingPac as any)?.id ?? null;
  }
  if (!pacienteId && fullData.medical_record) {
    const { data: byProntuario } = await supabase
      .from("pacientes")
      .select("id")
      .eq("prontuario", fullData.medical_record)
      .maybeSingle();
    pacienteId = (byProntuario as any)?.id ?? null;
  }
  if (!pacienteId) {
    // MIGRAÇÃO: pacientes.prontuario é NOT NULL e pre_admissoes não carrega prontuário/
    // medical_record próprio → usa medical_record (de dados_extraidos_ia) / cpf / cns como
    // identificador, com fallback derivado do id da pré-admissão. Nenhum dado clínico inventado.
    const prontuario =
      fullData.medical_record || fullData.cpf || fullData.cns || `PA-${String(fullData.id).slice(0, 8)}`;
    const { data: newPac, error: pacErr } = await supabase
      .from("pacientes")
      .insert({
        nome_completo: fullData.patient_name,
        nome_social: fullData.social_name ?? null,
        cpf: fullData.cpf ?? null,
        cns: fullData.cns ?? null,
        data_nascimento: fullData.birth_date ?? null,
        sexo: toSexoDb(fullData.sex),
        nome_mae: fullData.mother_name ?? null,
        telefone: fullData.phone ?? null,
        alergias: fullData.allergies ?? null,
        prontuario,
      })
      .select("id")
      .single();
    if (pacErr) throw pacErr;
    pacienteId = (newPac as any).id;
  }

  // 3) Internação. patient.id (view-model) === internacoes.id.
  // MIGRAÇÃO/DEGRADADO: sem colunas para o bloco uti_*, clinical_status, admission_status,
  // admitted_at, is_vacant, previsão de alta, medical_responsibility, highlights, saps_*,
  // department, hospital/state → não gravados. queixa/alergias/pendências mapeadas para
  // internacoes.
  const { data: novaInternacao, error: interErr } = await supabase
    .from("internacoes")
    .insert({
      paciente_id: pacienteId,
      leito_id: leitoId,
      setor_classificacao_id: setorId,
      data_entrada: dataEntrada.toISOString(),
      status: "ativa",
      queixa_principal: fullData.chief_complaint || null,
      historia_clinica: fullData.allergies ? `Alergias: ${fullData.allergies}` : null,
      pendencias: pendencias || null,
      registrado_por: registradoPor,
    })
    .select("id")
    .single();
  if (interErr) throw interErr;

  // 4) Ocupa o leito.
  await supabase.from("leitos").update({ status: "ocupado" }).eq("id", leitoId);

  // MIGRAÇÃO: vínculo de medical_records ao paciente REMOVIDO (medical_records morto;
  // prontuário vive em pacientes.prontuario).

  // 5) Atualiza a pré-admissão. destination_sector/destination_bed inexistentes → degradados;
  // setor_destino_id (id do setor) e internacao_id são preservados.
  const { error: updateError } = await supabase
    .from("pre_admissoes")
    .update({
      status: "admitido",
      setor_destino_id: setorId,
    })
    .eq("id", fullData.id);
  if (updateError) throw updateError;

  return { internacaoId: novaInternacao.id, setorId };
}
