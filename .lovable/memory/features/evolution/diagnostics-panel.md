---
name: Diagnostics Panel — Evolução
description: Painel "Diagnósticos" como 1ª subseção colapsável dentro de Nova Evolução (antes de Sinais Vitais), com CID-10, toggle de previsão de alta revelando 2 calendários (UTI condicional ao setor + Hospitalar), Cuidados Paliativos e Precaução/Isolamento — replicação automática da evolução anterior + sync realtime com Admissão/Painel Clínico
type: feature
---

## Posição
`src/components/evolution/DiagnosticsPanel.tsx` é injetado em `EvolutionForm` via prop `diagnosticsSlot` como **1ª seção colapsável** do Accordion, antes de Sinais Vitais. Não aparece mais no topo da página.

## Conteúdo
1. **CID-10** — chip Primário (P) + secundários inline (Popover com `CidSearchInput`), persistidos em `admission_histories` via `usePatientCid`.
2. **Tem previsão de alta? (toggle)** — quando ON, revela:
   - **Alta Hospitalar** (sempre presente) — DatePicker shadcn (`Calendar` + `Popover`), botões rápidos Hoje/+1d/+2d/+3d/+7d, persiste em `patients.hospital_discharge_prediction` (date).
   - **Alta da UTI/UCI** (condicional: só aparece quando o setor é UTI/UCI, detectado via `patient.unit.toUpperCase().includes("UTI"|"UCI")`) — mesma UI, persiste em `patients.uti_discharge_prediction`.
   - Quando OFF, ambos campos são limpos.
3. **Cuidados Paliativos** — switch em `patients.is_palliative`.
4. **Precaução / Isolamento** — input + Popover com 6 presets em `patients.isolation_precautions`.

## Replicação automática
Ao abrir Nova Evolução em `EvolucaoPage`, se houver evolução anterior (`evolutions.length > 0`) E qualquer contexto preenchido (CID/previsão/paliativo/isolamento), exibe banner azul "Diagnósticos replicados da evolução anterior — revise e ajuste" com botão **Limpar** que zera todos os campos.

## Hook
`src/hooks/usePatientDiagnosticContext.ts`:
- Busca `uti_discharge_prediction`, `hospital_discharge_prediction`, `is_palliative`, `isolation_precautions`.
- Subscreve `postgres_changes` UPDATE em `patients` para realtime.
- Debounce 400ms para datas, 600ms para isolamento, persistência imediata para switches.
- Bloqueia gravação para mock IDs (não-UUID).

## Migration
`patients.hospital_discharge_prediction date` (já existia `uti_discharge_prediction`).
