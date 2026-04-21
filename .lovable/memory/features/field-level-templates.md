---
name: Field-level templates
description: Modelos de texto por campo, escopo do usuário (com opção de compartilhar), aplicáveis em Evolução e demais formulários. Tabela field_text_templates + hook useFieldTemplates + componente <FieldTemplates scope=... />.
type: feature
---
Cada textarea/input de prontuário pode oferecer modelos personalizáveis por usuário, inseridos diretamente no campo via popover compacto (ícone de bookmark ao lado do label).

**Tabela:** `public.field_text_templates`
- `scope` (text): identificador único do campo, ex.: `evolution.subjective`, `evolution.assessment`, `evolution.plan`, `evolution.objective.complementares`, `evolution.objective.exam.cardiovascular`.
- `user_id` (FK auth.users): dono.
- `name`, `body`: rótulo + conteúdo.
- `is_shared` (bool): quando true, todos os usuários autenticados veem o modelo.
- `use_count`, `last_used_at`: métricas de uso (ordenação por mais usados).

**RLS:** SELECT — próprio OU `is_shared = true`. INSERT/UPDATE/DELETE — somente dono.

**Componente:** `<FieldTemplates scope currentValue onApply hospitalUnitId />`
- Popover com 2 abas: **Inserir** (lista ordenada por uso, ações Substituir/Anexar/Excluir) e **Novo** (nome + corpo + toggle compartilhar).
- Botão "Salvar atual" copia o conteúdo presente do campo para a aba Novo.
- Modo "Anexar" concatena com `\n` ao texto existente; "Substituir" troca tudo.

**Integrado em:** `EvolutionForm.tsx` — Subjetivo, cada sistema do Exame Físico, Complementares, Avaliação, Plano. Pronto para reuso em Admissão, Plano Terapêutico e demais formulários longitudinais.
