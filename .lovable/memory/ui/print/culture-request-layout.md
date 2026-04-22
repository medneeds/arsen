---
name: culture-request-layout
description: Solicitação de Exame Microbiológico segue layout hospitalar tabular único (espelho do formulário oficial), separado do guia padrão Norma Zero
type: design
---
- Componente dedicado: `src/components/PrintableCultureRequest.tsx` (preview React + `printCultureRequest` para popup).
- Estrutura: NormaZeroPrintHeader (mantém branding ativo) + título "SOLICITAÇÃO DE EXAME MICROBIOLÓGICO" + tabela única estilo formulário com bordas pretas finas e label/valor em cada linha.
- Seções: Identificação (nome, social, nascimento, CNS, CPF, prontuário, setor/leito) → Dados da mãe (sempre exibida com nota "Se paciente menor de 18 anos") → Antecedentes (internado 30d, ATB 24h com fill-in) → Exames Solicitados (profilático/terapêutico + checklist vertical de 8 culturas com campo "amostras" para hemoculturas) → Justificativa Clínica (opcional) → Data + Assinatura → Observação importante (rodapé itálico).
- Catálogo fixo (espelhando o formulário oficial): Hemocultura aeróbios/anaeróbios/fungos, Urocultura, Secreção, Fragmento, SWAB, Outros.
- Roteamento automático em `PrintableRequisitionGuide` e `printRequisitionGuide`: se ≥60% dos itens batem com keywords ["cultura","hemocultura","urocultura","antibiograma","swab","secre"], renderiza/imprime o layout dedicado em vez do guia genérico Norma Zero.
- Código do documento: prefixo `REQ-CULT`.
