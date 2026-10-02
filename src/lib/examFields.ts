/**
 * Fonte unica do exame fisico por aparelhos — compartilhada entre a Evolucao
 * (EvolutionForm) e a Admissao (AdmissionForm). Mantem campos, rotulos e ordem
 * IDENTICOS nas duas superficies. A persistencia continua na coluna
 * `exame_fisico` (JSON) de `evolucoes`; aqui so se define o shape e a lista.
 */

export interface PhysicalExam {
  general: string;
  cardiovascular: string;
  respiratory: string;
  abdomen: string;
  neurological: string;
  extremities: string;
  skin: string;
  other: string;
}

export const EMPTY_PHYSICAL_EXAM: PhysicalExam = {
  general: "",
  cardiovascular: "",
  respiratory: "",
  abdomen: "",
  neurological: "",
  extremities: "",
  skin: "",
  other: "",
};

/** Campos do exame fisico, na ordem exibida (igual na evolucao e na admissao). */
export const EXAM_FIELDS: { key: keyof PhysicalExam; label: string }[] = [
  { key: "general", label: "Estado Geral" },
  { key: "cardiovascular", label: "Cardiovascular" },
  { key: "respiratory", label: "Respiratório" },
  { key: "abdomen", label: "Abdome" },
  { key: "neurological", label: "Neurológico" },
  { key: "extremities", label: "Extremidades" },
  { key: "skin", label: "Pele / Feridas" },
  { key: "other", label: "Outros" },
];
