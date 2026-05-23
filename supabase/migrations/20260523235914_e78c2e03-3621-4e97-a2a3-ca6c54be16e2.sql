
CREATE OR REPLACE FUNCTION public.autolink_patient_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_registry_id uuid;
  v_cpf text;
  v_medical_record text;
  v_name_norm text;
  v_reg_name_norm text;
BEGIN
  -- Normaliza nome do paciente (NFD + upper + trim) para comparações
  v_name_norm := upper(trim(translate(
    coalesce(NEW.name, ''),
    'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
  )));

  -- Em UPDATE: se o nome OU o leito mudou, descarta o vínculo antigo
  -- para forçar uma nova resolução (paciente novo no leito reusado, ou
  -- identificação de NI). Também descarta se o nome divergir do registry atual.
  IF TG_OP = 'UPDATE' AND NEW.patient_registry_id IS NOT NULL THEN
    IF (coalesce(NEW.name,'') IS DISTINCT FROM coalesce(OLD.name,''))
       OR (coalesce(NEW.bed_number,'') IS DISTINCT FROM coalesce(OLD.bed_number,''))
    THEN
      NEW.patient_registry_id := NULL;
    ELSE
      -- nome/leito iguais mas registry pode estar incorreto (legado): valida nome
      SELECT upper(trim(translate(coalesce(pr.full_name,''),
        'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')))
      INTO v_reg_name_norm
      FROM public.patient_registry pr
      WHERE pr.id = NEW.patient_registry_id;
      IF v_reg_name_norm IS NOT NULL
         AND v_name_norm <> ''
         AND v_reg_name_norm <> v_name_norm
      THEN
        NEW.patient_registry_id := NULL;
      END IF;
    END IF;
  END IF;

  -- Se já tem vínculo válido, nada a fazer
  IF NEW.patient_registry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Resolver via pre_admissions (mesmo leito + unidade) — COM FILTRO DE NOME
  -- O nome da pré-admissão precisa bater (NFD/upper) com o nome do paciente,
  -- para nunca pegar pré-admissão histórica de outro paciente no mesmo leito.
  IF v_name_norm <> '' THEN
    SELECT pa.patient_registry_id, pa.cpf, pa.medical_record
      INTO v_registry_id, v_cpf, v_medical_record
    FROM public.pre_admissions pa
    WHERE pa.hospital_unit_id = NEW.hospital_unit_id
      AND pa.destination_bed = NEW.bed_number
      AND pa.patient_registry_id IS NOT NULL
      AND upper(trim(translate(coalesce(pa.patient_name,''),
        'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))) = v_name_norm
    ORDER BY pa.created_at DESC
    LIMIT 1;

    IF v_registry_id IS NOT NULL THEN
      NEW.patient_registry_id := v_registry_id;
      IF NEW.medical_record IS NULL AND v_medical_record IS NOT NULL THEN
        NEW.medical_record := v_medical_record;
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  -- 2) Fallback: pre_admission no mesmo leito por CPF (também filtra nome)
  IF v_name_norm <> '' THEN
    SELECT pa.cpf, pa.medical_record
      INTO v_cpf, v_medical_record
    FROM public.pre_admissions pa
    WHERE pa.hospital_unit_id = NEW.hospital_unit_id
      AND pa.destination_bed = NEW.bed_number
      AND pa.cpf IS NOT NULL
      AND upper(trim(translate(coalesce(pa.patient_name,''),
        'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))) = v_name_norm
    ORDER BY pa.created_at DESC
    LIMIT 1;

    IF v_cpf IS NOT NULL THEN
      SELECT pr.id INTO v_registry_id
      FROM public.patient_registry pr
      WHERE pr.cpf = v_cpf
      LIMIT 1;

      IF v_registry_id IS NOT NULL THEN
        NEW.patient_registry_id := v_registry_id;
        IF NEW.medical_record IS NULL AND v_medical_record IS NOT NULL THEN
          NEW.medical_record := v_medical_record;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
