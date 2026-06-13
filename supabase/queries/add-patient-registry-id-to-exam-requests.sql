-- Migração: adiciona patient_registry_id em exam_requests
-- Permite histórico de procedimentos persistir entre re-internações
--
-- PASSO 1: rodar no SQL Editor do Supabase
-- PASSO 2: verificar o resultado com a query ao final
-- PASSO 3: deploy do código atualizado

-- 1. Adiciona coluna (nullable — registros antigos ficam com NULL até migração)
ALTER TABLE exam_requests
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES patient_registry(id);

-- 2. Índice para queries de histórico por paciente permanente
CREATE INDEX IF NOT EXISTS idx_exam_requests_patient_registry_id
  ON exam_requests(patient_registry_id);

-- 3. Migra registros existentes (procedures com patient_id = patients.id)
UPDATE exam_requests er
SET patient_registry_id = p.patient_registry_id
FROM patients p
WHERE er.patient_id = p.id
  AND p.patient_registry_id IS NOT NULL
  AND er.patient_registry_id IS NULL;

-- Verificação: deve mostrar 0 linhas com patient_registry_id = NULL para category = procedimento
-- onde o paciente tem registry_id no cadastro
SELECT er.id, er.patient_name, er.patient_registry_id, p.patient_registry_id AS registry_no_paciente
FROM exam_requests er
JOIN patients p ON p.id = er.patient_id
WHERE er.category = 'procedimento'
  AND er.patient_registry_id IS NULL
  AND p.patient_registry_id IS NOT NULL;
