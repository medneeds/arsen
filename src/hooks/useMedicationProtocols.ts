/**
 * Carrega o catálogo HMDM 2026 (medication_catalog + medication_presentations)
 * e expõe um lookup que devolve PosologyProtocol[] baseado em evidência farmacológica
 * (diluição padrão, dose máxima diária, tempo de infusão).
 *
 * Usado na PrescricaoPage para sugerir preenchimento automático ao adicionar
 * um medicamento — mesclado com os protocolos clínicos manuais (sepse, TEV, etc.)
 * de `posologyProtocols.ts`.
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PosologyProtocol } from "@/lib/posologyProtocols";

interface CatalogRow {
  id: string;
  generic_name: string;
  high_alert: boolean;
  controlled: boolean;
  requires_dilution: boolean;
}

interface PresentationRow {
  medication_id: string;
  form: string;
  concentration: string;
  unit: string;
  route: string;
  standard_dilution: string | null;
  max_daily_dose: string | null;
  infusion_time: string | null;
}

interface ProtocolIndex {
  byKey: Map<string, PosologyProtocol[]>;
}

/** Normaliza nome para chave de busca (sem acentos/pontuação, lowercase). */
function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mapeia abreviação de via do banco para o label longo usado nos itens da prescrição. */
function expandRoute(route: string): string {
  const r = route.toUpperCase().trim();
  if (r === "EV" || r === "IV") return "Intravenosa";
  if (r === "VO") return "Oral";
  if (r === "SC") return "Subcutânea";
  if (r === "IM") return "Intramuscular";
  if (r === "INAL") return "Inalatória";
  if (r === "SL") return "Sublingual";
  if (r === "RET") return "Retal";
  if (r === "TOP") return "Tópica";
  if (r === "OFT") return "Oftálmica";
  if (r === "OT") return "Otológica";
  if (r === "VAG") return "Vaginal";
  if (r === "ENT") return "Enteral";
  return route;
}

/** Constrói label curto e legível: "Frasco-Ampola 1G EV". */
function buildLabel(p: PresentationRow): string {
  const parts = [p.form, p.concentration, p.route].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Converte uma linha de presentation em PosologyProtocol pronto para o
 * PosologySuggestionsBar. Só gera um protocolo se houver pelo menos um campo
 * de evidência preenchido (diluição, dose máx. ou tempo de infusão).
 */
function presentationToProtocol(
  catalogName: string,
  p: PresentationRow,
): PosologyProtocol | null {
  const hasEvidence = p.standard_dilution || p.max_daily_dose || p.infusion_time;
  if (!hasEvidence) return null;

  const route = expandRoute(p.route);
  // Tenta extrair tempo de infusão em minutos para o campo infusionTime.
  const infusionMinMatch = p.infusion_time?.match(/(\d+)\s*min/i);
  const infusionTimeMin = infusionMinMatch ? infusionMinMatch[1] : undefined;

  // Monta instructions concatenando dose máx + tempo de infusão (texto livre).
  const instructionsParts: string[] = [];
  if (p.max_daily_dose) instructionsParts.push(`Dose máx: ${p.max_daily_dose}`);
  if (p.infusion_time && !infusionTimeMin) {
    instructionsParts.push(p.infusion_time);
  }

  return {
    label: `Padrão (${p.form})`,
    indication: `${catalogName} — ${p.concentration}`,
    dose: "", // mantém dose atual (médico ajusta)
    route,
    posology: "", // mantém posologia atual
    diluent: p.standard_dilution ?? undefined,
    diluentVolume: undefined,
    infusionTime: infusionTimeMin,
    instructions: instructionsParts.join(" · ") || undefined,
    evidence: "Bula",
  };
}

let cachedIndex: ProtocolIndex | null = null;
let cachePromise: Promise<ProtocolIndex> | null = null;

async function loadIndex(): Promise<ProtocolIndex> {
  if (cachedIndex) return cachedIndex;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    const [catalogRes, presRes] = await Promise.all([
      supabase
        .from("medication_catalog")
        .select("id, generic_name, high_alert, controlled, requires_dilution"),
      supabase
        .from("medication_presentations")
        .select(
          "medication_id, form, concentration, unit, route, standard_dilution, max_daily_dose, infusion_time",
        ),
    ]);

    const catalog = (catalogRes.data ?? []) as CatalogRow[];
    const presentations = (presRes.data ?? []) as PresentationRow[];

    const catalogById = new Map<string, CatalogRow>();
    catalog.forEach((c) => catalogById.set(c.id, c));

    // Agrupa apresentações por medication_id e gera protocolos por nome normalizado.
    const byKey = new Map<string, PosologyProtocol[]>();
    presentations.forEach((p) => {
      const cat = catalogById.get(p.medication_id);
      if (!cat) return;
      const protocol = presentationToProtocol(cat.generic_name, p);
      if (!protocol) return;
      const key = normalize(cat.generic_name);
      const list = byKey.get(key) ?? [];
      list.push(protocol);
      byKey.set(key, list);
    });

    cachedIndex = { byKey };
    return cachedIndex;
  })();

  return cachePromise;
}

export function useMedicationProtocols() {
  const [index, setIndex] = useState<ProtocolIndex | null>(cachedIndex);

  useEffect(() => {
    let mounted = true;
    if (!cachedIndex) {
      loadIndex().then((idx) => {
        if (mounted) setIndex(idx);
      });
    } else {
      setIndex(cachedIndex);
    }
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Busca protocolos baseados em evidência (HMDM 2026) para um medicamento.
   * Faz match por nome normalizado, depois por inclusão (mais específico primeiro).
   */
  const getDbProtocols = useCallback(
    (medicationName: string): PosologyProtocol[] => {
      if (!index || !medicationName) return [];
      const key = normalize(medicationName);
      const exact = index.byKey.get(key);
      if (exact && exact.length > 0) return exact;

      // includes match: pega chave mais longa contida no nome
      const candidates = Array.from(index.byKey.keys())
        .filter((dbKey) => key.includes(dbKey) || dbKey.includes(key))
        .sort((a, b) => b.length - a.length);
      if (candidates.length > 0) return index.byKey.get(candidates[0]) ?? [];
      return [];
    },
    [index],
  );

  return useMemo(
    () => ({ getDbProtocols, ready: index !== null }),
    [getDbProtocols, index],
  );
}
