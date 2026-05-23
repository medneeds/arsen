-- Remove movimentações órfãs de ÓBITO do paciente ARISTEU L12 UCI 2
-- (criadas sem documento de óbito anexado por falha silenciosa no insert)
DELETE FROM public.patient_movements
WHERE patient_id = 'e8501955-d3f0-43ac-bd10-2e74dcffb9f3'
  AND movement_type = 'OBITO'
  AND release_status = 'pending_release'
  AND NOT EXISTS (
    SELECT 1 FROM public.discharge_documents d
    WHERE d.movement_id = patient_movements.id
  );