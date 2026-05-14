-- Permitir o novo tipo de movimentação "LIBERAÇÃO PRÉ-ADMISSÃO"
-- usado quando médico/NIR/admin desocupa um leito de paciente que ainda
-- não teve a admissão hospitalar concluída (admission_status = 'pre_admitido').
-- O prontuário (patient_registry) é PRESERVADO; apenas a alocação é desfeita.
ALTER TABLE public.patient_movements
  DROP CONSTRAINT IF EXISTS patient_movements_movement_type_check;

ALTER TABLE public.patient_movements
  ADD CONSTRAINT patient_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY[
    'ALTA'::text,
    'ÓBITO'::text,
    'TRANSFERÊNCIA'::text,
    'LIBERAÇÃO PRÉ-ADMISSÃO'::text
  ]));