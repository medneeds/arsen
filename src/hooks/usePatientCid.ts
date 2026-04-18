import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";

/**
 * Loads and persists CID-10 codes for a patient on the
 * `admission_histories` table. Used by the CompactPatientHeader
 * so doctors can adjust diagnoses inline without leaving the
 * Evolution / Prescription screens. Secondary CIDs are stored
 * as a JSON-encoded array in the single `cid_secondary` text
 * column to avoid a schema migration.
 */
export function usePatientCid(patientId: string | null) {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const [cidPrimary, setCidPrimary] = useState<string>("");
  const [cidSecondary, setCidSecondary] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const recordIdRef = useRef<string | null>(null);

  const decodeSecondary = (raw: string | null): string[] => {
    if (!raw) return [];
    if (raw.startsWith("[")) {
      try { return JSON.parse(raw); } catch { /* fallthrough */ }
    }
    return raw.split(/[\n;,]/).map(s => s.trim()).filter(Boolean);
  };

  const fetchCid = useCallback(async () => {
    if (!patientId || !currentHospital || !currentState) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admission_histories")
        .select("id, cid_primary, cid_secondary")
        .eq("patient_id", patientId)
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      if (data) {
        recordIdRef.current = data.id;
        setCidPrimary(data.cid_primary || "");
        setCidSecondary(decodeSecondary(data.cid_secondary));
      } else {
        recordIdRef.current = null;
        setCidPrimary("");
        setCidSecondary([]);
      }
    } catch (err) {
      console.error("[usePatientCid] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [patientId, currentHospital, currentState]);

  useEffect(() => { fetchCid(); }, [fetchCid]);

  const persist = useCallback(async (next: { primary?: string; secondary?: string[] }) => {
    if (!patientId || !currentHospital || !currentState || !user) return false;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        patient_id: patientId,
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
        updated_by: user.id,
      };
      if (next.primary !== undefined) payload.cid_primary = next.primary || null;
      if (next.secondary !== undefined) {
        payload.cid_secondary = next.secondary.length ? JSON.stringify(next.secondary) : null;
      }

      if (recordIdRef.current) {
        const { error } = await supabase
          .from("admission_histories")
          .update(payload)
          .eq("id", recordIdRef.current);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("admission_histories")
          .insert([{ ...payload, created_by: user.id } as any])
          .select("id")
          .single();
        if (error) throw error;
        recordIdRef.current = data.id;
      }
      return true;
    } catch (err: any) {
      console.error("[usePatientCid] save error", err);
      toast.error("Erro ao salvar CID: " + (err.message || "desconhecido"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [patientId, currentHospital, currentState, user]);

  const updatePrimary = useCallback(async (value: string) => {
    setCidPrimary(value);
    const ok = await persist({ primary: value });
    if (ok) toast.success(value ? "CID primário atualizado" : "CID primário removido");
  }, [persist]);

  const updateSecondary = useCallback(async (values: string[]) => {
    setCidSecondary(values);
    const ok = await persist({ secondary: values });
    if (ok) toast.success("CIDs secundários atualizados");
  }, [persist]);

  return {
    cidPrimary, cidSecondary,
    loading, saving,
    updatePrimary, updateSecondary,
    refresh: fetchCid,
  };
}
