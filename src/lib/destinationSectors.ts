/**
 * Lista compartilhada de setores de destino para abertura de atendimento +
 * pré-admissão a partir do mapa de leitos.
 *
 * O `mapTitle` precisa bater EXATAMENTE com o título usado no mapa de leitos
 * (SECTOR_VISUAL.title em Index.tsx), pois o PreAdmissionSection filtra
 * `destination_sector === sectorFilterLabel`.
 */
export interface DestinationSectorOption {
  value: string;
  label: string;
  group: string;
  /** Título exato usado no mapa de leitos (filtro do "Aguardando Admissão"). */
  mapTitle: string;
}

export const DESTINATION_SECTORS: DestinationSectorOption[] = [
  // Triagem / Urgência
  { value: "sala_vermelha", label: "Sala Vermelha", group: "Triagem / Urgência", mapTitle: "Sala Vermelha" },
  { value: "sala_laranja", label: "Sala Laranja", group: "Triagem / Urgência", mapTitle: "Sala Laranja" },
  { value: "ue_vertical", label: "UE Vertical", group: "Triagem / Urgência", mapTitle: "UE Vertical" },
  { value: "ue_horizontal", label: "UE Horizontal", group: "Triagem / Urgência", mapTitle: "UE Horizontal" },
  { value: "observacao_clinica", label: "Observação Clínica", group: "Triagem / Urgência", mapTitle: "Obs. Clínica" },
  { value: "internacao_ue", label: "Internação UE", group: "Triagem / Urgência", mapTitle: "Internação UE" },
  // UTIs
  { value: "red", label: "UTI 1", group: "Terapia Intensiva", mapTitle: "UTI 1" },
  { value: "yellow", label: "UTI 2", group: "Terapia Intensiva", mapTitle: "UTI 2" },
  // UCIs
  { value: "blue", label: "UCI 1", group: "Cuidados Intermediários", mapTitle: "UCI 1" },
  { value: "outside", label: "UCI 2", group: "Cuidados Intermediários", mapTitle: "UCI 2" },
  { value: "ucc", label: "UCC", group: "Cuidados Intermediários", mapTitle: "UCC" },
  // Enfermarias
  { value: "neuro_01", label: "Enfermaria Neuro 01", group: "Enfermarias", mapTitle: "Neuro 01" },
  { value: "neuro_02", label: "Enfermaria Neuro 02", group: "Enfermarias", mapTitle: "Neuro 02" },
  { value: "clinica_cirurgica", label: "Clínica Cirúrgica", group: "Enfermarias", mapTitle: "Clínica Cirúrgica" },
  { value: "enfermaria_transicao", label: "Enf. Transição", group: "Enfermarias", mapTitle: "Enf. Transição" },
  { value: "enfermaria_vascular", label: "Enf. Vascular", group: "Enfermarias", mapTitle: "Enf. Vascular" },
  // Centro cirúrgico
  { value: "riv", label: "RIV", group: "Centro Cirúrgico / RIV", mapTitle: "RIV" },
  { value: "cc_preparo", label: "CC Preparo", group: "Centro Cirúrgico / RIV", mapTitle: "CC Preparo" },
  { value: "cc_bloco", label: "CC Bloco Cirúrgico", group: "Centro Cirúrgico / RIV", mapTitle: "CC Bloco Cirúrgico" },
  { value: "cc_rpa", label: "CC RPA", group: "Centro Cirúrgico / RIV", mapTitle: "CC RPA" },
];

export const findSectorByMapTitle = (mapTitle: string | null | undefined) =>
  mapTitle ? DESTINATION_SECTORS.find(s => s.mapTitle === mapTitle) : undefined;
