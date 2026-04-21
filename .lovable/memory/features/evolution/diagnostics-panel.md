---
name: Diagnostics Panel — Evolução
description: Painel "Diagnósticos" no topo da Evolução Clínica com CID-10 (P/secundários), Previsão de Alta, Cuidados Paliativos (toggle) e Precauções/Isolamento — sincronização realtime bidirecional com a admissão (patients table)
type: feature
---

`src/components/evolution/DiagnosticsPanel.tsx` substitui o `CompactPatientHeader` no topo de `/evolucao` e consolida em uma única seção:

1. **CID-10**: chip Primário (P) + secundários inline (Popover com `CidSearchInput`), persistidos em `admission_histories` via `usePatientCid`.
2. **Previsão de Alta**: input de texto livre + botões rápidos (Hoje, Amanhã, 48h, 72h, 7 dias). Salva em `patients.uti_discharge_prediction` com debounce 600ms.
3. **Cuidados Paliativos**: switch que grava em `patients.is_palliative` (boolean novo, default false). Toast confirma a mudança.
4. **Precaução / Isolamento**: input de texto + Popover com presets (Contato, Gotículas, Aerossóis, Contato+Gotículas, Contato+Aerossóis, Reverso). Persiste em `patients.isolation_precautions` (text novo).

Hook: `src/hooks/usePatientDiagnosticContext.ts`
- Busca `uti_discharge_prediction`, `is_palliative`, `isolation_precautions` da tabela patients.
- Subscreve `postgres_changes` UPDATE em `patients` para refletir alterações feitas em outras telas (Admissão, Painel Clínico) em tempo real.
- Debounce 600ms para campos texto, persistência imediata para o switch paliativo.
- Bloqueia gravação para mock IDs (não-UUID) com toast informativo.

Badges resumidas no header do painel mostram instantaneamente se o paciente está paliativado (roxo) ou em isolamento (âmbar).

Migration: `is_palliative boolean DEFAULT false` + `isolation_precautions text` em `patients`.
