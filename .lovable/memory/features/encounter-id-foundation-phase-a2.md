---
name: Encounter Foundation Phase A.2 (patient_registry_id stamping)
description: Carimbo aditivo de patient_registry_id em 5 tabelas clínicas (evolutions/exams/cultures/conducts/movements) com trigger autofill via encounter_id + backfill. Sem mudança em UI/leitura/RLS.
type: feature
---

## Fase A.2 — patient_registry_id nas tabelas clínicas

**Status:** aplicada. Próxima fase (B.3) trocará leitura de PacienteHubPage + FichaAtendimentoPage.

### Tabelas modificadas (coluna nullable + index parcial + trigger BEFORE INS/UPD)
- clinical_evolutions
- exam_requests
- culture_results
- conduct_history
- patient_movements

### Função trigger
`public.autofill_patient_registry_id()` — deriva `patient_registry_id` a partir de `patient_encounters.registry_id` quando `encounter_id` já está preenchido. Roda em conjunto com `autofill_encounter_id` (Fase A.1).

### Backfill
UPDATE em massa via JOIN com patient_encounters para todos os registros que já tinham encounter_id carimbado.

### Garantias
- Coluna nullable, sem default → não quebra inserts existentes.
- Nenhum hook/UI lê dela ainda → zero impacto runtime.
- Reversível: `DROP COLUMN patient_registry_id` + `DROP FUNCTION autofill_patient_registry_id` + `DROP TRIGGER trg_*_autofill_registry`.

### Próxima fase (B.3) — NÃO executada
Trocar `PacienteHubPage.tsx` e `FichaAtendimentoPage.tsx` de `.eq("patient_id", ...)` para `.eq("patient_registry_id", ...)` para resolver contaminação de leito longitudinal.
