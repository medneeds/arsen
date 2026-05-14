ALTER TABLE public.patients
  ALTER COLUMN admission_status DROP NOT NULL;

ALTER TABLE public.patient_movements
  DROP CONSTRAINT IF EXISTS patient_movements_movement_type_check;

ALTER TABLE public.patient_movements
  ADD CONSTRAINT patient_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY[
    'ALTA'::text,
    'ÓBITO'::text,
    'TRANSFERÊNCIA'::text,
    'LIBERAÇÃO PRÉ-ADMISSÃO'::text,
    'LIBERAÇÃO PÓS-ALTA/ÓBITO'::text,
    'ALTA_HOSPITALAR'::text,
    'ALTA_PEDIDO'::text,
    'OBITO'::text,
    'EVASAO'::text,
    'TRANSFERENCIA_INTERNA'::text,
    'TRANSFERENCIA_EXTERNA'::text,
    'ENTRADA'::text,
    'ADMISSAO'::text,
    'INTERNACAO'::text
  ]));