export interface RoundChecklistItem {
  id: number;
  text: string;
}

export interface RoundChecklistSection {
  code: string;
  title: string;
  items: RoundChecklistItem[];
}

export const STATUS_OPTIONS = [
  { code: "S", label: "Sim", color: "bg-emerald-500" },
  { code: "N", label: "Não", color: "bg-red-500" },
  { code: "CI", label: "Contraindicado", color: "bg-amber-500" },
  { code: "NA", label: "N/A", color: "bg-muted" },
  { code: "O", label: "Otimizar", color: "bg-blue-500" },
  { code: "D", label: "Desmame", color: "bg-violet-500" },
] as const;

export type RoundStatus = typeof STATUS_OPTIONS[number]["code"];

let globalId = 1;
function items(texts: string[]): RoundChecklistItem[] {
  return texts.map((text) => ({ id: globalId++, text }));
}

export const ROUND_SECTIONS: RoundChecklistSection[] = [
  {
    code: "medico_ccih_farm",
    title: "MÉDICO / CCIH / FARM.",
    items: items([
      "Identificadas comorbidades? (Doenças pré-existentes)",
      "Uso de sedação? (Ajuste de dose/suspensão)",
      "Uso de analgesia?",
      "Uso de antibiótico? (Espectro, suspensão, culturas)",
      "Culturas coletadas?",
      "Metabólico: controle glicêmico",
      "Em profilaxia ou tratamento de úlcera gástrica?",
      "Em profilaxia para TVP?",
      "Uso de oftalmoproteção? (Rebaixados ou sedados)",
      "Interações medicamentosas",
      "Posologia",
    ]),
  },
  {
    code: "fisio_to",
    title: "FISIO / T.O.",
    items: items([
      "Necessidade de TQT?",
      "Pressão insp. da VM: Platô < 30 cmH₂O",
      "Cabeceira elevada (30–45° / VM)?",
      "Bundle de PAV (Cuff 22–32 cmH₂O, treino de extubação)",
      "Retirar do leito? (Deambular ou sentar na poltrona)",
    ]),
  },
  {
    code: "enfermagem",
    title: "ENFERMAGEM",
    items: items([
      "Bundle de CVC?",
      "Bundle de SVD?",
      "LPP? (Prevenção, localização, aspecto)",
      "Alternância de decúbito adequada?",
    ]),
  },
  {
    code: "nutricao",
    title: "NUTRIÇÃO",
    items: items([
      "Jejum prolongado?",
      "Tolera dieta ofertada?",
      "Aporte calórico suficiente?",
    ]),
  },
  {
    code: "fono",
    title: "FONO",
    items: items([
      "Risco de broncoaspiração?",
      "É possível progredir consistência da dieta?",
    ]),
  },
  {
    code: "odonto",
    title: "ODONTO",
    items: items([
      "Higiene oral adequada?",
      "Afecção ou infecção bucal identificada?",
      "Previsão de intervenção cirúrgica odontológica?",
    ]),
  },
  {
    code: "servico_social",
    title: "SERV. SOCIAL",
    items: items([
      "Presença de familiar/responsável na visita?",
      "Risco social identificado?",
    ]),
  },
  {
    code: "psico",
    title: "PSICO",
    items: items([
      "Demanda psicológica do paciente e/ou familiar identificada?",
      "Possibilidade de intercorrência psicológica do paciente e/ou familiar?",
    ]),
  },
  {
    code: "medico_alta",
    title: "MÉDICO",
    items: items([
      "Possibilidade de alta?",
    ]),
  },
];
