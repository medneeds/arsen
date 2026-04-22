import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LatestEvolutionSummary {
  id: string;
  status: string;
  createdAt: string;
  createdByName: string | null;
  validatedAt: string | null;
  /** SOAP "A" (avaliação) ou primeiro trecho útil para preview */
  preview: string;
}

/**
 * Realtime: última evolução clínica do paciente.
 * Dispara toast quando outra pessoa salva nova evolução enquanto a tela está aberta.
 */
export function useLatestEvolution(
  patientId: string | null,
  patientName: string | null,
  hospitalUnitId: string | null,
) {
  const [evolution, setEvolution] = useState<LatestEvolutionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const lastSeenIdRef = useRef<string | null>(null);

  const buildPreview = (soap: any): string => {
    if (!soap) return "";
    const a = soap.assessment || soap.A || soap.avaliacao;
    const s = soap.subjective || soap.S;
    const p = soap.plan || soap.P;
    const text = (a || s || p || "").toString().trim();
    return text.length > 110 ? text.slice(0, 107) + "…" : text;
  };

  const fetch = useCallback(async () => {
    if (!hospitalUnitId || (!patientId && !patientName)) {
      setEvolution(null);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("clinical_evolutions")
      .select("id, status, soap_data, created_at, created_by_name, validated_at, patient_id, patient_name")
      .eq("hospital_unit_id", hospitalUnitId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (patientId) q = q.eq("patient_id", patientId);
    else if (patientName) q = q.eq("patient_name", patientName.trim());

    const { data, error } = await q;
    if (!error && data && data.length > 0) {
      const row: any = data[0];
      setEvolution({
        id: row.id,
        status: row.status || "draft",
        createdAt: row.created_at,
        createdByName: row.created_by_name,
        validatedAt: row.validated_at,
        preview: buildPreview(row.soap_data),
      });
      lastSeenIdRef.current = row.id;
    } else {
      setEvolution(null);
    }
    setLoading(false);
  }, [patientId, patientName, hospitalUnitId]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!hospitalUnitId || (!patientId && !patientName)) return;
    const key = patientId || `${hospitalUnitId}-${patientName}`;
    const channel = supabase
      .channel(`patient-evolution-${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clinical_evolutions", filter: `hospital_unit_id=eq.${hospitalUnitId}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          const matches =
            (patientId && row.patient_id === patientId) ||
            (patientName && row.patient_name?.trim() === patientName.trim());
          if (!matches) return;

          // Toast on new evolution by someone else
          if (
            payload.eventType === "INSERT" &&
            row.id !== lastSeenIdRef.current
          ) {
            toast.info("Nova evolução clínica registrada", {
              description: row.created_by_name
                ? `Por ${row.created_by_name}`
                : "Atualize para visualizar",
              duration: 5000,
            });
          }
          fetch();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, patientName, hospitalUnitId, fetch]);

  return { evolution, loading, refresh: fetch };
}
