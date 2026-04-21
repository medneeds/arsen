/**
 * Modelos pré-definidos ("seeds") por escopo de campo.
 * Aparecem em <FieldTemplates /> acima dos modelos do usuário, sem precisar
 * persistir no banco. Aplicam o texto direto no campo via "Substituir" / "Anexar".
 *
 * Para adicionar mais escopos, basta criar uma nova entrada no objeto.
 */
export interface SeedTemplate {
  name: string;
  body: string;
}

export const FIELD_TEMPLATE_SEEDS: Record<string, SeedTemplate[]> = {
  // ===== Exame Físico — Normal por sistema =====
  "evolution.objective.exam.general": [
    {
      name: "Normal — bom estado geral",
      body: "BEG, lúcido, orientado em tempo e espaço, corado, hidratado, anictérico, acianótico, afebril, eupneico em ar ambiente, cooperativo.",
    },
    {
      name: "Normal — internado estável",
      body: "REG, lúcido e orientado, corado, hidratado, afebril, eupneico, hemodinamicamente estável, sem sinais de toxemia.",
    },
  ],
  "evolution.objective.exam.cardiovascular": [
    {
      name: "Normal",
      body: "Ritmo cardíaco regular em 2 tempos, bulhas normofonéticas, sem sopros, sem turgência jugular, pulsos periféricos cheios e simétricos, perfusão periférica preservada (TEC < 3s).",
    },
  ],
  "evolution.objective.exam.respiratory": [
    {
      name: "Normal",
      body: "Tórax simétrico, expansibilidade preservada, MV fisiológico bilateralmente, sem ruídos adventícios, eupneico em ar ambiente, SpO₂ adequada.",
    },
    {
      name: "Normal — em O₂ suplementar",
      body: "MV fisiológico bilateralmente, sem ruídos adventícios, eupneico sob O₂ suplementar (cateter nasal), SpO₂ adequada, sem sinais de desconforto respiratório.",
    },
  ],
  "evolution.objective.exam.abdomen": [
    {
      name: "Normal",
      body: "Abdome plano, flácido, indolor à palpação superficial e profunda, sem visceromegalias, RHA presentes e normoativos, Murphy e Blumberg negativos.",
    },
  ],
  "evolution.objective.exam.neurological": [
    {
      name: "Normal",
      body: "Lúcido e orientado em tempo, espaço e pessoa, Glasgow 15, pupilas isocóricas e fotorreagentes, sem déficits motores ou sensitivos focais, marcha não avaliada (paciente acamado).",
    },
    {
      name: "Normal — deambulando",
      body: "Lúcido e orientado, Glasgow 15, pupilas isocóricas e fotorreagentes, força muscular grau V em 4 membros, sensibilidade preservada, marcha atípica, equilíbrio preservado.",
    },
  ],
  "evolution.objective.exam.extremities": [
    {
      name: "Normal",
      body: "Extremidades aquecidas, bem perfundidas, sem edemas, panturrilhas livres, pulsos periféricos palpáveis e simétricos.",
    },
  ],
  "evolution.objective.exam.skin": [
    {
      name: "Normal — sem lesões",
      body: "Pele íntegra, hidratada, corada, sem lesões, sem áreas de hiperemia ou pressão, sem feridas operatórias.",
    },
  ],
  "evolution.objective.exam.other": [
    {
      name: "Acessos / dispositivos sem intercorrências",
      body: "AVP em MSE pérvio, sem sinais flogísticos. Sondagens e drenos sem intercorrências.",
    },
  ],

  // ===== Evolução (texto livre) =====
  "evolution.subjective": [
    {
      name: "Paciente estável, sem queixas",
      body: "Paciente em evolução clínica favorável, sem queixas álgicas ou novas intercorrências no plantão. Aceita dieta, diurese e evacuações preservadas. Mantém-se hemodinamicamente estável, em uso da terapêutica prescrita.",
    },
    {
      name: "Aguardando exames / conduta",
      body: "Paciente mantido em observação clínica, sem novas queixas no momento. Aguarda resultado de exames complementares para definição de conduta.",
    },
  ],

  // ===== Plano =====
  "evolution.plan": [
    {
      name: "Conduta expectante",
      body: "- Mantido suporte clínico atual\n- Mantida monitorização multiparamétrica contínua\n- Reavaliação clínica seriada\n- Aguardar resultados de exames pendentes\n- Acolhimento ao paciente e familiares",
    },
  ],

  // ===== Exames complementares =====
  "evolution.objective.complementares": [],
};

export function getSeedsForScope(scope: string): SeedTemplate[] {
  return FIELD_TEMPLATE_SEEDS[scope] ?? [];
}
