CREATE OR REPLACE FUNCTION public.auto_vacate_on_discharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_empty boolean := (OLD.name IS NULL OR trim(OLD.name) = '');
  v_new_empty boolean := (NEW.name IS NULL OR trim(NEW.name) = '');
BEGIN
  -- Dispara apenas na transição ocupado -> vago.
  -- patients.name é NOT NULL; portanto o slot vazio deve ficar como string vazia,
  -- nunca NULL. Isso evita falha na desalocação após a auditoria ser gravada.
  IF NOT v_old_empty AND v_new_empty THEN
    NEW.name := '';
    NEW.patient_registry_id := NULL;
    NEW.medical_record := NULL;
    NEW.cpf := NULL;
    NEW.birth_date := NULL;
    NEW.sex := NULL;
    NEW.mother_name := NULL;
    NEW.address := NULL;
    NEW.city := NULL;
    NEW.phone := NULL;
    NEW.cns := NULL;
    NEW.diagnosis := NULL;
    NEW.uti_allergies := NULL;
    NEW.uti_weight_kg := NULL;
    NEW.uti_devices := NULL;
    NEW.admission_date := NULL;
    NEW.admission_status := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

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
    'LIBERAÇÃO ADMINISTRATIVA EXCEPCIONAL'::text,
    'ALTA_HOSPITALAR'::text,
    'ALTA_PEDIDO'::text,
    'OBITO'::text,
    'EVASAO'::text,
    'REVOGACAO_DECISAO'::text,
    'TRANSFERENCIA_INTERNA'::text,
    'TRANSFERENCIA_EXTERNA'::text,
    'TRANSFERÊNCIA INTERNA'::text,
    'TRANSFERÊNCIA INTERNA — SINALIZADA'::text,
    'TRANSFERÊNCIA INTERNA — CONCLUÍDA'::text,
    'ENTRADA'::text,
    'ADMISSAO'::text,
    'INTERNACAO'::text
  ]));