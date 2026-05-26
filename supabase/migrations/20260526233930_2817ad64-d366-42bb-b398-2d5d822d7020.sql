-- PARTE 1: Backfill de patient_name em registros históricos
UPDATE public.exam_requests er
   SET patient_name = COALESCE(NULLIF(trim(p.name), ''), pr.full_name, er.patient_name)
  FROM public.patients p
  LEFT JOIN public.patient_registry pr ON pr.id = p.patient_registry_id
 WHERE er.patient_id = p.id
   AND (er.patient_name IS NULL OR trim(er.patient_name) = '')
   AND (trim(COALESCE(p.name, '')) <> '' OR pr.full_name IS NOT NULL);

UPDATE public.clinical_evolutions ce
   SET patient_name = COALESCE(NULLIF(trim(p.name), ''), pr.full_name, ce.patient_name)
  FROM public.patients p
  LEFT JOIN public.patient_registry pr ON pr.id = p.patient_registry_id
 WHERE ce.patient_id = p.id
   AND (ce.patient_name IS NULL OR trim(ce.patient_name) = '')
   AND (trim(COALESCE(p.name, '')) <> '' OR pr.full_name IS NOT NULL);

UPDATE public.culture_results cr
   SET patient_name = COALESCE(NULLIF(trim(p.name), ''), pr.full_name, cr.patient_name)
  FROM public.patients p
  LEFT JOIN public.patient_registry pr ON pr.id = p.patient_registry_id
 WHERE cr.patient_id = p.id
   AND (cr.patient_name IS NULL OR trim(cr.patient_name) = '')
   AND (trim(COALESCE(p.name, '')) <> '' OR pr.full_name IS NOT NULL);

UPDATE public.discharge_documents dd
   SET patient_name = COALESCE(NULLIF(trim(p.name), ''), pr.full_name, dd.patient_name)
  FROM public.patients p
  LEFT JOIN public.patient_registry pr ON pr.id = p.patient_registry_id
 WHERE dd.patient_id = p.id
   AND (dd.patient_name IS NULL OR trim(dd.patient_name) = '')
   AND (trim(COALESCE(p.name, '')) <> '' OR pr.full_name IS NOT NULL);

UPDATE public.patient_movements pm
   SET patient_name = COALESCE(NULLIF(trim(p.name), ''), pr.full_name, pm.patient_name)
  FROM public.patients p
  LEFT JOIN public.patient_registry pr ON pr.id = p.patient_registry_id
 WHERE pm.patient_id = p.id
   AND (pm.patient_name IS NULL OR trim(pm.patient_name) = '')
   AND (trim(COALESCE(p.name, '')) <> '' OR pr.full_name IS NOT NULL);

UPDATE public.prescriptions pr_rx
   SET patient_data = jsonb_set(
         pr_rx.patient_data, '{name}',
         to_jsonb(COALESCE(NULLIF(trim(p.name), ''), preg.full_name, ''))
       )
  FROM public.patients p
  LEFT JOIN public.patient_registry preg ON preg.id = p.patient_registry_id
 WHERE (pr_rx.patient_data->>'id')::uuid = p.id
   AND (pr_rx.patient_data->>'name' IS NULL OR trim(pr_rx.patient_data->>'name') = '')
   AND (trim(COALESCE(p.name, '')) <> '' OR preg.full_name IS NOT NULL);

-- PARTE 2: Trigger que preenche patient_name automaticamente em inserts futuros
CREATE OR REPLACE FUNCTION public.tg_fill_patient_name_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF (NEW.patient_name IS NULL OR trim(NEW.patient_name) = '')
     AND NEW.patient_id IS NOT NULL
  THEN
    SELECT COALESCE(NULLIF(trim(p.name), ''), pr.full_name)
      INTO v_name
    FROM public.patients p
    LEFT JOIN public.patient_registry pr ON pr.id = p.patient_registry_id
    WHERE p.id = NEW.patient_id;

    IF v_name IS NOT NULL AND trim(v_name) <> '' THEN
      NEW.patient_name := v_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_patient_name ON public.exam_requests;
CREATE TRIGGER trg_fill_patient_name
  BEFORE INSERT ON public.exam_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_fill_patient_name_on_insert();

DROP TRIGGER IF EXISTS trg_fill_patient_name ON public.clinical_evolutions;
CREATE TRIGGER trg_fill_patient_name
  BEFORE INSERT ON public.clinical_evolutions
  FOR EACH ROW EXECUTE FUNCTION public.tg_fill_patient_name_on_insert();

DROP TRIGGER IF EXISTS trg_fill_patient_name ON public.culture_results;
CREATE TRIGGER trg_fill_patient_name
  BEFORE INSERT ON public.culture_results
  FOR EACH ROW EXECUTE FUNCTION public.tg_fill_patient_name_on_insert();

DROP TRIGGER IF EXISTS trg_fill_patient_name ON public.discharge_documents;
CREATE TRIGGER trg_fill_patient_name
  BEFORE INSERT ON public.discharge_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_fill_patient_name_on_insert();

DROP TRIGGER IF EXISTS trg_fill_patient_name ON public.patient_movements;
CREATE TRIGGER trg_fill_patient_name
  BEFORE INSERT ON public.patient_movements
  FOR EACH ROW EXECUTE FUNCTION public.tg_fill_patient_name_on_insert();