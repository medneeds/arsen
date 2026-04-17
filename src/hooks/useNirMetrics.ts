import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Sectors classification heuristics — matches existing project structure
const UTI_KEYWORDS = ["uti", "uci"];
const EMERGENCY_KEYWORDS = ["sala_vermelha", "sala_laranja", "observacao", "ue_vertical", "ue_horizontal", "emergencia", "red", "yellow", "orange"];

export type NirPeriod = "today" | "7d" | "30d";
export type SectorScope = "all" | "uti" | "enfermaria" | "emergencia";

export interface NirFilters {
  period: NirPeriod;
  sectorScope: SectorScope;
  priority: "all" | "verde" | "amarela" | "vermelha";
}

const periodToHours = (p: NirPeriod) => (p === "today" ? 24 : p === "7d" ? 24 * 7 : 24 * 30);

const classifySector = (sector: string | null | undefined): "uti" | "emergencia" | "enfermaria" => {
  if (!sector) return "enfermaria";
  const s = sector.toLowerCase();
  if (UTI_KEYWORDS.some((k) => s.includes(k))) return "uti";
  if (EMERGENCY_KEYWORDS.some((k) => s.includes(k))) return "emergencia";
  return "enfermaria";
};

export function useNirMetrics(hospitalUnitId: string | undefined, filters: NirFilters) {
  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - periodToHours(filters.period));
    return d.toISOString();
  }, [filters.period]);

  const bedCensusQuery = useQuery({
    queryKey: ["nir-bed-census", hospitalUnitId],
    queryFn: async () => {
      if (!hospitalUnitId) return [];
      const { data, error } = await supabase
        .from("bed_census")
        .select("*")
        .eq("hospital_unit_id", hospitalUnitId)
        .order("sector")
        .order("bed_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!hospitalUnitId,
    refetchInterval: 60_000,
  });

  const requestsQuery = useQuery({
    queryKey: ["nir-regulation-requests", hospitalUnitId, filters.period],
    queryFn: async () => {
      if (!hospitalUnitId) return [];
      const { data, error } = await supabase
        .from("regulation_requests")
        .select("*")
        .eq("hospital_unit_id", hospitalUnitId)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!hospitalUnitId,
    refetchInterval: 60_000,
  });

  const allRequestsQuery = useQuery({
    queryKey: ["nir-regulation-requests-all", hospitalUnitId],
    queryFn: async () => {
      if (!hospitalUnitId) return [];
      const { data, error } = await supabase
        .from("regulation_requests")
        .select("status,priority,created_at,approved_at,completed_at,origin_sector,destination_sector,patient_name,id,request_type,reason,patient_age")
        .eq("hospital_unit_id", hospitalUnitId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!hospitalUnitId,
    refetchInterval: 120_000,
  });

  const beds = bedCensusQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const allRequests = allRequestsQuery.data ?? [];

  // Apply scope filter to beds
  const filteredBeds = useMemo(() => {
    if (filters.sectorScope === "all") return beds;
    return beds.filter((b: any) => classifySector(b.sector) === filters.sectorScope);
  }, [beds, filters.sectorScope]);

  // Apply priority filter to requests
  const filteredRequests = useMemo(() => {
    if (filters.priority === "all") return requests;
    return requests.filter((r: any) => (r.priority || "").toLowerCase().includes(filters.priority));
  }, [requests, filters.priority]);

  const metrics = useMemo(() => {
    const total = filteredBeds.length;
    const occupied = filteredBeds.filter((b: any) => b.status === "ocupado").length;
    const vacant = filteredBeds.filter((b: any) => b.status === "vago").length;
    const blocked = filteredBeds.filter((b: any) => ["bloqueado", "interditado", "manutencao"].includes(b.status)).length;
    const cleaning = filteredBeds.filter((b: any) => b.status === "higienizacao").length;
    const reserved = filteredBeds.filter((b: any) => b.status === "reservado").length;
    const dischargeReady = filteredBeds.filter((b: any) => b.status === "alta_medica_dada").length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    // Vacant by type
    const vacantByType = beds.reduce(
      (acc, b: any) => {
        if (b.status !== "vago") return acc;
        const type = classifySector(b.sector);
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      { uti: 0, enfermaria: 0, emergencia: 0 } as Record<string, number>,
    );

    // Occupancy by sector
    const occupancyBySector = Object.entries(
      beds.reduce((acc, b: any) => {
        if (!acc[b.sector]) acc[b.sector] = { total: 0, occupied: 0 };
        acc[b.sector].total += 1;
        if (b.status === "ocupado") acc[b.sector].occupied += 1;
        return acc;
      }, {} as Record<string, { total: number; occupied: number }>),
    )
      .map(([sector, v]) => ({
        sector,
        total: v.total,
        occupied: v.occupied,
        rate: v.total > 0 ? Math.round((v.occupied / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    // Long-blocked beds
    const now = Date.now();
    const longBlocked = beds
      .filter((b: any) => ["bloqueado", "interditado", "manutencao"].includes(b.status) && b.block_started_at)
      .map((b: any) => {
        const blockedHours = (now - new Date(b.block_started_at).getTime()) / 3_600_000;
        return { ...b, blockedHours };
      })
      .sort((a, b) => b.blockedHours - a.blockedHours);

    const blockedAvgHours = longBlocked.length > 0 ? Math.round(longBlocked.reduce((s, b) => s + b.blockedHours, 0) / longBlocked.length) : 0;

    // Long-cleaning beds (>4h)
    const longCleaning = beds.filter((b: any) => {
      if (b.status !== "higienizacao" || !b.updated_at) return false;
      return (now - new Date(b.updated_at).getTime()) / 3_600_000 > 4;
    });

    // Requests metrics
    const pending = filteredRequests.filter((r: any) => r.status === "pendente").length;
    const inAnalysis = filteredRequests.filter((r: any) => r.status === "em_analise").length;
    const approved = filteredRequests.filter((r: any) => r.status === "aprovada").length;
    const completed = filteredRequests.filter((r: any) => r.status === "concluida").length;
    const denied = filteredRequests.filter((r: any) => r.status === "negada").length;
    const cancelled = filteredRequests.filter((r: any) => r.status === "cancelada").length;
    const totalRequests = filteredRequests.length;
    const approvalRate = totalRequests > 0 ? Math.round(((approved + completed) / totalRequests) * 100) : 0;

    // Avg waiting time (created → approved)
    const respondedWithTime = filteredRequests.filter((r: any) => r.approved_at);
    const avgResponseMin = respondedWithTime.length
      ? Math.round(
          respondedWithTime.reduce((s, r: any) => s + (new Date(r.approved_at).getTime() - new Date(r.created_at).getTime()) / 60_000, 0) /
            respondedWithTime.length,
        )
      : 0;

    // Pacientes represados
    const stuck24h = filteredRequests.filter((r: any) => {
      if (r.status !== "pendente" && r.status !== "em_analise") return false;
      return (now - new Date(r.created_at).getTime()) / 3_600_000 > 24;
    });
    const stuck48hUti = filteredRequests.filter((r: any) => {
      if (r.status !== "pendente" && r.status !== "em_analise") return false;
      const isUti = (r.destination_sector || "").toLowerCase().includes("uti");
      return isUti && (now - new Date(r.created_at).getTime()) / 3_600_000 > 48;
    });

    // SISREG sem resposta há +12h
    const sisregStuck = filteredRequests.filter((r: any) => {
      if (r.request_type !== "externa_sisreg") return false;
      if (r.status !== "pendente" && r.status !== "em_analise") return false;
      return (now - new Date(r.created_at).getTime()) / 3_600_000 > 12;
    });

    return {
      // Bed counts
      total, occupied, vacant, blocked, cleaning, reserved, dischargeReady,
      occupancyRate, vacantByType, occupancyBySector,
      // Block insights
      longBlocked, blockedAvgHours, longBlocked7d: longBlocked.filter((b) => b.blockedHours > 24 * 7),
      longCleaning,
      // Requests
      pending, inAnalysis, approved, completed, denied, cancelled, totalRequests,
      approvalRate, avgResponseMin,
      stuck24h, stuck48hUti, sisregStuck,
    };
  }, [beds, filteredBeds, filteredRequests]);

  // Historical series from allRequests (last 30 days, by day)
  const historical = useMemo(() => {
    const days = 30;
    const buckets: { date: string; created: number; completed: number; avgMinutes: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const key = d.toISOString().slice(5, 10); // MM-DD

      const dayReqs = allRequests.filter((r: any) => {
        const t = new Date(r.created_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      });
      const completedDay = dayReqs.filter((r: any) => r.completed_at);
      const avgMin = completedDay.length
        ? Math.round(
            completedDay.reduce((s, r: any) => s + (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 60_000, 0) /
              completedDay.length,
          )
        : 0;
      buckets.push({ date: key, created: dayReqs.length, completed: completedDay.length, avgMinutes: avgMin });
    }
    return buckets;
  }, [allRequests]);

  // Heatmap: avg occupancy rate by hour of day & weekday (using request creation as proxy for activity)
  const heatmap = useMemo(() => {
    const grid: Record<string, number> = {}; // key = `${weekday}-${hour}`
    allRequests.forEach((r: any) => {
      const d = new Date(r.created_at);
      const key = `${d.getDay()}-${d.getHours()}`;
      grid[key] = (grid[key] || 0) + 1;
    });
    return grid;
  }, [allRequests]);

  // Sankey-like flow data
  const flow = useMemo(() => {
    const map: Record<string, number> = {};
    allRequests.forEach((r: any) => {
      const o = (r.origin_sector || "—").toLowerCase();
      const d = (r.destination_sector || "—").toLowerCase();
      const key = `${o}→${d}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([k, v]) => {
        const [origin, destination] = k.split("→");
        return { origin, destination, count: v };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [allRequests]);

  return {
    isLoading: bedCensusQuery.isLoading || requestsQuery.isLoading,
    refetch: () => {
      bedCensusQuery.refetch();
      requestsQuery.refetch();
      allRequestsQuery.refetch();
    },
    beds,
    requests: filteredRequests,
    allRequests,
    metrics,
    historical,
    heatmap,
    flow,
  };
}

export type NirMetrics = ReturnType<typeof useNirMetrics>["metrics"];
