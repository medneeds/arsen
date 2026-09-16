/**
 * Vocabulário único das vias de administração enteral.
 *
 * O PROBLEMA que isto resolve (16/09/2026): a mesma via era escrita de três
 * jeitos diferentes no sistema.
 *
 *   Assistente, campo nutAccess ...... SNG, SNE, SOG, GTT, JTT
 *   Assistente, campo defaultRoute ... "Enteral (SNE/SNG)", "Gastrostomia"
 *   Editor inline, ENTERAL_ROUTES .... "Nasogástrica (NGT)", "Nasoenteral (NET)"
 *
 * O editor procura o valor recebido na sua própria lista. Como nenhuma string
 * batia, o seletor "Via" abria VAZIO — o médico escolhia a via no assistente e
 * o item nascia sem ela, sem erro nenhum na tela.
 *
 * A sigla é o que o corpo clínico usa à beira do leito e o que já aparece na
 * evolução e na passagem de plantão, então ela vira o valor canônico. "NGT" e
 * "NET" são as abreviações inglesas e saem de circulação.
 *
 * Itens salvos antes desta unificação guardam os rótulos antigos.
 * normalizeEnteralRoute traduz na leitura, para que uma prescrição de ontem
 * continue exibindo a via corretamente.
 */

export interface EnteralRouteOption {
  /** Valor canônico gravado no item. */
  value: string;
  /** Nome por extenso, para quem não conhece a sigla. */
  description: string;
}

export const ENTERAL_ROUTE_OPTIONS: EnteralRouteOption[] = [
  { value: "SNG", description: "Sonda nasogástrica" },
  { value: "SNE", description: "Sonda nasoentérica" },
  { value: "SOG", description: "Sonda orogástrica" },
  { value: "GTT", description: "Gastrostomia" },
  { value: "JTT", description: "Jejunostomia" },
];

/** Vias aceitas para suplemento: oral mais as sondas de uso comum. */
export const SUPPLEMENT_ROUTE_OPTIONS: string[] = [
  "Oral",
  "SNG",
  "SNE",
  "GTT",
];

export const ENTERAL_ROUTE_VALUES = ENTERAL_ROUTE_OPTIONS.map((o) => o.value);

/**
 * Rótulos que já circularam no sistema, mapeados para o valor canônico.
 * A chave é comparada sem acento e em minúsculas.
 */
const LEGADO: Record<string, string> = {
  // Editor inline, antes da unificação
  "nasogastrica (ngt)": "SNG",
  "nasoenteral (net)": "SNE",
  "orogastrica (ogt)": "SOG",
  gastrostomia: "GTT",
  jejunostomia: "JTT",
  // defaultRoute que o assistente emitia
  "enteral (sne/sng)": "SNE",
  "sonda orogastrica": "SOG",
  "sonda nasogastrica": "SNG",
  "sonda nasoenterica": "SNE",
  "sonda nasoenteral": "SNE",
  // variações livres vistas em itens antigos
  enteral: "SNE",
  sonda: "SNE",
  ngt: "SNG",
  net: "SNE",
  ogt: "SOG",
  jjt: "JTT",
  jtt: "JTT",
  gtt: "GTT",
};

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Traduz qualquer grafia conhecida para o valor canônico.
 * Devolve string vazia quando não reconhece — melhor um seletor vazio e
 * honesto do que um valor inventado numa prescrição.
 */
export function normalizeEnteralRoute(valor?: string | null): string {
  if (!valor) return "";
  const bruto = valor.trim();
  if (!bruto || bruto === "-") return "";
  const canonico = ENTERAL_ROUTE_VALUES.find(
    (v) => semAcento(v) === semAcento(bruto),
  );
  if (canonico) return canonico;
  return LEGADO[semAcento(bruto)] ?? "";
}
