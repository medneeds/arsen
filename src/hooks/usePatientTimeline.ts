import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TimelineEventType =
  | "pre_admission"
  | "encounter"
  | "admission_history"
  | "evolution"
  | "prescription"
  | "exam_request"
  | "culture_result"
  | "movement"
  | "conduct_change"
  | "bed_status"
  | "dispensation"
  | "dhd"
  | "vital_signs"
  | "round"
  | "discharge_document"
  | "documento_medico"
  | "receituario";

export interface TimelineEvent {
  event_id: string;
  event_type: TimelineEventType;
  event_label: string;
  event_at: string;
  patient_registry_id: string | null;
  patient_id: string | null;
  patient_name: string | null;
  author_id: string | null;
  author_email: string | null;
  hospital_unit_id: string | null;
  state_id: string | null;
  department: string | null;
  summary: string | null;
  payload: Record<string, any>;
}

export interface UsePatientTimelineOptions {
  patientRegistryId?: string | null;
  patientId?: string | null;
  eventTypes?: TimelineEventType[];
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  enabled?: boolean;
}

/**
 * Tabelas-fonte da timeline no schema novo. Subscritas via realtime para
 * invalidar o cache. MIGRAÇÃO: repontadas das tabelas antigas para as novas
 * (todas chaveadas por internacao_id).
 */
const TIMELINE_SOURCE_TABLES = [
  "internacoes",
  "evolucoes",
  "prescricoes",
  "solicitacoes_exame",
  "resultados_cultura",
  "transferencias",
  "altas",
] as const;

