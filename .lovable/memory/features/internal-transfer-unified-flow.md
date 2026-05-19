---
name: Internal Transfer Unified Flow
description: Fluxo unificado de transferência interna com classificação por complexidade (crítico vs não-crítico), SAPS pendente na escalada, e preservação do mesmo nº de atendimento até o desfecho final
type: feature
---

# Transferência Interna Unificada

## Princípio mestre
- **1 internação = 1 nº de atendimento** até o desfecho final (alta, transferência externa, óbito).
- Transferência interna NUNCA cria novo encounter e NUNCA passa por pré-cadastro.
- Histórico clínico (evoluções, prescrições, exames, culturas, condutas, medical_records, patient_encounters) é **repointado** via RPC `repoint_patient_history` (já existente, atômica e auditada).

## Classificação (`src/lib/sectorComplexity.ts`)
Modelo de 2 níveis:
- **Crítico**: `red` (UTI 1), `yellow` (UTI 2), `outside` (UCI 2)
- **Não-crítico**: todo o resto (UCC, UE Vertical/Horizontal, Sala Vermelha, Clínicas, etc.)

Função `classifyTransfer(origem, destino)` retorna:
| Caso | Classificação | Comportamento |
|---|---|---|
| Não-crítico → Crítico | `escalada_critica` | Alocação + `admission_status='saps_pendente'` (timer já existente) |
| Crítico → Não-crítico | `desescalada` | Alocação direta, sem SAPS |
| Crítico ↔ Crítico | `lateral_critica` | Alocação direta, sem nova SAPS |
| Não-crítico ↔ Não-crítico | `lateral_comum` | Alocação direta |

`requiresSaps(c)` é `true` só para `escalada_critica`.

## Orquestrador (`src/lib/internalTransfer.ts`)
`executeInternalTransfer({ source, targetBedRow, ... })`:
1. Preenche leito destino com snapshot do paciente; aplica `saps_pendente` quando `requiresSaps`.
2. Chama `repoint_patient_history` (RPC) — move 100% do histórico do `patient_id` antigo p/ o novo.
3. Esvazia leito origem (todos os campos clínicos → null, `admission_status` → null).
4. Registra `patient_movements` com `movement_type='TRANSFERÊNCIA INTERNA'` + classificação + flag SAPS no notes.

## Wiring
- `UtiReallocationDialog` usa `classifyTransfer` + `requiresSaps` para decidir o status do destino e mostra consequência didática "SAPS 3 pendente" no `MovementConfirmDialog` quando aplicável. Como o destino é sempre UTI 1/UTI 2, todas as transferências hoje classificam como `lateral_critica` (sem SAPS) — a lógica fica pronta para quando o diálogo for chamado a partir de setor não-crítico.
- `PatientMovementDialog` mantém a sinalização "transferência interna pendente" (tarja TRANSF. INT já existente — ver `transfer-pending-ribbon`).

## NÃO toca
- Alta / óbito / transferência externa (desfechos finais)
- Pré-admissão / pré-cadastro
- `repoint_patient_history` (RPC já preserva `patient_encounters`, garantindo o mesmo `encounter_code`)
- Trigger `patient_registry_autolink`, `medical_records_apply_mode`
- Fluxo SAPS 3 existente (apenas reusa o status `saps_pendente`)
