---
name: bed-lifecycle-v2-unified
description: Sprint 1 — separação ato médico (Painel sinaliza) × ato administrativo (Mapa libera); helper único src/lib/bedLifecycle.ts, NIR fora do fluxo crítico, OperationalRelocationDialog para remanejamento sem decisão clínica
type: feature
---

# Bed Lifecycle v2 Unified

## Princípio
- **Painel Clínico** sinaliza decisões (alta médica, transf interna/externa, óbito, evasão) → grava tarja em `patients.admission_status` + `patient_movements` com `metadata.flow_version='v2_unified'`. NÃO libera leito.
- **Mapa de Leitos** executa liberação física (recepção/enfermagem/médico) via `BedReleasePreAdmissionDialog` + senha. Remanejamento operacional (sem decisão clínica) via novo `OperationalRelocationDialog` com `repointPatientHistory` obrigatório.
- NIR sai 100% do fluxo crítico — vira possibilidade futura.

## Helpers (src/lib/bedLifecycle.ts)
- `signalClinicalDecision(kind, payload)` — Painel sinaliza, grava metadata `{flow_version, stage:'signal', signaled_by, target_sector, target_bed, nir_requested}`.
- `revokeClinicalDecision(payload)` — desfaz sinalização (paciente piorou) enquanto leito ainda não liberado; volta para `admitido`.
- `executeOperationalRelocation({sourcePatientId, targetPatientId, reason, ...})` — copia dados clínicos para slot destino + `repointPatientHistory` + zera origem + audita como `REMANEJAMENTO_OPERACIONAL`.
- (`executeBedRelease` é hoje coberto por `usePatients.releaseBedPreAdmission` — mantido como está; o helper centraliza apenas o novo caminho.)

## Mudanças de UI
- `movementFlow.ts`: "Alta Hospitalar" renomeada para **"Alta Médica"** com descrição enfatizando que liberação é etapa administrativa no Mapa.
- `PatientMovementDialog`: consequências reescritas — remove menção a "NIR/regulação" como etapa obrigatória; texto enfatiza que liberação ocorre no Mapa por recepção/enfermagem/médico. Insert inclui `metadata.flow_version='v2_unified'` + `target_sector` (transferência interna).
- `EditPatientDialog`: removido o bloco "Ações de Movimentação" (Transferir/Alta/Óbito/Reavaliar). Adicionado:
  - novo bloco **"Remanejamento Operacional"** → abre `OperationalRelocationDialog`
  - banner amarelo: "Decisões clínicas migraram para o Painel Clínico"
- `OperationalRelocationDialog`: novo. Lista leitos vagos da unidade atual, motivos pré-definidos (reforma/manutenção/isolamento/conforto/ajuste_censo/outro), MovementConfirmDialog padrão; chama `executeOperationalRelocation`.

## NÃO foi tocado
- Transferências externas (continua via Painel/sinalização).
- `repointPatientHistory` (reutilizado).
- Schema DB (sem migration; `metadata` jsonb já existe em `patient_movements`).
- RLS / perfis / auth.
- `UtiReallocationDialog` / `BedReallocationDialog` (UTI/UCC continuam funcionando como antes).
- `releaseBedPreAdmission` em usePatients (já cobre o "executeBedRelease").

## Pendente para próximas sprints
- Botão "Desfazer sinalização" no `PatientCockpit` (helper `revokeClinicalDecision` já pronto, falta UI).
- Refatorar UtiReallocationDialog/BedReallocationDialog para chamar helpers internamente.
- Índice parcial `(hospital_unit_id, sector, bed_number) WHERE admission_status='admitido'` para trava de banco 1-paciente-por-leito.
- Entry-point de "Remanejamento operacional" também direto no card do leito (hoje só via Edição Avançada).
