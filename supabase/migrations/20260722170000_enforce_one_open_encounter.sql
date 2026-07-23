-- ════════════════════════════════════════════════════════════════════════
-- REGRA NO BANCO: 1 atendimento aberto por prontuario, exceto gestor/admin
-- ════════════════════════════════════════════════════════════════════════
-- 22/07/2026, exigencia do gestor: medico comum NAO pode abrir um 2o
-- atendimento para paciente com atendimento ativo — "de forma alguma".
-- A regra existia so no front (checkActiveEncounter + guarda do
-- AdminDashboardPage), e protecao de UI e contornavel por chamada direta a API.
--
-- POR QUE TRIGGER E NAO INDICE UNICO: um indice unico parcial tornaria a regra
-- absoluta e quebraria tambem o fluxo legitimo de "forcar novo atendimento"
-- (gestor/admin, com justificativa + senha + auditoria). O trigger permite
-- exatamente o desenho pretendido: bloqueia todos, libera gestor/admin.

CREATE OR REPLACE FUNCTION public.enforce_one_open_encounter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_open_count int;
  v_is_privileged boolean := false;
BEGIN
  -- So interessa quando o novo encounter nasce ABERTO
  IF NEW.status IS NULL OR NEW.status NOT IN ('active', 'pending') THEN
    RETURN NEW;
  END IF;

  IF NEW.registry_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_open_count
  FROM public.patient_encounters pe
  WHERE pe.registry_id = NEW.registry_id
    AND pe.status IN ('active', 'pending')
    AND (TG_OP = 'INSERT' OR pe.id <> NEW.id);

  IF v_open_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Ja existe atendimento aberto: so gestor/admin podem prosseguir
  -- (fluxo de abertura forcada, que na UI exige justificativa + senha).
  BEGIN
    v_is_privileged :=
      (v_caller IS NOT NULL AND (
        public.has_role(v_caller, 'admin'::public.app_role)
        OR public.is_gestor(v_caller)
      ));
  EXCEPTION WHEN OTHERS THEN
    -- Se as funcoes de papel nao existirem/derem erro, nega por seguranca.
    v_is_privileged := false;
  END;

  -- service_role/postgres (backend, migrations) nao sao bloqueados.
  IF v_caller IS NULL AND current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Este paciente ja possui um atendimento em aberto. Encerre o atendimento atual (alta, transferencia externa ou obito) antes de abrir um novo.'
    USING ERRCODE = '23505';
END
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_one_open_encounter ON public.patient_encounters;
CREATE TRIGGER trg_enforce_one_open_encounter
  BEFORE INSERT OR UPDATE OF status, registry_id ON public.patient_encounters
  FOR EACH ROW EXECUTE FUNCTION public.enforce_one_open_encounter();

COMMENT ON FUNCTION public.enforce_one_open_encounter() IS
  'Regra de negocio: 1 atendimento aberto (active/pending) por prontuario. Bloqueia no banco; gestor/admin podem forcar (fluxo auditado com justificativa e senha na UI).';
