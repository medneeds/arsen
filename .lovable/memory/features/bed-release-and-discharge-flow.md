---
name: bed-release-and-discharge-flow
description: Liberação de leito com senha (pré-admissão E pós-alta/óbito) + marcação discreta de Alta/Óbito no mapa
type: feature
---

# Liberação de Leito + Alta/Óbito

## Fluxo de senha
`BedReleasePreAdmissionDialog` agora tem 3 etapas: notice → form (motivo + obs) → **PasswordConfirmDialog**. Senha do médico é validada via `supabase.auth.signInWithPassword` antes da liberação efetiva.

## Habilitação para médico assistente
Menu "Liberar leito" no `PatientCard` e `UtiPatientCard` aparece quando `admissionStatus !== 'admitido'` — cobre `pre_admitido`, `suspenso`, `alta_dada`, `obito`. Roles permitidos: `admin`, `medico`.

## Marcação Alta/Óbito
Em `PatientMovementDialog.handleSubmit`, após gravar `discharge_documents`, faz `UPDATE patients.admission_status = 'alta_dada' | 'obito'`. Tipo `Patient.admissionStatus` estendido para incluir esses dois valores (campo é `text` no DB, sem migração).

## Tinta discreta no mapa
`PatientCard` aplica overlay sutil via `cn()` na `Card`:
- `alta_dada`: `ring-1 ring-emerald-400/40 bg-emerald-50/30 grayscale-[15%] opacity-95`
- `obito`: `ring-1 ring-slate-500/50 bg-slate-100/50 grayscale-[35%] opacity-90`

Sem mudança de layout/dimensões — apenas tonalização para diferenciar dos demais leitos no mapa.
