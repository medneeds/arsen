# Correção crítica: identidade nos cabeçalhos de PDF

## Problema raiz

Hoje cada gerador de PDF (admissão, evolução, prescrição, requisições, round) recebe o nome/leito/prontuário do paciente de uma fonte **diferente**:

- **Admissão** → já usa `usePatientIdentifiers` (corrigido).
- **Evolução** (`printEvolution`) → usa `evo.patient_name` (snapshot histórico gravado na linha) como fallback. Se o snapshot estiver errado (ex: paciente NI que herdou o nome de outro), o PDF imprime errado.
- **Prescrição extra** (`printExtraPrescription`) → recebe `patient.name/record` da página, sem garantir que vem do registry resolvido.
- **Requisições** (Imagens, Laboratório, Cultura, Hemocomponentes, Parecer, AIH, SAT) → cada diálogo monta o cabeçalho lendo direto de `patients` ou `patient_registry` por caminhos diferentes.
- **Round** (`printRound`) → idem, fonte ad-hoc.

Resultado: em UTI 2 (e potencialmente UCI 1/2, UCC, Enfermaria de Transição, Vascular, Neuro, etc.) o paciente "Não Identificado" aparece com o cabeçalho de outro paciente no PDF.

## Solução: fonte única + guarda anti-NI

### 1) `usePatientIdentifiers` — já corrigido, manter
Já bloqueia vínculo errado quando o paciente atual é NI mas o `patient_registry` vinculado é de identificado. Adicionar log diagnóstico opcional (sem alterar comportamento) para facilitar debug futuro.

### 2) Helper único `resolvePatientHeader(patientId, fallbackName, hospitalUnitId)`
Criar `src/lib/resolvePatientHeader.ts` — versão **imperativa** (Promise) do hook, para uso em handlers de impressão (que não podem usar hooks). Mesma lógica que `usePatientIdentifiers`, retornando:
```
{ name, socialName, prontuario, atendimento, cpf, cns, birthDate, sex,
  motherName, address, phone, bed, sector, age, isUnidentified, unidentifiedCode }
```
Inclui a **mesma guarda crítica** (`detectUnidentified` + `is_unidentified`).

### 3) Atualizar todos os geradores de PDF para usar o helper

| Arquivo | Mudança |
|---|---|
| `src/components/evolution/EvolutionTimeline.tsx` (handler do botão Imprimir) | Resolver via helper antes de chamar `printEvolution`; nunca usar `evo.patient_name` direto. |
| `src/lib/printEvolution.ts` | Cabeçalho recebe `prontuario`, `atendimento`, `socialName`, `cpf`, `cns` (mesmo padrão do `printAdmission`). |
| `src/pages/PrescricaoPage.tsx` (chamada `printExtraPrescription`) | Resolver via helper; passar nome do registry. |
| `src/lib/printExtraPrescription.ts` | Cabeçalho passa a incluir `prontuario` + `atendimento` + nome social (atualmente só nome/leito/record). |
| `src/components/PrintableRequisitionGuide.tsx` | Resolver via helper para todos os tipos (Imagens, Lab, Cultura, Hemocomp, Parecer). |
| `src/components/AihFormDialog.tsx`, `CultureRequestDialog.tsx`, `SatRequestDialog.tsx`, `HemocomponentRequestDialog.tsx` | Substituir leitura ad-hoc por `resolvePatientHeader`. |
| `src/lib/printRound.ts` + `PatientRoundPrintDialog`, `RoundSectorPrintDialog` | Idem. |

### 4) Validação manual obrigatória após a mudança
Validar com paciente NI em **UTI 2 leito 10** + 1 paciente identificado em cada um dos setores: UCI 1, UCI 2, UCC, Enfermaria de Transição, Vascular, Neuro 01/02, Clínica Cirúrgica.

## Detalhes técnicos

- O helper compartilha o código com o hook (extrair função pura `fetchPatientIdentifiersOnce` e o hook chama ela internamente — zero divergência).
- Nenhuma migration; é só código frontend/lib.
- Sem mudança de layout de PDF: apenas troca de **fonte de dados** dos campos já existentes nos cabeçalhos. Onde adicionarmos `prontuario/atendimento` (Evolução, Prescrição), o impacto visual é uma linha a mais no cabeçalho.

## Fora de escopo

- Não vou repintar nem reorganizar os PDFs.
- Não vou alterar o cabeçalho do cockpit (já corrigido).
- Não vou mexer em SAPS 3 nem no fluxo de admissão (já corrigidos).

## Confirmar antes de executar

1. Posso adicionar `Prontuário` + `Atendimento` no cabeçalho do PDF de **evolução** e **prescrição extra** (hoje não têm)? Isso é uma alteração visual pequena.
2. Confirma que quer cobrir **todos** os geradores listados na tabela acima?
