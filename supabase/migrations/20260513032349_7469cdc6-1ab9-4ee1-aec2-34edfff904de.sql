ALTER TABLE public.saps3_assessments
ADD COLUMN IF NOT EXISTS escala_consciencia jsonb;

COMMENT ON COLUMN public.saps3_assessments.escala_consciencia IS
'Avaliação estruturada de consciência na admissão. Schema: { tipo: "GCS"|"GCS-T"|"RASS", glasgow_score: number|null, glasgow_parciais: {O,V,M}|null, rass_score: number|null, glasgow_nao_aplicavel: boolean, motivo: string|null, gcs_pre_sedacao: number|null }';