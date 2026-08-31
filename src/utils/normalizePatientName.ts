/**
 * normalizePatientName
 *
 * Normaliza campos cadastrais de nomes próprios de pacientes:
 *   - Remove acentos e diacríticos (á→a, é→e, ç→c, ã→a, etc.)
 *   - Remove apóstrofos e caracteres especiais inadequados
 *   - Preserva espaços entre palavras, letras e números
 *   - Remove espaços duplicados e espaços no início/fim
 *   - Converte para maiúsculas (padrão do sistema)
 *
 * Aplica-se a: patient_name, mother_name, full_name e equivalentes.
 * NÃO aplica em: CPF, CNS, prontuário, leito, setor, textos clínicos livres.
 *
 * Exemplos:
 *   "João Gonçalves da Conceição" → "JOAO GONCALVES DA CONCEICAO"
 *   "José Antônio"                → "JOSE ANTONIO"
 *   "MARIA D'ÁVILA"               → "MARIA DAVILA"
 */
export function normalizePatientName(value: string): string {
  if (!value) return value;

  return value
    // 1. Normaliza unicode: decompõe letras+diacríticos em codepoints separados
    .normalize("NFD")
    // 2. Remove os diacríticos (acentos, til, cedilha via decomposição, etc.)
    .replace(/[\u0300-\u036f]/g, "")
    // 3. Remove apóstrofos e outros caracteres especiais inadequados
    //    Preserva: letras (A-Z a-z), números (0-9), espaço, hífen
    .replace(/[^A-Za-z0-9 -]/g, "")
    // 4. Remove espaços duplicados
    .replace(/  +/g, " ")
    // 5. Remove espaços no início/fim
    .trim()
    // 6. Converte para maiúsculas (padrão do sistema)
    .toUpperCase();
}
