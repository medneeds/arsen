# Exportar 26 tabelas com dados em CSV

## O que vou fazer

1. Rodar `COPY ... TO STDOUT CSV HEADER` via psql para cada uma das 26 tabelas públicas com `n_live_tup > 0`, salvando um arquivo `.csv` por tabela em `/mnt/documents/db-export-YYYYMMDD/`.
2. Compactar tudo em um único `db-export-YYYYMMDD.zip` em `/mnt/documents/` para download.
3. Entregar via `<presentation-artifact>` o link do `.zip` (e listar os tamanhos por tabela para conferência).

## Tabelas incluídas (ordem por volume)

audit_logs (115.758), prescriptions (4.197), clinical_evolutions (3.554), exam_requests (2.842), medication_favorites (2.197), prescriptions_archive (847), patient_movements (590), pre_admissions (366), patient_encounters (321), patients (305), admission_histories (272), saps3_assessments (170), discharge_documents (140), internal_transfer_requests (57), patient_registry (52), patient_admission_date_history (46), prescription_quick_templates (38), user_admin_audit (14), prescription_draft_deletion_audit (9), prescription_validations (8), db_backups (8), patient_registry_edit_history (8), ip_access_log (7), user_roles (1), system_maintenance_mode (1), medical_record_edit_history (1).

## Avisos importantes (LGPD/PHI)

- O export inclui **dados clínicos identificáveis** (pacientes, evoluções, prescrições, SAPS3, altas, movimentações, auditoria). É PHI sob LGPD Art. 11.
- O arquivo ficará em `/mnt/documents/` (acessível pelo seu painel Lovable). **Não compartilhe fora do hospital sem base legal.**
- `audit_logs` tem 115k linhas — o CSV pode passar de 50 MB sozinho; o zip total deve caber bem.
- Não é um `pg_dump` (não restaura schema/constraints/sequences). É só conteúdo tabular, uma planilha por tabela. Para reimportar precisa de schema já existente + `COPY FROM`.

## O que NÃO será tocado

- Nenhuma escrita no banco. Só `SELECT`/`COPY TO`.
- Nenhum arquivo do projeto alterado.
- Nada nos buckets de Storage.

## Confirmação

Confirma que pode exportar PHI completo (inclusive `audit_logs` inteiro e `patient_registry` com CPF/CNS)? Se quiser, posso:
- (a) Exportar **tudo** como pedido, ou
- (b) Exportar tudo **mascarando CPF/CNS/nome da mãe** em `patient_registry` e `patients`, ou
- (c) Excluir `audit_logs` do zip (gera um CSV separado opcional).

Aprovando o plano sem ressalva, sigo com (a).
