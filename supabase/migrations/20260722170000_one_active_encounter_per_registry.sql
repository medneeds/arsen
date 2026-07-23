-- ════════════════════════════════════════════════════════════════════════
-- REGRA DE NEGOCIO NO BANCO: 1 atendimento aberto por prontuario
-- ════════════════════════════════════════════════════════════════════════
-- 22/07/2026, exigencia do gestor. A regra era garantida apenas pelo front
-- (checkActiveEncounter no PatientSearchActionsDialog + guarda no
-- AdminDashboardPage). Protecao de UI pode ser contornada por chamada direta
-- a API — esta migration coloca a regra no BANCO, onde e inviolavel.
--
-- Indice unico PARCIAL: no maximo uma linha com status active/pending por
-- registry_id. Encounters closed nao entram no indice (readmissao continua
-- funcionando normalmente: o anterior esta closed, o novo entra sem conflito).
--
-- IMPORTANTE: se ja existirem duplicatas ativas no banco, a criacao do indice
-- FALHA. Rodar antes a query de diagnostico (ver comentario abaixo) e sanear.
--   SELECT registry_id, count(*) FROM public.patient_encounters
--   WHERE status IN ('active','pending') GROUP BY registry_id HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_open_encounter_per_registry
  ON public.patient_encounters (registry_id)
  WHERE status IN ('active', 'pending');

COMMENT ON INDEX public.uniq_one_open_encounter_per_registry IS
  'Regra de negocio: 1 atendimento aberto (active/pending) por prontuario. Readmissao exige que o anterior esteja closed.';
