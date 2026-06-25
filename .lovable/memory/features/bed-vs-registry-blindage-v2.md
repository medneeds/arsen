---
name: Bed vs Registry Blindage v2
description: Defesa em 4 camadas para garantir que dados clínicos sigam o paciente (patient_registry_id) e nunca persistam no leito (patients.id) entre ocupantes
type: feature
---

## Problema raiz

`patients.id` é a linha do MAPA DE LEITOS (volátil, reutilizada). Toda informação clínica precisa ser ancorada em `patient_registry_id` (identidade permanente) + `encounter_id` (atendimento ativo). Bug recorrente: paciente novo num leito reusado herdava evolução/admissão/exames do ocupante anterior.

## 4 camadas de defesa (todas ativas)

### 1. Banco — Stamp universal de identidade clínica
Trigger `trg_stamp_clinical_identity` (BEFORE INSERT/UPDATE) em:
- `admission_histories`, `clinical_evolutions` (via `stamp_admission_identity` / `stamp_admission_evolution_identity`)
- `exam_requests`, `culture_results`, `conduct_history`, `discharge_documents` (via `stamp_clinical_identity()`)
- `medical_records` (via `stamp_clinical_identity_no_encounter()`)

Comportamento: carimba `patient_registry_id` do ocupante atual do leito + `encounter_id` ativo. **Registry Guard**: se a linha não está arquivada e o registry diverge do ocupante atual, corrige automaticamente.

### 2. Banco — Arquivamento automático
- `trg_archive_on_bed_vacate` (já existia): dispara em `is_vacant TRUE`, com 3 guards (transferência interna 24h, internal_transfer_requests pending, encounter ativo no mesmo registry).
- `trg_archive_on_registry_swap` (novo): dispara quando `patient_registry_id` da linha-leito muda silenciosamente (leito reusado por novo paciente sem passar por vacate). Mesmos 2 guards de transferência.
- `archive_patient_bed_data(p_patient_id)` v4: cobre 13 tabelas, atomic via SECURITY DEFINER, audita em `audit_logs`.

### 3. Frontend — Leitura registry-first + archived blindado
Padrão único em hooks de leitura clínica:
```ts
.is("archived_at", null)                                     // nunca mostrar arquivado
.eq("patient_id", currentBedRowId)                           // âncora do leito
.or("encounter_id.eq.<active>,encounter_id.is.null")         // isolamento por encontro
// quando há registry:
.or("patient_registry_id.eq.<reg>,and(patient_registry_id.is.null,patient_id.eq.<bed>)")
```

Aplicado em: `useEvolutions`, `useLatestEvolution`, `useConductHistory`, `useLatestVitalSigns`, `useLatestRoundSession`, `usePatientPendingItems`, `usePatientDocuments`, `usePatientDischargeDocs`, `useActivePrescription`, `AdmissionConsultDialog`, `AdmissionHistoryDialog`, `usePatientCid`.

❌ Fallback por `patient_name` REMOVIDO de `useLatestVitalSigns` — causava cross-contamination.

### 4. Limpeza retroativa
Migration `bed-vs-registry-blindage-v2` arquivou registros órfãos cujo registry divergia do ocupante atual: 206 evoluções + 161 exames. Auditado em `audit_logs` (action UPDATE, new_data.op=CLEANUP_REGISTRY_MISMATCH_V1).

## Checklist para nova tabela clínica

Antes de criar `public.<nova_tabela_clinica>(patient_id, ...)`:

1. Incluir colunas: `patient_registry_id uuid`, `encounter_id uuid`, `archived_at timestamptz`, `archived_from_patient_id uuid`, `archive_reason text`.
2. Anexar `trg_stamp_clinical_identity` (BEFORE INSERT/UPDATE).
3. Adicionar bloco à `archive_patient_bed_data`.
4. Hook de leitura usa o padrão acima (registry-first + archived + encounter).
5. NUNCA usar `patient_name` como fallback de leitura clínica.

## Tabelas fora desta entrega (precisam fase própria)

- `vital_signs`, `round_sessions`: têm encounter_id mas sem patient_registry_id → adicionar coluna.
- `saps3_assessments`, `sepsis_protocols`: nem encounter nem registry.
- `prescription_validations`, `dispensations`: nem encounter, nem registry, nem archived_at.

## Verificação

Query de auditoria (deve retornar 0):
```sql
SELECT count(*) FROM clinical_evolutions ce JOIN patients p ON p.id=ce.patient_id
WHERE ce.archived_at IS NULL AND ce.patient_registry_id <> p.patient_registry_id;
```
