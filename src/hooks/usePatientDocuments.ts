import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { asUuidOrNull } from "@/lib/utils";

/**
 * Tipo unificado para qualquer documento clínico vinculado a um paciente.
 * Usado pela aba Docs do Painel Clínico (timeline + acordeões por tipo)
 * e por /documentos (visão completa).
 *
 * Fontes:
 *  - exam_requests (categoria laboratorio/imagem/parecer/apac → especiais detectados)
 *  - culture_results (Cultura)
 *  - clinical_evolutions (Evolução)
 *  - hemocomponent_requests (Hemo) ← TODO: criar tabela na Fase 1
 *  - sat_requests (SAT) ← TODO: criar tabela na Fase 1
 *  - aih_requests (AIH dedicada) ← TODO: criar tabela na Fase 1
 */
export type DocumentType =
  | "hemoderivado"
  | "apac"
  | "sat"
  | "aih"
  | "cultura"
  | "lab"
  | "imagem"
  | "parecer"
  | "evolucao"
  | "round";

export interface PatientDocument {
  id: string;
  type: DocumentType;
  /** Rótulo curto p/ exibir (ex: "Hemocultura", "TC Crânio s/ contraste") */
  label: string;
  /** Status normalizado entre fontes (mantém compatibilidade c/ exam_requests) */
  status: "pendente" | "em_analise" | "autorizado" | "concluido" | "cancelado";
  /** Status original retornado da fonte (p/ debug / badge customizada) */
  rawStatus: string;
  createdAt: string;
  /** Autor / solicitante (quando disponível) */
  authorName?: string | null;
  /** Setor do paciente quando o doc foi criado */
  patientSector?: string | null;
  patientBed?: string | null;
  /** Tabela de origem — útil p/ navegação e ações (reimprimir, ver detalhe). */
  source: "exam_requests" | "culture_results" | "clinical_evolutions" | "hemocomponent_requests" | "sat_requests" | "aih_requests";
  /** Payload bruto p/ ações específicas (reimprimir, abrir dialog, etc). */
  raw: any;
}

const STATUS_MAP: Record<string, PatientDocument["status"]> = {
  pending: "pendente",
  acknowledged: "em_analise",
  in_progress: "em_analise",
  completed: "concluido",
  cancelled: "cancelado",
  draft: "pendente",
  validated: "concluido",
  autorizado: "autorizado",
  pendente: "pendente",
  em_analise: "em_analise",
  concluido: "concluido",
  cancelado: "cancelado",
};

function normalizeStatus(raw: string | null | undefined): PatientDocument["status"] {
  if (!raw) return "pendente";
  return STATUS_MAP[raw] ?? "pendente";
}

/** Detecta se uma exam_request comum é especial (APAC) por palavras-chave do item. */
const APAC_KEYWORDS = [
  "tc ", "tomografia", "ressonância", "ressonancia", "rm ",
  "ecocardiograma", "doppler", "angio-tc", "angio tc", "angio-rm",
];

function isApacItem(items: any[]): boolean {
  if (!Array.isArray(items)) return false;
  return items.some((it) => {
    const name = String(it?.name || "").toLowerCase();
    return APAC_KEYWORDS.some((kw) => name.includes(kw));
  });
}

interface UsePatientDocumentsOpts {
  patientId?: string | null;
  patientName?: string | null;
  hospitalUnitId?: string | null;
  stateId?: string | null;
  /** Quando true, faz subscribe realtime nas fontes. Default false. */
  realtime?: boolean;
}

