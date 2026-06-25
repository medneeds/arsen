## Objetivo

Adicionar **drag and drop** nos itens de **Plano Terapêutico** e **Programações e Pendências** dentro da Evolução de Rotina, com renumeração automática, persistência da nova ordem e sem quebrar o espelhamento em PDF/preview.

## Achados da investigação

- Componente único `src/components/ItemListEditor.tsx` já gerencia ambas as listas (planItems e pendenciasItems) com botões ▲▼ atualmente ocultos (`showReorder={false}`).
- Numeração já é dinâmica (`{i + 1}.` na UI, `<ol>` no preview, `${i+1}` no `printEvolution.ts`) — basta reordenar o array, a numeração se ajusta sozinha.
- Auto-save em `EvolutionForm.tsx` (linha 220) já observa `planItems`/`pendenciasItems` — qualquer reordenação dispara o save sem mudança adicional.
- `printEvolution.ts` (linhas 312–326) itera `planItemsArr`/`pendArr` na ordem do array → PDF segue a nova ordem automaticamente.
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` já estão instalados.

## O que será feito

### 1. `src/components/ItemListEditor.tsx` — adicionar suporte a drag

- Nova prop opcional **`draggable?: boolean`** (default `false`, opt-in para não afetar outros usos como Antecedentes/Hipóteses).
- Quando `draggable=true`:
  - Envolve a lista em `DndContext` + `SortableContext` (`verticalListSortingStrategy`).
  - Cada linha vira um `SortableItem` interno com `useSortable`, expondo um **handle visível** (ícone `GripVertical`) à esquerda do número — só pelo handle (não pelo input inteiro) para não conflitar com seleção de texto e digitação.
  - Sensores: `PointerSensor` com `activationConstraint: { distance: 4 }` (evita drag acidental ao clicar) + `KeyboardSensor` (acessibilidade — Space/Enter pega, setas movem).
  - `onDragEnd`: calcula novo array com `arrayMove(items, oldIndex, newIndex)` e chama `onChange(next)` — mesma rota dos botões ▲▼, então auto-save dispara normalmente.
  - Mantém botões ▲▼ ocultos quando `draggable=true` (substituídos pelo handle visual).
  - `id` estável por item: gera UUID-like em ref por linha (não usar índice como id no SortableContext, senão quebra animação).

### 2. `src/components/evolution/EvolutionForm.tsx` — ativar nas 2 listas

- Linha ~565 (Plano Terapêutico): `<ItemListEditor ... draggable />`
- Linha ~596 (Programações e Pendências): `<ItemListEditor ... draggable />`
- Atualiza o hint do Plano: "Arraste pelo ⋮⋮ para reordenar — a numeração se ajusta automaticamente."

### 3. Garantias de não-regressão (PDF / preview / save)

- **Preview embutido** (linhas 970–999 do EvolutionForm) já usa `<ol>` → segue ordem.
- **printEvolution.ts** já usa `map((item, i) => i+1)` → segue ordem.
- **Auto-save** em `useEffect` já observa as dependências corretas → reordenar grava.
- **Schema de dados não muda** — continua `planItems: string[]` / `pendenciasItems: string[]`. Sem migration.

## Camadas tocadas

- **Layout**: `ItemListEditor.tsx` ganha handle visual de drag. Visual sutil (`GripVertical` 12px, opacity em hover, cursor-grab). Não muda altura da linha nem espaçamento existente.
- **Dados**: nenhum schema novo; a ordem do array já é a fonte de verdade.

## Camadas NÃO tocadas

- `printEvolution.ts`, `EvolutionPage.tsx`, hooks (`useEvolutions`).
- Outras instâncias de `ItemListEditor` (Hipóteses, Antecedentes em `DiagnosticsPanel`) — continuam com botões ▲▼ pois não receberão `draggable`.
- Movimentação / Auditoria / Migrations.

## Detalhes técnicos para o usuário não-técnico

- Você vai ver um **ícone de "alça" (⋮⋮)** discreto à esquerda de cada item. Segura ele e arrasta para cima ou para baixo. O número (1., 2., 3....) se recalcula sozinho e a nova ordem é salva no próximo auto-save (mesmo timing de uma edição de texto). O PDF impresso reflete a ordem da tela.
- Drag só dispara depois de mover 4px — clicar para editar continua funcionando normalmente.

## Risco / mitigação

- **Risco**: alguém arrastar enquanto digita. **Mitigação**: handle dedicado, drag só pelo ícone, distance:4px de ativação.
- **Risco**: id duplicado no SortableContext se item vazio. **Mitigação**: id estável por linha gerado uma vez (ref de uuids paralelos ao array).