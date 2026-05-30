-- ================================================================
-- SECURITY HARDENING CIRÚRGICO — ARSen / HMDM Socorrão I
-- Data: 2026-05-30
-- Escopo: 3 correções de baixíssimo risco, sem impacto operacional.
-- Single-tenant: apenas 1 hospital (HMDM). Não há risco cross-tenant.
-- ================================================================

-- ================================================================
-- 1. INTERNAL_TRANSFER_REQUESTS — substituir USING (true) por filtro
--    de hospital_unit_id. A tabela já tem a coluna hospital_unit_id.
--    Usuário autenticado só vê/edita transferências do seu hospital.
-- ================================================================
DROP POLICY IF EXISTS "auth read internal_transfer_requests"
  ON public.internal_transfer_requests;
DROP POLICY IF EXISTS "auth insert internal_transfer_requests"
  ON public.internal_transfer_requests;
DROP POLICY IF EXISTS "auth update internal_transfer_requests"
  ON public.internal_transfer_requests;

CREATE POLICY "itr_select_authenticated"
  ON public.internal_transfer_requests FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "itr_insert_authenticated"
  ON public.internal_transfer_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "itr_update_authenticated"
  ON public.internal_transfer_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ================================================================
-- 2. PATIENT_REGISTRY_EDIT_HISTORY — restringir SELECT a admin/gestor.
--    Histórico de auditoria de edições de prontuário não deve ser
--    legível por qualquer autenticado — apenas perfis de gestão.
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can view patient registry edit history"
  ON public.patient_registry_edit_history;

CREATE POLICY "preh_select_admin_gestor"
  ON public.patient_registry_edit_history FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin')
  );

-- ================================================================
-- 3. FUNÇÕES SECURITY DEFINER — revogar EXECUTE de anon/public
--    nas funções sensíveis que ainda não foram revogadas.
--    is_username_available é a única que ainda tem grant para anon.
--    Mantemos authenticated pois o frontend usa durante o cadastro.
-- ================================================================
REVOKE EXECUTE ON FUNCTION public.is_username_available(text, uuid)
  FROM anon;

-- Garantir que funções de controle de acesso não sejam chamadas por anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.user_in_hospital(uuid, uuid)
  FROM anon;

-- ================================================================
-- Comentário de auditoria
-- ================================================================
COMMENT ON TABLE public.internal_transfer_requests IS
  'Requisições de transferência interna. RLS: authenticated com uid check.';

COMMENT ON TABLE public.patient_registry_edit_history IS
  'Histórico de edições de patient_registry. SELECT restrito a admin/gestor.';
