---
name: Triage Express Pre-identification Dialog
description: Pop-up TriageExpressDialog com perguntas opcionais (nome parcial, sexo, idade aproximada, queixa, modo de chegada, contato), checkbox de pendência de documentação e seleção de destino (Triagem ou setor direto). Salva em patient_registry.unidentified_features (jsonb) os campos documents_pending, partial_identification, chief_complaint, arrival_mode, approx_age. Painel da Recepção exibe KPI "Documentação pendente" e badges (NI / docs pendentes / identificação parcial) nos cards de atendimentos.
type: feature
---

# Triagem Express com Pré-identificação

## Componente
- `src/components/reception/TriageExpressDialog.tsx` — dialog com 5 blocos: identificação rápida, queixa, pendência (checkbox marcado por padrão), destino (seleção visual por grupo) e observações.

## Fluxo
1. Usuário clica em "Triagem Express" no painel da Recepção → abre dialog.
2. Pode preencher nome (vazio = NI automático via RPC `generate_ni_code`), sexo, idade aproximada, queixa, modo de chegada, telefone do acompanhante.
3. Marca/desmarca "Documentação pendente" (default: true).
4. Escolhe destino entre todos `DESTINATION_SECTORS` (Triagem é o recomendado).
5. Sistema cria `patient_registry` com `unidentified_features` enriquecido + prontuário oficial + encounter_code + (se setor clínico) `pre_admissions` com nota incluindo "⚠ Documentação pendente".

## Sinalização no painel
- KPI "Documentação pendente" no `ReceptionDailyDashboard`.
- Badges nos cards de atendimentos: `NI` (slate + UserX), `docs pendentes` (amber + FileWarning), `identificação parcial` (orange).
- Enriquecimento via segunda query batch em `patient_registry` por `registry_id`.

## Persistência
- `is_unidentified`: true apenas se nome vazio.
- `unidentified_features.documents_pending`: boolean.
- `unidentified_features.partial_identification`: true se nome tem menos de 2 palavras.
- `unidentified_features.arrival_mode`, `chief_complaint`, `approx_age`, `observations`: strings.

## Why
Permite que recepção registre rapidamente paciente que chega sem documentos mas com nome parcial, mantendo rastreabilidade da pendência para complementação posterior.
