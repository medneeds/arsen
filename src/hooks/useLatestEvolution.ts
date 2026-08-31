import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActiveEncounterId } from "@/hooks/useActiveEncounterId";
import { useResolvedRegistryId } from "@/hooks/useResolvedRegistryId";

export interface LatestEvolutionDevice {
  id: string;
  label: string;
  insertedAt: string;
  custom?: boolean;
}

export interface LatestEvolutionSummary {
  id: string;
  status: string;
  createdAt: string;
  createdByName: string | null;
  validatedAt: string | null;
  /** SOAP "A" (avaliação) ou primeiro trecho útil para preview */
  preview: string;
  /** SOAP completo (S/O/A/P), formatado em texto — usado para pré-preencher
   *  o "Resumo da evolução" no Sumário de Alta, por exemplo. Só inclui as
   *  seções que o médico de fato preencheu. */
  fullText: string;
  /** Dispositivos invasivos registrados na última evolução (JSONB extra). */
  devices: LatestEvolutionDevice[];
  /** HTML rico com resultados de culturas registrados na última evolução. */
  culturesHtml: string;
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

  // Fase B.1 — isola pelo atendimento ativo
  const { encounterId: activeEncounterId } = useActiveEncounterId(patientId);

  // 🔒 Documentação segue o paciente: priorizamos patient_registry_id quando resolvido.
  const { registryId: resolvedRegistryId } = useResolvedRegistryId(patientId);

  /**
   * O SOAP é digitado num editor rico — os campos vêm como HTML
   * (<p>, <br>, &nbsp; etc.), não texto puro. Jogar isso direto num
   * <textarea> mostra as tags cruas ("...VOMITO.<BR></SPAN>...") em vez de
   * texto legível. Preserva quebras de linha (tags de bloco/<br> viram \n)
   * antes de descartar as tags e decodificar entidades — diferente de um
   * strip ingênuo que jogaria tudo numa linha só.
   */
  const htmlToPlainText = (html: string): string => {
    if (!html) return "";
    const withBreaks = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    // Decodifica entidades (&nbsp;, &amp;, etc.) via DOM — seguro no
    // navegador, já que este hook só roda client-side.
    const el = document.createElement("textarea");
    el.innerHTML = withBreaks;
    const decoded = el.value;
    return decoded
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const buildPreview = (soap: any): string => {
    if (!soap) return "";
    const a = soap.assessment || soap.A || soap.avaliacao;
    const s = soap.subjective || soap.S;
    const p = soap.plan || soap.P;
    const text = htmlToPlainText((a || s || p || "").toString()).replace(/\n+/g, " ");
    return text.length > 110 ? text.slice(0, 107) + "…" : text;
  };

  const buildFullText = (soap: any): string => {
    if (!soap) return "";
    const sections: [string, unknown][] = [
      ["SUBJETIVO", soap.subjective || soap.S],
      ["OBJETIVO", soap.objective || soap.O],
      ["AVALIAÇÃO", soap.assessment || soap.A || soap.avaliacao],
      ["PLANO", soap.plan || soap.P],
    ];
    return sections
      .filter(([, v]) => typeof v === "string" && v.trim())
      .map(([label, v]) => `${label}: ${htmlToPlainText(v as string)}`)
      .join("\n\n");
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
      // ⚠️ ignora evoluções arquivadas (ocupante anterior do leito, reverts).
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (patientId) {
      if (resolvedRegistryId) {
        q = q.or(
          `patient_registry_id.eq.${resolvedRegistryId},and(patient_registry_id.is.null,patient_id.eq.${patientId})`,
        );
      } else {
        q = q.eq("patient_id", patientId);
      }
      if (activeEncounterId) {
        q = q.or(`encounter_id.eq.${activeEncounterId},encounter_id.is.null`);
      }
    } else if (patientName) q = q.eq("patient_name", patientName.trim());

    const { data, error } = await q;
    if (!error && data && data.length > 0) {
      const row: any = data[0];
      const soap: any = row.soap_data || {};
      setEvolution({
        id: row.id,
        status: row.status || "draft",
        createdAt: row.created_at,
        createdByName: row.created_by_name,
        validatedAt: row.validated_at,
        preview: buildPreview(row.soap_data),
        fullText: buildFullText(row.soap_data),
        devices: Array.isArray(soap.devices) ? soap.devices : [],
        culturesHtml: typeof soap.culturesHtml === "string" ? soap.culturesHtml : "",
      });
      lastSeenIdRef.current = row.id;
    } else {
      setEvolution(null);
    }
    setLoading(false);
  }, [patientId, patientName, hospitalUnitId, activeEncounterId, resolvedRegistryId]);

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
