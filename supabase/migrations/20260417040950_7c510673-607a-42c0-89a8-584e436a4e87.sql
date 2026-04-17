CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Wrapper IMMUTABLE para unaccent (declarado primeiro)
CREATE OR REPLACE FUNCTION public.unaccent_immutable(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = extensions, public
AS $$
  SELECT extensions.unaccent('extensions.unaccent'::regdictionary, input);
$$;

CREATE OR REPLACE FUNCTION public.normalize_text_immutable(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT lower(public.unaccent_immutable(input));
$$;

ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS full_name_normalized text
    GENERATED ALWAYS AS (public.normalize_text_immutable(full_name)) STORED;

ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS is_unidentified boolean NOT NULL DEFAULT false;

ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS unidentified_code text UNIQUE;

ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS unidentified_features jsonb;

ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS merged_into_registry_id uuid REFERENCES public.patient_registry(id),
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS patient_registry_cpf_unique
  ON public.patient_registry (cpf)
  WHERE cpf IS NOT NULL AND cpf <> '' AND merged_into_registry_id IS NULL;

CREATE INDEX IF NOT EXISTS patient_registry_full_name_trgm
  ON public.patient_registry USING gin (full_name_normalized gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.uppercase_patient_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.full_name IS NOT NULL THEN NEW.full_name := upper(trim(NEW.full_name)); END IF;
  IF NEW.social_name IS NOT NULL THEN NEW.social_name := upper(trim(NEW.social_name)); END IF;
  IF NEW.mother_name IS NOT NULL THEN NEW.mother_name := upper(trim(NEW.mother_name)); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uppercase_patient_name ON public.patient_registry;
CREATE TRIGGER trg_uppercase_patient_name
  BEFORE INSERT OR UPDATE OF full_name, social_name, mother_name
  ON public.patient_registry
  FOR EACH ROW EXECUTE FUNCTION public.uppercase_patient_name();

CREATE TABLE IF NOT EXISTS public.unidentified_sequences (
  year_ref text PRIMARY KEY,
  last_sequence integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.unidentified_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view ni sequences" ON public.unidentified_sequences;
CREATE POLICY "Authenticated can view ni sequences" ON public.unidentified_sequences
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.generate_ni_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_seq integer;
BEGIN
  v_year := to_char(now(), 'YYYY');
  INSERT INTO public.unidentified_sequences (year_ref, last_sequence, updated_at)
  VALUES (v_year, 1, now())
  ON CONFLICT (year_ref)
  DO UPDATE SET last_sequence = public.unidentified_sequences.last_sequence + 1, updated_at = now()
  RETURNING last_sequence INTO v_seq;
  RETURN 'NI-' || v_year || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.check_patient_duplicate(p_cpf text DEFAULT NULL, p_cns text DEFAULT NULL)
RETURNS TABLE(id uuid, full_name text, medical_record text, birth_date date, cpf text, cns text, match_field text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pr.id, pr.full_name, pr.medical_record, pr.birth_date, pr.cpf, pr.cns,
         CASE WHEN p_cpf IS NOT NULL AND pr.cpf = p_cpf THEN 'cpf'
              WHEN p_cns IS NOT NULL AND pr.cns = p_cns THEN 'cns'
              ELSE NULL END
  FROM public.patient_registry pr
  WHERE pr.merged_into_registry_id IS NULL
    AND (
      (p_cpf IS NOT NULL AND p_cpf <> '' AND pr.cpf = p_cpf)
      OR (p_cns IS NOT NULL AND p_cns <> '' AND pr.cns = p_cns)
    )
  LIMIT 5;
$$;

CREATE TABLE IF NOT EXISTS public.patient_merge_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_registry_id uuid NOT NULL,
  target_registry_id uuid,
  action text NOT NULL,
  source_snapshot jsonb,
  target_snapshot jsonb,
  payload jsonb,
  performed_by uuid,
  performed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_merge_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view merge audit" ON public.patient_merge_audit;
CREATE POLICY "Admins view merge audit" ON public.patient_merge_audit
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Authenticated insert merge audit" ON public.patient_merge_audit;
CREATE POLICY "Authenticated insert merge audit" ON public.patient_merge_audit
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.promote_unidentified_patient(
  p_ni_id uuid, p_full_name text,
  p_birth_date date DEFAULT NULL, p_sex text DEFAULT NULL,
  p_cpf text DEFAULT NULL, p_cns text DEFAULT NULL,
  p_mother_name text DEFAULT NULL, p_phone text DEFAULT NULL, p_address text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old patient_registry%ROWTYPE;
  v_user uuid := auth.uid();
  v_email text;
BEGIN
  SELECT * INTO v_old FROM public.patient_registry WHERE id = p_ni_id;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Registro NI não encontrado'; END IF;
  IF NOT v_old.is_unidentified THEN RAISE EXCEPTION 'Registro % não é Não Identificado', p_ni_id; END IF;

  IF p_cpf IS NOT NULL AND p_cpf <> '' THEN
    IF EXISTS (SELECT 1 FROM public.patient_registry WHERE cpf = p_cpf AND id <> p_ni_id AND merged_into_registry_id IS NULL) THEN
      RAISE EXCEPTION 'CPF já cadastrado em outro paciente';
    END IF;
  END IF;

  UPDATE public.patient_registry
  SET full_name = p_full_name,
      birth_date = COALESCE(p_birth_date, birth_date),
      sex = COALESCE(p_sex, sex),
      cpf = COALESCE(p_cpf, cpf),
      cns = COALESCE(p_cns, cns),
      mother_name = COALESCE(p_mother_name, mother_name),
      phone = COALESCE(p_phone, phone),
      address = COALESCE(p_address, address),
      is_unidentified = false,
      updated_at = now()
  WHERE id = p_ni_id;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_user;
  INSERT INTO public.patient_merge_audit (source_registry_id, target_registry_id, action, source_snapshot, payload, performed_by, performed_by_email)
  VALUES (p_ni_id, p_ni_id, 'promote', to_jsonb(v_old), jsonb_build_object('new_name', p_full_name, 'cpf', p_cpf), v_user, v_email);

  RETURN p_ni_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_unidentified_patient(p_ni_id uuid, p_target_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_source patient_registry%ROWTYPE;
  v_target patient_registry%ROWTYPE;
  v_user uuid := auth.uid();
  v_email text;
BEGIN
  SELECT * INTO v_source FROM public.patient_registry WHERE id = p_ni_id;
  SELECT * INTO v_target FROM public.patient_registry WHERE id = p_target_id;
  IF v_source.id IS NULL OR v_target.id IS NULL THEN RAISE EXCEPTION 'Registros não encontrados'; END IF;
  IF NOT v_source.is_unidentified THEN RAISE EXCEPTION 'Registro origem não é Não Identificado'; END IF;
  IF p_ni_id = p_target_id THEN RAISE EXCEPTION 'Origem e destino são iguais'; END IF;

  UPDATE public.patient_encounters SET registry_id = p_target_id WHERE registry_id = p_ni_id;
  UPDATE public.patients SET patient_registry_id = p_target_id WHERE patient_registry_id = p_ni_id;
  UPDATE public.clinical_evolutions SET patient_registry_id = p_target_id WHERE patient_registry_id = p_ni_id;
  UPDATE public.exam_requests SET patient_registry_id = p_target_id WHERE patient_registry_id = p_ni_id;
  UPDATE public.culture_results SET patient_registry_id = p_target_id WHERE patient_registry_id = p_ni_id;
  UPDATE public.admission_histories SET patient_registry_id = p_target_id WHERE patient_registry_id = p_ni_id;
  UPDATE public.conduct_history SET patient_registry_id = p_target_id WHERE patient_registry_id = p_ni_id;
  UPDATE public.patient_movements SET patient_registry_id = p_target_id WHERE patient_registry_id = p_ni_id;
  UPDATE public.medical_records SET patient_registry_id = p_target_id WHERE patient_registry_id = p_ni_id;
  UPDATE public.dhd_patients SET patient_registry_id = p_target_id WHERE patient_registry_id = p_ni_id;

  UPDATE public.patient_registry
  SET merged_into_registry_id = p_target_id, merged_at = now(), merged_by = v_user, updated_at = now()
  WHERE id = p_ni_id;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_user;
  INSERT INTO public.patient_merge_audit (source_registry_id, target_registry_id, action, source_snapshot, target_snapshot, performed_by, performed_by_email)
  VALUES (p_ni_id, p_target_id, 'merge', to_jsonb(v_source), to_jsonb(v_target), v_user, v_email);

  RETURN p_target_id;
END;
$$;