## Diagnóstico

### 1) Insulina EV contínua — não habilita validação
Em `PrescricaoPage.tsx › getItemMissingFields`, a categoria padrão deriva `ptype` por `inferPresentationType` e, quando cai em `iv_continuous`, exige **diluente + volume total + tempo ou vazão** como campos estruturados.

O item criado pelo `InsulinTherapyDialog` (linhas ~10195-10210) preenche apenas:
- `route='Intravenosa'`, `posology='BIC'`, `schedule='contínuo'`
- `instructions` ← `describeInsulinPlan(plan)` (já contém "100 UI Regular em 100 mL SF 0,9% (1 UI/mL) em BIC" + dose U/h)
- `insulinPlan` (objeto completo com `ivConcentration`, `ivStartRate`, etc.)

Não preenche `diluent` / `volumeTotal` / `infusionRate` estruturados → o checklist vermelho aponta 3 pendências e impede validação, mesmo com o plano completo descrito.

### 2) "Cursor/clique não aceita edição em alguns dispositivos"
O `SortablePrescriptionItemRow` aplica `PointerSensor { distance: 5 }` no contexto raiz (linha 3363). Os listeners de drag estão escopados às alças `GripVertical` (`touch-none`), o que é correto. Mas em alguns notebooks com trackpad sensível / touchscreen híbrido, o clique inicial sobre o handle e um micro-arrasto involuntário acabam capturando o ponteiro e o `Input`/`Textarea` adjacente não recebe foco no clique seguinte. Mais relevante: `distance: 5` é baixo demais para dispositivos com jitter — recomendação dnd-kit é 8-10px (já é o padrão usado no segundo sensor da página, linha 5612).

## Plano de correção

### A) Validação de Insulinoterapia EV contínua  
Em `getItemMissingFields` (PrescricaoPage.tsx), adicionar early-return quando o item tem `insulinPlan` **e** `scheme === 'iv_continuous'`:
- O plano de insulinoterapia é a fonte de verdade clínica (ivConcentration, ivStartRate, ajustes por glicemia já estão nas `instructions` impressas).
- Exigir apenas `name`. Não bloquear por `diluent`/`volumeTotal`/`infusionTime` — esses dados já constam no plano e seriam redundância (e fonte de erro de digitação).
- Para SC (basal_bolus, sliding, nph_fixed): também isentar, mesma lógica — o plano cobre tudo.

Resultado: itens de insulinoterapia gerados pelo assistente ficam **prontos para validação imediatamente**. Médico ainda pode "AJUSTAR FAIXAS INLINE" ou "EDITAR ESQUEMA" — esses fluxos reaplicam `describeInsulinPlan` e mantêm coerência.

### B) Robustez do clique de edição
1. Subir `activationConstraint.distance` do PointerSensor raiz (linha 3363) de **5 → 8 px**, alinhando com o segundo sensor da página (5612) e com o ItemListEditor.
2. Adicionar `data-no-dnd` + `onPointerDown={e => e.stopPropagation()}` defensivo nos containers de campos editáveis dos itens não-validados (apenas onde a regressão é plausível), evitando que micro-arrastos sobre `Input`/`Textarea`/`Select` virem início de drag em telas sensíveis.

### C) Arquivos tocados
- `src/pages/PrescricaoPage.tsx` (único arquivo)

### D) Não será tocado
- `InsulinTherapyDialog.tsx`, `insulinTherapy.ts`, `printExtraPrescription.ts` — comportamento de descrição/impressão preservado.
- Lógica de `isItemEditLocked`, contrato de "item validado é read-only", janela 05h.
- Demais categorias do `getItemMissingFields`.

### E) Verificação
- Adicionar insulina Regular EV → confirmar plano IV contínuo no assistente → item entra **verde** (ValidationDot), botão "Validar" habilitado, PDF mantém bloco completo com concentração + dose + ajustes.
- Itens IV contínuos **não-insulina** (ex.: noradrenalina) seguem exigindo diluente/volume/tempo.
- Cliques em campos de qualquer item não-validado funcionam em primeira interação.