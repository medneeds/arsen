-- ════════════════════════════════════════════════════════════════════════
-- REGISTRO RETROATIVO: public.resolve_login(text)
-- ════════════════════════════════════════════════════════════════════════
-- CONTEXTO
-- A funcao public.resolve_login existe e esta EM USO no banco desde
-- junho/2026, mas nunca foi versionada. O frontend a chama em
-- src/contexts/AuthContext.tsx (supabase.rpc) para resolver um
-- identificador de login (CPF, email ou username) para o email real
-- cadastrado, antes de autenticar no Supabase Auth.
--
-- A auditoria de GRANTs de 22/07/2026
-- (20260722140000_harden_definer_function_grants.sql) confirmou a
-- existencia da funcao no banco e decidiu NAO revogar seus grants,
-- por ser usada pelo fluxo de login.
--
-- ORIGEM DESTE ARQUIVO
-- O corpo abaixo foi extraido do banco de producao em 16/09/2026 via
-- pg_get_functiondef(), NAO de arquivo de codigo. E copia fiel do que
-- esta rodando.
--
-- Existia um arquivo local nao commitado
-- (20260613181116_resolve_login_sql_function.sql, de 13/06/2026) com uma
-- versao ANTERIOR e DIVERGENTE desta funcao. Aquela versao usava
-- "username ILIKE v_lower", que trata % e _ como curingas: um chamador
-- anonimo enviando '%' casaria com qualquer perfil e receberia um email
-- real de volta. A versao em producao ja corrigiu isso para comparacao
-- literal com lower(). Aquele arquivo foi DESCARTADO: aplica-lo teria
-- revertido a correcao de seguranca em silencio, porque
-- CREATE OR REPLACE nao emite aviso ao sobrescrever.
--
-- EFEITO DE APLICAR
-- Nenhum. Recria a funcao identica a que ja existe. A migration serve
-- para que uma recriacao do banco a partir das migrations nao perca a
-- funcao, e para fechar a divergencia entre git e banco.
--
-- ESCOPO
-- Somente a definicao da funcao. Nao mexe em GRANTs (ver auditoria no
-- rodape), nao cria colunas, nao toca em nenhum outro objeto.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resolve_login(p_identifier text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
  v_email text;
  v_digits text;
  v_is_email boolean;
  v_is_cpf boolean;
BEGIN
  v_digits := regexp_replace(p_identifier, '\D', '', 'g');
  v_is_email := p_identifier LIKE '%@%';
  v_is_cpf := NOT v_is_email AND length(v_digits) = 11;

  IF v_is_cpf THEN
    SELECT id INTO v_id FROM public.profiles WHERE cpf = v_digits LIMIT 1;
  ELSIF v_is_email THEN
    SELECT id INTO v_id FROM public.profiles WHERE email = lower(p_identifier) LIMIT 1;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM auth.users WHERE email = lower(p_identifier) LIMIT 1;
    END IF;
  ELSE
    SELECT id INTO v_id FROM public.profiles WHERE lower(username) = lower(p_identifier) LIMIT 1;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM public.profiles WHERE email = lower(p_identifier) || '@sistema.local' LIMIT 1;
    END IF;
  END IF;

  IF v_id IS NULL THEN
    RETURN json_build_object('error', 'Identificador não encontrado');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_id LIMIT 1;

  IF v_email IS NULL THEN
    RETURN json_build_object('error', 'Conta sem email associado');
  END IF;

  RETURN json_build_object('email', v_email, 'isInternal', v_email LIKE '%@sistema.local');
END;
$function$;


-- ════════════════════════════════════════════════════════════════════════
-- AUDITORIA DE GRANTS -- NAO FAZ PARTE DA MIGRATION
-- ════════════════════════════════════════════════════════════════════════
-- Esta migration deliberadamente NAO declara GRANTs, porque os grants
-- atuais da funcao nao foram lidos do banco. Declarar um GRANT adivinhado
-- mudaria permissao em producao -- o oposto do objetivo deste arquivo.
--
-- Rode a consulta abaixo SOZINHA no SQL Editor (consultas em bloco mostram
-- apenas o resultado da ultima) para ver quem tem EXECUTE hoje:
--
--   SELECT grantee, privilege_type
--   FROM information_schema.role_routine_grants
--   WHERE routine_schema = 'public'
--     AND routine_name = 'resolve_login';
--
-- Se o resultado divergir do esperado (anon e authenticated, sem PUBLIC),
-- o ajuste vai em migration SEPARADA -- nunca editando esta, que e
-- registro historico.
--
-- PENDENCIA DE SEGURANCA REGISTRADA (nao tratada aqui)
-- A funcao devolve o email real de um profissional a um chamador NAO
-- AUTENTICADO, dado um CPF ou username valido. Isso e inerente ao desenho
-- atual do login (o front precisa do email para autenticar no Supabase
-- Auth), mas constitui oraculo de dado pessoal. Risco medio: exige
-- conhecer um identificador real e nao concede acesso. Decisao de
-- arquitetura pendente -- avaliar mover a resolucao para dentro do fluxo
-- de autenticacao, no backend.
-- ════════════════════════════════════════════════════════════════════════
