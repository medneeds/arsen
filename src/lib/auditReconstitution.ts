/**
 * Auditoria da sugestão de reconstituição do Guia ATB.
 *
 * Para cada antimicrobiano anexado à prescrição, registramos UMA linha em
 * `audit_logs` indicando se o médico:
 *   - MANTEVE a sugestão (accepted: true)
 *   - EDITOU algum campo (accepted: false, com diff dos campos alterados)
 *
 * Esses dados alimentam o feedback diário à farmácia: se uma sugestão é
 * consistentemente editada da mesma forma, ela vira o novo default.
 *
 * MIGRAÇÃO: audit_logs → logs_auditoria. tipo_evento='feedback_reconstituicao',
 * acao='INSERT', nome_tabela='reconstitution_suggestion_feedback' (rótulo do canal,
 * preservado). user_id→ator_user_id, user_email→email_ator, new_data→dados_novos,
 * changed_fields→campos_alterados. Não cria tabela nova; reusa o canal existente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ReconAuditPayload {
  medication: string;
  patientId?: string;
  // Valores da sugestão (default do catálogo) — pode estar ausente se não havia
  suggested?: {
    solvent?: string;
    volumeMl?: string;
    finalDiluent?: string;
    finalVolumeMl?: string;
    infusionTimeMin?: string;
    source?: string;
  };
  // Valores efetivamente prescritos (após edição do médico)
  prescribed: {
    solvent?: string;
    volumeMl?: string;
    finalDiluent?: string;
    finalVolumeMl?: string;
    infusionTimeMin?: string;
  };
}

function fieldsChanged(p: ReconAuditPayload): string[] {
  if (!p.suggested) return [];
  const keys: (keyof NonNullable<ReconAuditPayload['suggested']>)[] = [
    'solvent', 'volumeMl', 'finalDiluent', 'finalVolumeMl', 'infusionTimeMin',
  ];
  const changed: string[] = [];
  for (const k of keys) {
    const sug = (p.suggested[k] || '').trim();
    const pre = ((p.prescribed as Record<string, string | undefined>)[k] || '').trim();
    if (sug && pre && sug !== pre) changed.push(k);
  }
  return changed;
}

/**
 * Grava o feedback. Falha silenciosa — não bloqueia o fluxo clínico.
 */
export async function logReconstitutionFeedback(p: ReconAuditPayload): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const changed = fieldsChanged(p);
    const accepted = p.suggested ? changed.length === 0 : false;
    await supabase.from('logs_auditoria').insert({
      tipo_evento: 'feedback_reconstituicao',
      acao: 'INSERT',
      nome_tabela: 'reconstitution_suggestion_feedback',
      ator_user_id: user.id,
      email_ator: user.email ?? null,
      registro_id: null,
      dados_novos: {
        medication: p.medication,
        patient_id: p.patientId ?? null,
        accepted,
        had_suggestion: !!p.suggested,
        suggested: p.suggested ?? null,
        prescribed: p.prescribed,
        source: p.suggested?.source ?? null,
      },
      campos_alterados: changed,
    });
  } catch {
    // não propaga — feedback é auxiliar
  }
}
