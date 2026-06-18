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
 * Tabela: audit_logs (action='INSERT', table_name='reconstitution_suggestion_feedback')
 * Não cria tabela nova; reusa o canal existente.
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
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: 'INSERT',
      table_name: 'reconstitution_suggestion_feedback',
      record_id: null,
      new_data: {
        medication: p.medication,
        patient_id: p.patientId ?? null,
        accepted,
        had_suggestion: !!p.suggested,
        suggested: p.suggested ?? null,
        prescribed: p.prescribed,
        source: p.suggested?.source ?? null,
      },
      changed_fields: changed,
    });
  } catch {
    // não propaga — feedback é auxiliar
  }
}
