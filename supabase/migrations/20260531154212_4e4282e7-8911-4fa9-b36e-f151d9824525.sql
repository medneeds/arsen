-- CORREÇÃO 1: nova admissão ativa JOSE FERNANDO
INSERT INTO admission_histories (
  patient_id, patient_registry_id, hospital_unit_id, state_id,
  macro_diagnosis, cid_primary, cid_secondary, initial_conduct, clinical_history,
  created_by, updated_by, created_at, updated_at
)
SELECT
  'd902c991-7102-404f-a219-5cc104ba0655'::uuid,
  'a4410256-5bae-4876-aabb-ef083b14a5cd'::uuid,
  hospital_unit_id, state_id,
  macro_diagnosis, cid_primary, cid_secondary, initial_conduct, clinical_history,
  created_by, created_by, now(), now()
FROM admission_histories
WHERE patient_registry_id = 'a4410256-5bae-4876-aabb-ef083b14a5cd'
  AND patient_id <> 'd902c991-7102-404f-a219-5cc104ba0655'
ORDER BY created_at DESC
LIMIT 1;

-- CORREÇÃO 2: preencher admissão vazia JEYMERSON
UPDATE admission_histories dest
SET
  macro_diagnosis     = src.macro_diagnosis,
  cid_primary         = src.cid_primary,
  cid_secondary       = src.cid_secondary,
  initial_conduct     = src.initial_conduct,
  clinical_history    = src.clinical_history,
  patient_registry_id = '488d016c-5d50-4345-836d-26029dd46227',
  updated_at          = now()
FROM (
  SELECT macro_diagnosis, cid_primary, cid_secondary, initial_conduct, clinical_history
  FROM admission_histories
  WHERE patient_registry_id = '488d016c-5d50-4345-836d-26029dd46227'
    AND archived_at IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
) src
WHERE dest.patient_id = '25bcd0f9-8085-4ce8-8eb7-15c35465811c'
  AND dest.archived_at IS NULL;

-- CORREÇÃO 3A: encounter_id JOSE FERNANDO prescrições
UPDATE prescriptions
SET encounter_id = (
    SELECT id FROM patient_encounters
    WHERE registry_id = 'a4410256-5bae-4876-aabb-ef083b14a5cd' AND status = 'active'
    ORDER BY admission_date DESC LIMIT 1),
    updated_at = now()
WHERE patient_registry_id = 'a4410256-5bae-4876-aabb-ef083b14a5cd' AND encounter_id IS NULL;

-- CORREÇÃO 3B: encounter_id JEYMERSON prescrições
UPDATE prescriptions
SET encounter_id = (
    SELECT id FROM patient_encounters
    WHERE registry_id = '488d016c-5d50-4345-836d-26029dd46227'
      AND patient_id = '25bcd0f9-8085-4ce8-8eb7-15c35465811c'
      AND status = 'active'
    ORDER BY admission_date DESC LIMIT 1),
    updated_at = now()
WHERE patient_registry_id = '488d016c-5d50-4345-836d-26029dd46227' AND encounter_id IS NULL;

-- CORREÇÃO 4: fechar encounter órfão JEYMERSON
UPDATE patient_encounters
SET status         = 'closed',
    discharge_date = '2026-05-27 14:31:00'::timestamptz,
    updated_at     = now()
WHERE id = (
  SELECT id FROM patient_encounters
  WHERE registry_id = '488d016c-5d50-4345-836d-26029dd46227'
    AND patient_id <> '25bcd0f9-8085-4ce8-8eb7-15c35465811c'
    AND status = 'active'
  LIMIT 1
);