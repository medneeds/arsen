-- ════════════════════════════════════════════════════════════════════
-- MONITOR: Pacientes em "limbo" entre etapas de transferência
-- ════════════════════════════════════════════════════════════════════
--
-- Uso: executar no SQL Editor do Supabase quando houver suspeita de
-- paciente "desaparecido" — Etapa 1 foi feita (leito zerado) mas a
-- Etapa 2 (alocação no destino) nunca ocorreu.
--
-- Risco: zero — apenas leitura (SELECT).
-- ════════════════════════════════════════════════════════════════════

-- 1. Transferências sinalizadas há mais de 2 horas sem Etapa 2
SELECT
  r.id                                                AS request_id,
  r.patient_name                                      AS paciente,
  r.source_bed                                        AS leito_origem,
  r.target_sector_label                               AS setor_destino,
  r.classification                                    AS classificacao,
  r.requires_saps                                     AS exige_saps,
  r.created_at                                        AS sinalizado_em,
  ROUND(EXTRACT(EPOCH FROM (now() - r.created_at)) / 3600, 1)
                                                      AS horas_pendente,
  r.encounter_code                                    AS num_atendimento
FROM internal_transfer_requests r
WHERE r.status = 'pending'
  AND r.created_at < now() - interval '2 hours'
ORDER BY r.created_at ASC;

-- 2. Verifica se o leito de origem do request ainda existe e está vago
--    (confirma que Etapa 1 realmente ocorreu)
SELECT
  r.patient_name                    AS paciente,
  r.source_bed                      AS leito_origem_esperado,
  p.name                            AS nome_atual_no_leito,
  p.is_vacant                       AS leito_vago,
  p.admission_status                AS status_leito,
  r.created_at                      AS sinalizado_em
FROM internal_transfer_requests r
LEFT JOIN patients p ON p.id = r.source_patient_id
WHERE r.status = 'pending'
  AND r.created_at < now() - interval '2 hours'
ORDER BY r.created_at ASC;

-- 3. Verifica no patient_registry se o paciente tem registry preservado
SELECT
  r.patient_name,
  r.created_at                      AS sinalizado_em,
  pr.id                             AS registry_id,
  pr.full_name                      AS nome_no_registry,
  pr.medical_record                 AS prontuario
FROM internal_transfer_requests r
JOIN patients src ON src.id = r.source_patient_id
LEFT JOIN patient_registry pr ON pr.id = src.patient_registry_id
WHERE r.status = 'pending'
  AND r.created_at < now() - interval '2 hours'
ORDER BY r.created_at ASC;
