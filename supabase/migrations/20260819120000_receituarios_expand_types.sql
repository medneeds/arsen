-- ════════════════════════════════════════════════════════════════════════
-- receituarios: amplia os tipos aceitos para cobrir também os receituários
-- emitidos pelo fluxo "Emitir documento médico" (simples e de controle
-- especial), que até aqui não gravavam em lugar nenhum — só imprimiam.
-- ════════════════════════════════════════════════════════════════════════
-- Antes: type IN ('alta', 'ambulatorial') — só o fluxo estruturado do
-- Cockpit/Alta gravava. Os receituários "simples" e "de controle especial"
-- (Portaria SVS/MS 344/1998) emitidos via MedicalDocumentDialog eram só
-- HTML impresso, sem nenhum rastro no sistema — o mesmo furo de
-- rastreabilidade já corrigido em Hemocomponente/SAT/Procedimento, mas sem
-- nem ter uma tabela para gravar. Agora os 3 fluxos gravam na mesma tabela,
-- e por consequência aparecem no mesmo histórico.

-- O nome exato da constraint de CHECK varia conforme qual das duas
-- migrations de criação da tabela rodou primeiro neste banco (ambas usavam
-- CREATE TABLE IF NOT EXISTS). Descobre e remove pelo nome real, em vez de
-- assumir um nome fixo.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'receituarios'
    AND con.contype = 'c'
    AND (pg_get_constraintdef(con.oid) ILIKE '%type = ANY%' OR pg_get_constraintdef(con.oid) ILIKE '%type IN%')
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.receituarios DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.receituarios
  ADD CONSTRAINT receituarios_type_check
  CHECK (type IN ('alta', 'ambulatorial', 'simples', 'controle_especial'));

COMMENT ON COLUMN public.receituarios.type IS
  'alta | ambulatorial: fluxo estruturado (Cockpit/Alta). simples | controle_especial: emitidos via "Emitir documento médico" (MedicalDocumentDialog). controle_especial segue a Portaria SVS/MS 344/1998 (2 vias).';
