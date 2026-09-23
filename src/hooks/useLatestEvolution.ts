import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// MIGRAÇÃO: clinical_evolutions → evolucoes (ancorada por internacao_id).
// patient_registry/patient_encounters mortos: removidos os filtros por
// registry/encounter/hospital/archived_at. `patientId` já é internacoes.id.
// Campos dedicados do modelo antigo (created_by_name, validated_at) vivem
// dentro do JSON `soap` (chaves `__`, convenção de useEvolutions).

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
  // patientName/hospitalUnitId mantidos na assinatura por compatibilidade dos
  // consumidores; sem uso após a migração (evolucoes ancora só por internacao_id).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  patientName: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hospitalUnitId: string | null,
) {
  const [evolution, setEvolution] = useState<LatestEvolutionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const lastSeenIdRef = useRef<string | null>(null);

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
    if (!patientId) {
      setEvolution(null);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("evolucoes")
      .select("id, status, soap, data_hora, criado_em")
      .eq("internacao_id", patientId)
      .order("data_hora", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const row: any = data[0];
      const soap: any = row.soap || {};
      setEvolution({
        id: row.id,
        status: row.status || "draft",
        createdAt: row.criado_em || row.data_hora,
        createdByName: soap.__created_by_name ?? null,
        validatedAt: soap.__validated_at ?? null,
        preview: buildPreview(soap),
        fullText: buildFullText(soap),
        devices: Array.isArray(soap.devices) ? soap.devices : [],
        culturesHtml: typeof soap.culturesHtml === "string" ? soap.culturesHtml : "",
      });
      lastSeenIdRef.current = row.id;
    } else {
      setEvolution(null);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!patientId) return;
    // MIGRAÇÃO: realtime em "evolucoes" (antes "clinical_evolutions"),
    // filtrado por internacao_id.
    const channel = supabase
      .channel(`patient-evolution-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evolucoes", filter: `internacao_id=eq.${patientId}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;

          // Toast on new evolution by someone else
          if (
            payload.eventType === "INSERT" &&
            row.id !== lastSeenIdRef.current
          ) {
            const createdByName = (row.soap as any)?.__created_by_name;
            toast.info("Nova evolução clínica registrada", {
              description: createdByName
                ? `Por ${createdByName}`
                : "Atualize para visualizar",
              duration: 5000,
            });
          }
          fetch();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, fetch]);

  return { evolution, loading, refresh: fetch };
}
