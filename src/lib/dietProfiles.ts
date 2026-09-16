/**
 * Perfis de dieta — vocabulário único entre o assistente e o editor.
 *
 * O PROBLEMA (16/09/2026): havia duas listas distintas para o MESMO campo.
 *
 *   Assistente (ORAL_PROFILES) .... Livre, Hipossódica, Para diabético,
 *                                   Sem lactose, Rica em fibras…
 *   Editor (DIET_PROFILES) ........ Geral, Diabético, Renal, Oncológico,
 *                                   Pediátrico, Idoso…
 *
 * Uma descreve a CARACTERÍSTICA da dieta, a outra a CONDIÇÃO do paciente.
 * Nenhum valor casava, então o seletor "Perfil" do editor abria vazio mesmo
 * tendo recebido o dado — a mesma falha que a via enteral tinha.
 *
 * Pior: o assistente sempre permitiu escolher VÁRIOS perfis (um paciente pode
 * precisar de dieta hipossódica E para diabético ao mesmo tempo) e os enviava
 * unidos por vírgula. O editor usava seleção única, incapaz de representar
 * isso. A dieta perdia metade da prescrição ao chegar no item.
 *
 * Vocabulário canônico: a CARACTERÍSTICA da dieta, porque é o que a cozinha
 * hospitalar precisa saber para preparar a bandeja. A condição do paciente já
 * está nas comorbidades e no CID.
 */

export const DIET_PROFILE_OPTIONS: string[] = [
  "Livre",
  "Hipossódica",
  "Para diabético",
  "Hipolipídica",
  "Hipoproteica (renal)",
  "Hiperproteica",
  "Hipercalórica",
  "Hipocalórica",
  "Sem lactose",
  "Sem glúten",
  "Vegetariana",
  "Hipouricêmica",
  "Rica em fibras",
];

/** Rótulos antigos do editor, traduzidos para o vocabulário canônico. */
const LEGADO: Record<string, string> = {
  geral: "Livre",
  "diabetico": "Para diabético",
  "cardiopata/hipertenso": "Hipossódica",
  renal: "Hipoproteica (renal)",
  hepatopata: "Hipoproteica (renal)",
  gastrointestinal: "Rica em fibras",
  // Anêmico, Pós-operatório, Oncológico, Pediátrico e Idoso descrevem a
  // condição do paciente, não a dieta: não têm equivalente e são descartados
  // na leitura em vez de virarem um perfil errado.
};

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Lê o campo `dietProfile` do item, que guarda os perfis separados por vírgula,
 * e devolve a lista canônica. Rótulos desconhecidos são descartados — melhor
 * um perfil a menos do que um perfil inventado numa prescrição.
 */
export function readDietProfiles(valor?: string | null): string[] {
  if (!valor) return [];
  const saida: string[] = [];
  for (const bruto of valor.split(",")) {
    const t = bruto.trim();
    if (!t || t === "-") continue;
    const canonico = DIET_PROFILE_OPTIONS.find((o) => semAcento(o) === semAcento(t));
    const resolvido = canonico ?? LEGADO[semAcento(t)];
    if (resolvido && !saida.includes(resolvido)) saida.push(resolvido);
  }
  return saida;
}

/** Grava a lista no formato do campo: separados por vírgula, na ordem da lista. */
export function writeDietProfiles(perfis: string[]): string {
  const ordenados = DIET_PROFILE_OPTIONS.filter((o) => perfis.includes(o));
  return ordenados.join(", ");
}
