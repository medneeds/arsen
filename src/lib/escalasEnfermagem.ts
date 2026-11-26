/**
 * Escalas da enfermagem — textos das opcoes e classificacao. Puro.
 *  - Fugulin (opcoes 1–4 de cada area; pontuacao em fugulin.ts)
 *  - Braden (risco de lesao por pressao; 6–23, menor = maior risco)
 *  - Morse (risco de queda; 0–125)
 * Os textos seguem os instrumentos publicados; conferir com o protocolo do HMDM.
 */
import type { FugulinAreaKey } from "./fugulin.ts";

export const FUGULIN_OPCOES: Record<FugulinAreaKey, readonly [string, string, string, string]> = {
  estado_mental: ["Orientado no tempo e no espaço", "Períodos de desorientação no tempo e no espaço", "Períodos de inconsciência", "Inconsciente"],
  oxigenacao: ["Não depende de oxigênio", "Uso intermitente de máscara ou cateter de O₂", "Uso contínuo de máscara ou cateter de O₂", "Ventilação mecânica (qualquer modalidade)"],
  sinais_vitais: ["Controle de rotina (8/8h)", "Controle em intervalos de 6h", "Controle em intervalos de 4h", "Controle em intervalos ≤ 2h"],
  motilidade: ["Movimenta todos os segmentos corporais", "Limitação de movimentos", "Dificuldade para movimentar segmentos; mudança de decúbito auxiliada pela enfermagem", "Incapaz de movimentar qualquer segmento; mudança de decúbito realizada pela enfermagem"],
  deambulacao: ["Ambulante", "Necessita de auxílio para deambular", "Locomoção em cadeira de rodas", "Restrito ao leito"],
  alimentacao: ["Autossuficiente", "Por boca, com auxílio", "Por sonda nasogástrica/enteral", "Por cateter central (NPT)"],
  cuidado_corporal: ["Autossuficiente", "Auxílio no banho de chuveiro e/ou higiene oral", "Banho de chuveiro e higiene oral realizados pela enfermagem", "Banho no leito e higiene oral realizados pela enfermagem"],
  eliminacao: ["Autossuficiente", "Uso de vaso sanitário com auxílio", "Uso de comadre ou eliminações no leito", "Evacuação no leito e sonda vesical para controle da diurese"],
  terapeutica: ["IM ou VO", "EV contínua ou por sonda nasogástrica", "EV intermitente", "Drogas vasoativas para manutenção da PA"],
  integridade_cutaneo_mucosa: ["Pele íntegra", "Alteração da cor da pele e/ou lesão de epiderme/derme", "Lesão de subcutâneo e músculo; incisão cirúrgica, ostomias, drenos", "Destruição de derme, epiderme, músculo e estruturas de suporte; evisceração"],
  curativo: ["Sem curativo ou limpeza da ferida pelo paciente no banho", "Curativo 1 vez ao dia pela enfermagem", "Curativo 2 vezes ao dia pela enfermagem", "Curativo 3 vezes ao dia ou mais pela enfermagem"],
  tempo_curativo: ["Sem curativo ou limpeza no banho", "Entre 5 e 15 minutos", "Entre 15 e 30 minutos", "Superior a 30 minutos"],
};

// ── Braden ─────────────────────────────────────────────────────────────────
export const BRADEN_ITENS = [
  { key: "percepcao", label: "Percepção sensorial", opcoes: ["Totalmente limitado", "Muito limitado", "Levemente limitado", "Nenhuma limitação"] },
  { key: "umidade", label: "Umidade", opcoes: ["Completamente molhada", "Muito molhada", "Ocasionalmente molhada", "Raramente molhada"] },
  { key: "atividade", label: "Atividade", opcoes: ["Acamado", "Confinado à cadeira", "Anda ocasionalmente", "Anda frequentemente"] },
  { key: "mobilidade", label: "Mobilidade", opcoes: ["Totalmente imóvel", "Bastante limitado", "Levemente limitado", "Não apresenta limitações"] },
  { key: "nutricao", label: "Nutrição", opcoes: ["Muito pobre", "Provavelmente inadequada", "Adequada", "Excelente"] },
  { key: "friccao", label: "Fricção e cisalhamento", opcoes: ["Problema", "Problema em potencial", "Nenhum problema aparente"] },
] as const;
export type BradenKey = (typeof BRADEN_ITENS)[number]["key"];
export type BradenRespostas = Partial<Record<BradenKey, number>>;
export type RiscoBraden = "muito_alto" | "alto" | "moderado" | "baixo" | "sem_risco";
export const RISCO_BRADEN_LABEL: Record<RiscoBraden, string> = {
  muito_alto: "Risco muito alto", alto: "Risco alto", moderado: "Risco moderado", baixo: "Risco baixo", sem_risco: "Sem risco",
};

