---
name: CID Inline Sync
description: Hook usePatientCid persiste CID-10 primário e secundários em admission_histories direto pelo CompactPatientHeader; reflete em diagnoses do PatientCockpit
type: feature
---

`src/hooks/usePatientCid.ts` carrega/persiste CID por (patient_id, hospital_unit_id, state_id) em `admission_histories`. Secundários são salvos como JSON encoded array em `cid_secondary` (text único).

Fluxo:
1. CompactPatientHeader renderiza chips P (primário) e secundários com Popover de CidSearchInput.
2. onChange chama updatePrimary/updateSecondary do hook → upsert imediato + toast.
3. EvolucaoPage injeta cidPrimary + cidSecondary em cockpitPatient.diagnoses, garantindo sincronização visual com a aba Resumo do PatientCockpit.

Toast confirmation, loading state, error handling no console + toast destrutivo.
