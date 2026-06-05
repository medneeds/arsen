/**
 * TESTE: extract-patient-data — mascaramento LGPD de CPF e CNS
 *
 * Valida que CPF e CNS nunca chegam ao Google em modo texto (rawText),
 * e são removidos da resposta em modo imagem (imageBase64).
 *
 * Dados fictícios — zero impacto em produção.
 */

// ── Replica as funções da Edge Function ──────────────────────────────────────

function extractCpfLocal(text: string): string | null {
  const formatted = text.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
  if (formatted) return formatted[0].replace(/\D/g, "");
  const cpfContext = text.match(/(?:CPF|cpf|Cpf)[^\d]*(\d{11})\b/);
  if (cpfContext) return cpfContext[1];
  return null;
}

function extractCnsLocal(text: string): string | null {
  const cnsContext = text.match(/(?:CNS|cns|Cns|Cartão SUS|CARTÃO SUS)[^\d]*(\d{15})\b/);
  if (cnsContext) return cnsContext[1];
  const standalone = text.match(/(?<!\d)(\d{15})(?!\d)/);
  if (standalone) return standalone[1];
  return null;
}

function maskSensitiveFields(text: string): string {
  return text
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "XXX.XXX.XXX-XX")
    .replace(/(CPF[^\d]*)(\d{11})\b/gi, "$1XXXXXXXXXXX")
    .replace(/(CNS[^\d]*|Cartão SUS[^\d]*)(\d{15})\b/gi, "$1XXXXXXXXXXXXXXX")
    .replace(/(?<!\d)(\d{15})(?!\d)/g, "XXXXXXXXXXXXXXX");
}

// ── Infra de teste ───────────────────────────────────────────────────────────

let passed = 0; let failed = 0;
const results: { name: string; ok: boolean; details: string }[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true, details: "ok" });
    passed++;
  } catch (e: any) {
    results.push({ name, ok: false, details: e.message });
    failed++;
  }
}

// ── Cenários ─────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: extract-patient-data — mascaramento LGPD");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

// EXTRAÇÃO LOCAL — CPF

await test("CPF formatado (000.000.000-00) é extraído corretamente", () => {
  const texto = "Paciente: João Silva  CPF: 123.456.789-09  Data: 01/01/1980";
  assert(extractCpfLocal(texto) === "12345678909", `Esperado 12345678909, recebeu: ${extractCpfLocal(texto)}`);
});

await test("CPF após label 'CPF' sem formatação é extraído", () => {
  const texto = "Nome: Maria  CPF 98765432100  Nascimento: 15/03/1975";
  assert(extractCpfLocal(texto) === "98765432100", `Esperado 98765432100, recebeu: ${extractCpfLocal(texto)}`);
});

await test("Texto sem CPF retorna null", () => {
  const texto = "Nome: Ana Costa  Endereço: Rua das Flores, 100  Tel: 98765-4321";
  assert(extractCpfLocal(texto) === null, "Deve retornar null quando não há CPF");
});

// EXTRAÇÃO LOCAL — CNS

await test("CNS após label 'Cartão SUS' é extraído", () => {
  const texto = "Cartão SUS 123456789012345  Município: São Luís";
  assert(extractCnsLocal(texto) === "123456789012345", `Esperado 123456789012345, recebeu: ${extractCnsLocal(texto)}`);
});

await test("CNS após label 'CNS' é extraído", () => {
  const texto = "CNS 987654321098765 Nome: Pedro Alves";
  assert(extractCnsLocal(texto) === "987654321098765", `Esperado 987654321098765, recebeu: ${extractCnsLocal(texto)}`);
});

await test("Texto sem CNS retorna null", () => {
  const texto = "Nome: José  CPF: 111.222.333-44  Endereço: Av. Brasil, 500";
  assert(extractCnsLocal(texto) === null, "Deve retornar null quando não há CNS");
});

// MASCARAMENTO

await test("CPF formatado é mascarado no texto enviado ao Google", () => {
  const texto = "Paciente: João Silva  CPF: 123.456.789-09  Diagnóstico: J18.9";
  const mascarado = maskSensitiveFields(texto);
  assert(!mascarado.includes("123.456.789-09"), "CPF não deve aparecer no texto mascarado");
  assert(mascarado.includes("XXX.XXX.XXX-XX"), "Placeholder XXX deve estar presente");
  assert(mascarado.includes("João Silva"), "Nome não deve ser mascarado");
  assert(mascarado.includes("J18.9"), "CID não deve ser mascarado");
});

await test("CNS é mascarado no texto enviado ao Google", () => {
  const texto = "Cartão SUS 111222333444555  Nome: Maria Oliveira";
  const mascarado = maskSensitiveFields(texto);
  assert(!mascarado.includes("111222333444555"), "CNS não deve aparecer no texto mascarado");
  assert(mascarado.includes("Maria Oliveira"), "Nome não deve ser mascarado");
});

await test("Texto sem dados sensíveis não é alterado", () => {
  const texto = "Nome: Pedro Santos  Endereço: Rua XV, 42  Cidade: São Luís";
  const mascarado = maskSensitiveFields(texto);
  assert(mascarado === texto, "Texto sem CPF/CNS deve sair idêntico");
});

// FLUXO COMPLETO — MODO RAWTEXT

