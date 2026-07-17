-- ════════════════════════════════════════════════════════════════════════
-- LEITOS-FANTASMA INVISÍVEIS NO NÍVEL DO BANCO
-- ════════════════════════════════════════════════════════════════════════
-- Bug reportado em 16/07/2026: o diálogo Realocar/Permutar exibia leitos
-- inexistentes com nomes "ARCHIVED-EXTRA-yellow-<timestamp>". Esses são
-- leitos extras arquivados pelo fallback do deletePatient (renomeação do
-- bed_number quando o DELETE falha), mantidos no banco para preservar a
-- auditoria de patient_movements.
--
-- O ocultamento dependia de filtro no FRONTEND (GHOST_PREFIXES em
-- usePatients) — mas 28 componentes/páginas consultam a tabela patients
-- diretamente e não aplicam o filtro. Mesmo padrão frágil das listas
-- manuais de cópia/limpeza: regra espalhada, esquecimento garantido.
--
-- Esta policy RESTRITIVA (AND com as demais) esconde os leitos-fantasma de
-- TODA consulta SELECT feita pelos roles de cliente, cobrindo os 28 pontos
-- atuais e qualquer tela futura sem manutenção. Prefixos herdados de
-- versões anteriores do fallback: ARQ-, ARCHIVED-, _GHOST_.
--
-- Nota: service_role (edge functions, backups) NÃO é afetado — RLS não se
-- aplica a ele — então auditoria e manutenção continuam enxergando tudo.

DROP POLICY IF EXISTS "Ghost beds hidden from clients" ON public.patients;
CREATE POLICY "Ghost beds hidden from clients"
  ON public.patients
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated, anon
  USING (
    bed_number IS NULL
    OR (
      bed_number NOT ILIKE 'ARQ-%'
      AND bed_number NOT ILIKE 'ARCHIVED-%'
      AND bed_number NOT ILIKE '\_GHOST\_%'
    )
  );
