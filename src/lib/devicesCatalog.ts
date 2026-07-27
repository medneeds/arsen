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
    // Sem `hint`: o subtipo agora e declarado no proprio campo detailLabel/
    // detailOptions. Manter "(Torácico / abdominal)" ao lado do rotulo fazia
    // parecer valor ja preenchido, competindo com o campo descritivo.
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

/** Normaliza p/ comparação: sem acento, minúsculo, sem espaço nas pontas. */
function normalizeLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Dado um rótulo digitado livremente num dispositivo customizado, devolve o
 * item de catálogo cujas sugestões de subtipo se aplicam.
 *
 * Existe porque o catálogo tem UM checkbox por dispositivo, mas o paciente
 * pode ter mais de um do mesmo tipo — dois drenos, por exemplo. O segundo é
 * cadastrado como customizado, e sem isto ele ficaria sem campo de tipo e sem
 * sugestão nenhuma, enquanto o primeiro tem os dois.
 *
 * Casa por inclusão sobre o texto normalizado, então "Dreno", "dreno 2",
 * "Dreno torácico E" e "DRENO DE TÓRAX" todos encontram o item `dreno`.
 */
export function suggestDetailForLabel(
  label: string
): DeviceCatalogItem | undefined {
  const n = normalizeLabel(label);
  if (!n) return undefined;
  return DEVICES_CATALOG.find(
    (c) => c.detailOptions && c.detailOptions.length > 0 && n.includes(normalizeLabel(c.label))
  );
}

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
