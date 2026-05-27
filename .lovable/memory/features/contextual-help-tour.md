---
name: contextual-help-tour
description: Tour de ajuda contextual "?" canto inferior esquerdo (bottom-5 left-5) com overlay focused-tour escurecido em Prescrição/Evolução/Requisições; conteúdo didático em src/lib/helpTours.ts
type: feature
---
# Tour de Ajuda Contextual

## Arquivos
- `src/lib/helpTours.ts` — conteúdo dos tours por rota (didático, sem alucinação, reforça contratos como peso+alergias obrigatórios, MAV/Port.344, SOAP+CID, gasometria isolada, APAC autofill)
- `src/contexts/HelpTourContext.tsx` — provider mínimo (isOpen + currentStep + flag `help_tour_seen` em localStorage)
- `src/components/help/HelpTourButton.tsx` — botão circular 40px `fixed bottom-5 left-5 z-[60]`, slate-200/80, opacity 60→100, pontinho primário quando primeira vez, esconde se rota sem tour ou tour aberto
- `src/components/help/HelpTourOverlay.tsx` — modal centralizado com backdrop `bg-black/60 backdrop-blur-sm z-[9999]`, dots de progresso, Anterior/Próximo/Entendi, Esc/←/→ navegam, clique no backdrop NÃO fecha

## Rotas com tour ativo
- `/prescricao` (6 passos)
- `/evolucao` (5 passos)
- `/requisicoes`, `/requisicao/laboratorio`, `/requisicao/imagens`, `/requisicao/parecer` (5 passos — mesmo tour)

## Princípio
- Camada puramente de apresentação. Não toca dados, hooks, RLS, auditoria.
- Sem atalho de teclado (decisão de produto).
- Posição `bottom-5 left-5` é oposto à BatchActionBar (`bottom-5 right-5`) — zero colisão.
- `print:hidden` no botão para não vazar em impressão.
- Botão é montado globalmente em `App.tsx` dentro do `HelpTourProvider` (envolve toda a árvore após `TooltipProvider`).

## Como adicionar tour em nova rota
Editar apenas `src/lib/helpTours.ts`, adicionar nova chave em `TOURS` com `title`, `subtitle`, `steps[]`. Nenhuma outra mudança necessária.
