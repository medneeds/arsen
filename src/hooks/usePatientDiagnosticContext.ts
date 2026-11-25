import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DIAGNOSTIC_CONTEXT_COLUMN,
  EMPTY_DIAGNOSTIC_CONTEXT,
  fromInternacaoRow,
  toColumnValue,
  type DiagnosticContextField,
  type InternacaoDiagRow,
  type PatientDiagnosticContext,
} from "@/lib/internacaoDiagnosticContext";

/**
 * Previsao de alta (UTI/UCI e hospitalar), paliativo e precaucao/isolamento da
 * INTERNACAO — exibidos no bloco Diagnosticos da evolucao.
 *
 * Fonte unica: colunas de `internacoes` (mesma linha que a admissao grava e que
 * o mapa de leitos le via usePatients):
 *   previsao_alta             -> previsao de alta da UTI/UCI
 *   previsao_alta_hospitalar  -> previsao de alta hospitalar
 *   paliativo                 -> cuidados paliativos
 *   precaucao_isolamento      -> precaucao/isolamento vigente
 *
 * Antes (degradacao da migracao) o estado vivia so em memoria: zerava ao
 * recarregar e nunca chegava ao mapa. Agora le ao montar, grava a cada mudanca
 * e acompanha a linha por realtime (outra tela/usuario alterando).
 *
 * `patientId` aqui e o id da internacao (internacoes.id).
 */
export type { PatientDiagnosticContext } from "@/lib/internacaoDiagnosticContext";

type Field = DiagnosticContextField;
const COLUMN = DIAGNOSTIC_CONTEXT_COLUMN;
const EMPTY = EMPTY_DIAGNOSTIC_CONTEXT;

/** Texto e data esperam o usuario parar de digitar (input date dispara a cada digito do ano). */
const TEXT_DEBOUNCE_MS = 600;

export function usePatientDiagnosticContext(patientId: string | null) {
  const [data, setData] = useState<PatientDiagnosticContext>({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastPatientRef = useRef<string | null>(null);
  // Campos com gravacao pendente: o eco do realtime/refetch nao sobrescreve o
  // que o usuario acabou de digitar.
  const pendingRef = useRef<Partial<Record<Field, ReturnType<typeof setTimeout> | true>>>({});

  const load = useCallback(async (id: string | null) => {
    if (!id) { setData({ ...EMPTY }); return; }
    setLoading(true);
    const { data: row, error } = await supabase
      .from("internacoes")
      .select("previsao_alta, previsao_alta_hospitalar, paliativo, precaucao_isolamento")
      .eq("id", id)
      .maybeSingle();
    setLoading(false);
    if (lastPatientRef.current !== id) return; // trocou de paciente no meio
    if (error) {
      console.error("[usePatientDiagnosticContext] leitura falhou:", error);
      return;
    }
    const fresh = fromInternacaoRow(row as InternacaoDiagRow | null);
    setData((prev) => {
      const next = { ...fresh };
      for (const f of Object.keys(pendingRef.current) as Field[]) {
        (next as Record<Field, unknown>)[f] = prev[f];
      }
      return next;
    });
  }, []);

  // Ao trocar de paciente: limpa e recarrega do banco.
  useEffect(() => {
    if (lastPatientRef.current !== patientId) {
      lastPatientRef.current = patientId;
      for (const t of Object.values(pendingRef.current)) {
        if (t && t !== true) clearTimeout(t);
      }
      pendingRef.current = {};
      setData({ ...EMPTY });
      void load(patientId);
    }
  }, [patientId, load]);

  // Realtime: outra tela/usuario alterou a internacao.
  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`diag-ctx-${patientId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "internacoes", filter: `id=eq.${patientId}` },
        () => { void load(patientId); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, load]);

  const persist = useCallback(async (id: string, field: Field, value: string | boolean) => {
    pendingRef.current[field] = true;
    setSaving(true);
    const { error } = await supabase
      .from("internacoes")
      .update({ [COLUMN[field]]: toColumnValue(field, value) } as never)
      .eq("id", id);
    if (pendingRef.current[field] === true) delete pendingRef.current[field];
    setSaving(false);
    if (error) {
      console.error(`[usePatientDiagnosticContext] gravacao de ${COLUMN[field]} falhou:`, error);
      toast.error("Não foi possível salvar no prontuário", { description: error.message });
      if (lastPatientRef.current === id) void load(id); // volta ao que esta no banco
    }
  }, [load]);

  const update = useCallback((field: Field, value: string | boolean, debounce = false) => {
    const id = lastPatientRef.current;
    setData((prev) => ({ ...prev, [field]: value }));
    if (!id) return;
    const prevTimer = pendingRef.current[field];
    if (prevTimer && prevTimer !== true) clearTimeout(prevTimer);
    if (debounce) {
      pendingRef.current[field] = setTimeout(() => { void persist(id, field, value); }, TEXT_DEBOUNCE_MS);
    } else {
      void persist(id, field, value);
    }
  }, [persist]);

  const refresh = useCallback(async () => { await load(lastPatientRef.current); }, [load]);

  const updateUtiDischargePrediction = useCallback((value: string) => update("utiDischargePrediction", value, true), [update]);
  const updateHospitalDischargePrediction = useCallback((value: string) => update("hospitalDischargePrediction", value, true), [update]);
  const updateIsPalliative = useCallback(async (value: boolean) => update("isPalliative", value), [update]);
  const updateIsolationPrecautions = useCallback((value: string) => update("isolationPrecautions", value, true), [update]);

  return {
    ...data,
    loading, saving,
    updateUtiDischargePrediction,
    updateHospitalDischargePrediction,
    updateIsPalliative,
    updateIsolationPrecautions,
    refresh,
  };
}
