
-- Enable unaccent extension for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- Function for accent-insensitive patient search
CREATE OR REPLACE FUNCTION public.search_patients_global(
  p_search_term text,
  p_hospital_unit_id uuid,
  p_state_id uuid,
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  bed_number text,
  sector text,
  department text,
  diagnoses text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT p.id, p.name, p.bed_number, p.sector, p.department, p.diagnoses
  FROM public.patients p
  WHERE p.hospital_unit_id = p_hospital_unit_id
    AND p.state_id = p_state_id
    AND p.name IS NOT NULL
    AND trim(p.name) != ''
    AND (
      unaccent(lower(p.name)) LIKE '%' || unaccent(lower(p_search_term)) || '%'
      OR unaccent(lower(p.bed_number)) LIKE '%' || unaccent(lower(p_search_term)) || '%'
      OR unaccent(lower(COALESCE(p.diagnoses, ''))) LIKE '%' || unaccent(lower(p_search_term)) || '%'
    )
  LIMIT p_limit;
$$;

-- Function for accent-insensitive movement search
CREATE OR REPLACE FUNCTION public.search_movements_global(
  p_search_term text,
  p_hospital_unit_id uuid,
  p_state_id uuid,
  p_limit int DEFAULT 6
)
RETURNS TABLE (
  id uuid,
  patient_name text,
  movement_type text,
  destination text,
  patient_sector text,
  patient_bed text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT pm.id, pm.patient_name, pm.movement_type, pm.destination, pm.patient_sector, pm.patient_bed, pm.created_at
  FROM public.patient_movements pm
  WHERE pm.hospital_unit_id = p_hospital_unit_id
    AND pm.state_id = p_state_id
    AND (
      unaccent(lower(pm.patient_name)) LIKE '%' || unaccent(lower(p_search_term)) || '%'
      OR unaccent(lower(COALESCE(pm.destination, ''))) LIKE '%' || unaccent(lower(p_search_term)) || '%'
      OR unaccent(lower(COALESCE(pm.patient_bed, ''))) LIKE '%' || unaccent(lower(p_search_term)) || '%'
    )
  ORDER BY pm.created_at DESC
  LIMIT p_limit;
$$;
