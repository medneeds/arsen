---
name: Internal Transfer Unified Flow
description: Fluxo de transferência interna em 2 etapas (sinalização + alocação) coexistindo com transferência direta; fila virtual no setor destino; encounter preservado; SAPS pendente em escalada crítica
type: feature
---

# Transferência Interna — Fluxo Unificado

## Princípios
- **1 internação = 1 nº de atendimento** até o desfecho final (alta, óbito, transferência externa).
- Transferência interna NUNCA cria novo encounter.
- Histórico clínico migrado via RPC `repoint_patient_history` (atômica, auditada).

## Classificação (`src/lib/sectorComplexity.ts`)
2 níveis:
- **Crítico**: `red` (UTI 1), `yellow` (UTI 2), `outside` (UCI 2)
- **Não-crítico**: todos os demais

`classifyTransfer(origem, destino)` → `escalada_critica` | `desescalada` | `lateral_critica` | `lateral_comum`.
`requiresSaps()` é `true` apenas para `escalada_critica`.

## 2 caminhos coexistentes na origem
No menu do card do paciente (PatientCard / UtiPatientCard):

1. **"Transferir agora (direto)"** — fluxo existente (`UtiReallocationDialog` / `BedReallocationDialog`). Escolhe leito destino e move imediatamente. Mantém `repoint_patient_history` para preservar histórico.

2. **"Sinalizar pré-admissão p/ outro setor"** — fluxo de 2 etapas (`SignalInternalTransferDialog` → fila virtual → `InternalTransferQueueSection`).

## Fluxo de 2 etapas

### Etapa 1 — `signalInternalTransfer()` (origem)
1. Lê `encounter_code` ativo do paciente (preservação).
2. INSERT em `internal_transfer_requests` com snapshot completo do paciente, classificação, `requires_saps` e setor destino.
3. **Esvazia o leito de origem** (todos campos clínicos → null, `admission_status` → null) — leito vira vago no mapa.
4. Registra `patient_movements` tipo `TRANSFERÊNCIA INTERNA — SINALIZADA`.

### Fila virtual — `InternalTransferQueueSection`
- Renderizada em `src/pages/Index.tsx` logo abaixo do `PreAdmissionSection`, filtrada pelo `activeSector`.
- Hook `useInternalTransferQueue(sectorCode)` lê `internal_transfer_requests` WHERE `status='pending'` AND `target_sector_code=...`, com realtime.
- Para cada request mostra: paciente, origem, classificação, badge "SAPS após alocação" quando aplicável, tempo de espera, motivo.
- Botão único condicional:
  - `requires_saps=true` → **"Pré-admitir"**
  - caso contrário → **"Alocação direta"**
- Botão "X" cancela a sinalização (pede motivo ≥5 chars). Cancelar NÃO restaura automaticamente o paciente no leito de origem (precisa reallocar manualmente) — auditado em `cancellation_reason`.

### Etapa 2 — `completeInternalTransfer()` (destino)
1. Lê a request `pending`.
2. Popula o leito destino (`patients` row escolhida) com o snapshot.
3. `admission_status`: `'saps_pendente'` se escalada crítica (dispara timer SAPS existente), senão `admissionStatus` do snapshot (default `'admitido'`).
4. `repointPatientHistory(source_patient_id → target_patient_id)` — move evoluções, prescrições, exames, culturas, condutas, `patient_encounters` (preserva `encounter_code`).
5. UPDATE request → `status='completed'`, `completed_target_patient_id`.
6. Registra `patient_movements` tipo `TRANSFERÊNCIA INTERNA — CONCLUÍDA`.

## Tabela `internal_transfer_requests`
Campos: `source_patient_id`, `source_bed`, `source_sector`, `patient_name`, `patient_snapshot` (jsonb), `encounter_code`, `target_sector_code`, `target_sector_label`, `classification`, `requires_saps`, `reason`, `status` (pending/completed/cancelled), `signaled_by/at`, `completed_by/at`, `completed_target_patient_id`, `cancelled_by/at/reason`, `hospital_unit_id`, `state_id`, `department`. RLS authenticated (mesma política do `pre_admissions`). Realtime habilitado.

## Arquivos
- `src/lib/internalTransfer.ts` — `executeInternalTransfer` (direto, mantido), `signalInternalTransfer`, `completeInternalTransfer`, `cancelInternalTransferRequest`
- `src/components/SignalInternalTransferDialog.tsx` — UI etapa 1
- `src/components/InternalTransferQueueSection.tsx` — fila virtual + alocação etapa 2
- `src/hooks/useInternalTransferQueue.ts` — lista + realtime
- Wiring: `src/pages/Index.tsx` (mount fila), `src/components/UtiPatientCard.tsx` + `src/components/PatientCard.tsx` (2 botões coexistentes no menu)

## NÃO toca
- Alta / óbito / transferência externa (desfechos finais)
- Pré-admissão da recepção (`pre_admissions` table — fluxo paralelo)
- Triggers `patient_registry_autolink`, `medical_records_apply_mode`
- Fluxo SAPS 3 (apenas dispara via `admission_status='saps_pendente'`)
- `repoint_patient_history` RPC (reusada como está)
