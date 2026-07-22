-- ════════════════════════════════════════════════════════════════════════
-- LIMPEZA DE DADOS: fecha "encounters zumbi" (aberto apesar de alta/óbito)
-- ════════════════════════════════════════════════════════════════════════
-- 22/07/2026. O bug corrigido em 20260722... (closeActiveEncounter — fechamento
-- por registry) fazia a alta/óbito/transf-externa NÃO fechar o encounter quando
-- o paciente havia sido transferido internamente antes da alta (fechamento
-- por patient_id/leito não encontrava o encounter cujo vínculo o repoint mudou).
-- Resultado: pacientes marcados como alta_dada/obito no leito com encounter
-- ainda ABERTO — que a próxima readmissão trataria como "ativo", misturando
-- histórico.
--
-- Diagnóstico no staging encontrou 1 caso (LEUDILENE ROCHA GOMES, L09),
-- já fechado manualmente. Esta migration reaplica a correção de forma
-- idempotente para qualquer ambiente. O critério (paciente já em alta/óbito no
-- leito) garante que só encounters que DEVIAM estar fechados são tocados —
-- nenhum atendimento legítimo em curso é afetado.

UPDATE public.patient_encounters pe
SET status = 'closed',
    discharge_date = COALESCE(pe.discharge_date, pe.updated_at, now()),
    updated_at = now()
FROM public.patients p
WHERE p.patient_registry_id = pe.registry_id
  AND p.admission_status IN ('alta_dada', 'obito')
  AND pe.status <> 'closed';
