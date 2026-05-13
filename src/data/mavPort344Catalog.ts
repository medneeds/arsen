// =============================================================================
// MAV / Portaria 344 — Catálogo de diferenciação regulatória
// Categoriza medicações em 3 grupos:
//   - MAV: Alta Vigilância (ISMP) — exige dupla checagem, abre HighAlertGuideDialog
//   - PORT_344: Controlado (Portaria 344/98) — gera receita Amarela/Azul/Especial
//   - MAV_PORT_344: ambos — abre HighAlertGuideDialog E gera receita controlada
// Fonte: arquivo seed mavPort344Catalog.json
// =============================================================================
import rawCatalog from "./mavPort344Catalog.json";

export type Lista344 = "A1" | "A2" | "A3" | "B1" | "B2" | "C1" | null;

export type DocumentoTipo =
  | "Receita Amarela"
  | "Receita Azul"
  | "Receita Especial"
  | "Controle Especial 2 vias"
  | null;

export type CategoriaSeguranca = "MAV" | "PORT_344" | "MAV_PORT_344";

export interface MavPort344Entry {
  id: string;
  principio_ativo: string;
  nomes_comerciais: string[];
  categoria: CategoriaSeguranca;
  high_alert: boolean;
  controlled: boolean;
  dupla_checagem: boolean;
  lista_portaria_344: Lista344;
  documento_gerado: DocumentoTipo;
  pharmacological_group: string;
  pharmaceutical_form: string;
  concentration: string;
  default_route: string;
  default_dose: string;
  observacao: string | null;
}

export const MAV_PORT_344_CATALOG: MavPort344Entry[] = rawCatalog as MavPort344Entry[];

// NFD normalize: remove acentos e baixa-caixa, mantendo regra do projeto.
const norm = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Index para busca rápida por nome (princípio ativo + comerciais).
const NAME_INDEX: Map<string, MavPort344Entry> = (() => {
  const m = new Map<string, MavPort344Entry>();
  for (const entry of MAV_PORT_344_CATALOG) {
    m.set(norm(entry.principio_ativo), entry);
    // Tokens individuais do princípio ativo (ex.: "Petidina / Meperidina")
    for (const token of entry.principio_ativo.split(/[\/,()]/)) {
      const t = norm(token);
      if (t && t.length >= 4 && !m.has(t)) m.set(t, entry);
    }
    for (const c of entry.nomes_comerciais) {
      const k = norm(c);
      if (k && !m.has(k)) m.set(k, entry);
    }
  }
  return m;
})();

/**
 * Procura uma medicação no catálogo regulatório.
 * Match por: princípio ativo exato, nome comercial exato, ou substring inicial
 * do nome do medicamento contendo o termo (ex.: "Morfina 10mg" → Morfina).
 */
export function findRegulatoryInfo(medicationName: string): MavPort344Entry | null {
  if (!medicationName) return null;
  const n = norm(medicationName);
  // 1) match direto
  const direct = NAME_INDEX.get(n);
  if (direct) return direct;
  // 2) primeira palavra do nome (ex.: "Fentanil 50mcg/mL" → "fentanil")
  const firstWord = n.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 4) {
    const fw = NAME_INDEX.get(firstWord);
    if (fw) return fw;
  }
  // 3) varredura: chave do índice contida no nome buscado
  for (const [key, entry] of NAME_INDEX) {
    if (key.length >= 5 && n.includes(key)) return entry;
  }
  return null;
}

/** Helper: retorna apenas a categoria de segurança, ou null se medicação não regulada. */
export function getSecurityCategory(medicationName: string): CategoriaSeguranca | null {
  return findRegulatoryInfo(medicationName)?.categoria ?? null;
}
