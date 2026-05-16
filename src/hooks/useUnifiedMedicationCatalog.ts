import { useCallback, useEffect, useMemo, useState } from "react";
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
  nome_comercial: string | null;
  therapeutic_class: string | null;
  pharmacological_group: string | null;
  controlled: boolean | null;
  high_alert: boolean | null;
  requires_dilution: boolean | null;
  notes: string | null;
  lista: string | null;
  notification_type: string | null;
};

type PresentationRow = {
  medication_id: string;
  form: string | null;
  concentration: string | null;
  unit: string | null;
  route: string | null;
  pharmaceutical_form: string | null;
  default_route: string | null;
  default_dose: string | null;
  standard_dilution: string | null;
  max_daily_dose: string | null;
  infusion_time: string | null;
};

export interface ControlledCatalogItem {
  catalogId: string;
  presentationId: string | null;
  generic_name: string;
  nome_comercial: string;
  pharmaceutical_form: string;
  concentration: string;
  default_route: string;
  default_dose: string;
  notification_type: 'Receita Amarela' | 'Receita Azul' | 'Controle Especial 2 vias' | null;
  controlled: boolean;
  high_alert: boolean;
  pharmacological_group: string | null;
  lista: string | null;
  searchKey: string; // NFD lowercased: generic_name + nome_comercial
  label: string;     // "Nome (princípio) — concentração"
}

function nfd(s: string): string {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function deriveNotificationType(row: CatalogRow): ControlledCatalogItem['notification_type'] {
  if (row.notification_type === 'Receita Amarela' || row.notification_type === 'Receita Azul' || row.notification_type === 'Controle Especial 2 vias') {
    return row.notification_type;
  }
  const grp = (row.pharmacological_group || '').toLowerCase();
  const lista = row.lista || '';
  if (['A1','A2','A3'].includes(lista) || /entorpecente|opi[óo]ide/.test(grp)) return 'Receita Amarela';
  if (['B1','B2'].includes(lista) || /psicotr[óo]pic|benzodiaze/.test(grp)) return 'Receita Azul';
  if (lista === 'C1') return 'Controle Especial 2 vias';
  if (row.controlled) return 'Controle Especial 2 vias';
  return null;
}

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
    const isStandard = !!row.notes && /HMDM\s*2026/i.test(row.notes);
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
        isStandard,
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
        isStandard,
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

/** Subscribers notificados quando o cache é (re)populado — usado para revalidar
 *  componentes que carregaram o hook antes da sessão Supabase chegar. */
const cacheSubscribers = new Set<() => void>();
function notifyCacheSubscribers() {
  for (const cb of cacheSubscribers) {
    try { cb(); } catch { /* noop */ }
  }
}

async function fetchCatalogNow() {
  const [{ data: catalog, error: e1 }, { data: pres, error: e2 }] = await Promise.all([
    supabase
      .from("medication_catalog")
      .select("id, generic_name, nome_comercial, therapeutic_class, pharmacological_group, controlled, high_alert, requires_dilution, notes, lista, notification_type")
      .order("generic_name"),
    supabase
      .from("medication_presentations")
      .select("medication_id, form, concentration, unit, route, pharmaceutical_form, default_route, default_dose, standard_dilution, max_daily_dose, infusion_time"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    catalog: (catalog ?? []) as CatalogRow[],
    presentations: (pres ?? []) as PresentationRow[],
  };
}

async function loadCatalogOnce(force = false) {
  if (!force && cachedRows && cachedRows.catalog.length > 0) return cachedRows;
  if (cachedPromise) return cachedPromise;
  cachedPromise = (async () => {
    let result = await fetchCatalogNow();
    // Se voltou vazio (sessão/RLS ainda não pronta), tenta de novo 1x após 1.2s
    // antes de cachear — evita travar a busca em estado vazio até refresh manual.
    if (result.catalog.length === 0) {
      await new Promise((r) => setTimeout(r, 1200));
      const retry = await fetchCatalogNow();
      if (retry.catalog.length > 0) result = retry;
    }
    // Só cacheia se tem conteúdo — vazio não vira cache permanente.
    if (result.catalog.length > 0) {
      cachedRows = result;
      notifyCacheSubscribers();
    }
    return result;
  })();
  try {
    return await cachedPromise;
  } finally {
    cachedPromise = null;
  }
}

// Quando a sessão Supabase fica disponível depois do primeiro carregamento,
// força revalidação se o cache ainda estiver vazio. Instalado 1x.
let authListenerInstalled = false;
function installAuthListener() {
  if (authListenerInstalled) return;
  authListenerInstalled = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user && (!cachedRows || cachedRows.catalog.length === 0)) {
      loadCatalogOnce(true).then(notifyCacheSubscribers).catch(() => { /* noop */ });
    }
  });
}

