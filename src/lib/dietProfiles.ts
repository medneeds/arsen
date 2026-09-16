/**
 * Perfil da dieta — vocabulário único entre o assistente e o corpo da
 * prescrição.
 *
 * HISTÓRICO
 * Havia TRÊS conceitos sobrepostos para a mesma coisa:
 *   - oralProfiles no assistente ... Livre, Hipossódica, Sem lactose…
 *     (característica da dieta, e só aparecia na modalidade ORAL)
 *   - comorbs no assistente ........ HAS, Diabetes, DRC, Celíaca…
 *     (condição do paciente, em passo separado)
 *   - DIET_PROFILES no editor ...... Geral, Renal, Oncológico, Pediátrico…
 *     (terceira lista, seleção única, que não casava com nenhuma das outras)
 *
 * O resultado: o perfil configurado no fluxo chegava vazio ao item, e o médico
 * preenchia a mesma informação duas vezes, em telas diferentes.
 *
 * A UNIFICAÇÃO
 * A condição do paciente vira o perfil, porque é assim que o médico pensa: ele
 * sabe que o paciente é hipertenso, não que "a dieta é hipossódica". A
 * característica resultante vem junto, como consequência, no campo `efeito`.
 * Mesma lista nos dois lugares, com seleção múltipla nos dois — um paciente
 * pode ser hipertenso, diabético e celíaco ao mesmo tempo.
 */

export interface DietProfileOption {
  key: string;
  /** Condição do paciente — o que o médico reconhece. */
  label: string;
  /** Característica que ela impõe à dieta — o que a cozinha precisa saber. */
  efeito: string;
}

export const DIET_PROFILE_OPTIONS: DietProfileOption[] = [
  { key: "has",      label: "HAS",             efeito: "Hipossódica" },
  { key: "dm",       label: "Diabetes",        efeito: "Controle glicêmico" },
  { key: "drc",      label: "DRC",             efeito: "Restrição K/P/Na" },
  { key: "hepato",   label: "Hepatopata",      efeito: "Hipoproteica c/ AAR" },
  { key: "ic",       label: "Cardiopata/IC",   efeito: "Hipossódica + restrição hídrica" },
  { key: "disfagia", label: "Disfagia",        efeito: "Pastosa/líquida espessada" },
  { key: "celiaco",  label: "Doença celíaca",  efeito: "Sem glúten" },
  { key: "lactose",  label: "Intol. lactose",  efeito: "Sem lactose" },
  { key: "appl",     label: "APLV",            efeito: "Sem proteína do leite" },
  { key: "constip",  label: "Constipação",     efeito: "Rica em fibras" },
  { key: "diarreia", label: "Diarreia",        efeito: "Pobre em fibras" },
  { key: "pancrea",  label: "Pancreatite",     efeito: "Hipolipídica" },
  { key: "obeso",    label: "Obesidade",       efeito: "Hipocalórica" },
  { key: "desnut",   label: "Desnutrição",     efeito: "Hipercalórica/proteica" },
  { key: "gestante", label: "Gestante",        efeito: "Ácido fólico e ferro" },
  { key: "oncolog",  label: "Oncológico",      efeito: "Imunomoduladora" },
  { key: "uti",      label: "Crítico/UTI",     efeito: "25-30 kcal/kg + 1,2-2 g/kg ptn" },
];

export const DIET_PROFILE_LABELS = DIET_PROFILE_OPTIONS.map((o) => o.label);

/**
 * Rótulos que já circularam, traduzidos para o vocabulário atual. Cobre as duas
 * listas antigas — a do editor (condição) e a do assistente (característica) —
 * para que prescrições salvas antes continuem legíveis.
 */
const LEGADO: Record<string, string> = {
  renal: "DRC",
  "cardiopata/hipertenso": "Cardiopata/IC",
  diabetico: "Diabetes",
  hipossodica: "HAS",
  "para diabetico": "Diabetes",
  "hipoproteica (renal)": "DRC",
  hipolipidica: "Pancreatite",
  "sem lactose": "Intol. lactose",
  "sem gluten": "Doença celíaca",
  "rica em fibras": "Constipação",
  hipercalorica: "Desnutrição",
  hipocalorica: "Obesidade",
  // "Livre", "Geral", "Hiperproteica", "Vegetariana", "Hipouricêmica",
  // "Anêmico", "Pós-operatório", "Pediátrico" e "Idoso" não têm condição
  // correspondente. São descartados na leitura, em vez de virarem um perfil
  // errado numa prescrição.
};

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Lê o campo `dietProfile` (rótulos separados por vírgula) como lista canônica. */
export function readDietProfiles(valor?: string | null): string[] {
  if (!valor) return [];
  const saida: string[] = [];
  for (const bruto of valor.split(",")) {
    const t = bruto.trim();
    if (!t || t === "-") continue;
    const direto = DIET_PROFILE_LABELS.find((l) => semAcento(l) === semAcento(t));
    const resolvido = direto ?? LEGADO[semAcento(t)];
    if (resolvido && !saida.includes(resolvido)) saida.push(resolvido);
  }
  return saida;
}

/** Grava a lista no campo, na ordem canônica. */
export function writeDietProfiles(perfis: string[]): string {
  return DIET_PROFILE_LABELS.filter((l) => perfis.includes(l)).join(", ");
}

/** Converte chaves (usadas pelo assistente) em rótulos, para gravar no item. */
export function keysToLabels(chaves: Iterable<string>): string[] {
  const set = new Set(chaves);
  return DIET_PROFILE_OPTIONS.filter((o) => set.has(o.key)).map((o) => o.label);
}

/** Converte rótulos de volta em chaves, para reabrir o assistente preenchido. */
export function labelsToKeys(rotulos: string[]): string[] {
  return DIET_PROFILE_OPTIONS.filter((o) => rotulos.includes(o.label)).map((o) => o.key);
}
