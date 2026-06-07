import { supabase } from "@/integrations/supabase/client";

/**
 * Repointa o histórico clínico (evoluções, prescrições, exames, culturas,
 * histórico admissional, condutas, prontuário, etc.) de um leito-paciente
 * de origem para um leito-paciente de destino.
 *
 * Use SEMPRE em transferência interna SEM ALTA quando o fluxo move o paciente
 * para uma linha de leito diferente (UTI/UCC fixos, troca de unidade, etc.),
 * antes de "esvaziar" o leito de origem.
 */
export async function repointPatientHistory(
  sourcePatientId: string,
  targetPatientId: string,
  reason?: string,
): Promise<{ ok: boolean; counts?: Record<string, number>; error?: string; verificationWarning?: string }> {
  if (!sourcePatientId || !targetPatientId) {
    return { ok: false, error: "source/target ausente" };
  }
  if (sourcePatientId === targetPatientId) {
    return { ok: true, counts: {} };
  }
  try {
    const { data, error } = await (supabase as any).rpc("repoint_patient_history", {
      p_source_patient_id: sourcePatientId,
      p_target_patient_id: targetPatientId,
      p_reason: reason ?? null,
    });
    if (error) throw error;

    let verificationWarning: string | undefined;

    // VERIFICAÇÃO 1 — evoluções com patient_id explícito ainda no leito origem.
    // A RPC usa try/catch por tabela internamente e pode retornar sucesso mesmo
    // tendo falhado silenciosamente em clinical_evolutions.
    const { count, error: countError } = await supabase
      .from("clinical_evolutions")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", sourcePatientId)
      .is("archived_at", null);

    if (countError) {
      // Query de verificação falhou: estado incerto — propagamos o aviso ao chamador
      // para que ele possa logar ou alertar, em vez de silenciar completamente.
      const msg = `verificação 1 indisponível: ${countError.message}`;
      console.warn("[repointPatientHistory]", msg);
      verificationWarning = msg;
    } else if (count && count > 0) {
      console.error(
        `[repointPatientHistory] integridade: ${count} evolução(ões) ainda no leito origem após RPC`,
      );
      return {
        ok: false,
        error: `Histórico clínico não migrado completamente: ${count} evolução(ões) ainda no leito de origem. Tente a transferência novamente.`,
      };
    }

    // VERIFICAÇÃO 2 — evoluções com patient_id = null mas registry correto.
    // Criadas por fluxo de pré-admissão: têm patient_registry_id preenchido
    // mas patient_id = null. A RPC deve tê-las migrado (patient_id → target).
    // Se ainda existem com patient_id = null após a RPC, a migração foi parcial.
    const { data: targetData } = await supabase
      .from("patients")
      .select("patient_registry_id")
      .eq("id", targetPatientId)
      .maybeSingle();

    const registryId = (targetData as any)?.patient_registry_id as string | null;

    if (registryId) {
      const { count: nullCount, error: nullCountError } = await supabase
        .from("clinical_evolutions")
        .select("*", { count: "exact", head: true })
        .eq("patient_registry_id", registryId)
        .is("patient_id", null)
        .is("archived_at", null);

      if (nullCountError) {
        const msg2 = `verificação 2 indisponível: ${nullCountError.message}`;
        console.warn("[repointPatientHistory]", msg2);
        verificationWarning = verificationWarning
          ? `${verificationWarning}; ${msg2}`
          : msg2;
      } else if (nullCount && nullCount > 0) {
        console.error(
          `[repointPatientHistory] integridade: ${nullCount} evolução(ões) com patient_id nulo após RPC`,
        );
        return {
          ok: false,
          error: `Histórico clínico não migrado completamente: ${nullCount} registro(s) sem vínculo de leito. Tente a transferência novamente.`,
        };
      }
    }

    return {
      ok: true,
      counts: (data?.counts as Record<string, number>) ?? {},
      ...(verificationWarning ? { verificationWarning } : {}),
    };
  } catch (err: any) {
    console.error("[repointPatientHistory] erro", err);
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}