export interface UnifiedCatalog {
  loading: boolean;
  error: string | null;
  byCategory: Record<PrescriptionCategory, MedicationEntry[]>;
  allItems: MedicationEntry[];
  antimicrobials: MedicationEntry[];
  highAlerts: MedicationEntry[];
  medications: MedicationEntry[];
  controlledItems: ControlledCatalogItem[];
  findControlledByName: (name: string) => ControlledCatalogItem | undefined;
  refetch: () => Promise<void>;
}

export function useUnifiedMedicationCatalog(): UnifiedCatalog {
  const [rows, setRows] = useState<{ catalog: CatalogRow[]; presentations: PresentationRow[] } | null>(
    cachedRows
  );
  const [loading, setLoading] = useState(!cachedRows);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    installAuthListener();
    let alive = true;

    const applyCache = () => {
      if (!alive || !cachedRows) return;
      setRows(cachedRows);
      setLoading(false);
    };
    cacheSubscribers.add(applyCache);

    if (cachedRows && cachedRows.catalog.length > 0) {
      setRows(cachedRows);
      setLoading(false);
    } else {
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
    }
    return () => {
      alive = false;
      cacheSubscribers.delete(applyCache);
    };
  }, []);

  const refetch = useCallback(async () => {
    try {
      const r = await loadCatalogOnce(true);
      setRows(r);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao recarregar catálogo");
    }
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

  const controlledItems = useMemo<ControlledCatalogItem[]>(() => {
    if (!rows) return [];
    const presByMed = new Map<string, PresentationRow[]>();
    for (const p of rows.presentations) {
      const arr = presByMed.get(p.medication_id) ?? [];
      arr.push(p);
      presByMed.set(p.medication_id, arr);
    }
    const out: ControlledCatalogItem[] = [];
    for (const row of rows.catalog) {
      if (!row.controlled && !row.high_alert) continue;
      const notif = deriveNotificationType(row);
      const presList = presByMed.get(row.id) ?? [null as any];
      const generic = row.generic_name;
      const comercial = row.nome_comercial || generic;
      for (const p of presList) {
        const concentration = p?.concentration?.trim() || '';
        const form = (p?.pharmaceutical_form || p?.form || '').trim();
        const route = (p?.default_route || p?.route || '').trim();
        const dose = (p?.default_dose || '').trim();
        const labelMain = comercial.toUpperCase() === generic.toUpperCase()
          ? generic
          : `${comercial} (${generic})`;
        const label = concentration ? `${labelMain} — ${concentration}` : labelMain;
        out.push({
          catalogId: row.id,
          presentationId: p ? `${row.id}-${form}-${concentration}-${route}` : null,
          generic_name: generic,
          nome_comercial: comercial,
          pharmaceutical_form: form,
          concentration,
          default_route: route,
          default_dose: dose,
          notification_type: notif,
          controlled: !!row.controlled,
          high_alert: !!row.high_alert,
          pharmacological_group: row.pharmacological_group,
          lista: row.lista,
          searchKey: `${nfd(generic)} ${nfd(comercial)}`,
          label,
        });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [rows]);

  const findControlledByName = useMemo(() => {
    const idx = new Map<string, ControlledCatalogItem>();
    for (const c of controlledItems) {
      const k1 = nfd(c.generic_name);
      const k2 = nfd(c.nome_comercial);
      if (!idx.has(k1)) idx.set(k1, c);
      if (!idx.has(k2)) idx.set(k2, c);
    }
    return (name: string) => {
      const n = nfd(name);
      if (idx.has(n)) return idx.get(n);
      // Substring fallback
      for (const c of controlledItems) {
        if (n && (c.searchKey.includes(n) || n.includes(nfd(c.generic_name)))) return c;
      }
      return undefined;
    };
  }, [controlledItems]);

  return {
    loading,
    error,
    byCategory,
    allItems,
    antimicrobials: byCategory.antimicrobial,
    highAlerts: byCategory.high_alert,
    medications: byCategory.medication,
    controlledItems,
    findControlledByName,
  };
}
