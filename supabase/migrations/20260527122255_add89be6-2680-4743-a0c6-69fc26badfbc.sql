-- Trigger: ao validar uma ficha SAPS 3 (status -> completed), libera o gate
-- clínico no paciente correspondente (saps_pending=false, saps_completed_at=now()).
-- Resolve race condition entre o UPDATE do Saps3Page.handleSave e efeitos
-- paralelos que setam saps_pending=true em patients durante a admissão.

CREATE OR REPLACE FUNCTION public.sync_patient_saps_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.patient_id IS NOT NULL THEN
    UPDATE public.patients
       SET saps_pending = false,
           saps_completed_at = COALESCE(saps_completed_at, now())
     WHERE id = NEW.patient_id
       AND (saps_pending IS TRUE OR saps_completed_at IS NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_patient_saps_on_completion ON public.saps3_assessments;
CREATE TRIGGER trg_sync_patient_saps_on_completion
AFTER INSERT OR UPDATE OF status, patient_id ON public.saps3_assessments
FOR EACH ROW
EXECUTE FUNCTION public.sync_patient_saps_on_completion();