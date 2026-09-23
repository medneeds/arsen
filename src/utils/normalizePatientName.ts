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
/**
 * Núcleo da normalização, SEM colapsar espaços nem aparar as bordas.
 *
 * Existe separado por um motivo prático: aplicar `trim()` a cada tecla impede
 * digitar nome composto. Ao teclar o espaço de "JOAO SILVA", o valor momentâneo
 * é "JOAO " — o trim apaga o espaço e a letra seguinte cola no anterior,
 * produzindo "JOAOSILVA". Colar funcionava; digitar, não.
 */
function stripAccentsAndSpecials(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 -]/g, "")
    .toUpperCase();
}

/**
 * Para uso em `onChange`, enquanto o usuário digita.
 *
 * Tira acento, cedilha e caractere especial em tempo real — o usuário vê JOAO
 * ao digitar João — mas PRESERVA o espaço que ele acabou de teclar, inclusive
 * no fim do campo. Sem isso não se digita sobrenome.
 */
export function normalizePatientNameInput(value: string): string {
  if (!value) return value;
  // Colapsa apenas espaços internos repetidos; o espaço final é do usuário.
  return stripAccentsAndSpecials(value).replace(/ {2,}/g, " ").replace(/^ +/, "");
}

/**
 * Para uso na GRAVAÇÃO (submit, payload, RPC).
 *
 * Faz o mesmo e ainda apara as bordas: o que vai ao banco nunca tem espaço
 * sobrando. Continue usando esta no momento de salvar, mesmo que o campo já
 * use a versão de digitação.
 */
export function normalizePatientName(value: string): string {
  if (!value) return value;

  return stripAccentsAndSpecials(value).replace(/ {2,}/g, " ").trim();
}

/**
 * Campos de ENDEREÇO do prontuário (logradouro, bairro, cidade, UF).
 *
 * Tira acento e cedilha como nos nomes, mas PRESERVA a pontuação que estrutura
 * um endereço: vírgula, ponto, barra e o sinal de número. "RUA SÃO JOÃO, 123 -
 * APT. 4/B" precisa continuar legível; removê-la produziria "RUA SAO JOAO 123
 * APT 4B", que ninguém consegue conferir contra um documento.
 *
 * Use no `onChange` — preserva o espaço recém-teclado, como a versão de nome.
 */
export function normalizeAddressInput(value: string): string {
  if (!value) return value;
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ,.\-/º°nN]/g, "")
    .replace(/ {2,}/g, " ")
    .replace(/^ +/, "")
    .toUpperCase();
}

/** Versão de gravação do endereço: mesma limpeza e apara as bordas. */
export function normalizeAddress(value: string): string {
  if (!value) return value;
  return normalizeAddressInput(value).trim();
}