export interface ResultadoEscala<R> { completo: boolean; escore: number | null; risco: R | null; faltando: string[] }

export function classificarBraden(r: BradenRespostas): ResultadoEscala<RiscoBraden> {
  const faltando: string[] = [];
  let soma = 0;
  for (const it of BRADEN_ITENS) {
    const v = r[it.key];
    if (v == null || !Number.isInteger(v) || v < 1 || v > it.opcoes.length) faltando.push(it.key);
    else soma += v;
  }
  if (faltando.length) return { completo: false, escore: null, risco: null, faltando };
  const risco: RiscoBraden = soma <= 9 ? "muito_alto" : soma <= 12 ? "alto" : soma <= 14 ? "moderado" : soma <= 18 ? "baixo" : "sem_risco";
  return { completo: true, escore: soma, risco, faltando };
}

// ── Morse ──────────────────────────────────────────────────────────────────
export const MORSE_ITENS = [
  { key: "historico_queda", label: "Histórico de queda (3 meses)", opcoes: [{ t: "Não", p: 0 }, { t: "Sim", p: 25 }] },
  { key: "diagnostico_secundario", label: "Diagnóstico secundário", opcoes: [{ t: "Não", p: 0 }, { t: "Sim", p: 15 }] },
  { key: "auxilio_deambulacao", label: "Auxílio na deambulação", opcoes: [{ t: "Nenhum, acamado ou auxiliado pela enfermagem", p: 0 }, { t: "Muletas, bengala ou andador", p: 15 }, { t: "Apoia-se no mobiliário", p: 30 }] },
  { key: "terapia_ev", label: "Terapia endovenosa / dispositivo EV", opcoes: [{ t: "Não", p: 0 }, { t: "Sim", p: 20 }] },
  { key: "marcha", label: "Marcha", opcoes: [{ t: "Normal, sem deambulação, acamado ou cadeira de rodas", p: 0 }, { t: "Fraca", p: 10 }, { t: "Comprometida / cambaleante", p: 20 }] },
  { key: "estado_mental", label: "Estado mental", opcoes: [{ t: "Orientado / capaz quanto à própria capacidade", p: 0 }, { t: "Superestima a capacidade / esquece limitações", p: 15 }] },
] as const;
export type MorseKey = (typeof MORSE_ITENS)[number]["key"];
/** Indice da opcao escolhida (0..n-1). */
export type MorseRespostas = Partial<Record<MorseKey, number>>;
export type RiscoMorse = "baixo" | "moderado" | "alto";
export const RISCO_MORSE_LABEL: Record<RiscoMorse, string> = { baixo: "Risco baixo", moderado: "Risco moderado", alto: "Risco alto" };

export function classificarMorse(r: MorseRespostas): ResultadoEscala<RiscoMorse> {
  const faltando: string[] = [];
  let soma = 0;
  for (const it of MORSE_ITENS) {
    const i = r[it.key];
    if (i == null || !Number.isInteger(i) || i < 0 || i >= it.opcoes.length) faltando.push(it.key);
    else soma += it.opcoes[i].p;
  }
  if (faltando.length) return { completo: false, escore: null, risco: null, faltando };
  const risco: RiscoMorse = soma <= 24 ? "baixo" : soma <= 44 ? "moderado" : "alto";
  return { completo: true, escore: soma, risco, faltando };
}