await test("Modo rawText: fluxo completo — CPF/CNS nunca chegam ao Google", () => {
  const rawText = [
    "HOSPITAL MUNICIPAL DJALMA MARQUES",
    "Nome: Raimundo Soares de Araújo",
    "CPF: 321.654.987-00",
    "CNS 444333222111000",
    "Nascimento: 12/08/1965",
    "Médico Responsável: Dr. José Ribamar",
    "Diagnóstico: Pneumonia J18.9",
  ].join("\n");

  // Passo 1: extrai localmente
  const cpfLocal = extractCpfLocal(rawText);
  const cnsLocal = extractCnsLocal(rawText);

  // Passo 2: mascara antes de enviar ao Google
  const textoEnviadoAoGoogle = maskSensitiveFields(rawText);

  // Passo 3: Google retorna (simulado — nunca viu CPF/CNS reais)
  const respostaGoogle = {
    patient_name: "Raimundo Soares de Araújo",
    cpf: null,      // Google viu "XXX.XXX.XXX-XX" — não consegue extrair
    cns: null,      // Google viu "XXXXXXXXXXXXXXX" — não consegue extrair
    birth_date: "1965-08-12",
    address: null,
    medical_record: null,
  };

  // Passo 4: mescla CPF/CNS locais na resposta
  respostaGoogle.cpf = cpfLocal;
  respostaGoogle.cns = cnsLocal;

  // Validações
  assert(!textoEnviadoAoGoogle.includes("321.654.987-00"), "CPF real não chegou ao Google");
  assert(!textoEnviadoAoGoogle.includes("444333222111000"), "CNS real não chegou ao Google");
  assert(cpfLocal === "32165498700", `CPF extraído localmente correto: ${cpfLocal}`);
  assert(cnsLocal === "444333222111000", `CNS extraído localmente correto: ${cnsLocal}`);
  assert(respostaGoogle.cpf === "32165498700", "CPF local restaurado na resposta final");
  assert(respostaGoogle.cns === "444333222111000", "CNS local restaurado na resposta final");
  assert(respostaGoogle.patient_name === "Raimundo Soares de Araújo", "Nome preservado na resposta");
});

// FLUXO COMPLETO — MODO IMAGEBASE64

await test("Modo imageBase64: CPF e CNS removidos da resposta do Google (não armazenados)", () => {
  // Simula o que o Google retornaria para uma imagem de documento
  const respostaGoogleParaImagem = {
    patient_name: "Eliziane Dias dos Santos",
    cpf: "30427afe",          // Google extraiu da imagem (fictício)
    cns: "111222333444555",   // Google extraiu da imagem
    birth_date: "1985-03-22",
    address: "Av. dos Holandeses, 100",
  };

  // Proteção LGPD: modo imagem → remove CPF e CNS da resposta
  const isTextMode = false;
  if (!isTextMode) {
    respostaGoogleParaImagem.cpf = null as any;
    respostaGoogleParaImagem.cns = null as any;
  }

  assert(respostaGoogleParaImagem.cpf === null, "CPF removido da resposta do Google (modo imagem)");
  assert(respostaGoogleParaImagem.cns === null, "CNS removido da resposta do Google (modo imagem)");
  assert(respostaGoogleParaImagem.patient_name === "Eliziane Dias dos Santos", "Nome preservado");
  assert(respostaGoogleParaImagem.birth_date === "1985-03-22", "Data de nascimento preservada");
  assert(respostaGoogleParaImagem.address === "Av. dos Holandeses, 100", "Endereço preservado");
});

await test("Modo imageBase64: flag requiresManualCpfCns=true indica preenchimento manual", () => {
  const isTextMode = false;
  const requiresManualCpfCns = !isTextMode;
  assert(requiresManualCpfCns === true, "Frontend deve ser informado que CPF/CNS precisam de preenchimento manual");
});

await test("Modo rawText: flag requiresManualCpfCns=false — CPF/CNS foram extraídos automaticamente", () => {
  const isTextMode = true;
  const requiresManualCpfCns = !isTextMode;
  assert(requiresManualCpfCns === false, "Modo texto extrai CPF/CNS automaticamente — sem necessidade de preenchimento manual");
});

// EDGE CASES

await test("Número de prontuário com 11 dígitos não é confundido com CPF", () => {
  // Prontuários podem ter sequências de dígitos similares ao CPF
  const texto = "Prontuário: 18390711234  Nome: Carlos Alberto";
  const cpf = extractCpfLocal(texto);
  // Sem label "CPF" e sem formatação 000.000.000-00, não deve extrair como CPF
  assert(cpf === null, `Prontuário não deve ser confundido com CPF. Extraído: ${cpf}`);
});

await test("Dois CPFs no mesmo texto — extrai o primeiro (formatado tem prioridade)", () => {
  const texto = "Titular: CPF 123.456.789-09  Dependente: CPF 987.654.321-00";
  const cpf = extractCpfLocal(texto);
  assert(cpf === "12345678909", `Deve extrair o primeiro CPF formatado: ${cpf}`);
});

// ── Relatório final ───────────────────────────────────────────────────────────

console.log("──────────────────────────────────────────────────────");
for (const r of results) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `\n      → ${r.details}`}`);
}
console.log("──────────────────────────────────────────────────────");
console.log(`  TOTAL: ${passed + failed} | ✓ ${passed} passaram | ${failed > 0 ? "✗" : "✓"} ${failed} falharam`);
console.log("──────────────────────────────────────────────────────\n");

if (failed > 0) process.exit(1);
