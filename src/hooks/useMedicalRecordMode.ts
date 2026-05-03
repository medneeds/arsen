import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MedicalRecordMode = "legacy" | "auto";

interface UseMedicalRecordModeResult {
  mode: MedicalRecordMode;
  loading: boolean;
  unitCode: string | null;
}

/**
 * Lê hospital_units.medical_record_mode da unidade ativa.
 * - "legacy": exige número manual (sistema antigo).
 * - "auto": gera AA-UUU-SSSSSS-DV automaticamente quando vazio.
 */
export function useMedicalRecordMode(hospitalUnitId?: string | null): UseMedicalRecordModeResult {
  const [mode, setMode] = useState<MedicalRecordMode>("legacy");
  const [unitCode, setUnitCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hospitalUnitId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("hospital_units")
        .select("medical_record_mode, unit_code")
        .eq("id", hospitalUnitId)
        .maybeSingle();
      if (cancelled) return;
      const m = ((data as any)?.medical_record_mode as MedicalRecordMode) || "legacy";
      setMode(m === "auto" ? "auto" : "legacy");
      setUnitCode(((data as any)?.unit_code as string) || null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hospitalUnitId]);

  return { mode, loading, unitCode };
}
