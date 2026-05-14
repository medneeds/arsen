---
name: Insulin Correction Customization
description: Esquema de correção de insulinoterapia totalmente editável (6 faixas, observação por linha, hipoglicemia editável) com editor inline na prescrição enquanto não validada
type: feature
---

## Mudanças

1. **Tipos (`src/lib/insulinTherapy.ts`)**
   - `SlidingRow.note?: string` (observação livre por faixa).
   - `InsulinPlan.hypoglycemiaProtocol?: string` (conduta para HGT < 70).
   - Constante `DEFAULT_HYPO_PROTOCOL` (SG 50% 30 mL EV + repetir HGT 15 min...).
   - Presets `SLIDING_LOW/MEDIUM/HIGH` com **6 faixas** (150-200, 201-250, 251-300, 301-350, 351-400, >400 → CHAMAR MÉDICO).
   - `formatSlidingRow` anexa note quando presente.
   - `describeInsulinPlan` injeta linha `HGT < 70 → ...` em sliding e basal-bolus.

2. **Editor (`src/components/prescription/InsulinTherapyDialog.tsx`)**
   - `SlidingEditor` agora é **export** (reuso inline).
   - Bug corrigido: presets atribuíam via mutação `(plan as any)[...] = []`; agora `setRows([...SLIDING_*])`.
   - Coluna extra "Observação" por faixa (Input texto livre).
   - Bloco rosé "HGT < 70" com Textarea editável (`hypoglycemiaProtocol`).
   - Suporta prop `compact` para uso embarcado.

3. **Inline na prescrição (`src/pages/PrescricaoPage.tsx`)**
   - Bloco do item de insulina ganha botão "AJUSTAR FAIXAS INLINE" (ao lado de "EDITAR ESQUEMA"), visível quando `!isLocked` e esquema = `sliding | basal_bolus`.
   - Ao expandir, renderiza `SlidingEditor` direto no item, sem reabrir o wizard.
   - Callback `updateInsulinPlan(id, plan)` reaplica `describeInsulinPlan` em `instructions`, respeita `isItemEditLocked` (mesma trava do `updateItem`).
   - Quando validado, mostra hint "para alterar, suspenda…".

## Pontos de regressão a observar
- Print/PDF (`printExtraPrescription`) consome `describeInsulinPlan` — automaticamente passa a imprimir HGT<70 e observações.
- Persistência JSONB já incluía `insulinPlan` inteiro; campos novos viajam transparentemente.
