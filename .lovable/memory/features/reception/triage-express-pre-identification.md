---
name: Triage Express Pre-identification Dialog
description: Pop-up TriageExpressDialog com 3 modos de idade (data nasc/exata/aproximada via ToggleGroup), atalho prioritário Sala Vermelha quando recepção horizontal, destino padrão sempre Triagem (recomendado). Persiste reception_point no encounter, birth_date no registry, e age_mode/birth_date/reception_point em unidentified_features.
type: feature
---

# Triagem Express com Pré-identificação

## Componente
`src/components/reception/TriageExpressDialog.tsx` — dialog disparado em `AdminDashboardPage` via botão "Triagem Express".

## Campos
- **Toggle "Paciente NÃO IDENTIFICADO (NI)"** no topo da seção de identificação. Quando marcado: oculta/desabilita o campo de nome, força geração de código NI mesmo sem nome digitado, e o registry é salvo com `is_unidentified=true`. Payload carrega `isUnidentified: boolean`.
- **Nome parcial** (vazio → NI automático via RPC `generate_ni_code`).
- **Sexo** (M/F/I).
- **Idade** com 3 modos via ToggleGroup (`ageMode`):
  - `approx` — texto livre (ADULTO, IDOSO, RN, ~60a) — padrão.
  - `exact` — input numérico em anos.
  - `dob` — input date (YYYY-MM-DD); calcula anos automaticamente e salva em `patient_registry.birth_date`.
- **Modo de chegada** — padrão SAMU 192 quando `receptionPoint === "horizontal"`; ESPONTÂNEO quando vertical.
- **Telefone do acompanhante**.
- **Queixa principal**.
- **Documentação pendente** (checkbox padrão marcado).
- **Destino** — sempre lista todos os setores; padrão `triagem` (recomendado).
- **Observações**.

## Atalho prioritário (Recepção Horizontal)
Quando `receptionPoint === "horizontal"`, exibe bloco destacado no topo com 2 botões grandes:
1. **Triagem** (recomendado, primeiro, com badge "recomendado").
2. **Sala Vermelha** (emergência crítica, ícone Siren animate-pulse).
A lista completa de setores permanece visível abaixo como "Outros destinos disponíveis". Mesmo na horizontal, `destinationValue` inicia como `"triagem"` — Sala Vermelha é apenas atalho secundário.

## Persistência
- `patient_registry`:
  - `birth_date` (quando ageMode = dob).
  - `unidentified_features`: `arrival_circumstance`, `arrival_mode`, `approx_age`, `age_mode`, `birth_date`, `chief_complaint`, `documents_pending`, `partial_identification`, `observations`, `reception_point`, `registered_at`.
- `patient_encounters`:
  - `reception_point` (vertical/horizontal — herdado do hook `useReceptionPost`).
  - `destination_sector`, `triage_status` (`aguardando_chamada` se Triagem; `encaminhado` se setor clínico).
- Se setor clínico (não-Triagem): cria também `pre_admissions` com `status=aguardando_leito`.

## Sinalização no painel
- KPI "Documentação pendente" no `ReceptionDailyDashboard`.
- Badges nos cards: `NI` (slate + UserX), `docs pendentes` (amber + FileWarning), `identificação parcial` (orange).
- Ícones por recepção no card: Footprints (Vertical) / Ambulance (Horizontal).

## Why
Recepção horizontal recebe pacientes em maca (SAMU/ambulância) com perfil prioritário de Sala Vermelha. O dialog acelera triagem mantendo flexibilidade total de destino e formato de idade conforme o que o acompanhante consegue informar.
