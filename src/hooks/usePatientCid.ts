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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (id: string | null): string | null => (id && UUID_RE.test(id) ? id : null);

export function usePatientCid(patientId: string | null) {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const [cidPrimary, setCidPrimary] = useState<string>("");
  const [cidSecondary, setCidSecondary] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const recordIdRef = useRef<string | null>(null);
  const safePatientId = asUuid(patientId);

  const decodeSecondary = (raw: string | null): string[] => {
    if (!raw) return [];
    if (raw.startsWith("[")) {
      try { return JSON.parse(raw); } catch { /* fallthrough */ }
    }
    return raw.split(/[\n;,]/).map(s => s.trim()).filter(Boolean);
  };

  const fetchCid = useCallback(async () => {
    if (!patientId || !currentHospital || !currentState) return;
    if (!safePatientId) {
      // Mock/non-UUID id — no remote record possible.
      recordIdRef.current = null;
      setCidPrimary("");
      setCidSecondary([]);
      return;
    }
    setLoading(true);
    try {
      // ── Stage 1: most recent admission for the current bed (patient_id) ──
      const { data: byPatient, error: e1 } = await supabase
        .from("admission_histories")
        .select("id, cid_primary, cid_secondary, patient_registry_id, archived_at")
        .eq("patient_id", safePatientId)
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e1 && e1.code !== "PGRST116") throw e1;

      const activeAdmission = byPatient && !byPatient.archived_at ? byPatient : null;
      recordIdRef.current = activeAdmission ? activeAdmission.id : null;

      // Current admission already has CID → use directly.
      if (activeAdmission?.cid_primary) {
        setCidPrimary(activeAdmission.cid_primary || "");
        setCidSecondary(decodeSecondary(activeAdmission.cid_secondary));
        return;
      }

      // ── Stage 2: resolve patient_registry_id for cross-bed lookup ──────
      const { data: patRow } = await supabase
        .from("patients")
        .select("patient_registry_id")
        .eq("id", safePatientId)
        .maybeSingle();
      const registryId = (patRow as any)?.patient_registry_id ?? null;

      if (!registryId) {
        setCidPrimary("");
        setCidSecondary([]);
        return;
      }

      // ── Stage 3: search CID across any admission for the same registry
      //    (including archived — historical CID survives internal transfers)
      const { data: byRegistry, error: e3 } = await supabase
        .from("admission_histories")
        .select("id, cid_primary, cid_secondary, archived_at, created_at")
        .eq("patient_registry_id", registryId)
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (e3 && e3.code !== "PGRST116") throw e3;

      const withCid = (byRegistry || []).find((r: any) => r.cid_primary);
      if (withCid) {
        // CID found via registry — populate UI; writes still target the
        // current bed's admission (recordIdRef may be null → insert path).
        setCidPrimary(withCid.cid_primary || "");
        setCidSecondary(decodeSecondary(withCid.cid_secondary));
        return;
      }

      // ── Stage 4: nothing found ─────────────────────────────────────────
      setCidPrimary("");
      setCidSecondary([]);
    } catch (err) {
      console.error("[usePatientCid] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [patientId, safePatientId, currentHospital, currentState]);

  useEffect(() => { fetchCid(); }, [fetchCid]);

  const persist = useCallback(async (next: { primary?: string; secondary?: string[] }) => {
    if (!patientId || !currentHospital || !currentState || !user) return false;
    if (!safePatientId) {
      toast.error("Paciente sem registro permanente — CID não pode ser salvo");
      return false;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        patient_id: safePatientId,
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
        // Stamp patient_registry_id on the new admission so future
        // cross-bed lookups (Stage 3) find this record.
        let registryIdForInsert: string | null = null;
        try {
          const { data: pRow } = await supabase
            .from("patients")
            .select("patient_registry_id")
            .eq("id", safePatientId)
            .maybeSingle();
          registryIdForInsert = (pRow as any)?.patient_registry_id ?? null;
        } catch { /* silent */ }

        const insertPayload = {
          ...payload,
          created_by: user.id,
          ...(registryIdForInsert ? { patient_registry_id: registryIdForInsert } : {}),
        };
        const { data, error } = await supabase
          .from("admission_histories")
          .insert([insertPayload as any])
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
  }, [patientId, safePatientId, currentHospital, currentState, user]);

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
