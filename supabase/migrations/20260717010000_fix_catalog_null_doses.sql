-- ════════════════════════════════════════════════════════════════════════
-- CORRIGE default_dose NULO E CONCENTRAÇÃO ERRADA NO CATÁLOGO OFICIAL (DB)
-- ════════════════════════════════════════════════════════════════════════
-- Investigação de 16/07/2026: rowsToEntries() (useUnifiedMedicationCatalog)
-- tinha bug de mapeamento (defaultDose hardcoded como "" — corrigido em
-- commit separado no front). Mas o diagnóstico no banco revelou que os
-- dados de origem também faltavam: default_dose estava NULL para
-- Ácido Tranexâmico, Amiodarona e Ciprofloxacino no catálogo oficial
-- (medication_presentations) — o mapeamento agora funciona, mas não havia
-- nada para mostrar.
--
-- Também corrigido: Ácido Tranexâmico tinha concentração cadastrada como
-- 250MG/ML (5x mais concentrado que a apresentação real, confirmado pelo
-- gestor) — o correto é 250mg diluído em 5mL = 50MG/ML (padrão comercial,
-- ex. Transamin).
--
-- Ciprofloxacino "Outro — 2MG": confirmado por busca (bula Fresenius Kabi)
-- como solução injetável 2mg/mL, frasco de 100mL ou 200mL — mesma bolsa EV
-- já modelada no catálogo estático hoje (200mg/100mL ou 400mg/200mL).
--
-- Nota: o schema de medication_presentations não tem coluna de quantidade
-- padrão (default_quantity) — diferente do catálogo estático, onde
-- adicionamos esse campo hoje. Itens vindos do banco continuam exigindo
-- que o médico ajuste a Qtd manualmente para o total correto quando a
-- apresentação precisar de mais de 1 unidade.

-- 1) Ácido Tranexâmico — corrige concentração errada + preenche dose
UPDATE public.medication_presentations mp
SET concentration = '50MG/ML',
    default_dose = '250mg (5mL)'
FROM public.medication_catalog mc
WHERE mp.medication_id = mc.id
  AND mc.generic_name = 'Ácido Tranexâmico'
  AND mp.form = 'Ampola'
  AND mp.concentration = '250MG/ML';

-- 2) Amiodarona — Ampola (concentração já correta, só faltava a dose)
UPDATE public.medication_presentations mp
SET default_dose = '150mg (3mL)'
FROM public.medication_catalog mc
WHERE mp.medication_id = mc.id
  AND mc.generic_name = 'Amiodarona'
  AND mp.form = 'Ampola'
  AND mp.concentration = '50MG/ML';

-- 3) Amiodarona — Comprimido
UPDATE public.medication_presentations mp
SET default_dose = '1 comp (200mg)'
FROM public.medication_catalog mc
WHERE mp.medication_id = mc.id
  AND mc.generic_name = 'Amiodarona'
  AND mp.form = 'Comprimido'
  AND mp.concentration = '200MG';

-- 4) Ciprofloxacino — solução injetável EV (bolsa), confirmado por busca
UPDATE public.medication_presentations mp
SET default_dose = '200mg (100mL)'
FROM public.medication_catalog mc
WHERE mp.medication_id = mc.id
  AND mc.generic_name = 'Ciprofloxacino'
  AND mp.form = 'Outro'
  AND mp.concentration = '2MG';

-- 5) Ciprofloxacino — Comprimido
UPDATE public.medication_presentations mp
SET default_dose = '1 comp (500mg)'
FROM public.medication_catalog mc
WHERE mp.medication_id = mc.id
  AND mc.generic_name = 'Ciprofloxacino'
  AND mp.form = 'Comprimido'
  AND mp.concentration = '500MG';
