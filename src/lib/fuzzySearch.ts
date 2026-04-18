// Fuzzy search utilities for prescription medication lookup
// - Accent/case insensitive
// - Tolerates typos via Levenshtein distance
// - Ranks matches: exact prefix > word-start > substring > fuzzy
// - Supports favorites boost (use_count from doctor's history)

export function normalizeSearch(text: string): string {
  return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Bounded Levenshtein — returns Infinity if distance exceeds maxDist (fast prune)
export function levenshtein(a: string, b: string, maxDist = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return Infinity;
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return Infinity;
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

export interface FuzzyCandidate {
  /** primary searchable name */
  name: string;
  /** secondary searchable text (presentation, category, etc.) */
  presentation?: string;
  /** alternative names */
  aliases?: string[];
}

/**
 * Score a candidate against a query.
 * Higher score = better match. Returns null if no match at all.
 *
 * Scoring tiers (base):
 *   1000 exact match
 *    900 prefix match
 *    700 word-start match (token boundary)
 *    500 substring match
 *    300 alias match (any tier above, on alias)
 *    100..280 fuzzy match (tolerates typos), scaled by distance
 *
 *  +20 per favorite use (favoriteBoost)
 */
export function scoreCandidate(
  query: string,
  candidate: FuzzyCandidate,
  favoriteBoost = 0,
): number | null {
  const q = normalizeSearch(query.trim());
  if (!q) return favoriteBoost > 0 ? favoriteBoost : 0;

  const name = normalizeSearch(candidate.name);
  const pres = normalizeSearch(candidate.presentation || "");
  const aliases = (candidate.aliases || []).map(normalizeSearch);

  let best = 0;

  // Tier checks on name
  if (name === q) best = Math.max(best, 1000);
  else if (name.startsWith(q)) best = Math.max(best, 900);
  else if (new RegExp(`\\b${escapeReg(q)}`).test(name)) best = Math.max(best, 700);
  else if (name.includes(q)) best = Math.max(best, 500);

  // Presentation substring (lower priority)
  if (best < 500 && pres.includes(q)) best = Math.max(best, 400);

  // Aliases — match counts but slightly lower
  for (const a of aliases) {
    if (!a) continue;
    if (a === q) best = Math.max(best, 850);
    else if (a.startsWith(q)) best = Math.max(best, 750);
    else if (a.includes(q)) best = Math.max(best, 450);
  }

  // Fuzzy fallback (only when query is reasonably long to avoid noise)
  if (best === 0 && q.length >= 4) {
    const tokens = name.split(/[^a-z0-9]+/).filter(Boolean);
    const maxDist = q.length >= 8 ? 2 : 1;
    let bestDist = Infinity;
    for (const t of tokens) {
      if (Math.abs(t.length - q.length) > maxDist) continue;
      const d = levenshtein(q, t, maxDist);
      if (d < bestDist) bestDist = d;
    }
    if (bestDist <= maxDist) {
      best = 300 - bestDist * 100; // d=1 -> 200, d=2 -> 100
    }
  }

  if (best === 0) return null;
  return best + favoriteBoost;
}

/**
 * Sort + filter helper for medication-like lists.
 * `getFavoriteCount(id)` should return the doctor's use_count for that item id (0 if none).
 */
export function fuzzySearch<T extends { id: string; name: string; presentation?: string; aliases?: string[] }>(
  query: string,
  items: T[],
  getFavoriteCount: (id: string) => number = () => 0,
  limit = 15,
): T[] {
  const q = query.trim();
  // Empty query: show favorites first, then catalog order
  if (!q) {
    const sorted = [...items].sort((a, b) => getFavoriteCount(b.id) - getFavoriteCount(a.id));
    return sorted.slice(0, limit);
  }

  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    const fav = getFavoriteCount(item.id);
    const favBoost = fav > 0 ? Math.min(150, 20 + fav * 5) : 0;
    const score = scoreCandidate(q, item, favBoost);
    if (score !== null) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.item);
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
