import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FavoriteRow {
  medication_id: string;
  medication_name: string;
  category: string;
  use_count: number;
  last_used_at: string;
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
      const { data, error } = await supabase
        .from("medication_favorites")
        .select("medication_id, medication_name, category, use_count, last_used_at")
        .eq("user_id", auth.user.id)
        .order("use_count", { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (!error && data) {
        const map = new Map<string, number>();
        (data as FavoriteRow[]).forEach(r => map.set(r.medication_id, r.use_count));
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
      await supabase.rpc("track_medication_use", {
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
