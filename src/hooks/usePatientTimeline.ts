import { useQuery } from "@tanstack/react-query";
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
  | "dhd";

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

  return useQuery({
    queryKey: [
      "patient-timeline",
      patientRegistryId,
      patientId,
      eventTypes,
      fromDate,
      toDate,
      search,
      limit,
    ],
    enabled: enabled && (!!patientRegistryId || !!patientId),
    queryFn: async (): Promise<TimelineEvent[]> => {
      const { data, error } = await supabase.rpc("get_patient_timeline", {
        p_patient_registry_id: patientRegistryId ?? undefined,
        p_patient_id: patientId ?? undefined,
        p_event_types: eventTypes && eventTypes.length > 0 ? eventTypes : undefined,
        p_from_date: fromDate ?? undefined,
        p_to_date: toDate ?? undefined,
        p_search: search && search.trim() ? search.trim() : undefined,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
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
};
