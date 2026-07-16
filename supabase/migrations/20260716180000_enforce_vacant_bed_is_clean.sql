-- ════════════════════════════════════════════════════════════════════════
-- INVARIANTE: LEITO VAGO = LEITO LIMPO (resíduo zero de dados de paciente)
-- ════════════════════════════════════════════════════════════════════════
-- Auditoria de 16/07/2026 encontrou campos clínicos que não eram limpos por
-- todos os fluxos de movimentação (ex: medical_responsibility, uti_weight_kg,
-- internment_notes ficavam no leito de origem após transferência interna;
-- is_palliative e isolation_precautions não eram limpos por nenhum fluxo de
-- movimentação) — deixando resíduos do paciente anterior para o próximo
-- ocupante do leito.
--
-- Em vez de manter listas de limpeza manuais em 8+ pontos (3 RPCs atômicas,
-- fallbacks sequenciais no front, fluxo de alta), este trigger impõe o
-- invariante no próprio banco: sempre que uma linha de patients estiver com
-- is_vacant = true, TODAS as colunas não-estruturais são zeradas
-- automaticamente — de forma DINÂMICA (information_schema), cobrindo também
-- colunas criadas no futuro sem manutenção adicional.
--
-- A lista de exclusão contém apenas colunas ESTRUTURAIS do leito (identidade
-- física/organizacional do slot), que devem sobreviver à vacância.

CREATE OR REPLACE FUNCTION public.tg_enforce_vacant_bed_is_clean()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_patch jsonb := '{}'::jsonb;
  v_col   record;
BEGIN
  -- Só age quando o leito está (ou está ficando) vago
  IF NEW.is_vacant IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  FOR v_col IN
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'patients'
      AND column_name NOT IN (
        -- Colunas estruturais do leito (preservadas):
        'id', 'bed_number', 'sector', 'department',
        'state_id', 'hospital_unit_id',
        'is_vacant', 'is_active', 'is_blocked', 'block_reason',
        'bed_type', 'display_order',
        'created_at', 'updated_at', 'created_by'
      )
  LOOP
    IF v_col.column_name = 'name' THEN
      -- Convenção da aplicação: leito vago tem name = '' (não NULL)
      v_patch := v_patch || jsonb_build_object('name', '');
    ELSIF v_col.is_nullable = 'YES' THEN
      v_patch := v_patch || jsonb_build_object(v_col.column_name, NULL);
    ELSIF v_col.data_type = 'boolean' THEN
      v_patch := v_patch || jsonb_build_object(v_col.column_name, false);
    ELSIF v_col.data_type IN ('text', 'character varying') THEN
      v_patch := v_patch || jsonb_build_object(v_col.column_name, '');
    END IF;
    -- Colunas NOT NULL de outros tipos (numéricas/datas) são deixadas como
    -- estão — hoje não existem colunas clínicas nessa condição; se surgirem,
    -- terão default e continuarão cobertas pela aplicação.
  END LOOP;

  NEW := jsonb_populate_record(NEW, v_patch);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_enforce_vacant_bed_is_clean() FROM PUBLIC, anon;

-- BEFORE, para corrigir a própria linha antes de gravar.
-- Cobre INSERT (leito criado vago) e UPDATE (leito sendo esvaziado OU
-- qualquer escrita em leito já vago — impede "vazamento reverso").
DROP TRIGGER IF EXISTS trg_enforce_vacant_bed_is_clean ON public.patients;
CREATE TRIGGER trg_enforce_vacant_bed_is_clean
  BEFORE INSERT OR UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enforce_vacant_bed_is_clean();

-- ────────────────────────────────────────────────────────────────────────
-- Saneamento retroativo: limpa resíduos existentes em leitos já vagos.
-- (Dinâmico, mesma lista de exclusão do trigger — basta um UPDATE no-op
--  para o trigger BEFORE reprocessar cada linha vaga.)
-- ────────────────────────────────────────────────────────────────────────
UPDATE public.patients SET updated_at = now() WHERE is_vacant = TRUE;
