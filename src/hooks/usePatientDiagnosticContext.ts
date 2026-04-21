import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Loads & persists discharge prediction (UTI + Hospitalar), palliative flag, and
 * isolation/precautions for a patient — keeping these in sync with the admission
 * row in `patients`. Exposed inside the Diagnósticos block of the Evolution screen.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (id: string | null): string | null => (id && UUID_RE.test(id) ? id : null);

export interface PatientDiagnosticContext {
  /** Previsão de alta da UTI/UCI (ISO yyyy-MM-dd ou string livre legada) */
  utiDischargePrediction: string;
  /** Previsão de alta hospitalar (ISO yyyy-MM-dd) */
  hospitalDischargePrediction: string;
  isPalliative: boolean;
  isolationPrecautions: string;
}

export function usePatientDiagnosticContext(patientId: string | null) {
  const safeId = asUuid(patientId);
  const [data, setData] = useState<PatientDiagnosticContext>({
    utiDischargePrediction: "",
    hospitalDischargePrediction: "",
    isPalliative: false,
    isolationPrecautions: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = useCallback(async () => {
    if (!safeId) return;
    setLoading(true);
    try {
      const { data: row, error } = await supabase
        .from("patients")
        .select("uti_discharge_prediction, hospital_discharge_prediction, is_palliative, isolation_precautions")
        .eq("id", safeId)
        .maybeSingle();
      if (error) throw error;
      if (row) {
        setData({
          utiDischargePrediction: row.uti_discharge_prediction || "",
          hospitalDischargePrediction: (row as any).hospital_discharge_prediction || "",
          isPalliative: !!row.is_palliative,
          isolationPrecautions: row.isolation_precautions || "",
        });
      }
    } catch (err) {
      console.error("[usePatientDiagnosticContext] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [safeId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime sync — keeps Evolução tied to changes done in Admissão / Painel Clínico
  useEffect(() => {
    if (!safeId) return;
    const channel = supabase
      .channel(`patient-diag-ctx-${safeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patients", filter: `id=eq.${safeId}` },
        (payload: any) => {
          if (!payload.new) return;
          setData(prev => ({
            utiDischargePrediction: payload.new.uti_discharge_prediction ?? prev.utiDischargePrediction,
            hospitalDischargePrediction: payload.new.hospital_discharge_prediction ?? prev.hospitalDischargePrediction,
            isPalliative: payload.new.is_palliative ?? prev.isPalliative,
            isolationPrecautions: payload.new.isolation_precautions ?? prev.isolationPrecautions,
          }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [safeId]);

  const persist = useCallback(async (patch: Partial<PatientDiagnosticContext>, opts?: { silent?: boolean }) => {
    if (!safeId) {
      if (!opts?.silent) toast.error("Paciente sem registro permanente — não é possível salvar");
      return false;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (patch.utiDischargePrediction !== undefined) payload.uti_discharge_prediction = patch.utiDischargePrediction || null;
      if (patch.hospitalDischargePrediction !== undefined) payload.hospital_discharge_prediction = patch.hospitalDischargePrediction || null;
      if (patch.isPalliative !== undefined) payload.is_palliative = patch.isPalliative;
      if (patch.isolationPrecautions !== undefined) payload.isolation_precautions = patch.isolationPrecautions || null;
      const { error } = await supabase.from("patients").update(payload).eq("id", safeId);
      if (error) throw error;
      return true;
    } catch (err: any) {
      console.error("[usePatientDiagnosticContext] persist error", err);
      if (!opts?.silent) toast.error("Erro ao salvar: " + (err.message || "desconhecido"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [safeId]);

  const updateUtiDischargePrediction = useCallback((value: string) => {
    setData(prev => ({ ...prev, utiDischargePrediction: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const ok = await persist({ utiDischargePrediction: value }, { silent: true });
      if (ok) toast.success("Previsão de alta da UTI atualizada");
    }, 400);
  }, [persist]);

  const updateHospitalDischargePrediction = useCallback((value: string) => {
    setData(prev => ({ ...prev, hospitalDischargePrediction: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const ok = await persist({ hospitalDischargePrediction: value }, { silent: true });
      if (ok) toast.success("Previsão de alta hospitalar atualizada");
    }, 400);
  }, [persist]);

  const updateIsPalliative = useCallback(async (value: boolean) => {
    setData(prev => ({ ...prev, isPalliative: value }));
    const ok = await persist({ isPalliative: value }, { silent: true });
    if (ok) toast.success(value ? "Marcado como cuidados paliativos" : "Cuidados paliativos removido");
  }, [persist]);

  const updateIsolationPrecautions = useCallback((value: string) => {
    setData(prev => ({ ...prev, isolationPrecautions: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const ok = await persist({ isolationPrecautions: value }, { silent: true });
      if (ok) toast.success("Precaução/isolamento atualizado");
    }, 600);
  }, [persist]);

  return {
    ...data,
    loading, saving,
    updateUtiDischargePrediction,
    updateHospitalDischargePrediction,
    updateIsPalliative,
    updateIsolationPrecautions,
    refresh: fetch,
  };
}
