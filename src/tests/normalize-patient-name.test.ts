/**
 * Normalização de nomes cadastrais.
 *
 * O caso que motivou estes testes: a normalização era aplicada no onChange com
 * `trim()` embutido. Ao teclar o espaço de "JOAO SILVA", o valor momentâneo era
 * "JOAO " — o trim apagava o espaço e a próxima letra colava no anterior. O
 * resultado de digitar "João Gonçalves" era "JOAOGONCALVES". Colar funcionava;
 * digitar, não. Nenhum nome composto era cadastrável pelo teclado.
 */
import { test } from "node:test";
import assert from "node:assert";
import {
  normalizePatientName,
  normalizePatientNameInput,
  normalizeAddress,
  normalizeAddressInput,
} from "@/utils/normalizePatientName";

/** Simula digitação tecla a tecla, como o onChange recebe. */
const digitar = (texto: string) =>
  texto.split("").reduce((campo, tecla) => normalizePatientNameInput(campo + tecla), "");

test("nome composto sobrevive à digitação tecla a tecla", () => {
  assert.strictEqual(digitar("João Gonçalves da Conceição"), "JOAO GONCALVES DA CONCEICAO");
  assert.strictEqual(digitar("Ana Maria"), "ANA MARIA");
});

test("o espaço recém-teclado é preservado — sem ele não há sobrenome", () => {
  assert.strictEqual(normalizePatientNameInput("JOAO "), "JOAO ");
});

test("acento, til e cedilha somem em tempo real", () => {
  assert.strictEqual(normalizePatientNameInput("João"), "JOAO");
  assert.strictEqual(normalizePatientNameInput("Conceição"), "CONCEICAO");
  assert.strictEqual(normalizePatientNameInput("Ç"), "C");
  assert.strictEqual(normalizePatientNameInput("José Antônio"), "JOSE ANTONIO");
});

test("caractere especial é bloqueado, hífen e número permanecem", () => {
  assert.strictEqual(normalizePatientNameInput("Maria D'Ávila"), "MARIA DAVILA");
  assert.strictEqual(normalizePatientNameInput("Ana-Clara"), "ANA-CLARA");
  assert.strictEqual(normalizePatientNameInput("Joao Neto 2"), "JOAO NETO 2");
  assert.strictEqual(normalizePatientNameInput("Jo@o #1 $"), "JOO 1 ");
});

test("espaço inicial não é aceito; espaço interno duplicado é colapsado", () => {
  assert.strictEqual(normalizePatientNameInput("  Joao"), "JOAO");
  assert.strictEqual(normalizePatientNameInput("Joao   Silva"), "JOAO SILVA");
});

test("a versão de gravação apara as bordas — banco nunca recebe espaço solto", () => {
  assert.strictEqual(normalizePatientName("JOAO SILVA "), "JOAO SILVA");
  assert.strictEqual(normalizePatientName(" João  Gonçalves "), "JOAO GONCALVES");
});

test("valor vazio ou nulo atravessa sem quebrar", () => {
  assert.strictEqual(normalizePatientNameInput(""), "");
  assert.strictEqual(normalizePatientName(""), "");
});

// ── Endereço ────────────────────────────────────────────────────────────────

const digitarEndereco = (texto: string) =>
  texto.split("").reduce((campo, tecla) => normalizeAddressInput(campo + tecla), "");

test("endereço perde acento e cedilha, como os nomes", () => {
  assert.strictEqual(normalizeAddressInput("São João"), "SAO JOAO");
  assert.strictEqual(normalizeAddressInput("Conceição"), "CONCEICAO");
});

test("endereço PRESERVA a pontuação que o estrutura", () => {
  // Sem vírgula, ponto e barra o endereço fica impossível de conferir contra
  // um documento: "RUA SAO JOAO 123 APT 4B".
  assert.strictEqual(
    normalizeAddressInput("Rua São João, 123 - Apt. 4/B"),
    "RUA SAO JOAO, 123 - APT. 4/B",
  );
  // "nº" e abreviacao corrente de numero em endereco: o simbolo permanece.
  assert.strictEqual(normalizeAddressInput("Av. Getúlio Vargas nº 500"), "AV. GETULIO VARGAS Nº 500");
});

test("endereço bloqueia caractere realmente especial", () => {
  // O espaco que sobra da remocao e colapsado junto.
  assert.strictEqual(normalizeAddressInput("Rua X @#$% 10"), "RUA X 10");
});

test("endereço composto sobrevive à digitação tecla a tecla", () => {
  assert.strictEqual(digitarEndereco("Rua São Luís, 45"), "RUA SAO LUIS, 45");
});

test("a versão de gravação do endereço apara as bordas", () => {
  assert.strictEqual(normalizeAddress("  Rua São João, 12  "), "RUA SAO JOAO, 12");
});
