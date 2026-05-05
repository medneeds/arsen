---
name: nir-operational-actions
description: NIR opera bed_census com autonomia paralela — ações inline (ocupar/alta médica/alta administrativa/higienização/bloqueio/manutenção/interdição/reserva) via useBedCensusActions; gera/aprova/nega regulation_requests via NirRequestActions
type: feature
---

# NIR — Operação Independente

NIR Dashboard (`/nir`) tem autonomia total sobre `bed_census` para os 322 leitos do Socorrão I. Coexiste com a movimentação médica (autonomia paralela — primeira ação vence).

## Hook `useBedCensusActions`
Centraliza toda mutation em bed_census. Trigger `bed_census_track_status` cuida dos timestamps automaticamente.

Ações: `occupyBed`, `giveMedicalDischarge`, `giveAdministrativeDischarge`, `startCleaning`, `finishCleaning`, `blockBed(reason, mode)`, `unblockBed`, `reserveBed(for, hours)`, `releaseReservation`, `transferBed(originId, destId)`.

## BedDetailDialog
Painel com 2 abas (Ações NIR + Linha do tempo). Ações contextuais por status — só mostra o que faz sentido (ex.: "Ocupar" só em vago).

## NirRequestActions
Componente que substituiu a listagem read-only de regulation_requests. Permite criar nova solicitação (dialog completo: tipo/paciente/setores/prioridade/motivo/resumo) e aprovar/negar/concluir/cancelar inline com SLA badge.

## Seed demo
Cenário inicial popula bed_census com mix de status (ocupado, higienizacao, alta_medica_dada, bloqueado, manutencao, reservado, interditado) + 12 regulation_requests realistas. Para reaplicar, rodar a migração de SEED.
