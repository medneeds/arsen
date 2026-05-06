import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ALL_ITEMS_BY_CATEGORY,
  ANTIMICROBIAL_OPTIONS,
  HIGH_ALERT_OPTIONS,
  MEDICATIONS_DATABASE,
  type MedicationEntry,
  type PrescriptionCategory,
} from "@/data/medicationsDatabase";

/**
 * Hook unificado: combina o `medication_catalog` (Supabase) com a base estática
 * local, sem duplicar entradas. Devolve um objeto por categoria pronto para uso
 * em busca da prescrição, Guia ATM, listas e popups.
 *
 * Fonte da verdade clínica = catálogo importado (HMDM 2026 / RENAME). A base
 * local é mantida como fallback offline e como complemento (perfis assistenciais
 * que não estão no catálogo: dietas, hidratação, hemoterapia, cuidados, etc.).
 */

type CatalogRow = {
  id: string;
  generic_name: string;
  therapeutic_class: string | null;
  controlled: boolean | null;
  high_alert: boolean | null;
  requires_dilution: boolean | null;
  notes: string | null;
};

type PresentationRow = {
  medication_id: string;
  form: string | null;
  concentration: string | null;
  unit: string | null;
  route: string | null;
  standard_dilution: string | null;
  max_daily_dose: string | null;
  infusion_time: string | null;
};

const ANTIMICROBIAL_CLASS_REGEX =
  /antimicrob|antibi[óo]tic|antifúngic|antifungic|antiviral|antiparasit/i;

function classifyCategory(row: CatalogRow): PrescriptionCategory {
  if (row.high_alert) return "high_alert";
  if (row.therapeutic_class && ANTIMICROBIAL_CLASS_REGEX.test(row.therapeutic_class)) {
    return "antimicrobial";
  }
  return "medication";
}

function buildPresentationLabel(p: PresentationRow): string {
  const form = p.form?.trim();
  const conc = p.concentration?.trim();
  if (form && conc) return `${conc} — ${form}`;
  return form || conc || "Apresentação padrão";
}

function buildInstructions(row: CatalogRow, p: PresentationRow): string | undefined {
  const parts: string[] = [];
  if (p.standard_dilution) parts.push(`Diluição: ${p.standard_dilution}`);
  if (p.infusion_time) parts.push(`Infusão: ${p.infusion_time}`);
  if (p.max_daily_dose) parts.push(`Dose máx/dia: ${p.max_daily_dose}`);
  if (row.requires_dilution && !p.standard_dilution) parts.push("Requer diluição");
  if (row.controlled) parts.push("Medicamento controlado");
  if (row.notes) parts.push(row.notes);
  return parts.length ? parts.join(" • ") : undefined;
}

function rowsToEntries(
  catalog: CatalogRow[],
  presentations: PresentationRow[]
): MedicationEntry[] {
  const presByMed = new Map<string, PresentationRow[]>();
  for (const p of presentations) {
    const arr = presByMed.get(p.medication_id) ?? [];
    arr.push(p);
    presByMed.set(p.medication_id, arr);
  }

  const entries: MedicationEntry[] = [];
  for (const row of catalog) {
    const cat = classifyCategory(row);
    const list = presByMed.get(row.id);
    if (!list || list.length === 0) {
      entries.push({
        id: `cat-${row.id}`,
        name: row.generic_name,
        presentation: "Apresentação padrão",
        defaultDose: "",
        defaultRoute: "",
        defaultPosology: "",
        defaultSchedule: "",
        instructions: buildInstructions(row, {} as PresentationRow),
        category: cat,
        highAlert: !!row.high_alert,
      });
      continue;
    }
    for (const p of list) {
      entries.push({
        id: `cat-${row.id}-${p.form ?? ""}-${p.concentration ?? ""}-${p.route ?? ""}`,
        name: row.generic_name,
        presentation: buildPresentationLabel(p),
        defaultDose: "",
        defaultRoute: p.route ?? "",
        defaultPosology: "",
        defaultSchedule: "",
        instructions: buildInstructions(row, p),
        category: cat,
        highAlert: !!row.high_alert,
      });
    }
  }
  return entries;
}

