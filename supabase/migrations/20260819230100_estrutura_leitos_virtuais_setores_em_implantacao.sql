-- ═══════════════════════════════════════════════════════════════════════════
-- ESTRUTURA DE LEITOS VIRTUAIS — setores em implantação
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Materializa no banco a estrutura aprovada pela Direção Clínica em 19/08/2026
-- (docs/disposicao-setores-leitos-arsen.pdf), nas DUAS representações de leito:
--
--   bed_census — censo do NIR (uma linha por leito, status 'vago')
--   patients   — leitos do mapa (linha vaga: is_vacant=true, name='')
--
-- SETORES SEMEADOS (somente os em implantação — nenhum setor operacional é
-- tocado; UTIs, UCIs, UCC e Enf. Transição ficam intactos):
--
--   sala_vermelha        SV01–SV06    6   SALA VERMELHA
--   sala_laranja         OL01–OL12   12   SALA LARANJA
--   internacao_ue        M01–M14     14   POSTO INTERNAÇÃO
--   cc_preparo           CP01–CP14   14   CC PREPARO
--   cc_bloco             CB01–CB06    6   CC BLOCO CIRÚRGICO
--   cc_rpa               CR01–CR10   10   CC RPA
--   neuro_01             L01–L10     10   NEURO 01
--   neuro_02             L11–L20     10   NEURO 02
--   clinica_cirurgica    L01–L40     40   CLÍNICA CIRÚRGICA
--   enfermaria_vascular  L01–L95     95   ENFERMARIA VASCULAR
--                                   ───
--                                   217 leitos virtuais
--
-- IDEMPOTENTE: só insere o que não existe (bed_census via ON CONFLICT na
-- UNIQUE(hospital_unit_id, sector, bed_number); patients via NOT EXISTS).
-- Rodar duas vezes não duplica nada. Leitos já existentes — ocupados ou
-- vagos — são preservados exatamente como estão.
--
-- unit/state são DERIVADOS dos leitos já cadastrados (single-tenant): a
-- migration não carrega UUID nenhum hardcoded.
--
-- LIMPEZA DE RESÍDUO DE BUG (restrita e verificável): antes da correção de
-- hoje, internacao_ue não tinha SECTOR_BED_CONFIG e o gerador nomeava leitos
-- pelo fallback genérico X01, X02… Remove APENAS linhas que satisfaçam TODAS:
-- setor semeado por esta migration, bed_number ~ '^X[0-9]+$', is_vacant=true,
-- name vazio e sem vínculo com prontuário. Leito com qualquer sinal de uso não
-- é tocado. As quantidades removidas são reportadas no NOTICE final.
--
-- UNICIDADE (achado desta auditoria): a tabela nasceu em nov/2025 com
-- UNIQUE(bed_number) GLOBAL — de quando só existiam os 4 setores de UTI.
-- Ela é incompatível com a estrutura aprovada, em que L01 existe em UTI 1,
-- UCI 1, Neuro 01, Clínica Cirúrgica e Enf. Vascular ao mesmo tempo.
-- Esta migration a substitui pela unicidade CORRETA — (hospital_unit_id,
-- sector, bed_number) — a mesma que bed_census já usa. Nenhum código depende
-- da global (verificado: nenhum onConflict/upsert sobre bed_number).
-- Se houver duplicatas legadas que impeçam a composta, ela não é criada,
-- o fato é reportado no NOTICE e o seed prossegue protegido por NOT EXISTS.
--
-- REVERSIBILIDADE: as inserções são identificáveis (leitos vagos das faixas
-- acima) e removíveis; nada de dado clínico é alterado.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_unit  uuid;
  v_state uuid;
  v_pairs int;
  v_census_ins int := 0;
  v_pat_ins    int := 0;
  v_x_census   int := 0;
  v_x_pat      int := 0;
  v_dup        int := 0;
