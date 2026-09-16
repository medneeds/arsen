import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FavoriteRow {
  medicamento_id: string;
  contagem_uso: number;
  ultimo_uso_em: string;
}

/** Resolve profissionais.id a partir do auth user id (profissional_id ≠ auth.uid). */
async function resolveProfissionalId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from("profissionais")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Loads the current doctor's medication favorites (frequency map)
 * and exposes a tracker that increments use_count on every prescription.
 *
 * The favorites map is kept in memory (Map<medication_id, use_count>)
 * for O(1) lookups in fuzzy ranking.
 */
export function useMedicationFavorites() {
  const [favorites, setFavorites] = useState<Map<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setLoaded(true);
        return;
      }
      // MIGRAÇÃO: medication_favorites → medicamentos_favoritos.
      // Vínculo por profissional_id (≠ auth.uid) resolvido em profissionais.
      // DEGRADADO: medication_name/category não têm coluna no schema novo.
      const profissionalId = await resolveProfissionalId(auth.user.id);
      if (!profissionalId) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const { data, error } = await supabase
        .from("medicamentos_favoritos")
        .select("medicamento_id, contagem_uso, ultimo_uso_em")
        .eq("profissional_id", profissionalId)
        .order("contagem_uso", { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (!error && data) {
        const map = new Map<string, number>();
        (data as FavoriteRow[]).forEach(r => map.set(r.medicamento_id, r.contagem_uso));
        setFavorites(map);
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const getCount = useCallback((id: string): number => {
    return favorites.get(id) ?? 0;
  }, [favorites]);

  const trackUse = useCallback(async (id: string, name: string, category: string) => {
    // Optimistic local update
    setFavorites(prev => {
      const next = new Map(prev);
      next.set(id, (next.get(id) ?? 0) + 1);
      return next;
    });
    try {
      // MIGRAÇÃO: RPC custom desconhecida no schema novo → chamada via
      // (supabase.rpc as any). A persistência depende de a RPP existir no
      // backend novo; medication_name/category não têm mais coluna (best-effort).
      await (supabase.rpc as any)("track_medication_use", {
        p_medication_id: id,
        p_medication_name: name,
        p_category: category,
      });
    } catch {
      // Silent — favorites are best-effort and shouldn't block prescription flow
    }
  }, []);

  /** Returns top N favorite IDs sorted by use_count desc */
  const topFavoriteIds = useCallback((limit = 12): string[] => {
    return Array.from(favorites.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
  }, [favorites]);

  return { favorites, getCount, trackUse, topFavoriteIds, loaded };
}
