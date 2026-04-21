---
name: AIH print layout standard
description: Layout oficial de impressão do Laudo de AIH (Autorização de Internação Hospitalar) seguindo o padrão visual da APAC — A4 retrato, página única, tabela unificada de 6 colunas com cabeçalho SUS horizontal.
type: design
---
O `AihFormDialog` gera o Laudo AIH em **uma única página A4 retrato**, replicando exatamente o padrão visual já adotado para a APAC (`mem://ui/print/apac-standard-layout`).

**Estrutura de impressão:**
- `.aih-root` com `width: 186mm; height: 273mm` para travar a página única.
- `@page { size: A4 portrait; margin: 12mm }`.
- Tabela `.aih-form` com `colgroup` de 6 colunas (16,66% cada) — diferente da APAC que tem 5.
- Cabeçalho horizontal: "SISTEMA ÚNICO DE SAÚDE — SUS · MINISTÉRIO DA SAÚDE" em 6,5pt, título "LAUDO PARA SOLICITAÇÃO DE AUTORIZAÇÃO DE INTERNAÇÃO HOSPITALAR" em 9pt bold.
- Faixas de seção (`.sec`) em fundo `#1e293b` com texto branco 7,5pt uppercase: Estabelecimento, Paciente, Justificativa, Procedimento, Causas Externas, Autorização.
- Labels (`.lbl`) 6,5pt cinza sobre células brancas; valores (`.val`) 8,5pt; mono (`.val-mono`) Courier 8,5pt para CNS, CID, código de procedimento, CRM/CPF.
- Áreas justificativas: `.just-cell-lg` (60px min) para sinais/sintomas; `.just-cell` (42px min) para condições e resultados — preenchem o restante da página sem quebrar.

**Sincronização de dados (auto-load ao abrir):**
- Carrega de `patients` → `patient_registry` (CNS, nascimento, sexo, mãe, telefone, endereço, cidade, prontuário).
- Fallback: `pre_admissions` por `patient_name`.
- Botões "Importar Admissão" (de `admission_histories`: queixa, história, hipótese, conduta) e "Importar Evolução" (de `patients`: diagnósticos, exames relevantes, antecedentes).
- Profissional pré-preenchido a partir de `profiles` do usuário logado (nome + CRM).

**Acesso:** Botão "Gerar Laudo AIH" dentro do `InternmentStatusDialog`, aparece quando `status` ∈ {PSM_FAVORAVEL, AGUARDANDO_VAGA, IR_PARA_ENFERMARIA, IR_PARA_UTI}.
