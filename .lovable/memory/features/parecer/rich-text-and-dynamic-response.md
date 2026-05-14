---
name: Parecer rich text + dynamic response area
description: Solicitação de parecer usa RichTextEditor (B/I/U/listas/parágrafos) com 3 limites (900/1600/2400) e a área de resposta manuscrita do parecerista encolhe automaticamente (78mm→60mm→45mm) p/ sempre caber em 1 página A4
type: feature
---
Aba **Solicitações > Parecer > Solicitar** (`src/pages/RequisicaoUnificadaPage.tsx`):
- Justificativa Clínica usa `RichTextEditor` (mesmo da Evolução): negrito, itálico, sublinhado, listas, Enter=parágrafo, Shift+Enter=br.
- Limites por caracteres-de-texto (`richHtmlToPlainText`):
  - SOFT 900 (verde) → resposta 78mm
  - MID 1600 (âmbar) → resposta 60mm + aviso
  - HARD 2400 (vermelho) → bloqueia digitação adicional
- Barra de progresso + chip dinâmico mostrando "Espaço de resposta do especialista: ~Xmm".
- Persistência: `clinical_indication` recebe HTML sanitizado (DOMPurify) só em parecer; outras categorias permanecem texto puro.

Impressão (`src/components/PrintableRequisitionGuide.tsx`):
- Detecta HTML via regex de tags permitidas; renderiza com `sanitizeRichHtmlPrint` (DOMPurify, mesmas tags do editor).
- `respHeightMm` e `justMaxMm` calculados pelo plain length para garantir 1 página A4.
- Estilos `.parecer-just p/ul/ol/li/strong/em/u` adicionados ao print.
- Pré-visualização do dialog também renderiza HTML quando detectado.
