---
name: culture-request-layout
description: Solicitação de Exame Microbiológico — formulário tabular único Norma Zero + dialog otimizado de preenchimento (CultureRequestDialog)
type: design
---
- **Componentes**:
  - `src/components/PrintableCultureRequest.tsx` — preview React + `printCultureRequest` (popup A4).
  - `src/components/CultureRequestDialog.tsx` — dialog otimizado (3 abas: Paciente, Antecedentes, Culturas) com pré-visualização espelhada do formulário oficial e persistência em `exam_requests` (category `cultura`).
- **Estrutura impressão**: NormaZeroPrintHeader + título "SOLICITAÇÃO DE EXAME MICROBIOLÓGICO" + tabela única estilo formulário (bordas pretas finas, label/valor por linha).
- **Seções**: Identificação → Dados da mãe (sempre exibida com nota "se menor de 18 anos") → Antecedentes (internado 30d, ATB 24h com fill-in) → Exames Solicitados (profilático/terapêutico + checklist vertical de 8 culturas com campo "amostras" para hemoculturas) → Justificativa Clínica (opcional) → Data + Assinatura → Observação importante (rodapé itálico).
- **Catálogo fixo**: Hemocultura aeróbios/anaeróbios/fungos, Urocultura, Secreção, Fragmento, SWAB, Outros.
- **Roteamento automático**: `PrintableRequisitionGuide` e `printRequisitionGuide` detectam ≥60% de keywords ["cultura","hemocultura","urocultura","antibiograma","swab","secre"] e renderizam o layout dedicado.
- **Entry points do dialog**: `/requisicoes` (Especiais → Cultura) | `/documentos` (CTA Cultura) | URL `?especial=cultura` abre direto o dialog. Pré-carrega paciente + médico solicitante.
- **Sincronização Cockpit**: `usePatientSpecialRequests` inclui `category=cultura` em `exam_requests` (além de `culture_results` para resultados). Realtime via canal `patient-special-{hospital}-{patient}`.
- **Código do documento**: prefixo `REQ-CULT`. Salvo com status `pending` e priority `rotina`.
