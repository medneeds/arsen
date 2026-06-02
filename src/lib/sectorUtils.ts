export const SECTOR_LABELS: Record<string, string> = {
  red: "UTI 1",
  yellow: "UTI 2",
  blue: "UCI 1",
  outside: "UCI 2",
  ucc: "UCC",
  neuro_01: "Neuro 01",
  neuro_02: "Neuro 02",
  uti_01: "UTI 1",
  uti_02: "UTI 2",
  uci_01: "UCI 1",
  uci_02: "UCI 2",
  clinica_cirurgica: "Clínica Cirúrgica",
  enfermaria_transicao: "Enfermaria de Transição",
  enfermaria_vascular: "Enfermaria Vascular",
  riv: "RIV",
  cc_preparo: "CC — Preparo",
  cc_bloco: "CC — Bloco Cirúrgico",
  cc_rpa: "CC — RPA",
  sala_vermelha: "Sala Vermelha",
  sala_laranja: "Sala Laranja",
  ue_vertical: "UE Vertical",
  ue_horizontal: "UE Horizontal",
  observacao_clinica: "Observação Clínica",
  internacao_ue: "Internação UE",
};

/** Retorna o label legível do setor ou o próprio código como fallback. */
export function getSectorLabel(code: string | null | undefined): string {
  if (!code) return "";
  return SECTOR_LABELS[code] ?? code;
}
