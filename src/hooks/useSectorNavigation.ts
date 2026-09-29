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
      // PERF: uma unica query (setores + join ala!inner) no lugar de duas em serie
      // (alas depois setores). O !inner + filtro em ala.ativo/ala.hospital_id
      // restringe aos setores de alas ativas do hospital — mesma logica de antes,
      // um round-trip a menos no caminho do /setores e do seletor.
      let q = supabase
        .from("setores")
        .select("id, nome, tipo, ala_id, ala:alas!inner ( id, nome, hospital_id, ativo )")
        .eq("ativo", true)
        .eq("ala.ativo", true)
        .order("nome");
      if (hospitalId) q = q.eq("ala.hospital_id", hospitalId);
      const { data: setores, error } = await q;
      if (error) throw error;

      return (setores ?? []).map((s: any) => ({
        id: s.id,
        nome: s.nome,
        tipo: s.tipo ?? null,
        alaId: s.ala_id,
        alaNome: s.ala?.nome ?? "Sem ala",
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

  // Ordena os blocos por nome da ala (Bloco I, II, III, IV). Sem isto, a
  // ordem seguia o primeiro setor alfabético de cada ala (dava IV, II, III, I).
  groups.sort((a, b) => a.group.localeCompare(b.group, "pt-BR", { numeric: true }));

  return { groups, sectors, loading: query.isLoading, isEmpty: !query.isLoading && groups.length === 0 };
}
