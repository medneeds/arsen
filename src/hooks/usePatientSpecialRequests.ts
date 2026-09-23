import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SpecialKind = "hemocomponente" | "sat" | "apac" | "cultura";

export interface SpecialRequestItem {
  id: string;
  kind: SpecialKind;
  label: string;
  status: string;
  createdAt: string;
  createdByName?: string | null;
  /** Optional secondary info (microorganismo, justificativa, etc.) */
  detail?: string | null;
}

export interface SpecialSummary {
  hemocomponente: number;
  sat: number;
  apac: number;
  cultura: number;
  pending: number;
  total: number;
}

/**
 * Subscribes (realtime) to special requests for a single patient:
 *  - solicitacoes_exame filtered by categoria in ('hemocomponente','sat','apac','cultura')
 *  - resultados_cultura (kind='cultura')
 *
 * Used by PatientCockpit and dedicated pages to keep counts in sync across
 * the Cockpit, /requisicoes (Especiais) and /documentos.
 *
 * MIGRAÇÃO (Wave3): exam_requests → solicitacoes_exame; culture_results →
 * resultados_cultura. Ambas penduram em `internacao_id` (o patientId é a
 * internação). DEGRADADOS (sem coluna no schema novo): matching por patient_name
 * e escopo por hospital_unit_id (só internacao_id agora). Parâmetros
 * `patientName`/`hospitalUnitId` mantidos na assinatura, sem uso.
 * Colunas: category→categoria, items→itens, clinical_indication→indicacao_clinica,
 * requested_by_name→join solicitado_por; culture_type→tipo_cultura,
 * microorganism→microorganismo, uploaded_by_name→join enviado_por, created_at→criado_em.
 */
export function usePatientSpecialRequests(
  patientId: string | null,
  patientName: string | null,
  hospitalUnitId: string | null,
) {
  const [items, setItems] = useState<SpecialRequestItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!patientId) {
      setItems([]);
      return;
    }
    setLoading(true);

    const examQ = supabase
      .from("solicitacoes_exame")
      .select("id, categoria, status, itens, criado_em, indicacao_clinica, solicitante:profissionais!solicitacoes_exame_solicitado_por_fkey(nome)")
      .eq("internacao_id", patientId)
      .in("categoria", ["hemocomponente", "sat", "apac", "cultura"])
      .order("criado_em", { ascending: false })
      .limit(20);

    const culQ = supabase
      .from("resultados_cultura")
      .select("id, tipo_cultura, status, microorganismo, criado_em, enviado:profissionais!resultados_cultura_enviado_por_fkey(nome)")
      .eq("internacao_id", patientId)
      .order("criado_em", { ascending: false })
      .limit(20);

    const [examRes, culRes] = await Promise.all([examQ, culQ]);

    const merged: SpecialRequestItem[] = [];
    if (!examRes.error && examRes.data) {
      (examRes.data as any[]).forEach((row: any) => {
        const itemsArr = Array.isArray(row.itens) ? row.itens : [];
        const first = itemsArr[0]?.name || itemsArr[0]?.exam || itemsArr[0]?.label || "";
        let label = first || row.categoria;
        if (row.categoria === "hemocomponente") label = first || "Hemocomponentes";
        if (row.categoria === "sat") label = "Profilaxia antitetânica";
        if (row.categoria === "apac") label = first || "APAC";
        if (row.categoria === "cultura") label = first || "Solicitação de cultura";
        merged.push({
          id: row.id,
          kind: row.categoria as SpecialKind,
          label,
          status: row.status || "pending",
          createdAt: row.criado_em,
          createdByName: row.solicitante?.nome || null,
          detail: row.indicacao_clinica || null,
        });
      });
    }
    if (!culRes.error && culRes.data) {
      (culRes.data as any[]).forEach((row: any) => {
        merged.push({
          id: row.id,
          kind: "cultura",
          label: row.tipo_cultura || "Cultura",
          status: row.status || "pending",
          createdAt: row.criado_em,
          createdByName: row.enviado?.nome || null,
          detail: row.microorganismo || null,
        });
      });
    }
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setItems(merged);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!patientId) return;
    // MIGRAÇÃO: realtime filtrado por internacao_id nas tabelas novas.
    const channel = supabase
      .channel(`patient-special-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes_exame", filter: `internacao_id=eq.${patientId}` },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (!row) return;
          if (!["hemocomponente", "sat", "apac", "cultura"].includes(row.categoria)) return;
          fetchAll();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resultados_cultura", filter: `internacao_id=eq.${patientId}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, fetchAll]);

  const summary: SpecialSummary = {
    hemocomponente: items.filter((i) => i.kind === "hemocomponente").length,
    sat: items.filter((i) => i.kind === "sat").length,
    apac: items.filter((i) => i.kind === "apac").length,
    cultura: items.filter((i) => i.kind === "cultura").length,
    pending: items.filter((i) => i.status === "pending").length,
    total: items.length,
  };

  return { items, summary, loading, refresh: fetchAll };
}
