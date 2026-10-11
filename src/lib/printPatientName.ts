/**
 * Nome do paciente para documentos impressos. Escolhe o primeiro candidato nao
 * vazio, na ordem recebida: o nome AO VIVO do cadastro primeiro e a prop/URL por
 * ultimo. O nome da URL e um snapshot do momento em que a pagina abriu — se o
 * cadastro foi criado depois (ou a pagina abriu sem nome), ele chega vazio.
 */
export function pickPrintName(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    const t = (c ?? "").trim();
    if (t) return t;
  }
  return "";
}
