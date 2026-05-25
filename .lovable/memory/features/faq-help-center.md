---
name: faq-help-center
description: Central de Dúvidas Frequentes (/ajuda) com 9 guias didáticos em slides navegáveis (setas/dots/swipe/teclado); botão na sidebar acima do toggle de tema
type: feature
---
# FAQ / Central de Ajuda

## Rota
- **`/ajuda`** (rota dedicada, dentro de `MainLayout`) — `src/pages/AjudaPage.tsx`
- Acessível via botão **"Dúvidas Frequentes"** na sidebar, **acima** do toggle de tema (rodapé), com ícone `HelpCircle`.

## Estrutura
- **`src/data/faqContent.ts`** — fonte única dos FAQs. 9 entradas (`FAQ_ENTRIES`), cada uma com `id`, `title`, `short`, `icon`, `tone`, `slides[]`.
- **`src/components/help/HelpSlideshowDialog.tsx`** — Dialog com slides navegáveis (setas + dots + swipe touch + setas do teclado), botão "Entendi" no último slide.
- **`src/components/help/FaqVisualBlock.tsx`** — Renderiza "telas sintéticas" temáticas (bedCard, menuActions, cockpitTabs, dialog, panelVsMap, statusLegend, stepFlow) reproduzindo padrões visuais reais da plataforma — não usa screenshots estáticos, então não envelhece com mudanças de UI.

## FAQs ativos (foco médico)
1. Mapa de Leitos × Painel Clínico
2. Como desalocar um paciente corretamente
3. Como remanejar dentro do mesmo setor (vago ou permuta)
4. Transferência interna entre setores (preserva prontuário; UTI/UCI 2 dispara SAPS 3)
5. Como sinalizar alta ou óbito
6. Como suspender uma alta já sinalizada
7. Paciente sem documentos (NI / NI+PIN / promoção)
8. Como editar dados do paciente (motivo obrigatório + auditoria)
9. Cores e ícones do card do paciente (gravidade, status, tarjas, cadeado de setor)

## Princípio
Reforça o contrato **PAINEL sinaliza / MAPA desaloca** e blinda o usuário contra rotas operacionais ambíguas.
