
-- Fase 2: rebind cirúrgico de evoluções órfãs ao patient_registry
-- 2A: nome com match único em patient_registry → grava patient_registry_id
-- 2B: nome sem match no registry → marca como needs_manual_review_phase2b
-- Nada mais é tocado (sem patient_id, sem SOAP, sem status, sem leito/setor).

WITH orph AS (
  SELECT ce.id, upper(trim(ce.patient_name)) AS nm, ce.patient_name,
         ce.patient_sector, ce.patient_bed, ce.hospital_unit_id
  FROM public.clinical_evolutions ce
  WHERE ce.patient_id IS NULL
    AND ce.archived_at IS NULL
    AND ce.validated_at IS NOT NULL
    AND ce.patient_registry_id IS NULL
),
reg_match AS (
  SELECT o.nm,
         COUNT(DISTINCT pr.id) AS reg_count,
         (array_agg(pr.id ORDER BY pr.created_at DESC))[1] AS reg_id
  FROM orph o LEFT JOIN public.patient_registry pr
    ON upper(trim(pr.full_name)) = o.nm
   AND pr.merged_into_registry_id IS NULL
  GROUP BY o.nm
),
classified AS (
  SELECT o.id AS evo_id, o.nm, o.patient_name, o.patient_sector, o.patient_bed,
         o.hospital_unit_id, rm.reg_count, rm.reg_id,
         CASE WHEN rm.reg_count = 1 THEN '2A' ELSE '2B' END AS bucket
  FROM orph o JOIN reg_match rm USING (nm)
),
upd AS (
  UPDATE public.clinical_evolutions ce
     SET patient_registry_id = CASE WHEN c.bucket = '2A' THEN c.reg_id ELSE ce.patient_registry_id END,
         repoint_reason = CASE WHEN c.bucket = '2A'
                               THEN 'backfill_registry_phase2a'
                               ELSE 'needs_manual_review_phase2b' END,
         repointed_at = now()
    FROM classified c
   WHERE ce.id = c.evo_id
   RETURNING ce.id, c.bucket, c.nm, c.patient_name, c.patient_sector, c.patient_bed,
             c.hospital_unit_id, c.reg_id, c.reg_count
)
INSERT INTO public.audit_logs (
  action, table_name, record_id, new_data, hospital_unit_id
)
SELECT 'UPDATE'::audit_action,
       'clinical_evolutions',
       u.id,
       jsonb_build_object(
         'op', CASE WHEN u.bucket = '2A'
                    THEN 'REBIND_ORPHAN_EVOLUTION_PHASE2A'
                    ELSE 'REBIND_ORPHAN_EVOLUTION_PHASE2B' END,
         'patient_name_snapshot', u.patient_name,
         'normalized_name', u.nm,
         'patient_sector_snapshot', u.patient_sector,
         'patient_bed_snapshot', u.patient_bed,
         'registry_match_count', u.reg_count,
         'resolved_registry_id', u.reg_id,
         'note', CASE WHEN u.bucket = '2A'
                      THEN 'Vínculo seguro: nome único no patient_registry; patient_id permanece nulo.'
                      ELSE 'Sem âncora segura no registry; necessita revisão manual (homônimos ou ausência de cadastro).' END
       ),
       u.hospital_unit_id
FROM upd u;
