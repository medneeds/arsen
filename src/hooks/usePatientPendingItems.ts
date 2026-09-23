import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fromSolicitacaoStatusDb } from "@/lib/solicitacaoStatus";

export interface PatientPendingItem {
  id: string;
  kind: "exam" | "culture";
  category: string; // laboratorio, imagem, hemocultura, urocultura...
  status: string; // pending, completed, etc.
  label: string;
  createdAt: string;
  critical?: boolean;
}

/**
 * Subscribes (realtime) to solicitacoes_exame and resultados_cultura for a single
 * patient. Used in the clinical Cockpit's "Exames" tab to surface pending/completed
 * counts without forcing the user to leave the current page.
 *
 * MIGRAÇÃO (Wave3): exam_requests → solicitacoes_exame; culture_results →
 * resultados_cultura. Ambas penduram em `internacao_id` (o patientId das telas é
 * a internação). DEGRADADOS (sem coluna no schema novo):
 *  - matching por patient_name + hospital_unit_id (só internacao_id agora);
 *  - filtro por encounter ativo (a internação JÁ é o encounter → useActiveEncounterId removido);
 *  - `archived_at` (blindagem por leito reusado) inexistente → filtro removido.
 * Parâmetros `patientName`/`hospitalUnitId` mantidos na assinatura por
 * compatibilidade, mas não são mais usados.
 * Colunas: category→categoria, items→itens, culture_type→tipo_cultura,
 * microorganism→microorganismo, created_at→criado_em.
 */
export function usePatientPendingItems(
  patientId: string | null,
  patientName: string | null,
  hospitalUnitId: string | null,
) {
  const [items, setItems] = useState<PatientPendingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientId) {
      setItems([]);
      return;
    }
    setLoading(true);

    // Exams
    const examQuery = supabase
      .from("solicitacoes_exame")
      .select("id, categoria, status, itens, criado_em")
      .eq("internacao_id", patientId)
      .order("criado_em", { ascending: false })
      .limit(20);

    // Cultures
    const culQuery = supabase
      .from("resultados_cultura")
      .select("id, tipo_cultura, status, microorganismo, criado_em")
      .eq("internacao_id", patientId)
      .order("criado_em", { ascending: false })
      .limit(20);

    const [examRes, culRes] = await Promise.all([examQuery, culQuery]);

    const merged: PatientPendingItem[] = [];
    if (!examRes.error && examRes.data) {
      examRes.data.forEach((row: any) => {
        const itemsArr = Array.isArray(row.itens) ? row.itens : [];
        const firstName = itemsArr[0]?.name || itemsArr[0]?.exam || "Exame";
        merged.push({
          id: row.id,
          kind: "exam",
          category: row.categoria || "laboratorio",
          // DB (pendente/em_andamento/concluido/cancelado) → VM (pending/…)
          status: fromSolicitacaoStatusDb(row.status),
          label: itemsArr.length > 1 ? `${firstName} +${itemsArr.length - 1}` : firstName,
          createdAt: row.criado_em,
        });
      });
    }
    if (!culRes.error && culRes.data) {
      culRes.data.forEach((row: any) => {
        merged.push({
          id: row.id,
          kind: "culture",
          category: row.tipo_cultura || "cultura",
          // resultados_cultura.status ∈ pendente|liberado|contaminado → VM pending/completed
          status: row.status === "pendente" || !row.status ? "pending" : "completed",
          label: row.microorganismo || row.tipo_cultura || "Cultura",
          createdAt: row.criado_em,
          critical: Boolean(row.microorganismo),
        });
      });
    }
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setItems(merged);
    setLoading(false);
  }, [patientId]);

  const fetchRef = useRef(fetch);
  useEffect(() => { fetchRef.current = fetch; }, [fetch]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!patientId) return;
    // MIGRAÇÃO: realtime filtrado por internacao_id nas tabelas novas.
    const channel = supabase
      .channel(`patient-pending-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes_exame", filter: `internacao_id=eq.${patientId}` },
        () => fetchRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resultados_cultura", filter: `internacao_id=eq.${patientId}` },
        () => fetchRef.current(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  const summary = {
    pendingExams: items.filter((i) => i.kind === "exam" && i.status === "pending").length,
    completedExams: items.filter((i) => i.kind === "exam" && i.status === "completed").length,
    pendingCultures: items.filter((i) => i.kind === "culture" && i.status === "pending").length,
    positiveCultures: items.filter((i) => i.kind === "culture" && i.critical).length,
  };

  return { items, summary, loading, refresh: fetch };
}
