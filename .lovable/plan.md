# Plano — Fluxo MAV/Psicotrópicos (Autocomplete + Auto-fill + Pop-up)

## Resumo executivo

1. Migration que adiciona `nome_comercial`, `lista` (enum 344/98) e `notification_type` ao `medication_catalog` + colunas `pharmaceutical_form`, `concentration`, `default_route`, `default_dose` em `medication_presentations` para mapear 1:1 com a Portaria 344/98.
2. Refatorar campo "Medicamento" do `PsychotropicFormDialog` para Combobox alimentado pelo catálogo (controlled OR high_alert), com NFD, autopreenchimento e bloqueio quando vier da prescrição.
3. Manter `printGuidesOpen` atual (prescrição + ATM + Psy) e reforçar:
   - Só oferece Guia Psicotrópicos se houver item `controlled = true`
   - Fluxo `print → afterprint → abrir PsychotropicFormDialog` em modo `print_direct`
   - Bloqueio de assinatura/impressão quando item controlled está sem `tipo_notificacao`

## Mudanças no banco (migration única)

```text
ALTER medication_catalog
  ADD nome_comercial text,
  ADD lista text CHECK (lista IN ('A1','A2','A3','B1','B2','C1','C2','C3','C4','C5')),
  ADD notification_type text CHECK (notification_type IN
       ('Receita Amarela','Receita Azul','Controle Especial 2 vias'));

ALTER medication_presentations
  ADD pharmaceutical_form text,   -- alias semântico (preserva form)
  ADD default_route text,
  ADD default_dose  text;

-- Backfill automático no próprio migration:
--  nome_comercial   ← generic_name quando NULL
--  default_route    ← route
--  pharmaceutical_form ← form
--  notification_type derivado:
--    pharmacological_group ~* 'entorpecente' OR lista IN ('A1','A2') → Receita Amarela
--    pharmacological_group ~* 'psicotr[oó]pico' OR lista IN ('B1','B2') → Receita Azul
--    lista = 'C1' → Controle Especial 2 vias
--    controlled=true sem grupo → Controle Especial 2 vias (fallback)
--    high_alert=true AND controlled=false → NULL

-- Índice para busca:
CREATE INDEX medication_catalog_search_idx
  ON medication_catalog
  USING gin (to_tsvector('simple', unaccent(generic_name||' '||coalesce(nome_comercial,''))));
```

Sem alteração em RLS (políticas existentes cobrem).

## Frontend

### A) `useUnifiedMedicationCatalog`
- Estender `CatalogRow` com `nome_comercial`, `lista`, `notification_type`.
- Estender `PresentationRow` com `pharmaceutical_form`, `default_route`, `default_dose`.
- Propagar esses campos em `MedicationEntry` (campos opcionais novos).
- Expor helper `getControlledItems()` → filtra `controlled || high_alert` já com label `nome (princípio) — concentração`.

### B) `PsychotropicFormDialog.tsx`
1. Substituir `<Input>` do campo Medicamento por `Command`/`Combobox` (shadcn) alimentado por `getControlledItems()`.
   - Busca NFD em `generic_name + nome_comercial`.
   - Mínimo 2 caracteres.
   - Sem texto livre. Vazio → "Medicamento não encontrado no catálogo. Contate a farmácia para cadastro."
   - Opção da lista: `nome_comercial (generic_name) — concentração`.
2. Ao selecionar item, autopreencher `pharmaceuticalForm`, `concentration`, `route`, `dose`, `notificationType` (do catálogo; fallback `detectNotificationType`).
3. Itens vindos de `controlledItems` (prop) entram já preenchidos com badge "Da prescrição" e Combobox em `readOnly`. Demais campos editáveis com ícone ✨ "autopreenchido" que some no primeiro `onChange`.
4. `notificationType` agora suporta `'Receita Amarela' | 'Receita Azul' | 'Controle Especial 2 vias'` (mantém compat com 'A','B','B2','C1' via mapper).
5. Modo novo `mode?: 'edit' | 'print_direct'`: quando `print_direct`, esconde inputs auxiliares e destaca botão "Imprimir Guia"; usa CSS `.print-only-guide` com `@media print` em vez do hack atual.
6. Agrupamento na impressão: itens agrupados por `notification_type` em páginas separadas (Amarela / Azul / Especial), cabeçalho próprio por grupo.

### C) `PrescricaoPage.tsx`
1. Em `handlePrint` (linha 3817) manter o diálogo, mas:
   - `hasActivePsy` passa a ser `items.some(i => i.status==='active' && i.controlled === true)` (lookup pelo catálogo via `useUnifiedMedicationCatalog`).
   - Item high_alert sem controlled NÃO dispara guia (apenas alerta interno).
2. Em `executePrintSelection`, no ramo Psy: chamar `window.print()` e usar `window.addEventListener('afterprint', ...)` (com fallback `setTimeout(800)`) antes de abrir `setPsychotropicFormOpen(true)` em `mode='print_direct'`.
3. Bloquear botão "Assinar/Imprimir" se existir item `controlled=true` cujo `notification_type` resolvido seja `null` → `toast.error("Defina o tipo de notificação do medicamento controlado antes de imprimir")`.

### D) Restrições respeitadas
- Não toca layout/dimensão da página de prescrição.
- Só edita `PsychotropicFormDialog`, `useUnifiedMedicationCatalog`, `handlePrint`/`executePrintSelection` e o lookup de "controlled".
- Sem impressão automática sem clique do usuário.

## Ordem de execução
1. Migration (banco) — aprovar primeiro.
2. Atualizar `useUnifiedMedicationCatalog`.
3. Refatorar `PsychotropicFormDialog` (combobox, autofill, modo print_direct, agrupamento).
4. Ajustar `handlePrint`/`executePrintSelection` + bloqueio de assinatura.
5. Verificar build e testar fluxo end-to-end no `/prescricao` atual.

## Pontos de atenção
- Backfill do `notification_type` é heurístico; itens HMDM 2026 sem `pharmacological_group` claro caem em "Controle Especial 2 vias". Farmácia poderá refinar via tela de catálogo depois.
- `nome_comercial` começa = `generic_name`; importação real virá em sprint separado.
