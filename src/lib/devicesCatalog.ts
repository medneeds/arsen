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
  { id: "dreno", label: "Dreno", hint: "Torácico / abdominal" },
];

export interface EvolutionDevice {
  /** ID do catálogo OU UUID livre quando custom. */
  id: string;
  label: string;
  /** ISO ou BR DD/MM/AAAA. */
  insertedAt: string;
  custom?: boolean;
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
