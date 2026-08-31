-- ═══════════════════════════════════════════════════════════════════════════
-- CORREÇÃO: cleanup_locked_sector_pending_allocations cancelava sinalizações
-- de setores ATIVOS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CAUSA RAIZ
-- O mecanismo de "setor sem implantação ativa" tem duas metades que não
-- conversam: a lista visual (LOCKED_DEPARTMENTS, frontend) foi esvaziada em
-- 05/08/2026 para liberar setores em teste, mas a lista desta função — que
-- CANCELA registros — continuou com 14 setores, incluindo sala_vermelha,
-- sala_laranja e internacao_ue, que estão sendo ativados.
--
-- Caso concreto: 1 pré-admissão em `aguardando_leito` com destination_sector
-- 'Internação UE' satisfazia todas as condições de cancelamento automático.
--
-- DECISÃO (Direção Clínica, 19/08/2026) — três níveis de cobertura:
--   clinical: red, yellow, blue, outside, ucc, enfermaria_transicao,
--             sala_vermelha, sala_laranja, internacao_ue
--   tracking: clinica_cirurgica, enfermaria_vascular, neuro_01, neuro_02,
--             cc_preparo, cc_bloco, cc_rpa
--   out:      ue_vertical, observacao_clinica, riv
--
-- SOMENTE o nível "out" pode ter sinalizações canceladas automaticamente.
-- Setor "tracking" tem paciente internado e rastreado — cancelar suas
-- sinalizações descartaria pacientes reais.
--
--
-- TRÊS DEFEITOS CORRIGIDOS (comprovados em espelho local do schema):
--
-- (1) LISTA: 14 setores, incluindo ativos. Corrigido para os 3 fora do escopo.
--
-- (2) VOCABULÁRIO: o bloco de bed_allocation_requests gravava status
--     'cancelled', mas a constraint bed_allocation_requests_status_check só
--     aceita pending/approved/discussing/rejected. Resultado: sempre que havia
--     QUALQUER pedido de leito >24h pendente em setor da lista, a função
--     explodia em violação de constraint e a TRANSAÇÃO INTEIRA revertia —
--     inclusive os cancelamentos de pré-admissão do mesmo ciclo. Como o front
--     engole a exceção (console.debug), a falha era invisível. Corrigido para
--     'rejected', e apenas pedidos 'pending' são elegíveis ('discussing' tem
--     humano envolvido; a decisão fica com ele).
--
-- (3) CAIXA: destination_sector guarda texto como o front grava — p.ex.
--     'Internação UE' capitalizado — e a comparação era case-sensitive contra
--     'internacao_ue'/'INTERNAÇÃO UE'. Registros capitalizados escapavam por
--     acaso. Corrigido com comparação em lower().
--
-- Espelha OUT_OF_SCOPE_SECTOR_CODES em src/config/sectorCoverage.ts.
-- Ver docs/sql-cadeado-setores-dessincronizado.md.
--
-- REVERSIBILIDADE: total — CREATE OR REPLACE; a lista anterior está registrada
-- no documento acima. Este bloco não altera dado algum por si.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_locked_sector_pending_allocations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Apenas setores FORA do escopo de internação (nível "out"), em minúsculas:
  -- a comparação é feita sobre lower(coluna) para cobrir código interno
  -- ('ue_vertical'), rótulo capitalizado ('Observação Clínica') e maiúsculas.
  v_locked TEXT[] := ARRAY[
    'ue_vertical', 'ue vertical',
    'observacao_clinica', 'observação clínica',
    'riv'
  ];
  v_pre INT := 0;
  v_bar INT := 0;
BEGIN
  -- 1) pre_admissions: cancela sinalizações pendentes >24h em setor fora do escopo
  WITH cancelled AS (
    UPDATE public.pre_admissions
       SET status = 'cancelado',
           updated_at = now(),
           notes = COALESCE(notes,'') ||
             CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE E'\n' END ||
             '[Cancelado automaticamente em ' || to_char(now(),'DD/MM/YYYY HH24:MI') ||
             ' — setor sem implantação ativa, sinalização não admitida em 24h. Prontuário preservado.]'
     WHERE created_at < now() - interval '24 hours'
       AND COALESCE(status,'') IN ('pre_admissao','classificado','aguardando_leito','aguardando_leito_uti')
       AND lower(COALESCE(destination_sector,'')) = ANY(v_locked)
    RETURNING id, NULL::uuid AS patient_id, patient_name, destination_sector
  )
  INSERT INTO public.locked_sector_cleanup_log (source_table, source_id, patient_id, patient_name, sector)
  SELECT 'pre_admissions', id, patient_id, patient_name, destination_sector FROM cancelled;
  GET DIAGNOSTICS v_pre = ROW_COUNT;

  -- 2) bed_allocation_requests: rejeita pedidos 'pending' >24h em setor fora
  --    do escopo. 'rejected' é o único estado terminal negativo que a
  --    constraint aceita; 'discussing' fica com o humano que está discutindo.
  WITH cancelled AS (
    UPDATE public.bed_allocation_requests
       SET status = 'rejected',
           rejection_reason = COALESCE(rejection_reason,'') ||
             CASE WHEN COALESCE(rejection_reason,'') = '' THEN '' ELSE ' | ' END ||
             'Cancelado automaticamente — setor sem implantação ativa, não admitido em 24h.',
           reviewed_at = now(),
           updated_at = now()
     WHERE created_at < now() - interval '24 hours'
       AND COALESCE(status,'') = 'pending'
       AND lower(COALESCE(requested_sector,'')) = ANY(v_locked)
    RETURNING id, patient_id, requested_sector
  )
  INSERT INTO public.locked_sector_cleanup_log (source_table, source_id, patient_id, sector)
  SELECT 'bed_allocation_requests', id, patient_id, requested_sector FROM cancelled;
  GET DIAGNOSTICS v_bar = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'cleaned_at', now(),
    'pre_admissions_cancelled', v_pre,
    'bed_allocation_requests_cancelled', v_bar
  );
END;
$$;

-- Mantém o grant EXATAMENTE como estava: somente authenticated. Nunca anon/PUBLIC.
GRANT EXECUTE ON FUNCTION public.cleanup_locked_sector_pending_allocations() TO authenticated;