export function usePatientTimeline(opts: UsePatientTimelineOptions) {
  const {
    patientRegistryId,
    patientId,
    eventTypes,
    fromDate,
    toDate,
    search,
    limit = 500,
    enabled = true,
  } = opts;

  const queryClient = useQueryClient();

  const queryKey = [
    "patient-timeline",
    patientRegistryId,
    patientId,
    eventTypes,
    fromDate,
    toDate,
    search,
    limit,
  ];

  // Realtime: invalida a query quando qualquer tabela-fonte muda para o paciente
  useEffect(() => {
    if (!enabled || (!patientRegistryId && !patientId)) return;

    const channel = supabase.channel(`timeline-${patientRegistryId ?? patientId}`);

    TIMELINE_SOURCE_TABLES.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => {
          queryClient.invalidateQueries({ queryKey: ["patient-timeline"] });
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, patientRegistryId, patientId, queryClient]);

  return useQuery({
    queryKey,
    enabled: enabled && (!!patientRegistryId || !!patientId),
    queryFn: async (): Promise<TimelineEvent[]> => {
      // MIGRAÇÃO: a RPC get_patient_timeline e a view patient_timeline não
      // existem no schema novo. DEGRADADO: a timeline é montada no cliente a
      // partir das tabelas-fonte (todas chaveadas por internacao_id).
      //
      // `patientId` é internacoes.id; `patientRegistryId` é pacientes.id
      // (identidade permanente). Resolvemos a lista de internações-alvo:
      // - com patientId → [patientId]
      // - só com patientRegistryId → todas as internações desse paciente
      let internacaoIds: string[] = [];
      if (patientId) {
        internacaoIds = [patientId];
      } else if (patientRegistryId) {
        const { data: internacoes } = await supabase
          .from("internacoes")
          .select("id")
          .eq("paciente_id", patientRegistryId);
        internacaoIds = (internacoes ?? []).map((r: any) => r.id);
      }
      if (internacaoIds.length === 0) return [];

      const events: TimelineEvent[] = [];
      const base = {
        // DEGRADADO: colunas de identidade/escopo sem equivalente nas tabelas novas.
        patient_registry_id: patientRegistryId ?? null,
        patient_name: null as string | null,
        author_id: null as string | null,
        author_email: null as string | null,
        hospital_unit_id: null as string | null,
        state_id: null as string | null,
        department: null as string | null,
      };
      const push = (
        type: TimelineEventType,
        row: any,
        eventAt: string | null | undefined,
        internacaoId: string,
        summary: string | null,
      ) => {
        if (!eventAt) return;
        events.push({
          event_id: `${type}-${row.id}`,
          event_type: type,
          event_label: EVENT_TYPE_LABELS[type],
          event_at: eventAt,
          patient_id: internacaoId,
          summary,
          payload: row,
          ...base,
        });
      };

      const [internRes, evolRes, prescRes, examRes, cultRes, transfRes, altasRes] =
        await Promise.all([
          supabase.from("internacoes").select("*").in("id", internacaoIds),
          supabase.from("evolucoes").select("*").in("internacao_id", internacaoIds),
          supabase.from("prescricoes").select("*").in("internacao_id", internacaoIds),
          supabase.from("solicitacoes_exame").select("*").in("internacao_id", internacaoIds),
          supabase.from("resultados_cultura").select("*").in("internacao_id", internacaoIds),
          supabase.from("transferencias").select("*").in("internacao_id", internacaoIds),
          supabase.from("altas").select("*").in("internacao_id", internacaoIds),
        ]);

      (internRes.data || []).forEach((r: any) =>
        push("encounter", r, r.data_entrada, r.id, r.queixa_principal ?? null),
      );
      (evolRes.data || []).forEach((r: any) =>
        push("evolution", r, r.data_hora ?? r.criado_em, r.internacao_id, null),
      );
      (prescRes.data || []).forEach((r: any) =>
        push("prescription", r, r.criado_em, r.internacao_id, r.observacoes ?? null),
      );
      (examRes.data || []).forEach((r: any) =>
        push("exam_request", r, r.criado_em, r.internacao_id, r.categoria ?? null),
      );
      (cultRes.data || []).forEach((r: any) =>
        push("culture_result", r, r.criado_em ?? r.data_coleta, r.internacao_id, r.tipo_cultura ?? null),
      );
      (transfRes.data || []).forEach((r: any) =>
        push("movement", r, r.data_hora ?? r.criado_em, r.internacao_id, r.motivo ?? null),
      );
      (altasRes.data || []).forEach((r: any) =>
        push("discharge_document", r, r.data_hora ?? r.criado_em, r.internacao_id, r.tipo ?? null),
      );

      // Filtros client-side (antes feitos pela RPC).
      let result = events;
      if (eventTypes && eventTypes.length > 0) {
        const set = new Set(eventTypes);
        result = result.filter((e) => set.has(e.event_type));
      }
      if (fromDate) result = result.filter((e) => e.event_at >= fromDate);
      if (toDate) result = result.filter((e) => e.event_at <= toDate);
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        result = result.filter(
          (e) =>
            (e.summary?.toLowerCase().includes(q) ?? false) ||
            e.event_label.toLowerCase().includes(q),
        );
      }
      result.sort((a, b) => (a.event_at < b.event_at ? 1 : -1));
      return result.slice(0, limit);
    },
  });
}

export const EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  pre_admission: "Pré-admissão",
  encounter: "Atendimento",
  admission_history: "História de admissão",
  evolution: "Evolução",
  prescription: "Prescrição",
  exam_request: "Exame",
  culture_result: "Cultura",
  movement: "Movimentação",
  conduct_change: "Conduta",
  bed_status: "Leito",
  dispensation: "Dispensação",
  dhd: "DHD",
  vital_signs: "Sinais vitais",
  round: "Round multiprofissional",
  discharge_document: "Alta / Óbito",
  documento_medico: "Documento médico",
  receituario: "Receituário",
};

export const EVENT_TYPE_COLORS: Record<TimelineEventType, string> = {
  pre_admission: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  encounter: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  admission_history: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  evolution: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  prescription: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  exam_request: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  culture_result: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  movement: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  conduct_change: "bg-teal-500/10 text-teal-600 border-teal-500/30",
  bed_status: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  dispensation: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  dhd: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  vital_signs: "bg-red-500/10 text-red-600 border-red-500/30",
  round: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30",
  discharge_document: "bg-zinc-700/10 text-zinc-700 border-zinc-700/30",
  documento_medico: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  receituario: "bg-lime-500/10 text-lime-700 border-lime-500/30",
};
