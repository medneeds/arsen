
-- Fix archive trigger: remove the bed_occupant_swap branch.
-- archive_bed_history v2 already only archives rows whose registry/name PROVES
-- they belong to another patient. The swap branch was redundant and caused
-- JOSE DE RIBAMAR RODRIGUES's evolutions to be archived when his bed was
-- reused by another patient even though the trigger fires on his own row.
CREATE OR REPLACE FUNCTION public.trg_archive_bed_history_on_deallocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_was_occupied boolean;
  v_is_now_vacant boolean;
BEGIN
  v_was_occupied :=
    COALESCE(OLD.is_vacant, true) = false
    OR OLD.patient_registry_id IS NOT NULL
    OR COALESCE(NULLIF(trim(OLD.name), ''), '') <> '';

  v_is_now_vacant :=
    COALESCE(NEW.is_vacant, false) = true
    OR (NEW.patient_registry_id IS NULL AND COALESCE(NULLIF(trim(NEW.name), ''), '') = '');

  -- Only archive when bed truly transitions from occupied to vacant.
  -- archive_bed_history() internally only touches rows that belong to a
  -- DIFFERENT registry than the current one, so it is safe to call here.
  IF v_was_occupied AND v_is_now_vacant THEN
    PERFORM public.archive_bed_history(NEW.id, 'bed_deallocation_auto');
  END IF;

  RETURN NEW;
END;
$function$;
