UPDATE public.clinical_evolutions
SET archived_at = now(),
    archive_reason = 'residual_cleanup_bed_l45_transicao',
    archived_from_patient_id = patient_id
WHERE id IN (
  'd9139345-da23-45cf-b0ca-559ffc9e1566',
  'fc915934-e37c-4737-8384-e31bbea161a3',
  'ef1b1167-ec2d-4cc2-b3f7-a0b84c96448b',
  '0f470df4-d2f3-436d-86ff-227c121783cd'
)
AND patient_name = 'LUCAS NOEL MENDES FERREIRA'
AND patient_bed = 'L45'
AND patient_sector = 'enfermaria_transicao'
AND archived_at IS NULL;