function dedupeMerge(local: MedicationEntry[], remote: MedicationEntry[]): MedicationEntry[] {
  // Chave: nome+apresentação normalizados. Remoto tem prioridade (mais atual).
  const norm = (s: string) =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const key = (m: MedicationEntry) => `${norm(m.name)}::${norm(m.presentation)}`;

  const map = new Map<string, MedicationEntry>();
  for (const m of remote) map.set(key(m), m);
  for (const m of local) if (!map.has(key(m))) map.set(key(m), m);
  // Ordena alfabeticamente
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

let cachedRows: { catalog: CatalogRow[]; presentations: PresentationRow[] } | null = null;
let cachedPromise: Promise<{ catalog: CatalogRow[]; presentations: PresentationRow[] }> | null = null;

async function loadCatalogOnce() {
  if (cachedRows) return cachedRows;
  if (cachedPromise) return cachedPromise;
  cachedPromise = (async () => {
    const [{ data: catalog, error: e1 }, { data: pres, error: e2 }] = await Promise.all([
      supabase
        .from("medication_catalog")
        .select("id, generic_name, therapeutic_class, controlled, high_alert, requires_dilution, notes")
        .order("generic_name"),
      supabase
        .from("medication_presentations")
        .select("medication_id, form, concentration, unit, route, standard_dilution, max_daily_dose, infusion_time"),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    cachedRows = {
      catalog: (catalog ?? []) as CatalogRow[],
      presentations: (pres ?? []) as PresentationRow[],
    };
    return cachedRows;
  })();
  try {
    return await cachedPromise;
  } finally {
    cachedPromise = null;
  }
}

export interface UnifiedCatalog {
  loading: boolean;
  error: string | null;
  byCategory: Record<PrescriptionCategory, MedicationEntry[]>;
  allItems: MedicationEntry[];
  antimicrobials: MedicationEntry[];
  highAlerts: MedicationEntry[];
  medications: MedicationEntry[];
}

export function useUnifiedMedicationCatalog(): UnifiedCatalog {
  const [rows, setRows] = useState<{ catalog: CatalogRow[]; presentations: PresentationRow[] } | null>(
    cachedRows
  );
  const [loading, setLoading] = useState(!cachedRows);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (cachedRows) {
      setRows(cachedRows);
      setLoading(false);
      return;
    }
    loadCatalogOnce()
      .then((r) => {
        if (alive) {
          setRows(r);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e?.message ?? "Falha ao carregar catálogo");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const byCategory = useMemo<Record<PrescriptionCategory, MedicationEntry[]>>(() => {
    const remoteEntries = rows ? rowsToEntries(rows.catalog, rows.presentations) : [];
    const remoteByCat: Record<string, MedicationEntry[]> = {};
    for (const e of remoteEntries) {
      (remoteByCat[e.category] ??= []).push(e);
    }
    return {
      nutrition: ALL_ITEMS_BY_CATEGORY.nutrition,
      hydration: ALL_ITEMS_BY_CATEGORY.hydration,
      replacement: ALL_ITEMS_BY_CATEGORY.replacement,
      medication: dedupeMerge(MEDICATIONS_DATABASE, remoteByCat.medication ?? []),
      antimicrobial: dedupeMerge(ANTIMICROBIAL_OPTIONS, remoteByCat.antimicrobial ?? []),
      high_alert: dedupeMerge(HIGH_ALERT_OPTIONS, remoteByCat.high_alert ?? []),
      inhalation: ALL_ITEMS_BY_CATEGORY.inhalation,
      hemotherapy: ALL_ITEMS_BY_CATEGORY.hemotherapy,
      care: ALL_ITEMS_BY_CATEGORY.care,
      nonstandard: ALL_ITEMS_BY_CATEGORY.nonstandard,
    };
  }, [rows]);

  const allItems = useMemo(() => Object.values(byCategory).flat(), [byCategory]);

  return {
    loading,
    error,
    byCategory,
    allItems,
    antimicrobials: byCategory.antimicrobial,
    highAlerts: byCategory.high_alert,
    medications: byCategory.medication,
  };
}
