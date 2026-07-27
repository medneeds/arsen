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
   * Sugestões de subtipo. A lista é ABERTA — renderizada como <datalist>, o
   * profissional pode escolher uma sugestão ou digitar um valor próprio.
   */
  detailOptions?: string[];
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
    hint: "Torácico / abdominal",
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

/** Limiares institucionais para alerta visual de tempo de permanência. */
export const DEVICE_ALERT_AMBER_DAYS = 7;
export const DEVICE_ALERT_RED_DAYS = 14;

export function deviceAlertTone(days: number | null): "ok" | "amber" | "red" {
  if (days === null) return "ok";
  if (days >= DEVICE_ALERT_RED_DAYS) return "red";
  if (days >= DEVICE_ALERT_AMBER_DAYS) return "amber";
  return "ok";
}
