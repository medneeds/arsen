import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { asUuidOrNull } from "@/lib/utils";
import { useResolvedRegistryId } from "@/hooks/useResolvedRegistryId";

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
  | "round"
  | "receituario"
  | "documento_medico";

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
  source: "exam_requests" | "culture_results" | "clinical_evolutions" | "hemocomponent_requests" | "sat_requests" | "aih_requests" | "receituarios" | "documentos_medicos";
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
  // MIGRAÇÃO: registryId = paciente_id (identidade permanente) resolvido da
  // internação — usado para receituarios que seguem o paciente entre internações.
  const { registryId: resolvedRegistryId } = useResolvedRegistryId(validId);

  const fetchAll = useCallback(async () => {
    // MIGRAÇÃO: as tabelas novas são chaveadas por internacao_id (= validId).
    // Sem internação não há como filtrar (colunas patient_name/hospital_unit_id/
    // state_id/archived_at/encounter_id não existem no schema novo).
    if (!validId) {
      setDocs([]);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // ── solicitacoes_exame (lab / imagem / parecer / apac) ──
      // MIGRAÇÃO: exam_requests → solicitacoes_exame (category→categoria,
      // items→itens, created_at→criado_em). Filtro por internacao_id.
      const examQuery = supabase
        .from("solicitacoes_exame")
        .select("*")
        .eq("internacao_id", validId)
        .order("criado_em", { ascending: false })
        .limit(200);

      // ── resultados_cultura ──
      // MIGRAÇÃO: culture_results → resultados_cultura (culture_type→tipo_cultura,
      // created_at→criado_em). Filtro por internacao_id.
      const cultureQuery = supabase
        .from("resultados_cultura")
        .select("*")
        .eq("internacao_id", validId)
        .order("criado_em", { ascending: false })
        .limit(100);

      // ── evolucoes ──
      // MIGRAÇÃO: clinical_evolutions → evolucoes. Filtro por internacao_id
      // (registry/encounter/setor/arquivado descontinuados — sem coluna).
      const evolQuery = supabase
        .from("evolucoes")
        .select("id, status, criado_em, data_hora")
        .eq("internacao_id", validId)
        .order("criado_em", { ascending: false })
        .limit(50);

      // ── receituarios (alta / ambulatorial / simples / controle especial) ──
      // MIGRAÇÃO: type→tipo, items→itens, signed_by_name→assinado_por_nome,
      // created_at→criado_em. Vínculo por paciente_id quando resolvido (segue o
      // paciente entre internações), senão pela própria internação.
      let receituarioQuery = supabase
        .from("receituarios")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(100);
      if (resolvedRegistryId) {
        receituarioQuery = receituarioQuery.eq("paciente_id", resolvedRegistryId);
      } else {
        receituarioQuery = receituarioQuery.eq("internacao_id", validId);
      }

      // ── documentos médicos (atestado / relatório / termo) ──
      // MIGRAÇÃO: documentos_medicos → altas (type→tipo). Filtra os três tipos
      // deste fluxo; altas também guarda desfechos (alta/óbito).
      const docMedicoQuery = supabase
        .from("altas")
        .select("*")
        .eq("internacao_id", validId)
        .in("tipo", ["atestado", "relatorio", "termo"])
        .order("criado_em", { ascending: false })
        .limit(100);

      const [examRes, cultureRes, evolRes, receituarioRes, docMedicoRes] = await Promise.all([examQuery, cultureQuery, evolQuery, receituarioQuery, docMedicoQuery]);

      const list: PatientDocument[] = [];

      // solicitacoes_exame → split entre comum (lab/imagem/parecer) e APAC (heurística)
      // MIGRAÇÃO: source mantido "exam_requests" (shape exportado estável).
      // DEGRADADO: authorName/patientSector/patientBed sem coluna → null/undefined.
      (examRes.data || []).forEach((r: any) => {
        const isApac = r.categoria === "apac" || isApacItem(r.itens);
        const type: DocumentType = isApac
          ? "apac"
          : r.categoria === "imagem"
          ? "imagem"
          : r.categoria === "parecer"
          ? "parecer"
          : "lab";
        const firstItem = Array.isArray(r.itens) && r.itens[0]?.name ? r.itens[0].name : "Requisição";
        const extra = Array.isArray(r.itens) && r.itens.length > 1 ? ` (+${r.itens.length - 1})` : "";
        list.push({
          id: r.id,
          type,
          label: `${firstItem}${extra}`,
          status: normalizeStatus(r.status),
          rawStatus: r.status,
          createdAt: r.criado_em,
          authorName: null, // MIGRAÇÃO: sem coluna requested_by_name
          patientSector: null, // MIGRAÇÃO: sem coluna
          patientBed: null, // MIGRAÇÃO: sem coluna
          source: "exam_requests",
          raw: r,
        });
      });

      // resultados_cultura → "cultura" (MIGRAÇÃO: source mantido "culture_results")
      (cultureRes.data || []).forEach((r: any) => {
        list.push({
          id: r.id,
          type: "cultura",
          label: r.tipo_cultura || "Cultura",
          status: normalizeStatus(r.status),
          rawStatus: r.status,
          createdAt: r.criado_em,
          authorName: null, // MIGRAÇÃO: sem coluna uploaded_by_name
          patientSector: null, // MIGRAÇÃO: sem coluna
          patientBed: null, // MIGRAÇÃO: sem coluna
          source: "culture_results",
          raw: r,
        });
      });

      // evolucoes → "evolucao" (MIGRAÇÃO: source mantido "clinical_evolutions")
      (evolRes.data || []).forEach((r: any) => {
        list.push({
          id: r.id,
          type: "evolucao",
          label: "Evolução clínica",
          status: normalizeStatus(r.status),
          rawStatus: r.status,
          createdAt: r.criado_em,
          authorName: null, // MIGRAÇÃO: sem coluna created_by_name
          patientSector: null, // MIGRAÇÃO: sem coluna
          patientBed: null, // MIGRAÇÃO: sem coluna
          source: "clinical_evolutions",
          raw: r,
        });
      });

      // receituarios → "receituario" (alta / ambulatorial / simples / controle especial)
      const RECEITUARIO_LABEL: Record<string, string> = {
        alta: "Receituário de Alta",
        ambulatorial: "Receituário Ambulatorial",
        simples: "Receituário Simples",
        controle_especial: "Receituário de Controle Especial",
      };
      (receituarioRes.data || []).forEach((r: any) => {
        const itemCount = Array.isArray(r.itens) ? r.itens.length : 0;
        const itemsSuffix = itemCount > 0 ? ` (${itemCount} ${itemCount === 1 ? "item" : "itens"})` : "";
        list.push({
          id: r.id,
          type: "receituario",
          label: `${RECEITUARIO_LABEL[r.tipo] || "Receituário"}${itemsSuffix}`,
          // receituário não tem workflow de status (pendente/concluído) — é
          // um documento emitido, por definição já "pronto".
          status: "concluido",
          rawStatus: r.tipo,
          createdAt: r.criado_em,
          authorName: r.assinado_por_nome, // MIGRAÇÃO: signed_by_name→assinado_por_nome
          patientSector: null, // MIGRAÇÃO: sem coluna
          patientBed: null, // MIGRAÇÃO: sem coluna
          source: "receituarios",
          raw: r,
        });
      });

      // altas (atestado / relatório / termo) → "documento_medico"
      // MIGRAÇÃO: documentos_medicos → altas; source mantido "documentos_medicos"
      // (shape exportado estável). body/patient_*/nome do assinante ficam no conteudo.
      const DOC_MEDICO_LABEL: Record<string, string> = {
        atestado: "Atestado Médico",
        relatorio: "Relatório Médico",
        termo: "Termo / Declaração",
      };
      (docMedicoRes.data || []).forEach((r: any) => {
        const c = (r.conteudo ?? {}) as Record<string, any>;
        list.push({
          id: r.id,
          type: "documento_medico",
          label: DOC_MEDICO_LABEL[r.tipo] || "Documento Médico",
          // mesmo racional do receituário: documento emitido, sem workflow
          // de status.
          status: "concluido",
          rawStatus: r.tipo,
          createdAt: r.criado_em ?? r.data_hora,
          authorName: c.signed_by_name ?? null,
          patientSector: c.patient_sector ?? null,
          patientBed: c.patient_bed ?? null,
          source: "documentos_medicos",
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
  }, [validId, resolvedRegistryId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscriptions (opcional)
  // MIGRAÇÃO: tabelas repontadas para o schema novo (solicitacoes_exame,
  // resultados_cultura, evolucoes, receituarios, altas).
  useEffect(() => {
    if (!realtime || !validId) return;
    const channel = supabase
      .channel(`patient-docs-${validId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes_exame" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "resultados_cultura" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "evolucoes" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "receituarios" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "altas" }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtime, validId, fetchAll]);

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
  receituario: { label: "Receituários", shortLabel: "Receituário", tone: "text-lime-600 dark:text-lime-400", bg: "bg-lime-500/10", ring: "ring-lime-500/30" },
  documento_medico: { label: "Atestados, Relatórios e Termos", shortLabel: "Documento", tone: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", ring: "ring-sky-500/30" },
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
