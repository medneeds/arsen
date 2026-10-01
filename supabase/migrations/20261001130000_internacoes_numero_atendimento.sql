-- ════════════════════════════════════════════════════════════════════════
-- NÚMERO DE ATENDIMENTO EM internacoes (paridade com staging/main)
-- ════════════════════════════════════════════════════════════════════════
-- CONTEXTO
-- No schema antigo (staging/main) o nº de atendimento vivia em
-- patient_encounters.encounter_code, gerado pelo trigger
-- generate_encounter_code() a partir da sequência global
-- public.encounter_global_seq (12 dígitos, ex.: 000000000823).
-- Na migração para o schema novo, patient_encounters deixou de existir e
-- internacoes não ganhou coluna equivalente: o label ATENDIMENTO ficou
-- sempre vazio (ver supabase/MIGRACAO_DEGRADACOES.md).
--
-- O QUE ESTA MIGRATION FAZ
-- 1) Garante a sequência public.encounter_global_seq (reaproveita se já
--    existir → numeração continua de onde parou, sem colidir com códigos
--    antigos).
-- 2) Adiciona internacoes.numero_atendimento (text).
-- 3) Trigger BEFORE INSERT: preenche o nº quando vier vazio — mesmo formato
--    de 12 dígitos da staging.
-- 4) Trigger BEFORE UPDATE: o nº é imutável depois de atribuído
--    (1 internação = 1 nº de atendimento até o desfecho; transferência
--    interna só troca leito_id na MESMA linha, então o nº se mantém).
-- 5) Backfill: internações existentes sem nº recebem um, em ordem de
--    data_entrada.
-- 6) UNIQUE em numero_atendimento.
--
-- NÃO TOCA
-- RLS, grants de tabela, demais colunas de internacoes, pacientes, leitos,
-- fluxos de alta/transferência.
--
-- Idempotente: pode ser reaplicada sem efeito colateral.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Sequência global (mesma da staging)
CREATE SEQUENCE IF NOT EXISTS public.encounter_global_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- 2) Coluna
ALTER TABLE public.internacoes
  ADD COLUMN IF NOT EXISTS numero_atendimento text;

COMMENT ON COLUMN public.internacoes.numero_atendimento IS
  'Nº de atendimento (12 dígitos, sequência public.encounter_global_seq). '
  'Gerado no INSERT e imutável. Equivalente a patient_encounters.encounter_code do schema antigo.';

-- 3) Geração no INSERT
CREATE OR REPLACE FUNCTION public.internacoes_gerar_numero_atendimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.numero_atendimento IS NULL OR NEW.numero_atendimento = '' THEN
    NEW.numero_atendimento := lpad(nextval('public.encounter_global_seq')::text, 12, '0');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.internacoes_gerar_numero_atendimento() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_internacoes_gerar_numero_atendimento ON public.internacoes;
CREATE TRIGGER trg_internacoes_gerar_numero_atendimento
  BEFORE INSERT ON public.internacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.internacoes_gerar_numero_atendimento();

-- 4) Imutabilidade no UPDATE (preserva o nº já atribuído)
CREATE OR REPLACE FUNCTION public.internacoes_preservar_numero_atendimento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.numero_atendimento IS NOT NULL AND OLD.numero_atendimento <> '' THEN
    NEW.numero_atendimento := OLD.numero_atendimento;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.internacoes_preservar_numero_atendimento() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_internacoes_preservar_numero_atendimento ON public.internacoes;
CREATE TRIGGER trg_internacoes_preservar_numero_atendimento
  BEFORE UPDATE OF numero_atendimento ON public.internacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.internacoes_preservar_numero_atendimento();

-- 5) Backfill das internações existentes (ordem cronológica de entrada)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
      FROM public.internacoes
     WHERE numero_atendimento IS NULL OR numero_atendimento = ''
     ORDER BY data_entrada, criado_em, id
  LOOP
    UPDATE public.internacoes
       SET numero_atendimento = lpad(nextval('public.encounter_global_seq')::text, 12, '0')
     WHERE id = r.id;
  END LOOP;
END $$;

-- 6) Unicidade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'internacoes_numero_atendimento_key'
  ) THEN
    ALTER TABLE public.internacoes
      ADD CONSTRAINT internacoes_numero_atendimento_key UNIQUE (numero_atendimento);
  END IF;
END $$;