export function usePatientDocuments({
  patientId,
  patientName,
  hospitalUnitId,
  stateId,
  realtime = false,
}: UsePatientDocumentsOpts) {
  const [docs, setDocs] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validId = asUuidOrNull(patientId);

  const fetchAll = useCallback(async () => {
    if (!hospitalUnitId || !stateId) return;
    if (!validId && !patientName) {
      setDocs([]);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // ── exam_requests (lab / imagem / parecer / apac) ──
      let examQuery = supabase
        .from("exam_requests")
        .select("*")
        .eq("hospital_unit_id", hospitalUnitId)
        .eq("state_id", stateId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (validId) examQuery = examQuery.eq("patient_id", validId);
      else if (patientName) examQuery = examQuery.eq("patient_name", patientName);

      // ── culture_results ──
      let cultureQuery = supabase
        .from("culture_results")
        .select("*")
        .eq("hospital_unit_id", hospitalUnitId)
        .eq("state_id", stateId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (validId) cultureQuery = cultureQuery.eq("patient_id", validId);
      else if (patientName) cultureQuery = cultureQuery.eq("patient_name", patientName);

      // ── clinical_evolutions ──
      let evolQuery = supabase
        .from("clinical_evolutions")
        .select("id, patient_name, patient_sector, patient_bed, status, created_at, created_by_name")
        .eq("hospital_unit_id", hospitalUnitId)
        .eq("state_id", stateId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (validId) evolQuery = evolQuery.eq("patient_id", validId);
      else if (patientName) evolQuery = evolQuery.eq("patient_name", patientName);

      const [examRes, cultureRes, evolRes] = await Promise.all([examQuery, cultureQuery, evolQuery]);

      const list: PatientDocument[] = [];

      // exam_requests → split entre comum (lab/imagem/parecer) e APAC (heurística)
      (examRes.data || []).forEach((r: any) => {
        const isApac = r.category === "apac" || isApacItem(r.items);
        const type: DocumentType = isApac
          ? "apac"
          : r.category === "imagem"
          ? "imagem"
          : r.category === "parecer"
          ? "parecer"
          : "lab";
        const firstItem = Array.isArray(r.items) && r.items[0]?.name ? r.items[0].name : "Requisição";
        const extra = Array.isArray(r.items) && r.items.length > 1 ? ` (+${r.items.length - 1})` : "";
        list.push({
          id: r.id,
          type,
          label: `${firstItem}${extra}`,
          status: normalizeStatus(r.status),
          rawStatus: r.status,
          createdAt: r.created_at,
          authorName: r.requested_by_name,
          patientSector: r.patient_sector,
          patientBed: r.patient_bed,
          source: "exam_requests",
          raw: r,
        });
      });

      // culture_results → "cultura"
      (cultureRes.data || []).forEach((r: any) => {
        list.push({
          id: r.id,
          type: "cultura",
          label: r.culture_type || "Cultura",
          status: normalizeStatus(r.status),
          rawStatus: r.status,
          createdAt: r.created_at,
          authorName: r.uploaded_by_name,
          patientSector: r.patient_sector,
          patientBed: r.patient_bed,
          source: "culture_results",
          raw: r,
        });
      });

      // clinical_evolutions → "evolucao"
      (evolRes.data || []).forEach((r: any) => {
        list.push({
          id: r.id,
          type: "evolucao",
          label: "Evolução clínica",
          status: normalizeStatus(r.status),
          rawStatus: r.status,
          createdAt: r.created_at,
          authorName: r.created_by_name,
          patientSector: r.patient_sector,
          patientBed: r.patient_bed,
          source: "clinical_evolutions",
          raw: r,
        });
      });

      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setDocs(list);
    } catch (e: any) {
      console.error("[usePatientDocuments] fetch error", e);
      setError(e?.message || "Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  }, [validId, patientName, hospitalUnitId, stateId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscriptions (opcional)
  useEffect(() => {
    if (!realtime || !hospitalUnitId || !stateId) return;
    const channel = supabase
      .channel(`patient-docs-${validId || patientName || "anon"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_requests" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "culture_results" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "clinical_evolutions" }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtime, validId, patientName, hospitalUnitId, stateId, fetchAll]);

  // Agregações úteis
  const byType = useMemo(() => {
    const map: Partial<Record<DocumentType, PatientDocument[]>> = {};
    docs.forEach((d) => {
      if (!map[d.type]) map[d.type] = [];
      map[d.type]!.push(d);
    });
    return map;
  }, [docs]);

  const counts = useMemo(() => {
    const c: Partial<Record<DocumentType, number>> = {};
    docs.forEach((d) => {
      c[d.type] = (c[d.type] || 0) + 1;
    });
    return c;
  }, [docs]);

  return {
    docs,
    loading,
    error,
    byType,
    counts,
    refetch: fetchAll,
  };
}

/** Labels e cores reutilizáveis pela UI. */
export const DOCUMENT_TYPE_META: Record<
  DocumentType,
  { label: string; shortLabel: string; tone: string; bg: string; ring: string }
> = {
  hemoderivado: { label: "Hemoderivados", shortLabel: "Hemo", tone: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", ring: "ring-rose-500/30" },
  apac: { label: "APAC — Alta Complexidade", shortLabel: "APAC", tone: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10", ring: "ring-orange-500/30" },
  sat: { label: "SAT — Antitetânico", shortLabel: "SAT", tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
  aih: { label: "AIH — Internação", shortLabel: "AIH", tone: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10", ring: "ring-indigo-500/30" },
  cultura: { label: "Culturas", shortLabel: "Cultura", tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  lab: { label: "Laboratório", shortLabel: "Lab", tone: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", ring: "ring-blue-500/30" },
  imagem: { label: "Imagem", shortLabel: "Imagem", tone: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10", ring: "ring-violet-500/30" },
  parecer: { label: "Pareceres", shortLabel: "Parecer", tone: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10", ring: "ring-cyan-500/30" },
  evolucao: { label: "Evoluções", shortLabel: "Evolução", tone: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/10", ring: "ring-slate-500/30" },
  round: { label: "Round multiprofissional", shortLabel: "Round", tone: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10", ring: "ring-teal-500/30" },
};

export const STATUS_BADGE: Record<
  PatientDocument["status"],
  { label: string; cls: string; dot: string }
> = {
  pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
  em_analise: { label: "Em análise", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30", dot: "bg-blue-500" },
  autorizado: { label: "Autorizado", cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30", dot: "bg-indigo-500" },
  concluido: { label: "Concluído", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
};
