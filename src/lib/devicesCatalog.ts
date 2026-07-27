/**
 * Catálogo institucional de dispositivos invasivos para registro em Evolução.
 * Limiares D7 (âmbar) e D14 (vermelho) seguem orientação CDC/ANVISA p/ revisão
 * de risco de IRAS (CLABSI / CAUTI / VAP).
 */

export interface DeviceCatalogItem {
  id: string;
  label: string;
  /** Hint curto exibido no formulário (opcional). */
  hint?: string;
  /**
   * Rótulo do campo de qualificação, quando o dispositivo admite subtipo.
   * A presença deste campo é o que faz o input de subtipo aparecer no formulário.
   */
  detailLabel?: string;
  /**
   * Sugestões de subtipo, oferecidas num select. A lista é ABERTA: há sempre
   * a opção "Outro (digitar)" para um tipo fora do catálogo.
   */
  detailOptions?: string[];
  /**
   * Dispositivo que o paciente pode ter em mais de uma unidade ao mesmo tempo
   * (ex.: dois drenos). Quando true, o checkbox vira apenas o INTERRUPTOR e
   * cada unidade vira uma linha própria, uniforme, com tipo + data + lixeira.
   */
  multiple?: boolean;
}

export const DEVICES_CATALOG: DeviceCatalogItem[] = [
  { id: "cvc", label: "CVC", hint: "Cateter Venoso Central" },
  { id: "picc", label: "PICC" },
  { id: "diaCath", label: "Cateter de Diálise / Shilley" },
  { id: "svd", label: "SVD", hint: "Sonda Vesical de Demora" },
  { id: "snesog", label: "SNE / SOG" },
  { id: "iot", label: "IOT", hint: "Intubação Orotraqueal" },
  { id: "tqt", label: "TQT", hint: "Traqueostomia" },
  { id: "pai", label: "PAI", hint: "Pressão Arterial Invasiva" },
  {
    id: "dreno",
    label: "Dreno",
    // Sem `hint`: o subtipo agora e declarado no proprio campo detailLabel/
    // detailOptions. Manter "(Torácico / abdominal)" ao lado do rotulo fazia
    // parecer valor ja preenchido, competindo com o campo descritivo.
    multiple: true,
    detailLabel: "Tipo de dreno",
    detailOptions: [
      "Torácico (selo d'água)",
      "Mediastinal",
      "Ventricular externo (DVE)",
      "Subgaleal / subdural",
      "Abdominal / cavitário",
      "Penrose (laminar)",
      "Tubulolaminar",
      "Portovac / Hemovac (aspirativo)",
      "Kehr (biliar, tubo em T)",
      "Nefrostomia",
      "Pigtail",
    ],
  },
];

export interface EvolutionDevice {
  /** ID do catálogo OU UUID livre quando custom. */
  id: string;
  label: string;
  /** ISO ou BR DD/MM/AAAA. */
  insertedAt: string;
  custom?: boolean;
  /**
   * Para dispositivos `multiple`, aponta o item de catálogo desta unidade.
   * O `id` passa a identificar a INSTÂNCIA (um dreno específico), não o tipo.
   * Ausente em registros antigos e em dispositivos de unidade única — ver
   * deviceCatalogId(), que cobre os dois casos.
   */
  catalogId?: string;
  /**
   * Subtipo do dispositivo — ex.: tipo de dreno (torácico, DVE, Penrose...).
   * Texto livre, opcional. Persistido dentro de soap_data (JSONB), portanto
   * não exige migration: registros antigos simplesmente não têm a chave.
   */
  detail?: string;
}

/**
 * Rótulo de exibição do dispositivo, incluindo o subtipo quando houver.
 * Ex.: "Dreno (Torácico (selo d'água))" -> "Dreno — Torácico (selo d'água)".
 */
export function formatDeviceLabel(
  d: Pick<EvolutionDevice, "label" | "detail">
): string {
  const detail = d.detail?.trim();
  return detail ? `${d.label} — ${detail}` : d.label;
}

/**
 * Item de catálogo ao qual o dispositivo pertence, ou undefined se for
 * customizado/desconhecido.
 *
 * RETROCOMPATIBILIDADE: antes de dreno virar `multiple`, a instância única era
 * gravada com `id` igual ao id do catálogo e sem `catalogId`. Evoluções
 * salvas naquele formato continuam sendo reconhecidas aqui — é por isso que
 * a leitura nunca deve comparar `d.id` com o id do catálogo diretamente.
 */
export function deviceCatalogId(d: EvolutionDevice): string | undefined {
  if (d.catalogId) return d.catalogId;
  if (d.custom) return undefined;
  return DEVICES_CATALOG.some((c) => c.id === d.id) ? d.id : undefined;
}

/** Gera id único para uma nova unidade de dispositivo múltiplo. */
export function makeDeviceInstanceId(catalogId: string): string {
  return `${catalogId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Rótulo da opção de texto livre no select de subtipo. */
export const DETAIL_OTHER_LABEL = "Outro (digitar)";

/** Limiares institucionais para alerta visual de tempo de permanência. */
export const DEVICE_ALERT_AMBER_DAYS = 7;
export const DEVICE_ALERT_RED_DAYS = 14;

export function deviceAlertTone(days: number | null): "ok" | "amber" | "red" {
  if (days === null) return "ok";
  if (days >= DEVICE_ALERT_RED_DAYS) return "red";
  if (days >= DEVICE_ALERT_AMBER_DAYS) return "amber";
  return "ok";
}
