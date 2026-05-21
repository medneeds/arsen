-- Correção cirúrgica de vínculos paciente↔encontro para JOSE WILLAME LOPES SILVA
-- (bug recorrente: leito reaproveitado deixou patient_id desalinhado em patient_encounters)
-- Regra: vínculo confiável é registry_id; corrigir patient_id quando estiver
-- NULO ou apontando para uma linha-leito de OUTRO registry.

-- 1) Encontro 2fda... (registry de JOSE) está com patient_id NULO → restaurar
UPDATE public.patient_encounters
SET patient_id = '9b82a715-4849-4fca-aa3d-2c4786fe4b46'
WHERE id = '2fda9d30-c1a2-4947-8432-acc4e829a1d9'
  AND registry_id = '89ca596c-e6b5-4cc2-94c2-5459ee0ab61b'
  AND patient_id IS NULL;

-- 2) Encontro aa82a9cc... (registry de SILVIO) está com patient_id apontando
-- para a linha-leito de JOSE → desvincular (registry é a verdade)
UPDATE public.patient_encounters
SET patient_id = NULL
WHERE id = 'aa82a9cc-9186-424f-b096-bb57c5f1db6c'
  AND registry_id = 'e45e58ee-98b2-4f9b-9e2c-b00e7155be5f'
  AND patient_id = '9b82a715-4849-4fca-aa3d-2c4786fe4b46';