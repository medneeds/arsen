-- Fix audit_trigger_function: handle tables that don't have a "department" column
-- (e.g., patient_registry). Also guards hospital_unit_id/state_id existence.
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_record_id UUID;
  v_user_id UUID;
  v_user_email TEXT;
  v_user_role TEXT;
  v_hospital_unit_id UUID;
  v_state_id UUID;
  v_department TEXT;
  key_name TEXT;
  v_payload JSONB;
BEGIN
  v_user_id := auth.uid();
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  SELECT role::text INTO v_user_role FROM public.user_roles WHERE user_id = v_user_id LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_record_id := (v_old_data->>'id')::UUID;
    v_payload := v_old_data;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_record_id := (v_new_data->>'id')::UUID;
    v_payload := v_new_data;
    FOR key_name IN SELECT jsonb_object_keys(v_new_data)
    LOOP
      IF v_old_data->key_name IS DISTINCT FROM v_new_data->key_name THEN
        v_changed_fields := array_append(v_changed_fields, key_name);
      END IF;
    END LOOP;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_record_id := (v_new_data->>'id')::UUID;
    v_payload := v_new_data;
  END IF;

  -- Pull hospital context defensively from JSON (avoids missing-column errors)
  v_hospital_unit_id := NULLIF(v_payload->>'hospital_unit_id','')::UUID;
  v_state_id         := NULLIF(v_payload->>'state_id','')::UUID;
  v_department       := v_payload->>'department';

  INSERT INTO public.audit_logs (
    user_id, user_email, user_role,
    action, table_name, record_id,
    old_data, new_data, changed_fields,
    hospital_unit_id, state_id, department
  ) VALUES (
    v_user_id, v_user_email, v_user_role,
    TG_OP::audit_action, TG_TABLE_NAME, v_record_id,
    v_old_data, v_new_data, v_changed_fields,
    v_hospital_unit_id, v_state_id, v_department
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;