---
name: admission-histories registry-first read + órfãos arquivados
description: Leitura de admission_histories blindada por archived_at IS NULL + patient_registry_id atual; migration única arquivou órfãos de troca de ocupante
type: feature
---

**Bug** (caso Joaci Garcia, L05 UCI 1, 25/06): cockpit mostrou admissão concluída com HDA de outro paciente após reuso da linha-leito.

**Causa raiz**: `admission_histories` ficou fora das fases B.1/B.3. Hooks/diálogos consultavam só por `patient_id` (a linha-leito é reusada), sem `archived_at IS NULL` nem `patient_registry_id`. Trigger `archive_bed_history` v2 não cobriu reocupações via pré-admissão direta — sobraram linhas vivas com registries antigos.

**Fix (leitura)** — mesmo padrão registry-first das outras fases:
- `src/components/AdmissionConsultDialog.tsx` (~l.156): `.eq(patient_id).is(archived_at,null).or(registry.eq=<atual>,registry.is.null)`.
- `src/components/AdmissionHistoryDialog.tsx` (~l.53): sempre `.is(archived_at,null)`; quando há `resolvedRegistryId`, filtra por registry; senão por patient_id.
- `src/hooks/usePatientCid.ts` (~l.45): Tentativa 1 = `patient_registry_id` do paciente; Tentativa 2 = `patient_id` + `patient_registry_id IS NULL` (só legados). Sempre `archived_at IS NULL`.

**Fix (limpeza única)** — migration arquivou linhas com `patient_registry_id NOT NULL AND <> patient_registry_id da linha-leito atual`, marcando `archive_reason='cleanup_orphan_legacy_registry_mismatch'`. Não tocou registros sem registry (legado puro segue visível ao paciente atual via fallback).

**Não toca**: gravação (AdmissionDialog upsert idempotente continua igual), trigger archive_bed_history, schema, RLS, layout.

**Próximas frentes (separadas)**:
- Estender `archive_bed_history` v2 p/ cobrir `bed_occupant_swap` em pré-admissão direta.
- Fase B.4: carimbar `encounter_id` em `admission_histories` (coluna já existe) e migrar para filtro `encounter_id.eq/IS NULL`.
