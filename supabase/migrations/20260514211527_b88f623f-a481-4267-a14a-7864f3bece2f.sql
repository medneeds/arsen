
-- Limpeza automática de sinalizações órfãs para setores sem implantação ativa.
-- Preserva o prontuário do paciente; cancela apenas a sinalização de leito.

CREATE TABLE IF NOT EXISTS public.locked_sector_cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  patient_id UUID,
  patient_name TEXT,
  sector TEXT,
  cleaned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.locked_sector_cleanup_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_cleanup_log" ON public.locked_sector_cleanup_log;
CREATE POLICY "auth_read_cleanup_log"
  ON public.locked_sector_cleanup_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.cleanup_locked_sector_pending_allocations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_codes TEXT[] := ARRAY[
    'neuro_01','neuro_02','clinica_cirurgica',
    'ue_vertical','ue_horizontal','sala_vermelha','sala_laranja',
    'internacao_ue','observacao_clinica',
    'enfermaria_vascular','riv',
    'cc_preparo','cc_bloco','cc_rpa'
  ];
  v_locked_labels TEXT[] := ARRAY[
    'NEURO 01','NEURO 02','CLÍNICA CIRÚRGICA',
    'UE VERTICAL','UE HORIZONTAL','SALA VERMELHA','SALA LARANJA',
    'INTERNAÇÃO UE','OBSERVAÇÃO CLÍNICA',
    'ENFERMARIA VASCULAR','RIV',
    'CC PREPARO','CC BLOCO CIRÚRGICO','CC RPA'
  ];
  v_pre INT := 0;
  v_bar INT := 0;
BEGIN
  -- 1) pre_admissions: cancela sinalizações pendentes >24h em setor bloqueado
  WITH cancelled AS (
    UPDATE public.pre_admissions
       SET status = 'cancelado',
           updated_at = now(),
           notes = COALESCE(notes,'') ||
             CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE E'\n' END ||
             '[Cancelado automaticamente em ' || to_char(now(),'DD/MM/YYYY HH24:MI') ||
             ' — setor sem implantação ativa, sinalização não admitida em 24h. Prontuário preservado.]'
     WHERE created_at < now() - interval '24 hours'
       AND COALESCE(status,'') NOT IN ('admitido','cancelado','rejeitado','expirado')
       AND (
         destination_sector = ANY(v_locked_codes)
         OR destination_sector = ANY(v_locked_labels)
       )
    RETURNING id, NULL::uuid AS patient_id, patient_name, destination_sector
  )
  INSERT INTO public.locked_sector_cleanup_log (source_table, source_id, patient_id, patient_name, sector)
  SELECT 'pre_admissions', id, patient_id, patient_name, destination_sector FROM cancelled;
  GET DIAGNOSTICS v_pre = ROW_COUNT;

  -- 2) bed_allocation_requests: cancela pedidos pendentes >24h em setor bloqueado
  WITH cancelled AS (
    UPDATE public.bed_allocation_requests
       SET status = 'cancelled',
           rejection_reason = COALESCE(rejection_reason,'') ||
             CASE WHEN COALESCE(rejection_reason,'') = '' THEN '' ELSE ' | ' END ||
             'Cancelado automaticamente — setor sem implantação ativa, não admitido em 24h.',
           reviewed_at = now(),
           updated_at = now()
     WHERE created_at < now() - interval '24 hours'
       AND COALESCE(status,'') NOT IN ('approved','cancelled','rejected','admitted','expired')
       AND (
         requested_sector = ANY(v_locked_codes)
         OR requested_sector = ANY(v_locked_labels)
       )
    RETURNING id, patient_id, requested_sector
  )
  INSERT INTO public.locked_sector_cleanup_log (source_table, source_id, patient_id, sector)
  SELECT 'bed_allocation_requests', id, patient_id, requested_sector FROM cancelled;
  GET DIAGNOSTICS v_bar = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'cleaned_at', now(),
    'pre_admissions_cancelled', v_pre,
    'bed_allocation_requests_cancelled', v_bar
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_locked_sector_pending_allocations() TO authenticated;