BEGIN
  -- ── 0) Unicidade correta de leito ─────────────────────────────────────────
  -- Remove a UNIQUE global legada (no-op se já removida manualmente) e cria a
  -- composta, idêntica em espírito à de bed_census.
  ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_bed_number_key;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.patients'::regclass
      AND conname = 'patients_unit_sector_bed_key'
  ) THEN
    SELECT count(*) INTO v_dup FROM (
      SELECT 1 FROM public.patients
      GROUP BY hospital_unit_id, sector, bed_number
      HAVING count(*) > 1
    ) d;
    IF v_dup = 0 THEN
      ALTER TABLE public.patients
        ADD CONSTRAINT patients_unit_sector_bed_key
        UNIQUE (hospital_unit_id, sector, bed_number);
      RAISE NOTICE 'Unicidade composta (unit, sector, bed_number) criada em patients.';
    ELSE
      RAISE NOTICE 'ATENÇÃO: % combinações (unit, sector, bed_number) duplicadas em patients — unicidade composta NÃO criada; revisar duplicatas. Seed prossegue protegido por NOT EXISTS.', v_dup;
    END IF;
  END IF;
  -- ── Par (unidade, estado) derivado do que já existe ────────────────────────
  SELECT count(DISTINCT (hospital_unit_id, state_id)) INTO v_pairs FROM public.patients;
  IF v_pairs = 0 THEN
    RAISE EXCEPTION 'Nenhum leito cadastrado em patients: impossível derivar hospital_unit_id/state_id. Abortando sem alterar nada.';
  ELSIF v_pairs > 1 THEN
    RAISE EXCEPTION 'Mais de um par (hospital_unit_id, state_id) em patients (%). Plataforma single-tenant esperava 1. Abortando sem alterar nada.', v_pairs;
  END IF;

  SELECT hospital_unit_id, state_id INTO v_unit, v_state
  FROM public.patients GROUP BY 1, 2 LIMIT 1;

  -- ── Faixas da estrutura aprovada ───────────────────────────────────────────
  CREATE TEMP TABLE _estrutura ON COMMIT DROP AS
  SELECT * FROM (
    SELECT 'sala_vermelha'::text sector, 'SALA VERMELHA'::text department, 'SV'||lpad(n::text,2,'0') bed_number, n ord FROM generate_series(1,6) n
    UNION ALL SELECT 'sala_laranja','SALA LARANJA','OL'||lpad(n::text,2,'0'), n FROM generate_series(1,12) n
    UNION ALL SELECT 'internacao_ue','POSTO INTERNAÇÃO','M'||lpad(n::text,2,'0'), n FROM generate_series(1,14) n
    UNION ALL SELECT 'cc_preparo','CC PREPARO','CP'||lpad(n::text,2,'0'), n FROM generate_series(1,14) n
    UNION ALL SELECT 'cc_bloco','CC BLOCO CIRÚRGICO','CB'||lpad(n::text,2,'0'), n FROM generate_series(1,6) n
    UNION ALL SELECT 'cc_rpa','CC RPA','CR'||lpad(n::text,2,'0'), n FROM generate_series(1,10) n
    UNION ALL SELECT 'neuro_01','NEURO 01','L'||lpad(n::text,2,'0'), n FROM generate_series(1,10) n
    UNION ALL SELECT 'neuro_02','NEURO 02','L'||lpad(n::text,2,'0'), n FROM generate_series(11,20) n
    UNION ALL SELECT 'clinica_cirurgica','CLÍNICA CIRÚRGICA','L'||lpad(n::text,2,'0'), n FROM generate_series(1,40) n
    UNION ALL SELECT 'enfermaria_vascular','ENFERMARIA VASCULAR','L'||lpad(n::text,2,'0'), n FROM generate_series(1,95) n
  ) t;

  -- ── Resíduo do bug X01/X02 (guardas triplas; só nos setores desta migration)
  WITH del AS (
    DELETE FROM public.bed_census bc
    WHERE bc.hospital_unit_id = v_unit
      AND bc.sector IN (SELECT DISTINCT sector FROM _estrutura)
      AND bc.bed_number ~ '^X[0-9]+$'
      AND COALESCE(bc.status,'vago') = 'vago'
      AND bc.patient_id IS NULL
    RETURNING 1
  ) SELECT count(*) INTO v_x_census FROM del;

  WITH del AS (
    DELETE FROM public.patients p
    WHERE p.hospital_unit_id = v_unit
      AND p.sector IN (SELECT DISTINCT sector FROM _estrutura)
      AND p.bed_number ~ '^X[0-9]+$'
      AND COALESCE(p.is_vacant,false) = true
      AND COALESCE(p.name,'') = ''
      AND p.patient_registry_id IS NULL
    RETURNING 1
  ) SELECT count(*) INTO v_x_pat FROM del;

  -- ── bed_census: censo do NIR ───────────────────────────────────────────────
  WITH ins AS (
    INSERT INTO public.bed_census (hospital_unit_id, state_id, sector, bed_number, status)
    SELECT v_unit, v_state, e.sector, e.bed_number, 'vago'
    FROM _estrutura e
    ON CONFLICT (hospital_unit_id, sector, bed_number) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_census_ins FROM ins;

  -- ── patients: leitos vagos do mapa ─────────────────────────────────────────
  WITH ins AS (
    INSERT INTO public.patients (
      hospital_unit_id, state_id, department, sector, bed_number,
      name, age, is_vacant, display_order,
      diagnoses, medical_history, relevant_exams, pendencies, schedule, admission_history
    )
    SELECT v_unit, v_state, e.department, e.sector, e.bed_number,
           '', '', true, e.ord,
           '', '', '', '', '', ''
    FROM _estrutura e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.hospital_unit_id = v_unit
        AND p.sector = e.sector
        AND p.bed_number = e.bed_number
    )
    RETURNING 1
  ) SELECT count(*) INTO v_pat_ins FROM ins;

  RAISE NOTICE 'Estrutura de leitos: bed_census +% | patients +% | resíduo X removido: census=%, patients=%',
    v_census_ins, v_pat_ins, v_x_census, v_x_pat;
END $$;
