-- ════════════════════════════════════════════════════════════════════════
-- HARDENING DE SEGURANÇA (CRÍTICO): revoga EXECUTE público de funções
-- SECURITY DEFINER sensíveis, invocáveis e SEM guarda de role.
-- ════════════════════════════════════════════════════════════════════════
-- Auditoria 22/07/2026. A auditoria de GRANTs revelou funções DEFINER
-- concedidas a PUBLIC + anon + authenticated. Cruzando "invocável" (não é
-- trigger) × "sem checagem de role interna" × "destrutiva/sensível",
-- 8 funcoes eram vulnerabilidade REAL — expostas ate a 'anon' (sem login):
--
--   • admin_update_user_password — troca encrypted_password de QUALQUER
--     usuario sem checar quem chama → account takeover total (a mais grave).
--   • mirror_truncate_tables — TRUNCATE em tabelas sem checar role.
--   • get_auth_user_id_by_email / verify_user_password_by_id — oraculos de
--     enumeracao/validacao de contas.
--   • setup_{visitante,farmacia,medicoporta,medicouti}_user — mexem em roles.
--
-- Nenhuma e chamada pelo front. Revogar nao quebra fluxo do app.
-- Bloco DINAMICO (descobre a assinatura real via pg_get_function_identity_
-- arguments) — o git divergia do banco nas assinaturas.
--
-- NAO revogadas (verificado): resolve_login e promote_unidentified_patient
-- sao usadas pelo front (login/recepcao); merge_/promote_unidentified e
-- verify_own_password ja tem guarda interna; funcoes admin com guarda
-- (admin_hard_delete_patient, promote_to_super_admin, merge_patient_registries,
-- repoint_patient_history) ja checam is_developer/admin internamente.

DO $revoke$
DECLARE
  r record;
  alvos text[] := ARRAY[
    'admin_update_user_password','mirror_truncate_tables',
    'get_auth_user_id_by_email','verify_user_password_by_id',
    'setup_visitante_user','setup_farmacia_user',
    'setup_medicoporta_user','setup_medicouti_user'
  ];
BEGIN
  FOR r IN
    SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = ANY(alvos)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END
$revoke$;
