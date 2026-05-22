---
name: archive_bed_history v2 (no NULL cascade)
description: Função archive_bed_history exige prova explícita de troca de identidade (registry NOT NULL e diferente) — não arquiva mais legados sem carimbo
type: feature
---

**Bug recorrente** (paciente Jardel L08 UTI 1, Raimunda L08, vários): "evolução/admissão sumiu".

**Causa raiz**: a função `archive_bed_history(p_patient_id, p_reason)` tinha o predicado
`ce.patient_registry_id IS DISTINCT FROM v_current_registry`. Em SQL, `NULL DISTINCT FROM <uuid>` é **TRUE**. Resultado: toda evolução/prescrição/exame/cultura **legada sem registry carimbado** que ainda apontava para o `patient_id` do bed-row era arquivada em cascata sempre que o trigger `trg_archive_bed_history_on_deallocation` disparava (`bed_occupant_swap` ou `bed_deallocation_auto`). Bastava qualquer troca no leito para destruir histórico.

**Fix v2**: arquivamento só acontece em 2 condições explícitas:
1. Leito **vago** (`registry IS NULL AND name IS NULL`) E o registro tem registry/nome distintos do atual → arquiva (fim de internação real).
2. Leito ocupado com novo registry → arquiva **somente** registros cujo `patient_registry_id IS NOT NULL AND <> v_current_registry`.

Linhas legadas com `patient_registry_id IS NULL` **NUNCA** mais são arquivadas em cascata. O filtro registry-first dos hooks (`useEvolutions`, `useLatestEvolution`, mem://features/evolution/registry-first-follow-patient) já isola corretamente sem destruir histórico.

Auditoria marca `fn_version: v2_no_null_cascade` em `audit_logs` para rastreio.

Aplicar carimbo de registry no INSERT (createEvolution/createPrescription) continua sendo boa prática para fortalecer a blindagem.
