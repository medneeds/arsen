import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import type { Department } from "@/contexts/DepartmentContext";
import type { NavSectorGroup } from "@/config/sectorNavigation";

/**
 * Hierarquia de setores DIRETO DO BANCO (alas → setores), para o seletor de
 * setor do menu superior e afins. Substitui a lista estática de
 * `sectorNavigation.ts`, que era específica de um hospital.
 *
 * group  = ala.nome
 * sector = setor.nome (também vira o `department`, já que o schema novo não tem
 *          o taxonômico antigo; o mapa filtra por setor.nome — ver usePatients).
 *
 * RLS já restringe alas/setores ao hospital do usuário; ainda assim filtramos
 * por hospital_id quando disponível.
 */
export interface DbSector {
  id: string;
  nome: string;
  tipo: string | null;
  alaId: string;
  alaNome: string;
}

export function useSectorNavigation() {
  const { currentHospital } = useHospital();
  const hospitalId = currentHospital?.id ?? null;

  const query = useQuery({
    queryKey: ["sector-navigation", hospitalId],
    queryFn: async (): Promise<DbSector[]> => {
      let alasQuery = supabase.from("alas").select("id, nome, hospital_id, ativo").eq("ativo", true);
      if (hospitalId) alasQuery = alasQuery.eq("hospital_id", hospitalId);
      const { data: alas, error: alasErr } = await alasQuery.order("nome");
      if (alasErr) throw alasErr;
      const alaList = (alas ?? []) as { id: string; nome: string }[];
      if (alaList.length === 0) return [];

      const alaIds = alaList.map((a) => a.id);
      const { data: setores, error: setErr } = await supabase
        .from("setores")
        .select("id, nome, tipo, ala_id, ativo")
        .in("ala_id", alaIds)
        .eq("ativo", true)
        .order("nome");
      if (setErr) throw setErr;

      const alaNomeById = new Map(alaList.map((a) => [a.id, a.nome]));
      return (setores ?? []).map((s: any) => ({
        id: s.id,
        nome: s.nome,
        tipo: s.tipo ?? null,
        alaId: s.ala_id,
        alaNome: alaNomeById.get(s.ala_id) ?? "Sem ala",
      }));
    },
    staleTime: 60_000,
  });

  const sectors = query.data ?? [];

  // Agrupa por ala preservando a ordem alfabética das alas.
  const groups: NavSectorGroup[] = [];
  const byAla = new Map<string, NavSectorGroup>();
  for (const s of sectors) {
    let g = byAla.get(s.alaId);
    if (!g) {
      g = { group: s.alaNome, sectors: [] };
      byAla.set(s.alaId, g);
      groups.push(g);
    }
    g.sectors.push({ name: s.nome, department: s.nome as Department });
  }

  return { groups, sectors, loading: query.isLoading, isEmpty: !query.isLoading && groups.length === 0 };
}
