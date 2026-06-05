-- ════════════════════════════════════════════════════════════════════
-- DIAGNÓSTICO E LIMPEZA: Leitos Fantasma (_GHOST_*, ARCHIVED-*, ARQ-*)
-- ════════════════════════════════════════════════════════════════════
--
-- Causa: ao excluir um leito extra, o DELETE falhou silenciosamente
-- e o registro permaneceu no banco com bed_number prefixado por _GHOST_
-- ou similar. O frontend agora os filtra (versão corrigida), mas os
-- registros ainda existem no banco e podem distorcer queries SQL.
--
-- Rodar no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════

-- ── PASSO 1: Diagnóstico — quantos e quais são ───────────────────────

SELECT
  id,
  bed_number,
  sector,
  department,
  name,
  is_vacant,
  admission_status,
  patient_registry_id,
  updated_at
FROM patients
WHERE
  bed_number ILIKE '_GHOST_%'
  OR bed_number ILIKE 'ARCHIVED-%'
  OR bed_number ILIKE 'ARQ-%'
ORDER BY updated_at DESC;

-- ── PASSO 2: Contagem por tipo ────────────────────────────────────────

SELECT
  CASE
    WHEN bed_number ILIKE '_GHOST_%'   THEN '_GHOST_*'
    WHEN bed_number ILIKE 'ARCHIVED-%' THEN 'ARCHIVED-*'
    WHEN bed_number ILIKE 'ARQ-%'      THEN 'ARQ-*'
  END AS tipo,
  COUNT(*) AS total,
  SUM(CASE WHEN is_vacant THEN 1 ELSE 0 END)     AS vagos,
  SUM(CASE WHEN NOT is_vacant THEN 1 ELSE 0 END) AS ocupados
FROM patients
WHERE
  bed_number ILIKE '_GHOST_%'
  OR bed_number ILIKE 'ARCHIVED-%'
  OR bed_number ILIKE 'ARQ-%'
GROUP BY 1;

-- ── PASSO 3: Verificar se têm dados clínicos vinculados ───────────────
-- (para saber se é seguro deletar ou apenas desativar)

SELECT
  p.id,
  p.bed_number,
  p.sector,
  p.patient_registry_id,
  COUNT(DISTINCT ce.id) AS evolutions,
  COUNT(DISTINCT pr.id) AS prescriptions,
  COUNT(DISTINCT pm.id) AS movements
FROM patients p
LEFT JOIN clinical_evolutions ce ON ce.patient_id = p.id AND ce.archived_at IS NULL
LEFT JOIN prescriptions pr ON pr.patient_id = p.id AND pr.archived_at IS NULL
LEFT JOIN patient_movements pm ON pm.patient_id = p.id
WHERE
  p.bed_number ILIKE '_GHOST_%'
  OR p.bed_number ILIKE 'ARCHIVED-%'
  OR p.bed_number ILIKE 'ARQ-%'
GROUP BY p.id, p.bed_number, p.sector, p.patient_registry_id
ORDER BY (COUNT(DISTINCT ce.id) + COUNT(DISTINCT pr.id) + COUNT(DISTINCT pm.id)) DESC;

-- ── PASSO 4: Limpeza — só rodar após revisar os passos anteriores ─────
-- Remove leitos fantasma que estão vagos e sem dados clínicos ativos.
-- Leitos com evolutions/prescriptions ativas NÃO são deletados aqui.

DELETE FROM patients
WHERE id IN (
  SELECT p.id
  FROM patients p
  LEFT JOIN clinical_evolutions ce ON ce.patient_id = p.id AND ce.archived_at IS NULL
  LEFT JOIN prescriptions pr ON pr.patient_id = p.id AND pr.archived_at IS NULL
  WHERE (
    p.bed_number ILIKE '_GHOST_%'
    OR p.bed_number ILIKE 'ARCHIVED-%'
    OR p.bed_number ILIKE 'ARQ-%'
  )
  AND p.is_vacant = true
  GROUP BY p.id
  HAVING COUNT(DISTINCT ce.id) = 0 AND COUNT(DISTINCT pr.id) = 0
);

-- ── PASSO 5: Verificar resultado ─────────────────────────────────────

SELECT COUNT(*) AS fantasmas_restantes
FROM patients
WHERE
  bed_number ILIKE '_GHOST_%'
  OR bed_number ILIKE 'ARCHIVED-%'
  OR bed_number ILIKE 'ARQ-%';
-- Esperado: 0 (se todos eram vagos sem dados clínicos)
