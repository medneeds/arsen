import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DischargePrediction {
  id: string;
  name: string;
  bed_number: string | null;
  sector: string | null;
  uti_discharge_prediction: string | null;
  predictedDate: Date | null;
  bucket: "today" | "tomorrow" | "48_72h" | "week" | "later" | "unparsed";
  daysAway: number | null;
}

// Try to extract a date from free-text prediction
const parsePrediction = (text: string | null): { date: Date | null; bucket: DischargePrediction["bucket"]; daysAway: number | null } => {
  if (!text) return { date: null, bucket: "unparsed", daysAway: null };
  const t = text.toLowerCase().trim();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Heuristic keywords first
  if (/\bhoje\b/.test(t)) return { date: now, bucket: "today", daysAway: 0 };
  if (/\bamanh[ãa]\b/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    return { date: d, bucket: "tomorrow", daysAway: 1 };
  }
  const matchDays = t.match(/(\d+)\s*dias?/);
  if (matchDays) {
    const n = parseInt(matchDays[1], 10);
    const d = new Date(now); d.setDate(d.getDate() + n);
    const bucket: DischargePrediction["bucket"] = n === 0 ? "today" : n === 1 ? "tomorrow" : n <= 3 ? "48_72h" : n <= 7 ? "week" : "later";
    return { date: d, bucket, daysAway: n };
  }

  // dd/mm or dd/mm/yyyy
  const m = t.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    const yyyyRaw = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
    const yyyy = yyyyRaw < 100 ? 2000 + yyyyRaw : yyyyRaw;
    const d = new Date(yyyy, mm, dd);
    if (!isNaN(d.getTime())) {
      const diff = Math.round((d.getTime() - now.getTime()) / 86_400_000);
      const bucket: DischargePrediction["bucket"] = diff <= 0 ? "today" : diff === 1 ? "tomorrow" : diff <= 3 ? "48_72h" : diff <= 7 ? "week" : "later";
      return { date: d, bucket, daysAway: diff };
    }
  }
  return { date: null, bucket: "unparsed", daysAway: null };
};

export function useDischargePredictions(hospitalUnitId: string | undefined) {
  return useQuery({
    queryKey: ["nir-discharge-predictions", hospitalUnitId],
    queryFn: async (): Promise<DischargePrediction[]> => {
      if (!hospitalUnitId) return [];
      const { data, error } = await supabase
        .from("patients")
        .select("id,name,bed_number,sector,uti_discharge_prediction")
        .eq("hospital_unit_id", hospitalUnitId)
        .not("uti_discharge_prediction", "is", null)
        .neq("uti_discharge_prediction", "");
      if (error) throw error;
      return (data || []).map((p: any) => {
        const { date, bucket, daysAway } = parsePrediction(p.uti_discharge_prediction);
        return { ...p, predictedDate: date, bucket, daysAway };
      });
    },
    enabled: !!hospitalUnitId,
    refetchInterval: 120_000,
  });
}
