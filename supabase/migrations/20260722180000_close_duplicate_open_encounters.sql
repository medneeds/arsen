-- ════════════════════════════════════════════════════════════════════════
-- SANEAMENTO: fecha encounters ABERTOS duplicados por prontuario
-- ════════════════════════════════════════════════════════════════════════
-- 22/07/2026. Diagnostico na staging encontrou 7 prontuarios com mais de um
-- atendimento aberto (um deles com 3) — residuo de maio/junho, anterior as
-- guardas anti-duplicacao (front: 094db0d6; banco: trigger 20260722170000).
-- Padrao tipico: cliques repetidos (MARIA DE JESUS gerou 3 encounters em 3
-- minutos; DARLEILSON 2 em 18 minutos).
--
-- CRITERIO (nao e "manter o mais recente"): mantem o encounter com MAIS dados
-- clinicos (evolucoes + sinais vitais), desempatando pelo mais recente. Isso e
-- essencial — em 2 casos o encounter com historico era o MAIS ANTIGO
-- (JOSE MARQUES tinha 33 evolucoes no antigo e 0 no novo; JOAO LUCAS, 2 e 0).
-- Fechar por "mais recente" desvincularia o historico clinico do atendimento
-- ativo desses pacientes.
--
-- Os encounters fechados aqui nao tinham NENHUM dado clinico vinculado.

WITH abertos AS (
  SELECT pe.id, pe.registry_id, pe.created_at,
         (SELECT count(*) FROM public.clinical_evolutions e WHERE e.encounter_id = pe.id)
       + (SELECT count(*) FROM public.vital_signs v WHERE v.encounter_id = pe.id) AS dados
  FROM public.patient_encounters pe
  WHERE pe.status IN ('active','pending')
    AND pe.registry_id IN (
      SELECT registry_id FROM public.patient_encounters
      WHERE status IN ('active','pending')
      GROUP BY registry_id HAVING count(*) > 1
    )
),
ranked AS (
  SELECT a.*, row_number() OVER (
           PARTITION BY a.registry_id ORDER BY a.dados DESC, a.created_at DESC
         ) AS rn
  FROM abertos a
)
UPDATE public.patient_encounters pe
SET status = 'closed',
    discharge_date = COALESCE(pe.discharge_date, pe.updated_at, now()),
    updated_at = now()
FROM ranked r
WHERE pe.id = r.id
  AND r.rn > 1;
