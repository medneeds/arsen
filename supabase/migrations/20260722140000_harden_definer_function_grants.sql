-- ════════════════════════════════════════════════════════════════════════
-- HARDENING DE SEGURANÇA: revoga EXECUTE público de funções DEFINER sensíveis
-- ════════════════════════════════════════════════════════════════════════
-- Auditoria 22/07/2026. A Query de GRANTs revelou que quase toda função
-- SECURITY DEFINER estava concedida a PUBLIC + anon + authenticated. Para a
-- maioria isso é inócuo (são triggers ou checam role internamente), MAS duas
-- funções sao CRITICAS: invocaveis, sem checagem de role, e destrutivas —
-- expostas ate a 'anon' (sem login):
--
--   • admin_update_user_password(email, senha): troca encrypted_password de
--     QUALQUER usuario sem checar quem chama → account takeover total.
--   • mirror_truncate_tables(text[]): TRUNCATE em tabelas sem checar role.
--
-- Nenhuma das duas e chamada pelo front (so aparecem no types.ts gerado).
-- Revogar o acesso publico nao quebra nenhum fluxo do app. service_role
-- (backend) e postgres (dono) seguem podendo chamar.
--
-- Tambem revoga oraculos de enumeracao sem uso no front
-- (verify_user_password_by_id, get_auth_user_id_by_email) e restringe as
-- funcoes setup_*_user (administrativas, email fixo) e o gerador de codigo
-- (mantido para authenticated, removido de anon/public).

-- ── CRÍTICAS: só service_role/postgres ──
REVOKE ALL ON FUNCTION public.admin_update_user_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mirror_truncate_tables(text[])       FROM PUBLIC, anon, authenticated;

-- ── Oráculos de enumeração (sem uso no front) ──
DO $g$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='verify_user_password_by_id' AND pronamespace='public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.verify_user_password_by_id FROM PUBLIC, anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_auth_user_id_by_email' AND pronamespace='public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email FROM PUBLIC, anon, authenticated';
  END IF;
END
$g$;

-- ── setup_*_user: administrativas (email fixo), fora do alcance de usuários ──
DO $s$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT proname FROM pg_proc
            WHERE pronamespace='public'::regnamespace AND proname LIKE 'setup_%_user'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END
$s$;

-- ── generate_encounter_code_v2: usada pelo front (admissão) — mantém
--    authenticated, remove anon/PUBLIC (código de atendimento não é anônimo) ──
DO $e$
DECLARE sig text;
BEGIN
  SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    INTO sig
  FROM pg_proc p WHERE p.proname='generate_encounter_code_v2' AND p.pronamespace='public'::regnamespace
  LIMIT 1;
  IF sig IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
  END IF;
END
$e$;
